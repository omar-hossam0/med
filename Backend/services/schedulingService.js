/**
 * Appointment scheduling, slot generation and status transitions.
 *
 * Rules enforced here:
 *  - slots are derived from doctor_availability minus time-off, live
 *    appointments and live proposals, with a one-hour lead time;
 *  - every booking re-validates the slot inside the transaction (race safety);
 *  - every status change writes appointment.status_changed to audit_logs in
 *    the same transaction, so v_appointment_status_timeline is complete;
 *  - patient mutations use optimistic concurrency (version);
 *  - internal_notes never leaves staff responses.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const { Validator, UUID_REGEX } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const {
  assertUuid,
  iso,
  dateOnly,
  pagination,
  page,
  optionalText,
  withTransaction,
  mapDbError,
  zonedTimeToUtc,
  localDateIn,
} = require("../utils/dbHelpers");
const {
  serializeAppointment,
  serializeTimelineEntry,
  serializeSlot,
  toDbConsultationType,
} = require("../utils/patientSerializers");
const { assertAppointmentAccess } = require("./accessService");

const DEFAULT_TIMEZONE = "Africa/Cairo";
const CANCEL_REASONS = [
  "Schedule conflict",
  "Feeling better",
  "Found another provider",
  "Financial reasons",
  "Other",
];
const APPOINTMENT_SELECT = `
  SELECT a.*, s.name AS specialty,
         u.full_name AS doctor_full_name, p.full_name AS patient_full_name,
         cl.name AS location_name, cl.address_line1, cl.city, cl.timezone
    FROM appointments a
    JOIN specialties s ON s.id = a.specialty_id
    JOIN users u       ON u.id = a.doctor_user_id
    JOIN users p       ON p.id = a.patient_user_id
    LEFT JOIN clinic_locations cl ON cl.id = a.clinic_location_id
`;

const BLOCKING_STATUSES = ["cancelled", "no_show", "rescheduled"];
const LIVE_PROPOSAL_STATUSES = ["proposed", "selected"];

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function doctorContext(executor, doctorId) {
  const { rows } = await executor.query(
    `SELECT u.id, u.status, dp.verification_status, cl.timezone
       FROM users u
       JOIN doctor_profiles dp ON dp.user_id = u.id
       LEFT JOIN clinic_locations cl ON cl.id = dp.primary_location_id
      WHERE u.id = $1`,
    [doctorId]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Doctor not found.");
  return rows[0];
}

/**
 * Authoritative slot list. `executor` may be a transaction client so that a
 * booking re-checks availability under the same snapshot that performs the
 * insert. `exclude*` lets a reschedule/booking ignore the row it replaces.
 */
async function generateSlots(executor, {
  doctorId,
  date,
  consultationType,
  excludeAppointmentId = null,
  excludeProposalId = null,
}) {
  const doctor = await doctorContext(executor, doctorId);
  const timezone = doctor.timezone || DEFAULT_TIMEZONE;

  if (date < localDateIn(timezone)) {
    throw httpError(400, "validation_error", "The selected date is in the past.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const dayStart = zonedTimeToUtc(year, month, day, 0, 0, timezone);
  const dayEnd = zonedTimeToUtc(year, month, day + 1, 0, 0, timezone);
  const leadTime = Date.now() + 60 * 60 * 1000;

  const [windows, timeOff, appointments, proposals] = await Promise.all([
    executor.query(
      `SELECT da.*, cl.timezone AS window_timezone
         FROM doctor_availability da
         JOIN clinic_locations cl ON cl.id = da.clinic_location_id
        WHERE da.doctor_user_id = $1
          AND da.weekday = $2
          AND da.is_active
          AND da.effective_from <= $3::date
          AND (da.effective_to IS NULL OR da.effective_to >= $3::date)
          AND (da.consultation_type = $4 OR da.consultation_type = 'both')
        ORDER BY da.start_time`,
      [doctorId, weekday, date, consultationType]
    ),
    executor.query(
      `SELECT starts_at, ends_at FROM doctor_time_off
        WHERE doctor_user_id = $1 AND starts_at < $3 AND ends_at > $2`,
      [doctorId, dayStart, dayEnd]
    ),
    executor.query(
      `SELECT COALESCE(scheduled_start_at, requested_start_at) AS starts_at,
              COALESCE(scheduled_end_at, requested_end_at) AS ends_at
         FROM appointments
        WHERE doctor_user_id = $1
          AND status <> ALL($2::varchar[])
          AND id IS DISTINCT FROM $3::uuid
          AND COALESCE(scheduled_start_at, requested_start_at) < $5
          AND COALESCE(scheduled_end_at, requested_end_at) > $4`,
      [doctorId, BLOCKING_STATUSES, excludeAppointmentId, dayStart, dayEnd]
    ),
    executor.query(
      `SELECT proposed_start_at AS starts_at, proposed_end_at AS ends_at
         FROM appointment_proposals
        WHERE doctor_user_id = $1
          AND status = ANY($2::varchar[])
          AND id IS DISTINCT FROM $3::uuid
          AND proposed_start_at < $5
          AND proposed_end_at > $4`,
      [doctorId, LIVE_PROPOSAL_STATUSES, excludeProposalId, dayStart, dayEnd]
    ),
  ]);

  const blocked = [
    ...timeOff.rows,
    ...appointments.rows,
    ...proposals.rows,
  ]
    .map((row) => ({ start: new Date(row.starts_at).getTime(), end: new Date(row.ends_at).getTime() }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end));

  const slots = [];
  const seen = new Set();

  for (const window of windows.rows) {
    const windowTz = window.window_timezone || timezone;
    const [sh, sm] = String(window.start_time).slice(0, 5).split(":").map(Number);
    const [eh, em] = String(window.end_time).slice(0, 5).split(":").map(Number);
    const step = Number(window.slot_minutes) || 30;
    let cursor = zonedTimeToUtc(year, month, day, sh, sm, windowTz);
    const windowEnd = zonedTimeToUtc(year, month, day, eh, em, windowTz);

    while (cursor < windowEnd) {
      const end = new Date(Math.min(cursor.getTime() + step * 60000, windowEnd.getTime()));
      const key = `${cursor.getTime()}:${end.getTime()}`;
      if (!seen.has(key)) {
        seen.add(key);
        const startMs = cursor.getTime();
        const endMs = end.getTime();
        slots.push({
          startsAt: cursor,
          endsAt: end,
          time: formatLocalHour(cursor, windowTz),
          startMs,
          endMs,
          available:
            startMs >= leadTime &&
            !blocked.some((range) => overlaps(startMs, endMs, range.start, range.end)),
        });
      }
      cursor = end;
    }
  }

  slots.sort((a, b) => a.startMs - b.startMs);
  return {
    slots: slots.map(({ startsAt, endsAt, time, available }) => ({ startsAt, endsAt, time, available })),
    timezone,
    doctor,
  };
}

function formatLocalHour(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour12: false, hour: "2-digit", minute: "2-digit",
  }).format(date);
  return parts.slice(0, 5);
}

async function getSlots({ query }) {
  const v = new Validator();
  const doctorId = v.uuid(query.doctor_id, "doctor_id", { required: true });
  const date = v.isoDate(query.date, "date", { required: true, label: "Date" });
  const consultationType = v.oneOf(query.consultation_type, "consultation_type", ["in_person", "online"], {
    label: "Consultation type",
  });
  v.done();

  const result = await generateSlots(pool, { doctorId, date, consultationType });
  return {
    date,
    consultation_type: consultationType,
    timezone: result.timezone,
    slots: result.slots.map(serializeSlot),
  };
}

/**
 * Re-check a requested slot inside the caller's transaction. A slot is valid
 * only if it appears in the freshly generated, available slot list.
 */
async function assertSlotFree(executor, {
  doctorId,
  startAt,
  endAt,
  consultationType,
  excludeAppointmentId = null,
  excludeProposalId = null,
}) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw httpError(400, "validation_error", "A valid start and end time are required.");
  }

  const doctor = await doctorContext(executor, doctorId);
  const timezone = doctor.timezone || DEFAULT_TIMEZONE;
  const date = localDateIn(timezone, start);
  const generated = await generateSlots(executor, {
    doctorId, date, consultationType, excludeAppointmentId, excludeProposalId,
  });

  const match = generated.slots.find(
    (slot) => slot.startsAt.getTime() === start.getTime() && slot.endsAt.getTime() === end.getTime()
  );
  if (!match || !match.available) {
    throw httpError(409, "slot_taken", "The selected slot is no longer available.");
  }
  return { date, timezone };
}

async function fetchAppointment(executor, id) {
  const { rows } = await executor.query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [id]);
  return rows[0] || null;
}

async function lockAppointment(executor, id) {
  const { rows } = await executor.query(`SELECT * FROM appointments WHERE id = $1 FOR UPDATE`, [id]);
  if (rows.length === 0) throw httpError(404, "not_found", "Appointment not found.");
  return rows[0];
}

async function notify(client, recipientUserId, { category, title, body, entityType, entityId }) {
  await client.query(
    `INSERT INTO notifications
       (recipient_user_id, category, channel, title, body,
        related_entity_type, related_entity_id, status)
     VALUES ($1, $2, 'in_app', $3, $4, $5, $6, 'sent')`,
    [recipientUserId, category, title, body, entityType, entityId]
  );
}

async function notifyStaff(client, { title, body, entityId }) {
  const { rows } = await client.query(
    `SELECT u.id FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r       ON r.id = ur.role_id AND r.name = 'receptionist'
     WHERE u.status = 'active'`
  );
  for (const row of rows) {
    await notify(client, row.id, { category: "appointment", title, body, entityType: "appointment", entityId });
  }
}

/** Write the appointment.created event plus the first timeline entry. */
async function recordCreation(client, ctx, appointmentId, patientUserId, changeSource) {
  await auditService.recordMutation(client, {
    actorUserId: ctx.actorId,
    eventType: "appointment.created",
    eventCategory: "appointment",
    entityType: "appointment",
    entityId: appointmentId,
    patientUserId,
    after: { status: "requested", version: 1 },
    metadata: { change_source: changeSource },
    context: ctx.context,
  });
  await auditService.recordAppointmentTransition(client, {
    actorUserId: ctx.actorId,
    appointmentId,
    patientUserId,
    fromStatus: null,
    toStatus: "requested",
    changeSource,
    changeReason: "Appointment requested",
    ip: ctx.context?.ip,
    userAgent: ctx.context?.userAgent,
  });
}

async function ensureCareRelationship(client, { patientUserId, doctorUserId, appointmentId, grantedBy }) {
  await client.query(
    `INSERT INTO care_relationships
       (patient_user_id, doctor_user_id, source, source_appointment_id, granted_by_user_id, status)
     VALUES ($1, $2, 'appointment', $3, $4, 'active')
     ON CONFLICT (patient_user_id, doctor_user_id) WHERE status = 'active' DO NOTHING`,
    [patientUserId, doctorUserId, appointmentId, grantedBy]
  );
}

/**
 * Generic status transition: loads and locks the row, asserts the allowed
 * source state and optional version, applies an allowlisted patch, writes the
 * timeline audit row, and returns the refreshed appointment.
 */
async function applyTransition(client, ctx, id, {
  allowedFrom,
  status,
  patch = {},
  version = null,
  changeReason = null,
  changeSource = "staff",
}) {
  const current = await lockAppointment(client, id);
  if (!allowedFrom.includes(current.status)) {
    throw httpError(409, "invalid_appointment_transition", `An appointment in status ${current.status} cannot move to ${status}.`);
  }
  if (current.status === status) {
    throw httpError(409, "status_unchanged", "The appointment is already in the requested status.");
  }
  if (version !== null && Number(version) !== Number(current.version)) {
    throw httpError(409, "version_conflict", "This appointment was changed by someone else. Reload and try again.");
  }

  const columns = Object.keys(patch);
  const values = columns.map((column) => patch[column]);
  const sets = columns.map((column, index) => `${column} = $${index + 1}`);
  sets.push(`status = $${values.length + 1}`);
  values.push(status);
  sets.push("version = version + 1");
  values.push(id);
  const idIndex = values.length;
  let sql = `UPDATE appointments SET ${sets.join(", ")} WHERE id = $${idIndex}`;
  if (version !== null) {
    values.push(version);
    sql += ` AND version = $${values.length}`;
  }
  sql += " RETURNING *";
  const updated = await client.query(sql, values);
  if (updated.rowCount === 0) {
    throw httpError(409, "version_conflict", "This appointment was changed by someone else. Reload and try again.");
  }

  await auditService.recordAppointmentTransition(client, {
    actorUserId: ctx.actorId,
    appointmentId: id,
    patientUserId: current.patient_user_id,
    fromStatus: current.status,
    toStatus: status,
    changeSource,
    changeReason,
    ip: ctx.context?.ip,
    userAgent: ctx.context?.userAgent,
  });

  return updated.rows[0];
}

/* --------------------------------- patient -------------------------------- */

async function listPatientAppointments({ query, actorId }) {
  const { limit, offset } = pagination(query, { defaultLimit: 50 });
  const status = optionalText(query.status, 30);
  const tab = optionalText(query.tab, 20);
  const { rows } = await pool.query(
    `${APPOINTMENT_SELECT}
      WHERE a.patient_user_id = $1
        AND ($2::text IS NULL OR a.status = $2)
      ORDER BY COALESCE(a.scheduled_start_at, a.requested_start_at) DESC NULLS LAST, a.created_at DESC`,
    [actorId, status]
  );
  let filtered = rows;
  if (tab === "Upcoming") filtered = rows.filter((row) => ["requested", "pending_confirmation", "confirmed", "checked_in", "in_progress"].includes(row.status));
  if (tab === "Completed") filtered = rows.filter((row) => row.status === "completed");
  if (tab === "Cancelled") filtered = rows.filter((row) => ["cancelled", "no_show", "rescheduled"].includes(row.status));
  const paged = page(filtered, { limit, offset });
  return { appointments: paged.rows.map((row) => serializeAppointment(row)), pagination: paged.pagination };
}

async function getPatientAppointment(ctx) {
  const { params, actorId } = ctx;
  const id = assertUuid(params.id, "Appointment");
  const appointment = await fetchAppointment(pool, id);
  if (!appointment || appointment.patient_user_id !== actorId) {
    throw httpError(404, "not_found", "Appointment not found.");
  }
  const { rows } = await pool.query(
    `SELECT id, from_status, to_status, reason, changed_by_user_id, change_source, changed_at
       FROM v_appointment_status_timeline WHERE appointment_id = $1 ORDER BY changed_at`,
    [id]
  );
  return {
    appointment: serializeAppointment(appointment, { includeTimeline: true }),
    timeline: rows.map(serializeTimelineEntry),
  };
}

async function getAppointmentTimeline(ctx) {
  const { params, actorId } = ctx;
  const id = assertUuid(params.id, "Appointment");
  const appointment = await fetchAppointment(pool, id);
  if (!appointment || appointment.patient_user_id !== actorId) {
    throw httpError(404, "not_found", "Appointment not found.");
  }
  const { rows } = await pool.query(
    `SELECT id, from_status, to_status, reason, changed_by_user_id, change_source, changed_at
       FROM v_appointment_status_timeline WHERE appointment_id = $1 ORDER BY changed_at`,
    [id]
  );
  return { timeline: rows.map(serializeTimelineEntry) };
}

async function createAppointment(ctx) {
  const { body } = ctx;
  const v = new Validator();
  const doctorId = v.uuid(body.doctor_id, "doctor_id", { required: true });
  const specialtyId = v.uuid(body.specialty_id, "specialty_id", { required: true });
  const locationId = v.uuid(body.clinic_location_id, "clinic_location_id");
  const consultationType = v.oneOf(body.consultation_type, "consultation_type", ["in_person", "online"], { label: "Consultation type" });
  const requestedStart = v.datetime(body.requested_start_at, "requested_start_at", { required: true });
  const requestedEnd = v.datetime(body.requested_end_at, "requested_end_at", { required: true });
  const reason = v.text(body.reason, "reason", { max: 500, label: "Reason" });
  const patientNotes = v.text(body.patient_notes, "patient_notes", { max: 1000, label: "Notes" });
  v.done();

  if (new Date(requestedEnd) <= new Date(requestedStart)) {
    throw httpError(400, "validation_error", "The end time must be after the start time.");
  }

  return withTransaction(async (client) => {
    const doctor = await doctorContext(client, doctorId);
    if (doctor.status !== "active" || doctor.verification_status !== "verified") {
      throw httpError(400, "validation_error", "The selected doctor is not available for booking.");
    }
    const specialty = await client.query(`SELECT id FROM specialties WHERE id = $1 AND is_active`, [specialtyId]);
    if (specialty.rowCount === 0) throw httpError(400, "unknown_specialty", "The selected specialty does not exist.");
    if (locationId) {
      const location = await client.query(`SELECT id FROM clinic_locations WHERE id = $1 AND is_active`, [locationId]);
      if (location.rowCount === 0) throw httpError(400, "unknown_location", "The selected clinic location does not exist.");
    }

    await assertSlotFree(client, { doctorId, startAt: requestedStart, endAt: requestedEnd, consultationType });

    const inserted = await client.query(
      `INSERT INTO appointments
         (patient_user_id, doctor_user_id, specialty_id, clinic_location_id,
          consultation_type, status, requested_start_at, requested_end_at,
          reason, patient_notes, booked_by_user_id, version)
       VALUES ($1, $2, $3, $4, $5, 'requested', $6, $7, $8, $9, $1, 1)
       RETURNING id`,
      [ctx.actorId, doctorId, specialtyId, locationId || null, consultationType, requestedStart, requestedEnd, reason, patientNotes]
    );
    const id = inserted.rows[0].id;

    await ensureCareRelationship(client, {
      patientUserId: ctx.actorId, doctorUserId: doctorId, appointmentId: id, grantedBy: ctx.actorId,
    });
    await recordCreation(client, ctx, id, ctx.actorId, "patient");
    await notifyStaff(client, {
      title: "New appointment request",
      body: "A patient requested an appointment. Review the requested slot and confirm it.",
      entityId: id,
    });

    return { appointment: serializeAppointment(await fetchAppointment(client, id)) };
  });
}

async function rescheduleAppointment(ctx) {
  const { body, params } = ctx;
  const id = assertUuid(params.id, "Appointment");
  const v = new Validator();
  const version = v.integer(body.version, "version", { min: 1, max: 1000000, label: "Version" });
  const requestedStart = v.datetime(body.requested_start_at, "requested_start_at", { required: true });
  const requestedEnd = v.datetime(body.requested_end_at, "requested_end_at", { required: true });
  const reason = v.text(body.reason, "reason", { max: 500, label: "Reason" });
  v.done();
  if (version === null) throw httpError(400, "validation_error", "version is required for a reschedule.");
  if (new Date(requestedEnd) <= new Date(requestedStart)) {
    throw httpError(400, "validation_error", "The end time must be after the start time.");
  }

  return withTransaction(async (client) => {
    const current = await lockAppointment(client, id);
    if (current.patient_user_id !== ctx.actorId) throw httpError(404, "not_found", "Appointment not found.");
    const allowed = ["requested", "pending_confirmation", "confirmed", "checked_in"];
    if (!allowed.includes(current.status)) {
      throw httpError(409, "invalid_appointment_transition", "This appointment can no longer be rescheduled.");
    }
    if (Number(version) !== Number(current.version)) {
      throw httpError(409, "version_conflict", "This appointment was changed by someone else. Reload and try again.");
    }

    await assertSlotFree(client, {
      doctorId: current.doctor_user_id,
      startAt: requestedStart,
      endAt: requestedEnd,
      consultationType: current.consultation_type,
      excludeAppointmentId: id,
    });

    // The superseded appointment keeps its history; the replacement is a new
    // row linked by rescheduled_from_appointment_id.
    const updated = await client.query(
      `UPDATE appointments SET status = 'rescheduled', version = version + 1
        WHERE id = $1 AND version = $2 RETURNING *`,
      [id, version]
    );
    if (updated.rowCount === 0) throw httpError(409, "version_conflict", "This appointment was changed by someone else.");
    await auditService.recordAppointmentTransition(client, {
      actorUserId: ctx.actorId, appointmentId: id, patientUserId: current.patient_user_id,
      fromStatus: current.status, toStatus: "rescheduled", changeSource: "patient",
      changeReason: reason || "Patient requested a new slot",
      ip: ctx.context?.ip, userAgent: ctx.context?.userAgent,
    });

    const inserted = await client.query(
      `INSERT INTO appointments
         (patient_user_id, doctor_user_id, specialty_id, clinic_location_id,
          consultation_type, status, requested_start_at, requested_end_at,
          reason, patient_notes, booked_by_user_id, rescheduled_from_appointment_id, version)
       VALUES ($1, $2, $3, $4, $5, 'requested', $6, $7, $8, $9, $1, $10, 1)
       RETURNING id`,
      [
        current.patient_user_id, current.doctor_user_id, current.specialty_id,
        current.clinic_location_id, current.consultation_type,
        requestedStart, requestedEnd, reason || current.reason,
        current.patient_notes, id,
      ]
    );
    const newId = inserted.rows[0].id;
    await ensureCareRelationship(client, {
      patientUserId: current.patient_user_id, doctorUserId: current.doctor_user_id,
      appointmentId: newId, grantedBy: ctx.actorId,
    });
    await recordCreation(client, ctx, newId, current.patient_user_id, "patient");
    await notifyStaff(client, {
      title: "Appointment rescheduled",
      body: "A patient proposed a new slot. Review and confirm the replacement appointment.",
      entityId: newId,
    });

    return { appointment: serializeAppointment(await fetchAppointment(client, newId)), supersededAppointmentId: id };
  });
}

async function cancelAppointment(ctx) {
  const { body, params } = ctx;
  const id = assertUuid(params.id, "Appointment");
  const v = new Validator();
  const version = v.integer(body.version, "version", { min: 1, max: 1000000, label: "Version" });
  const cancellationReason = v.oneOf(body.cancellation_reason, "cancellation_reason", CANCEL_REASONS, {
    label: "Cancellation reason",
  });
  const notes = v.text(body.notes, "notes", { max: 500, label: "Notes" });
  v.done();
  if (version === null) throw httpError(400, "validation_error", "version is required to cancel an appointment.");

  return withTransaction(async (client) => {
    const current = await lockAppointment(client, id);
    if (current.patient_user_id !== ctx.actorId) throw httpError(404, "not_found", "Appointment not found.");
    const allowed = ["requested", "pending_confirmation", "confirmed"];
    if (!allowed.includes(current.status)) {
      throw httpError(409, "invalid_appointment_transition", "This appointment can no longer be cancelled by the patient.");
    }
    const updated = await applyTransition(client, ctx, id, {
      allowedFrom: allowed,
      status: "cancelled",
      version,
      changeSource: "patient",
      changeReason: notes ? `${cancellationReason}: ${notes}` : cancellationReason,
      patch: {
        cancelled_at: new Date(),
        cancelled_by_user_id: ctx.actorId,
        cancellation_reason: cancellationReason,
      },
    });
    await notifyStaff(client, {
      title: "Appointment cancelled",
      body: "A patient cancelled an appointment.",
      entityId: id,
    });
    return { appointment: serializeAppointment({ ...updated, ...(await fetchAppointment(client, id)) }) };
  });
}

/* --------------------------------- doctor --------------------------------- */

function optionalIsoDate(value) {
  if (!value) return null;
  const v = new Validator();
  const parsed = v.isoDate(value, "date", { label: "Date" });
  v.done();
  return parsed;
}

async function listDoctorAppointments({ query, actorId }) {
  const { limit, offset } = pagination(query, { defaultLimit: 50 });
  const date = optionalIsoDate(query.date);
  const status = optionalText(query.status, 30);
  const { rows } = await pool.query(
    `${APPOINTMENT_SELECT}
      WHERE a.doctor_user_id = $1
        AND ($2::text IS NULL OR a.status = $2)
        AND ($3::text IS NULL
             OR COALESCE(a.scheduled_start_at, a.requested_start_at) >= ($3::date)
             AND COALESCE(a.scheduled_start_at, a.requested_start_at) < ($3::date + interval '1 day'))
      ORDER BY COALESCE(a.scheduled_start_at, a.requested_start_at) ASC NULLS LAST`,
    [actorId, status, date]
  );
  const paged = page(rows, { limit, offset });
  return { appointments: paged.rows.map((row) => serializeAppointment(row)), pagination: paged.pagination };
}

/* ---------------------------------- staff --------------------------------- */

async function listStaffAppointments({ query }) {
  const { limit, offset } = pagination(query, { defaultLimit: 50 });
  const date = optionalIsoDate(query.date);
  const status = optionalText(query.status, 30);
  const doctorId = typeof query.doctor_id === "string" && UUID_REGEX.test(query.doctor_id) ? query.doctor_id : null;
  const patient = optionalText(query.patient, 120);
  const { rows } = await pool.query(
    `${APPOINTMENT_SELECT}
      WHERE ($1::text IS NULL OR a.status = $1)
        AND ($2::uuid IS NULL OR a.doctor_user_id = $2)
        AND ($3::text IS NULL OR p.full_name ILIKE '%' || $3 || '%')
        AND ($4::text IS NULL
             OR COALESCE(a.scheduled_start_at, a.requested_start_at) >= ($4::date)
             AND COALESCE(a.scheduled_start_at, a.requested_start_at) < ($4::date + interval '1 day'))
      ORDER BY COALESCE(a.scheduled_start_at, a.requested_start_at) DESC NULLS LAST`,
    [status, doctorId, patient, date]
  );
  const paged = page(rows, { limit, offset });
  return { appointments: paged.rows.map((row) => serializeAppointment(row, { includeInternal: true })), pagination: paged.pagination };
}

async function getStaffAppointment({ params }) {
  const id = assertUuid(params.id, "Appointment");
  const appointment = await fetchAppointment(pool, id);
  if (!appointment) throw httpError(404, "not_found", "Appointment not found.");
  const { rows } = await pool.query(
    `SELECT id, from_status, to_status, reason, changed_by_user_id, change_source, changed_at
       FROM v_appointment_status_timeline WHERE appointment_id = $1 ORDER BY changed_at`,
    [id]
  );
  return {
    appointment: serializeAppointment(appointment, { includeInternal: true }),
    timeline: rows.map(serializeTimelineEntry),
  };
}

async function staffSchedule(ctx) {
  const { body, params } = ctx;
  const id = assertUuid(params.id, "Appointment");
  const v = new Validator();
  const start = v.datetime(body.scheduled_start_at, "scheduled_start_at", { required: true });
  const end = v.datetime(body.scheduled_end_at, "scheduled_end_at", { required: true });
  const locationId = v.uuid(body.clinic_location_id, "clinic_location_id");
  const version = v.integer(body.version, "version", { min: 1, max: 1000000, label: "Version" });
  v.done();
  if (new Date(end) <= new Date(start)) throw httpError(400, "validation_error", "The end time must be after the start time.");

  return withTransaction(async (client) => {
    const current = await lockAppointment(client, id);
    await assertSlotFree(client, {
      doctorId: current.doctor_user_id,
      startAt: start,
      endAt: end,
      consultationType: current.consultation_type,
      excludeAppointmentId: id,
    });
    await applyTransition(client, ctx, id, {
      allowedFrom: ["requested"],
      status: "pending_confirmation",
      version,
      changeSource: "staff",
      changeReason: "Staff assigned a confirmed slot",
      patch: {
        scheduled_start_at: start,
        scheduled_end_at: end,
        ...(locationId ? { clinic_location_id: locationId } : {}),
      },
    });
    return { appointment: serializeAppointment(await fetchAppointment(client, id), { includeInternal: true }) };
  });
}

/** Create the clinical encounter when a booking is actually confirmed. */
async function ensureConsultation(client, appointment) {
  await client.query(
    `INSERT INTO consultations (appointment_id, patient_user_id, doctor_user_id, status)
     VALUES ($1, $2, $3, 'scheduled')
     ON CONFLICT (appointment_id) DO NOTHING`,
    [appointment.id, appointment.patient_user_id, appointment.doctor_user_id]
  );
}

/** A follow-up reaches 'scheduled' only once its appointment is confirmed. */
async function markFollowUpScheduled(client, appointmentId) {
  await client.query(
    `UPDATE follow_ups
        SET status = 'scheduled', updated_at = now()
      WHERE id IN (
        SELECT ap.follow_up_id FROM appointment_proposals ap
         WHERE ap.booked_appointment_id = $1 AND ap.follow_up_id IS NOT NULL
      ) AND status IN ('accepted', 'scheduling')`,
    [appointmentId]
  );
}

async function staffConfirm(ctx) {
  const { body, params } = ctx;
  const id = assertUuid(params.id, "Appointment");
  const v = new Validator();
  const version = v.integer(body.version, "version", { min: 1, max: 1000000, label: "Version" });
  v.done();

  return withTransaction(async (client) => {
    const current = await lockAppointment(client, id);
    const start = current.scheduled_start_at || current.requested_start_at;
    const end = current.scheduled_end_at || current.requested_end_at;
    if (!start || !end) {
      throw httpError(409, "invalid_appointment_transition", "A slot must be scheduled before confirmation.");
    }

    const updated = await applyTransition(client, ctx, id, {
      allowedFrom: ["requested", "pending_confirmation"],
      status: "confirmed",
      version,
      changeSource: "staff",
      changeReason: "Appointment confirmed by staff",
      patch: {
        scheduled_start_at: start,
        scheduled_end_at: end,
        confirmed_at: new Date(),
        confirmed_by_user_id: ctx.actorId,
      },
    });

    await ensureConsultation(client, updated);
    await markFollowUpScheduled(client, id);
    await notify(client, updated.patient_user_id, {
      category: "appointment",
      title: "Appointment confirmed",
      body: "Your appointment has been confirmed. You can view the details in your appointments list.",
      entityType: "appointment",
      entityId: id,
    });

    return { appointment: serializeAppointment(await fetchAppointment(client, id), { includeInternal: true }) };
  });
}

async function staffCheckIn(ctx) {
  return withTransaction(async (client) => {
    const id = assertUuid(ctx.params.id, "Appointment");
    await applyTransition(client, ctx, id, {
      allowedFrom: ["confirmed"], status: "checked_in", changeSource: "staff",
      changeReason: "Patient checked in", patch: { checked_in_at: new Date() },
    });
    return { appointment: serializeAppointment(await fetchAppointment(client, id), { includeInternal: true }) };
  });
}

async function staffStart(ctx) {
  return withTransaction(async (client) => {
    const id = assertUuid(ctx.params.id, "Appointment");
    await applyTransition(client, ctx, id, {
      allowedFrom: ["checked_in"], status: "in_progress",
      changeSource: (ctx.user.roles || []).includes("doctor") ? "doctor" : "staff",
      changeReason: "Consultation started",
    });
    return { appointment: serializeAppointment(await fetchAppointment(client, id), { includeInternal: true }) };
  });
}

async function staffComplete(ctx) {
  return withTransaction(async (client) => {
    const id = assertUuid(ctx.params.id, "Appointment");
    const updated = await applyTransition(client, ctx, id, {
      allowedFrom: ["in_progress"], status: "completed",
      changeSource: (ctx.user.roles || []).includes("doctor") ? "doctor" : "staff",
      changeReason: "Consultation completed", patch: { completed_at: new Date() },
    });
    await client.query(
      `UPDATE consultations SET status = 'completed', ended_at = now()
        WHERE appointment_id = $1 AND status <> 'completed'`,
      [id]
    );
    return { appointment: serializeAppointment(await fetchAppointment(client, id), { includeInternal: true }) };
  });
}

async function staffNoShow(ctx) {
  return withTransaction(async (client) => {
    const id = assertUuid(ctx.params.id, "Appointment");
    await applyTransition(client, ctx, id, {
      allowedFrom: ["confirmed", "checked_in"], status: "no_show",
      changeSource: "staff", changeReason: "Patient did not attend",
    });
    return { appointment: serializeAppointment(await fetchAppointment(client, id), { includeInternal: true }) };
  });
}

async function staffNotes(ctx) {
  const { body, params } = ctx;
  const id = assertUuid(params.id, "Appointment");
  const v = new Validator();
  const notes = v.text(body.internal_notes, "internal_notes", { max: 4000, label: "Internal notes" });
  const version = v.integer(body.version, "version", { min: 1, max: 1000000, label: "Version" });
  v.done();
  if (version === null) throw httpError(400, "validation_error", "version is required.");

  return withTransaction(async (client) => {
    const current = await lockAppointment(client, id);
    const updated = await client.query(
      `UPDATE appointments
          SET internal_notes = $1, version = version + 1
        WHERE id = $2 AND version = $3 RETURNING *`,
      [notes, id, version]
    );
    if (updated.rowCount === 0) throw httpError(409, "version_conflict", "This appointment was changed by someone else.");
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "appointment.notes_updated",
      eventCategory: "appointment",
      entityType: "appointment",
      entityId: id,
      patientUserId: current.patient_user_id,
      metadata: { updated: true },
      context: ctx.context,
    });
    return { appointment: serializeAppointment(await fetchAppointment(client, id), { includeInternal: true }) };
  });
}

module.exports = {
  CANCEL_REASONS,
  APPOINTMENT_SELECT,
  generateSlots,
  assertSlotFree,
  doctorContext,
  fetchAppointment,
  notify,
  notifyStaff,
  ensureCareRelationship,
  ensureConsultation,
  markFollowUpScheduled,
  recordCreation,
  applyTransition,
  getSlots,
  listPatientAppointments,
  getPatientAppointment,
  getAppointmentTimeline,
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  listDoctorAppointments,
  listStaffAppointments,
  getStaffAppointment,
  staffSchedule,
  staffConfirm,
  staffCheckIn,
  staffStart,
  staffComplete,
  staffNoShow,
  staffNotes,
  assertAppointmentAccess,
  mapDbError,
  iso,
  dateOnly,
};

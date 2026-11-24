/**
 * Doctor workspace (Phase 9): own profile, weekly availability and time-off.
 * Credential fields (license_number, verification_status, account status/role)
 * are admin-owned and are never editable here.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const { assertUuid, iso, dateOnly, withTransaction } = require("../utils/dbHelpers");

const PROFILE_FIELDS = {
  phone: (v, body) => v.phone(body.phone, "phone"),
  bio: (v, body) => v.text(body.bio, "bio", { max: 2000, label: "About" }),
  professional_title: (v, body) => v.text(body.professional_title, "professional_title", { max: 120, label: "Professional title" }),
  years_of_experience: (v, body) => v.integer(body.years_of_experience, "years_of_experience", { min: 0, max: 70, label: "Years of experience" }),
  primary_location_id: (v, body) => v.uuid(body.primary_location_id, "primary_location_id"),
};

async function getMe({ actorId }) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.status, u.created_at,
            dp.*, s.name AS specialty, d.name AS department,
            cl.name AS location_name, cl.address_line1, cl.city, cl.timezone
       FROM users u
       JOIN doctor_profiles dp ON dp.user_id = u.id
       JOIN specialties s      ON s.id = dp.specialty_id
       LEFT JOIN departments d       ON d.specialty_id = s.id
       LEFT JOIN clinic_locations cl ON cl.id = dp.primary_location_id
      WHERE u.id = $1`,
    [actorId]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Doctor profile not found.");
  const row = rows[0];
  return {
    profile: {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      accountStatus: row.status,
      professionalTitle: row.professional_title,
      specialty: row.specialty,
      department: row.department || null,
      licenseNumber: row.license_number,
      verificationStatus: row.verification_status,
      phone: row.phone || null,
      bio: row.bio || null,
      yearsOfExperience: row.years_of_experience ?? null,
      primaryLocationId: row.primary_location_id || null,
      locationName: row.location_name || null,
      joinedAt: iso(row.created_at),
    },
  };
}

async function updateMe(ctx) {
  const { body } = ctx;
  const v = new Validator();
  const patch = {};
  for (const [column, parse] of Object.entries(PROFILE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(body, column)) {
      patch[column] = parse(v, body);
    }
  }
  v.done();
  if (Object.keys(patch).length === 0) {
    throw httpError(400, "validation_error", "No editable profile fields were supplied.");
  }

  return withTransaction(async (client) => {
    if (patch.primary_location_id) {
      const location = await client.query(
        `SELECT id FROM clinic_locations WHERE id = $1 AND is_active`,
        [patch.primary_location_id]
      );
      if (location.rowCount === 0) throw httpError(400, "unknown_location", "The selected location does not exist.");
    }
    const columns = Object.keys(patch);
    const values = columns.map((column) => patch[column]);
    values.push(ctx.actorId);
    const { rows } = await client.query(
      `UPDATE doctor_profiles SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(", ")}
        WHERE user_id = $${values.length} RETURNING user_id`,
      values
    );
    if (rows.length === 0) throw httpError(404, "not_found", "Doctor profile not found.");
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "doctor.profile_updated",
      eventCategory: "configuration",
      entityType: "user",
      entityId: ctx.actorId,
      after: patch,
      metadata: { fields: columns },
      context: ctx.context,
    });
    return getMe({ actorId: ctx.actorId });
  });
}

async function getAvailability({ actorId }) {
  const [windows, timeOff] = await Promise.all([
    pool.query(
      `SELECT da.*, cl.name AS location_name, cl.timezone
         FROM doctor_availability da
         JOIN clinic_locations cl ON cl.id = da.clinic_location_id
        WHERE da.doctor_user_id = $1
        ORDER BY da.weekday, da.start_time`,
      [actorId]
    ),
    pool.query(
      `SELECT * FROM doctor_time_off WHERE doctor_user_id = $1 ORDER BY starts_at`,
      [actorId]
    ),
  ]);
  return {
    availability: windows.rows.map((row) => ({
      id: row.id,
      weekday: row.weekday,
      startTime: String(row.start_time).slice(0, 5),
      endTime: String(row.end_time).slice(0, 5),
      slotMinutes: row.slot_minutes,
      consultationType: row.consultation_type,
      clinicLocationId: row.clinic_location_id,
      locationName: row.location_name,
      effectiveFrom: dateOnly(row.effective_from),
      effectiveTo: dateOnly(row.effective_to),
      isActive: row.is_active,
      createdAt: iso(row.created_at),
    })),
    timeOff: timeOff.rows.map((row) => ({
      id: row.id,
      startsAt: iso(row.starts_at),
      endsAt: iso(row.ends_at),
      reason: row.reason || null,
      createdAt: iso(row.created_at),
    })),
  };
}

function validateWindow(body, v, { partial = false } = {}) {
  const fields = {};
  if (!partial || Object.prototype.hasOwnProperty.call(body, "weekday")) {
    fields.weekday = v.weekday(body.weekday, "weekday", { required: !partial });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "start_time")) {
    fields.start_time = v.timeOfDay(body.start_time, "start_time", { required: !partial, label: "Start time" });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "end_time")) {
    fields.end_time = v.timeOfDay(body.end_time, "end_time", { required: !partial, label: "End time" });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "slot_minutes")) {
    fields.slot_minutes = v.integer(body.slot_minutes ?? 30, "slot_minutes", { min: 10, max: 120, label: "Slot length" });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "consultation_type")) {
    fields.consultation_type = v.oneOf(body.consultation_type, "consultation_type", ["in_person", "online", "both"], {
      required: !partial, label: "Consultation type",
    });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "clinic_location_id")) {
    fields.clinic_location_id = v.uuid(body.clinic_location_id, "clinic_location_id", { required: !partial });
  }
  if (Object.prototype.hasOwnProperty.call(body, "effective_from")) {
    fields.effective_from = v.isoDate(body.effective_from, "effective_from");
  }
  if (Object.prototype.hasOwnProperty.call(body, "effective_to")) {
    fields.effective_to = v.isoDate(body.effective_to, "effective_to");
  }
  if (Object.prototype.hasOwnProperty.call(body, "is_active")) {
    fields.is_active = v.boolean(body.is_active, "is_active");
  }
  return fields;
}

async function createAvailability(ctx) {
  const v = new Validator();
  const fields = validateWindow(ctx.body, v);
  v.done();
  if (fields.start_time && fields.end_time && fields.end_time <= fields.start_time) {
    throw httpError(400, "validation_error", "End time must be after start time.");
  }
  if (fields.effective_from && fields.effective_to && fields.effective_to < fields.effective_from) {
    throw httpError(400, "validation_error", "effective_to must be on or after effective_from.");
  }

  return withTransaction(async (client) => {
    const location = await client.query(
      `SELECT id FROM clinic_locations WHERE id = $1 AND is_active`,
      [fields.clinic_location_id]
    );
    if (location.rowCount === 0) throw httpError(400, "unknown_location", "The selected location does not exist.");

    const columns = Object.keys(fields);
    const values = columns.map((column) => fields[column]);
    const doctorIndex = values.push(ctx.actorId);
    const creatorIndex = values.push(ctx.actorId);
    const { rows } = await client.query(
      `INSERT INTO doctor_availability (${columns.join(", ")}, doctor_user_id, created_by_user_id)
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")}, $${doctorIndex}, $${creatorIndex})
       RETURNING id`,
      values
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "doctor.availability_created",
      eventCategory: "configuration",
      entityType: "doctor_availability",
      entityId: rows[0].id,
      after: fields,
      metadata: {},
      context: ctx.context,
    });
    return { id: rows[0].id, availability: fields };
  });
}

async function updateAvailability(ctx) {
  const id = assertUuid(ctx.params.id, "Availability window");
  const v = new Validator();
  const fields = validateWindow(ctx.body, v, { partial: true });
  v.done();
  if (Object.keys(fields).length === 0) {
    throw httpError(400, "validation_error", "No editable availability fields were supplied.");
  }

  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT * FROM doctor_availability WHERE id = $1 AND doctor_user_id = $2 FOR UPDATE`,
      [id, ctx.actorId]
    );
    if (current.rowCount === 0) throw httpError(404, "not_found", "Availability window not found.");
    const start = fields.start_time || current.rows[0].start_time;
    const end = fields.end_time || current.rows[0].end_time;
    if (String(end) <= String(start)) {
      throw httpError(400, "validation_error", "End time must be after start time.");
    }
    const from = fields.effective_from || dateOnly(current.rows[0].effective_from);
    const to = fields.effective_to === undefined ? dateOnly(current.rows[0].effective_to) : fields.effective_to;
    if (to && from && to < from) {
      throw httpError(400, "validation_error", "effective_to must be on or after effective_from.");
    }
    if (fields.clinic_location_id) {
      const location = await client.query(
        `SELECT id FROM clinic_locations WHERE id = $1 AND is_active`,
        [fields.clinic_location_id]
      );
      if (location.rowCount === 0) throw httpError(400, "unknown_location", "The selected location does not exist.");
    }

    const columns = Object.keys(fields);
    const values = columns.map((column) => fields[column]);
    values.push(id, ctx.actorId);
    const { rows } = await client.query(
      `UPDATE doctor_availability
          SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(", ")}
        WHERE id = $${values.length - 1} AND doctor_user_id = $${values.length}
        RETURNING id`,
      values
    );
    if (rows.length === 0) throw httpError(404, "not_found", "Availability window not found.");
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "doctor.availability_updated",
      eventCategory: "configuration",
      entityType: "doctor_availability",
      entityId: id,
      before: { is_active: current.rows[0].is_active },
      after: fields,
      metadata: {},
      context: ctx.context,
    });
    return { id, availability: fields };
  });
}

async function createTimeOff(ctx) {
  const v = new Validator();
  const startsAt = v.datetime(ctx.body.starts_at, "starts_at", { required: true });
  const endsAt = v.datetime(ctx.body.ends_at, "ends_at", { required: true });
  const reason = v.text(ctx.body.reason, "reason", { max: 255, label: "Reason" });
  v.done();
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw httpError(400, "validation_error", "The end of the blocked period must be after its start.");
  }

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO doctor_time_off (doctor_user_id, starts_at, ends_at, reason, created_by_user_id)
       VALUES ($1, $2, $3, $4, $1) RETURNING id`,
      [ctx.actorId, startsAt, endsAt, reason]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "doctor.time_off_created",
      eventCategory: "configuration",
      entityType: "doctor_time_off",
      entityId: rows[0].id,
      after: { starts_at: startsAt, ends_at: endsAt },
      metadata: {},
      context: ctx.context,
    });
    return { id: rows[0].id, timeOff: { id: rows[0].id, startsAt, endsAt, reason } };
  });
}

async function cancelTimeOff(ctx) {
  const id = assertUuid(ctx.params.id, "Time-off period");
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT * FROM doctor_time_off WHERE id = $1 AND doctor_user_id = $2 FOR UPDATE`,
      [id, ctx.actorId]
    );
    if (current.rowCount === 0) throw httpError(404, "not_found", "Time-off period not found.");
    await client.query(`DELETE FROM doctor_time_off WHERE id = $1`, [id]);
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "doctor.time_off_cancelled",
      eventCategory: "configuration",
      entityType: "doctor_time_off",
      entityId: id,
      before: { starts_at: iso(current.rows[0].starts_at), ends_at: iso(current.rows[0].ends_at) },
      metadata: {},
      context: ctx.context,
    });
    return { cancelled: true, id };
  });
}

module.exports = {
  getMe,
  updateMe,
  getAvailability,
  createAvailability,
  updateAvailability,
  createTimeOff,
  cancelTimeOff,
};

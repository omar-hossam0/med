/**
 * Follow-up recommendations and Agent 3 slot proposals (Phase 7).
 *
 * A recommendation is NOT a proposed slot, and a proposed slot is NOT a booking.
 * Only `appointments` with status='confirmed' created by staff booking counts.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const accessService = require("./accessService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const { assertUuid, iso, withTransaction } = require("../utils/dbHelpers");
const { serializeFollowUp, serializeAppointmentProposal } = require("../utils/clinicalSerializers");
const { assertSlotFree, ensureCareRelationship, ensureConsultation, markFollowUpScheduled, fetchAppointment } = require("./schedulingService");
const { serializeAppointment } = require("../utils/patientSerializers");

async function loadFollowUp(executor, ctx, id, { forUpdate = false } = {}) {
  const { rows } = await executor.query(
    `SELECT * FROM follow_ups WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [id]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Follow-up not found.");
  const followUp = rows[0];
  await accessService.assertCareAccess(executor, ctx, followUp.patient_user_id);
  return followUp;
}

async function listDoctorFollowUps(ctx) {
  const patientId = assertUuid(ctx.params.id, "Patient");
  await accessService.assertCareAccess(pool, ctx, patientId);
  const { rows } = await pool.query(
    `SELECT * FROM follow_ups
      WHERE patient_user_id = $1 AND ($2::text IS NULL OR status = $2)
      ORDER BY created_at DESC`,
    [patientId, ctx.query.status || null]
  );
  return { followUps: rows.map(serializeFollowUp) };
}

async function changeFollowUpStatus(ctx, { from, to, eventType }) {
  const id = assertUuid(ctx.params.id, "Follow-up");
  const v = new Validator();
  const note = v.text(ctx.body.note, "note", { max: 500, label: "Note" });
  v.done();

  return withTransaction(async (client) => {
    const followUp = await loadFollowUp(client, ctx, id, { forUpdate: true });
    if (followUp.status !== from) {
      throw httpError(409, "invalid_status_transition", `Only a ${from} recommendation can move to ${to}.`);
    }
    const { rows } = await client.query(
      `UPDATE follow_ups SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [to, id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType,
      eventCategory: "approval",
      entityType: "follow_up",
      entityId: id,
      patientUserId: followUp.patient_user_id,
      before: { status: from },
      after: { status: to },
      metadata: { note: note || null },
      context: ctx.context,
    });
    return { followUp: serializeFollowUp(rows[0]) };
  });
}

function acceptFollowUp(ctx) {
  return changeFollowUpStatus(ctx, { from: "recommended", to: "accepted", eventType: "follow_up.accepted" });
}

function declineFollowUp(ctx) {
  return changeFollowUpStatus(ctx, { from: "recommended", to: "declined", eventType: "follow_up.declined" });
}

async function createProposals(ctx) {
  const id = assertUuid(ctx.params.id, "Follow-up");
  const v = new Validator();
  const slots = v.array(ctx.body.slots, "slots", { required: true, max: 20 });
  v.done();

  return withTransaction(async (client) => {
    const followUp = await loadFollowUp(client, ctx, id, { forUpdate: true });
    if (!["recommended", "accepted", "scheduling"].includes(followUp.status)) {
      throw httpError(409, "invalid_status_transition", "Proposals cannot be created for this follow-up status.");
    }

    const proposalIds = [];
    for (const slot of slots) {
      if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
        throw httpError(400, "validation_error", "Each slot must be a JSON object.");
      }
      const sv = new Validator();
      const start = sv.datetime(slot.proposed_start_at, "proposed_start_at", { required: true });
      const end = sv.datetime(slot.proposed_end_at, "proposed_end_at", { required: true });
      const consultationType = sv.oneOf(slot.consultation_type, "consultation_type", ["in_person", "online"]);
      const expiresAt = sv.datetime(slot.expires_at, "expires_at", { required: true });
      const locationId = sv.uuid(slot.clinic_location_id, "clinic_location_id");
      sv.done();

      if (new Date(expiresAt) <= new Date()) {
        throw httpError(400, "validation_error", "A proposal expiration must be in the future.");
      }
      await assertSlotFree(client, {
        doctorId: followUp.doctor_user_id,
        startAt: start,
        endAt: end,
        consultationType,
      });

      const { rows } = await client.query(
        `INSERT INTO appointment_proposals
           (patient_user_id, doctor_user_id, follow_up_id, clinic_location_id,
            consultation_type, proposed_start_at, proposed_end_at, status,
            created_by_user_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'proposed', $8, $9)
         RETURNING id`,
        [
          followUp.patient_user_id, followUp.doctor_user_id, id, locationId,
          consultationType, start, end, ctx.actorId, expiresAt,
        ]
      );
      proposalIds.push(rows[0].id);
    }

    await client.query(
      `UPDATE follow_ups SET status = 'scheduling', updated_at = now() WHERE id = $1`,
      [id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "proposal.created",
      eventCategory: "appointment",
      entityType: "follow_up",
      entityId: id,
      patientUserId: followUp.patient_user_id,
      after: { proposal_count: proposalIds.length, status: "scheduling" },
      metadata: { proposal_ids: proposalIds },
      context: ctx.context,
    });
    return { proposalIds, followUpId: id };
  });
}

async function listPatientFollowUps({ actorId }) {
  const [followUps, proposals] = await Promise.all([
    pool.query(
      `SELECT * FROM follow_ups WHERE patient_user_id = $1 ORDER BY created_at DESC`,
      [actorId]
    ),
    pool.query(
      `SELECT * FROM appointment_proposals
        WHERE patient_user_id = $1 AND status IN ('proposed', 'selected', 'booked')
        ORDER BY proposed_start_at`,
      [actorId]
    ),
  ]);
  return {
    followUps: followUps.rows.map(serializeFollowUp),
    proposals: proposals.rows.map(serializeAppointmentProposal),
  };
}

async function selectProposal(ctx) {
  const id = assertUuid(ctx.params.id, "Proposal");
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT * FROM appointment_proposals WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (current.rowCount === 0 || current.rows[0].patient_user_id !== ctx.actorId) {
      throw httpError(404, "not_found", "Proposal not found.");
    }
    const proposal = current.rows[0];
    if (proposal.status !== "proposed") {
      throw httpError(409, "invalid_status_transition", "Only a proposed slot can be selected.");
    }
    if (proposal.expires_at && new Date(proposal.expires_at) <= new Date()) {
      throw httpError(409, "proposal_expired", "This proposal has expired.");
    }
    const { rows } = await client.query(
      `UPDATE appointment_proposals SET status = 'selected', updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "proposal.selected",
      eventCategory: "appointment",
      entityType: "appointment_proposal",
      entityId: id,
      patientUserId: proposal.patient_user_id,
      before: { status: "proposed" },
      after: { status: "selected" },
      metadata: { follow_up_id: proposal.follow_up_id },
      context: ctx.context,
    });
    return { proposal: serializeAppointmentProposal(rows[0]) };
  });
}

async function bookProposal(ctx) {
  const id = assertUuid(ctx.params.id, "Proposal");
  const v = new Validator();
  const notes = v.text(ctx.body.notes, "notes", { max: 500, label: "Notes" });
  v.done();

  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT * FROM appointment_proposals WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (current.rowCount === 0) throw httpError(404, "not_found", "Proposal not found.");
    const proposal = current.rows[0];
    if (proposal.status !== "selected") {
      throw httpError(409, "invalid_status_transition", "Only a selected proposal can be booked.");
    }
    if (proposal.expires_at && new Date(proposal.expires_at) <= new Date()) {
      throw httpError(409, "proposal_expired", "This proposal has expired.");
    }

    const doctor = await client.query(
      `SELECT specialty_id FROM doctor_profiles WHERE user_id = $1`,
      [proposal.doctor_user_id]
    );
    if (doctor.rowCount === 0) {
      throw httpError(409, "dependency_conflict", "The proposed doctor has no specialty configured.");
    }

    // Booking re-checks the exact slot; the proposal itself is excluded so it
    // does not block its own conversion into an appointment.
    await assertSlotFree(client, {
      doctorId: proposal.doctor_user_id,
      startAt: proposal.proposed_start_at,
      endAt: proposal.proposed_end_at,
      consultationType: proposal.consultation_type,
      excludeProposalId: id,
    });

    const inserted = await client.query(
      `INSERT INTO appointments
         (patient_user_id, doctor_user_id, specialty_id, clinic_location_id,
          consultation_type, status, requested_start_at, requested_end_at,
          scheduled_start_at, scheduled_end_at, confirmed_at, confirmed_by_user_id,
          booked_by_user_id, version)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7, $6, $7, now(), $8, $8, 1)
       RETURNING id`,
      [
        proposal.patient_user_id, proposal.doctor_user_id, doctor.rows[0].specialty_id,
        proposal.clinic_location_id, proposal.consultation_type,
        proposal.proposed_start_at, proposal.proposed_end_at, ctx.actorId,
      ]
    );
    const appointmentId = inserted.rows[0].id;

    const { rows } = await client.query(
      `UPDATE appointment_proposals
          SET status = 'booked', booked_appointment_id = $1, updated_at = now()
        WHERE id = $2 RETURNING *`,
      [appointmentId, id]
    );

    await ensureCareRelationship(client, {
      patientUserId: proposal.patient_user_id,
      doctorUserId: proposal.doctor_user_id,
      appointmentId,
      grantedBy: ctx.actorId,
    });

    const appointmentRow = await fetchAppointment(client, appointmentId);
    await ensureConsultation(client, appointmentRow);
    await markFollowUpScheduled(client, appointmentId);

    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "appointment.created",
      eventCategory: "appointment",
      entityType: "appointment",
      entityId: appointmentId,
      patientUserId: proposal.patient_user_id,
      after: { status: "confirmed", version: 1, source: "appointment_proposal" },
      metadata: { proposal_id: id },
      context: ctx.context,
    });
    await auditService.recordAppointmentTransition(client, {
      actorUserId: ctx.actorId,
      appointmentId,
      patientUserId: proposal.patient_user_id,
      fromStatus: null,
      toStatus: "confirmed",
      changeSource: "staff",
      changeReason: notes || "Staff booked a selected proposal",
      ip: ctx.context?.ip,
      userAgent: ctx.context?.userAgent,
    });
    await client.query(
      `INSERT INTO notifications
         (recipient_user_id, category, channel, title, body,
          related_entity_type, related_entity_id, status)
       VALUES ($1, 'appointment', 'in_app', $2, $3, 'appointment', $4, 'sent')`,
      [proposal.patient_user_id, "Appointment booked", "Your selected follow-up slot has been confirmed.", appointmentId]
    );

    return {
      proposal: serializeAppointmentProposal(rows[0]),
      appointment: serializeAppointment(appointmentRow),
    };
  });
}

module.exports = {
  listDoctorFollowUps,
  acceptFollowUp,
  declineFollowUp,
  createProposals,
  listPatientFollowUps,
  selectProposal,
  bookProposal,
  iso,
};

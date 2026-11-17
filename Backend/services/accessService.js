/**
 * Record-specific authorization.
 *
 * A role is never sufficient to read clinical data. A doctor needs an active
 * care_relationships row OR an assigned appointment/consultation for that
 * patient. Admin and receptionist/staff never receive clinical content. Every
 * denial writes a security event on a separate connection so it survives the
 * rolled-back transaction that caused it.
 */
const pool = require("../config/db");
const { httpError } = require("../utils/httpError");
const { assertUuid } = require("../utils/dbHelpers");
const auditService = require("./auditService");

const LIVE_APPOINTMENT_STATUSES = [
  "requested",
  "pending_confirmation",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
];

/** Pure predicate usable inside a transaction or with the pool. */
async function hasCareAccess(executor, doctorUserId, patientUserId) {
  const { rows } = await executor.query(
    `SELECT (
        EXISTS (
          SELECT 1 FROM care_relationships cr
           WHERE cr.patient_user_id = $1
             AND cr.doctor_user_id  = $2
             AND cr.status = 'active'
             AND (cr.expires_at IS NULL OR cr.expires_at > now())
        )
        OR EXISTS (
          SELECT 1 FROM appointments a
           WHERE a.patient_user_id = $1
             AND a.doctor_user_id  = $2
             AND a.status = ANY($3::varchar[])
        )
        OR EXISTS (
          SELECT 1 FROM consultations c
           WHERE c.patient_user_id = $1
             AND c.doctor_user_id  = $2
             AND c.status <> 'cancelled'
        )
      ) AS granted`,
    [patientUserId, doctorUserId, LIVE_APPOINTMENT_STATUSES]
  );
  return rows[0].granted === true;
}

/**
 * Log a denial and throw. `ctx` is the normalized controller context.
 * Only identifiers and a short reason are logged — never clinical content.
 */
async function denyAndAudit(ctx, { patientUserId = null, entityType = "clinical_record", entityId = null, reason }) {
  try {
    await auditService.recordSecurityDenial({
      userId: ctx.actorId,
      eventType: "security.clinical_access_denied",
      metadata: {
        entity_type: entityType,
        entity_id: entityId,
        patient_user_id: patientUserId,
        reason: String(reason || "access_denied").slice(0, 120),
      },
      context: ctx.context || {},
    });
  } catch (err) {
    // A failed security log must not turn a 403 into a 500, but it is worth
    // surfacing in server logs for the operator.
    console.error("[accessService] could not write denial event:", err.message);
  }
  throw httpError(403, "clinical_access_denied", "You are not authorized to access this clinical record.");
}

async function assertCareAccess(executor, ctx, patientUserId) {
  assertUuid(patientUserId, "Patient");
  const granted = await hasCareAccess(executor, ctx.actorId, patientUserId);
  if (!granted) {
    await denyAndAudit(ctx, { patientUserId, entityType: "patient_record", reason: "no_active_care_relationship" });
  }
  return true;
}

/** Load a consultation and verify the caller is its assigned/authorized doctor. */
async function assertConsultationAccess(executor, ctx, consultationId, { forUpdate = false } = {}) {
  assertUuid(consultationId, "Consultation");
  const { rows } = await executor.query(
    `SELECT c.*, a.reason AS appointment_reason, a.scheduled_start_at,
            s.name AS specialty, u.full_name AS patient_name
       FROM consultations c
       LEFT JOIN appointments a ON a.id = c.appointment_id
       LEFT JOIN specialties s    ON s.id = a.specialty_id
       JOIN users u               ON u.id = c.patient_user_id
      WHERE c.id = $1${forUpdate ? " FOR UPDATE OF c" : ""}`,
    [consultationId]
  );
  if (rows.length === 0) {
    await denyAndAudit(ctx, { entityType: "consultation", entityId: consultationId, reason: "not_found" });
  }
  const consultation = rows[0];
  if (consultation.doctor_user_id !== ctx.actorId) {
    const granted = await hasCareAccess(executor, ctx.actorId, consultation.patient_user_id);
    if (!granted) {
      await denyAndAudit(ctx, {
        patientUserId: consultation.patient_user_id,
        entityType: "consultation",
        entityId: consultationId,
        reason: "not_assigned",
      });
    }
  }
  return consultation;
}

/** Patient ownership, doctor assignment, or staff-wide operational access. */
async function assertAppointmentAccess(executor, ctx, appointmentId, { forUpdate = false, allowStaff = false } = {}) {
  assertUuid(appointmentId, "Appointment");
  const { rows } = await executor.query(
    `SELECT * FROM appointments WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [appointmentId]
  );
  if (rows.length === 0) {
    throw httpError(404, "not_found", "Appointment not found.");
  }
  const appointment = rows[0];
  const roles = ctx.user?.roles || [];
  const isStaff = allowStaff && (roles.includes("receptionist") || roles.includes("staff"));

  const allowed =
    appointment.patient_user_id === ctx.actorId ||
    (roles.includes("doctor") && appointment.doctor_user_id === ctx.actorId) ||
    isStaff;

  if (!allowed) {
    await denyAndAudit(ctx, {
      patientUserId: appointment.patient_user_id,
      entityType: "appointment",
      entityId: appointmentId,
      reason: "not_owner",
    });
  }
  return appointment;
}

/** Load a transcript with its consultation and check doctor access. */
async function assertTranscriptAccess(executor, ctx, transcriptId, { forUpdate = false } = {}) {
  assertUuid(transcriptId, "Transcript");
  const { rows } = await executor.query(
    `SELECT t.*, c.patient_user_id, c.doctor_user_id
       FROM transcripts t
       JOIN consultations c ON c.id = t.consultation_id
      WHERE t.id = $1${forUpdate ? " FOR UPDATE OF t" : ""}`,
    [transcriptId]
  );
  if (rows.length === 0) {
    await denyAndAudit(ctx, { entityType: "transcript", entityId: transcriptId, reason: "not_found" });
  }
  const transcript = rows[0];
  if (transcript.doctor_user_id !== ctx.actorId) {
    const granted = await hasCareAccess(executor, ctx.actorId, transcript.patient_user_id);
    if (!granted) {
      await denyAndAudit(ctx, {
        patientUserId: transcript.patient_user_id,
        entityType: "transcript",
        entityId: transcriptId,
        reason: "not_authorized",
      });
    }
  }
  return transcript;
}

/** Load a report version with its report/consultation and check doctor access. */
async function assertReportVersionAccess(executor, ctx, versionId) {
  assertUuid(versionId, "Report version");
  const { rows } = await executor.query(
    `SELECT rv.*, mr.report_type, mr.publication_state, mr.patient_user_id,
            mr.doctor_user_id, mr.consultation_id, mr.published_version_id
       FROM report_versions rv
       JOIN medical_reports mr ON mr.id = rv.report_id
      WHERE rv.id = $1`,
    [versionId]
  );
  if (rows.length === 0) {
    await denyAndAudit(ctx, { entityType: "report_version", entityId: versionId, reason: "not_found" });
  }
  const row = rows[0];
  if (row.doctor_user_id !== ctx.actorId) {
    const granted = await hasCareAccess(executor, ctx.actorId, row.patient_user_id);
    if (!granted) {
      await denyAndAudit(ctx, {
        patientUserId: row.patient_user_id,
        entityType: "report_version",
        entityId: versionId,
        reason: "not_authorized",
      });
    }
  }
  return row;
}

/** Load a transcript version with its transcript/consultation and check access. */
async function assertTranscriptVersionAccess(executor, ctx, versionId) {
  assertUuid(versionId, "Transcript version");
  const { rows } = await executor.query(
    `SELECT tv.*, t.consultation_id, c.patient_user_id, c.doctor_user_id
       FROM transcript_versions tv
       JOIN transcripts t    ON t.id = tv.transcript_id
       JOIN consultations c  ON c.id = t.consultation_id
      WHERE tv.id = $1`,
    [versionId]
  );
  if (rows.length === 0) {
    await denyAndAudit(ctx, { entityType: "transcript_version", entityId: versionId, reason: "not_found" });
  }
  const row = rows[0];
  if (row.doctor_user_id !== ctx.actorId) {
    const granted = await hasCareAccess(executor, ctx.actorId, row.patient_user_id);
    if (!granted) {
      await denyAndAudit(ctx, {
        patientUserId: row.patient_user_id,
        entityType: "transcript_version",
        entityId: versionId,
        reason: "not_authorized",
      });
    }
  }
  return row;
}

/** A proposal belongs to a patient; a doctor needs active care access. */
async function assertProposalAccess(executor, ctx, proposalId, { forUpdate = false } = {}) {
  assertUuid(proposalId, "Proposal");
  const { rows } = await executor.query(
    `SELECT * FROM record_update_proposals WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [proposalId]
  );
  if (rows.length === 0) {
    await denyAndAudit(ctx, { entityType: "record_update_proposal", entityId: proposalId, reason: "not_found" });
  }
  const proposal = rows[0];
  await assertCareAccess(executor, ctx, proposal.patient_user_id);
  return proposal;
}

async function assertReportAccess(executor, ctx, reportId, { forUpdate = false } = {}) {
  assertUuid(reportId, "Report");
  const { rows } = await executor.query(
    `SELECT * FROM medical_reports WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [reportId]
  );
  if (rows.length === 0) {
    await denyAndAudit(ctx, { entityType: "report", entityId: reportId, reason: "not_found" });
  }
  const report = rows[0];
  if (report.doctor_user_id !== ctx.actorId) {
    const granted = await hasCareAccess(executor, ctx.actorId, report.patient_user_id);
    if (!granted) {
      await denyAndAudit(ctx, {
        patientUserId: report.patient_user_id,
        entityType: "report",
        entityId: reportId,
        reason: "not_authorized",
      });
    }
  }
  return report;
}

/** Patient-owned resource: the caller id must equal the row's patient id. */
async function assertPatientOwnership(ctx, patientUserId) {
  if (patientUserId !== ctx.actorId) {
    await denyAndAudit(ctx, { patientUserId, entityType: "patient_record", reason: "not_owner" });
  }
  return true;
}

module.exports = {
  LIVE_APPOINTMENT_STATUSES,
  hasCareAccess,
  denyAndAudit,
  assertCareAccess,
  assertConsultationAccess,
  assertAppointmentAccess,
  assertTranscriptAccess,
  assertTranscriptVersionAccess,
  assertReportVersionAccess,
  assertReportAccess,
  assertProposalAccess,
  assertPatientOwnership,
  pool,
};

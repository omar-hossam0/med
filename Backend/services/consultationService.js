/**
 * Consultations, consent and recording metadata (Phase 4).
 *
 * Recording is gated by a *granted* audio_recording consent. Only metadata is
 * stored — this service never accepts or persists audio bytes.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const accessService = require("./accessService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const { assertUuid, iso, dateOnly, withTransaction } = require("../utils/dbHelpers");

const CONSENT_TYPES = ["audio_recording", "transcription", "ai_assisted_documentation"];
const CONSENT_STATUSES = ["granted", "declined", "revoked"];
const CONSENT_METHODS = ["in_person_verbal", "patient_portal", "written"];
const RECORDING_STATUS_ORDER = ["pending_upload", "uploaded", "processing", "available"];

function consultationSummary(row) {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientUserId: row.patient_user_id,
    doctorUserId: row.doctor_user_id,
    status: row.status,
    startedAt: iso(row.started_at),
    endedAt: iso(row.ended_at),
    createdAt: iso(row.created_at),
    patientName: row.patient_name || null,
    specialty: row.specialty || null,
    appointmentReason: row.appointment_reason || null,
    scheduledStartAt: iso(row.scheduled_start_at),
  };
}

async function listConsultations({ actorId, query }) {
  const { rows } = await pool.query(
    `SELECT c.*, a.reason AS appointment_reason, a.scheduled_start_at,
            s.name AS specialty, u.full_name AS patient_name
       FROM consultations c
       LEFT JOIN appointments a ON a.id = c.appointment_id
       LEFT JOIN specialties s   ON s.id = a.specialty_id
       JOIN users u              ON u.id = c.patient_user_id
      WHERE c.doctor_user_id = $1
        AND ($2::text IS NULL OR c.status = $2)
      ORDER BY c.created_at DESC`,
    [actorId, query.status || null]
  );
  return { consultations: rows.map(consultationSummary) };
}

async function getConsultation(ctx) {
  const executor = pool;
  const consultation = await accessService.assertConsultationAccess(executor, ctx, ctx.params.id);

  const [profile, allergies, consents, recordings, access] = await Promise.all([
    executor.query(
      `SELECT date_of_birth, phone, gender FROM patient_profiles WHERE user_id = $1`,
      [consultation.patient_user_id]
    ),
    executor.query(
      `SELECT id, allergen, severity, status FROM patient_allergies
        WHERE patient_user_id = $1 AND status = 'active' AND superseded_by_id IS NULL
        ORDER BY recorded_at DESC`,
      [consultation.patient_user_id]
    ),
    executor.query(
      `SELECT id, consent_type, status, method, granted_at, revoked_at
         FROM consultation_consents WHERE consultation_id = $1 ORDER BY created_at`,
      [consultation.id]
    ),
    executor.query(
      `SELECT id, status, storage_provider, mime_type, size_bytes, duration_seconds,
              created_at, retention_expires_at
         FROM consultation_recordings WHERE consultation_id = $1 ORDER BY created_at`,
      [consultation.id]
    ),
    executor.query(
      `SELECT id, source, status, granted_at, expires_at
         FROM care_relationships
        WHERE patient_user_id = $1 AND doctor_user_id = $2
          AND status = 'active' AND (expires_at IS NULL OR expires_at > now())`,
      [consultation.patient_user_id, ctx.actorId]
    ),
  ]);

  // Individual clinical reads are audited; aggregate lists are not.
  await auditService.recordClinicalAccess(pool, {
    actorUserId: ctx.actorId,
    patientUserId: consultation.patient_user_id,
    entityType: "consultation",
    entityId: consultation.id,
    metadata: { assigned_doctor: consultation.doctor_user_id === ctx.actorId },
    context: ctx.context,
  });

  return {
    consultation: {
      ...consultationSummary(consultation),
      patientProfile: profile.rows[0]
        ? {
            dateOfBirth: dateOnly(profile.rows[0].date_of_birth),
            phone: profile.rows[0].phone || null,
            gender: profile.rows[0].gender || null,
          }
        : { dateOfBirth: null, phone: null, gender: null },
      activeAllergies: allergies.rows,
      consents: consents.rows.map((row) => ({ ...row, granted_at: iso(row.granted_at), revoked_at: iso(row.revoked_at) })),
      recordings: recordings.rows.map((row) => ({ ...row, created_at: iso(row.created_at), retention_expires_at: iso(row.retention_expires_at) })),
      accessProof: access.rows[0]
        ? { source: access.rows[0].source, status: access.rows[0].status, grantedAt: iso(access.rows[0].granted_at), expiresAt: iso(access.rows[0].expires_at) }
        : { source: "assigned_consultation", status: "active", grantedAt: null, expiresAt: null },
    },
  };
}

async function startConsultation(ctx) {
  const id = assertUuid(ctx.params.id, "Consultation");
  return withTransaction(async (client) => {
    const current = await client.query(`SELECT * FROM consultations WHERE id = $1 FOR UPDATE`, [id]);
    if (current.rows.length === 0) throw httpError(404, "not_found", "Consultation not found.");
    const consultation = current.rows[0];
    if (consultation.doctor_user_id !== ctx.actorId) {
      await accessService.assertCareAccess(client, ctx, consultation.patient_user_id);
    }
    if (consultation.status !== "scheduled") {
      throw httpError(409, "invalid_status_transition", "Only a scheduled consultation can be started.");
    }
    await client.query(
      `UPDATE consultations SET status = 'in_progress', started_at = now() WHERE id = $1`,
      [id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "consultation.started",
      eventCategory: "clinical_access",
      entityType: "consultation",
      entityId: id,
      patientUserId: consultation.patient_user_id,
      before: { status: consultation.status },
      after: { status: "in_progress" },
      metadata: {},
      context: ctx.context,
    });
    const { rows } = await client.query(`SELECT * FROM consultations WHERE id = $1`, [id]);
    return { consultation: consultationSummary(rows[0]) };
  });
}

async function completeConsultation(ctx) {
  const id = assertUuid(ctx.params.id, "Consultation");
  return withTransaction(async (client) => {
    const current = await client.query(`SELECT * FROM consultations WHERE id = $1 FOR UPDATE`, [id]);
    if (current.rows.length === 0) throw httpError(404, "not_found", "Consultation not found.");
    const consultation = current.rows[0];
    if (consultation.doctor_user_id !== ctx.actorId) {
      await accessService.assertCareAccess(client, ctx, consultation.patient_user_id);
    }
    if (consultation.status !== "in_progress") {
      throw httpError(409, "invalid_status_transition", "Only an in-progress consultation can be completed.");
    }
    await client.query(
      `UPDATE consultations SET status = 'completed', ended_at = now() WHERE id = $1`,
      [id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "consultation.completed",
      eventCategory: "clinical_access",
      entityType: "consultation",
      entityId: id,
      patientUserId: consultation.patient_user_id,
      before: { status: consultation.status },
      after: { status: "completed" },
      metadata: {},
      context: ctx.context,
    });
    const { rows } = await client.query(`SELECT * FROM consultations WHERE id = $1`, [id]);
    return { consultation: consultationSummary(rows[0]) };
  });
}

async function createConsent(ctx) {
  const consultationId = assertUuid(ctx.params.id, "Consultation");
  const { body } = ctx;
  const v = new Validator();
  const consentType = v.oneOf(body.consent_type, "consent_type", CONSENT_TYPES, { label: "Consent type" });
  const status = v.oneOf(body.status, "status", CONSENT_STATUSES, { label: "Consent status" });
  const method = v.oneOf(body.method, "method", CONSENT_METHODS, { label: "Consent method" });
  const grantedAt = v.datetime(body.granted_at, "granted_at");
  const revokedAt = v.datetime(body.revoked_at, "revoked_at");
  const revocationReason = v.text(body.revocation_reason, "revocation_reason", { max: 500, label: "Revocation reason" });
  const notes = v.text(body.notes, "notes", { max: 1000, label: "Notes" });
  v.done();

  if (status === "declined" && grantedAt) {
    throw httpError(400, "validation_error", "A declined consent cannot have a granted_at timestamp.");
  }
  if (status === "revoked" && !revokedAt) {
    throw httpError(400, "validation_error", "A revoked consent requires revoked_at.");
  }
  if (status !== "declined" && status !== "revoked" && !grantedAt) {
    // Default to now() so the CHECK `(status = 'declined' OR granted_at IS NOT NULL)` holds.
  }

  return withTransaction(async (client) => {
    const consultation = await accessService.assertConsultationAccess(client, ctx, consultationId);
    const existing = await client.query(
      `SELECT id FROM consultation_consents WHERE consultation_id = $1 AND consent_type = $2`,
      [consultationId, consentType]
    );
    if (existing.rowCount > 0) {
      throw httpError(409, "consent_exists", "Consent for this scope already exists. Use the revoke endpoint to change it.");
    }

    const effectiveGrantedAt = status === "declined" ? null : grantedAt || new Date().toISOString();
    const effectiveRevokedAt = status === "revoked" ? revokedAt || new Date().toISOString() : null;
    const { rows } = await client.query(
      `INSERT INTO consultation_consents
         (consultation_id, patient_user_id, consent_type, status, method,
          recorded_by_user_id, granted_at, revoked_at, revocation_reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        consultationId, consultation.patient_user_id, consentType, status, method,
        ctx.actorId, effectiveGrantedAt, effectiveRevokedAt,
        status === "revoked" ? revocationReason : null, notes,
      ]
    );

    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: `consent.${status}`,
      eventCategory: "approval",
      entityType: "consultation_consent",
      entityId: rows[0].id,
      patientUserId: consultation.patient_user_id,
      after: { consent_type: consentType, status, method },
      metadata: { consultation_id: consultationId },
      context: ctx.context,
    });

    return { consent: { ...rows[0], granted_at: iso(rows[0].granted_at), revoked_at: iso(rows[0].revoked_at) } };
  });
}

async function revokeConsent(ctx) {
  const consultationId = assertUuid(ctx.params.id, "Consultation");
  const consentId = assertUuid(ctx.params.consentId, "Consent");
  const v = new Validator();
  const reason = v.text(ctx.body.revocation_reason, "revocation_reason", { max: 500, label: "Revocation reason" });
  v.done();

  return withTransaction(async (client) => {
    const consultation = await accessService.assertConsultationAccess(client, ctx, consultationId);
    const current = await client.query(
      `SELECT * FROM consultation_consents WHERE id = $1 AND consultation_id = $2 FOR UPDATE`,
      [consentId, consultationId]
    );
    if (current.rowCount === 0) throw httpError(404, "not_found", "Consent not found.");
    if (current.rows[0].status !== "granted") {
      throw httpError(409, "invalid_status_transition", "Only a granted consent can be revoked.");
    }

    const { rows } = await client.query(
      `UPDATE consultation_consents
          SET status = 'revoked', revoked_at = now(), revocation_reason = $1
        WHERE id = $2 RETURNING *`,
      [reason, consentId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "consent.revoked",
      eventCategory: "approval",
      entityType: "consultation_consent",
      entityId: consentId,
      patientUserId: consultation.patient_user_id,
      before: { status: "granted" },
      after: { status: "revoked" },
      metadata: { consultation_id: consultationId },
      context: ctx.context,
    });
    return { consent: { ...rows[0], revoked_at: iso(rows[0].revoked_at) } };
  });
}

async function registerRecording(ctx) {
  const consultationId = assertUuid(ctx.params.id, "Consultation");
  const { body } = ctx;

  // Audio bytes are never accepted: reject the common shapes explicitly, then
  // use a strict allowlist for every stored column.
  for (const forbidden of ["audio", "audio_bytes", "bytes", "base64", "content"]) {
    if (Object.prototype.hasOwnProperty.call(body, forbidden)) {
      throw httpError(400, "validation_error", "Audio bytes cannot be submitted to this endpoint; register metadata only.");
    }
  }

  const v = new Validator();
  const storageProvider = v.text(body.storage_provider, "storage_provider", { required: true, max: 50 });
  const storageKey = v.text(body.storage_key, "storage_key", { required: true, max: 2000 });
  const mimeType = v.text(body.mime_type, "mime_type", { required: true, max: 100 });
  const sizeBytes = v.integer(body.size_bytes, "size_bytes", { min: 0, max: 10_000_000_000, label: "Size" });
  const durationSeconds = v.integer(body.duration_seconds, "duration_seconds", { min: 1, max: 1000000, label: "Duration" });
  const checksum = v.hexHash(body.checksum_sha256, "checksum_sha256");
  const retentionExpiresAt = v.datetime(body.retention_expires_at, "retention_expires_at");
  const startedAt = v.datetime(body.recorded_started_at, "recorded_started_at");
  const endedAt = v.datetime(body.recorded_ended_at, "recorded_ended_at");
  v.done();

  return withTransaction(async (client) => {
    const consultation = await accessService.assertConsultationAccess(client, ctx, consultationId);
    const consent = await client.query(
      `SELECT id FROM consultation_consents
        WHERE consultation_id = $1 AND consent_type = 'audio_recording' AND status = 'granted'`,
      [consultationId]
    );
    if (consent.rowCount === 0) {
      throw httpError(403, "consent_required", "A granted audio recording consent is required before registering a recording.");
    }

    const { rows } = await client.query(
      `INSERT INTO consultation_recordings
         (consultation_id, consent_id, storage_provider, storage_key, mime_type,
          size_bytes, duration_seconds, checksum_sha256, retention_expires_at,
          recorded_started_at, recorded_ended_at, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending_upload', $12)
       RETURNING *`,
      [
        consultationId, consent.rows[0].id, storageProvider, storageKey, mimeType,
        sizeBytes, durationSeconds, checksum, retentionExpiresAt, startedAt, endedAt, ctx.actorId,
      ]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "recording.registered",
      eventCategory: "configuration",
      entityType: "consultation_recording",
      entityId: rows[0].id,
      patientUserId: consultation.patient_user_id,
      after: { status: "pending_upload", mime_type: mimeType },
      metadata: { consultation_id: consultationId, consent_id: consent.rows[0].id },
      context: ctx.context,
    });
    return { recording: { ...rows[0], created_at: iso(rows[0].created_at) } };
  });
}

async function updateRecording(ctx) {
  const consultationId = assertUuid(ctx.params.id, "Consultation");
  const recordingId = assertUuid(ctx.params.recordingId, "Recording");
  const v = new Validator();
  const status = v.oneOf(ctx.body.status, "status", RECORDING_STATUS_ORDER, { label: "Recording status" });
  v.done();

  return withTransaction(async (client) => {
    const consultation = await accessService.assertConsultationAccess(client, ctx, consultationId);
    const current = await client.query(
      `SELECT * FROM consultation_recordings WHERE id = $1 AND consultation_id = $2 FOR UPDATE`,
      [recordingId, consultationId]
    );
    if (current.rowCount === 0) throw httpError(404, "not_found", "Recording not found.");
    const from = current.rows[0].status;
    const fromIndex = RECORDING_STATUS_ORDER.indexOf(from);
    const toIndex = RECORDING_STATUS_ORDER.indexOf(status);
    if (fromIndex < 0 || toIndex <= fromIndex) {
      throw httpError(409, "invalid_status_transition", "Recording status may only move forward.");
    }

    const { rows } = await client.query(
      `UPDATE consultation_recordings SET status = $1 WHERE id = $2 RETURNING *`,
      [status, recordingId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "recording.status_changed",
      eventCategory: "configuration",
      entityType: "consultation_recording",
      entityId: recordingId,
      patientUserId: consultation.patient_user_id,
      before: { status: from },
      after: { status },
      metadata: { consultation_id: consultationId },
      context: ctx.context,
    });
    return { recording: { ...rows[0], created_at: iso(rows[0].created_at) } };
  });
}

module.exports = {
  CONSENT_TYPES,
  CONSENT_STATUSES,
  CONSENT_METHODS,
  listConsultations,
  getConsultation,
  startConsultation,
  completeConsultation,
  createConsent,
  revokeConsent,
  registerRecording,
  updateRecording,
};

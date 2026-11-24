/**
 * Internal AI agent execution workflows (Phase 5/6/7/11).
 *
 * These are service workflows, not human roles. They are reachable only through
 * /api/internal/agents/* behind x-service-token, are idempotent by
 * (agent_code, idempotency_key, attempt_number), and rely on the database
 * triggers as the final approval gate. No LLM provider is configured in this
 * repository: model output is accepted from the caller (a worker) or recorded
 * as honest draft scaffolding, never invented as clinical fact.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const { assertUuid, sha256, withTransaction, isPlainObject } = require("../utils/dbHelpers");
const { createReportScaffolding } = require("./clinicalReviewService");
const { assertSlotFree } = require("./schedulingService");

const PROPOSAL_TARGETS = [
  "medical_condition", "patient_medication", "patient_allergy",
  "medical_history_entry", "test_order", "test_result",
];
const PROPOSAL_TYPES = ["create", "update", "resolve", "discontinue", "correct"];

function validateEnvelope(body) {
  const v = new Validator();
  const idempotencyKey = v.text(body.idempotency_key, "idempotency_key", {
    required: true, min: 8, max: 150, label: "Idempotency key",
  });
  const attemptNumber = v.integer(body.attempt_number || 1, "attempt_number", {
    min: 1, max: 1000, label: "Attempt number",
  });
  const retryOfExecutionId = v.uuid(body.retry_of_execution_id, "retry_of_execution_id");
  const modelProvider = v.text(body.model_provider, "model_provider", { max: 80 });
  const modelName = v.text(body.model_name, "model_name", { max: 120 });
  const modelVersion = v.text(body.model_version, "model_version", { max: 80 });
  const promptVersion = v.text(body.prompt_version, "prompt_version", { max: 50 });
  v.done();
  return {
    idempotencyKey,
    attemptNumber: attemptNumber || 1,
    retryOfExecutionId,
    modelProvider,
    modelName,
    modelVersion,
    promptVersion,
  };
}

async function insertExecution(client, envelope, fields) {
  const inputHash = sha256(JSON.stringify(fields.input));
  try {
    const { rows } = await client.query(
      `INSERT INTO agent_executions
         (agent_code, status, patient_user_id, consultation_id,
          source_transcript_version_id, source_report_version_id,
          reference_document_version_id, engine, engine_version,
          requested_by_user_id, idempotency_key, attempt_number,
          retry_of_execution_id, model_provider, model_name, model_version,
          prompt_version, input_hash, output_hash, started_at, completed_at,
          metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb)
       RETURNING *`,
      [
        fields.agentCode,
        fields.status || "queued",
        fields.patientUserId ?? null,
        fields.consultationId ?? null,
        fields.sourceTranscriptVersionId ?? null,
        fields.sourceReportVersionId ?? null,
        fields.referenceDocumentVersionId ?? null,
        fields.engine ?? null,
        fields.engineVersion ?? null,
        fields.requestedByUserId ?? null,
        envelope.idempotencyKey,
        envelope.attemptNumber,
        envelope.retryOfExecutionId ?? null,
        envelope.modelProvider ?? null,
        envelope.modelName ?? null,
        envelope.modelVersion ?? null,
        envelope.promptVersion ?? null,
        inputHash,
        fields.outputHash ?? null,
        fields.startedAt ?? null,
        fields.completedAt ?? null,
        JSON.stringify(fields.metadata || {}),
      ]
    );
    await auditService.record(client, {
      actorType: "service",
      eventType: "agent.execution_registered",
      eventCategory: "system",
      entityType: "agent_execution",
      entityId: rows[0].id,
      metadata: { agent_code: fields.agentCode, status: fields.status || "queued", attempt: envelope.attemptNumber },
    });
    return rows[0];
  } catch (err) {
    if (err.code === "23505" && String(err.constraint || "").includes("idempotency")) {
      throw httpError(409, "agent_execution_conflict", "This agent execution was already registered (idempotency key replay).");
    }
    if (err.code === "23514" && /has not been reviewed|was rejected/i.test(String(err.message))) {
      throw httpError(409, /transcript/i.test(String(err.message)) ? "transcript_not_approved" : "report_not_approved",
        "The agent input version has not been approved by a doctor.");
    }
    throw err;
  }
}

async function loadConsultation(client, consultationId) {
  const { rows } = await client.query(`SELECT * FROM consultations WHERE id = $1`, [consultationId]);
  if (rows.length === 0) throw httpError(404, "not_found", "Consultation not found.");
  return rows[0];
}

async function assertApprovedTranscriptVersion(client, versionId, consultationId) {
  const { rows } = await client.query(
    `SELECT tv.id, tv.review_decision, t.consultation_id
       FROM transcript_versions tv
       JOIN transcripts t ON t.id = tv.transcript_id
      WHERE tv.id = $1`,
    [versionId]
  );
  if (rows.length === 0 || rows[0].consultation_id !== consultationId) {
    throw httpError(404, "not_found", "Transcript version not found.");
  }
  if (rows[0].review_decision !== "approved") {
    throw httpError(409, "transcript_not_approved", "Agent 1 requires a doctor-approved transcript version.");
  }
  return rows[0];
}

async function assertApprovedReportVersion(client, versionId, { requireReport2 = false } = {}) {
  const { rows } = await client.query(
    `SELECT rv.id, rv.review_decision, mr.report_type, mr.consultation_id,
            mr.patient_user_id, mr.doctor_user_id
       FROM report_versions rv
       JOIN medical_reports mr ON mr.id = rv.report_id
      WHERE rv.id = $1`,
    [versionId]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Report version not found.");
  if (rows[0].review_decision !== "approved") {
    throw httpError(409, "report_not_approved", "This agent requires a doctor-approved report version.");
  }
  if (requireReport2 && rows[0].report_type !== "report_2_structured_profile") {
    throw httpError(409, "dependency_conflict", "Agent 2 requires an approved Report 2 (structured profile) version.");
  }
  return rows[0];
}

/* --------------------------- speech-to-text ------------------------------- */

async function transcription({ body }) {
  const envelope = validateEnvelope(body);
  const v = new Validator();
  const consultationId = v.uuid(body.consultation_id, "consultation_id", { required: true });
  const recordingId = v.uuid(body.recording_id, "recording_id", { required: true });
  const storageKey = v.text(body.storage_key, "storage_key", { required: true, max: 2000 });
  const content = v.text(body.content, "content", { max: 200000, label: "Transcript content" });
  const language = v.text(body.language, "language", { max: 16 });
  const engine = v.text(body.engine, "engine", { max: 80 });
  v.done();

  return withTransaction(async (client) => {
    const consultation = await loadConsultation(client, consultationId);
    const recording = await client.query(
      `SELECT id FROM consultation_recordings WHERE id = $1 AND consultation_id = $2`,
      [recordingId, consultationId]
    );
    if (recording.rowCount === 0) throw httpError(404, "not_found", "Recording not found for this consultation.");
    const execution = await insertExecution(client, envelope, {
      agentCode: "speech_to_text",
      status: content ? "succeeded" : "queued",
      patientUserId: consultation.patient_user_id,
      consultationId,
      engine,
      input: { consultation_id: consultationId, recording_id: recordingId, storage_key: storageKey },
      outputHash: content ? sha256(content) : null,
      startedAt: content ? new Date() : null,
      completedAt: content ? new Date() : null,
      metadata: { recording_id: recordingId },
    });

    let transcript = null;
    if (content) {
      const created = await client.query(
        `INSERT INTO transcripts (consultation_id, recording_id, source, language, created_by_user_id)
         VALUES ($1, $2, 'speech_to_text', $3, NULL) RETURNING id`,
        [consultationId, recordingId, language || "en"]
      );
      await client.query(
        `INSERT INTO transcript_versions
           (transcript_id, version_number, content, content_format,
            generated_by_execution_id, content_hash)
         VALUES ($1, 1, $2, 'plain_text', $3, $4)`,
        [created.rows[0].id, content, execution.id, sha256(content)]
      );
      transcript = created.rows[0].id;
    }

    return {
      execution: { id: execution.id, status: execution.status, agentCode: execution.agent_code },
      transcriptId: transcript,
    };
  });
}

/* ------------------------------ Agent 1 ----------------------------------- */

async function reports({ body }) {
  const envelope = validateEnvelope(body);
  const v = new Validator();
  const consultationId = v.uuid(body.consultation_id, "consultation_id", { required: true });
  const transcriptVersionId = v.uuid(body.source_transcript_version_id, "source_transcript_version_id", { required: true });
  const contentByType = v.jsonObject(body.reports, "reports");
  v.done();

  return withTransaction(async (client) => {
    const consultation = await loadConsultation(client, consultationId);
    await assertApprovedTranscriptVersion(client, transcriptVersionId, consultationId);
    const output = JSON.stringify(contentByType || {});

    const execution = await insertExecution(client, envelope, {
      agentCode: "agent_1_report_generation",
      status: "succeeded",
      patientUserId: consultation.patient_user_id,
      consultationId,
      sourceTranscriptVersionId: transcriptVersionId,
      input: { consultation_id: consultationId, source_transcript_version_id: transcriptVersionId },
      outputHash: sha256(output),
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { report_count: 3 },
    });

    const created = await createReportScaffolding(client, {
      consultation,
      transcriptVersionId,
      executionId: execution.id,
      contentByType: contentByType || {},
    });

    return {
      execution: { id: execution.id, status: execution.status, agentCode: execution.agent_code },
      reports: created,
    };
  });
}

/* ------------------------------ Agent 2 ----------------------------------- */

async function profileOrganization({ body }) {
  const envelope = validateEnvelope(body);
  const v = new Validator();
  const sourceReportVersionId = v.uuid(body.source_report_version_id, "source_report_version_id", { required: true });
  const proposals = v.array(body.proposals, "proposals", { max: 50 });
  v.done();

  return withTransaction(async (client) => {
    const reportVersion = await assertApprovedReportVersion(client, sourceReportVersionId, { requireReport2: true });
    const execution = await insertExecution(client, envelope, {
      agentCode: "agent_2_profile_organization",
      status: "succeeded",
      patientUserId: reportVersion.patient_user_id,
      consultationId: reportVersion.consultation_id,
      sourceReportVersionId,
      input: { source_report_version_id: sourceReportVersionId, proposal_count: proposals?.length || 0 },
      outputHash: sha256(JSON.stringify(proposals || [])),
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { proposal_count: proposals?.length || 0 },
    });

    const created = [];
    for (const item of proposals || []) {
      if (!isPlainObject(item)) {
        throw httpError(400, "validation_error", "Each proposal must be a JSON object.");
      }
      const pv = new Validator();
      const targetEntityType = pv.oneOf(item.target_entity_type, "target_entity_type", PROPOSAL_TARGETS);
      const targetEntityId = pv.uuid(item.target_entity_id, "target_entity_id");
      const proposalType = pv.oneOf(item.proposal_type, "proposal_type", PROPOSAL_TYPES);
      const proposedChanges = pv.jsonObject(item.proposed_changes, "proposed_changes", { required: true });
      const rationale = pv.text(item.rationale, "rationale", { max: 2000 });
      const conflictDetected = pv.boolean(item.conflict_detected, "conflict_detected") || false;
      const conflictDetails = pv.jsonObject(item.conflict_details, "conflict_details");
      pv.done();

      if (conflictDetected && !conflictDetails) {
        throw httpError(400, "validation_error", "conflict_details is required when conflict_detected is true.");
      }
      if (proposalType !== "create" && !targetEntityId) {
        throw httpError(400, "validation_error", "target_entity_id is required for non-create proposals.");
      }

      const { rows } = await client.query(
        `INSERT INTO record_update_proposals
           (patient_user_id, agent_execution_id, source_report_version_id,
            target_entity_type, target_entity_id, proposal_type, proposed_changes,
            rationale, conflict_detected, conflict_details, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, 'proposed')
         RETURNING id`,
        [
          reportVersion.patient_user_id, execution.id, sourceReportVersionId,
          targetEntityType, targetEntityId, proposalType, JSON.stringify(proposedChanges),
          rationale, conflictDetected, conflictDetails ? JSON.stringify(conflictDetails) : null,
        ]
      );
      created.push(rows[0].id);
    }

    return {
      execution: { id: execution.id, status: execution.status, agentCode: execution.agent_code },
      proposalIds: created,
    };
  });
}

/* ------------------------------ Agent 3 ----------------------------------- */

async function followUpScheduling({ body }) {
  const envelope = validateEnvelope(body);
  const v = new Validator();
  const consultationId = v.uuid(body.consultation_id, "consultation_id", { required: true });
  const sourceReportVersionId = v.uuid(body.source_report_version_id, "source_report_version_id", { required: true });
  const recommendation = v.text(body.recommendation, "recommendation", {
    required: true, min: 3, max: 2000, label: "Recommendation",
  });
  const intervalDays = v.integer(body.recommended_interval_days, "recommended_interval_days", {
    min: 1, max: 3650, label: "Recommended interval",
  });
  const dueOn = v.isoDate(body.due_on, "due_on");
  const slots = v.array(body.proposed_slots, "proposed_slots", { max: 20 });
  v.done();

  return withTransaction(async (client) => {
    const consultation = await loadConsultation(client, consultationId);
    const reportVersion = await assertApprovedReportVersion(client, sourceReportVersionId);
    if (reportVersion.consultation_id !== consultationId) {
      throw httpError(409, "dependency_conflict", "The report version belongs to another consultation.");
    }

    const execution = await insertExecution(client, envelope, {
      agentCode: "agent_3_follow_up_scheduling",
      status: "succeeded",
      patientUserId: consultation.patient_user_id,
      consultationId,
      sourceReportVersionId,
      input: { consultation_id: consultationId, source_report_version_id: sourceReportVersionId },
      outputHash: sha256(JSON.stringify({ recommendation, slots: slots || [] })),
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { slot_count: slots?.length || 0 },
    });

    const followUp = await client.query(
      `INSERT INTO follow_ups
         (patient_user_id, doctor_user_id, consultation_id, source_report_version_id,
          recommendation, recommended_interval_days, due_on, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'recommended')
       RETURNING id`,
      [
        consultation.patient_user_id, consultation.doctor_user_id, consultationId,
        sourceReportVersionId, recommendation, intervalDays, dueOn,
      ]
    );
    const followUpId = followUp.rows[0].id;

    const proposalIds = [];
    for (const slot of slots || []) {
      if (!isPlainObject(slot)) throw httpError(400, "validation_error", "Each proposed slot must be an object.");
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
        doctorId: consultation.doctor_user_id,
        startAt: start,
        endAt: end,
        consultationType,
      });

      const { rows } = await client.query(
        `INSERT INTO appointment_proposals
           (patient_user_id, doctor_user_id, follow_up_id, clinic_location_id,
            consultation_type, proposed_start_at, proposed_end_at, status,
            created_by_agent_execution_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'proposed', $8, $9)
         RETURNING id`,
        [
          consultation.patient_user_id, consultation.doctor_user_id, followUpId,
          locationId, consultationType, start, end, execution.id, expiresAt,
        ]
      );
      proposalIds.push(rows[0].id);
    }

    await auditService.record(client, {
      actorType: "service",
      eventType: "follow_up.recommended",
      eventCategory: "system",
      entityType: "follow_up",
      entityId: followUpId,
      patientUserId: consultation.patient_user_id,
      metadata: { proposal_count: proposalIds.length },
    });

    return {
      execution: { id: execution.id, status: execution.status, agentCode: execution.agent_code },
      followUpId,
      proposalIds,
    };
  });
}

/* ---------------------------- OCR extraction ------------------------------ */

async function extraction({ body }) {
  const envelope = validateEnvelope(body);
  const v = new Validator();
  const documentVersionId = v.uuid(body.reference_document_version_id, "reference_document_version_id", { required: true });
  const agentCode = v.oneOf(body.agent_code || "ocr_extraction", "agent_code", ["ocr_extraction", "digital_text_extraction"]);
  const engine = v.text(body.engine, "engine", { required: true, max: 80 });
  const engineVersion = v.text(body.engine_version, "engine_version", { max: 50 });
  v.done();

  return withTransaction(async (client) => {
    const version = await client.query(
      `SELECT id, status, extraction_method FROM reference_document_versions WHERE id = $1 FOR UPDATE`,
      [documentVersionId]
    );
    if (version.rowCount === 0) throw httpError(404, "not_found", "Reference document version not found.");
    const allowed = ["uploaded", "extraction_failed"];
    if (!allowed.includes(version.rows[0].status)) {
      throw httpError(409, "invalid_status_transition", "Extraction can only start from uploaded or extraction_failed.");
    }

    const execution = await insertExecution(client, envelope, {
      agentCode,
      status: "running",
      referenceDocumentVersionId: documentVersionId,
      engine,
      engineVersion,
      input: { reference_document_version_id: documentVersionId, engine },
      startedAt: new Date(),
      metadata: { extraction_method: version.rows[0].extraction_method },
    });

    await client.query(
      `UPDATE reference_document_versions
          SET status = 'extracting', extraction_execution_id = $1
        WHERE id = $2`,
      [execution.id, documentVersionId]
    );

    return {
      execution: { id: execution.id, status: execution.status, agentCode },
      documentVersionId,
    };
  });
}

module.exports = {
  PROPOSAL_TARGETS,
  PROPOSAL_TYPES,
  validateEnvelope,
  insertExecution,
  transcription,
  reports,
  profileOrganization,
  followUpScheduling,
  extraction,
  assertApprovedReportVersion,
};

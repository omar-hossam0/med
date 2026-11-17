/**
 * Transcripts and reports (Phase 5).
 *
 * Version rows are immutable once reviewed; status columns on transcripts and
 * medical_reports are maintained by database triggers and are NEVER written
 * directly here. Only a doctor-approved transcript version may feed a report,
 * and only a doctor-approved Report 1 may be published to a patient.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const accessService = require("./accessService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const { assertUuid, sha256, iso, withTransaction, isPlainObject } = require("../utils/dbHelpers");
const { serializeReport } = require("../utils/clinicalSerializers");

const REPORT_TYPES = [
  "report_1_patient_summary",
  "report_2_structured_profile",
  "report_3_medical_report",
];

/** Minimal, honest draft structure. No clinical statements are invented. */
function draftContent(reportType, transcriptVersionId) {
  return {
    generated: false,
    report_type: reportType,
    source_transcript_version_id: transcriptVersionId,
    sections: [],
    note: "AI draft scaffolding; no model output has been attached yet.",
  };
}

function transcriptRow(row) {
  return {
    id: row.id,
    consultationId: row.consultation_id,
    recordingId: row.recording_id || null,
    source: row.source,
    language: row.language,
    status: row.status,
    createdAt: iso(row.created_at),
  };
}

function transcriptVersionRow(row, { includeContent = false } = {}) {
  const version = {
    id: row.id,
    transcriptId: row.transcript_id,
    versionNumber: row.version_number,
    contentFormat: row.content_format,
    isDoctorEdited: Boolean(row.is_doctor_edited),
    contentHash: row.content_hash,
    reviewDecision: row.review_decision || null,
    reviewedByUserId: row.reviewed_by_user_id || null,
    reviewedAt: iso(row.reviewed_at),
    reviewNote: row.review_note || null,
    createdAt: iso(row.created_at),
  };
  if (includeContent) version.content = row.content;
  return version;
}

function reportRow(row) {
  return {
    id: row.id,
    consultationId: row.consultation_id,
    patientUserId: row.patient_user_id,
    doctorUserId: row.doctor_user_id,
    reportType: row.report_type,
    status: row.status,
    publicationState: row.publication_state,
    publishedVersionId: row.published_version_id || null,
    publishedAt: iso(row.published_at),
    createdAt: iso(row.created_at),
  };
}

function reportVersionRow(row, { includeContent = false } = {}) {
  const version = {
    id: row.id,
    reportId: row.report_id,
    versionNumber: row.version_number,
    contentSchemaVersion: row.content_schema_version,
    sourceTranscriptVersionId: row.source_transcript_version_id,
    renderedText: row.rendered_text || null,
    generatedByExecutionId: row.generated_by_execution_id || null,
    editedByUserId: row.edited_by_user_id || null,
    contentHash: row.content_hash,
    reviewDecision: row.review_decision || null,
    reviewedByUserId: row.reviewed_by_user_id || null,
    reviewedAt: iso(row.reviewed_at),
    reviewNote: row.review_note || null,
    createdAt: iso(row.created_at),
  };
  if (includeContent) version.content = row.content;
  return version;
}

/* ------------------------------- transcripts ------------------------------ */

async function listConsultationTranscripts(ctx) {
  const consultationId = assertUuid(ctx.params.id, "Consultation");
  await accessService.assertConsultationAccess(pool, ctx, consultationId);
  const { rows } = await pool.query(
    `SELECT * FROM transcripts WHERE consultation_id = $1 ORDER BY created_at DESC`,
    [consultationId]
  );
  return { transcripts: rows.map(transcriptRow) };
}

async function getTranscript(ctx) {
  const id = assertUuid(ctx.params.id, "Transcript");
  const transcript = await accessService.assertTranscriptAccess(pool, ctx, id);
  const { rows } = await pool.query(
    `SELECT * FROM transcript_versions WHERE transcript_id = $1 ORDER BY version_number`,
    [id]
  );
  await auditService.recordClinicalAccess(pool, {
    actorUserId: ctx.actorId,
    patientUserId: transcript.patient_user_id,
    entityType: "transcript",
    entityId: id,
    metadata: { consultation_id: transcript.consultation_id },
    context: ctx.context,
  });
  return {
    transcript: transcriptRow(transcript),
    versions: rows.map((row) => transcriptVersionRow(row, { includeContent: true })),
  };
}

async function createTranscript(ctx) {
  const { body } = ctx;
  const v = new Validator();
  const consultationId = v.uuid(body.consultation_id, "consultation_id", { required: true });
  const content = v.text(body.content, "content", { required: true, min: 1, max: 200000, label: "Transcript content" });
  const language = v.text(body.language, "language", { max: 16, label: "Language" });
  const contentFormat = v.oneOf(body.content_format || "plain_text", "content_format", ["plain_text", "json"], {
    required: false, label: "Content format",
  });
  v.done();

  return withTransaction(async (client) => {
    const consultation = await accessService.assertConsultationAccess(client, ctx, consultationId);
    const created = await client.query(
      `INSERT INTO transcripts (consultation_id, source, language, created_by_user_id)
       VALUES ($1, 'manual', $2, $3) RETURNING *`,
      [consultationId, language || "en", ctx.actorId]
    );
    const transcript = created.rows[0];
    const version = await client.query(
      `INSERT INTO transcript_versions
         (transcript_id, version_number, content, content_format,
          is_doctor_edited, edited_by_user_id, content_hash)
       VALUES ($1, 1, $2, $3, TRUE, $4, $5) RETURNING *`,
      [transcript.id, content, contentFormat || "plain_text", ctx.actorId, sha256(content)]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "transcript.version_created",
      eventCategory: "clinical_access",
      entityType: "transcript_version",
      entityId: version.rows[0].id,
      patientUserId: consultation.patient_user_id,
      after: { transcript_id: transcript.id, version_number: 1, source: "manual" },
      metadata: {},
      context: ctx.context,
    });
    const { rows } = await client.query(`SELECT * FROM transcripts WHERE id = $1`, [transcript.id]);
    return { transcript: transcriptRow(rows[0]), version: transcriptVersionRow(version.rows[0], { includeContent: true }) };
  });
}

async function createTranscriptVersion(ctx) {
  const transcriptId = assertUuid(ctx.params.id, "Transcript");
  const v = new Validator();
  const content = v.text(ctx.body.content, "content", { required: true, min: 1, max: 200000, label: "Transcript content" });
  const contentFormat = v.oneOf(ctx.body.content_format || ctx.body.contentFormat || "plain_text", "content_format", ["plain_text", "json"], {
    required: false, label: "Content format",
  });
  v.done();

  return withTransaction(async (client) => {
    const transcript = await accessService.assertTranscriptAccess(client, ctx, transcriptId);
    // Lock the parent document so concurrent corrections cannot reuse a number.
    await client.query(`SELECT id FROM transcripts WHERE id = $1 FOR UPDATE`, [transcriptId]);
    const max = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM transcript_versions WHERE transcript_id = $1`,
      [transcriptId]
    );
    const versionNumber = Number(max.rows[0].next);
    const { rows } = await client.query(
      `INSERT INTO transcript_versions
         (transcript_id, version_number, content, content_format,
          is_doctor_edited, edited_by_user_id, content_hash)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6) RETURNING *`,
      [transcriptId, versionNumber, content, contentFormat || "plain_text", ctx.actorId, sha256(content)]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "transcript.version_created",
      eventCategory: "clinical_access",
      entityType: "transcript_version",
      entityId: rows[0].id,
      patientUserId: transcript.patient_user_id,
      after: { transcript_id: transcriptId, version_number: versionNumber, is_doctor_edited: true },
      metadata: {},
      context: ctx.context,
    });
    return { version: transcriptVersionRow(rows[0], { includeContent: true }) };
  });
}

async function reviewTranscriptVersion(ctx) {
  const versionId = assertUuid(ctx.params.id, "Transcript version");
  const v = new Validator();
  const decision = v.oneOf(ctx.body.decision, "decision", ["approved", "rejected"], { label: "Decision" });
  const note = v.text(ctx.body.note, "note", { max: 1000, label: "Review note" });
  v.done();

  return withTransaction(async (client) => {
    const current = await accessService.assertTranscriptVersionAccess(client, ctx, versionId);
    if (current.review_decision) {
      throw httpError(409, "version_conflict", "This version has already been reviewed. Create a new version instead.");
    }
    const { rows } = await client.query(
      `UPDATE transcript_versions
          SET review_decision = $1, reviewed_by_user_id = $2, reviewed_at = now(), review_note = $3
        WHERE id = $4 RETURNING *`,
      [decision, ctx.actorId, note, versionId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "transcript.reviewed",
      eventCategory: "approval",
      entityType: "transcript_version",
      entityId: versionId,
      patientUserId: current.patient_user_id,
      before: { review_decision: null },
      after: { review_decision: decision },
      metadata: { transcript_id: current.transcript_id, version_number: current.version_number },
      context: ctx.context,
    });
    return { version: transcriptVersionRow(rows[0]) };
  });
}

async function getPatientTranscript(ctx) {
  const id = assertUuid(ctx.params.id, "Transcript");
  const { rows } = await pool.query(
    `SELECT t.*, c.patient_user_id
       FROM transcripts t
       JOIN consultations c ON c.id = t.consultation_id
      WHERE t.id = $1 AND c.patient_user_id = $2 AND t.status = 'approved'`,
    [id, ctx.actorId]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Transcript not found.");
  const { rows: versions } = await pool.query(
    `SELECT * FROM transcript_versions
      WHERE transcript_id = $1 AND review_decision = 'approved'
      ORDER BY version_number DESC LIMIT 1`,
    [id]
  );
  if (versions.length === 0) throw httpError(404, "not_found", "Transcript not found.");
  return {
    transcript: transcriptRow(rows[0]),
    approvedVersion: transcriptVersionRow(versions[0], { includeContent: true }),
  };
}

/* --------------------------------- reports -------------------------------- */

/**
 * Agent 1 scaffolding: exactly one report row per type per consultation plus
 * one version per row, always linked to the approved transcript version.
 * Exported so the internal agent service can call it inside its transaction.
 */
async function createReportScaffolding(client, {
  consultation,
  transcriptVersionId,
  executionId = null,
  contentByType = {},
}) {
  const reports = [];
  for (const reportType of REPORT_TYPES) {
    const inserted = await client.query(
      `INSERT INTO medical_reports
         (consultation_id, patient_user_id, doctor_user_id, report_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (consultation_id, report_type) DO NOTHING
       RETURNING id, report_type`,
      [consultation.id, consultation.patient_user_id, consultation.doctor_user_id, reportType]
    );
    if (inserted.rowCount === 0) continue;

    const supplied = contentByType[reportType];
    const content = isPlainObject(supplied) ? supplied : draftContent(reportType, transcriptVersionId);
    const version = await client.query(
      `INSERT INTO report_versions
         (report_id, version_number, content, content_schema_version,
          source_transcript_version_id, generated_by_execution_id, content_hash)
       VALUES ($1, 1, $2::jsonb, 'v1', $3, $4, $5)
       RETURNING id`,
      [
        inserted.rows[0].id,
        JSON.stringify(content),
        transcriptVersionId,
        executionId,
        sha256(JSON.stringify(content)),
      ]
    );
    reports.push({ id: inserted.rows[0].id, reportType, versionId: version.rows[0].id });
  }
  return reports;
}

async function listConsultationReports(ctx) {
  const consultationId = assertUuid(ctx.params.id, "Consultation");
  await accessService.assertConsultationAccess(pool, ctx, consultationId);
  const { rows } = await pool.query(
    `SELECT * FROM medical_reports WHERE consultation_id = $1 ORDER BY report_type`,
    [consultationId]
  );
  const reports = [];
  for (const row of rows) {
    const { rows: versions } = await pool.query(
      `SELECT id, version_number, review_decision, reviewed_at, created_at
         FROM report_versions WHERE report_id = $1 ORDER BY version_number`,
      [row.id]
    );
    reports.push({ ...reportRow(row), versions });
  }
  return { reports };
}

async function getReport(ctx) {
  const reportId = assertUuid(ctx.params.id, "Report");
  const report = await accessService.assertReportAccess(pool, ctx, reportId);
  const { rows } = await pool.query(
    `SELECT * FROM report_versions WHERE report_id = $1 ORDER BY version_number`,
    [reportId]
  );
  await auditService.recordClinicalAccess(pool, {
    actorUserId: ctx.actorId,
    patientUserId: report.patient_user_id,
    entityType: "medical_report",
    entityId: reportId,
    metadata: { report_type: report.report_type },
    context: ctx.context,
  });
  return {
    report: reportRow(report),
    versions: rows.map((row) => reportVersionRow(row, { includeContent: true })),
  };
}

async function getReportVersion(ctx) {
  const reportId = assertUuid(ctx.params.id, "Report");
  const versionId = assertUuid(ctx.params.versionId, "Report version");
  const version = await accessService.assertReportVersionAccess(pool, ctx, versionId);
  if (version.report_id !== reportId) {
    throw httpError(404, "not_found", "Report version not found.");
  }
  return { version: reportVersionRow(version, { includeContent: true }) };
}

async function createReportVersion(ctx) {
  const reportId = assertUuid(ctx.params.id, "Report");
  const v = new Validator();
  const content = v.jsonObject(ctx.body.content, "content", { required: true, label: "Report content" });
  const transcriptVersionId = v.uuid(ctx.body.source_transcript_version_id, "source_transcript_version_id", { required: true });
  const renderedText = v.text(ctx.body.rendered_text, "rendered_text", { max: 100000, label: "Rendered text" });
  const schemaVersion = v.text(ctx.body.content_schema_version || "v1", "content_schema_version", { max: 20 });
  v.done();

  return withTransaction(async (client) => {
    const report = await accessService.assertReportAccess(client, ctx, reportId);
    await client.query(`SELECT id FROM medical_reports WHERE id = $1 FOR UPDATE`, [reportId]);
    const max = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM report_versions WHERE report_id = $1`,
      [reportId]
    );
    const canonical = JSON.stringify(content);
    const { rows } = await client.query(
      `INSERT INTO report_versions
         (report_id, version_number, content, content_schema_version,
          source_transcript_version_id, edited_by_user_id, rendered_text, content_hash)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8) RETURNING *`,
      [
        reportId, Number(max.rows[0].next), canonical, schemaVersion || "v1",
        transcriptVersionId, ctx.actorId, renderedText, sha256(canonical),
      ]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "report.version_created",
      eventCategory: "clinical_access",
      entityType: "report_version",
      entityId: rows[0].id,
      patientUserId: report.patient_user_id,
      after: { report_id: reportId, version_number: Number(max.rows[0].next) },
      metadata: { source_transcript_version_id: transcriptVersionId },
      context: ctx.context,
    });
    return { version: reportVersionRow(rows[0], { includeContent: true }) };
  });
}

async function reviewReportVersion(ctx) {
  const versionId = assertUuid(ctx.params.id, "Report version");
  const v = new Validator();
  const decision = v.oneOf(ctx.body.decision, "decision", ["approved", "rejected"], { label: "Decision" });
  const note = v.text(ctx.body.note, "note", { max: 1000, label: "Review note" });
  v.done();

  return withTransaction(async (client) => {
    const current = await accessService.assertReportVersionAccess(client, ctx, versionId);
    if (current.review_decision) {
      throw httpError(409, "version_conflict", "This version has already been reviewed. Create a new version instead.");
    }
    const { rows } = await client.query(
      `UPDATE report_versions
          SET review_decision = $1, reviewed_by_user_id = $2, reviewed_at = now(), review_note = $3
        WHERE id = $4 RETURNING *`,
      [decision, ctx.actorId, note, versionId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "report.reviewed",
      eventCategory: "approval",
      entityType: "report_version",
      entityId: versionId,
      patientUserId: current.patient_user_id,
      before: { review_decision: null },
      after: { review_decision: decision },
      metadata: { report_id: current.report_id, version_number: current.version_number },
      context: ctx.context,
    });
    return { version: reportVersionRow(rows[0]) };
  });
}

async function publishReport(ctx) {
  const reportId = assertUuid(ctx.params.id, "Report");
  const v = new Validator();
  const requestedVersionId = v.uuid(ctx.body.version_id, "version_id");
  v.done();

  return withTransaction(async (client) => {
    const report = await accessService.assertReportAccess(client, ctx, reportId, { forUpdate: true });
    if (report.report_type !== "report_1_patient_summary") {
      throw httpError(409, "publication_not_allowed", "Only Report 1 (patient summary) can be published to the patient portal.");
    }
    if (report.publication_state === "published") {
      throw httpError(409, "status_unchanged", "This report is already published.");
    }

    let versionId = requestedVersionId;
    if (!versionId) {
      const latest = await client.query(
        `SELECT id FROM report_versions
          WHERE report_id = $1 AND review_decision = 'approved'
          ORDER BY version_number DESC LIMIT 1`,
        [reportId]
      );
      versionId = latest.rows[0]?.id || null;
    }
    if (!versionId) {
      throw httpError(409, "report_not_approved", "Publishing requires a doctor-approved version of this report.");
    }

    const { rows } = await client.query(
      `UPDATE medical_reports
          SET publication_state = 'published', published_version_id = $1,
              published_at = now(), published_by_user_id = $2
        WHERE id = $3 RETURNING *`,
      [versionId, ctx.actorId, reportId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "report.published",
      eventCategory: "approval",
      entityType: "medical_report",
      entityId: reportId,
      patientUserId: report.patient_user_id,
      before: { publication_state: report.publication_state },
      after: { publication_state: "published" },
      metadata: { recipient_user_id: report.patient_user_id, published_version_id: versionId },
      context: ctx.context,
    });
    await client.query(
      `INSERT INTO notifications
         (recipient_user_id, category, channel, title, body,
          related_entity_type, related_entity_id, status)
       VALUES ($1, 'report_ready', 'in_app', $2, $3, 'medical_report', $4, 'sent')`,
      [
        report.patient_user_id,
        "A new report is available",
        "Your doctor approved and released a patient summary. Open Reports to read it.",
        reportId,
      ]
    );
    return { report: reportRow(rows[0]) };
  });
}

async function withdrawReport(ctx) {
  const reportId = assertUuid(ctx.params.id, "Report");
  const v = new Validator();
  const reason = v.text(ctx.body.reason, "reason", { max: 500, label: "Reason" });
  v.done();

  return withTransaction(async (client) => {
    const report = await accessService.assertReportAccess(client, ctx, reportId, { forUpdate: true });
    if (report.publication_state !== "published") {
      throw httpError(409, "invalid_status_transition", "Only a published report can be withdrawn.");
    }
    const { rows } = await client.query(
      `UPDATE medical_reports SET publication_state = 'withdrawn' WHERE id = $1 RETURNING *`,
      [reportId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "report.withdrawn",
      eventCategory: "approval",
      entityType: "medical_report",
      entityId: reportId,
      patientUserId: report.patient_user_id,
      before: { publication_state: "published" },
      after: { publication_state: "withdrawn" },
      metadata: { reason: reason || null, recipient_user_id: report.patient_user_id },
      context: ctx.context,
    });
    return { report: reportRow(rows[0]) };
  });
}

async function listPatientReports({ actorId, query }) {
  const { rows } = await pool.query(
    `SELECT mr.*, s.name AS specialty, cl.name AS location_name
       FROM medical_reports mr
       LEFT JOIN consultations c  ON c.id = mr.consultation_id
       LEFT JOIN appointments a  ON a.id = c.appointment_id
       LEFT JOIN specialties s   ON s.id = a.specialty_id
       LEFT JOIN clinic_locations cl ON cl.id = a.clinic_location_id
      WHERE mr.patient_user_id = $1
        AND mr.report_type = 'report_1_patient_summary'
        AND mr.publication_state = 'published'
      ORDER BY mr.published_at DESC NULLS LAST`,
    [actorId]
  );
  return { reports: rows.map((row) => serializeReport({ ...row, title: "Patient summary report" })) };
}

async function getPatientReport({ actorId, params }) {
  const id = assertUuid(params.id, "Report");
  const { rows } = await pool.query(
    `SELECT mr.*, rv.content, rv.rendered_text, rv.version_number, rv.review_decision,
            s.name AS specialty, cl.name AS location_name
       FROM medical_reports mr
       JOIN report_versions rv ON rv.id = mr.published_version_id
       LEFT JOIN consultations c  ON c.id = mr.consultation_id
       LEFT JOIN appointments a  ON a.id = c.appointment_id
       LEFT JOIN specialties s   ON s.id = a.specialty_id
       LEFT JOIN clinic_locations cl ON cl.id = a.clinic_location_id
      WHERE mr.id = $1
        AND mr.patient_user_id = $2
        AND mr.report_type = 'report_1_patient_summary'
        AND mr.publication_state = 'published'
        AND rv.review_decision = 'approved'`,
    [id, actorId]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Report not found.");
  const row = rows[0];
  const report = serializeReport({ ...row, title: "Patient summary report" }, { includeContent: true });
  if (Array.isArray(row.content?.sections)) {
    report.sections = row.content.sections
      .filter((section) => isPlainObject(section))
      .map((section) => ({ heading: String(section.heading || ""), body: String(section.body || "") }));
  }
  return { report };
}

module.exports = {
  REPORT_TYPES,
  draftContent,
  createReportScaffolding,
  listConsultationTranscripts,
  getTranscript,
  createTranscript,
  createTranscriptVersion,
  reviewTranscriptVersion,
  getPatientTranscript,
  listConsultationReports,
  getReport,
  getReportVersion,
  createReportVersion,
  reviewReportVersion,
  publishReport,
  withdrawReport,
  listPatientReports,
  getPatientReport,
};

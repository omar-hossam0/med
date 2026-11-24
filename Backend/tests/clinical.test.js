/**
 * Phase 4/5 integration suite — consent gate, transcript/review approval chain,
 * Agent 1 input gate and patient report release. Requires a disposable DB.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const pool = require("../config/db");
const fixtures = require("./helpers/fixtures");

const { DB_ENABLED } = fixtures;
const SERVICE_TOKEN = "clinical-fixture-service-token";

describe("Clinical approval chain (DB)", { skip: !DB_ENABLED }, () => {
  let server;
  let baseUrl;
  const userIds = [];
  const sessionHashes = [];
  const originalToken = process.env.AGENT_SERVICE_TOKEN;
  let patient;
  let doctor;
  let outsiderDoctor;
  let doctorSession;
  let patientSession;
  let refs;
  let consultationId;
  let appointmentId;
  let transcriptId;
  let unapprovedTranscriptVersionId;
  let approvedTranscriptVersionId;

  before(async () => {
    process.env.AGENT_SERVICE_TOKEN = SERVICE_TOKEN;
    refs = await fixtures.referenceIds();
    patient = await fixtures.createPatient("clinical", userIds);
    doctor = await fixtures.createDoctor("clinical", userIds, refs);
    outsiderDoctor = await fixtures.createDoctor("outsider", userIds, refs);
    doctorSession = await fixtures.mintSession(doctor.id, sessionHashes);
    patientSession = await fixtures.mintSession(patient.id, sessionHashes);

    const start = new Date(Date.now() + 2 * 86400000);
    const inserted = await pool.query(
      `INSERT INTO appointments
         (patient_user_id, doctor_user_id, specialty_id, clinic_location_id,
          consultation_type, status, requested_start_at, requested_end_at,
          scheduled_start_at, scheduled_end_at, confirmed_at, confirmed_by_user_id,
          booked_by_user_id, version)
       VALUES ($1, $2, $3, $4, 'in_person', 'confirmed', $5, $6, $5, $6, now(), $2, $2, 1)
       RETURNING id`,
      [patient.id, doctor.id, refs.specialtyId, refs.locationId,
        start.toISOString(), new Date(start.getTime() + 1800000).toISOString()]
    );
    appointmentId = inserted.rows[0].id;
    const consultation = await pool.query(
      `INSERT INTO consultations (appointment_id, patient_user_id, doctor_user_id, status)
       VALUES ($1, $2, $3, 'scheduled') RETURNING id`,
      [appointmentId, patient.id, doctor.id]
    );
    consultationId = consultation.rows[0].id;
    await pool.query(
      `INSERT INTO care_relationships
         (patient_user_id, doctor_user_id, source, source_appointment_id, granted_by_user_id, status)
       VALUES ($1, $2, 'appointment', $3, $1, 'active')`,
      [patient.id, doctor.id, appointmentId]
    );

    const started = await fixtures.startServer();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await fixtures.cleanup(userIds, sessionHashes);
    if (originalToken === undefined) delete process.env.AGENT_SERVICE_TOKEN;
    else process.env.AGENT_SERVICE_TOKEN = originalToken;
  });

  function serviceApi(path, body) {
    return fixtures.api(baseUrl, path, {
      method: "POST",
      body,
      headers: { "x-service-token": SERVICE_TOKEN },
    });
  }

  it("refuses a recording without granted audio consent", async () => {
    const response = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}/recordings`, {
      method: "POST", session: doctorSession,
      body: {
        storage_provider: "local", storage_key: `fixture/${crypto.randomBytes(6).toString("hex")}.wav`,
        mime_type: "audio/wav", size_bytes: 1024,
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "consent_required");
  });

  it("records consent once, rejects duplicates and refuses audio bytes", async () => {
    const consent = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}/consents`, {
      method: "POST", session: doctorSession,
      body: { consent_type: "audio_recording", status: "granted", method: "written" },
    });
    assert.equal(consent.status, 201, JSON.stringify(consent.body));
    const duplicate = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}/consents`, {
      method: "POST", session: doctorSession,
      body: { consent_type: "audio_recording", status: "granted", method: "written" },
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, "consent_exists");

    const withAudio = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}/recordings`, {
      method: "POST", session: doctorSession,
      body: { storage_provider: "local", storage_key: "fixture/audio.wav", mime_type: "audio/wav", audio: "BASE64" },
    });
    assert.equal(withAudio.status, 400);
  });

  it("registers recording metadata only, and advances status forward", async () => {
    const key = `fixture/${crypto.randomBytes(6).toString("hex")}.wav`;
    const created = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}/recordings`, {
      method: "POST", session: doctorSession,
      body: { storage_provider: "local", storage_key: key, mime_type: "audio/wav", size_bytes: 2048 },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const recordingId = created.body.recording.id;

    const updated = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}/recordings/${recordingId}`, {
      method: "PATCH", session: doctorSession, body: { status: "uploaded" },
    });
    assert.equal(updated.status, 200);
    const backwards = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}/recordings/${recordingId}`, {
      method: "PATCH", session: doctorSession, body: { status: "pending_upload" },
    });
    assert.equal(backwards.status, 409);
  });

  it("a doctor without a care relationship receives 403 clinical_access_denied", async () => {
    const outsiderSession = await fixtures.mintSession(outsiderDoctor.id, sessionHashes);
    const response = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}`, { session: outsiderSession });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "clinical_access_denied");
    const events = await pool.query(
      `SELECT id FROM v_security_events WHERE event_type = 'security.clinical_access_denied' ORDER BY occurred_at DESC LIMIT 1`
    );
    assert.equal(events.rowCount, 1, "denials must write a security event");
  });

  it("transcript versions are append-only and approval is recorded on the version", async () => {
    const created = await fixtures.api(baseUrl, "/api/doctor/transcripts", {
      method: "POST", session: doctorSession,
      body: { consultation_id: consultationId, content: "Fixture transcript v1", language: "en" },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    transcriptId = created.body.transcript.id;
    unapprovedTranscriptVersionId = created.body.version.id;

    const second = await fixtures.api(baseUrl, `/api/doctor/transcripts/${transcriptId}/versions`, {
      method: "POST", session: doctorSession, body: { content: "Fixture transcript v2 (doctor edited)" },
    });
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal(second.body.version.versionNumber, 2);
    approvedTranscriptVersionId = second.body.version.id;

    const approved = await fixtures.api(baseUrl, `/api/doctor/transcript-versions/${approvedTranscriptVersionId}/review`, {
      method: "POST", session: doctorSession, body: { decision: "approved", note: "Fixture approval" },
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const twice = await fixtures.api(baseUrl, `/api/doctor/transcript-versions/${approvedTranscriptVersionId}/review`, {
      method: "POST", session: doctorSession, body: { decision: "rejected" },
    });
    assert.equal(twice.status, 409);
    assert.equal(twice.body.code, "version_conflict");

    const status = await pool.query(`SELECT status FROM transcripts WHERE id = $1`, [transcriptId]);
    assert.equal(status.rows[0].status, "approved", "trigger maintains transcripts.status");
  });

  it("Agent 1 rejects an unapproved and a missing transcript version", async () => {
    const unapproved = await serviceApi("/api/internal/agents/reports", {
      consultation_id: consultationId,
      source_transcript_version_id: unapprovedTranscriptVersionId,
      idempotency_key: `fixture-unapproved-${Date.now()}`,
    });
    assert.equal(unapproved.status, 409);
    assert.equal(unapproved.body.code, "transcript_not_approved");

    const missing = await serviceApi("/api/internal/agents/reports", {
      consultation_id: consultationId,
      source_transcript_version_id: crypto.randomUUID(),
      idempotency_key: `fixture-missing-${Date.now()}`,
    });
    assert.equal(missing.status, 404);
  });

  it("Agent 1 consumes the approved version and creates three report drafts", async () => {
    const response = await serviceApi("/api/internal/agents/reports", {
      consultation_id: consultationId,
      source_transcript_version_id: approvedTranscriptVersionId,
      idempotency_key: `fixture-approved-${Date.now()}`,
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.reports.length, 3);
    const replay = await serviceApi("/api/internal/agents/reports", {
      consultation_id: consultationId,
      source_transcript_version_id: approvedTranscriptVersionId,
      idempotency_key: response.body.execution.idempotencyKey || `fixture-approved-${Date.now()}`,
    });
    // A fresh key is a new execution; scaffolding is idempotent per consultation/type.
    assert.equal(replay.status, 201);
    assert.equal(replay.body.reports.length, 0, "no duplicate reports for the same consultation/type");
  });

  it("only a doctor-approved Report 1 can be published to the patient", async () => {
    const reports = await fixtures.api(baseUrl, `/api/doctor/consultations/${consultationId}/reports`, { session: doctorSession });
    assert.equal(reports.status, 200);
    assert.equal(reports.body.reports.length, 3);

    const report1 = reports.body.reports.find((row) => row.reportType === "report_1_patient_summary");
    const report2 = reports.body.reports.find((row) => row.reportType === "report_2_structured_profile");
    const version1 = report1.versions[0].id;

    const blocked = await fixtures.api(baseUrl, `/api/doctor/reports/${report1.id}/publish`, {
      method: "POST", session: doctorSession, body: { version_id: version1 },
    });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, "report_not_approved");

    const reviewed = await fixtures.api(baseUrl, `/api/doctor/report-versions/${version1}/review`, {
      method: "POST", session: doctorSession, body: { decision: "approved" },
    });
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));

    const published = await fixtures.api(baseUrl, `/api/doctor/reports/${report1.id}/publish`, {
      method: "POST", session: doctorSession, body: { version_id: version1 },
    });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.report.publicationState, "published");

    const report2Publish = await fixtures.api(baseUrl, `/api/doctor/reports/${report2.id}/publish`, {
      method: "POST", session: doctorSession, body: {},
    });
    assert.equal(report2Publish.status, 409);
    assert.equal(report2Publish.body.code, "publication_not_allowed");
  });

  it("the patient sees released reports only", async () => {
    const list = await fixtures.api(baseUrl, "/api/patient/reports", { session: patientSession });
    assert.equal(list.status, 200);
    assert.equal(list.body.reports.length, 1);
    const reportId = list.body.reports[0].id;

    const detail = await fixtures.api(baseUrl, `/api/patient/reports/${reportId}`, { session: patientSession });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.report.publicationState, "published");
    assert.ok("content" in detail.body.report);

    const all = await pool.query(`SELECT id FROM medical_reports WHERE consultation_id = $1`, [consultationId]);
    const unpublished = all.rows.find((row) => row.id !== reportId);
    const hidden = await fixtures.api(baseUrl, `/api/patient/reports/${unpublished.id}`, { session: patientSession });
    assert.equal(hidden.status, 404, "a 404 must not distinguish unpublished from missing");
  });
});

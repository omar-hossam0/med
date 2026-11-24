/**
 * Phase 11 integration suite — reference document lifecycle, forward-only
 * status transitions, indexing gate and RAG evidence handling.
 * Requires a disposable DB and AGENT_SERVICE_TOKEN.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const pool = require("../config/db");
const fixtures = require("./helpers/fixtures");

const { DB_ENABLED } = fixtures;
const SERVICE_TOKEN = "reference-fixture-service-token";

describe("Reference knowledge / OCR / RAG (DB)", { skip: !DB_ENABLED }, () => {
  let server;
  let baseUrl;
  const userIds = [];
  const sessionHashes = [];
  const originalToken = process.env.AGENT_SERVICE_TOKEN;
  let adminSession;
  let doctorSession;
  let documentId;
  let versionId;
  let executionId;

  before(async () => {
    process.env.AGENT_SERVICE_TOKEN = SERVICE_TOKEN;
    const adminId = await fixtures.findAdmin();
    assert.ok(adminId, "An Admin account is required for the reference suite.");
    const refs = await fixtures.referenceIds();
    const doctor = await fixtures.createDoctor("reference", userIds, refs);
    adminSession = await fixtures.mintSession(adminId, sessionHashes);
    doctorSession = await fixtures.mintSession(doctor.id, sessionHashes);
    const started = await fixtures.startServer();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (documentId) {
      await pool.query(`DELETE FROM rag_citations WHERE rag_query_id IN (SELECT id FROM rag_queries WHERE answer IS NOT NULL AND question LIKE 'Fixture%')`);
      await pool.query(`DELETE FROM rag_queries WHERE question LIKE 'Fixture%'`);
      await pool.query(`DELETE FROM reference_chunks WHERE document_version_id IN (SELECT id FROM reference_document_versions WHERE document_id = $1)`, [documentId]);
      // Clear the reverse extraction link before removing the execution row.
      await pool.query(`UPDATE reference_document_versions SET extraction_execution_id = NULL WHERE document_id = $1`, [documentId]);
      await pool.query(`DELETE FROM agent_executions WHERE reference_document_version_id IN (SELECT id FROM reference_document_versions WHERE document_id = $1)`, [documentId]);
      await pool.query(`DELETE FROM reference_document_versions WHERE document_id = $1`, [documentId]);
      await pool.query(`DELETE FROM reference_documents WHERE id = $1`, [documentId]);
    }
    await fixtures.cleanup(userIds, sessionHashes);
    if (originalToken === undefined) delete process.env.AGENT_SERVICE_TOKEN;
    else process.env.AGENT_SERVICE_TOKEN = originalToken;
  });

  function servicePost(path, body) {
    return fixtures.api(baseUrl, path, {
      method: "POST", body, headers: { "x-service-token": SERVICE_TOKEN },
    });
  }

  it("registers a document and an immutable version", async () => {
    const document = await fixtures.api(baseUrl, "/api/reference/documents", {
      method: "POST", session: adminSession,
      body: {
        title: `Fixture guideline ${Date.now()}`,
        source_type: "clinical_guideline",
        language: "en",
        publication_year: 2025,
      },
    });
    assert.equal(document.status, 201, JSON.stringify(document.body));
    documentId = document.body.document.id;

    const checksum = crypto.createHash("sha256").update("fixture-file").digest("hex");
    const version = await fixtures.api(baseUrl, "/api/reference/versions", {
      method: "POST", session: adminSession,
      body: {
        document_id: documentId,
        version_label: "v1",
        file_storage_provider: "local",
        file_key: `fixture/${crypto.randomBytes(6).toString("hex")}.pdf`,
        file_checksum_sha256: checksum,
        mime_type: "application/pdf",
        extraction_method: "ocr",
      },
    });
    assert.equal(version.status, 201, JSON.stringify(version.body));
    versionId = version.body.version.id;
    assert.equal(version.body.version.status, "uploaded");
  });

  it("indexing is refused before quality approval", async () => {
    const response = await servicePost(`/api/reference/versions/${versionId}/index`, {});
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "invalid_status_transition");
  });

  it("extraction service registers a run and attaches normalized text", async () => {
    const run = await servicePost("/api/internal/agents/extraction", {
      reference_document_version_id: versionId,
      engine: "fixture-ocr",
      idempotency_key: `fixture-extraction-${Date.now()}`,
    });
    assert.equal(run.status, 201, JSON.stringify(run.body));
    executionId = run.body.execution.id;

    const attached = await servicePost(`/api/reference/versions/${versionId}/extraction`, {
      execution_id: executionId,
      normalized_text: "Fixture reference passage about hypertension management.\n\nSecond fixture passage about follow-up intervals.",
    });
    assert.equal(attached.status, 200, JSON.stringify(attached.body));
    assert.equal(attached.body.version.status, "extracted");
  });

  it("status transitions are forward-only", async () => {
    const backwards = await servicePost(`/api/reference/versions/${versionId}/extraction`, {
      execution_id: executionId,
      normalized_text: "again",
    });
    assert.equal(backwards.status, 409);
    assert.equal(backwards.body.code, "invalid_status_transition");
  });

  it("quality review, approval and indexing produce deterministic chunks", async () => {
    const reviewed = await fixtures.api(baseUrl, `/api/reference/versions/${versionId}/quality-review`, {
      method: "POST", session: doctorSession, body: { decision: "accepted", notes: "Fixture review" },
    });
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.version.status, "quality_review");

    const approved = await fixtures.api(baseUrl, `/api/reference/versions/${versionId}/approve`, {
      method: "POST", session: doctorSession, body: {},
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.version.status, "approved");

    const indexed = await servicePost(`/api/reference/versions/${versionId}/index`, { chunk_size: 500 });
    assert.equal(indexed.status, 200, JSON.stringify(indexed.body));
    assert.ok(indexed.body.chunkCount >= 1);

    const chunks = await fixtures.api(baseUrl, `/api/reference/versions/${versionId}/chunks`, { session: doctorSession });
    assert.equal(chunks.status, 200);
    assert.equal(chunks.body.chunks.length, indexed.body.chunkCount);
    const indexes = chunks.body.chunks.map((row) => row.chunk_index);
    assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
    for (const chunk of chunks.body.chunks) {
      assert.match(chunk.content_hash, /^[0-9a-f]{64}$/);
    }
  });

  it("RAG answers with citations and unique ranks when evidence exists", async () => {
    const response = await fixtures.api(baseUrl, "/api/reference/rag/query", {
      method: "POST", session: doctorSession, body: { question: "Fixture hypertension management" },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.query.answerStatus, "answered");
    assert.ok(response.body.citations.length >= 1);
    const ranks = response.body.citations.map((row) => row.rank);
    assert.equal(new Set(ranks).size, ranks.length, "citation ranks must be unique");

    const stored = await pool.query(
      `SELECT count(*)::int AS total FROM rag_citations WHERE rag_query_id = $1`,
      [response.body.query.id]
    );
    assert.equal(stored.rows[0].total, ranks.length);
    const queryRow = await pool.query(`SELECT question FROM rag_queries WHERE id = $1`, [response.body.query.id]);
    assert.equal(JSON.stringify(queryRow.rows[0]).includes("patient"), false, "no patient identifiers in rag_queries");
  });

  it("RAG returns insufficient_evidence rather than inventing an answer", async () => {
    const response = await fixtures.api(baseUrl, "/api/reference/rag/query", {
      method: "POST", session: doctorSession, body: { question: "Fixture zzzqxy nonexistent topic" },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.query.answerStatus, "insufficient_evidence");
    assert.equal(response.body.citations.length, 0);
  });

  it("past queries are readable by their author with citations", async () => {
    const response = await fixtures.api(baseUrl, "/api/reference/rag/query", {
      method: "POST", session: doctorSession, body: { question: "Fixture follow-up intervals" },
    });
    const detail = await fixtures.api(baseUrl, `/api/reference/rag/queries/${response.body.query.id}`, { session: doctorSession });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.query.id, response.body.query.id);
    assert.ok(Array.isArray(detail.body.citations));
  });

  it("doctor/admin-only reference reads reject other roles", async () => {
    const patientUserIds = [];
    const patient = await fixtures.createPatient("reference-deny", patientUserIds);
    const patientSession = await fixtures.mintSession(patient.id, sessionHashes);
    const response = await fixtures.api(baseUrl, "/api/reference/documents", { session: patientSession });
    assert.equal(response.status, 403);
    await fixtures.cleanup(patientUserIds, []);
  });
});

/**
 * Reference knowledge base: OCR/RAG ingestion and retrieval (Phase 11).
 *
 * The knowledge base is separate from patient records. No patient identifier is
 * ever stored in rag_queries. Status transitions are forward-only and indexing
 * requires an approved version. There is no vector column (D-2): retrieval is
 * lexical over approved chunks and returns verbatim evidence with citations —
 * it never invents a clinical answer.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const { assertUuid, sha256, iso, optionalText, withTransaction } = require("../utils/dbHelpers");

const FORWARD = {
  uploaded: ["extracting", "extraction_failed"],
  extracting: ["extracted", "extraction_failed"],
  extraction_failed: ["extracting"],
  extracted: ["quality_review", "extraction_failed"],
  quality_review: ["approved", "extracted"],
  approved: ["indexed", "retired"],
  indexed: ["retired"],
  retired: [],
};

function assertTransition(from, to, client, versionId) {
  if (!(FORWARD[from] || []).includes(to)) {
    throw httpError(409, "invalid_status_transition", `A version in status ${from} cannot move to ${to}.`);
  }
  void client;
  void versionId;
}

async function loadVersion(executor, id, { forUpdate = false } = {}) {
  const { rows } = await executor.query(
    `SELECT rdv.*, rd.title AS document_title
       FROM reference_document_versions rdv
       JOIN reference_documents rd ON rd.id = rdv.document_id
      WHERE rdv.id = $1${forUpdate ? " FOR UPDATE OF rdv" : ""}`,
    [id]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Reference document version not found.");
  return rows[0];
}

async function listDocuments({ query }) {
  const search = optionalText(query.search, 150);
  const { rows } = await pool.query(
    `SELECT rd.*,
            (SELECT count(*) FROM reference_document_versions v WHERE v.document_id = rd.id)::int AS version_count
       FROM reference_documents rd
      WHERE ($1::text IS NULL OR rd.title ILIKE '%' || $1 || '%'
             OR COALESCE(rd.authors, '') ILIKE '%' || $1 || '%')
      ORDER BY rd.created_at DESC`,
    [search]
  );
  return { documents: rows.map((row) => ({ ...row, created_at: iso(row.created_at), updated_at: iso(row.updated_at) })) };
}

async function getDocument({ params }) {
  const id = assertUuid(params.id, "Reference document");
  const { rows } = await pool.query(`SELECT * FROM reference_documents WHERE id = $1`, [id]);
  if (rows.length === 0) throw httpError(404, "not_found", "Reference document not found.");
  const { rows: versions } = await pool.query(
    `SELECT * FROM reference_document_versions WHERE document_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  return {
    document: { ...rows[0], created_at: iso(rows[0].created_at), updated_at: iso(rows[0].updated_at) },
    versions: versions.map((row) => ({ ...row, created_at: iso(row.created_at), updated_at: iso(row.updated_at) })),
  };
}

async function createDocument(ctx) {
  const v = new Validator();
  const title = v.text(ctx.body.title, "title", { required: true, min: 2, max: 300, label: "Title" });
  const authors = v.text(ctx.body.authors, "authors", { max: 2000, label: "Authors" });
  const publisher = v.text(ctx.body.publisher, "publisher", { max: 200 });
  const publicationYear = v.integer(ctx.body.publication_year, "publication_year", { min: 1800, max: 2100 });
  const sourceType = v.oneOf(ctx.body.source_type, "source_type", [
    "clinical_guideline", "systematic_review", "journal_article",
    "textbook", "protocol", "patient_education", "other",
  ], { label: "Source type" });
  const language = v.text(ctx.body.language || "en", "language", { max: 16 });
  const description = v.text(ctx.body.description, "description", { max: 2000 });
  const isActive = v.boolean(ctx.body.is_active ?? true, "is_active");
  v.done();

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO reference_documents
         (title, authors, publisher, publication_year, source_type, language, description, is_active, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, authors, publisher, publicationYear, sourceType, language || "en", description, isActive !== false, ctx.actorId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "reference.document_registered",
      eventCategory: "configuration",
      entityType: "reference_document",
      entityId: rows[0].id,
      after: { title, source_type: sourceType },
      metadata: {},
      context: ctx.context,
    });
    return { document: rows[0] };
  });
}

async function createVersion(ctx) {
  const v = new Validator();
  const documentId = v.uuid(ctx.body.document_id, "document_id", { required: true });
  const versionLabel = v.text(ctx.body.version_label, "version_label", { required: true, max: 50, label: "Version label" });
  const provider = v.text(ctx.body.file_storage_provider, "file_storage_provider", { required: true, max: 50 });
  const fileKey = v.text(ctx.body.file_key, "file_key", { required: true, max: 2000 });
  const checksum = v.hexHash(ctx.body.file_checksum_sha256, "file_checksum_sha256", { required: true });
  const mimeType = v.text(ctx.body.mime_type, "mime_type", { required: true, max: 100 });
  const fileSize = v.integer(ctx.body.file_size_bytes, "file_size_bytes", { min: 0, max: 10_000_000_000 });
  const pageCount = v.integer(ctx.body.page_count, "page_count", { min: 1, max: 100000 });
  const method = v.oneOf(ctx.body.extraction_method, "extraction_method", ["digital_text", "ocr", "hybrid"], { label: "Extraction method" });
  v.done();

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO reference_document_versions
         (document_id, version_label, file_storage_provider, file_key,
          file_checksum_sha256, mime_type, file_size_bytes, page_count,
          extraction_method, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploaded', $10)
       RETURNING *`,
      [documentId, versionLabel, provider, fileKey, checksum, mimeType, fileSize, pageCount, method, ctx.actorId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "reference.version_registered",
      eventCategory: "configuration",
      entityType: "reference_document_version",
      entityId: rows[0].id,
      after: { version_label: versionLabel, extraction_method: method },
      metadata: { document_id: documentId },
      context: ctx.context,
    });
    return { version: rows[0] };
  });
}

async function attachExtraction(ctx) {
  const id = assertUuid(ctx.params.id, "Reference document version");
  const v = new Validator();
  const executionId = v.uuid(ctx.body.execution_id, "execution_id", { required: true });
  const normalizedText = v.text(ctx.body.normalized_text, "normalized_text", { max: 2000000, label: "Normalized text" });
  const failed = v.boolean(ctx.body.failed ?? false, "failed");
  const errorCode = v.text(ctx.body.error_code, "error_code", { max: 80 });
  v.done();

  return withTransaction(async (client) => {
    const version = await loadVersion(client, id, { forUpdate: true });
    const linked = await client.query(
      `SELECT id, agent_code FROM agent_executions
        WHERE id = $1 AND reference_document_version_id = $2
          AND agent_code IN ('ocr_extraction', 'digital_text_extraction')`,
      [executionId, id]
    );
    if (linked.rowCount === 0) {
      throw httpError(409, "dependency_conflict", "The extraction execution is not linked to this document version.");
    }

    const toStatus = failed ? "extraction_failed" : "extracted";
    assertTransition(version.status, toStatus, client, id);
    const text = failed ? version.normalized_text : normalizedText;
    if (!failed && !text) {
      throw httpError(400, "validation_error", "normalized_text is required for a successful extraction.");
    }

    const { rows } = await client.query(
      `UPDATE reference_document_versions
          SET status = $1, extraction_execution_id = $2, normalized_text = $3
        WHERE id = $4 RETURNING *`,
      [toStatus, executionId, text, id]
    );
    await client.query(
      `UPDATE agent_executions
          SET status = $1, completed_at = now(),
              output_character_count = $2,
              error_code = CASE WHEN $1 = 'failed' THEN COALESCE($3, 'extraction_failed') ELSE error_code END
        WHERE id = $4 AND completed_at IS NULL`,
      [failed ? "failed" : "succeeded", text ? text.length : 0, errorCode, executionId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      actorType: ctx.actorId ? "user" : "service",
      eventType: "reference.extraction_completed",
      eventCategory: "system",
      entityType: "reference_document_version",
      entityId: id,
      before: { status: version.status },
      after: { status: toStatus },
      metadata: { execution_id: executionId },
      context: ctx.context,
    });
    return { version: rows[0] };
  });
}

async function qualityReview(ctx) {
  const id = assertUuid(ctx.params.id, "Reference document version");
  const v = new Validator();
  const decision = v.oneOf(ctx.body.decision, "decision", ["accepted", "rejected"], { label: "Quality decision" });
  const notes = v.text(ctx.body.notes, "notes", { max: 2000, label: "Quality notes" });
  v.done();

  return withTransaction(async (client) => {
    const version = await loadVersion(client, id, { forUpdate: true });
    if (version.status !== "extracted") {
      throw httpError(409, "invalid_status_transition", "Quality review requires an extracted version.");
    }
    const toStatus = decision === "accepted" ? "quality_review" : "extraction_failed";
    assertTransition(version.status, toStatus, client, id);
    const { rows } = await client.query(
      `UPDATE reference_document_versions
          SET status = $1, quality_reviewed_by_user_id = $2,
              quality_reviewed_at = now(), quality_notes = $3
        WHERE id = $4 RETURNING *`,
      [toStatus, ctx.actorId, notes, id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "reference.quality_reviewed",
      eventCategory: "approval",
      entityType: "reference_document_version",
      entityId: id,
      before: { status: version.status },
      after: { status: toStatus, decision },
      metadata: {},
      context: ctx.context,
    });
    return { version: rows[0] };
  });
}

async function approveVersion(ctx) {
  const id = assertUuid(ctx.params.id, "Reference document version");
  const v = new Validator();
  const note = v.text(ctx.body.note, "note", { max: 1000, label: "Note" });
  v.done();

  return withTransaction(async (client) => {
    const version = await loadVersion(client, id, { forUpdate: true });
    if (version.status !== "quality_review" || !version.quality_reviewed_at) {
      throw httpError(409, "invalid_status_transition", "Approval requires a quality-reviewed version.");
    }
    assertTransition(version.status, "approved", client, id);
    const { rows } = await client.query(
      `UPDATE reference_document_versions
          SET status = 'approved', approved_by_user_id = $1, approved_at = now()
        WHERE id = $2 RETURNING *`,
      [ctx.actorId, id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "reference.approved",
      eventCategory: "approval",
      entityType: "reference_document_version",
      entityId: id,
      before: { status: version.status },
      after: { status: "approved" },
      metadata: { note: note || null },
      context: ctx.context,
    });
    return { version: rows[0] };
  });
}

async function indexVersion(ctx) {
  const id = assertUuid(ctx.params.id, "Reference document version");
  const v = new Validator();
  const maxChunkSize = v.integer(ctx.body.chunk_size || 1200, "chunk_size", { min: 200, max: 8000, label: "Chunk size" });
  v.done();

  return withTransaction(async (client) => {
    const version = await loadVersion(client, id, { forUpdate: true });
    if (version.status !== "approved" || !version.approved_at) {
      throw httpError(409, "invalid_status_transition", "Indexing requires an approved version.");
    }
    assertTransition(version.status, "indexed", client, id);
    if (!version.normalized_text) {
      throw httpError(409, "dependency_conflict", "The approved version has no extracted text to index.");
    }

    const existing = await client.query(
      `SELECT count(*)::int AS total FROM reference_chunks WHERE document_version_id = $1`,
      [id]
    );
    if (existing.rows[0].total > 0) {
      throw httpError(409, "dependency_conflict", "Chunks already exist for this version; create a new version to re-index.");
    }

    const paragraphs = String(version.normalized_text)
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
    const chunks = [];
    for (const paragraph of paragraphs) {
      for (let offset = 0; offset < paragraph.length; offset += maxChunkSize || 1200) {
        chunks.push(paragraph.slice(offset, offset + (maxChunkSize || 1200)));
      }
    }
    if (chunks.length === 0) chunks.push(String(version.normalized_text).trim());

    for (let index = 0; index < chunks.length; index++) {
      const content = chunks[index];
      await client.query(
        `INSERT INTO reference_chunks
           (document_version_id, chunk_index, heading, content, token_count,
            content_hash, embedding_status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', '{}'::jsonb)`,
        [
          id, index,
          content.split("\n")[0].slice(0, 300) || null,
          content,
          Math.max(1, Math.ceil(content.length / 4)),
          sha256(content),
        ]
      );
    }

    const { rows } = await client.query(
      `UPDATE reference_document_versions SET status = 'indexed' WHERE id = $1 RETURNING *`,
      [id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      actorType: ctx.actorId ? "user" : "service",
      eventType: "reference.indexed",
      eventCategory: "system",
      entityType: "reference_document_version",
      entityId: id,
      before: { status: version.status },
      after: { status: "indexed", chunk_count: chunks.length },
      metadata: {},
      context: ctx.context,
    });
    return { version: rows[0], chunkCount: chunks.length };
  });
}

async function listChunks({ params }) {
  const id = assertUuid(params.id, "Reference document version");
  const { rows } = await pool.query(
    `SELECT id, document_version_id, chunk_index, heading, content, token_count,
            page_from, page_to, content_hash, embedding_status, created_at
       FROM reference_chunks WHERE document_version_id = $1 ORDER BY chunk_index`,
    [id]
  );
  return { chunks: rows.map((row) => ({ ...row, created_at: iso(row.created_at) })) };
}

function termsOf(question) {
  return [...new Set(
    String(question).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3)
  )].slice(0, 12);
}

async function ragQuery(ctx) {
  const v = new Validator();
  const question = v.text(ctx.body.question, "question", { required: true, min: 3, max: 2000, label: "Question" });
  const limit = v.integer(ctx.body.limit || 5, "limit", { min: 1, max: 10, label: "Result limit" });
  v.done();
  const terms = termsOf(question);
  const started = Date.now();

  return withTransaction(async (client) => {
    let candidates = [];
    if (terms.length > 0) {
      const patterns = terms.map((term) => `%${term}%`);
      const matches = await client.query(
        `SELECT rc.id, rc.content, rc.heading, rc.chunk_index,
                rd.title AS document_title, rdv.version_label, rdv.id AS version_id
           FROM reference_chunks rc
           JOIN reference_document_versions rdv ON rdv.id = rc.document_version_id
           JOIN reference_documents rd ON rd.id = rdv.document_id
          WHERE rdv.status = 'indexed' AND rd.is_active
            AND rc.content ILIKE ANY($1::text[])
          ORDER BY rc.chunk_index
          LIMIT 100`,
        [patterns]
      );
      candidates = matches.rows
        .map((row) => {
          const haystack = `${row.heading || ""} ${row.content}`.toLowerCase();
          const hits = terms.filter((term) => haystack.includes(term)).length;
          return { ...row, score: hits / terms.length };
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index)
        .slice(0, limit || 5);
    }

    const answerStatus = candidates.length > 0 ? "answered" : "insufficient_evidence";
    const answer = candidates.length > 0
      ? `Retrieved verbatim reference excerpts (not a generated clinical conclusion):\n${candidates
          .map((row, index) => `[${index + 1}] ${row.content.slice(0, 500)}`)
          .join("\n\n")}`
      : "Insufficient evidence in the approved reference library to answer this question. No answer was generated.";

    const inserted = await client.query(
      `INSERT INTO rag_queries
         (asked_by_user_id, question, answer, answer_status, latency_ms, completed_at)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
      [ctx.actorId, question, answer, answerStatus, Date.now() - started]
    );
    const queryId = inserted.rows[0].id;

    const citations = [];
    for (let index = 0; index < candidates.length; index++) {
      const row = candidates[index];
      const { rows: citation } = await client.query(
        `INSERT INTO rag_citations (rag_query_id, chunk_id, rank, relevance_score, quoted_text)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [queryId, row.id, index + 1, Math.min(1, Number(row.score.toFixed(5))), row.content.slice(0, 1000)]
      );
      citations.push({
        id: citation[0].id,
        rank: index + 1,
        relevanceScore: Number(row.score.toFixed(5)),
        quotedText: row.content.slice(0, 1000),
        chunkId: row.id,
        documentTitle: row.document_title,
        versionLabel: row.version_label,
        heading: row.heading || null,
      });
    }

    await auditService.record(client, {
      actorUserId: ctx.actorId,
      eventType: "rag.query_answered",
      eventCategory: "system",
      entityType: "rag_query",
      entityId: queryId,
      metadata: { answer_status: answerStatus, citation_count: citations.length },
      ip: ctx.context?.ip,
      userAgent: ctx.context?.userAgent,
    });

    return {
      query: {
        id: queryId,
        question,
        answer,
        answerStatus,
        uncertainty: candidates.length === 0
          ? "No supporting passages were found in approved reference documents."
          : "This response contains retrieved excerpts only; it is not a diagnosis or treatment recommendation.",
        createdAt: iso(inserted.rows[0].created_at),
      },
      citations,
    };
  });
}

async function getRagQuery({ actorId, params }) {
  const id = assertUuid(params.id, "RAG query");
  const { rows } = await pool.query(
    `SELECT * FROM rag_queries WHERE id = $1 AND asked_by_user_id = $2`,
    [id, actorId]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Query not found.");
  const { rows: citations } = await pool.query(
    `SELECT rc.*, c.heading, rd.title AS document_title, rdv.version_label
       FROM rag_citations rc
       JOIN reference_chunks c ON c.id = rc.chunk_id
       JOIN reference_document_versions rdv ON rdv.id = c.document_version_id
       JOIN reference_documents rd ON rd.id = rdv.document_id
      WHERE rc.rag_query_id = $1 ORDER BY rc.rank`,
    [id]
  );
  return {
    query: { ...rows[0], created_at: iso(rows[0].created_at), completed_at: iso(rows[0].completed_at) },
    citations: citations.map((row) => ({ ...row, created_at: iso(row.created_at) })),
  };
}

module.exports = {
  FORWARD,
  listDocuments,
  getDocument,
  createDocument,
  createVersion,
  attachExtraction,
  qualityReview,
  approveVersion,
  indexVersion,
  listChunks,
  ragQuery,
  getRagQuery,
};

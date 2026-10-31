-- =============================================================================
-- Medora Healthcare — Migration 010: Reference Knowledge Base, OCR and RAG
-- =============================================================================
-- Completes simplification V2 consolidation 5 of 6. document_extraction_jobs is
-- never created: extraction runs through agent_executions (migration 006), and
-- this file adds the typed link in both directions:
--
--   agent_executions.reference_document_version_id  -> what is being extracted
--   reference_document_versions.extraction_execution_id -> which run produced it
--
-- The quality gate stays where it belongs, on the document version
-- (quality_reviewed_* / approved_*), not on the execution envelope. The
-- knowledge base remains separate from patient records: no patient identifier is
-- stored anywhere in this module, and migration 006 forbids an extraction
-- execution from carrying patient_user_id.
--
-- Do NOT add BEGIN/COMMIT: the migration runner owns the transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. reference_documents
-- -----------------------------------------------------------------------------

CREATE TABLE reference_documents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(300) NOT NULL,
    authors          TEXT NULL,
    publisher        VARCHAR(200) NULL,
    publication_year SMALLINT NULL,
    source_type      VARCHAR(30) NOT NULL,
    language         VARCHAR(16) NOT NULL DEFAULT 'en',
    description      TEXT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id UUID NULL
                        REFERENCES users (id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT reference_documents_source_type_check
        CHECK (source_type IN ('clinical_guideline', 'systematic_review', 'journal_article',
                               'textbook', 'protocol', 'patient_education', 'other')),

    CONSTRAINT reference_documents_year_check
        CHECK (publication_year IS NULL OR publication_year BETWEEN 1800 AND 2100),

    CONSTRAINT reference_documents_title_check
        CHECK (char_length(btrim(title)) > 0)
);

COMMENT ON TABLE reference_documents IS
    'Bibliographic work in the medical reference knowledge base. Separate authorization and retention from patient-specific data. Retired, never deleted, once cited.';

CREATE INDEX idx_reference_documents_title       ON reference_documents (title);
CREATE INDEX idx_reference_documents_type_active ON reference_documents (source_type, is_active);

CREATE TRIGGER trg_reference_documents_updated_at
    BEFORE UPDATE ON reference_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. reference_document_versions
-- -----------------------------------------------------------------------------
-- Immutable source file plus its extraction and quality state. This row is the
-- quality gate: chunks may only be produced from an approved version.

CREATE TABLE reference_document_versions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id           UUID NOT NULL
                             REFERENCES reference_documents (id) ON DELETE RESTRICT,
    version_label         VARCHAR(50) NOT NULL,
    file_storage_provider VARCHAR(50) NOT NULL,
    file_key              TEXT NOT NULL,
    file_checksum_sha256  CHAR(64) NOT NULL,
    mime_type             VARCHAR(100) NOT NULL,
    file_size_bytes       BIGINT NULL,
    page_count            INTEGER NULL,
    extraction_method     VARCHAR(20) NOT NULL,
    normalized_text       TEXT NULL,
    status                VARCHAR(30) NOT NULL DEFAULT 'uploaded',

    -- The unified execution that produced normalized_text (consolidation 5).
    extraction_execution_id UUID NULL
                             REFERENCES agent_executions (id) ON DELETE RESTRICT,

    quality_reviewed_by_user_id UUID NULL
                             REFERENCES users (id) ON DELETE RESTRICT,
    quality_reviewed_at   TIMESTAMPTZ NULL,
    quality_notes         TEXT NULL,
    approved_by_user_id   UUID NULL
                             REFERENCES users (id) ON DELETE RESTRICT,
    approved_at           TIMESTAMPTZ NULL,
    created_by_user_id    UUID NOT NULL
                             REFERENCES users (id) ON DELETE RESTRICT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT reference_document_versions_method_check
        CHECK (extraction_method IN ('digital_text', 'ocr', 'hybrid')),

    CONSTRAINT reference_document_versions_status_check
        CHECK (status IN ('uploaded', 'extracting', 'extraction_failed', 'extracted',
                          'quality_review', 'approved', 'indexed', 'retired')),

    CONSTRAINT reference_document_versions_page_count_check
        CHECK (page_count IS NULL OR page_count > 0),

    CONSTRAINT reference_document_versions_size_check
        CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),

    CONSTRAINT reference_document_versions_checksum_check
        CHECK (file_checksum_sha256 ~ '^[0-9a-f]{64}$'),

    CONSTRAINT reference_document_versions_quality_pair_check
        CHECK ((quality_reviewed_at IS NULL) = (quality_reviewed_by_user_id IS NULL)),

    CONSTRAINT reference_document_versions_approval_pair_check
        CHECK ((approved_at IS NULL) = (approved_by_user_id IS NULL)),

    -- Indexing requires a quality-approved version.
    CONSTRAINT reference_document_versions_indexed_check
        CHECK (status <> 'indexed' OR approved_at IS NOT NULL),

    -- Extracted text must come from an extraction execution.
    CONSTRAINT reference_document_versions_text_source_check
        CHECK (normalized_text IS NULL OR extraction_execution_id IS NOT NULL)
);

COMMENT ON TABLE reference_document_versions IS
    'Immutable source file plus its extraction and quality state. Indexing requires quality review and approval. Retired, not deleted, after being cited.';
COMMENT ON COLUMN reference_document_versions.extraction_execution_id IS
    'The agent_executions row (ocr_extraction or digital_text_extraction) that produced normalized_text.';

CREATE UNIQUE INDEX uq_reference_document_versions_label
    ON reference_document_versions (document_id, version_label);

CREATE UNIQUE INDEX uq_reference_document_versions_object
    ON reference_document_versions (file_storage_provider, file_key);

CREATE INDEX idx_reference_document_versions_document_status
    ON reference_document_versions (document_id, status);

CREATE INDEX idx_reference_document_versions_status
    ON reference_document_versions (status);

CREATE INDEX idx_reference_document_versions_extraction
    ON reference_document_versions (extraction_execution_id)
    WHERE extraction_execution_id IS NOT NULL;

CREATE TRIGGER trg_reference_document_versions_updated_at
    BEFORE UPDATE ON reference_document_versions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- The reverse half of the extraction link, now that the target table exists.
ALTER TABLE agent_executions
    ADD CONSTRAINT agent_executions_reference_document_version_fkey
    FOREIGN KEY (reference_document_version_id)
    REFERENCES reference_document_versions (id) ON DELETE RESTRICT;


-- -----------------------------------------------------------------------------
-- 3. reference_chunks
-- -----------------------------------------------------------------------------
-- No vector column: pgvector or an external vector store is not an approved
-- decision. embedding_ref is an opaque pointer either way.

CREATE TABLE reference_chunks (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id UUID NOT NULL
                          REFERENCES reference_document_versions (id) ON DELETE RESTRICT,
    chunk_index        INTEGER NOT NULL,
    heading            VARCHAR(300) NULL,
    content            TEXT NOT NULL,
    token_count        INTEGER NULL,
    page_from          INTEGER NULL,
    page_to            INTEGER NULL,
    content_hash       CHAR(64) NOT NULL,
    embedding_provider VARCHAR(50) NULL,
    embedding_model    VARCHAR(100) NULL,
    embedding_ref      VARCHAR(255) NULL,
    embedding_status   VARCHAR(20) NOT NULL DEFAULT 'pending',
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT reference_chunks_index_check
        CHECK (chunk_index >= 0),

    CONSTRAINT reference_chunks_content_check
        CHECK (char_length(content) > 0),

    CONSTRAINT reference_chunks_token_check
        CHECK (token_count IS NULL OR token_count > 0),

    CONSTRAINT reference_chunks_pages_check
        CHECK (page_from IS NULL OR page_from > 0),

    CONSTRAINT reference_chunks_page_order_check
        CHECK (page_to IS NULL OR page_from IS NULL OR page_to >= page_from),

    CONSTRAINT reference_chunks_hash_check
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT reference_chunks_embedding_status_check
        CHECK (embedding_status IN ('pending', 'indexed', 'failed', 'stale'))
);

COMMENT ON TABLE reference_chunks IS
    'Retrieval unit derived from an approved document version. Citations point here, never at a whole document.';

CREATE UNIQUE INDEX uq_reference_chunks_version_index
    ON reference_chunks (document_version_id, chunk_index);

CREATE INDEX idx_reference_chunks_version_embedding
    ON reference_chunks (document_version_id, embedding_status);

CREATE TRIGGER trg_reference_chunks_updated_at
    BEFORE UPDATE ON reference_chunks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. rag_queries
-- -----------------------------------------------------------------------------
-- Clinician questions answered from the reference knowledge base. Patient
-- identifiers must not be persisted here; the reference workflow stays separate
-- from the medical record.

CREATE TABLE rag_queries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asked_by_user_id  UUID NOT NULL
                        REFERENCES users (id) ON DELETE RESTRICT,
    question          TEXT NOT NULL,
    answer            TEXT NULL,
    answer_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    model_provider    VARCHAR(80) NULL,
    model_name        VARCHAR(120) NULL,
    model_version     VARCHAR(80) NULL,
    latency_ms        INTEGER NULL,
    prompt_tokens     INTEGER NULL,
    completion_tokens INTEGER NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ NULL,

    CONSTRAINT rag_queries_answer_status_check
        CHECK (answer_status IN ('pending', 'answered', 'insufficient_evidence', 'failed')),

    -- An answered question must actually have an answer.
    CONSTRAINT rag_queries_answer_check
        CHECK (answer_status <> 'answered' OR answer IS NOT NULL),

    CONSTRAINT rag_queries_question_check
        CHECK (char_length(btrim(question)) > 0),

    CONSTRAINT rag_queries_latency_check
        CHECK (latency_ms IS NULL OR latency_ms >= 0)
);

COMMENT ON TABLE rag_queries IS
    'A clinician question answered from the reference knowledge base with citations. Must not store patient identifiers or patient-specific documents.';

CREATE INDEX idx_rag_queries_user_created   ON rag_queries (asked_by_user_id, created_at DESC);
CREATE INDEX idx_rag_queries_status_created ON rag_queries (answer_status, created_at DESC);


-- -----------------------------------------------------------------------------
-- 5. rag_citations
-- -----------------------------------------------------------------------------

CREATE TABLE rag_citations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rag_query_id    UUID NOT NULL
                       REFERENCES rag_queries (id) ON DELETE CASCADE,
    chunk_id        UUID NOT NULL
                       REFERENCES reference_chunks (id) ON DELETE RESTRICT,
    rank            SMALLINT NOT NULL,
    relevance_score NUMERIC(6, 5) NULL,
    quoted_text     TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rag_citations_rank_check
        CHECK (rank > 0),

    CONSTRAINT rag_citations_score_check
        CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1))
);

COMMENT ON TABLE rag_citations IS
    'Evidence attached to a RAG answer. A missing citation means insufficient evidence, not permission to answer without evidence.';

CREATE UNIQUE INDEX uq_rag_citations_query_chunk ON rag_citations (rag_query_id, chunk_id);
CREATE UNIQUE INDEX uq_rag_citations_query_rank  ON rag_citations (rag_query_id, rank);

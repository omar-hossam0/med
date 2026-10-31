-- =============================================================================
-- Medora Healthcare — Migration 008: Consultations, Executions, Transcripts
-- =============================================================================
-- Contains simplification V2 consolidation 2 of 6:
--
--   transcript_approvals  ->  transcript_versions
--
-- A transcript version now carries its own doctor review decision
-- (review_decision / reviewed_by_user_id / reviewed_at / review_note).
-- The old table was never deployed, so no backfill or duplicate reconciliation
-- is required; see database/PREFLIGHT_REPORT_V2.md §6.
--
-- agent_executions is created here because transcript_versions records the
-- execution that generated it. Its extraction columns (consolidation 5) are
-- added in this same table definition — the old document_extraction_jobs table
-- is never created at all.
--
-- Creation order inside this file:
--   consultations -> consents -> recordings -> transcripts
--   -> agent_executions -> transcript_versions -> deferred FKs
--
-- Do NOT add BEGIN/COMMIT: the migration runner owns the transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. consultations
-- -----------------------------------------------------------------------------

CREATE TABLE consultations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID NOT NULL UNIQUE
                       REFERENCES appointments (id) ON DELETE RESTRICT,
    patient_user_id UUID NOT NULL
                       REFERENCES users (id) ON DELETE RESTRICT,
    doctor_user_id  UUID NOT NULL
                       REFERENCES users (id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    started_at      TIMESTAMPTZ NULL,
    ended_at        TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT consultations_status_check
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),

    CONSTRAINT consultations_range_check
        CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at > started_at),

    CONSTRAINT consultations_parties_check
        CHECK (patient_user_id <> doctor_user_id)
);

COMMENT ON TABLE consultations IS
    'Clinical encounter container. One per appointment. Only the assigned doctor and a patient with an active care relationship may access it.';
COMMENT ON COLUMN consultations.appointment_id IS
    'One consultation record per appointment (UNIQUE).';

CREATE INDEX idx_consultations_patient_created ON consultations (patient_user_id, created_at DESC);
CREATE INDEX idx_consultations_doctor_created  ON consultations (doctor_user_id, created_at DESC);
CREATE INDEX idx_consultations_appointment     ON consultations (appointment_id);

CREATE TRIGGER trg_consultations_updated_at
    BEFORE UPDATE ON consultations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. consultation_consents
-- -----------------------------------------------------------------------------
-- Recording must not start without a granted audio_recording consent.

CREATE TABLE consultation_consents (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id    UUID NOT NULL
                          REFERENCES consultations (id) ON DELETE RESTRICT,
    patient_user_id    UUID NOT NULL
                          REFERENCES users (id) ON DELETE RESTRICT,
    consent_type       VARCHAR(30) NOT NULL,
    status             VARCHAR(20) NOT NULL,
    method             VARCHAR(20) NOT NULL,
    recorded_by_user_id UUID NOT NULL
                          REFERENCES users (id) ON DELETE RESTRICT,
    granted_at         TIMESTAMPTZ NULL,
    revoked_at         TIMESTAMPTZ NULL,
    revocation_reason  VARCHAR(500) NULL,
    notes              TEXT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT consultation_consents_type_check
        CHECK (consent_type IN ('audio_recording', 'transcription', 'ai_assisted_documentation')),

    CONSTRAINT consultation_consents_status_check
        CHECK (status IN ('granted', 'declined', 'revoked')),

    CONSTRAINT consultation_consents_method_check
        CHECK (method IN ('in_person_verbal', 'patient_portal', 'written')),

    CONSTRAINT consultation_consents_granted_at_check
        CHECK (status = 'declined' OR granted_at IS NOT NULL),

    CONSTRAINT consultation_consents_revoked_at_check
        CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),

    CONSTRAINT consultation_consents_revocation_reason_check
        CHECK (revocation_reason IS NULL OR status = 'revoked')
);

COMMENT ON TABLE consultation_consents IS
    'Consent decision per consultation and scope. Audio capture is refused unless a granted audio_recording row exists.';

CREATE UNIQUE INDEX uq_consultation_consents_scope
    ON consultation_consents (consultation_id, consent_type);

CREATE INDEX idx_consultation_consents_patient
    ON consultation_consents (patient_user_id, consent_type);

CREATE TRIGGER trg_consultation_consents_updated_at
    BEFORE UPDATE ON consultation_consents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. consultation_recordings
-- -----------------------------------------------------------------------------
-- Audio metadata and an object reference, never audio bytes.

CREATE TABLE consultation_recordings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id     UUID NOT NULL
                           REFERENCES consultations (id) ON DELETE RESTRICT,
    consent_id          UUID NOT NULL
                           REFERENCES consultation_consents (id) ON DELETE RESTRICT,
    storage_provider    VARCHAR(50) NOT NULL,
    storage_key         TEXT NOT NULL,
    mime_type           VARCHAR(100) NOT NULL,
    size_bytes          BIGINT NULL,
    duration_seconds    INTEGER NULL,
    checksum_sha256     CHAR(64) NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending_upload',
    recorded_started_at TIMESTAMPTZ NULL,
    recorded_ended_at   TIMESTAMPTZ NULL,
    retention_expires_at TIMESTAMPTZ NULL,
    deleted_at          TIMESTAMPTZ NULL,
    created_by_user_id  UUID NOT NULL
                           REFERENCES users (id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT consultation_recordings_status_check
        CHECK (status IN ('pending_upload', 'uploaded', 'processing', 'available', 'failed', 'deleted')),

    CONSTRAINT consultation_recordings_range_check
        CHECK (recorded_ended_at IS NULL
               OR recorded_started_at IS NULL
               OR recorded_ended_at > recorded_started_at),

    CONSTRAINT consultation_recordings_size_check
        CHECK (size_bytes IS NULL OR size_bytes >= 0),

    CONSTRAINT consultation_recordings_duration_check
        CHECK (duration_seconds IS NULL OR duration_seconds > 0),

    CONSTRAINT consultation_recordings_deleted_at_check
        CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);

COMMENT ON TABLE consultation_recordings IS
    'Audio recording metadata for a consultation. Requires the granted audio_recording consent that authorised capture. Deletion is represented by status = deleted plus deleted_at, with audit.';

CREATE UNIQUE INDEX uq_consultation_recordings_object
    ON consultation_recordings (storage_provider, storage_key);

CREATE INDEX idx_consultation_recordings_consultation ON consultation_recordings (consultation_id);
CREATE INDEX idx_consultation_recordings_status       ON consultation_recordings (status);

CREATE TRIGGER trg_consultation_recordings_updated_at
    BEFORE UPDATE ON consultation_recordings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. transcripts
-- -----------------------------------------------------------------------------
-- The transcript document. status is a summary maintained by trigger from the
-- authoritative per-version review decision in transcript_versions.

CREATE TABLE transcripts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id   UUID NOT NULL
                         REFERENCES consultations (id) ON DELETE RESTRICT,
    recording_id      UUID NULL
                         REFERENCES consultation_recordings (id) ON DELETE RESTRICT,
    source            VARCHAR(20) NOT NULL,
    language          VARCHAR(16) NOT NULL DEFAULT 'en',
    status            VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_by_user_id UUID NULL
                         REFERENCES users (id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT transcripts_source_check
        CHECK (source IN ('speech_to_text', 'manual')),

    CONSTRAINT transcripts_status_check
        CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'superseded')),

    -- A machine transcript must name the recording it came from.
    CONSTRAINT transcripts_recording_required_check
        CHECK (source <> 'speech_to_text' OR recording_id IS NOT NULL)
);

COMMENT ON TABLE transcripts IS
    'Transcript document with immutable versions. status is a convenience summary maintained by trigger; the authoritative approval lives on transcript_versions.';

CREATE INDEX idx_transcripts_consultation ON transcripts (consultation_id);
CREATE INDEX idx_transcripts_recording    ON transcripts (recording_id) WHERE recording_id IS NOT NULL;
CREATE INDEX idx_transcripts_status       ON transcripts (status);

CREATE TRIGGER trg_transcripts_updated_at
    BEFORE UPDATE ON transcripts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. agent_executions — shared execution envelope (consolidation 5 of 6)
-- -----------------------------------------------------------------------------
-- Absorbs document_extraction_jobs. One envelope now tracks speech-to-text,
-- Agent 1, Agent 2, Agent 3, OCR and digital text extraction.
--
-- Extraction-specific needs are met without a wall of nullable columns:
--   * the source document version is a typed FK (reference_document_version_id),
--     not a JSON pointer, because ingestion must join on it;
--   * engine / engine_version are typed because they are queried for provenance
--     and quality triage;
--   * retries already existed (attempt_number + retry_of_execution_id);
--   * output_hash and output_character_count replace the old output_checksum
--     and output_character_count;
--   * anything else extraction-specific (page counts, quality scores) belongs in
--     metadata, and the quality gate itself lives on
--     reference_document_versions.quality_reviewed_* / approved_*.
--
-- The reference knowledge base stays separate from patient records: an
-- extraction execution is forbidden from carrying patient_user_id (CHECK below).

CREATE TABLE agent_executions (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_code                    VARCHAR(40) NOT NULL,
    status                        VARCHAR(20) NOT NULL DEFAULT 'queued',

    -- Patient-linked executions. NULL for reference-document extraction.
    patient_user_id               UUID NULL
                                     REFERENCES users (id) ON DELETE RESTRICT,
    consultation_id               UUID NULL
                                     REFERENCES consultations (id) ON DELETE RESTRICT,
    source_transcript_version_id  UUID NULL,  -- FK added after transcript_versions
    source_report_version_id      UUID NULL,  -- FK added in migration 009

    -- Reference-document extraction (consolidation 5).
    reference_document_version_id UUID NULL,  -- FK added in migration 012
    engine                        VARCHAR(80) NULL,
    engine_version                VARCHAR(50) NULL,
    output_character_count        INTEGER NULL,

    requested_by_user_id          UUID NULL
                                     REFERENCES users (id) ON DELETE SET NULL,
    idempotency_key               VARCHAR(150) NOT NULL,
    attempt_number                INTEGER NOT NULL DEFAULT 1,
    retry_of_execution_id         UUID NULL
                                     REFERENCES agent_executions (id) ON DELETE SET NULL,

    model_provider                VARCHAR(80) NULL,
    model_name                    VARCHAR(120) NULL,
    model_version                 VARCHAR(80) NULL,
    prompt_version                VARCHAR(50) NULL,
    input_hash                    CHAR(64) NULL,
    output_hash                   CHAR(64) NULL,
    started_at                    TIMESTAMPTZ NULL,
    completed_at                  TIMESTAMPTZ NULL,
    error_code                    VARCHAR(80) NULL,
    error_message                 TEXT NULL,
    metadata                      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT agent_executions_agent_code_check
        CHECK (agent_code IN (
            'speech_to_text',
            'agent_1_report_generation',
            'agent_2_profile_organization',
            'agent_3_follow_up_scheduling',
            'ocr_extraction',
            'digital_text_extraction'
        )),

    CONSTRAINT agent_executions_status_check
        CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),

    CONSTRAINT agent_executions_attempt_check
        CHECK (attempt_number > 0),

    CONSTRAINT agent_executions_timing_check
        CHECK (completed_at IS NULL
               OR started_at IS NULL
               OR completed_at >= started_at),

    -- Extraction family: reference document version and engine are mandatory,
    -- and a reference extraction may never be attached to a patient.
    CONSTRAINT agent_executions_extraction_source_check
        CHECK ((agent_code IN ('ocr_extraction', 'digital_text_extraction'))
               = (reference_document_version_id IS NOT NULL)),

    CONSTRAINT agent_executions_extraction_engine_check
        CHECK (agent_code NOT IN ('ocr_extraction', 'digital_text_extraction')
               OR engine IS NOT NULL),

    CONSTRAINT agent_executions_extraction_no_patient_check
        CHECK (agent_code NOT IN ('ocr_extraction', 'digital_text_extraction')
               OR patient_user_id IS NULL),

    CONSTRAINT agent_executions_extraction_no_consultation_check
        CHECK (agent_code NOT IN ('ocr_extraction', 'digital_text_extraction')
               OR consultation_id IS NULL),

    -- Clinical agents always belong to a consultation.
    CONSTRAINT agent_executions_consultation_required_check
        CHECK (agent_code IN ('ocr_extraction', 'digital_text_extraction')
               OR consultation_id IS NOT NULL),

    -- Agent-specific inputs.
    CONSTRAINT agent_executions_agent_1_input_check
        CHECK (agent_code <> 'agent_1_report_generation'
               OR source_transcript_version_id IS NOT NULL),

    CONSTRAINT agent_executions_agent_2_input_check
        CHECK (agent_code <> 'agent_2_profile_organization'
               OR source_report_version_id IS NOT NULL),

    CONSTRAINT agent_executions_output_count_check
        CHECK (output_character_count IS NULL OR output_character_count >= 0),

    CONSTRAINT agent_executions_error_pair_check
        CHECK (status <> 'failed' OR error_code IS NOT NULL)
);

COMMENT ON TABLE agent_executions IS
    'Shared execution envelope for internal AI services and document extraction. Not a human role. Absorbs the proposed document_extraction_jobs table.';
COMMENT ON COLUMN agent_executions.agent_code IS
    'speech_to_text | agent_1_report_generation | agent_2_profile_organization | agent_3_follow_up_scheduling | ocr_extraction | digital_text_extraction.';
COMMENT ON COLUMN agent_executions.reference_document_version_id IS
    'Reference knowledge-base document version being extracted. Never a patient document.';
COMMENT ON COLUMN agent_executions.output_character_count IS
    'Length of the extracted text produced by an extraction execution.';
COMMENT ON COLUMN agent_executions.metadata IS
    'Non-clinical execution metadata only. Never store prompts containing patient narratives or extracted document text here.';

-- Retries are new attempts under the same logical key.
CREATE UNIQUE INDEX uq_agent_executions_idempotency
    ON agent_executions (agent_code, idempotency_key, attempt_number);

CREATE INDEX idx_agent_executions_status
    ON agent_executions (status);

CREATE INDEX idx_agent_executions_patient_created
    ON agent_executions (patient_user_id, created_at DESC)
    WHERE patient_user_id IS NOT NULL;

CREATE INDEX idx_agent_executions_consultation
    ON agent_executions (consultation_id)
    WHERE consultation_id IS NOT NULL;

CREATE INDEX idx_agent_executions_transcript
    ON agent_executions (source_transcript_version_id)
    WHERE source_transcript_version_id IS NOT NULL;

CREATE INDEX idx_agent_executions_report
    ON agent_executions (source_report_version_id)
    WHERE source_report_version_id IS NOT NULL;

-- The ingestion workflow's lookup: "which execution extracted this version?"
CREATE INDEX idx_agent_executions_reference_version
    ON agent_executions (reference_document_version_id, created_at DESC)
    WHERE reference_document_version_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 6. transcript_versions — immutable content + doctor review (consolidation 2)
-- -----------------------------------------------------------------------------

CREATE TABLE transcript_versions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id             UUID NOT NULL
                                 REFERENCES transcripts (id) ON DELETE RESTRICT,
    version_number            INTEGER NOT NULL,
    content                   TEXT NOT NULL,
    content_format            VARCHAR(20) NOT NULL DEFAULT 'plain_text',
    is_doctor_edited          BOOLEAN NOT NULL DEFAULT FALSE,
    generated_by_execution_id UUID NULL
                                 REFERENCES agent_executions (id) ON DELETE RESTRICT,
    edited_by_user_id         UUID NULL
                                 REFERENCES users (id) ON DELETE RESTRICT,
    content_hash              CHAR(64) NOT NULL,

    -- Doctor review decision. This replaces the retired transcript_approvals
    -- table: one decision per immutable version, on the version itself.
    review_decision           VARCHAR(20) NULL,
    reviewed_by_user_id       UUID NULL
                                 REFERENCES users (id) ON DELETE RESTRICT,
    reviewed_at               TIMESTAMPTZ NULL,
    review_note               TEXT NULL,

    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT transcript_versions_number_check
        CHECK (version_number > 0),

    CONSTRAINT transcript_versions_content_check
        CHECK (char_length(content) > 0),

    CONSTRAINT transcript_versions_content_format_check
        CHECK (content_format IN ('plain_text', 'json')),

    CONSTRAINT transcript_versions_hash_check
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),

    -- A doctor correction must be attributed to a doctor.
    CONSTRAINT transcript_versions_edited_by_check
        CHECK (is_doctor_edited = FALSE OR edited_by_user_id IS NOT NULL),

    CONSTRAINT transcript_versions_review_decision_check
        CHECK (review_decision IS NULL OR review_decision IN ('approved', 'rejected')),

    -- Decision, reviewer and timestamp exist together or not at all.
    CONSTRAINT transcript_versions_review_pair_check
        CHECK ((review_decision IS NULL) = (reviewed_by_user_id IS NULL)),

    CONSTRAINT transcript_versions_reviewed_at_check
        CHECK ((review_decision IS NULL) = (reviewed_at IS NULL)),

    CONSTRAINT transcript_versions_review_note_check
        CHECK (review_note IS NULL OR review_decision IS NOT NULL)
);

COMMENT ON TABLE transcript_versions IS
    'Append-only transcript content with its doctor review decision. A correction creates a new version; an approved version is never mutated. Replaces the proposed transcript_approvals table.';
COMMENT ON COLUMN transcript_versions.review_decision IS
    'NULL = awaiting review. approved = released to Agent 1. rejected = kept for audit, never consumed.';
COMMENT ON COLUMN transcript_versions.reviewed_by_user_id IS
    'Doctor who decided. Validated by trigger: must hold the doctor role and be authorised for the consultation.';
COMMENT ON COLUMN transcript_versions.content_hash IS
    'SHA-256 of the canonical content, for integrity checks.';

CREATE UNIQUE INDEX uq_transcript_versions_number
    ON transcript_versions (transcript_id, version_number);

CREATE INDEX idx_transcript_versions_execution
    ON transcript_versions (generated_by_execution_id)
    WHERE generated_by_execution_id IS NOT NULL;

-- The review queue: versions still waiting for a doctor.
CREATE INDEX idx_transcript_versions_pending_review
    ON transcript_versions (transcript_id)
    WHERE review_decision IS NULL;

-- Agent 1's input lookup: approved versions only.
CREATE INDEX idx_transcript_versions_approved
    ON transcript_versions (transcript_id, version_number)
    WHERE review_decision = 'approved';

CREATE INDEX idx_transcript_versions_reviewer
    ON transcript_versions (reviewed_by_user_id, reviewed_at DESC)
    WHERE reviewed_by_user_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 7. Deferred foreign keys (cycles resolved after both tables exist)
-- -----------------------------------------------------------------------------

ALTER TABLE agent_executions
    ADD CONSTRAINT agent_executions_source_transcript_version_fkey
    FOREIGN KEY (source_transcript_version_id)
    REFERENCES transcript_versions (id) ON DELETE RESTRICT;


-- -----------------------------------------------------------------------------
-- 8. Immutability: shared by transcript_versions and report_versions
-- -----------------------------------------------------------------------------
-- A reviewed version is frozen. An unreviewed version may receive its review
-- decision, and nothing else — a correction is a new version, never an edit.
-- One function serves both version tables so the rule cannot drift.

CREATE OR REPLACE FUNCTION enforce_reviewed_version_immutability()
RETURNS TRIGGER AS $$
DECLARE
    review_columns TEXT[] := ARRAY[
        'review_decision', 'reviewed_by_user_id', 'reviewed_at', 'review_note'
    ];
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION '% is append-only: version % cannot be deleted',
            TG_TABLE_NAME, OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF OLD.review_decision IS NOT NULL THEN
        RAISE EXCEPTION '% version % is already reviewed and is immutable; create a new version instead',
            TG_TABLE_NAME, OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF (to_jsonb(NEW) - review_columns) IS DISTINCT FROM (to_jsonb(OLD) - review_columns) THEN
        RAISE EXCEPTION '% content is immutable: only the review columns of version % may change',
            TG_TABLE_NAME, OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_reviewed_version_immutability() IS
    'BEFORE UPDATE OR DELETE on *_versions: refuses deletes, freezes reviewed rows, and allows only review columns to change on an unreviewed row.';

CREATE TRIGGER trg_transcript_versions_immutable
    BEFORE UPDATE OR DELETE ON transcript_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_reviewed_version_immutability();


-- -----------------------------------------------------------------------------
-- 9. Doctor-only, consultation-scoped review
-- -----------------------------------------------------------------------------
-- "Only a doctor authorised for the consultation may approve" is enforced in
-- the database, not only in the service. Staff, Admin and AI services cannot
-- produce a decision.

CREATE OR REPLACE FUNCTION enforce_transcript_reviewer()
RETURNS TRIGGER AS $$
DECLARE
    v_doctor  UUID;
    v_patient UUID;
    v_is_doctor BOOLEAN;
    v_authorised BOOLEAN;
BEGIN
    IF NEW.review_decision IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT c.doctor_user_id, c.patient_user_id
      INTO v_doctor, v_patient
      FROM transcripts AS t
      JOIN consultations AS c ON c.id = t.consultation_id
     WHERE t.id = NEW.transcript_id;

    SELECT EXISTS (
        SELECT 1
          FROM user_roles AS ur
          JOIN roles AS r ON r.id = ur.role_id
         WHERE ur.user_id = NEW.reviewed_by_user_id
           AND r.name = 'doctor'
    ) INTO v_is_doctor;

    IF NOT v_is_doctor THEN
        RAISE EXCEPTION 'transcript version % can only be reviewed by a user holding the doctor role', NEW.id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.reviewed_by_user_id IS DISTINCT FROM v_doctor THEN
        SELECT EXISTS (
            SELECT 1
              FROM care_relationships AS cr
             WHERE cr.patient_user_id = v_patient
               AND cr.doctor_user_id  = NEW.reviewed_by_user_id
               AND cr.status = 'active'
               AND (cr.expires_at IS NULL OR cr.expires_at > now())
        ) INTO v_authorised;

        IF NOT v_authorised THEN
            RAISE EXCEPTION 'doctor % is not authorised for consultation of transcript version %',
                NEW.reviewed_by_user_id, NEW.id
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    -- Default the decision timestamp so a caller cannot record a decision
    -- without one (the CHECK constraint requires the pair anyway).
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_transcript_reviewer() IS
    'BEFORE INSERT OR UPDATE on transcript_versions: a review decision requires the doctor role and authorisation for the consultation.';

CREATE TRIGGER trg_transcript_versions_reviewer
    BEFORE INSERT OR UPDATE ON transcript_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_transcript_reviewer();


-- -----------------------------------------------------------------------------
-- 10. Keep transcripts.status consistent with the version decisions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_transcript_status()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR(20);
    v_other_reviewed BOOLEAN;
BEGIN
    IF NEW.review_decision = 'approved' THEN
        v_status := 'approved';
    ELSIF NEW.review_decision = 'rejected' THEN
        v_status := 'rejected';
    ELSE
        SELECT EXISTS (
            SELECT 1
              FROM transcript_versions AS tv
             WHERE tv.transcript_id = NEW.transcript_id
               AND tv.id <> NEW.id
               AND tv.review_decision IS NOT NULL
        ) INTO v_other_reviewed;

        v_status := CASE WHEN v_other_reviewed THEN 'in_review' ELSE 'draft' END;
    END IF;

    UPDATE transcripts
       SET status = v_status,
           updated_at = now()
     WHERE id = NEW.transcript_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_transcript_status() IS
    'AFTER INSERT OR UPDATE OF review_decision on transcript_versions: maintains the transcripts.status summary.';

CREATE TRIGGER trg_transcript_versions_sync_status
    AFTER INSERT OR UPDATE OF review_decision ON transcript_versions
    FOR EACH ROW EXECUTE FUNCTION sync_transcript_status();

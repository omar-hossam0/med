-- =============================================================================
-- Medora Healthcare — Migration 009: Reports, Versions, Agent 2 Proposals
-- =============================================================================
-- Contains simplification V2 consolidations 3 and 4 of 6:
--
--   report_approvals  ->  report_versions
--   report_deliveries ->  medical_reports
--
-- Consolidation 4 is only safe because the MVP delivers an approved Report 1 by
-- publishing it inside the authenticated Patient Portal. The proposed
-- report_deliveries table modelled channels (patient_portal | email), repeat
-- attempts, per-channel receipts and revocation — a shape this product does not
-- have and never deployed. Publication state, version, timestamp and actor are
-- therefore typed columns on medical_reports, and email/WhatsApp delivery, if it
-- is ever approved, needs a new table of its own rather than a resurrected one.
-- See database/DATABASE_ARCHITECTURE_V2.md §"الدمج الرابع".
--
-- Creation order inside this file:
--   medical_reports (without the published_version FK)
--   -> report_versions -> record_update_proposals
--   -> deferred FKs -> integrity functions and triggers
--
-- Do NOT add BEGIN/COMMIT: the migration runner owns the transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. medical_reports — one document per type per consultation (consolidation 4)
-- -----------------------------------------------------------------------------
-- Agent 1 produces exactly three typed documents. Report 1 is the only type
-- with a patient-visible path; Report 3's destination remains unresolved, so it
-- deliberately has no publication path at all.

CREATE TABLE medical_reports (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id       UUID NOT NULL
                             REFERENCES consultations (id) ON DELETE RESTRICT,
    patient_user_id       UUID NOT NULL
                             REFERENCES users (id) ON DELETE RESTRICT,
    doctor_user_id        UUID NOT NULL
                             REFERENCES users (id) ON DELETE RESTRICT,
    report_type           VARCHAR(40) NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'draft',

    -- Portal publication (consolidation 4). Absorbs report_deliveries.
    publication_state     VARCHAR(20) NOT NULL DEFAULT 'unpublished',
    published_version_id  UUID NULL,  -- FK added after report_versions exists
    published_at          TIMESTAMPTZ NULL,
    published_by_user_id  UUID NULL
                             REFERENCES users (id) ON DELETE RESTRICT,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT medical_reports_type_check
        CHECK (report_type IN (
            'report_1_patient_summary',
            'report_2_structured_profile',
            'report_3_medical_report'
        )),

    CONSTRAINT medical_reports_status_check
        CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'superseded', 'released')),

    CONSTRAINT medical_reports_publication_state_check
        CHECK (publication_state IN ('unpublished', 'published', 'withdrawn')),

    -- Publication columns exist together or not at all.
    CONSTRAINT medical_reports_published_version_check
        CHECK ((publication_state = 'unpublished') = (published_version_id IS NULL)),

    CONSTRAINT medical_reports_published_at_check
        CHECK ((publication_state = 'unpublished') = (published_at IS NULL)),

    CONSTRAINT medical_reports_published_by_check
        CHECK ((publication_state = 'unpublished') = (published_by_user_id IS NULL)),

    -- Only the patient-friendly summary is patient-visible. Report 2 feeds
    -- Agent 2 and Report 3 is internal; neither may be published by accident.
    CONSTRAINT medical_reports_publication_type_check
        CHECK (publication_state = 'unpublished'
               OR report_type = 'report_1_patient_summary')
);

COMMENT ON TABLE medical_reports IS
    'One report document per type per consultation. Absorbs the proposed report_deliveries table: the MVP publishes approved Report 1 inside the authenticated patient portal.';
COMMENT ON COLUMN medical_reports.report_type IS
    'report_1_patient_summary | report_2_structured_profile | report_3_medical_report.';
COMMENT ON COLUMN medical_reports.publication_state IS
    'unpublished | published | withdrawn. Only report_1_patient_summary may leave unpublished.';
COMMENT ON COLUMN medical_reports.published_version_id IS
    'The exact doctor-approved Report 1 version the patient can read. Validated by trigger.';
COMMENT ON COLUMN medical_reports.status IS
    'Summary maintained by trigger from report_versions.review_decision. Not authoritative on its own.';

CREATE UNIQUE INDEX uq_medical_reports_consultation_type
    ON medical_reports (consultation_id, report_type);

CREATE INDEX idx_medical_reports_patient_status
    ON medical_reports (patient_user_id, status);

CREATE INDEX idx_medical_reports_doctor_status
    ON medical_reports (doctor_user_id, status);

-- The patient portal's "my released reports" query.
CREATE INDEX idx_medical_reports_published
    ON medical_reports (patient_user_id, published_at DESC)
    WHERE publication_state = 'published';

CREATE TRIGGER trg_medical_reports_updated_at
    BEFORE UPDATE ON medical_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. report_versions — immutable content + doctor review (consolidation 3)
-- -----------------------------------------------------------------------------

CREATE TABLE report_versions (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                    UUID NOT NULL
                                    REFERENCES medical_reports (id) ON DELETE RESTRICT,
    version_number               INTEGER NOT NULL,
    content                      JSONB NOT NULL,
    content_schema_version       VARCHAR(20) NOT NULL DEFAULT 'v1',
    source_transcript_version_id UUID NOT NULL
                                    REFERENCES transcript_versions (id) ON DELETE RESTRICT,
    rendered_text                TEXT NULL,
    generated_by_execution_id    UUID NULL
                                    REFERENCES agent_executions (id) ON DELETE RESTRICT,
    edited_by_user_id            UUID NULL
                                    REFERENCES users (id) ON DELETE RESTRICT,
    content_hash                 CHAR(64) NOT NULL,

    -- Doctor review decision. Replaces the retired report_approvals table.
    review_decision              VARCHAR(20) NULL,
    reviewed_by_user_id          UUID NULL
                                    REFERENCES users (id) ON DELETE RESTRICT,
    reviewed_at                  TIMESTAMPTZ NULL,
    review_note                  TEXT NULL,

    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT report_versions_number_check
        CHECK (version_number > 0),

    CONSTRAINT report_versions_hash_check
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT report_versions_review_decision_check
        CHECK (review_decision IS NULL OR review_decision IN ('approved', 'rejected')),

    CONSTRAINT report_versions_review_pair_check
        CHECK ((review_decision IS NULL) = (reviewed_by_user_id IS NULL)),

    CONSTRAINT report_versions_reviewed_at_check
        CHECK ((review_decision IS NULL) = (reviewed_at IS NULL)),

    CONSTRAINT report_versions_review_note_check
        CHECK (review_note IS NULL OR review_decision IS NOT NULL)
);

COMMENT ON TABLE report_versions IS
    'Append-only report content with its doctor review decision. Replaces the proposed report_approvals table. AI output has no clinical authority until review_decision is set by a doctor.';
COMMENT ON COLUMN report_versions.source_transcript_version_id IS
    'The exact doctor-approved transcript version used to produce this version. Trigger-enforced as approved.';
COMMENT ON COLUMN report_versions.review_decision IS
    'NULL = awaiting review. approved = releasable (Report 1) or consumable (Report 2). rejected = kept for audit.';

CREATE UNIQUE INDEX uq_report_versions_number
    ON report_versions (report_id, version_number);

CREATE INDEX idx_report_versions_source_transcript
    ON report_versions (source_transcript_version_id);

CREATE INDEX idx_report_versions_execution
    ON report_versions (generated_by_execution_id)
    WHERE generated_by_execution_id IS NOT NULL;

CREATE INDEX idx_report_versions_pending_review
    ON report_versions (report_id)
    WHERE review_decision IS NULL;

CREATE INDEX idx_report_versions_approved
    ON report_versions (report_id, version_number)
    WHERE review_decision = 'approved';


-- -----------------------------------------------------------------------------
-- 3. record_update_proposals — Agent 2 output, doctor-gated
-- -----------------------------------------------------------------------------

CREATE TABLE record_update_proposals (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id          UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    agent_execution_id       UUID NOT NULL
                                REFERENCES agent_executions (id) ON DELETE RESTRICT,
    source_report_version_id UUID NOT NULL
                                REFERENCES report_versions (id) ON DELETE RESTRICT,
    target_entity_type       VARCHAR(40) NOT NULL,
    target_entity_id         UUID NULL,
    proposal_type            VARCHAR(20) NOT NULL,
    proposed_changes         JSONB NOT NULL,
    rationale                TEXT NULL,
    conflict_detected        BOOLEAN NOT NULL DEFAULT FALSE,
    conflict_details         JSONB NULL,
    status                   VARCHAR(20) NOT NULL DEFAULT 'proposed',
    reviewed_by_user_id      UUID NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    reviewed_at              TIMESTAMPTZ NULL,
    applied_at               TIMESTAMPTZ NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT record_update_proposals_target_check
        CHECK (target_entity_type IN (
            'medical_condition', 'patient_medication', 'patient_allergy',
            'medical_history_entry', 'test_order', 'test_result'
        )),

    CONSTRAINT record_update_proposals_type_check
        CHECK (proposal_type IN ('create', 'update', 'resolve', 'discontinue', 'correct')),

    CONSTRAINT record_update_proposals_status_check
        CHECK (status IN ('proposed', 'approved', 'rejected', 'applied', 'superseded')),

    -- Nothing beyond 'proposed' without a reviewer.
    CONSTRAINT record_update_proposals_reviewer_check
        CHECK (status = 'proposed' OR reviewed_by_user_id IS NOT NULL),

    CONSTRAINT record_update_proposals_reviewed_at_check
        CHECK ((reviewed_by_user_id IS NULL) = (reviewed_at IS NULL)),

    CONSTRAINT record_update_proposals_applied_at_check
        CHECK ((status = 'applied') = (applied_at IS NOT NULL)),

    CONSTRAINT record_update_proposals_conflict_check
        CHECK (conflict_detected = FALSE OR conflict_details IS NOT NULL),

    -- An update or correction proposal must name its target.
    CONSTRAINT record_update_proposals_target_required_check
        CHECK (proposal_type = 'create' OR target_entity_id IS NOT NULL)
);

COMMENT ON TABLE record_update_proposals IS
    'Agent 2 proposes a longitudinal-record change; a doctor reviews and approves; only then may the service apply it. Never a silent overwrite.';
COMMENT ON COLUMN record_update_proposals.target_entity_id IS
    'Polymorphic reference to one of the six medical-record tables, validated by the service in the apply transaction.';

CREATE INDEX idx_record_update_proposals_patient_status
    ON record_update_proposals (patient_user_id, status, created_at DESC);

CREATE INDEX idx_record_update_proposals_execution
    ON record_update_proposals (agent_execution_id);

CREATE INDEX idx_record_update_proposals_source_version
    ON record_update_proposals (source_report_version_id);

CREATE INDEX idx_record_update_proposals_target
    ON record_update_proposals (target_entity_type, target_entity_id);

-- The doctor's review queue.
CREATE INDEX idx_record_update_proposals_pending
    ON record_update_proposals (patient_user_id, created_at DESC)
    WHERE status = 'proposed';

CREATE TRIGGER trg_record_update_proposals_updated_at
    BEFORE UPDATE ON record_update_proposals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Deferred foreign keys
-- -----------------------------------------------------------------------------

ALTER TABLE medical_reports
    ADD CONSTRAINT medical_reports_published_version_fkey
    FOREIGN KEY (published_version_id)
    REFERENCES report_versions (id) ON DELETE RESTRICT;

ALTER TABLE agent_executions
    ADD CONSTRAINT agent_executions_source_report_version_fkey
    FOREIGN KEY (source_report_version_id)
    REFERENCES report_versions (id) ON DELETE RESTRICT;


-- -----------------------------------------------------------------------------
-- 5. "Only a doctor-approved version may be consumed" — shared assertions
-- -----------------------------------------------------------------------------
-- Agent 1 may not read an unreviewed transcript, and Agent 2 may not read an
-- unreviewed Report 2. Both rules live in the database so a service bug cannot
-- bypass them.

CREATE OR REPLACE FUNCTION assert_transcript_version_approved(
    p_version_id UUID,
    p_context    TEXT
)
RETURNS VOID AS $$
DECLARE
    v_decision VARCHAR(20);
BEGIN
    SELECT review_decision INTO v_decision
      FROM transcript_versions
     WHERE id = p_version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '%: transcript version % does not exist', p_context, p_version_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_decision IS NULL THEN
        RAISE EXCEPTION '%: transcript version % has not been reviewed by a doctor', p_context, p_version_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_decision <> 'approved' THEN
        RAISE EXCEPTION '%: transcript version % was %, not approved', p_context, p_version_id, v_decision
            USING ERRCODE = 'check_violation';
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION assert_transcript_version_approved(UUID, TEXT) IS
    'Raises unless the transcript version carries a doctor approval decision. Used by report_versions and agent_executions.';

CREATE OR REPLACE FUNCTION assert_report_version_approved(
    p_version_id UUID,
    p_context    TEXT
)
RETURNS VOID AS $$
DECLARE
    v_decision VARCHAR(20);
BEGIN
    SELECT review_decision INTO v_decision
      FROM report_versions
     WHERE id = p_version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '%: report version % does not exist', p_context, p_version_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_decision IS NULL THEN
        RAISE EXCEPTION '%: report version % has not been reviewed by a doctor', p_context, p_version_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_decision <> 'approved' THEN
        RAISE EXCEPTION '%: report version % was %, not approved', p_context, p_version_id, v_decision
            USING ERRCODE = 'check_violation';
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION assert_report_version_approved(UUID, TEXT) IS
    'Raises unless the report version carries a doctor approval decision. Used by Agent 2 executions.';


-- Agent input gate. Installed here, after both source tables exist.
CREATE OR REPLACE FUNCTION enforce_agent_execution_inputs()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.agent_code = 'agent_1_report_generation' THEN
        PERFORM assert_transcript_version_approved(
            NEW.source_transcript_version_id, 'agent_executions/agent_1');
    ELSIF NEW.agent_code = 'agent_2_profile_organization' THEN
        PERFORM assert_report_version_approved(
            NEW.source_report_version_id, 'agent_executions/agent_2');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_agent_execution_inputs() IS
    'BEFORE INSERT OR UPDATE on agent_executions: Agent 1 requires an approved transcript version, Agent 2 an approved report version.';

CREATE TRIGGER trg_agent_executions_inputs
    BEFORE INSERT OR UPDATE ON agent_executions
    FOR EACH ROW EXECUTE FUNCTION enforce_agent_execution_inputs();


-- -----------------------------------------------------------------------------
-- 6. report_versions integrity
-- -----------------------------------------------------------------------------

CREATE TRIGGER trg_report_versions_immutable
    BEFORE UPDATE OR DELETE ON report_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_reviewed_version_immutability();

-- A report version may only be produced from an approved transcript version.
CREATE OR REPLACE FUNCTION enforce_report_source_transcript()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM assert_transcript_version_approved(
        NEW.source_transcript_version_id, 'report_versions');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_versions_source_transcript
    BEFORE INSERT OR UPDATE OF source_transcript_version_id ON report_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_report_source_transcript();

-- Only the consultation's doctor (or a doctor with an active care
-- relationship) may decide on a report version.
CREATE OR REPLACE FUNCTION enforce_report_reviewer()
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

    SELECT mr.doctor_user_id, mr.patient_user_id
      INTO v_doctor, v_patient
      FROM medical_reports AS mr
     WHERE mr.id = NEW.report_id;

    SELECT EXISTS (
        SELECT 1
          FROM user_roles AS ur
          JOIN roles AS r ON r.id = ur.role_id
         WHERE ur.user_id = NEW.reviewed_by_user_id
           AND r.name = 'doctor'
    ) INTO v_is_doctor;

    IF NOT v_is_doctor THEN
        RAISE EXCEPTION 'report version % can only be reviewed by a user holding the doctor role', NEW.id
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
            RAISE EXCEPTION 'doctor % is not authorised for report version %',
                NEW.reviewed_by_user_id, NEW.id
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_versions_reviewer
    BEFORE INSERT OR UPDATE ON report_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_report_reviewer();

-- Keep medical_reports.status in step with the latest decision.
CREATE OR REPLACE FUNCTION sync_medical_report_status()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    IF NEW.review_decision = 'approved' THEN
        v_status := 'approved';
    ELSIF NEW.review_decision = 'rejected' THEN
        v_status := 'rejected';
    ELSE
        v_status := 'in_review';
    END IF;

    UPDATE medical_reports
       SET status = v_status,
           updated_at = now()
     WHERE id = NEW.report_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_versions_sync_status
    AFTER INSERT OR UPDATE OF review_decision ON report_versions
    FOR EACH ROW EXECUTE FUNCTION sync_medical_report_status();


-- -----------------------------------------------------------------------------
-- 7. Publication gate (consolidation 4)
-- -----------------------------------------------------------------------------
-- Publishing is the only patient-visible path, so it is guarded in the
-- database: the version must belong to the report, must be doctor-approved,
-- must be a Report 1, and publication cannot be silently undone.

CREATE OR REPLACE FUNCTION enforce_report_publication()
RETURNS TRIGGER AS $$
DECLARE
    v_report_id UUID;
    v_decision  VARCHAR(20);
BEGIN
    IF NEW.publication_state = 'unpublished' THEN
        IF TG_OP = 'UPDATE' AND OLD.publication_state <> 'unpublished' THEN
            RAISE EXCEPTION 'report % has been published; withdraw it instead of returning it to unpublished', NEW.id
                USING ERRCODE = 'restrict_violation';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.report_type <> 'report_1_patient_summary' THEN
        RAISE EXCEPTION 'only report_1_patient_summary may be published to the patient portal (report % is %)',
            NEW.id, NEW.report_type
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT rv.report_id, rv.review_decision
      INTO v_report_id, v_decision
      FROM report_versions AS rv
     WHERE rv.id = NEW.published_version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'published_version_id % does not exist', NEW.published_version_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_report_id <> NEW.id THEN
        RAISE EXCEPTION 'report version % does not belong to report %', NEW.published_version_id, NEW.id
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_decision IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'report version % is not doctor-approved and cannot be published', NEW.published_version_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_report_publication() IS
    'BEFORE INSERT OR UPDATE on medical_reports: only a doctor-approved Report 1 version of the same report may be published, and publication cannot be reverted to unpublished.';

CREATE TRIGGER trg_medical_reports_publication
    BEFORE INSERT OR UPDATE ON medical_reports
    FOR EACH ROW EXECUTE FUNCTION enforce_report_publication();

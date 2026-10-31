-- =============================================================================
-- Medora Healthcare — Migration 011: Longitudinal Medical Record
-- =============================================================================
-- Six separate clinical fact tables, kept separate on purpose: a condition is
-- not a medication, an allergy is not a history entry, and an ordered test is
-- not a result. No consolidation touches this module.
--
-- Every table carries the same provenance contract:
--   source_type               patient_reported | doctor_entered | agent_2_derived | imported
--   source_report_version_id  the approved report that originated the fact
--   source_proposal_id        the approved Agent 2 proposal, when applicable
--   superseded_by_id          correction chain; prior rows are retained
--
-- A trigger enforces that an Agent 2 derived fact cannot be written without an
-- approved proposal, and that a cited report version is doctor-approved. That is
-- the database half of "Agent 2 must not silently overwrite clinical records".
--
-- Do NOT add BEGIN/COMMIT: the migration runner owns the transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Provenance gate, shared by all six tables
-- -----------------------------------------------------------------------------
-- Installed once and attached with a different entity name per table. It
-- refuses:
--   * an agent_2_derived row with no proposal behind it;
--   * a proposal that is not approved or applied;
--   * a proposal that targets a different entity type;
--   * a proposal that belongs to a different patient;
--   * a citation of a report version that is not doctor-approved.
-- test_results has no patient_user_id of its own, so the patient is resolved
-- through its test_order.

CREATE OR REPLACE FUNCTION enforce_medical_record_provenance()
RETURNS TRIGGER AS $$
DECLARE
    v_entity  TEXT := TG_ARGV[0];
    v_patient UUID;
    v_proposal RECORD;
BEGIN
    IF TG_TABLE_NAME = 'test_results' THEN
        SELECT patient_user_id INTO v_patient
          FROM test_orders
         WHERE id = NEW.test_order_id;
    ELSE
        v_patient := NEW.patient_user_id;
    END IF;

    IF NEW.source_report_version_id IS NOT NULL THEN
        PERFORM assert_report_version_approved(NEW.source_report_version_id, TG_TABLE_NAME);
    END IF;

    IF NEW.source_type = 'agent_2_derived' AND NEW.source_proposal_id IS NULL THEN
        RAISE EXCEPTION '%: an agent_2_derived row requires an approved record_update_proposals row',
            TG_TABLE_NAME
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.source_proposal_id IS NOT NULL THEN
        SELECT * INTO v_proposal
          FROM record_update_proposals
         WHERE id = NEW.source_proposal_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION '%: proposal % does not exist', TG_TABLE_NAME, NEW.source_proposal_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF v_proposal.status NOT IN ('approved', 'applied') THEN
            RAISE EXCEPTION '%: proposal % is %, not approved', TG_TABLE_NAME, NEW.source_proposal_id, v_proposal.status
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_proposal.target_entity_type <> v_entity THEN
            RAISE EXCEPTION '%: proposal % targets %, not %', TG_TABLE_NAME, NEW.source_proposal_id, v_proposal.target_entity_type, v_entity
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_proposal.patient_user_id <> v_patient THEN
            RAISE EXCEPTION '%: proposal % belongs to another patient', TG_TABLE_NAME, NEW.source_proposal_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_medical_record_provenance() IS
    'BEFORE INSERT OR UPDATE on the six medical-record tables: requires an approved Agent 2 proposal for derived facts and a doctor-approved report version for any citation.';


-- -----------------------------------------------------------------------------
-- 1. medical_conditions
-- -----------------------------------------------------------------------------

CREATE TABLE medical_conditions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id          UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    condition_name           VARCHAR(200) NOT NULL,
    condition_code           VARCHAR(32) NULL,
    coding_system            VARCHAR(30) NULL,
    clinical_status          VARCHAR(20) NOT NULL DEFAULT 'active',
    onset_date               DATE NULL,
    resolved_date            DATE NULL,
    severity                 VARCHAR(20) NULL,
    source_type              VARCHAR(30) NOT NULL DEFAULT 'doctor_entered',
    source_report_version_id UUID NULL
                                REFERENCES report_versions (id) ON DELETE RESTRICT,
    source_proposal_id       UUID NULL
                                REFERENCES record_update_proposals (id) ON DELETE RESTRICT,
    created_by_user_id       UUID NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    recorded_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_by_id         UUID NULL
                                REFERENCES medical_conditions (id) ON DELETE RESTRICT,

    CONSTRAINT medical_conditions_status_check
        CHECK (clinical_status IN ('active', 'resolved', 'in_remission', 'suspected', 'entered_in_error')),

    CONSTRAINT medical_conditions_severity_check
        CHECK (severity IS NULL OR severity IN ('mild', 'moderate', 'severe', 'unknown')),

    CONSTRAINT medical_conditions_coding_check
        CHECK (coding_system IS NULL OR condition_code IS NOT NULL),

    CONSTRAINT medical_conditions_coding_system_check
        CHECK (coding_system IS NULL OR coding_system IN ('icd_10', 'icd_11', 'snomed', 'local')),

    CONSTRAINT medical_conditions_dates_check
        CHECK (resolved_date IS NULL OR onset_date IS NULL OR resolved_date >= onset_date),

    CONSTRAINT medical_conditions_source_type_check
        CHECK (source_type IN ('patient_reported', 'doctor_entered', 'agent_2_derived', 'imported')),

    CONSTRAINT medical_conditions_self_supersede_check
        CHECK (superseded_by_id IS NULL OR superseded_by_id <> id)
);

COMMENT ON TABLE medical_conditions IS
    'Longitudinal condition list. Corrections create a new row and set superseded_by_id on the old one; rows are never deleted.';

CREATE INDEX idx_medical_conditions_patient_status ON medical_conditions (patient_user_id, clinical_status);
CREATE INDEX idx_medical_conditions_patient_onset  ON medical_conditions (patient_user_id, onset_date);
CREATE INDEX idx_medical_conditions_source_version ON medical_conditions (source_report_version_id)
    WHERE source_report_version_id IS NOT NULL;

CREATE TRIGGER trg_medical_conditions_updated_at
    BEFORE UPDATE ON medical_conditions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_medical_conditions_provenance
    BEFORE INSERT OR UPDATE ON medical_conditions
    FOR EACH ROW EXECUTE FUNCTION enforce_medical_record_provenance('medical_condition');


-- -----------------------------------------------------------------------------
-- 2. patient_medications
-- -----------------------------------------------------------------------------

CREATE TABLE patient_medications (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id          UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    medication_name          VARCHAR(200) NOT NULL,
    medication_code          VARCHAR(32) NULL,
    coding_system            VARCHAR(30) NULL,
    dosage                   VARCHAR(100) NULL,
    frequency                VARCHAR(100) NULL,
    route                    VARCHAR(50) NULL,
    indication               VARCHAR(300) NULL,
    started_on               DATE NULL,
    ended_on                 DATE NULL,
    status                   VARCHAR(20) NOT NULL DEFAULT 'active',
    prescriber_user_id       UUID NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    source_type              VARCHAR(30) NOT NULL DEFAULT 'doctor_entered',
    source_report_version_id UUID NULL
                                REFERENCES report_versions (id) ON DELETE RESTRICT,
    source_proposal_id       UUID NULL
                                REFERENCES record_update_proposals (id) ON DELETE RESTRICT,
    created_by_user_id       UUID NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    recorded_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_by_id         UUID NULL
                                REFERENCES patient_medications (id) ON DELETE RESTRICT,

    CONSTRAINT patient_medications_status_check
        CHECK (status IN ('active', 'stopped', 'completed', 'on_hold', 'entered_in_error')),

    CONSTRAINT patient_medications_coding_check
        CHECK (coding_system IS NULL OR medication_code IS NOT NULL),

    CONSTRAINT patient_medications_coding_system_check
        CHECK (coding_system IS NULL OR coding_system IN ('rxnorm', 'atc', 'local')),

    CONSTRAINT patient_medications_dates_check
        CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on),

    CONSTRAINT patient_medications_source_type_check
        CHECK (source_type IN ('patient_reported', 'doctor_entered', 'agent_2_derived', 'imported')),

    CONSTRAINT patient_medications_self_supersede_check
        CHECK (superseded_by_id IS NULL OR superseded_by_id <> id)
);

COMMENT ON TABLE patient_medications IS
    'Medication list. Stopping a medication is a new corrected row with status and ended_on; the previous row is retained.';

CREATE INDEX idx_patient_medications_patient_status  ON patient_medications (patient_user_id, status);
CREATE INDEX idx_patient_medications_patient_started ON patient_medications (patient_user_id, started_on);
CREATE INDEX idx_patient_medications_source_version  ON patient_medications (source_report_version_id)
    WHERE source_report_version_id IS NOT NULL;

CREATE TRIGGER trg_patient_medications_updated_at
    BEFORE UPDATE ON patient_medications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_patient_medications_provenance
    BEFORE INSERT OR UPDATE ON patient_medications
    FOR EACH ROW EXECUTE FUNCTION enforce_medical_record_provenance('patient_medication');


-- -----------------------------------------------------------------------------
-- 3. patient_allergies
-- -----------------------------------------------------------------------------

CREATE TABLE patient_allergies (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id          UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    allergen                 VARCHAR(200) NOT NULL,
    allergen_code            VARCHAR(32) NULL,
    coding_system            VARCHAR(30) NULL,
    reaction                 TEXT NULL,
    severity                 VARCHAR(20) NULL,
    status                   VARCHAR(20) NOT NULL DEFAULT 'active',
    onset_date               DATE NULL,
    source_type              VARCHAR(30) NOT NULL DEFAULT 'doctor_entered',
    source_report_version_id UUID NULL
                                REFERENCES report_versions (id) ON DELETE RESTRICT,
    source_proposal_id       UUID NULL
                                REFERENCES record_update_proposals (id) ON DELETE RESTRICT,
    created_by_user_id       UUID NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    recorded_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_by_id         UUID NULL
                                REFERENCES patient_allergies (id) ON DELETE RESTRICT,

    CONSTRAINT patient_allergies_status_check
        CHECK (status IN ('active', 'resolved', 'entered_in_error')),

    CONSTRAINT patient_allergies_severity_check
        CHECK (severity IS NULL OR severity IN ('mild', 'moderate', 'severe', 'life_threatening', 'unknown')),

    CONSTRAINT patient_allergies_coding_check
        CHECK (coding_system IS NULL OR allergen_code IS NOT NULL),

    CONSTRAINT patient_allergies_coding_system_check
        CHECK (coding_system IS NULL OR coding_system IN ('snomed', 'local')),

    CONSTRAINT patient_allergies_source_type_check
        CHECK (source_type IN ('patient_reported', 'doctor_entered', 'agent_2_derived', 'imported')),

    CONSTRAINT patient_allergies_self_supersede_check
        CHECK (superseded_by_id IS NULL OR superseded_by_id <> id)
);

COMMENT ON TABLE patient_allergies IS
    'Allergy list. Clinically significant: never silently removed. Resolution requires a new corrected row with doctor review.';

CREATE INDEX idx_patient_allergies_patient_status ON patient_allergies (patient_user_id, status);
CREATE INDEX idx_patient_allergies_source_version ON patient_allergies (source_report_version_id)
    WHERE source_report_version_id IS NOT NULL;

CREATE TRIGGER trg_patient_allergies_updated_at
    BEFORE UPDATE ON patient_allergies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_patient_allergies_provenance
    BEFORE INSERT OR UPDATE ON patient_allergies
    FOR EACH ROW EXECUTE FUNCTION enforce_medical_record_provenance('patient_allergy');


-- -----------------------------------------------------------------------------
-- 4. medical_history_entries
-- -----------------------------------------------------------------------------

CREATE TABLE medical_history_entries (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id          UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    entry_type               VARCHAR(30) NOT NULL,
    title                    VARCHAR(200) NOT NULL,
    description              TEXT NULL,
    occurred_on              DATE NULL,
    record_status            VARCHAR(20) NOT NULL DEFAULT 'historical',
    source_type              VARCHAR(30) NOT NULL DEFAULT 'doctor_entered',
    source_report_version_id UUID NULL
                                REFERENCES report_versions (id) ON DELETE RESTRICT,
    source_proposal_id       UUID NULL
                                REFERENCES record_update_proposals (id) ON DELETE RESTRICT,
    created_by_user_id       UUID NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    recorded_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_by_id         UUID NULL
                                REFERENCES medical_history_entries (id) ON DELETE RESTRICT,

    CONSTRAINT medical_history_entries_type_check
        CHECK (entry_type IN ('surgery', 'hospitalization', 'procedure', 'family_history',
                              'immunization', 'social_history', 'other')),

    CONSTRAINT medical_history_entries_status_check
        CHECK (record_status IN ('active', 'resolved', 'historical', 'entered_in_error')),

    CONSTRAINT medical_history_entries_source_type_check
        CHECK (source_type IN ('patient_reported', 'doctor_entered', 'agent_2_derived', 'imported')),

    CONSTRAINT medical_history_entries_self_supersede_check
        CHECK (superseded_by_id IS NULL OR superseded_by_id <> id)
);

COMMENT ON TABLE medical_history_entries IS
    'General longitudinal history for events that are not conditions, medications or allergies. Family history lives here because no separate family-member model is approved.';

CREATE INDEX idx_medical_history_patient_type     ON medical_history_entries (patient_user_id, entry_type);
CREATE INDEX idx_medical_history_patient_occurred ON medical_history_entries (patient_user_id, occurred_on);
CREATE INDEX idx_medical_history_source_version   ON medical_history_entries (source_report_version_id)
    WHERE source_report_version_id IS NOT NULL;

CREATE TRIGGER trg_medical_history_entries_updated_at
    BEFORE UPDATE ON medical_history_entries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_medical_history_entries_provenance
    BEFORE INSERT OR UPDATE ON medical_history_entries
    FOR EACH ROW EXECUTE FUNCTION enforce_medical_record_provenance('medical_history_entry');


-- -----------------------------------------------------------------------------
-- 5. test_orders
-- -----------------------------------------------------------------------------

CREATE TABLE test_orders (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id          UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    ordered_by_doctor_user_id UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    consultation_id          UUID NULL
                                REFERENCES consultations (id) ON DELETE RESTRICT,
    source_report_version_id UUID NULL
                                REFERENCES report_versions (id) ON DELETE RESTRICT,
    source_proposal_id       UUID NULL
                                REFERENCES record_update_proposals (id) ON DELETE RESTRICT,
    test_name                VARCHAR(200) NOT NULL,
    test_code                VARCHAR(32) NULL,
    coding_system            VARCHAR(30) NULL,
    priority                 VARCHAR(20) NOT NULL DEFAULT 'routine',
    status                   VARCHAR(20) NOT NULL DEFAULT 'ordered',
    ordered_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    scheduled_for            TIMESTAMPTZ NULL,
    completed_at             TIMESTAMPTZ NULL,
    cancelled_at             TIMESTAMPTZ NULL,
    cancellation_reason      VARCHAR(500) NULL,
    notes                    TEXT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT test_orders_priority_check
        CHECK (priority IN ('routine', 'urgent', 'stat')),

    CONSTRAINT test_orders_status_check
        CHECK (status IN ('ordered', 'scheduled', 'collected', 'resulted', 'cancelled')),

    CONSTRAINT test_orders_coding_check
        CHECK (coding_system IS NULL OR test_code IS NOT NULL),

    CONSTRAINT test_orders_coding_system_check
        CHECK (coding_system IS NULL OR coding_system IN ('loinc', 'local')),

    CONSTRAINT test_orders_completed_at_check
        CHECK (completed_at IS NULL OR completed_at >= ordered_at),

    CONSTRAINT test_orders_cancelled_at_check
        CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL),

    CONSTRAINT test_orders_cancellation_reason_check
        CHECK (cancellation_reason IS NULL OR status = 'cancelled'),

    CONSTRAINT test_orders_resulted_check
        CHECK (status <> 'resulted' OR completed_at IS NOT NULL)
);

COMMENT ON TABLE test_orders IS
    'A test ordered by a doctor. An ordered test is not a completed test; individual analytes live in test_results.';

CREATE INDEX idx_test_orders_patient_status ON test_orders (patient_user_id, status, ordered_at DESC);
CREATE INDEX idx_test_orders_doctor_status  ON test_orders (ordered_by_doctor_user_id, status);
CREATE INDEX idx_test_orders_consultation   ON test_orders (consultation_id) WHERE consultation_id IS NOT NULL;
CREATE INDEX idx_test_orders_source_version ON test_orders (source_report_version_id)
    WHERE source_report_version_id IS NOT NULL;

CREATE TRIGGER trg_test_orders_updated_at
    BEFORE UPDATE ON test_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_test_orders_provenance
    BEFORE INSERT OR UPDATE ON test_orders
    FOR EACH ROW EXECUTE FUNCTION enforce_medical_record_provenance('test_order');


-- -----------------------------------------------------------------------------
-- 6. test_results
-- -----------------------------------------------------------------------------

CREATE TABLE test_results (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_order_id            UUID NOT NULL
                                REFERENCES test_orders (id) ON DELETE RESTRICT,
    analyte_name             VARCHAR(200) NOT NULL,
    value_text               TEXT NULL,
    value_numeric            NUMERIC(18, 6) NULL,
    unit                     VARCHAR(50) NULL,
    reference_range          VARCHAR(150) NULL,
    abnormal_flag            VARCHAR(20) NULL,
    result_status            VARCHAR(20) NOT NULL DEFAULT 'preliminary',
    resulted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    resulted_by_user_id      UUID NULL
                                REFERENCES users (id) ON DELETE SET NULL,
    verified_by_user_id      UUID NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    verified_at              TIMESTAMPTZ NULL,
    source_type              VARCHAR(30) NOT NULL DEFAULT 'doctor_entered',
    source_report_version_id UUID NULL
                                REFERENCES report_versions (id) ON DELETE RESTRICT,
    source_proposal_id       UUID NULL
                                REFERENCES record_update_proposals (id) ON DELETE RESTRICT,
    document_provider        VARCHAR(50) NULL,
    document_key             TEXT NULL,
    notes                    TEXT NULL,
    superseded_by_id         UUID NULL
                                REFERENCES test_results (id) ON DELETE RESTRICT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT test_results_abnormal_flag_check
        CHECK (abnormal_flag IS NULL
               OR abnormal_flag IN ('low', 'normal', 'high', 'critical_low', 'critical_high', 'unknown')),

    CONSTRAINT test_results_status_check
        CHECK (result_status IN ('preliminary', 'final', 'corrected', 'entered_in_error')),

    CONSTRAINT test_results_source_type_check
        CHECK (source_type IN ('doctor_entered', 'imported', 'agent_2_derived', 'patient_reported')),

    -- A result must carry something: a text value, a numeric value or a document.
    CONSTRAINT test_results_value_check
        CHECK (value_text IS NOT NULL OR value_numeric IS NOT NULL OR document_key IS NOT NULL),

    CONSTRAINT test_results_document_pair_check
        CHECK ((document_provider IS NULL) = (document_key IS NULL)),

    CONSTRAINT test_results_verified_pair_check
        CHECK ((verified_at IS NULL) = (verified_by_user_id IS NULL)),

    CONSTRAINT test_results_self_supersede_check
        CHECK (superseded_by_id IS NULL OR superseded_by_id <> id)
);

COMMENT ON TABLE test_results IS
    'One row per analyte or reported value. A corrected result creates a new row and links the old row through superseded_by_id; results are never overwritten.';

CREATE INDEX idx_test_results_order          ON test_results (test_order_id);
CREATE INDEX idx_test_results_flag_resulted  ON test_results (abnormal_flag, resulted_at DESC);
CREATE INDEX idx_test_results_source_version ON test_results (source_report_version_id)
    WHERE source_report_version_id IS NOT NULL;
CREATE INDEX idx_test_results_superseded_by  ON test_results (superseded_by_id)
    WHERE superseded_by_id IS NOT NULL;

CREATE TRIGGER trg_test_results_updated_at
    BEFORE UPDATE ON test_results
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_test_results_provenance
    BEFORE INSERT OR UPDATE ON test_results
    FOR EACH ROW EXECUTE FUNCTION enforce_medical_record_provenance('test_result');

-- =============================================================================
-- Medora Healthcare — Migration 010: Follow-Up and Agent 3 Proposals
-- =============================================================================
-- Created after reports because follow_ups cites the approved report version
-- that recommended the follow-up. No consolidation happens in this file.
--
-- Invariant preserved from the ERD: a recommendation is not a proposed slot,
-- and a proposed slot is not a confirmed booking.
--
-- Do NOT add BEGIN/COMMIT: the migration runner owns the transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. follow_ups — a recommendation, not a booking
-- -----------------------------------------------------------------------------

CREATE TABLE follow_ups (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id          UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    doctor_user_id           UUID NOT NULL
                                REFERENCES users (id) ON DELETE RESTRICT,
    consultation_id          UUID NOT NULL
                                REFERENCES consultations (id) ON DELETE RESTRICT,
    source_report_version_id UUID NOT NULL
                                REFERENCES report_versions (id) ON DELETE RESTRICT,
    recommendation           TEXT NOT NULL,
    recommended_interval_days INTEGER NULL,
    due_on                   DATE NULL,
    status                   VARCHAR(20) NOT NULL DEFAULT 'recommended',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT follow_ups_status_check
        CHECK (status IN ('recommended', 'accepted', 'scheduling', 'scheduled', 'completed', 'declined', 'cancelled')),

    CONSTRAINT follow_ups_interval_check
        CHECK (recommended_interval_days IS NULL OR recommended_interval_days > 0),

    CONSTRAINT follow_ups_recommendation_check
        CHECK (char_length(btrim(recommendation)) > 0)
);

COMMENT ON TABLE follow_ups IS
    'Follow-up recommendation derived from an approved report version. A recommendation is not a slot and not a booking; it becomes scheduled only when an appointment reaches confirmed status.';
COMMENT ON COLUMN follow_ups.source_report_version_id IS
    'The approved report version that contains the recommendation.';

CREATE INDEX idx_follow_ups_patient_status_due
    ON follow_ups (patient_user_id, status, due_on);

CREATE INDEX idx_follow_ups_doctor_status
    ON follow_ups (doctor_user_id, status);

CREATE INDEX idx_follow_ups_consultation
    ON follow_ups (consultation_id);

CREATE INDEX idx_follow_ups_report_version
    ON follow_ups (source_report_version_id);

CREATE TRIGGER trg_follow_ups_updated_at
    BEFORE UPDATE ON follow_ups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. appointment_proposals — Agent 3 output, never a booking
-- -----------------------------------------------------------------------------

CREATE TABLE appointment_proposals (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id               UUID NOT NULL
                                     REFERENCES users (id) ON DELETE RESTRICT,
    doctor_user_id                UUID NOT NULL
                                     REFERENCES users (id) ON DELETE RESTRICT,
    follow_up_id                  UUID NULL
                                     REFERENCES follow_ups (id) ON DELETE RESTRICT,
    clinic_location_id            UUID NULL
                                     REFERENCES clinic_locations (id) ON DELETE RESTRICT,
    consultation_type             VARCHAR(20) NOT NULL,
    proposed_start_at             TIMESTAMPTZ NOT NULL,
    proposed_end_at               TIMESTAMPTZ NOT NULL,
    status                        VARCHAR(20) NOT NULL DEFAULT 'proposed',
    created_by_user_id            UUID NULL
                                     REFERENCES users (id) ON DELETE RESTRICT,
    created_by_agent_execution_id UUID NULL
                                     REFERENCES agent_executions (id) ON DELETE RESTRICT,
    expires_at                    TIMESTAMPTZ NULL,
    booked_appointment_id         UUID NULL UNIQUE
                                     REFERENCES appointments (id) ON DELETE RESTRICT,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT appointment_proposals_type_check
        CHECK (consultation_type IN ('in_person', 'online')),

    CONSTRAINT appointment_proposals_status_check
        CHECK (status IN ('proposed', 'selected', 'booked', 'declined', 'expired', 'cancelled')),

    CONSTRAINT appointment_proposals_range_check
        CHECK (proposed_end_at > proposed_start_at),

    -- A proposal becomes 'booked' only with a real appointment, and a booked
    -- appointment must belong to a booked proposal.
    CONSTRAINT appointment_proposals_booked_check
        CHECK ((status = 'booked') = (booked_appointment_id IS NOT NULL)),

    -- Every proposal has an author: a human or an agent execution.
    CONSTRAINT appointment_proposals_author_check
        CHECK (created_by_user_id IS NOT NULL OR created_by_agent_execution_id IS NOT NULL)
);

COMMENT ON TABLE appointment_proposals IS
    'A proposed slot produced by Agent 3 or Staff. A proposal is never a confirmed booking; booking requires authorisation and a defined confirmation policy.';
COMMENT ON COLUMN appointment_proposals.booked_appointment_id IS
    'Set only when a real booking is completed. A proposal without this value cannot claim status booked.';

CREATE INDEX idx_appointment_proposals_patient_status
    ON appointment_proposals (patient_user_id, status, proposed_start_at);

CREATE INDEX idx_appointment_proposals_doctor_start
    ON appointment_proposals (doctor_user_id, proposed_start_at);

CREATE INDEX idx_appointment_proposals_follow_up
    ON appointment_proposals (follow_up_id)
    WHERE follow_up_id IS NOT NULL;

CREATE INDEX idx_appointment_proposals_execution
    ON appointment_proposals (created_by_agent_execution_id)
    WHERE created_by_agent_execution_id IS NOT NULL;

-- At most one live proposal per doctor and start time.
CREATE UNIQUE INDEX uq_appointment_proposals_live_slot
    ON appointment_proposals (doctor_user_id, proposed_start_at)
    WHERE status IN ('proposed', 'selected');

CREATE TRIGGER trg_appointment_proposals_updated_at
    BEFORE UPDATE ON appointment_proposals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

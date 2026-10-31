-- =============================================================================
-- Medora Healthcare — Migration 007: Availability, Appointments, Access
-- =============================================================================
-- Scheduling module. No consolidation happens in this file; it is the
-- foundation the appointment status trail in 006 refers to.
--
-- clinic_locations is NOT created here. Migration 004_admin_workforce.sql
-- already creates and seeds it for the Admin directory, and that migration is
-- published, so this one reuses the table rather than duplicating it.
--
-- Creation order matters:
--   appointments -> care_relationships  (care_relationships.source_appointment_id)
--
-- Do NOT add BEGIN/COMMIT: the migration runner owns the transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. doctor_availability
-- -----------------------------------------------------------------------------
-- Recurring weekly template. Slot generation subtracts doctor_time_off and
-- existing appointments in the scheduling service.

CREATE TABLE doctor_availability (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_user_id    UUID NOT NULL
                         REFERENCES users (id) ON DELETE RESTRICT,
    clinic_location_id UUID NOT NULL
                         REFERENCES clinic_locations (id) ON DELETE RESTRICT,
    weekday           SMALLINT NOT NULL,
    start_time        TIME     NOT NULL,
    end_time          TIME     NOT NULL,
    slot_minutes      SMALLINT NOT NULL DEFAULT 30,
    consultation_type VARCHAR(20) NOT NULL,
    effective_from    DATE     NOT NULL DEFAULT CURRENT_DATE,
    effective_to      DATE     NULL,
    is_active         BOOLEAN  NOT NULL DEFAULT TRUE,
    created_by_user_id UUID NULL
                         REFERENCES users (id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT doctor_availability_weekday_check
        CHECK (weekday BETWEEN 0 AND 6),

    CONSTRAINT doctor_availability_window_check
        CHECK (end_time > start_time),

    CONSTRAINT doctor_availability_slot_check
        CHECK (slot_minutes BETWEEN 10 AND 120),

    CONSTRAINT doctor_availability_type_check
        CHECK (consultation_type IN ('in_person', 'online', 'both')),

    CONSTRAINT doctor_availability_effective_check
        CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE doctor_availability IS
    'Recurring weekly availability template for a doctor at a clinic. A template is not a bookable slot; slots are derived.';
COMMENT ON COLUMN doctor_availability.weekday IS
    '0 = Sunday through 6 = Saturday, matching the UI calendar.';

CREATE UNIQUE INDEX uq_doctor_availability_window
    ON doctor_availability (
        doctor_user_id, clinic_location_id, weekday,
        start_time, end_time, consultation_type, effective_from
    );

CREATE INDEX idx_doctor_availability_doctor_weekday
    ON doctor_availability (doctor_user_id, weekday, is_active);

CREATE INDEX idx_doctor_availability_clinic_weekday
    ON doctor_availability (clinic_location_id, weekday);

CREATE TRIGGER trg_doctor_availability_updated_at
    BEFORE UPDATE ON doctor_availability
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. doctor_time_off
-- -----------------------------------------------------------------------------

CREATE TABLE doctor_time_off (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_user_id     UUID NOT NULL
                          REFERENCES users (id) ON DELETE RESTRICT,
    starts_at          TIMESTAMPTZ NOT NULL,
    ends_at            TIMESTAMPTZ NOT NULL,
    reason             VARCHAR(255) NULL,
    created_by_user_id UUID NULL
                          REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT doctor_time_off_range_check
        CHECK (ends_at > starts_at)
);

COMMENT ON TABLE doctor_time_off IS
    'Blocked periods such as leave, conferences or emergency closure. Availability windows are not modified; these periods are subtracted when slots are generated.';

CREATE INDEX idx_doctor_time_off_doctor_range ON doctor_time_off (doctor_user_id, starts_at, ends_at);
CREATE INDEX idx_doctor_time_off_starts       ON doctor_time_off (starts_at);


-- -----------------------------------------------------------------------------
-- 3. appointments
-- -----------------------------------------------------------------------------
-- A request and a booking are one table distinguished by status. Every status
-- transition must also be written to audit_logs as appointment.status_changed
-- in the same transaction; see v_appointment_status_timeline.

CREATE TABLE appointments (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id                 UUID NOT NULL
                                       REFERENCES users (id) ON DELETE RESTRICT,
    doctor_user_id                  UUID NOT NULL
                                       REFERENCES users (id) ON DELETE RESTRICT,
    specialty_id                    UUID NOT NULL
                                       REFERENCES specialties (id) ON DELETE RESTRICT,
    clinic_location_id              UUID NULL
                                       REFERENCES clinic_locations (id) ON DELETE RESTRICT,
    consultation_type               VARCHAR(20) NOT NULL,
    status                          VARCHAR(30) NOT NULL DEFAULT 'requested',
    requested_start_at              TIMESTAMPTZ NULL,
    requested_end_at                TIMESTAMPTZ NULL,
    scheduled_start_at              TIMESTAMPTZ NULL,
    scheduled_end_at                TIMESTAMPTZ NULL,
    requested_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason                          VARCHAR(500) NULL,
    patient_notes                   VARCHAR(1000) NULL,
    internal_notes                  TEXT NULL,
    booked_by_user_id               UUID NOT NULL
                                       REFERENCES users (id) ON DELETE RESTRICT,
    confirmed_by_user_id            UUID NULL
                                       REFERENCES users (id) ON DELETE SET NULL,
    confirmed_at                    TIMESTAMPTZ NULL,
    checked_in_at                   TIMESTAMPTZ NULL,
    completed_at                    TIMESTAMPTZ NULL,
    cancelled_by_user_id            UUID NULL
                                       REFERENCES users (id) ON DELETE SET NULL,
    cancelled_at                    TIMESTAMPTZ NULL,
    cancellation_reason             VARCHAR(500) NULL,
    rescheduled_from_appointment_id UUID NULL
                                       REFERENCES appointments (id) ON DELETE SET NULL,
    version                         INTEGER NOT NULL DEFAULT 1,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT appointments_status_check
        CHECK (status IN (
            'requested', 'pending_confirmation', 'confirmed', 'checked_in',
            'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'
        )),

    CONSTRAINT appointments_consultation_type_check
        CHECK (consultation_type IN ('in_person', 'online')),

    -- Optimistic concurrency token used by booking and reschedule updates.
    CONSTRAINT appointments_version_check
        CHECK (version > 0),

    CONSTRAINT appointments_requested_range_check
        CHECK (requested_end_at IS NULL
               OR requested_start_at IS NULL
               OR requested_end_at > requested_start_at),

    CONSTRAINT appointments_scheduled_range_check
        CHECK (scheduled_end_at IS NULL
               OR scheduled_start_at IS NULL
               OR scheduled_end_at > scheduled_start_at),

    -- A patient and a doctor cannot be the same account.
    CONSTRAINT appointments_distinct_parties_check
        CHECK (patient_user_id <> doctor_user_id),

    -- Status-aware timestamps: an appointment that is confirmed or beyond must
    -- carry a real slot. A request may carry only a preference.
    CONSTRAINT appointments_confirmed_slot_check
        CHECK (status NOT IN ('confirmed', 'checked_in', 'in_progress', 'completed')
               OR (scheduled_start_at IS NOT NULL AND scheduled_end_at IS NOT NULL)),

    CONSTRAINT appointments_confirmed_at_check
        CHECK (status NOT IN ('confirmed', 'checked_in', 'in_progress', 'completed')
               OR confirmed_at IS NOT NULL),

    CONSTRAINT appointments_cancelled_at_check
        CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL)),

    CONSTRAINT appointments_completed_at_check
        CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

COMMENT ON TABLE appointments IS
    'Appointment request and booking. Status transitions are audited in audit_logs (event_type appointment.status_changed), not in a separate history table.';
COMMENT ON COLUMN appointments.specialty_id IS
    'Snapshot of the doctor specialty at booking time so later profile changes do not rewrite history.';
COMMENT ON COLUMN appointments.internal_notes IS
    'Operational note for Staff. Never used for clinical documentation.';

CREATE INDEX idx_appointments_patient_status_start
    ON appointments (patient_user_id, status, scheduled_start_at);

CREATE INDEX idx_appointments_doctor_status_start
    ON appointments (doctor_user_id, status, scheduled_start_at);

CREATE INDEX idx_appointments_clinic_start
    ON appointments (clinic_location_id, scheduled_start_at);

CREATE INDEX idx_appointments_status_requested
    ON appointments (status, requested_at);

CREATE INDEX idx_appointments_rescheduled_from
    ON appointments (rescheduled_from_appointment_id);

CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. care_relationships
-- -----------------------------------------------------------------------------
-- The record-specific access grant. A doctor reads a patient record only with
-- an active row here (or an active assigned appointment) — never from a role
-- alone. Admin and Staff are never granted clinical access by this table.

CREATE TABLE care_relationships (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id      UUID NOT NULL
                            REFERENCES users (id) ON DELETE RESTRICT,
    doctor_user_id       UUID NOT NULL
                            REFERENCES users (id) ON DELETE RESTRICT,
    source               VARCHAR(30) NOT NULL,
    source_appointment_id UUID NULL
                            REFERENCES appointments (id) ON DELETE SET NULL,
    granted_by_user_id   UUID NULL
                            REFERENCES users (id) ON DELETE SET NULL,
    granted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at           TIMESTAMPTZ NULL,
    revoked_at           TIMESTAMPTZ NULL,
    revoked_by_user_id   UUID NULL
                            REFERENCES users (id) ON DELETE SET NULL,
    revocation_reason    VARCHAR(500) NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT care_relationships_source_check
        CHECK (source IN ('appointment', 'consultation', 'admin_assignment', 'referral')),

    CONSTRAINT care_relationships_status_check
        CHECK (status IN ('active', 'expired', 'revoked')),

    CONSTRAINT care_relationships_parties_check
        CHECK (patient_user_id <> doctor_user_id),

    CONSTRAINT care_relationships_expiry_check
        CHECK (expires_at IS NULL OR expires_at > granted_at),

    CONSTRAINT care_relationships_revoked_at_check
        CHECK (status <> 'revoked' OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL)),

    CONSTRAINT care_relationships_revocation_reason_check
        CHECK (revocation_reason IS NULL OR status = 'revoked')
);

COMMENT ON TABLE care_relationships IS
    'Materialises record-specific doctor access to a patient. The backend must check status and expires_at on every clinical read.';
COMMENT ON COLUMN care_relationships.status IS
    'active means the grant is live; the backend must additionally compare expires_at with now().';

-- At most one live grant per doctor/patient pair.
CREATE UNIQUE INDEX uq_care_relationships_active_pair
    ON care_relationships (patient_user_id, doctor_user_id)
    WHERE status = 'active';

CREATE INDEX idx_care_relationships_patient_status
    ON care_relationships (patient_user_id, status);

CREATE INDEX idx_care_relationships_doctor_status
    ON care_relationships (doctor_user_id, status);

CREATE INDEX idx_care_relationships_appointment
    ON care_relationships (source_appointment_id)
    WHERE source_appointment_id IS NOT NULL;

-- =============================================================================
-- Medora Healthcare — Migration 003: Patient & Doctor Profiles
-- =============================================================================
-- Adds the Phase 2 profile layer on top of the Phase 1 identity schema.
--
-- New objects:
--   patient_profiles  — 1:1 with users; demographic data completed after login
--   specialties       — reference data for clinical specialties
--   doctor_profiles   — 1:1 with users; professional credentials
--
-- Deliberately NOT included (see DB.md §7 and §9):
--   * clinical data (diagnosis, allergies, medications, transcripts, reports)
--     belongs in later Medical Records / Consultations tables with their own
--     consent and audit requirements
--   * role enforcement at the database level. The PRIMARY KEY guarantees one
--     profile per user, not that the user holds the matching role; membership
--     is enforced in the service layer, where the authorisation decision
--     already lives.
--   * any change to the applied Phase 1 tables.
--
-- Do NOT add BEGIN/COMMIT to this file: the migration runner wraps each
-- migration and its schema_migrations row in a single transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Shared updated_at maintenance
-- -----------------------------------------------------------------------------
-- Phase 1 tables declare updated_at but nothing maintains it. This function is
-- introduced here and attached to the two new profile tables. Fixing the
-- existing users.updated_at column is a separate concern and would modify an
-- applied table, so it is intentionally out of scope.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_updated_at() IS
    'BEFORE UPDATE trigger function: stamps NEW.updated_at with now().';


-- -----------------------------------------------------------------------------
-- 2. patient_profiles — 1:1 with users
-- -----------------------------------------------------------------------------
-- Created empty at registration and completed incrementally via My Profile.
-- All demographic columns are nullable: public sign-up collects only name,
-- email and password (DB.md §7), so no value can exist at row creation time.
-- "Required" is therefore a completeness rule enforced by the API, expressed
-- here as profile_completed_at rather than as NOT NULL.

CREATE TABLE patient_profiles (
    user_id              UUID PRIMARY KEY
                             REFERENCES users (id) ON DELETE CASCADE,
    date_of_birth        DATE NULL,
    phone                VARCHAR(32) NULL,
    gender               VARCHAR(20) NULL,
    profile_completed_at TIMESTAMPTZ NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT patient_profiles_gender_check
        CHECK (gender IS NULL OR gender IN
               ('female', 'male', 'non_binary', 'prefer_not_to_say')),

    -- Only an immutable floor is enforced here. "Not in the future" depends on
    -- CURRENT_DATE, which is not immutable, so it is validated in the API
    -- instead of being embedded in a CHECK that pg_dump cannot reproduce.
    CONSTRAINT patient_profiles_dob_check
        CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01')
);

DROP TRIGGER IF EXISTS trg_patient_profiles_updated_at ON patient_profiles;
CREATE TRIGGER trg_patient_profiles_updated_at
    BEFORE UPDATE ON patient_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE patient_profiles IS
    'Demographic profile for a patient user. One row per user; no clinical data.';
COMMENT ON COLUMN patient_profiles.gender IS
    'Patient-facing gender identity. NULL until supplied by the patient.';
COMMENT ON COLUMN patient_profiles.phone IS
    'Contact number, normalised to E.164 by the API before storage.';
COMMENT ON COLUMN patient_profiles.profile_completed_at IS
    'Set by the API when the required profile fields are present; NULL means incomplete.';


-- -----------------------------------------------------------------------------
-- 3. specialties — clinical reference data
-- -----------------------------------------------------------------------------
-- Normalised rather than free text so the doctor directory can filter and
-- group reliably, and so the planned Admin Departments module (Admin.md §6.4)
-- has a table to manage instead of having to cleanse free-text values later.
--
-- Seeded from src/lib/mock/departments.ts, which is the superset vocabulary
-- already used by the UI (the patient roster in doctors.ts uses a subset).

CREATE TABLE specialties (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL UNIQUE,
    slug       VARCHAR(100) NOT NULL UNIQUE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE specialties IS
    'Clinical specialties. Referenced by doctor_profiles; managed by the Admin Departments module.';
COMMENT ON COLUMN specialties.is_active IS
    'Inactive specialties remain valid for existing doctors but are not offered for new assignments.';

INSERT INTO specialties (name, slug) VALUES
    ('Cardiology',       'cardiology'),
    ('Dermatology',      'dermatology'),
    ('Pediatrics',       'pediatrics'),
    ('Orthopedics',      'orthopedics'),
    ('Gynecology',       'gynecology'),
    ('ENT',              'ent'),
    ('Ophthalmology',    'ophthalmology'),
    ('Neurology',        'neurology'),
    ('General Medicine', 'general-medicine'),
    ('Psychiatry',       'psychiatry'),
    ('Radiology',        'radiology'),
    ('Oncology',         'oncology')
ON CONFLICT (slug) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4. doctor_profiles — 1:1 with users
-- -----------------------------------------------------------------------------
-- Doctors are provisioned by an Admin, never by public sign-up. A doctor user
-- may exist in pending_activation with password_hash NULL; the profile row is
-- created atomically by the authorised provisioning workflow.
--
-- license_number is NOT self-editable: it is a credential claim, and
-- Admin.md §6.3 requires verification before clinical privileges. The API
-- excludes it from the doctor's own PATCH allowlist; only an admin-scoped
-- endpoint may change it.

CREATE TABLE doctor_profiles (
    user_id             UUID PRIMARY KEY
                            REFERENCES users (id) ON DELETE CASCADE,
    specialty_id        UUID NOT NULL
                            REFERENCES specialties (id) ON DELETE RESTRICT,
    license_number      VARCHAR(64) NOT NULL,
    phone               VARCHAR(32) NULL,
    bio                 TEXT NULL,
    professional_title  VARCHAR(120) NULL,
    license_verified_at TIMESTAMPTZ NULL,
    license_verified_by UUID NULL
                            REFERENCES users (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT doctor_profiles_license_number_check
        CHECK (char_length(btrim(license_number)) > 0)
);

-- Two doctors cannot hold the same licence.
CREATE UNIQUE INDEX uq_doctor_profiles_license
    ON doctor_profiles (license_number);

-- Supports directory filtering by specialty.
CREATE INDEX idx_doctor_profiles_specialty
    ON doctor_profiles (specialty_id);

DROP TRIGGER IF EXISTS trg_doctor_profiles_updated_at ON doctor_profiles;
CREATE TRIGGER trg_doctor_profiles_updated_at
    BEFORE UPDATE ON doctor_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE doctor_profiles IS
    'Professional profile for a doctor user. Created by Admin provisioning, never by public sign-up.';
COMMENT ON COLUMN doctor_profiles.license_number IS
    'Professional licence identifier. Unique, admin-controlled, never self-editable.';
COMMENT ON COLUMN doctor_profiles.license_verified_at IS
    'When an administrator verified the licence; NULL means unverified.';
COMMENT ON COLUMN doctor_profiles.license_verified_by IS
    'Administrator who performed the verification.';


-- -----------------------------------------------------------------------------
-- 5. Backfill
-- -----------------------------------------------------------------------------
-- Gives every existing patient an empty profile so that GET /api/patients/me
-- always has a row to return. Idempotent, and a no-op on a database that has
-- no patient accounts yet.

INSERT INTO patient_profiles (user_id)
SELECT u.id
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r       ON r.id = ur.role_id
WHERE r.name = 'patient'
ON CONFLICT (user_id) DO NOTHING;

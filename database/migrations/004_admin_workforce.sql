-- =============================================================================
-- Medora Healthcare — Migration 004: Admin Workforce Directory
-- =============================================================================
-- Backs the Admin modules /admin/users and /admin/doctors-staff.
--
-- New objects:
--   clinic_locations  — physical work sites referenced by staff/doctor profiles
--   departments       — organizational unit; clinical rows link 1:1 to a specialty
--   staff_profiles    — 1:1 with users, the receptionist/staff employment record
--
-- Altered:
--   doctor_profiles   — date_of_birth, years_of_experience, primary_location_id,
--                       verification_status
--   users             — trg_users_updated_at (the column existed since 001 with
--                       nothing maintaining it; admin edits now write to it)
--
-- Design notes:
--   * departments exists because the UI filters doctors and staff by one list and
--     because "Nursing", "Laboratory" and "Administration" are not clinical
--     specialties. Clinical rows carry a unique specialty_id, so there is still
--     exactly one source per clinical name. This revises the note on
--     specialties in medora.dbml, which previously claimed that table alone was
--     the Departments module's data source.
--   * No duty_status and no photo_url. Duty is derived from doctor_availability,
--     doctor_time_off and appointments once the scheduling stage exists; a
--     manual column would be a second source of truth. Photo storage is an open
--     decision (architecture #6) and the UI falls back to initials.
--   * No clinical columns. Staff and Admin do not gain access to patient data
--     through these tables.
--
-- Do NOT add BEGIN/COMMIT: the migration runner wraps this file and its
-- schema_migrations row in one transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. clinic_locations — physical work sites
-- -----------------------------------------------------------------------------

CREATE TABLE clinic_locations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(150) NOT NULL,
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    city          VARCHAR(100) NOT NULL,
    country_code  CHAR(2)      NOT NULL DEFAULT 'EG',
    timezone      VARCHAR(64)  NOT NULL DEFAULT 'Africa/Cairo',
    phone         VARCHAR(32),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_clinic_locations_name_city UNIQUE (name, city)
);

CREATE INDEX idx_clinic_locations_city   ON clinic_locations (city);
CREATE INDEX idx_clinic_locations_active ON clinic_locations (is_active);

COMMENT ON TABLE clinic_locations IS
    'Physical clinic or virtual-service location. Referenced by doctor and staff profiles.';
COMMENT ON COLUMN clinic_locations.timezone IS
    'Authority for interpreting local availability windows.';

-- Seeded with the three sites the Admin UI already offers. Idempotent.
INSERT INTO clinic_locations (name, address_line1, city, country_code, timezone)
VALUES
    ('Main Hospital',     '123 Health St',      'Cairo', 'EG', 'Africa/Cairo'),
    ('West Clinic',       '45 El Nile St',      'Giza',  'EG', 'Africa/Cairo'),
    ('Children''s Clinic','12 El Horreya Rd',   'Cairo', 'EG', 'Africa/Cairo')
ON CONFLICT (name, city) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. departments — organizational unit for doctors and staff
-- -----------------------------------------------------------------------------
-- Clinical departments are 1:1 with a specialty (specialty_id UNIQUE). Support
-- departments have no specialty. The CHECK makes the two shapes mutually
-- exclusive, so a row can never be half-clinical.

CREATE TABLE departments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL UNIQUE,
    slug         VARCHAR(100) NOT NULL UNIQUE,
    kind         VARCHAR(20)  NOT NULL,
    specialty_id UUID UNIQUE REFERENCES specialties (id) ON DELETE RESTRICT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT departments_kind_check
        CHECK (kind IN ('clinical', 'support')),

    CONSTRAINT departments_specialty_check
        CHECK (
            (kind = 'clinical' AND specialty_id IS NOT NULL) OR
            (kind = 'support'  AND specialty_id IS NULL)
        )
);

CREATE INDEX idx_departments_kind   ON departments (kind);
CREATE INDEX idx_departments_active ON departments (is_active);

COMMENT ON TABLE departments IS
    'Organizational unit. Clinical departments map 1:1 to a specialty; support departments (Nursing, Laboratory, Administration) do not.';
COMMENT ON COLUMN departments.specialty_id IS
    'Set only for clinical departments. ON DELETE RESTRICT keeps a specialty in use from being removed.';

-- One clinical department per seeded specialty (all twelve, so no doctor is
-- left without a department). Idempotent on slug.
INSERT INTO departments (name, slug, kind, specialty_id)
SELECT s.name, s.slug, 'clinical', s.id
FROM specialties AS s
ON CONFLICT (slug) DO NOTHING;

INSERT INTO departments (name, slug, kind)
VALUES
    ('Laboratory',     'laboratory',     'support'),
    ('Administration', 'administration', 'support'),
    ('Nursing',        'nursing',        'support')
ON CONFLICT (slug) DO NOTHING;

-- Admin.md §6.4: "Prevent deleting departments with dependent operational
-- records without a defined policy."
--
-- staff_profiles.department_id already blocks deletion through its RESTRICT
-- foreign key, but doctors reference the specialty, not the department. Without
-- this trigger a clinical department could be removed while doctors still sit
-- in it, silently erasing their department from the directory.
CREATE OR REPLACE FUNCTION prevent_department_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.specialty_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM doctor_profiles WHERE specialty_id = OLD.specialty_id
    ) THEN
        RAISE EXCEPTION
            'Department "%" is assigned to one or more doctors and cannot be deleted.',
            OLD.name
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_department_delete() IS
    'BEFORE DELETE guard: a clinical department with doctors cannot be removed.';

DROP TRIGGER IF EXISTS trg_departments_prevent_delete ON departments;
CREATE TRIGGER trg_departments_prevent_delete
    BEFORE DELETE ON departments
    FOR EACH ROW EXECUTE FUNCTION prevent_department_delete();


-- -----------------------------------------------------------------------------
-- 3. doctor_profiles — fields the directory needs
-- -----------------------------------------------------------------------------

ALTER TABLE doctor_profiles
    ADD COLUMN date_of_birth       DATE,
    ADD COLUMN years_of_experience SMALLINT,
    ADD COLUMN primary_location_id UUID
        REFERENCES clinic_locations (id) ON DELETE SET NULL,
    ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Existing rows: a recorded verification timestamp means verified.
UPDATE doctor_profiles
SET verification_status = 'verified'
WHERE license_verified_at IS NOT NULL
  AND verification_status <> 'verified';

ALTER TABLE doctor_profiles
    ADD CONSTRAINT doctor_profiles_dob_check
        CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01'),

    ADD CONSTRAINT doctor_profiles_years_check
        CHECK (years_of_experience IS NULL OR years_of_experience BETWEEN 0 AND 70),

    ADD CONSTRAINT doctor_profiles_verification_check
        CHECK (verification_status IN ('pending', 'verified', 'rejected')),

    -- "verified" must always carry the evidence that justifies it.
    ADD CONSTRAINT doctor_profiles_verified_timestamp_check
        CHECK (verification_status <> 'verified' OR license_verified_at IS NOT NULL);

CREATE INDEX idx_doctor_profiles_location ON doctor_profiles (primary_location_id);
CREATE INDEX idx_doctor_profiles_verification ON doctor_profiles (verification_status);

COMMENT ON COLUMN doctor_profiles.verification_status IS
    'Authoritative credential state: pending | verified | rejected. license_verified_at/by remain the audit evidence.';
COMMENT ON COLUMN doctor_profiles.years_of_experience IS
    'Self-reported professional experience in years. Admin-editable; not a credential.';


-- -----------------------------------------------------------------------------
-- 4. staff_profiles — employment record for receptionist/staff users
-- -----------------------------------------------------------------------------
-- Mirrors doctor_profiles: 1:1 with users, CASCADE with the account, no
-- clinical data. department_id is RESTRICT so a department in use cannot be
-- deleted out from under an employee.

CREATE TABLE staff_profiles (
    user_id             UUID PRIMARY KEY
                            REFERENCES users (id) ON DELETE CASCADE,
    department_id       UUID NOT NULL
                            REFERENCES departments (id) ON DELETE RESTRICT,
    job_title           VARCHAR(120) NOT NULL,
    employment_id       VARCHAR(64),
    phone               VARCHAR(32),
    date_of_birth       DATE,
    bio                 TEXT,
    work_shift          VARCHAR(120),
    primary_location_id UUID
                            REFERENCES clinic_locations (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT staff_profiles_job_title_check
        CHECK (char_length(btrim(job_title)) > 0),

    CONSTRAINT staff_profiles_dob_check
        CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01')
);

-- Employment ids are unique when present, but optional.
CREATE UNIQUE INDEX uq_staff_profiles_employment_id
    ON staff_profiles (employment_id)
    WHERE employment_id IS NOT NULL;

CREATE INDEX idx_staff_profiles_department ON staff_profiles (department_id);
CREATE INDEX idx_staff_profiles_location   ON staff_profiles (primary_location_id);

COMMENT ON TABLE staff_profiles IS
    'Employment record for a receptionist/staff user. One row per user; no clinical data.';
COMMENT ON COLUMN staff_profiles.work_shift IS
    'Descriptive HR shift label only. Not a schedule and never used for slot generation.';


-- -----------------------------------------------------------------------------
-- 5. updated_at maintenance
-- -----------------------------------------------------------------------------
-- set_updated_at() was introduced in 003.

DROP TRIGGER IF EXISTS trg_clinic_locations_updated_at ON clinic_locations;
CREATE TRIGGER trg_clinic_locations_updated_at
    BEFORE UPDATE ON clinic_locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_departments_updated_at ON departments;
CREATE TRIGGER trg_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON staff_profiles;
CREATE TRIGGER trg_staff_profiles_updated_at
    BEFORE UPDATE ON staff_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Long-standing gap: users.updated_at existed since 001 but nothing maintained
-- it. Admin edits write to this table, and a stale timestamp would contradict
-- the audit row describing the same change.
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

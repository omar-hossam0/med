# Medora — Admin Dashboard Backend Integration Plan

**Revision 2** · 30 October 2026
**Scope:** backend integration for `/admin/users` and `/admin/doctors-staff`
**Status:** **implemented.** D-1(b), D-2(a) and D-3(a) were chosen: the pages now read PostgreSQL, migrations `004`–`005` are applied, and no demo data is seeded.
**Repository state:** branch `main`, migrations `001`–`005` applied

---

## 0. What changed in revision 2

Revision 1 was written from the identity/profile section of the schema plus keyword searches. It missed the other 35 tables and, with them, four things that invalidate parts of it.

| # | Revision 1 | Reality | Effect |
|---|---|---|---|
| 1 | Proposed `004_admin_workforce.sql` and `005_account_lifecycle.sql` | `SCHEMA_ARCHITECTURE.md` §11 already assigns `004` to scheduling and `005` to consultation capture; the runner throws `Duplicate migration version` on a collision (`Backend/scripts/lib/migrations.js:79`) | The staging must be revised and renumbered before any SQL is written |
| 2 | "No audit table exists; implement a minimal one" | `audit_logs`, `security_events` and `notifications` are fully designed (`medora.dbml:953–1027`), documented in the data dictionary, and scheduled as stage 012 | Reuse the designed tables exactly; do not invent a trimmed variant |
| 3 | "No FK on `audit_logs.actor_user_id`" | The canonical relationship list defines `users.id < audit_logs.actor_user_id [delete: set null]` (`medora.dbml:1194`) | The FK is required; `SET NULL` is not a cascade |
| 4 | "No source for `duty`, `nextShift` or `availability`" | `doctor_availability` and `doctor_time_off` are designed (`medora.dbml:192–232`); `appointments` supplies the rest | The source exists but is unbuilt. A parallel `duty_status` column would create a second source of truth |
| 5 | New `departments` table, no comment on `specialties` | `specialties` is explicitly designated as the table the Admin Departments module manages (`medora.dbml:112`, `Admin.md` §6.4) | The department model is now an explicit decision, not an assumption |
| 6 | `photo_url` column on both profiles | No avatar/photo column exists anywhere in 45 tables; storage provider is open decision #6 | Deferred. The UI already renders initials |
| 7 | Invitation table named `account_invitations` | Open decision #14 names it `user_invitations` and says "design with the authentication phase; store only hashed tokens" | Renamed; the auth phase is now |
| 8 | Docs to update: DBML only | `SCHEMA_ARCHITECTURE.md` §10 counts and §11 stages, plus `SCHEMA_DATA_DICTIONARY.md`, are canonical and would drift | Both must be updated in the same change |
| 9 | Rollback by `DROP` statements | §11.1 rule 7: "Record rollback as a compensating forward migration. Do not add destructive `DROP` statements" | Rollback is documented as a forward migration |

Everything else in revision 1 — the contract analysis, the authorization matrix, the provisioning transaction, the test plan — still holds and is carried forward.

---

## 1. Objective and the one conflict that needs a decision

The objective is that both admin pages render live PostgreSQL data instead of the in-memory demo datasets.

The constraint is "do not add or modify anything on the frontend".

These cannot both be satisfied literally. Verified:

| File | Line | What it proves |
|---|---:|---|
| `src/components/admin/users/UsersProvider.tsx` | 29 | State is initialised from `seedUsers`; there is no `fetch` |
| `src/components/admin/doctors-staff/DoctorsStaffDirectory.tsx` | 51 | The directory is derived from `mergeMembers(users)`, the same mock array |
| `src/app/admin/doctors-staff/doctors/[id]/page.tsx` | 13 | Detail pages resolve members from the mock array by id |
| `next.config.mjs` | 10 | `/api/*` already proxies to `http://localhost:5000` |
| `src/lib/auth-context.tsx` | 42 | Login/session is genuinely wired; only these two data modules are not |

No backend-only mechanism can push rows into a client component's state. The plan therefore builds the complete backend shaped exactly like the TypeScript contracts the pages already consume, so the eventual frontend change is mechanical and never forces a second schema or API revision. §12 is the handoff.

**Decision D-1 (§15):** accept the handoff, or authorise a non-visual change to five frontend files.

"Complete the admin dashboard" is read as the two named modules. `/admin/dashboard`, `/admin/departments` and `/admin/ai-monitoring` are out of scope.

---

## 2. Complete schema inventory

### 2.1 Counts (verified, not estimated)

| Measure | Count | Source |
|---|---:|---|
| Tables in `medora.dbml` | 45 | `grep -c "^Table "` |
| Implemented (migrations 001–003 + runner) | 10 | `SCHEMA_ARCHITECTURE.md` §10.1 |
| Proposed (design only, absent from PostgreSQL) | 35 | §10.2 |
| Relationships | 129 (10 implemented + 119 proposed) | §10.3 |
| Table groups | 8 | `medora.dbml:1204–1270` |
| `medora.dbdiagram` | 45 table positions, no schema content | view state only |

Revision 1 treated the 10 implemented tables as the whole schema. They are 22% of it.

### 2.2 Module map — all 45 tables

| Module | Tables | Status |
|---|---|---|
| A. Identity & Access | `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions` | implemented |
| B. Profiles & Care Access | `patient_profiles`, `specialties`, `doctor_profiles` (implemented); `care_relationships` (proposed) | mixed |
| C. Scheduling & Follow-Up | `clinic_locations`, `doctor_availability`, `doctor_time_off`, `appointments`, `appointment_status_history`, `follow_ups`, `appointment_proposals` | proposed |
| D. Consultations & Transcripts | `consultations`, `consultation_consents`, `consultation_recordings`, `transcripts`, `transcript_versions`, `transcript_approvals` | proposed |
| E. AI Agents & Reports | `agent_executions`, `medical_reports`, `report_versions`, `report_approvals`, `report_deliveries`, `record_update_proposals` | proposed |
| F. Medical Records | `medical_conditions`, `patient_medications`, `patient_allergies`, `medical_history_entries`, `test_orders`, `test_results` | proposed |
| G. Reference Knowledge (OCR/RAG) | `reference_documents`, `reference_document_versions`, `document_extraction_jobs`, `reference_chunks`, `rag_queries`, `rag_citations` | proposed |
| H. Operations & Audit | `notifications`, `audit_logs`, `security_events` | proposed |
| Runner | `schema_migrations` | implemented |

### 2.3 Tables that change this plan

| Table | Design fact | Consequence |
|---|---|---|
| `specialties` (`:105`) | 12 seeded rows; note at `:112` says it is the table "the planned Admin Departments module has to manage" | A parallel `departments` table revises that note — now decision D-3 |
| `clinic_locations` (`:147`) | `UNIQUE (name, city)`, `country_code CHAR(2) DEFAULT 'EG'`, `timezone DEFAULT 'Africa/Cairo'`, indexes on `city` and `is_active` | Must be created once, by whichever stage runs first; owned by documented stage 004 |
| `doctor_availability` (`:192`), `doctor_time_off` (`:217`) | Weekly template plus blocked periods; `weekday 0=Sunday`, slot length, consultation type | `availability`, `duty` and `nextShift` are derived from these plus `appointments` — not from a new column |
| `appointments` (`:234`) | `doctor_user_id`, `clinic_location_id`, status lifecycle, `scheduled_start_at` | Future source for "On Duty Today" |
| `care_relationships` (`:169`) | Record-specific clinical access; §6.3 access matrix gives Admin **no clinical content** | Confirms the admin endpoints must never join clinical tables |
| `notifications` (`:953`) | `category ∈ {appointment, report_ready, account, system, security}`; body must contain no tokens | Invitation delivery is a `notifications` row, not an invented mechanism |
| `audit_logs` (`:978`) | Full column set incl. `actor_type`, `outcome`, `request_id`, `ip_address`, `before_state`, `after_state`; append-only; relationship at `:1194` | Implement exactly; write redacted state |
| `security_events` (`:1005`) | `event_type` includes `privilege_changed`; separate stream from audit | Status and verification changes write here too |

### 2.4 Genuine gaps — confirmed absent from all 45 tables

| Need | Present? |
|---|---|
| Staff / employment profile (job title, employment id, work shift, department) | **No table anywhere** |
| Doctor years of experience, date of birth, primary location | **No columns** |
| Organizational unit that is not a clinical specialty (Nursing, Laboratory, Administration) | **No table** |
| Invitation / activation token | **No table** (open decision #14) |
| Photo / avatar reference | **No column** (open decision #6) |

The absence of a staff profile is a real design gap, not a reading error: `SCHEMA_ARCHITECTURE.md` §10.2 lists no employment table in any of the 35 proposed objects.

---

## 3. Verified current state

### 3.1 Backend

| Concern | Reality |
|---|---|
| Runtime | Express `5.3.0`, Node `22.22.2`, `pg` `8.23.1`, CommonJS |
| Structure | `routes → controllers → services → config/db` pool |
| Mounted routes | `/api/auth` only, plus demo checks `/api/admin/check`, `/api/patient/check` |
| Auth | Opaque token in HttpOnly cookie `medora_session`, SHA-256 hashed in `sessions` |
| RBAC | `requireAuth`, `requireRole`, `requirePermission` — the last is **implemented but unused**, and requires **all** listed permissions |
| CSRF | Double-submit + HMAC bound to the session token; applied to logout only |
| Rate limiting | `loginRateLimiter` only |
| Errors | `{ error, message }`, no machine-readable code |
| Tests | `node:test`, 8 passing, service-level, no HTTP layer |

### 3.2 Database

| Object | State |
|---|---|
| Migrations | `001`, `002`, `003` |
| Tables | 10 (see §2.1) |
| Rows | `users = 1` (admin), `specialties = 12`, `doctor_profiles = 0`, `patient_profiles = 0` |
| Roles | `patient`, `doctor`, `receptionist`, `admin` |
| Permissions | 15, including `users.manage` and `staff_accounts.{create,view,update,disable,invite}` — admin-only |
| Single admin | Trigger `trg_enforce_single_admin` |

No doctors or staff exist. Both pages must legitimately show zero rows until accounts are provisioned. No demo rows will be inserted into `medora_db`.

### 3.3 Frontend contract

`DemoUser`: `id, name, role, email, phone, status, joinedAt, profile?`.
`DirectoryMember`: discriminated union on `kind`, with `department`, `verification`, `accountStatus`, `duty`, `services[]`, `availability[]`, `nextShift?`.

Two facts that shape the API:

1. `AvailabilityGrid` renders "No availability set" for `[]`; `NextShiftCard` renders "No upcoming shift scheduled" when `nextShift` is absent. Empty values are honest and safe.
2. The directory recomputes its four stat cards from the array it receives, so the initial wiring must request the unfiltered list.

---

## 4. Gap analysis

### 4.1 `/admin/users`

| UI field | Source | Gap |
|---|---|---|
| `id`, `name`, `email` | `users` | none |
| `role` | `user_roles → roles.name` | `receptionist → staff`; deterministic primary role for multi-role users |
| `phone` | `patient_profiles.phone`, `doctor_profiles.phone` | **staff have no phone column** |
| `status` | `users.status` | vocabulary mapping required |
| `joinedAt` | `users.created_at` | format to date |
| stats | role counts | exclude the admin so the four numbers add up |

### 4.2 `/admin/doctors-staff`

| UI field | Doctor | Staff | Status |
|---|---|---|---|
| `name`, `email` | `users` | `users` | available |
| `title` | `doctor_profiles.professional_title` | — | available |
| `specialty` | `specialties.name` | — | available |
| `department` | derived from specialty | — | **no organizational unit table** |
| `license` | `doctor_profiles.license_number` | — | available |
| `years` | — | — | **no column** |
| `dob` | — | — | **no column** |
| `location`, `address` | — | — | `clinic_locations` designed, not migrated |
| `photoUrl` | — | — | **no column, no storage decision** → stays null |
| `about` | `doctor_profiles.bio` | — | staff need `bio` |
| `jobTitle`, `employment_id`, `shift` | — | — | **no staff table** |
| `verification` | `license_verified_at` | — | three states need a status column |
| `accountStatus` | `users.status` | `users.status` | mapping |
| `duty`, `nextShift`, `availability` | scheduling tables | scheduling tables | designed, unbuilt → `off` / `null` / `[]` |
| `services` | — | — | no table → `[]` |

---

## 5. Design decisions

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| D1 | API translates DB vocabulary; schema keeps canonical values | Storing UI words would break the `users_status_check` constraint and the auth service | Renaming DB statuses |
| D2 | New `staff_profiles`, 1:1 with `users` | Mirrors `doctor_profiles`; CASCADE with the account | Staff columns on `users` |
| D3 | New `departments` table, clinical rows 1:1 with a specialty | Staff need an organizational unit that is not a clinical specialty; the directory filters both roles by one list; the Departments page needs a record that can hold staff too. **This revises the note at `medora.dbml:112`** and must be documented | `staff_profiles.department` free text (divergence the docs warn about) |
| D4 | `clinic_locations` created once, by the first stage that needs it | Already designed; must not be created twice | A location string per profile |
| D5 | `verification_status` column beside `license_verified_at/by` | Three UI states cannot be derived from one nullable timestamp | Inferring `rejected` from a note |
| D6 | **No `duty_status` column.** `duty` returns `off`, `nextShift` null, `availability` `[]` until scheduling exists | `doctor_availability` + `doctor_time_off` + `appointments` are the designed source. A manual column would be a second source of truth | Admin-maintained duty flag |
| D7 | `user_invitations`, hashed, single-use, expiring | Open decision #14 names it and prescribes hashed tokens; the auth phase is now | Admin-set passwords |
| D8 | `audit_logs` + `security_events` implemented exactly as designed | Stage 012 content, moved earlier because admin mutations need it | A trimmed private audit table |
| D9 | `notifications` row per invitation (`category='account'`, `channel='email'`) | The designed delivery mechanism. Body contains no token | No delivery record |
| D10 | Admin excluded from list, stats, and mutation targets | UI copy says patients/doctors/staff; removes self-lockout surface | Listing the admin |
| D11 | No `photo_url`; returns `null` | No storage decision (#6). The UI renders initials | Persisting blob URLs |
| D12 | List endpoints return the full filtered set (cap 2,000) with `pagination` | Both pages paginate client-side at 8 rows | Server pagination now |
| D13 | Provisioning accepts `doctor` and `staff` only | Admin creation is bootstrap-only; patients self-register | Role dropdown |
| D14 | Renumber the staged migration plan (§6.1) | `004`/`005` are taken; the runner rejects duplicates | Admin appended after 013 (requires the entire clinical stack first) |

---

## 6. Migration plan (requires approval — not applied)

### 6.1 The sequencing conflict and its resolution

`SCHEMA_ARCHITECTURE.md` §11 assigns `004` to scheduling and `005` to consultation capture. `Backend/scripts/lib/migrations.js:79` throws on a duplicate version prefix, so two files numbered `004` cannot coexist.

Three ways out:

| Option | What it involves | Verdict |
|---|---|---|
| A. Renumber the staged plan (admin first) | Documentation edit only — no SQL exists yet. Admin becomes 004–005, existing stages shift by two, old stage 012 is absorbed | **Recommended** |
| B. Build scheduling first, then admin | No renumbering, but the two pages wait on appointments, care relationships, consultations and reports | Not viable for this task |
| C. Append admin after 013 | On a fresh database the admin stage runs last; on the current database it would fail because `clinic_locations` would not exist | Rejected |

**Recommended new staging:**

| New | Old | File | Creates |
|---|---|---|---|
| **004** | new | `004_admin_workforce.sql` | `clinic_locations` (moved from old 004), `departments`, `doctor_profiles` additions, `staff_profiles`, `users.updated_at` trigger |
| **005** | new | `005_admin_account_lifecycle.sql` | `user_invitations`, `notifications`, `audit_logs`, `security_events` |
| 006 | 004 | `006_scheduling_and_care_access.sql` | `appointments`, `appointment_status_history`, `care_relationships`, `doctor_availability`, `doctor_time_off` |
| 007 | 005 | `007_consultation_capture.sql` | `consultations`, `consultation_consents`, `consultation_recordings` |
| 008 | 006 | `008_ai_execution_envelope.sql` | `agent_executions` |
| 009 | 007 | `009_transcripts_and_approvals.sql` | `transcripts`, `transcript_versions`, `transcript_approvals` |
| 010 | 008 | `010_reports_and_delivery.sql` | `medical_reports`, `report_versions`, `report_approvals`, `report_deliveries` |
| 011 | 009 | `011_medical_records_and_agent2.sql` | `record_update_proposals` + the six record tables |
| 012 | 010 | `012_followups_and_proposals.sql` | `follow_ups`, `appointment_proposals` |
| 013 | 011 | `013_reference_knowledge.sql` | the six OCR/RAG tables |
| 014 | 013 | `014_constraints_seeds_and_hardening.sql` | exclusion constraints, partial indexes, FTS, immutability triggers |
| — | 012 | absorbed into 005 | — |

Documentation that must change in the same commit: `SCHEMA_ARCHITECTURE.md` §10 counts and §11 table, `SCHEMA_DATA_DICTIONARY.md` §2/§10, `medora.dbml` status legend and table groups, and open-decision row #14 (now resolved).

Resulting counts: 48 tables (17 implemented after 004–005, 31 proposed), relationships +7 (verify with the DBML CLI rather than asserting a number).

### 6.2 `004_admin_workforce.sql`

```sql
-- 1. Clinic locations — the DBML definition, created once, here
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
-- seed: Main Hospital / 123 Health St / Cairo,
--       West Clinic  / 45 El Nile St / Giza,
--       Children's Clinic / 12 El Horreya Rd / Cairo

-- 2. Departments — organizational unit, clinical rows linked 1:1 to a specialty
CREATE TABLE departments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL UNIQUE,
    slug         VARCHAR(100) NOT NULL UNIQUE,
    kind         VARCHAR(20)  NOT NULL,
    specialty_id UUID UNIQUE REFERENCES specialties (id) ON DELETE RESTRICT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT departments_kind_check CHECK (kind IN ('clinical', 'support')),
    CONSTRAINT departments_specialty_check CHECK (
        (kind = 'clinical' AND specialty_id IS NOT NULL) OR
        (kind = 'support'  AND specialty_id IS NULL)
    )
);
-- seed 12 clinical rows mapped to all 12 specialties by slug
--   (the UI hardcodes 8; seeding all 12 prevents a doctor with
--    Ophthalmology/Psychiatry/Radiology/Oncology having no department)
-- seed 3 support rows: Laboratory, Administration, Nursing

-- 3. Doctor profile: the fields the directory needs and the schema lacks
ALTER TABLE doctor_profiles
    ADD COLUMN date_of_birth       DATE,
    ADD COLUMN years_of_experience SMALLINT,
    ADD COLUMN primary_location_id UUID REFERENCES clinic_locations (id) ON DELETE SET NULL,
    ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE doctor_profiles
    ADD CONSTRAINT doctor_profiles_dob_check
        CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01'),
    ADD CONSTRAINT doctor_profiles_years_check
        CHECK (years_of_experience IS NULL OR years_of_experience BETWEEN 0 AND 70),
    ADD CONSTRAINT doctor_profiles_verification_check
        CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    ADD CONSTRAINT doctor_profiles_verified_timestamp_check
        CHECK (verification_status <> 'verified' OR license_verified_at IS NOT NULL);

UPDATE doctor_profiles SET verification_status = 'verified'
WHERE license_verified_at IS NOT NULL;

CREATE INDEX idx_doctor_profiles_location ON doctor_profiles (primary_location_id);

-- 4. Staff profile — no clinical columns, no duty, no photo
CREATE TABLE staff_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    department_id       UUID NOT NULL REFERENCES departments (id) ON DELETE RESTRICT,
    job_title           VARCHAR(120) NOT NULL,
    employment_id       VARCHAR(64),
    phone               VARCHAR(32),
    date_of_birth       DATE,
    bio                 TEXT,
    work_shift          VARCHAR(120),
    primary_location_id UUID REFERENCES clinic_locations (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_profiles_job_title_check CHECK (char_length(btrim(job_title)) > 0),
    CONSTRAINT staff_profiles_dob_check
        CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01')
);
CREATE UNIQUE INDEX uq_staff_profiles_employment_id
    ON staff_profiles (employment_id) WHERE employment_id IS NOT NULL;
CREATE INDEX idx_staff_profiles_department ON staff_profiles (department_id);
CREATE INDEX idx_staff_profiles_location   ON staff_profiles (primary_location_id);

-- 5. Triggers (reuse set_updated_at() from 003)
--    trg_clinic_locations_updated_at, trg_departments_updated_at,
--    trg_staff_profiles_updated_at, trg_users_updated_at
```

`users.updated_at` has existed since `001` with nothing maintaining it. Admin edits now write to that table, so leaving it stale would make the audit trail contradict the row it describes.

### 6.3 `005_admin_account_lifecycle.sql`

```sql
-- 1. Invitations (open decision #14, resolved)
CREATE TABLE user_invitations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,          -- SHA-256; plaintext never stored
    purpose    VARCHAR(20) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_invitations_purpose_check CHECK (purpose IN ('invite', 'password_reset')),
    CONSTRAINT user_invitations_expiry_check  CHECK (expires_at > created_at)
);
CREATE INDEX idx_user_invitations_user ON user_invitations (user_id, purpose, used_at);
CREATE UNIQUE INDEX uq_user_invitations_live_invite
    ON user_invitations (user_id)
    WHERE purpose = 'invite' AND used_at IS NULL AND revoked_at IS NULL;

-- 2. Notifications — exactly as designed
CREATE TABLE notifications ( /* medora.dbml:953 */ );
CREATE INDEX idx_notifications_recipient_status ON notifications (recipient_user_id, status, created_at);
CREATE INDEX idx_notifications_scheduled        ON notifications (scheduled_for, status);

-- 3. Audit trail — exactly as designed, with its documented FK
CREATE TABLE audit_logs ( /* medora.dbml:978 */ );
CREATE INDEX idx_audit_logs_patient_occurred ON audit_logs (patient_user_id, occurred_at);
CREATE INDEX idx_audit_logs_actor_occurred   ON audit_logs (actor_user_id, occurred_at);
CREATE INDEX idx_audit_logs_entity           ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_occurred         ON audit_logs (occurred_at);
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey
    FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL;

-- 4. Security events — exactly as designed
CREATE TABLE security_events ( /* medora.dbml:1005 */ );
CREATE INDEX idx_security_events_type_occurred     ON security_events (event_type, occurred_at);
CREATE INDEX idx_security_events_severity_occurred ON security_events (severity, occurred_at);
CREATE INDEX idx_security_events_user_occurred     ON security_events (user_id, occurred_at);
```

No `ON DELETE CASCADE` from `users` into `audit_logs` — `SET NULL` preserves the trail, as the DBML requires.

### 6.4 Deletion and retention

| Table | Policy |
|---|---|
| `staff_profiles`, `doctor_profiles`, `user_invitations` | `CASCADE` from `users` |
| `departments` ← profiles | `RESTRICT` — a department in use cannot be removed |
| `clinic_locations` ← profiles | `SET NULL` — history survives a closed site |
| `audit_logs`, `security_events` | append-only; actor `SET NULL`; no DELETE endpoint |
| `notifications` | `CASCADE` from the recipient (not a clinical record) |

### 6.5 Rollback

Per §11.1 rule 7, rollback is a **compensating forward migration**, not `DROP` statements in the applied file.

It must **not** live in `database/migrations/`: the runner scans that directory by numeric prefix and would apply a `015_rollback_*.sql` automatically on the next `db:migrate`. The script belongs in `database/rollback/004_admin_workforce.down.sql`, outside the scanned path, and is executed manually only if a rollback is actually needed. It is never run against `medora_db` without approval.

---

## 7. API contract

Base `/api/admin`, session cookie, CSRF on mutations, `{ success: true, … }` on success, `{ error, message, code? }` on failure.

### 7.1 Endpoints

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/users` | list + search + filter + global stats | `users.manage` **or** `staff_accounts.view` |
| GET | `/users/:id` | single account | same |
| POST | `/users` | provision doctor/staff + invite | `staff_accounts.create` |
| PATCH | `/users/:id` | edit name, email, phone, DOB | `staff_accounts.update` |
| PATCH | `/users/:id/status` | activate / suspend / disable | `staff_accounts.disable` |
| POST | `/users/:id/invitations` | resend invite or issue reset | `staff_accounts.invite` |
| GET | `/doctors-staff` | directory + stats | `staff_accounts.view` |
| GET | `/doctors-staff/:id` | one doctor or staff member | `staff_accounts.view` |
| PATCH | `/doctors-staff/:id` | professional / employment fields | `staff_accounts.update` |
| POST | `/doctors-staff/:id/verification` | verify or reject a licence | `staff_accounts.update` |
| GET | `/reference-data` | specialties, departments, locations | `staff_accounts.view` |
| POST | `/api/auth/activate` | public: consume invite/reset token | public, rate-limited |

### 7.2 `GET /api/admin/users`

```json
{
  "success": true,
  "users": [{
    "id": "…", "name": "Dr. Sarah Mohamed", "email": "sarah.mohamed@medora.example",
    "phone": "+20 100 987 6543", "role": "doctor", "roles": ["doctor"],
    "status": "pending", "joinedAt": "2026-10-18"
  }],
  "stats": { "total": 4, "patients": 0, "doctors": 3, "staff": 1 },
  "pagination": { "total": 4, "limit": 1000, "offset": 0, "returned": 4, "hasMore": false }
}
```

### 7.3 `GET /api/admin/doctors-staff`

```json
{
  "success": true,
  "members": [{
    "id": "…", "kind": "doctor", "name": "Dr. Sarah Mohamed",
    "title": "Dermatologist", "specialty": "Dermatology", "department": "Dermatology",
    "license": "MD-2023-88412", "years": 6,
    "email": "sarah.mohamed@medora.example", "phone": "+20 100 987 6543",
    "dob": "1992-09-02", "location": "West Clinic", "address": "45 El Nile St, Giza",
    "photoUrl": null, "about": "…",
    "services": [], "availability": [],
    "verification": "pending", "accountStatus": "pending",
    "duty": "off", "nextShift": null
  }],
  "stats": { "doctors": 3, "staff": 1, "pendingVerification": 2, "onDuty": 0, "total": 4 },
  "pagination": { "total": 4, "limit": 1000, "offset": 0, "returned": 4, "hasMore": false }
}
```

`duty` is `off` for every member and `onDuty` is `0` until stage 006 lands. That is the honest value, not a placeholder to be filled with invented data.

### 7.4 `POST /api/admin/users` — 201

```json
{
  "success": true,
  "user": { "id": "…", "name": "Dr. Sarah Mohamed", "role": "doctor", "status": "pending" },
  "invitation": {
    "expires_at": "2026-11-06T15:00:00.000Z",
    "activation_token": "…64 hex chars, returned once…",
    "activation_path": "/activate?token=…"
  }
}
```

Side effects in the same transaction: `user_invitations` row, `notifications` row (`category='account'`, `channel='email'`, `status='pending'`, body without the token), `audit_logs` row.

### 7.5 `PATCH /api/admin/users/:id/status`

```json
{ "status": "suspended", "reason": "Repeated no-shows; pending HR review" }
```

Writes `audit_logs` (`action='user.status_changed'`, redacted before/after, `metadata.reason`) and `security_events` (`event_type='privilege_changed'`, `severity='warning'`).

### 7.6 Vocabulary mapping (`utils/serializers.js`)

| `users.status` | API / UI |
|---|---|
| `active` | `active` |
| `pending_activation` | `pending` |
| `suspended` | `suspended` |
| `disabled` | `inactive` |

| DB role | API role |
|---|---|
| `doctor` | `doctor` |
| `receptionist` | `staff` |
| `patient` | `patient` |
| `admin` | excluded |

Primary-role precedence: `doctor` > `receptionist` > `patient`. Accounts whose only role is `admin` are excluded.

### 7.7 Status transitions

| From → To | Allowed | Note |
|---|---|---|
| `active` → `suspended` / `disabled` | yes | `reason` required |
| `suspended` → `active` / `disabled` | yes | `reason` required |
| `disabled` → `active` | yes | 409 if `password_hash IS NULL` |
| `pending_activation` → `disabled` | yes | cancels the live invitation |
| `pending_activation` → `active` | no | only `/auth/activate` may do this |
| any → same | no | 409 `status_unchanged` |
| target is self | no | 403 `self_lockout` |
| target holds `admin` | no | 403 `admin_protected` |

### 7.8 Error codes

`validation_error`, `email_taken`, `license_taken`, `employment_id_taken`, `unknown_specialty`, `unknown_department`, `department_specialty_mismatch`, `invalid_status_transition`, `status_unchanged`, `pending_activation_incomplete`, `self_lockout`, `admin_protected`, `not_found`, `token_invalid`, `token_expired`, `invitation_not_applicable`.

`errorHandler` gains one line to pass `err.code` through; existing responses are unchanged.

---

## 8. Authorization

| Actor | `/users` read | provision | status change | directory | verification |
|---|---|---|---|---|---|
| Anonymous | 401 | 401 | 401 | 401 | 401 |
| Patient | 403 | 403 | 403 | 403 | 403 |
| Doctor | 403 | 403 | 403 | 403 | 403 |
| Receptionist | 403 | 403 | 403 | 403 | 403 |
| Admin | 200 | 201 | 200 | 200 | 200 |

Layered on every route: `requireAuth` → `requireRole("admin")` → `requirePermission(...)` → `verifyCsrf` (mutations). The endpoints expose account and employment metadata only; no clinical table is joined, consistent with the §6.3 access matrix ("Admin: no clinical content by default").

`requirePermission` requires **all** listed permissions, so a `requireAnyPermission` helper is needed for `users.manage OR staff_accounts.view`.

---

## 9. File plan

### New — `Backend/`

| File | Responsibility |
|---|---|
| `routes/adminRoutes.js` | One router mounted at `/api/admin` |
| `controllers/adminUsersController.js` | HTTP layer for `/users` |
| `controllers/adminDirectoryController.js` | HTTP layer for `/doctors-staff` |
| `controllers/adminReferenceController.js` | HTTP layer for `/reference-data` |
| `services/adminUsersService.js` | List/detail, provisioning transaction, profile patch, status lifecycle |
| `services/adminDirectoryService.js` | Doctor + staff queries, serialisation, verification |
| `services/adminReferenceService.js` | Specialties, departments, locations |
| `services/invitationService.js` | Token mint/verify/consume, resend, reset, session revocation |
| `services/auditService.js` | Redacted audit + security-event writes |
| `utils/httpError.js` | `httpError(status, code, message, errors?)` |
| `utils/validators.js` | Name, email, phone, date, enums, caps, UUID |
| `utils/serializers.js` | Row → `DemoUser` / `DirectoryMember`, vocabulary mapping, address composition |
| `tests/admin.test.js` | Route-level suite (§11) |

### Modified — `Backend/`

| File | Change |
|---|---|
| `server.js` | Mount `/api/admin` before the demo checks |
| `middleware/auth.js` | Add `requireAnyPermission` |
| `middleware/rateLimiter.js` | Add `adminActionLimiter`, `activationLimiter` |
| `middleware/errorHandler.js` | Pass through `err.code` |
| `routes/authRoutes.js`, `controllers/authController.js` | Add `POST /activate` |
| `package.json` | `test` runs both suites |
| `config/db.js` | Optional: `pool.on("error")`, `statement_timeout` |

`services/authService.js` is **not modified**; `invitationService` imports its `hashPassword` and `hashSessionToken`.

### New — `database/`

`migrations/004_admin_workforce.sql`, `migrations/005_admin_account_lifecycle.sql`.

### Documentation that must move with them

| File | Change |
|---|---|
| `database/medora.dbml` | Add 3 tables, move 4 from PROPOSED to IMPLEMENTED, add `TableGroup` entries, revise the `specialties` note at `:112`, update the status legend |
| `database/SCHEMA_ARCHITECTURE.md` | §10 counts (45 → 48), §11 staging table (§6.1), §12 open decision #14 → resolved |
| `database/SCHEMA_DATA_DICTIONARY.md` | §2 implemented summary, new table sections, §10 controlled vocabularies |
| `CHANGES_AND_NEXT_STEPS.md` | Session record |

The DBML validation gate (§11.2 of the architecture) requires zero tables outside a `TableGroup`; skipping the group update fails that check.

### Explicitly not touched

`src/`, `public/`, `next.config.mjs`, root `package.json`, migrations `001`–`003`.

---

## 10. Execution phases

**Phase 0 — approval.** §15 D-1 to D-4. Nothing applied before this.

**Phase 1 — staging revision + schema 004.** Update the three schema documents, then write and run `004` on `medora_test` first.

Acceptance: 3 locations, 15 departments; every CHECK rejects its invalid case; deleting a department in use raises `23001`; verification backfill correct; four triggers fire; runner records `004` with a checksum and a second run is a no-op; DBML parses with zero ungrouped tables.

**Phase 2 — read APIs.** `utils/*`, reference data, users list, directory list/detail, controllers, router.

Acceptance: responses match the TypeScript contracts field-by-field; 401/403 matrix passes; no `password_hash`, token or session field anywhere; doctor and staff fixtures serialise with every field the pages read.

**Phase 3 — provisioning.** Transaction: duplicate check → `users` (`pending_activation`, `password_hash NULL`, `created_by`) → `user_roles` → profile → invitation → notification → audit → commit.

Acceptance: forced failure at each step leaves zero orphans; duplicate email/licence/employment-id return 409; `role: "admin"` returns 400; `department_specialty_mismatch` enforced.

**Phase 4 — lifecycle.** Status transitions, profile patches, verification, guards, audit + security events.

Acceptance: §7.7 matrix behaves exactly; self/admin targets return 403; `reason` mandatory and stored; `before_state`/`after_state` contain no secrets; `privilege_changed` event written.

**Phase 5 — invitations and activation.** `005`, then `/api/auth/activate`.

Acceptance: token works once; replay `token_invalid`; expired `token_expired`; weak password changes nothing; resend revokes the previous live invite; `invite` activates, `password_reset` keeps status and revokes sessions.

**Phase 6 — tests and docs.** `tests/admin.test.js`, package script, final doc pass.

Acceptance: `npm test` green (8 existing + new); DBML re-validated; `git diff --stat` shows no `src/` file.

**Phase 7 — handoff** (or wiring, if D-1 authorises it).

---

## 11. Test plan

Route-level tests without new dependencies: `app.listen(0)` in `before`, Node's global `fetch`, manual cookie capture.

Session fixtures: mint a session row directly for the existing admin (the pattern already used to verify that account), and register one temporary patient. Clean up by deleting test users (CASCADE) and audit rows carrying the test marker.

| # | Case | Expected |
|---|---|---|
| 1 | No cookie → `/api/admin/users` | 401 |
| 2 | Patient session → admin endpoints | 403 |
| 3 | Admin → `/users` | 200, contract shape, no `password_hash` |
| 4 | `?role=staff` | only `receptionist`, mapped to `staff` |
| 5 | `?status=pending` | only `pending_activation` |
| 6 | Stats exclude admin and add up | `total = patients + doctors + staff` |
| 7 | Provision a doctor | 201, one user + role + profile + invitation + notification + audit |
| 8 | Duplicate email, case-insensitive | 409 `email_taken` |
| 9 | Duplicate licence | 409 `license_taken` |
| 10 | `role: "admin"` | 400 |
| 11 | Department not matching specialty | 400 `department_specialty_mismatch` |
| 12 | Forced mid-provisioning failure | 0 orphans |
| 13 | Activate with the returned token | 200, `active`, password verifies |
| 14 | Replay the token | 400 `token_invalid` |
| 15 | Expired token | 400 `token_expired` |
| 16 | Suspend without `reason` | 400 |
| 17 | Suspend with `reason` | 200 + audit + `privilege_changed` event |
| 18 | Change own status | 403 `self_lockout` |
| 19 | `pending_activation → active` via status endpoint | 409 |
| 20 | Directory shape, doctor and staff | all fields, `services: []`, `nextShift: null`, `duty: "off"` |
| 21 | Verify a licence | `verified`, timestamp and actor set |
| 22 | Reject a licence | `rejected`, timestamp NULL |
| 23 | Verification on staff | 400 |
| 24 | CSRF header missing | 403 |
| 25 | Every mutation writes exactly one audit row | count matches |
| 26 | DBML parses; no table outside a group; no duplicate version prefix | CLI exit 0 |

---

## 12. Frontend handoff (if D-1 keeps the constraint)

Five files, no JSX and no styling changes:

1. **New** `src/lib/api/admin.ts` — `fetch` wrapper with `credentials: "include"` and the `x-csrf-token` header from the `medora_csrf` cookie.
2. `src/components/admin/users/UsersProvider.tsx` — `GET /api/admin/users` instead of `seedUsers`; `addUser` → `POST`.
3. `src/components/admin/doctors-staff/DoctorsStaffDirectory.tsx` — `GET /api/admin/doctors-staff` instead of `mergeMembers(users)`.
4. `src/app/admin/doctors-staff/doctors/[id]/page.tsx` — `GET /api/admin/doctors-staff/:id`.
5. `src/app/admin/doctors-staff/staff/[id]/page.tsx` — same.

Optional sixth: `AddUserForm.tsx`, one line in `confirmCreate` to await the async `addUser`, so a failed request does not show success. No JSX change.

Call both endpoints **without** filter parameters: the pages filter and paginate locally, and the directory recomputes its stat cards from the array it receives.

Cosmetic deltas: `dob` renders as `1992-09-02` rather than `Sep 2, 1992`; `department` renders as `Dermatology` rather than the mock's `Dermatology Department`; the "Demo data" badge becomes inaccurate; `services`, `availability`, `nextShift` show their existing empty states.

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Renumbering the staged plan collides with another developer's branch | Conflicting migration numbers | Do the renumber and the migrations in one commit; announce it; the runner's checksum guard catches edited files |
| No mailer exists | Invitations cannot be delivered in production | Write the `notifications` row (designed path), return the one-time token to the authenticated admin, never log it; document the mailer as required before production |
| Admin is a single point of failure | A bad status change could lock the system | Self and admin targets rejected at the service layer |
| `duty` is always `off` | The "On Duty Today" card reads 0 | Honest until stage 006; documented in the API response and the UI's empty states |
| Server-side pagination deferred | A very large directory could exceed the 2,000 cap | `pagination.hasMore` returned; documented follow-up |
| Rate limiting behind the Next proxy (`SEC-001`) | All admin traffic shares one bucket | Acceptable for a single-admin MVP; documented |
| `work_shift` is descriptive text | It is not a schedule and must not be treated as one | Column comment; scheduling remains `doctor_availability`/staff scheduling later |

---

## 14. Definition of done

- `004` and `005` apply cleanly to a disposable database and then to `medora_db`; a second run is a no-op; no duplicate version prefix exists.
- The DBML parses, every new table is in a `TableGroup`, and the three schema documents agree with the database.
- All eleven admin endpoints plus `/api/auth/activate` return the documented shapes matching `DemoUser`, `UserStats`, `DirectoryMember`.
- The §8 matrix passes; no response contains a password hash, token or session identifier.
- Provisioning is atomic; invitations are single-use and expiring; every mutation writes audit and, where relevant, security events.
- `npm test` green, including the existing 8 cases.
- `git diff` contains no change under `src/`.
- The §12 handoff is delivered (or executed, if authorised).

---

## 15. Decisions — resolved and executed

| # | Decision | Chosen | Executed as |
|---|---|---|---|
| D-1 | Frontend wiring | **(b)** non-visual data-layer change | Five files plus one handler and a new `/activate` route; no layout redesign. See §12. |
| D-2 | Migration sequencing | **(a)** renumber, admin first | `004_admin_workforce.sql` and `005_admin_account_lifecycle.sql` applied; old `004`–`013` shifted to `006`–`014` in `SCHEMA_ARCHITECTURE.md` §11. |
| D-3 | Department model | **(a)** new `departments` table | Clinical rows 1:1 with specialties, support rows without one; 15 rows seeded; delete guard added; `staff_profiles.department_id` RESTRICT. |
| D-4 | Demo data | **Added, opt-in** | `Backend/scripts/seed-demo-workforce.js` (`npm run db:seed:demo -- --confirm`). Refuses production and non-local hosts, skips existing accounts, calls the real provisioning service, uses `@medora.example` addresses. `medora_db` was not seeded. |

### D-4 usage

```bash
cd Backend
npm run db:seed:demo -- --confirm                  # provision 12 pending accounts
npm run db:seed:demo -- --confirm --activate       # also activate them, print credentials once
npm run db:seed:demo -- --confirm --links          # print one-time activation links instead
```

Verified on `medora_test`: 12 created, 0 failed; a second run created 0 and skipped 12;
`NODE_ENV=production` and a remote `DB_HOST` were both refused. `medora_db` remains at one
account (the admin) with no doctors or staff.

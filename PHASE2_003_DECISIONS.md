# Phase 2 — Decisions Required Before `003_patient_doctor_profiles.sql`

**Prepared:** 26 October 2026
**Source:** `DB.md` §7 (draft tables), §8 (open decisions), §9 (cautions)
**Status:** Decision document. No migration has been written or executed.

---

## 1. What `003` is — and what it is not

`DB.md` §7 defines the deliverable as **two artefacts**, reviewed but not executed:

1. An updated `database/medora.dbml` containing both one-to-one relationships alongside the six Phase 1 tables.
2. A new `database/migrations/003_patient_doctor_profiles.sql`.

Explicitly **not** in `003`:

- Profile API endpoints (`GET`/`PATCH /api/patients/me`, `/api/doctors/me`) — that is §8 step 5.
- Any frontend work, including moving the three discarded signup fields into My Profile.
- Admin Doctors & Staff Management — §8 step 6, a separate module.
- Any clinical data (diagnosis, allergies, medications, transcripts, reports) — §9 forbids it in a profile table.

`003` is a schema change only. It is the last artefact that must exist before any profile code can be written.

---

## 2. Decision 1 — Are date of birth, phone and gender required?

### 2.1 What is actually being decided

The surface question is "required or optional". The real question is **where the requirement lives**, because `DB.md` §7 fixes one constraint that cannot move:

> Patient Sign Up remains ONLY: `full_name`, `email`, `password`. Do not add DOB/phone/gender to public registration.

So a patient always exists before any of these three values do. That means a profile row either contains NULLs, or does not exist yet. This is why Decision 1 cannot be answered independently of Decision 2.

### 2.2 Options

| Option | Meaning | Consequence |
|---|---|---|
| **A. All optional** | Columns nullable; nothing enforced | Profile may stay empty forever; "My Profile" screen must handle missing values everywhere |
| **B. All required** | Columns `NOT NULL` | Impossible with auto-created profiles (row would need values at signup, which §7 forbids). Only works with lazy creation, and forces the patient to fill a form before the profile can exist |
| **C. Mixed** | e.g. phone required, DOB and gender optional | Same mechanics as B for the required fields; arbitrary, and hard to justify per field |
| **D. Optional in the database, required by policy** | Columns nullable; the API treats a profile as *complete* only when certain fields are present | Signup stays three fields; patients can use the app immediately; completeness becomes an explicit, testable state |

### 2.3 Recommendation — **Option D**

Nullable columns, plus a `profile_completed_at` marker maintained by the service layer.

Why:

- It is the only option that satisfies §7's three-field signup without blocking the patient from reaching the dashboard.
- "Required" becomes a product rule the API can enforce and test, rather than a database constraint that would have to be dropped the first time a patient genuinely has no phone number.
- It keeps the door open: if the team later decides DOB must be mandatory before booking an appointment, that is a service-layer rule change, not a migration.

### 2.4 Schema impact

| Column | Type | Constraint | Note |
|---|---|---|---|
| `date_of_birth` | `DATE` | nullable, `CHECK (date_of_birth > DATE '1900-01-01')` | `DATE`, not `timestamptz` — a birthday has no time or zone. "Not in the future" is validated in the API: `CURRENT_DATE` is not immutable, so putting it in a `CHECK` makes the constraint unreliable across `pg_dump`/restore |
| `phone` | `VARCHAR(32)` | nullable | Store normalised; 32 chars fits E.164 with formatting headroom |
| `gender` | `VARCHAR(20)` | nullable, `CHECK` against a fixed list | See 2.5 — the field's *meaning* is unsettled |

### 2.5 Three sub-questions this decision raises

These are not optional details; each changes the column definition.

**(a) Is the field `gender` (identity) or `sex_at_birth` (clinical)?**
They are different data with different permitted values, and only one of them is clinically useful for things like reference ranges and dosing. `DB.md` uses "gender"; `Admin.md` does not mention it. If the intent is clinical, the column should be `sex_at_birth` with values `male | female | intersex | unknown`. If the intent is demographic/respectful address, keep `gender` with values such as `female | male | non_binary | prefer_not_to_say`. **Recommendation: keep `gender` as the patient-facing field, because `DB.md` names it and no clinical use case is documented yet.**

**(b) Phone format.** E.164 (`+201234567890`) is the only format that survives international patients. Storing formatted local numbers ("010 1234 5678") makes deduplication and SMS delivery unreliable. **Recommendation: normalise to E.164 in the API, store as text, no database-level regex.**

**(c) Is there a minimum age?** Pediatric patients are in scope for the product (`Pediatrics` is a department), so a minimum age would block them. **Recommendation: no minimum age; validate only that DOB is plausible (after 1900, not future).**

---

## 3. Decision 2 — Auto-create the profile, or create it lazily?

### 3.1 Options

| Option | Mechanics | Registration change | `GET /api/patients/me` for a new patient |
|---|---|---|---|
| **A. Auto-create** | `INSERT INTO patient_profiles (user_id)` inside the existing registration transaction | One extra statement in `authService.registerPatient` | Always `200` with a stable shape, all fields null |
| **B. Lazy** | Row created on the first `PATCH` via `INSERT … ON CONFLICT (user_id) DO UPDATE` | **None** — auth module untouched | Must invent a `404`, or synthesise an empty object |
| **C. Hybrid** | Auto-create, plus a backfill for existing users | As A | As A |

### 3.2 Recommendation — **Option C (auto-create + backfill)**

Why:

- `DB.md` §7 records that *"earlier discussion favored auto-creation"*.
- It removes an entire class of client complexity: the profile screen never has to distinguish "no profile yet" from "empty profile". One shape, always.
- The backfill is trivial today: there are **0 patient accounts** in `medora_db` (only the single admin), so the `INSERT … SELECT` is a no-op that protects future environments.

### 3.3 The cost, stated plainly

This is the one decision that **touches Phase 1 code**. `authService.registerPatient` gains one `INSERT` inside a transaction that already exists. The API contract does not change — still three fields in, same response out — so it satisfies §7's *"Auth registration unchanged (name/email/password only) and still works"*. But `DB.md` §9 also says Phase 2 owns "profiles, not a rewrite of authentication", so **I want explicit approval before editing that file**, even though the edit is four lines.

If you would rather not touch auth at all, Option B is defensible. It costs a `404` contract and an upsert in `PATCH`; it does not cost correctness.

### 3.4 Backfill (included in `003` regardless of A/B/C)

```sql
INSERT INTO patient_profiles (user_id)
SELECT u.id
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r       ON r.id = ur.role_id
WHERE r.name = 'patient'
ON CONFLICT (user_id) DO NOTHING;
```

This makes `003` safe on a database that already contains patients. It inserts only for users who hold the `patient` role, and is idempotent.

---

## 4. Decision 3 — Is `specialty` free text or a normalised table?

### 4.1 Evidence from the repository

The frontend already contains **two different department vocabularies**, and they disagree:

| Source | Entries | Values |
|---|---|---|
| `src/lib/mock/departments.ts` (Admin module) | **12** | cardiology, dermatology, pediatrics, orthopedics, gynecology, ENT, ophthalmology, neurology, general medicine, psychiatry, radiology, oncology |
| `src/lib/mock/doctors.ts` (patient directory) | **6** | cardiology, dermatology, pediatrics, orthopedics, general medicine, neurology |

The six are a strict **subset** of the twelve, so the Admin list is a safe superset to seed from. But the fact that they diverged at all is the argument: free text would let the *database* diverge in the same way, and this time it would be unrepairable without data cleansing.

### 4.2 Options

| Option | Schema | Filtering a directory | Admin "Departments" module (`Admin.md` §6.4) |
|---|---|---|---|
| **A. Free text** | `specialty VARCHAR(100)` | `WHERE specialty = 'Cardiology'` misses "cardiology" and "Cardiologist" | Needs a rewrite later |
| **B. Normalised** | `specialty_id UUID FK → specialties(id)` | One join, exact match, indexable | Directly supports the planned module |
| **C. Text now, normalise later** | A now, B in a future migration | Works until it doesn't | Requires a data-cleansing migration — the most expensive path |

### 4.3 Recommendation — **Option B, normalised**, with a provisional seed

`Admin.md` §6.4 already specifies a Departments module (name, description, active status, assigned doctors). Building free text now means building that module twice.

Seed the 12 existing departments from `departments.ts`, because that list is the superset and already matches the UI vocabulary.

### 4.4 Naming — the one thing to decide here

`DB.md` says `specialty`; `Admin.md` and both mocks say **department**. These are not quite the same concept: a department is organisational (who reports where), a specialty is clinical (what the doctor practises). In this product they coincide.

| Choice | Consequence |
|---|---|
| `specialties` table, `doctor_profiles.specialty_id` | Matches `DB.md` exactly; may need renaming if departments later become organisational units with their own staff |
| `departments` table, `doctor_profiles.department_id` | Matches `Admin.md` and both frontend mocks; diverges from `DB.md`'s wording |

**Recommendation: `specialties`.** `DB.md` is the authority for the backend schema, the frontend can map `department` → `specialty` in one place, and a future `departments` table (organisational) can then reference `specialties` without a rename. Renaming a column after data exists is far more expensive than mapping a label in the UI.

### 4.5 Schema impact

`specialties(id, name, slug, is_active, created_at)` with `UNIQUE(name)` and `UNIQUE(slug)`, seeded with the 12 values. `doctor_profiles.specialty_id` is `NOT NULL` with `ON DELETE RESTRICT` — a doctor without a specialty cannot be bookable, and a specialty in use must not be deletable.

---

## 5. Decision 4 — Who may edit `license_number`?

### 5.1 Options

| Option | Who can write | Risk |
|---|---|---|
| **A. Admin only** | Admin via a future staff-management endpoint; doctor read-only | Correct, but no workflow exists yet to change a mistyped number |
| **B. Doctor may edit their own** | `PATCH /api/doctors/me` includes the field | A credential claim the holder can rewrite at will — the "verified doctor" badge becomes meaningless |
| **C. Immutable after creation** | Nobody; corrections need a new record | Safest, but awkward for genuine typos |
| **D. Doctor proposes, Admin approves** | Two-step change request | Most correct, but is a whole module — far beyond `003` |

### 5.2 Recommendation — **Option A**

`Admin.md` §6.3 requires that *"Doctor onboarding includes verification of professional credentials before clinical privileges or public bookability"*. A doctor who can rewrite their own licence number defeats that rule.

Implementation in `003` is a schema decision only — **the API enforcement belongs to step 5**:

- `license_number VARCHAR(64) NOT NULL`
- `UNIQUE` index on it — two doctors cannot hold the same licence
- The doctor's `PATCH /api/doctors/me` allowlist will exclude this column; only an admin-scoped endpoint may change it

### 5.3 One optional addition

`license_verified_at TIMESTAMPTZ NULL` and `license_verified_by UUID NULL REFERENCES users(id)`.

This records *who* checked the licence and *when*, which is what makes "verified" auditable rather than decorative. It is cheap to add now and awkward to retrofit, because the verification events that already happened would be unrecorded. **Recommendation: include both columns in `003`, populated by a future admin flow.**

---

## 6. How the decisions interact

```
D2 (auto-create)
 ├─ forces nullable columns  ──► D1 must be "optional in DB, required by policy"
 └─ adds one INSERT to authService.registerPatient  ──► needs your approval

D1 (required?)  ── no effect on D3 or D4

D3 (normalised) ── adds a table + FK ──► 003 is three tables, not two

D4 (admin-only) ── schema: NOT NULL + UNIQUE ──► enforcement deferred to step 5
```

If you choose **lazy creation (D2 = B)**, Decision 1 becomes free: you could make the columns `NOT NULL` and create the row only when the patient submits a complete form. I do not recommend it, because it forces a patient to complete a form before having a profile at all, and §7 wants the profile to be completable gradually.

---

## 7. The schema these recommendations produce

For review only. **Not executed.** The runner wraps each file in its own transaction, so the file must **not** contain `BEGIN`/`COMMIT`.

```sql
-- 003_patient_doctor_profiles.sql

-- 1. Shared updated_at maintenance for the new tables.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Patient profile — 1:1 with users.
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
    CONSTRAINT patient_profiles_dob_check
        CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01')
);

CREATE TRIGGER trg_patient_profiles_updated_at
    BEFORE UPDATE ON patient_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Specialty reference data (seeded from the existing UI vocabulary).
CREATE TABLE specialties (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL UNIQUE,
    slug       VARCHAR(100) NOT NULL UNIQUE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO specialties (name, slug) VALUES
    ('Cardiology',      'cardiology'),
    ('Dermatology',     'dermatology'),
    ('Pediatrics',      'pediatrics'),
    ('Orthopedics',     'orthopedics'),
    ('Gynecology',      'gynecology'),
    ('ENT',             'ent'),
    ('Ophthalmology',   'ophthalmology'),
    ('Neurology',       'neurology'),
    ('General Medicine','general-medicine'),
    ('Psychiatry',      'psychiatry'),
    ('Radiology',       'radiology'),
    ('Oncology',        'oncology');

-- 4. Doctor profile — 1:1 with users.
CREATE TABLE doctor_profiles (
    user_id            UUID PRIMARY KEY
                           REFERENCES users (id) ON DELETE CASCADE,
    specialty_id       UUID NOT NULL
                           REFERENCES specialties (id) ON DELETE RESTRICT,
    license_number     VARCHAR(64) NOT NULL,
    phone              VARCHAR(32) NULL,
    bio                TEXT NULL,
    professional_title VARCHAR(120) NULL,
    license_verified_at TIMESTAMPTZ NULL,
    license_verified_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_doctor_profiles_license
    ON doctor_profiles (license_number);

CREATE INDEX idx_doctor_profiles_specialty
    ON doctor_profiles (specialty_id);

CREATE TRIGGER trg_doctor_profiles_updated_at
    BEFORE UPDATE ON doctor_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Backfill: give every existing patient an empty profile.
INSERT INTO patient_profiles (user_id)
SELECT u.id
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r       ON r.id = ur.role_id
WHERE r.name = 'patient'
ON CONFLICT (user_id) DO NOTHING;
```

### What this deliberately does **not** do

- **No role enforcement in the database.** The `PRIMARY KEY` on `user_id` guarantees one profile per user; it does not guarantee the user holds the `patient` or `doctor` role. `DB.md` §7 says to enforce that in service logic. A trigger is possible but would duplicate a rule that must exist in the service anyway.
- **No change to `users.updated_at`.** That column has no trigger today. Fixing it is a separate concern and would alter an applied table; it belongs in its own migration.
- **No `department` table.** Only `specialties`, per 4.4.
- **No clinical columns**, per §9.

---

## 8. What I need from you before starting

### 8.1 Blocking — `003` cannot be written correctly without these

| # | Input | Why it blocks |
|---|---|---|
| 1 | **Decision 1**: all optional (recommended), or which fields required? | Determines nullability and whether `profile_completed_at` exists |
| 2 | **Decision 2**: auto-create (recommended) or lazy? | Determines whether `003` includes the backfill and whether auth code changes |
| 3 | **Decision 3**: normalised (recommended) or free text? And table name `specialties` vs `departments` | Determines whether `003` is two tables or three |
| 4 | **Decision 4**: admin-only (recommended), doctor-editable, or immutable? | Determines `NOT NULL`, the unique index, and the verification columns |
| 5 | **Approval to edit `authService.registerPatient`** — required only if Decision 2 = auto-create | `DB.md` §9 says Phase 2 must not rewrite auth; I will not touch that file without explicit consent |

### 8.2 Needed for the API layer (step 5), not for `003`

These can wait, but flagging them now avoids a second round of schema changes:

- Permitted values for `gender`, if the field stays as `gender` rather than `sex_at_birth`.
- Phone normalisation target (E.164 assumed) and whether non-Egyptian numbers are expected.
- Whether a minimum patient age exists.
- Whether `license_number` uniqueness is global or scoped (per country/board). Global is assumed.
- Whether `specialties` should expose a public directory later (`GET /api/doctors`), which affects whether `is_active` alone is enough or a separate "published" flag is needed.

### 8.3 Things I can determine myself — no need to supply

- Current row counts, existing schema state, and whether the backfill will affect anyone (it will not: 0 patient accounts).
- Whether `003` applies cleanly — I will test it against a disposable database before reporting, and drop that database afterwards.
- The exact `medora.dbml` syntax for the two one-to-one relations.

---

## 9. What `003` will contain when written

Mapped to `DB.md` §7's acceptance criteria:

| Criterion | How `003` satisfies it |
|---|---|
| Reviewed final fields and documented assumptions | This document, plus a comment header in the migration |
| Updated `medora.dbml` with both 1:1 relationships | `users.id --(1:0..1)--> patient_profiles.user_id` and `--> doctor_profiles.user_id` |
| New `003`, without editing applied migrations | New file only; `001`/`002` untouched and checksum-verified |
| Reliable migration history and safe baseline | Already delivered in step 3; `003` will be the first migration to run through it |
| Auth registration unchanged and still working | Unchanged unless Decision 2 = auto-create, and then only one `INSERT` |
| Profile APIs with tests | **Out of scope for `003`** — step 5 |
| Report what is implemented vs designed | Will be stated explicitly in the completion report |

**Execution policy:** I will run `003` against a throwaway database to prove it applies and rolls back cleanly, then drop that database. I will **not** apply it to `medora_db` until you say so — that is the review gate `DB.md` §7 asks for.

---

## 10. If you choose differently

| If you pick | What changes |
|---|---|
| Lazy creation | `003` drops the backfill; columns may become `NOT NULL`; `PATCH` needs an upsert; `GET` needs a 404 contract |
| Free-text specialty | `003` loses the `specialties` table; directory filtering and the Admin Departments module will need a cleansing migration later |
| Doctor-editable licence | `003` is unchanged, but `Admin.md` §6.3's verification rule becomes unenforceable and should be renegotiated explicitly |
| `departments` naming | Table and FK renamed; `DB.md` should be updated so the next reader is not misled |

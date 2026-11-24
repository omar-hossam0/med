# Medora

AI-assisted healthcare platform for patients, doctors, reception staff and administrators.

Next.js (App Router) front end with a standalone Express + PostgreSQL API.

---

## Prerequisites

| Requirement | Version used |
|---|---|
| Node.js | 22.x |
| PostgreSQL | 18 |
| npm | 10.x |

---

## Quick start

### 1. Install dependencies

The repository has **two** package trees. Both must be installed.

```bash
npm install                    # front end
npm --prefix Backend install   # API
```

### 2. Create the environment file

```bash
cp Backend/.env.example Backend/.env          # macOS / Linux
Copy-Item Backend\.env.example Backend\.env   # Windows PowerShell
```

Then edit `Backend/.env` and set `DB_USER` and `DB_PASSWORD` to your local
PostgreSQL credentials. `.env` is git-ignored — never commit it.

### 3. Create the database

The application expects a database named `medora_db`.

```sql
CREATE DATABASE medora_db WITH ENCODING 'UTF8';
```

Use the default template, collation and character type. Setting them manually
is a common cause of later comparison and index errors.

### 4. Verify the connection

```bash
npm --prefix Backend run db:test
```

Expected output:

```
PostgreSQL connection successful. Database: medora_db
```

### 5. Apply migrations

**Fresh database** — build it from the migrations:

```bash
npm --prefix Backend run db:migrate
```

**Database that already has the schema but no migration history** — for example
one migrated before `schema_migrations` existed. Inspect and record, do **not**
re-run the SQL:

```bash
npm --prefix Backend run db:baseline -- 001 002
npm --prefix Backend run db:migrate      # should report nothing pending
```

`db:baseline` verifies the live schema against the expected Phase 1 fingerprint
first. If the schema does not match, it records nothing and exits non-zero.

### 6. Create the single Admin account

Run once, interactively, and choose the credentials yourself:

```bash
npm --prefix Backend run bootstrap:admin
```

The database enforces **exactly one** Admin account. A second attempt is
rejected. This script is not a public API and must never run automatically.

### 7. Run both servers

```bash
npm run dev
```

- Front end: <http://localhost:3000>
- API: <http://localhost:5000>

The Next.js dev server proxies `/api/*` to the API, so the browser only ever
talks to port 3000.

---

## Commands

### Root

| Command | Purpose |
|---|---|
| `npm run dev` | Run API and front end together |
| `npm run dev:frontend` | Next.js only |
| `npm run dev:backend` | API only |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

### `Backend/`

| Command | Purpose |
|---|---|
| `npm run dev` | API with nodemon |
| `npm run db:test` | Verify the database connection |
| `npm run db:migrate` | Apply pending migrations, recording each one |
| `npm run db:baseline -- 001 002` | Record migrations as applied **without executing** |
| `npm run bootstrap:admin` | Create the single Admin account (interactive) |
| `npm run db:seed:demo -- --confirm` | Opt-in demo doctors and staff (`@medora.example`), local databases only |
| `npm test` | All backend suites (DB-backed suites require `DB_PASSWORD`) |
| `npm run test:offline` | Unit + RBAC suites — no database needed |
| `npm run test:db` | Auth, admin, patient, scheduling, clinical, admin-extension and reference suites |
| `npm run test:unit` / `test:rbac` / `test:new` | Focused suites |
| `npm run test:schema` | V2 schema/trigger verification against the real database |

> `db:seed:demo` writes nothing without `--confirm`. It refuses `NODE_ENV=production`
> and non-local hosts, skips accounts that already exist, and goes through the real
> provisioning service. Add `--activate` to set a generated password for each new
> account and print the credentials once.

---

## API endpoints

All routes are mounted in `Backend/server.js`. The baseline auth and admin
routes are unchanged. Every new endpoint applies `requireAuth`, a role gate,
server-side validation and record-specific access; mutations are CSRF-checked
and audited. Request bodies are snake_case, responses are camelCase.

| Family | Endpoints |
|---|---|
| Baseline | `POST /api/auth/register`, `login`, `activate`; `GET /api/auth/me`; `POST /api/auth/logout`; `GET /api/admin/check`; `GET /api/patient/check`; `GET /api/admin/users`, `/users/:id`; `POST /api/admin/users`; `PATCH /api/admin/users/:id`, `/users/:id/status`; `POST /api/admin/users/:id/invitations`; `GET /api/admin/doctors-staff`, `/doctors-staff/:id`, `/reference-data`; `PATCH /api/admin/doctors-staff/:id`; `POST /api/admin/doctors-staff/:id/verification` |
| Patient | `GET/PATCH /api/patient/profile`; `GET /api/patient/doctors`, `/doctors/:id`, `/departments`, `/dashboard`; `GET /api/patient/availability/slots`; `GET /api/patient/appointments`, `/appointments/:id`, `/appointments/:id/timeline`; `POST /api/patient/appointments`, `/appointments/:id/reschedule`, `/appointments/:id/cancel`; `GET /api/patient/medical-records`, `/medical-records/:type/:id`, `/lab-results`, `/lab-results/:id`, `/prescriptions`, `/prescriptions/:id`, `/medications`, `/reports`, `/reports/:id`, `/transcripts/:id`, `/follow-ups`; `POST /api/patient/appointment-proposals/:id/select` |
| Doctor | `GET/PATCH /api/doctor/me`; `GET/POST /api/doctor/availability`; `PATCH /api/doctor/availability/:id`; `POST /api/doctor/time-off`; `DELETE /api/doctor/time-off/:id`; `GET /api/doctor/appointments`; `POST /api/doctor/appointments/:id/start`, `/complete`; `GET /api/doctor/consultations`, `/consultations/:id`; `POST /api/doctor/consultations/:id/start`, `/complete`, `/consents`, `/consents/:consentId/revoke`, `/recordings`; `PATCH /api/doctor/consultations/:id/recordings/:recordingId`; `GET /api/doctor/consultations/:id/transcripts`, `/reports`; `GET /api/doctor/transcripts/:id`, `/reports/:id`, `/reports/:id/versions/:versionId`, `/proposals/:id`; `POST /api/doctor/transcripts`, `/transcripts/:id/versions`, `/transcript-versions/:id/review`, `/reports/:id/versions`, `/report-versions/:id/review`, `/reports/:id/publish`, `/reports/:id/withdraw`; `GET /api/doctor/patients/:id/proposals`, `/record`, `/follow-ups`; `POST /api/doctor/patients/:id/record-entries`, `/proposals/:id/review`, `/proposals/:id/apply`, `/follow-ups/:id/accept`, `/decline`, `/proposals` |
| Staff | `GET /api/staff/me`, `/dashboard`, `/patients/:id`, `/appointments`, `/appointments/:id`; `PATCH /api/staff/appointments/:id/schedule`, `/notes`; `POST /api/staff/appointments/:id/confirm`, `/check-in`, `/start`, `/complete`, `/no-show`; `POST /api/staff/appointment-proposals/:id/book` |
| Notifications | `GET /api/notifications`, `/notifications/unread-count`; `PATCH /api/notifications/:id/read` |
| Admin extensions | `GET /api/admin/dashboard`; `GET /api/admin/ai/reports`, `/summary`, `/daily-series`, `/doctors/ranking`, `/health`, `/activities`, `/reports/:id/events`; `GET /api/admin/departments`; `POST /api/admin/departments`; `PATCH /api/admin/departments/:id`; `PUT /api/admin/departments/:id/doctors`, `/services` |
| Reference / RAG | `GET /api/reference/documents`, `/documents/:id`, `/versions/:id/chunks`, `/rag/queries/:id`; `POST /api/reference/documents`, `/versions`, `/versions/:id/extraction`, `/quality-review`, `/approve`, `/index`, `/rag/query` |
| Internal agents | `POST /api/internal/agents/transcription`, `/reports`, `/profile-organization`, `/follow-up-scheduling`, `/extraction` — `x-service-token` only |

See `docs/FRONTEND_API_HANDOFF.md` for response shapes and `docs/API_DECISIONS.md`
for the decisions log.

---

## Database

One database (`medora_db`), one PostgreSQL schema (`public`), one ERD
(`database/medora.dbml`), one versioned migration per schema change.

```
database/
├── medora.dbml                       # design reference — not executable
├── medora.dbdiagram                  # dbdiagram.io layout
└── migrations/
    ├── 001_identity_access.sql          # identity, RBAC seeds
    ├── 002_single_admin_enforcement.sql
    ├── 003_patient_doctor_profiles.sql  # profiles, specialties
    ├── 004_admin_workforce.sql          # departments, locations, staff profiles
    ├── 005_admin_account_lifecycle.sql  # invitations, notifications, audit
    ├── 006_audit_logs_unification.sql   # 2 read views
    ├── 007_scheduling_core.sql          # availability, appointments, care access
    ├── 008_consultations_transcripts.sql
    ├── 009_agent_reports.sql
    ├── 010_followups_proposals.sql
    ├── 011_medical_records.sql
    ├── 012_reference_knowledge.sql
    └── 013_audit_identity_reference.sql
```

### Tables

| Group | Tables |
|---|---|
| Identity (001) | `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions` |
| Profiles / workforce (003, 004) | `patient_profiles`, `specialties`, `doctor_profiles`, `clinic_locations`, `departments`, `staff_profiles` |
| Lifecycle / audit (005, 006, 013) | `user_invitations`, `notifications`, `audit_logs` (+ views `v_appointment_status_timeline`, `v_security_events`) |
| Scheduling (007) | `doctor_availability`, `doctor_time_off`, `appointments`, `care_relationships` |
| Consultations (008) | `consultations`, `consultation_consents`, `consultation_recordings`, `transcripts`, `transcript_versions`, `agent_executions` |
| Reports (009) | `medical_reports`, `report_versions`, `record_update_proposals` |
| Follow-up (010) | `follow_ups`, `appointment_proposals` |
| Medical record (011) | `medical_conditions`, `patient_medications`, `patient_allergies`, `medical_history_entries`, `test_orders`, `test_results` |
| Reference (012) | `reference_documents`, `reference_document_versions`, `reference_chunks`, `rag_queries`, `rag_citations` |
| Migration history | `schema_migrations` (managed by the runner) |

The doctor foreign key is always `doctor_user_id` (or `ordered_by_doctor_user_id`
on `test_orders`). There is no `doctor_id` column.

### Migration rules

1. **Never edit an applied migration.** The runner stores a checksum and will
   refuse to proceed if a recorded file changes.
2. **Never re-run migrations against a populated database.** Use `db:baseline`
   for a database that already has the schema.
3. **One change per new file**, numbered sequentially (`003_...`).
4. `schema_migrations` is the source of truth for what has been applied. The
   runner creates it automatically.

### Roles

| Role | Created by | Notes |
|---|---|---|
| `patient` | Public sign-up | Name, email, password only |
| `admin` | `bootstrap:admin` | Exactly one per database |
| `doctor` | Admin provisioning | Never self-registers; needs a verified licence |
| `receptionist` | Admin provisioning | Represents operational staff (`staff` in the UI) |

Internal AI agents are **service workflows**, not human roles. Set
`AGENT_SERVICE_TOKEN` in `Backend/.env` to enable `/api/internal/agents/*`;
without it those routes fail closed with HTTP 503.

---

## Project structure

```
Backend/
├── server.js                 # Express entry point
├── config/db.js              # pg pool
├── routes/                   # auth, admin, admin extensions, patient, doctor, staff,
│                             # notifications, reference, internal agents
├── controllers/              # thin HTTP handlers (no SQL)
├── services/                 # business logic, SQL, transaction owner
├── middleware/               # auth, CSRF, service auth, rate limiting, errors
├── utils/                    # validators, httpError, serializers, dbHelpers
├── scripts/                  # migrate, baseline, bootstrap-admin
└── tests/                    # unit, RBAC and DB-backed endpoint suites

src/
├── app/                      # App Router routes
├── components/               # UI, grouped by area
└── lib/                      # auth context, helpers, mock data
```

---

## Troubleshooting

**`SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`**
`DB_PASSWORD` is missing from `Backend/.env`.

**`password authentication failed`**
The password in `Backend/.env` is wrong, or `DB_USER` names a different role.

**`relation "users" already exists`**
The database already has the schema but no migration history. Run
`npm run db:baseline -- 001 002`, then `db:migrate`.

**`ECONNREFUSED`**
PostgreSQL is not running, or `DB_HOST`/`DB_PORT` are wrong. On Windows the
service is `postgresql-x64-18`.

---

## Documentation

| File | Contents |
|---|---|
| `AGENTS.md` | Repository conventions and coding rules |
| `BACKEND_ENDPOINT_IMPLEMENTATION_GUIDE.md` | Endpoint specification this API implements |
| `docs/API_DECISIONS.md` | Decisions log for §12 open items and implementation deviations |
| `docs/FRONTEND_API_HANDOFF.md` | API client conventions, response shapes, remaining mock-only screens |
| `Admin.md` | Admin module product context |
| `PatientJourney.md` | Patient journey change summary |
| `DB_NEXT_STEP.md` | Backend roadmap analysis and next step |
| `PHASE2_003_DECISIONS.md` | Phase 2 schema decisions and trade-offs |
| `CHANGES_AND_NEXT_STEPS.md` | Full record of changes made and the work remaining |
| `audit/` | Back-end audit report and coverage ledger |

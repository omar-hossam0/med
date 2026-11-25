# Medora Backend — Implementation Overview

**Last reviewed:** 25 November 2026
**Scope:** Backend code and database migrations present in this repository. This document describes implemented behavior, recorded verification, and known gaps; it does not treat product plans or frontend mock data as proof of implementation.

> **Important:** A checked-in migration is not proof that it has been applied to a particular developer's PostgreSQL instance. Local databases are separate. The repository currently contains migrations `001`–`013`; check the target database's `schema_migrations` table before relying on its state.

## Contents

1. [Executive summary](#1-executive-summary)
2. [Architecture and request flow](#2-architecture-and-request-flow)
3. [Runtime configuration and local operation](#3-runtime-configuration-and-local-operation)
4. [Database foundation and migrations](#4-database-foundation-and-migrations)
5. [End-to-end backend workflows](#5-end-to-end-backend-workflows)
6. [HTTP API inventory](#6-http-api-inventory)
7. [Authorization, security, and audit](#7-authorization-security-and-audit)
8. [Validation, transactions, and API conventions](#8-validation-transactions-and-api-conventions)
9. [Testing and verification](#9-testing-and-verification)
10. [Implemented boundaries and remaining gaps](#10-implemented-boundaries-and-remaining-gaps)
11. [Related repository documents](#11-related-repository-documents)

## 1. Executive summary

Medora has a standalone Node.js/Express API backed by PostgreSQL. The backend has grown beyond the original authentication and admin APIs: it now contains role-scoped patient, doctor, receptionist/staff, notification, reference-knowledge, and internal agent surfaces, together with services for scheduling, clinical review, longitudinal records, follow-up, and operational dashboards.

The main implemented workflow is:

1. Patients register; administrators provision doctor and staff accounts.
2. Patients request appointments; staff performs operational scheduling and confirmation.
3. Doctors work with assigned consultations and explicit consent/recording metadata.
4. Transcript content is versioned and must be approved by a doctor before it can feed report generation.
5. Report versions remain drafts until reviewed. Only an approved Report 1 can be published to the patient.
6. Approved Report 2 can feed record-update proposals; a doctor reviews proposals before they change the longitudinal record.
7. Follow-up recommendations and proposed slots remain distinct from confirmed appointments.
8. Reference documents move through extraction, quality review, approval, and indexing before their passages can be used by the current RAG query implementation.

**Important scope distinction:** The API and database workflows for agent executions exist, but this repository does not configure an LLM, speech-to-text engine, OCR engine, email provider, or vector database. Internal endpoints coordinate and record work; an external worker must supply model/extraction output. Where no provider output or schema-backed data exists, the API returns draft scaffolding or honest empty values rather than fabricated clinical content.

## 2. Architecture and request flow

### 2.1 Stack and layers

- **Runtime:** Node.js, CommonJS JavaScript, Express.
- **Database:** PostgreSQL via the shared `pg` connection pool.
- **Application entry point:** [`Backend/server.js`](Backend/server.js).
- **Database configuration:** [`Backend/config/db.js`](Backend/config/db.js).
- **Code organization:** route → controller → service → database pool/client.

The `server.js` application sets up credentialed CORS, cookie parsing, JSON and URL-encoded body parsing, the health endpoint, route mounts, and the final error handler. Controllers adapt HTTP input/output and call services. Services own business rules, SQL, transactions, and domain validation. The database is the final enforcement layer for relational constraints and clinical workflow triggers.

The Next.js development setup rewrites `/api/...` to the backend on port `5000`; browser requests normally use the relative `/api/...` path. The frontend and backend are separate npm package trees.

### 2.2 Route mounts

| Prefix | Main responsibility |
|---|---|
| `/api/auth` | Registration, login, account activation, current session, logout |
| `/api/admin` | User/workforce administration, reference data, dashboard, AI operations monitoring, departments |
| `/api/patient` | Patient profile, doctor directory, appointments, clinical portal, follow-ups |
| `/api/doctor` | Doctor workspace, availability, consultations, clinical review, patient chart |
| `/api/staff` | Reception and appointment operations |
| `/api/notifications` | Current user's notifications |
| `/api/reference` | Medical reference document lifecycle and RAG |
| `/api/internal/agents` | Service-to-service agent execution endpoints |

Two demonstration authorization checks are also mounted at `/api/admin/check` and `/api/patient/check`. They are useful for verifying role-gated access but are not core clinical workflows.

### 2.3 Error handling

Services pass errors to Express. The centralized handler returns a stable JSON error envelope and avoids exposing stack traces, SQL details, or server error messages to clients. Deliberate errors can include a machine-readable `code`; validation errors can include an `errors` array. Server errors are logged internally.

## 3. Runtime configuration and local operation

### 3.1 Environment variables

The safe template is [`Backend/.env.example`](Backend/.env.example). It documents:

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `PORT` | HTTP port; defaults to `5000` |
| `NODE_ENV` | Cookie and CORS production behavior |
| `FRONTEND_ORIGIN` | Explicit credentialed frontend origin |
| `AGENT_SERVICE_TOKEN` | Credential for internal agent routes |

The server loads the backend `.env` and then the process environment. Never commit a real `.env`, passwords, or service tokens. If `AGENT_SERVICE_TOKEN` is missing, internal agent routes fail closed with HTTP `503`; a missing secret does not grant access.

In development, loopback HTTP(S) origins are accepted to accommodate alternate local Next.js ports. In production, the explicit allowed origins apply. Session cookies are `HttpOnly`; production cookies use `Secure` and `SameSite=Strict`.

### 3.2 Common setup and commands

From the repository root, the README documents these main steps:

```powershell
npm install
npm --prefix Backend install
Copy-Item Backend\.env.example Backend\.env
npm --prefix Backend run db:test
npm --prefix Backend run db:migrate
npm run dev
```

Set local PostgreSQL credentials in `Backend\.env` before connecting. For an existing schema with no migration-history table, the documented baseline procedure is intentionally explicit, for example `npm --prefix Backend run db:baseline -- 001 002`; do not baseline or migrate a populated database without first inspecting its state.

Other useful backend commands:

| Command | Purpose |
|---|---|
| `npm --prefix Backend run db:migrate` | Apply pending migrations |
| `npm --prefix Backend run db:baseline -- <versions>` | Record explicitly named existing migrations without executing their SQL |
| `npm --prefix Backend run db:validate` | Compare canonical DBML with the connected database |
| `npm --prefix Backend run bootstrap:admin` | Interactive initial Admin provisioning; run only when explicitly intended |
| `npm --prefix Backend test` | Run configured backend suites |
| `npm --prefix Backend run test:offline` | Unit and RBAC tests without the database-backed suites |
| `npm --prefix Backend run test:schema` | Verify schema and database-enforced workflows against the configured database |

## 4. Database foundation and migrations

### 4.1 Migration history

The migration files currently checked in are:

| Migration | Main area |
|---|---|
| `001_identity_access.sql` | Users, roles, role assignment, permissions, role-permission mapping, sessions |
| `002_single_admin_enforcement.sql` | Database enforcement for the single-Admin policy |
| `003_patient_doctor_profiles.sql` | Patient and doctor profiles, specialties |
| `004_admin_workforce.sql` | Clinic locations, departments, staff profiles, workforce support |
| `005_admin_account_lifecycle.sql` | Invitations, notifications, initial audit/security lifecycle |
| `006_audit_logs_unification.sql` | Consolidated audit model and audit/timeline views |
| `007_scheduling_core.sql` | Doctor availability, time off, appointments, care relationships |
| `008_consultations_transcripts.sql` | Consultations, consent, recording metadata, transcripts, transcript versions, agent executions |
| `009_agent_reports.sql` | Reports, report versions, record-update proposals and approval constraints |
| `010_followups_proposals.sql` | Follow-ups and appointment proposals |
| `011_medical_records.sql` | Conditions, medications, allergies, history, test orders and results |
| `012_reference_knowledge.sql` | Reference documents/versions/chunks, RAG queries and citations |
| `013_audit_identity_reference.sql` | Follow-up integration corrections to audit, identity, and reference schema |

No `014_*.sql` migration is present in the current repository snapshot. Previously applied migration files must remain immutable; schema changes require a newly numbered and approved migration.

### 4.2 Migration runner safeguards

[`Backend/scripts/migrate.js`](Backend/scripts/migrate.js) and its helper [`Backend/scripts/lib/migrations.js`](Backend/scripts/lib/migrations.js):

- Discover numeric-prefixed SQL migration files in filename order.
- Track applied versions, filenames, checksums, and timestamps in `schema_migrations`.
- Normalize CRLF to LF before calculating SHA-256 checksums, avoiding false drift on mixed Windows/Linux teams.
- Refuse to continue if an already-applied migration's checksum differs from the file.
- Serialize concurrent runners with a PostgreSQL advisory lock.
- Apply each migration and its history row in a transaction; roll back that migration if it fails.
- Do not drop or reset data.

[`Backend/scripts/baseline.js`](Backend/scripts/baseline.js) is a separate, opt-in utility for recording explicitly named migrations on a database that already has the Phase 1 schema but no history. It inspects the live schema first and records no SQL as executed.

### 4.3 Schema domains

The schema is grouped around shared identity and domain workflows rather than separate user tables for each dashboard:

- **Identity and authorization:** `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions`.
- **Profiles/workforce:** `patient_profiles`, `doctor_profiles`, `specialties`, `clinic_locations`, `departments`, `staff_profiles`.
- **Account lifecycle and operations:** `user_invitations`, `notifications`, `audit_logs`; views include `v_appointment_status_timeline` and `v_security_events`.
- **Scheduling and care access:** `doctor_availability`, `doctor_time_off`, `appointments`, `care_relationships`.
- **Consultation and transcript:** `consultations`, `consultation_consents`, `consultation_recordings`, `transcripts`, `transcript_versions`, `agent_executions`.
- **Reports and proposals:** `medical_reports`, `report_versions`, `record_update_proposals`, `follow_ups`, `appointment_proposals`.
- **Longitudinal patient record:** `medical_conditions`, `patient_medications`, `patient_allergies`, `medical_history_entries`, `test_orders`, `test_results`.
- **Medical reference knowledge:** `reference_documents`, `reference_document_versions`, `reference_chunks`, `rag_queries`, `rag_citations`.

The schema verification suite expects 42 base tables, 13 migrations, and two views. A historical integration report records successful application and verification against particular development/test databases; that is not evidence that the current machine's database is at the same migration level. Use `db:test`, `db:migrate`, `db:validate`, and the schema suite against the intended database to verify it.

## 5. End-to-end backend workflows

### 5.1 Account creation, activation, and sessions

**Patient self-registration**

1. `POST /api/auth/register` accepts full name, email, and password.
2. The service validates and normalizes the email, hashes the password with Argon2id, and assigns the `patient` role on the server.
3. It creates the user, role link, and initially empty `patient_profiles` row in one transaction.
4. Doctor and staff accounts are not self-registered through this endpoint.

**Administrator-provisioned accounts**

1. An Admin with the relevant staff-account permissions creates a doctor or receptionist/staff account.
2. The account is created in a pending activation state and a single-use invitation is issued.
3. The raw invitation token is returned once to the authenticated Admin; only its SHA-256 hash is stored. The invite is valid for seven days.
4. `POST /api/auth/activate` consumes the token, hashes the submitted password, activates the account, and marks the invitation used. Password reset tokens use a shorter 24-hour lifetime; completing a reset revokes the user's existing sessions.

There is no email delivery provider in the backend yet. A notification row can record intent, while actual token delivery is out of band.

**Login and logout**

1. `POST /api/auth/login` authenticates any active account using a common flow and is rate limited.
2. The service generates an opaque random session token, stores only its SHA-256 hash in `sessions`, and returns the raw token only in an `HttpOnly` `medora_session` cookie.
3. The login response also includes a session-bound CSRF token. A readable `medora_csrf` cookie allows the frontend to echo the same value in `x-csrf-token`.
4. Authenticated requests resolve the session from the cookie (or supported Bearer header), then load current roles and permissions.
5. `POST /api/auth/logout` revokes the server-side session and clears cookies.

Session lifetime is seven days. Expired, revoked, or inactive-account sessions do not authenticate.

### 5.2 Patient profile, directory, and dashboard

- Patients can retrieve and update their own profile; the update endpoint uses an allowlist of demographic fields.
- The doctor directory only includes active, verified doctors.
- Patient dashboard and directory response serializers shape database values for the frontend.
- Data with no backing schema/source is represented honestly. In particular, patient dashboard vitals and patient messages are empty arrays rather than synthetic records.

### 5.3 Appointment scheduling and reception operations

**Availability and slot generation**

1. Doctor availability is defined by recurring windows, effective dates, consultation type, clinic location, and slot duration.
2. The API generates slots in the relevant clinic timezone (defaults to `Africa/Cairo` when not specified).
3. Slots are filtered against doctor time off, live appointments, active appointment proposals, and a one-hour lead time.
4. A slot displayed as free is not treated as a reservation. The service checks it again inside the transaction that creates or books the appointment, preventing concurrent requests from relying on stale availability.

**Patient request**

1. The patient submits an appointment request for a selected doctor and slot.
2. It creates a `requested` appointment and a care relationship; it does not silently mark the request confirmed.
3. Staff uses the scheduling/confirmation endpoints to manage the front-desk workflow and confirm the booking.

**Staff scheduling**

Staff can schedule/update an appointment, confirm it, check the patient in, start or complete the appointment, record a no-show, and maintain internal operational notes. Staff responses may contain `internalNotes`; patient responses never expose them. Appointment `start` and `complete` actions are also available to the doctor where appropriate.

**Reschedule, cancel, and concurrency**

- Patient reschedule/cancel requests use an optimistic `version` value.
- A reschedule marks the old appointment as rescheduled and creates a replacement linked to it, preserving the old record rather than overwriting history.
- Cancellation requires one of the defined cancellation reasons.
- Slot conflicts and stale versions surface as conflict errors rather than success-shaped responses.
- Every appointment status transition is audited in the same transaction and appears in `v_appointment_status_timeline`.

### 5.4 Consultations, consent, and recording metadata

Consultation records are associated with appointments and patients. The backend creates a consultation as part of the relevant confirmation/proposal-booking workflow, ensuring there is a record to attach clinical activity to.

Doctors can start or complete consultations, record consent decisions, revoke consent, and register/update recording metadata. Consent types include audio recording, transcription, and AI-assisted documentation. Recording metadata is not the same as storing audio bytes: the backend does not itself provide audio file storage or a recording capture engine. Audio recording must be consented to; a recording request without the required granted audio-recording consent is rejected.

### 5.5 Transcripts, reports, and doctor approval

**Transcript lifecycle**

1. A transcript can be registered manually or supplied through an internal transcription workflow.
2. Transcript text is stored in version rows, with content format/hash and source attribution.
3. Corrections create new versions instead of rewriting previously reviewed text.
4. A doctor reviews a specific version and records an approval/rejection decision.
5. Database triggers maintain status and protect reviewed versions from unauthorized changes.

**Report lifecycle**

1. Agent 1 is allowed to consume only a doctor-approved transcript version.
2. The backend creates the three report types: patient summary (Report 1), structured profile (Report 2), and medical report (Report 3).
3. If no model output is supplied by a worker, the service creates an honest draft scaffold (`generated: false`, empty sections); it does not invent clinical prose.
4. Doctors create/edit report versions and review a specific version.
5. Only an approved Report 1 can be published to a patient. Patient report endpoints return published/released Report 1 content only.
6. Report 3 remains a doctor-facing draft/review artifact with no publication path or patient visibility.

The API does not directly set trigger-managed report/transcript status fields as a shortcut; the review and publication operations drive the transitions, and the database enforces their prerequisites.

### 5.6 Agent 2 proposals and longitudinal medical record

1. Agent 2 receives an approved Report 2 version as its source.
2. It produces record-update proposals (for example create, update, resolve, discontinue, or correct operations against supported record entity types).
3. A doctor reviews each proposal and can approve/reject it.
4. Applying an accepted proposal writes the appropriate clinical record row with provenance, source/report linkage, actor, and audit history.
5. Corrections/supersessions preserve the earlier fact; the implementation does not silently overwrite historical clinical facts.

The patient portal exposes supported medical-record, test/lab, prescription, medication, report, and transcript reads after patient ownership checks. Prescriptions are derived from `patient_medications`; preliminary test results are excluded from the patient-facing lab results. Imaging and document sections are not backed by dedicated implemented storage tables/endpoints and remain empty/unavailable.

### 5.7 Follow-up recommendations and Agent 3

- Doctors can accept or decline follow-up recommendations and create appointment proposals for candidate time slots.
- Patients can view recommendations/proposals and select an eligible proposal.
- Staff can book a selected proposal into an appointment.
- Booking rechecks availability, creates the appointment and care relationship as appropriate, creates/ensures its consultation, and records the relevant audit transition.
- A recommendation is not a proposed slot; a proposal is not a confirmed appointment. Follow-up status changes to scheduled only when booking is actually confirmed.
- Expired proposals and slot conflicts return explicit conflicts.

Agent 3 scheduling routes record service execution and proposals; they do not themselves make a silent booking.

### 5.8 Notifications

Authenticated users can list their own notifications, retrieve their unread count, and mark their own notifications read. The notification APIs are owner-scoped. Notifications are not a substitute for clinical report publication or an external email delivery system.

### 5.9 Reference documents, extraction, and RAG

The reference library is a separate knowledge domain; it is not patient clinical storage.

1. Admin registers a reference document and a version with file metadata and a storage reference.
2. An internal extraction worker supplies normalized extracted text and links it to an agent execution. The code supports extraction status and quality review; it does not itself run OCR.
3. A doctor or Admin quality-reviews and approves a version.
4. An internal service indexes only an approved version and its chunks.
5. A doctor sends a rate-limited RAG query. Retrieval is lexical over approved indexed chunks and stores query/citation records.
6. The current RAG response returns retrieved source excerpts with citations. If evidence is insufficient, it returns an explicit insufficient-evidence outcome rather than a generated diagnosis or treatment recommendation.

No embedding provider or vector database is configured; `embedding_ref` remains an opaque field and no vector extension/schema addition is assumed.

### 5.10 Admin operational surfaces

The original Admin APIs cover user management, staff/doctor directory, verification, invitations, and reference data. Added surfaces expose an operational dashboard, AI execution/report monitoring, and department operations.

Admin dashboard and AI monitoring are designed to contain operational information, not clinical narratives or unrestricted patient charts. Patient labels in operational results are masked. Department fields unsupported by the current schema return honest defaults; operations that would need unapproved persistence (such as department services) return a dependency conflict rather than pretending to save values.

## 6. HTTP API inventory

All routes below are mounted by [`Backend/server.js`](Backend/server.js). This inventory summarizes the current route families; request bodies generally use `snake_case`, while patient-facing response serializers provide UI-oriented `camelCase` fields. See the [frontend API handoff](docs/FRONTEND_API_HANDOFF.md) for detailed payload shapes and conventions.

### 6.1 Health and authentication

| Method | Path | Access / purpose |
|---|---|---|
| `GET` | `/` | Public health response |
| `POST` | `/api/auth/register` | Public patient registration |
| `POST` | `/api/auth/login` | Public, rate-limited common login |
| `POST` | `/api/auth/activate` | Public, rate-limited invite/password-reset token consumption |
| `GET` | `/api/auth/me` | Authenticated current user |
| `POST` | `/api/auth/logout` | Authenticated session revocation; CSRF protected |

### 6.2 Admin

**Existing administration**

| Methods | Paths |
|---|---|
| `GET` | `/api/admin/users`, `/api/admin/users/:id` |
| `POST`, `PATCH` | `/api/admin/users`, `/api/admin/users/:id`, `/api/admin/users/:id/status`, `/api/admin/users/:id/invitations` |
| `GET` | `/api/admin/doctors-staff`, `/api/admin/doctors-staff/:id`, `/api/admin/reference-data` |
| `PATCH`, `POST` | `/api/admin/doctors-staff/:id`, `/api/admin/doctors-staff/:id/verification` |

**Operational extensions**

| Methods | Paths |
|---|---|
| `GET` | `/api/admin/dashboard` |
| `GET` | `/api/admin/ai/reports`, `/api/admin/ai/summary`, `/api/admin/ai/daily-series`, `/api/admin/ai/doctors/ranking`, `/api/admin/ai/health`, `/api/admin/ai/activities`, `/api/admin/ai/reports/:id/events` |
| `GET`, `POST`, `PATCH` | `/api/admin/departments`, `/api/admin/departments/:id` |
| `PUT` | `/api/admin/departments/:id/doctors`, `/api/admin/departments/:id/services` |

All Admin routes require an authenticated Admin. The baseline user/workforce routes additionally check the relevant granular permissions; mutations are rate-limited and CSRF-checked.

### 6.3 Patient

All routes require an authenticated patient session.

| Methods | Paths |
|---|---|
| `GET`, `PATCH` | `/api/patient/profile` |
| `GET` | `/api/patient/doctors`, `/api/patient/doctors/:id`, `/api/patient/departments`, `/api/patient/dashboard` |
| `GET` | `/api/patient/availability/slots` |
| `GET` | `/api/patient/appointments`, `/api/patient/appointments/:id`, `/api/patient/appointments/:id/timeline` |
| `POST` | `/api/patient/appointments`, `/api/patient/appointments/:id/reschedule`, `/api/patient/appointments/:id/cancel` |
| `GET` | `/api/patient/medical-records`, `/api/patient/medical-records/:type/:id` |
| `GET` | `/api/patient/lab-results`, `/api/patient/lab-results/:id`, `/api/patient/prescriptions`, `/api/patient/prescriptions/:id`, `/api/patient/medications` |
| `GET` | `/api/patient/reports`, `/api/patient/reports/:id`, `/api/patient/transcripts/:id`, `/api/patient/follow-ups` |
| `POST` | `/api/patient/appointment-proposals/:id/select` |

### 6.4 Doctor

All routes require the doctor role. Clinical record reads and mutations also verify assignment/care access.

| Workflow | Paths |
|---|---|
| Profile and schedule | `/api/doctor/me`; `/api/doctor/availability`; `/api/doctor/time-off` |
| Appointments | `/api/doctor/appointments`; `/api/doctor/appointments/:id/start`; `/api/doctor/appointments/:id/complete` |
| Consultations and consent | `/api/doctor/consultations`, `/api/doctor/consultations/:id`, consultation `start`, `complete`, `consents`, and `recordings` subroutes |
| Transcripts | Consultation transcript listing, transcript detail/creation/version routes, and transcript-version review |
| Reports | Consultation report listing, report/version reads and writes, report-version review, publish, and withdraw |
| Patient chart/proposals | `/api/doctor/patients/:id/record`, `/api/doctor/patients/:id/record-entries`, patient proposal listing, proposal detail/review/apply |
| Follow-up | Patient follow-up listing; follow-up accept/decline; follow-up proposal creation |

### 6.5 Receptionist/staff

Staff endpoints require an authenticated `receptionist` or `staff` role plus `appointments.manage`, except the explicitly shared doctor/staff appointment start/complete transitions.

| Method | Path |
|---|---|
| `GET` | `/api/staff/me`, `/api/staff/dashboard`, `/api/staff/patients/:id`, `/api/staff/appointments`, `/api/staff/appointments/:id` |
| `PATCH` | `/api/staff/appointments/:id/schedule`, `/api/staff/appointments/:id/notes` |
| `POST` | `/api/staff/appointments/:id/confirm`, `/api/staff/appointments/:id/check-in`, `/api/staff/appointments/:id/start`, `/api/staff/appointments/:id/complete`, `/api/staff/appointments/:id/no-show`, `/api/staff/appointment-proposals/:id/book` |

### 6.6 Notifications, reference, and internal agents

| Prefix | Methods and paths | Access |
|---|---|---|
| `/api/notifications` | `GET /`, `GET /unread-count`, `PATCH /:id/read` | Session; data scoped to owner |
| `/api/reference` | `GET /documents`, `/documents/:id`, `/versions/:id/chunks`, `/rag/queries/:id`; `POST /documents`, `/versions`, version `extraction`, `quality-review`, `approve`, `index`, and `/rag/query` | Doctor/Admin for library reads; Admin for source registration; service token for extraction/indexing; doctor for RAG |
| `/api/internal/agents` | `POST /transcription`, `/reports`, `/profile-organization`, `/follow-up-scheduling`, `/extraction` | Service token only; requires an idempotency key |

## 7. Authorization, security, and audit

### 7.1 Authentication and access gates

- Browser authentication uses server-side PostgreSQL sessions; raw session tokens are not stored in the database.
- Route middleware supports authentication, role checks, all-required permission checks, and any-of permission checks.
- Route-level role checks do not replace record-level authorization.
- Doctors need a relevant active care relationship, assigned appointment, or consultation access for clinical data. Patient endpoints are scoped to the logged-in patient.
- Admin and receptionist/staff roles do not automatically grant access to private clinical content.
- Internal agents are service workflows, not human roles. Their routes accept a service token and do not accept a browser session as a substitute.

### 7.2 CSRF, CORS, and rate limits

State-changing browser-session requests use a session-bound HMAC CSRF token with a double-submit cookie/header check and a cross-site fetch check. Internal service-token routes use service authentication rather than a browser cookie.

The code configures rate limits for login, activation, Admin mutations, clinical reads, clinical mutations, agent runs, and RAG queries. Responses include standard rate-limit headers.

Credentialed CORS is restricted to configured origins and supported local development origins. Disallowed origins receive an explicit CORS error.

### 7.3 Validation and SQL safety

Request data is validated on the server using shared validation/database helpers. SQL values are parameterized; any variable table/column choice is selected from code-side allowlists. Database constraint failures are mapped to stable client-facing error codes where appropriate.

### 7.4 Audit and clinical provenance

- Domain mutations write audit events in the same transaction as the mutation.
- Appointment state transitions record previous/next status, source, and reason for the appointment timeline.
- Individual clinical chart access and access denials are auditable; denial records are written separately so they survive rollback of the rejected operation.
- Audit logs are append-only at the database layer.
- Clinical versions retain source links, content hashes, reviewer identity/decision, timestamps, and supersession/provenance where applicable.
- Audit metadata is intended for identifiers and operational context, not passwords, tokens, raw audio, or full clinical narratives.

## 8. Validation, transactions, and API conventions

- Multi-row account creation, appointment changes, clinical review, proposal application, and reference lifecycle mutations use database transactions.
- Slot availability is checked again inside the booking transaction.
- Patient appointment updates use optimistic concurrency (`version`) to detect stale edits.
- Agent execution records use an idempotency key and attempt number; a replay conflict is returned rather than silently running the same request as a fresh execution.
- Transcript and report versions are retained; reviewed versions are protected from mutation.
- Database triggers enforce key approval prerequisites, status transitions, and audit invariants in addition to application checks.
- API errors have a stable structure: `{ error, message, code?, errors? }`. Successful APIs generally return a success envelope; clients should still treat empty arrays, `null`, and zero as real values, not missing implementation details to fill with fake data.
- The frontend handoff documents `snake_case` request bodies, camelCase UI response shapes, ISO dates, credentialed requests, and CSRF headers for mutations.

## 9. Testing and verification

### 9.1 Test suites in the repository

The backend uses Node's built-in `node:test` runner. The configured suites cover:

- Authentication, registration, sessions, and Admin behavior.
- RBAC and unit-level validation, serializers, helper/error mapping, slot logic, service-auth behavior, and operational-data sanitization.
- Patient API and record scoping.
- Scheduling and appointment transitions.
- Clinical consultation, transcript, report, and medical-record workflows.
- Admin extensions and reference/RAG routes.
- Schema constraints and database-trigger workflows.

Scripts are declared in [`Backend/package.json`](Backend/package.json). The schema suite runs against the configured PostgreSQL database inside a transaction it rolls back; it is not a substitute for checking the target database's migration history first.

### 9.2 Verification status for this document

The repository includes a historical integration report, [`database/MEDORA_FINAL_INTEGRATION_REPORT.md`](database/MEDORA_FINAL_INTEGRATION_REPORT.md), that records migration/test results for specific databases at the time of that report. Those results are useful historical evidence, not a claim about every current local database or a fresh test run in this documentation task.

No backend test command or live-database verification was run specifically while writing this overview. For current verification, run the focused backend suites and database/schema checks against the intended development/test database; do not assume a teammate's database has the same state.

## 10. Implemented boundaries and remaining gaps

| Area | Current boundary |
|---|---|
| AI/model inference | No model provider is configured. Agent routes register executions and accept worker-supplied output; without it, draft scaffolding is returned. |
| Speech transcription | The backend provides a service workflow and transcript persistence/review path; it does not capture audio or run an STT engine itself. |
| Audio storage | Recording metadata and consent gates exist. Audio bytes/storage infrastructure are external and are not implemented by these routes. |
| OCR | Extraction status and worker-supplied normalized text are supported; no OCR engine is bundled/configured. |
| RAG | Retrieval is lexical over approved chunks and returns excerpts/citations. There is no configured vector database, embedding provider, or generated clinical answer. |
| Report 3 | Doctor-only draft/review; no patient release/publication until its purpose and destination are specified. |
| Patient portal fields | Vitals and patient messages are empty because the supporting source tables/workflows are absent. Imaging/documents are not implemented as patient-upload/storage features. |
| Prescriptions | Patient medication records are derived from `patient_medications`; no separate prescription-management subsystem is claimed. |
| Department extensions | Unsupported persisted attributes return honest defaults; services cannot be persisted without an approved schema change. |
| Email delivery | Invitations/reset tokens are hashed and single-use, but no email provider is configured; delivery is out of band. |
| Frontend connection | The API contract is available, but the handoff documents patient and some Admin screens that remain mock-driven. A backend endpoint alone does not mean a frontend screen is already integrated. |
| Database state | Migrations are checked in, but each developer's local database must be independently inspected and verified. |

These are deliberate scope and safety boundaries, not promises that the missing integrations are already available.

## 11. Related repository documents

- [Backend endpoint implementation guide](BACKEND_ENDPOINT_IMPLEMENTATION_GUIDE.md) — implementation workflow, endpoint requirements, authorization matrix, and target contracts.
- [API decisions log](docs/API_DECISIONS.md) — adopted defaults and decisions/limitations, including blocked items.
- [Frontend API handoff](docs/FRONTEND_API_HANDOFF.md) — client conventions, detailed endpoint catalog, response shapes, and mock-driven screens.
- [Database architecture V2](database/DATABASE_ARCHITECTURE_V2.md) — domain/schema walkthrough.
- [Final integration report](database/MEDORA_FINAL_INTEGRATION_REPORT.md) — historical migration consolidation and verification report.
- [Canonical DBML](database/medora.dbml) — logical schema source used by the validator.
- [Backend README and commands](README.md) — setup, local operation, and command reference.

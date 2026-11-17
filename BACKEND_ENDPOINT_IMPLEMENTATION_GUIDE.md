# Medora — Complete Backend Endpoint Implementation Guide

**Document type:** Implementation handoff specification  
**Audience:** Backend developer responsible for implementation  
**Version:** 1.0  
**Date:** 17 November 2026  
**Status:** Ready for implementation, except for the items explicitly marked **BLOCKED** in §12

---

## 0. How to read this document

| Label           | Meaning                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| **IMPLEMENTED** | Verified in the current repository. Preserve and regression-test; do not rewrite.   |
| **DESIGNED**    | The database table(s) exist in an applied migration, but no endpoint uses them yet. |
| **NEW**         | Contract specified in this document. Implement against existing tables.             |
| **BLOCKED**     | Requires a product/architecture decision before code is written (see §12).          |

**Source-of-truth order** when sources disagree: applied SQL migrations → existing backend code → this guide → frontend TypeScript contracts → historical planning documents. Frontend mocks describe *desired response shapes*, never proof that an endpoint exists.

**Golden rule:** This is a clinical system. An endpoint that returns data or performs a mutation must enforce (1) authentication, (2) role/permission, (3) record-specific access, (4) server-side validation, (5) provenance/audit, and (6) doctor approval where clinical truth is involved. Skipping any one of these is a defect, not a shortcut.

---

## 1. Scope and objective

Implement the complete Medora HTTP API so that every screen in the Next.js frontend can be backed by real, authorized PostgreSQL data, and so that the full clinical workflow described in `AGENTS.md` §4 is executable through the API.

Concretely, the work is:

1. Preserve the existing auth and admin API (§5.0) and its security model.
2. Add all patient-facing endpoints (profile, doctors, dashboard, appointments, medical records, lab results, prescriptions) that are currently 100% mock-driven.
3. Add all doctor-facing endpoints (schedule, consultations, consent, recordings, transcripts, report review, patient record access).
4. Add all receptionist/staff-facing endpoints (appointment operations, check-in, reschedule, cancel).
5. Add the clinical workflow endpoints for Agent 1 (report generation), Agent 2 (record-update proposals), and Agent 3 (follow-up/slot proposals), respecting the approval gates enforced by database triggers.
6. Add the longitudinal medical-record endpoints with provenance and supersede behaviour.
7. Add OCR/RAG reference-knowledge endpoints.
8. Add the missing admin surfaces (dashboard, AI monitoring, departments) using sanitized operational data.
9. Add tests, documentation, and a frontend handoff contract.

**Out of scope / do not invent:** Report 3's recipient and storage destination (§12 D-1); vector database choice (§12 D-2); booking-confirmation policy beyond the rules stated here (§12 D-3); any change to applied migrations `001`–`013`; any destructive SQL; any UI restyling.

---

## 2. Verified current state

### 2.1 Runtime and topology

| Item          | Verified value                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| API           | Express `5.3.0`, CommonJS, Node 22.x, port `5000` by default (`Backend/server.js`)                                         |
| Database      | PostgreSQL 18, database `medora_db`, schema `public`, `pg` pool in `Backend/config/db.js`                                  |
| Frontend      | Next.js App Router, dev server on port 3000; `next.config.mjs` rewrites `/api/:path*` → `http://localhost:5000/api/:path*` |
| Package trees | Two: root (frontend) and `Backend/`; install both                                                                          |
| Test runner   | Node built-in `node:test`, no HTTP test framework dependency                                                               |

### 2.2 Backend file structure (existing — extend, do not restructure)

```
Backend/
├── server.js                         # app, CORS, cookies, JSON, route mounts, error handler
├── config/db.js                      # pg.Pool from DB_* env vars
├── routes/
│   ├── authRoutes.js                 # /api/auth
│   └── adminRoutes.js                # /api/admin
├── controllers/                      # thin HTTP layer; req → service → res
│   ├── authController.js
│   ├── adminUsersController.js
│   ├── adminDirectoryController.js
│   └── adminReferenceController.js
├── services/                         # business logic + SQL; transaction owner
│   ├── authService.js
│   ├── invitationService.js
│   ├── auditService.js
│   ├── adminUsersService.js
│   ├── adminDirectoryService.js
│   └── adminReferenceService.js
├── middleware/
│   ├── auth.js                       # requireAuth, requireRole, requirePermission, requireAnyPermission
│   ├── csrf.js                       # generateCsrfToken, setCsrfCookie, verifyCsrf
│   ├── rateLimiter.js                # loginRateLimiter, adminActionLimiter, activationLimiter
│   └── errorHandler.js
├── utils/
│   ├── httpError.js                  # httpError(status, code, message, errors?)
│   ├── validators.js                 # Validator class (text/email/phone/date/integer/uuid/oneOf/password)
│   └── serializers.js                # DB vocabulary → UI vocabulary
├── scripts/                          # migrate, baseline, bootstrap-admin, validate-dbml, seed-demo
├── tests/
│   ├── auth.test.js
│   ├── admin.test.js
│   └── schema-v2.test.js
└── .env.example
```

New modules must follow exactly this layering: `routes → controllers → services → config/db`. Controllers never contain SQL; services never write `res.status(...)`.

### 2.3 Implemented endpoint inventory (IMPLEMENTED — regression baseline)

| Method  | Path                                        | Auth                                            | Notes                                                                                                     |
| ------- | ------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET`   | `/`                                         | public                                          | Health check                                                                                              |
| `POST`  | `/api/auth/register`                        | public                                          | Patient self-registration; name/email/password only; creates empty `patient_profiles` row transactionally |
| `POST`  | `/api/auth/login`                           | public, rate-limited                            | All roles; sets `medora_session` + `medora_csrf`; returns `csrfToken` in JSON                             |
| `POST`  | `/api/auth/activate`                        | public, rate-limited                            | Consumes one-time invite/reset token                                                                      |
| `GET`   | `/api/auth/me`                              | session                                         | Returns `{ authenticated: true, user }`                                                                   |
| `POST`  | `/api/auth/logout`                          | session + CSRF                                  | Revokes session in DB, clears cookies                                                                     |
| `GET`   | `/api/admin/check`                          | session + role `admin`                          | Demo RBAC check                                                                                           |
| `GET`   | `/api/patient/check`                        | session + role `patient`                        | Demo RBAC check                                                                                           |
| `GET`   | `/api/admin/users`                          | admin + `users.manage` OR `staff_accounts.view` | List, stats, pagination                                                                                   |
| `GET`   | `/api/admin/users/:id`                      | same                                            | Detail                                                                                                    |
| `POST`  | `/api/admin/users`                          | admin + `staff_accounts.create` + CSRF          | Provision doctor/staff + invitation                                                                       |
| `PATCH` | `/api/admin/users/:id`                      | admin + `staff_accounts.update` + CSRF          | Edit allowed fields                                                                                       |
| `PATCH` | `/api/admin/users/:id/status`               | admin + `staff_accounts.disable` + CSRF         | Status transition with reason                                                                             |
| `POST`  | `/api/admin/users/:id/invitations`          | admin + `staff_accounts.invite` + CSRF          | Resend invite / issue reset                                                                               |
| `GET`   | `/api/admin/doctors-staff`                  | admin + `staff_accounts.view`                   | Directory + stats                                                                                         |
| `GET`   | `/api/admin/doctors-staff/:id`              | same                                            | Member detail                                                                                             |
| `PATCH` | `/api/admin/doctors-staff/:id`              | admin + `staff_accounts.update` + CSRF          | Professional/employment fields                                                                            |
| `POST`  | `/api/admin/doctors-staff/:id/verification` | admin + `staff_accounts.update` + CSRF          | License verification                                                                                      |
| `GET`   | `/api/admin/reference-data`                 | admin + `staff_accounts.view`                   | Specialties, departments, locations                                                                       |

### 2.4 Database state (DESIGNED — 13 applied migrations, 42 base tables, 2 views)

| Module                            | Tables                                                                                                                        | Endpoint relevance                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Identity (001, 002)               | `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions`                                                 | Auth + RBAC                        |
| Profiles & workforce (003, 004)   | `patient_profiles`, `doctor_profiles`, `specialties`, `clinic_locations`, `departments`, `staff_profiles`                     | Patient profile, doctor directory  |
| Lifecycle & audit (005, 006, 013) | `user_invitations`, `notifications`, `audit_logs` (+ views `v_appointment_status_timeline`, `v_security_events`)              | Audit on every mutation            |
| Scheduling (007)                  | `doctor_availability`, `doctor_time_off`, `appointments`, `care_relationships`                                                | Appointments + record access       |
| Consultations (008)               | `consultations`, `consultation_consents`, `consultation_recordings`, `transcripts`, `transcript_versions`, `agent_executions` | Consultation + transcript workflow |
| Reports (009)                     | `medical_reports`, `report_versions`, `record_update_proposals`                                                               | Agent 1/2 + approvals              |
| Follow-up (010)                   | `follow_ups`, `appointment_proposals`                                                                                         | Agent 3                            |
| Medical record (011)              | `medical_conditions`, `patient_medications`, `patient_allergies`, `medical_history_entries`, `test_orders`, `test_results`    | Patient chart, labs, prescriptions |
| Reference knowledge (012)         | `reference_documents`, `reference_document_versions`, `reference_chunks`, `rag_queries`, `rag_citations`                      | OCR/RAG                            |

**Critical naming fact:** the doctor foreign key is always **`doctor_user_id`** (or `ordered_by_doctor_user_id` on `test_orders`). There is no `doctor_id` column anywhere.

**Seeded vocabularies:** 4 roles (`patient`, `doctor`, `receptionist`, `admin`); 15 permissions (§4.4); 12 specialties; 12 clinical departments + 3 support departments; 3 clinic locations.

### 2.5 Frontend integration state

| Area                                                                                     | State                                                             |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Auth (`/login`, `/signup`, `/activate`, `/api/auth/*`)                                   | IMPLEMENTED, real API                                             |
| Admin users, doctors-staff, reference-data                                               | IMPLEMENTED, real API via `src/lib/api/admin.ts`                  |
| Patient dashboard, appointments, my-doctors, medical-records, lab-results, prescriptions | **100% mock** — zero `fetch` calls; data from `src/lib/mock/*.ts` |
| Admin dashboard, AI monitoring, departments                                              | **100% mock**                                                     |
| Patient shell                                                                            | Name comes from `/api/auth/me`; everything else mock              |

**Casing contract:** existing auth/admin endpoints accept **snake_case** request bodies but return **camelCase** UI-shaped objects through `utils/serializers.js`. New patient/doctor/staff endpoints must do the same: snake_case in, exact frontend camelCase shapes out (Appendix A). This keeps the UI unchanged.

---

## 3. Non-negotiable rules

1. **Never edit applied migrations** `001`–`013`. The runner records a SHA-256 checksum (CRLF→LF normalized) and refuses to continue on drift. New schema changes require an approved `014_*.sql` (§12 D-4).
2. **Never run destructive SQL** (`DROP`, `TRUNCATE`, forced replay, admin bootstrap, seed scripts) against `medora_db` without explicit authorization. Test on a disposable database.
3. **Role is not access.** A doctor may read a patient's clinical data only with an active `care_relationships` row (`status='active'` AND (`expires_at IS NULL OR expires_at > now()`)) or an assigned consultation/appointment. Admin and Staff never receive clinical content by default.
4. **Consent gates recording.** Audio capture must be refused unless a `granted` `audio_recording` consent row exists for that consultation.
5. **Only doctor-approved inputs enter the AI chain.** Agent 1 requires an approved `transcript_versions.review_decision`; Agent 2 requires an approved Report 2 `report_versions.review_decision`. Database triggers already enforce this; the API must not try to bypass them.
6. **AI output is never clinical truth.** All agent outputs land as drafts/proposals until a doctor records a review decision.
7. **Versioned content is immutable.** Corrections create new `transcript_versions` / `report_versions` rows; medical-record corrections create new rows linked by `superseded_by_id`. No hard deletes.
8. **Only Report 1 is publishable**, and only a doctor-approved version of it. Report 3 has no publication path until decided (§12 D-1).
9. **A recommendation is not a booking.** `follow_ups`, `appointment_proposals`, and `appointments` are three distinct states; only `appointments` with `status='confirmed'` (or later) is a booking.
10. **Every status transition on `appointments` writes an `audit_logs` row** with `event_type='appointment.status_changed'`, `from_status`, `to_status`, `change_source`, `change_reason` in the same transaction.
11. **Audit logs are append-only.** Never expose a DELETE endpoint. Never place passwords, tokens, raw audio, or full clinical narratives in `before_state`, `after_state`, or `metadata`.
12. **Parameterized SQL only.** No string interpolation of user input into SQL (table/column names chosen from server-side allowlists only).
13. **The frontend is not an authorization boundary.** Every endpoint re-checks auth, role, permission, and record access server-side.


## 5. Endpoint catalogue

Each endpoint below specifies: method/path, gate, request, response, database behaviour, invariants, and audit. Implement in the phase order given in §7. All paths are mounted in `Backend/server.js` unless already present.

### 5.0 Baseline endpoints — IMPLEMENTED, preserve

Keep `POST /api/auth/register`, `login`, `activate`, `GET /me`, `POST /logout`, all `/api/admin/*` endpoints, and both `*/check` endpoints exactly as they are. Only additions allowed: new rate limiters, new audit helpers, new serializers, and new route mounts. Regression tests in `tests/auth.test.js` and `tests/admin.test.js` must remain green.

One small extension is permitted: `GET /api/patient/profile` and `PATCH /api/patient/profile` are **new** (§5.1); do not change the registration flow that creates the empty profile row.

---

### 5.1 Patient profile — NEW (Phase 2)

Mount: `app.use("/api/patient", patientRoutes)`; every route uses `requireAuth, requireRole("patient")`.

| Method  | Path                   | Purpose                      |
| ------- | ---------------------- | ---------------------------- |
| `GET`   | `/api/patient/profile` | Read own demographic profile |
| `PATCH` | `/api/patient/profile` | Complete/update demographics |

**GET /api/patient/profile**

- Query: `SELECT p.user_id, p.date_of_birth, p.phone, p.gender, p.profile_completed_at, u.full_name, u.email FROM patient_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1`.
- Row is guaranteed by registration; if missing (legacy data), return a stable empty shape with `profile_completed_at: null` — never a 404.
- Response: `{ success: true, profile: { id, full_name, email, date_of_birth, phone, gender, profile_completed_at, completed: boolean } }` (snake_case acceptable here — no existing UI contract consumes this endpoint; document the shape).
- Audit: none on read.

**PATCH /api/patient/profile**

- Body allowlist: `date_of_birth`, `phone`, `gender` (`female`, `male`, `non_binary`, `prefer_not_to_say`). Ignore all other keys, including `role`, `status`, `email`.
- Validate with `Validator.date`, `.phone`, `.oneOf`. Normalize phone to E.164 if a decision is made (§12 D-7); otherwise store trimmed as-is.
- Transaction: `UPDATE patient_profiles SET ..., profile_completed_at = CASE WHEN required fields now present AND profile_completed_at IS NULL THEN now() ELSE profile_completed_at END WHERE user_id = $1`.
- Response: same shape as GET with 200.
- Audit: `auditService.record(client, { eventType: "patient.profile_updated", eventCategory: "configuration", entityType: "user", entityId: req.user.id, before, after, ...requestContext(req) })`.
- Errors: `400 validation_error`, `403` if role differs (middleware).


### 5.3 Appointments and scheduling — NEW (Phase 3)

Mount: patient endpoints under `/api/patient/appointments`, staff endpoints under `/api/staff/appointments`, and shared availability under `/api/patient/availability`. Doctor endpoints under `/api/doctor/appointments`.

| Method  | Path                                       | Gate                                        | Purpose                                              |
| ------- | ------------------------------------------ | ------------------------------------------- | ---------------------------------------------------- |
| `GET`   | `/api/patient/availability/slots`          | patient                                     | Authoritative available slots for a doctor/date/type |
| `GET`   | `/api/patient/appointments`                | patient + `appointments.view_own`           | Own appointments                                     |
| `GET`   | `/api/patient/appointments/:id`            | patient                                     | Own appointment detail + status timeline             |
| `POST`  | `/api/patient/appointments`                | patient + `appointments.create` + CSRF      | Request/book an appointment                          |
| `POST`  | `/api/patient/appointments/:id/reschedule` | patient + CSRF                              | Propose a new slot                                   |
| `POST`  | `/api/patient/appointments/:id/cancel`     | patient + CSRF                              | Cancel with reason                                   |
| `GET`   | `/api/doctor/appointments`                 | doctor + `appointments.view_own`            | Assigned appointments only                           |
| `GET`   | `/api/staff/appointments`                  | receptionist + `appointments.manage`        | All appointments with filters                        |
| `GET`   | `/api/staff/appointments/:id`              | receptionist + `appointments.manage`        | Detail + internal notes                              |
| `PATCH` | `/api/staff/appointments/:id/schedule`     | receptionist + `appointments.manage` + CSRF | Set confirmed slot                                   |
| `POST`  | `/api/staff/appointments/:id/confirm`      | receptionist + CSRF                         | `pending_confirmation → confirmed`                   |
| `POST`  | `/api/staff/appointments/:id/check-in`     | receptionist + CSRF                         | `confirmed → checked_in`                             |
| `POST`  | `/api/staff/appointments/:id/start`        | doctor or staff + CSRF                      | `checked_in → in_progress`                           |
| `POST`  | `/api/staff/appointments/:id/complete`     | doctor or staff + CSRF                      | `in_progress → completed`                            |
| `POST`  | `/api/staff/appointments/:id/no-show`      | receptionist + CSRF                         | `confirmed/checked_in → no_show`                     |
| `PATCH` | `/api/staff/appointments/:id/notes`        | receptionist + CSRF                         | Internal operational notes only                      |
| `GET`   | `/api/patient/appointments/:id/timeline`   | patient                                     | Status history from `v_appointment_status_timeline`  |

**Slot generation (`GET /api/patient/availability/slots`)** — this replaces the frontend's hash-based simulation:

|   |   |
| - | - |

1. Validate `doctor_id` (UUID), `date` (`YYYY-MM-DD`, not in the past), `consultation_type` (`in_person|online`).
2. Load active `doctor_availability` rows for that doctor/weekday where `effective_from <= date` and (`effective_to IS NULL OR effective_to >= date`); require `consultation_type` match or `both`.
3. Split each `[start_time, end_time]` into `slot_minutes` (default 30) intervals in the clinic's timezone (`clinic_locations.timezone`, default `Africa/Cairo`).
4. Subtract `doctor_time_off` ranges overlapping the date.
5. Subtract existing `appointments` whose `scheduled_start_at`/`scheduled_end_at` overlap the slot and whose `status` is not in (`cancelled`, `no_show`), plus `appointment_proposals` with `status IN ('proposed','selected')` (partial unique index already prevents double live proposals).
6. Enforce one-hour lead time from `now()`.
7. Response: `{ success: true, date, consultation_type, slots: [{ starts_at, ends_at, time: "HH:MM", available: boolean }] }`.
8. No audit on read. Add a short in-process cache only if profiling demands it; never cache past the next slot boundary.

**POST /api/patient/appointments** (request/booking):

- Body allowlist: `doctor_id`, `specialty_id`, `clinic_location_id`, `consultation_type`, `requested_start_at`, `requested_end_at`, `reason`, `patient_notes`.
- Validate the doctor is active/verified, the specialty exists, and that the requested slot is in the generated slot set. Re-check inside the transaction (race safety). Use `appointments.version = 1`; set `booked_by_user_id = req.user.id`, `status = 'requested'` unless §12 D-3 chooses patient self-confirmation.
- Create `care_relationships` row (`source='appointment'`, `source_appointment_id`, `granted_by_user_id = req.user.id`, `status='active'`) in the same transaction so the doctor can read the chart.
- Write `audit_logs` row `appointment.created` and, if status is `requested`, a `notifications` row to staff (`category='appointment'`).
- Response 201: `{ success: true, appointment: { id, reference, status, scheduled_start_at, ... } }`. `reference` can be a deterministic human-readable string derived from `id` (e.g. `MDR-<first 8 chars of id uppercase>`) — store nothing extra.

**Reschedule / cancel:**

- Use optimistic concurrency: require `version` in the body; `UPDATE ... WHERE id=$1 AND version=$2`, assert `rowCount===1`, else `409 version_conflict`.
- Only `requested`, `pending_confirmation`, `confirmed`, `checked_in` may be rescheduled; only `requested`, `pending_confirmation`, `confirmed` may be cancelled by the patient.
- Cancellation requires `cancellation_reason` from a server-side allowlist (reuse the frontend's five reasons in `src/lib/mock/appointments.ts` as the approved list) plus optional notes; set `cancelled_at = now()`, `cancelled_by_user_id = req.user.id`.
- Every transition writes `appointment.status_changed` audit with `change_source = 'patient'` or `'staff'`.
- Response: serialized appointment.

**Staff scheduling:**

- `PATCH /schedule` sets `scheduled_start_at`, `scheduled_end_at`, `clinic_location_id`, status `pending_confirmation`, and `version = version + 1`; re-validate no conflicts inside the transaction.
- `POST /confirm` sets `status='confirmed'`, `confirmed_at`, `confirmed_by_user_id`; emits a patient `notifications` row and an audit transition.
- Check-in/complete/no-show follow the same transaction+audit pattern and enforce the CHECK constraints already present in migration 007 (e.g. `completed_at` required for `completed`).
- `GET /api/staff/appointments` supports `date`, `status`, `doctor_id`, `patient` search, `limit`, `offset`; never expose clinical notes — `internal_notes` is staff-only and must not appear in patient responses.

**GET /api/patient/appointments/:id/timeline**

- `SELECT id, from_status, to_status, reason, changed_by_user_id, change_source, changed_at FROM v_appointment_status_timeline WHERE appointment_id = $1 ORDER BY changed_at`; verify ownership first.

---

### 5.4 Consultations and consent — NEW (Phase 4)

| Method  | Path                                                       | Gate            | Purpose                                                 |
| ------- | ---------------------------------------------------------- | --------------- | ------------------------------------------------------- |
| `GET`   | `/api/doctor/consultations`                                | doctor          | Own consultations with patient summary                  |
| `GET`   | `/api/doctor/consultations/:id`                            | doctor + access | Detail (patient demographics + authorization proof)     |
| `POST`  | `/api/doctor/consultations/:id/start`                      | doctor + CSRF   | `scheduled → in_progress`, set `started_at`             |
| `POST`  | `/api/doctor/consultations/:id/complete`                   | doctor + CSRF   | `in_progress → completed`, set `ended_at`               |
| `POST`  | `/api/doctor/consultations/:id/consents`                   | doctor + CSRF   | Record patient consent                                  |
| `POST`  | `/api/doctor/consultations/:id/consents/:consentId/revoke` | doctor + CSRF   | Revoke consent                                          |
| `POST`  | `/api/doctor/consultations/:id/recordings`                 | doctor + CSRF   | Register recording metadata (no audio bytes)            |
| `PATCH` | `/api/doctor/consultations/:id/recordings/:recordingId`    | doctor + CSRF   | Update status (`pending_upload → uploaded → available`) |


**Consent rules** (enforce in service, mirroring migration 008 CHECKs):

- `consent_type ∈ {audio_recording, transcription, ai_assisted_documentation}`, `status ∈ {granted, declined, revoked}`, `method ∈ {in_person_verbal, patient_portal, written}`.
- Unique per `(consultation_id, consent_type)`; a second POST on the same pair must return `409 consent_exists` and point the caller to the revoke endpoint.
- `status='granted'` requires `granted_at`; `revoked` requires `revoked_at` and optional `revocation_reason`; `declined` cannot have `granted_at`.
- `recorded_by_user_id = req.user.id` (the doctor who obtained it).
- Registering a recording must first SELECT a `granted` `audio_recording` consent for that consultation; otherwise `403 consent_required`. Store only `storage_provider`, `storage_key`, `mime_type`, `size_bytes`, `duration_seconds`, `checksum_sha256`, `retention_expires_at`; **never accept or store audio bytes**.
- Audit: `consent.granted` / `consent.revoked` / `recording.registered` in `approval`/`configuration` categories.

**Consultation detail** returns only demographic `patient_profiles` data plus the appointment reason and active allergies (if an allergy read is approved) — no transcript or report content. Record access via `assertCareAccess` or assigned consultation.

---

### 5.5 Transcripts and doctor review — NEW (Phase 5)

| Method | Path                                         | Gate                                  | Purpose                                         |
| ------ | -------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| `GET`  | `/api/doctor/consultations/:id/transcripts`  | doctor + access                       | Transcript list for a consultation              |
| `GET`  | `/api/doctor/transcripts/:id`                | doctor + access                       | Transcript + all versions                       |
| `POST` | `/api/doctor/transcripts`                    | doctor + CSRF                         | Create a manual transcript (`source='manual'`)  |
| `POST` | `/api/doctor/transcripts/:id/versions`       | doctor + CSRF                         | Add a doctor-edited version                     |
| `POST` | `/api/doctor/transcript-versions/:id/review` | doctor + `transcripts.approve` + CSRF | Approve/reject a version                        |
| `GET`  | `/api/patient/transcripts/:id`               | patient owner                         | Only an approved transcript of own consultation |

**Rules:**

- `transcripts.status` is trigger-maintained (`sync_transcript_status`). Never UPDATE it directly.
- New versions: `version_number = MAX(version_number)+1` inside a transaction; `content_hash = SHA256(content)`; `is_doctor_edited = true`; `edited_by_user_id = req.user.id`.
- Version rows are immutable once reviewed (DB trigger `enforce_reviewed_version_immutability`). Corrections → new version.  
  |  |  |  
  | --- | --- |
- Review body: `{ decision: "approved" | "rejected", note?: string }`. The DB trigger `enforce_transcript_reviewer` validates doctor role; the service validates record authorization and sets `reviewed_by_user_id`, `reviewed_at`.
- Only one approved version per transcript should be current; if the UI needs a "current" concept, derive `MAX(version_number) WHERE review_decision='approved'`.
- Audit: `transcript.version_created`, `transcript.reviewed` with `before`/`after` limited to IDs, decisions, and version numbers — **no content**.

---

### 5.6 Reports — Agent 1, doctor approval, patient release — NEW (Phase 5)

| Method | Path                                          | Gate                              | Purpose                                    |
| ------ | --------------------------------------------- | --------------------------------- | ------------------------------------------ |
| `GET`  | `/api/doctor/consultations/:id/reports`       | doctor + access                   | Three report drafts with version summaries |
| `GET`  | `/api/doctor/reports/:id`                     | doctor + access                   | Report + versions (content JSONB)          |
| `GET`  | `/api/doctor/reports/:id/versions/:versionId` | doctor + access                   | One version's full content                 |
| `POST` | `/api/doctor/reports/:id/versions`            | doctor + CSRF                     | Doctor-authored correction version         |
| `POST` | `/api/doctor/report-versions/:id/review`      | doctor + `reports.approve` + CSRF | Approve/reject                             |
| `POST` | `/api/doctor/reports/:id/publish`             | doctor + CSRF                     | Publish approved Report 1 only             |
| `POST` | `/api/doctor/reports/:id/withdraw`            | doctor + CSRF                     | `published → withdrawn`                    |
| `GET`  | `/api/patient/reports`                        | patient + `reports.view_own`      | Released reports only                      |
| `GET`  | `/api/patient/reports/:id`                    | patient                           | Approved+published Report 1 content        |

**Rules:**

- Exactly one row per `(consultation_id, report_type)`; `report_type ∈ {report_1_patient_summary, report_2_structured_profile, report_3_medical_report}`.
- `medical_reports.status` and `publication_state` are trigger-maintained. Never UPDATE them directly except through approved version review and explicit publish/withdraw operations that satisfy the triggers.
- `report_versions.source_transcript_version_id` is NOT NULL and must reference an **approved** transcript version (DB trigger `enforce_report_source_transcript`).
- Publish: allowed only when `report_type='report_1_patient_summary'` and `published_version_id` points to an approved version of the same report (DB trigger). Audit `report.published` with recipient = patient user id. Withdrawal sets `publication_state='withdrawn'` (never back to `unpublished`).
- Patient endpoints query `WHERE publication_state='published' AND patient_user_id = req.user.id`; a 404 must not distinguish "does not exist" from "not released".
- **Report 3:** implement create/read/review for doctors only. No publish endpoint, no patient visibility, no recipient field, no storage destination (§12 D-1).
- Audit: `report.version_created`, `report.reviewed`, `report.published`, `report.withdrawn`; metadata contains only IDs and decisions.

---

### 5.7 Agent 2 — record-update proposals — NEW (Phase 6)

| Method | Path                                 | Gate                        | Purpose                                          |
| ------ | ------------------------------------ | --------------------------- | ------------------------------------------------ |
| `GET`  | `/api/doctor/patients/:id/proposals` | doctor + active care access | Proposals for the patient                        |
| `GET`  | `/api/doctor/proposals/:id`          | doctor + access             | Proposal detail incl. conflicts                  |
| `POST` | `/api/doctor/proposals/:id/review`   | doctor + CSRF               | Approve/reject                                   |
| `POST` | `/api/doctor/proposals/:id/apply`    | doctor + CSRF               | Apply an approved proposal to the medical record |

**Rules:**

- `target_entity_type ∈ {medical_condition, patient_medication, patient_allergy, medical_history_entry, test_order, test_result}`; `proposal_type ∈ {create, update, resolve, discontinue, correct}`; `status ∈ {proposed, approved, rejected, applied, superseded}`.
- `conflict_detected=true` requires `conflict_details`; surface conflicts prominently in the response but never auto-resolve.
- Applying a proposal writes the corresponding row in one of the six medical-record tables **with full provenance**: `source_type='agent_2_derived'`, `source_report_version_id`, `source_proposal_id`, `created_by_user_id = req.user.id` (DB trigger `enforce_medical_record_provenance` verifies an approved/applied proposal).
- Correction (`proposal_type='correct'`) must create a new row and set the old row's `superseded_by_id` in the same transaction. Never UPDATE or DELETE a clinical fact in place.
- Audit: `proposal.reviewed`, `proposal.applied`, and `clinical.record_created` with entity IDs only.

---

### 5.8 Longitudinal medical record and patient clinical portal — NEW (Phase 6/8)

| Method | Path                                      | Gate                        | Purpose                                                            |
| ------ | ----------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| `GET`  | `/api/patient/medical-records`            | patient                     | Cross-category record feed for the UI                              |
| `GET`  | `/api/patient/medical-records/:type/:id`  | patient                     | One record detail (visit/prescription/lab/imaging/document/report) |
| `GET`  | `/api/patient/lab-results`                | patient                     | Lab list + counts                                                  |
| `GET`  | `/api/patient/lab-results/:id`            | patient                     | Lab detail with observations, trends, report link, visit link      |
| `GET`  | `/api/patient/prescriptions`              | patient                     | Prescription records + medications + counts                        |
| `GET`  | `/api/patient/prescriptions/:id`          | patient                     | Prescription detail                                                |
| `GET`  | `/api/patient/medications`                | patient                     | Active/current medications + today's schedule                      |
| `GET`  | `/api/doctor/patients/:id/record`         | doctor + active care access | Full chart sections for consultation prep                          |
| `POST` | `/api/doctor/patients/:id/record-entries` | doctor + CSRF + access      | Manually add a clinical fact with provenance                       |

**Mapping to existing tables:**

| UI concept                           | Source                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visits                               | `consultations` joined to `appointments` (completed only)                                                                                                                                   |
| Prescriptions                        | `patient_medications` (`source_type IN ('doctor_entered','agent_2_derived')`), grouped by `source_report_version_id`/`prescriber_user_id` — **no prescriptions table exists**; see §12 D-10 |
| Lab results                          | `test_results` joined to `test_orders` (patient via order)                                                                                                                                  |
| Imaging                              | **no table** — return `[]` (§12 D-10)                                                                                                                                                       |
| Documents                            | **no file table** — return `[]`; upload endpoint blocked (§12 D-11)                                                                                                                         |
| Reports                              | `medical_reports` where `publication_state='published'` and type `report_1_patient_summary`                                                                                                 |
| Medical conditions/allergies/history | respective tables, `superseded_by_id IS NULL`                                                                                                                                               |

**Lab detail** must derive trend points from historical `test_results` of the same analyte for the same patient ordered by `resulted_at`; `reference_range`, `unit`, `abnormal_flag` map to `status` (`low`/`high`/`critical_*` → `Abnormal`, else `Normal`). Result status `preliminary` must never appear in patient responses.

**Record feed** response: `{ success: true, entries: MedicalRecordEntry[], stats: {...}, pagination: {...} }` where each entry uses `key = "${type}:${id}"`, `type ∈ {visit,prescription,lab,imaging,document,report}`, and `searchText` is a lowercased concatenation of title/subtitle/facility (Appendix A §A.3).

**Doctor chart read** must write `clinical.record_accessed` with `patient_user_id` set, before returning content. Denials write a security event.

---

### 5.9 Follow-ups and Agent 3 — NEW (Phase 7)

| Method | Path                                            | Gate                | Purpose                                           |
| ------ | ----------------------------------------------- | ------------------- | ------------------------------------------------- |
| `GET`  | `/api/doctor/patients/:id/follow-ups`           | doctor + access     | Recommendations                                   |
| `POST` | `/api/doctor/follow-ups/:id/accept`             | doctor + CSRF       | `recommended → accepted`                          |
| `POST` | `/api/doctor/follow-ups/:id/decline`            | doctor + CSRF       | `recommended → declined`                          |
| `POST` | `/api/doctor/follow-ups/:id/proposals`          | doctor + CSRF       | Create slot proposals after checking availability |
| `GET`  | `/api/patient/follow-ups`                       | patient             | Own recommendations/proposals                     |
| `POST` | `/api/patient/appointment-proposals/:id/select` | patient + CSRF      | `proposed → selected`                             |
| `POST` | `/api/staff/appointment-proposals/:id/book`     | receptionist + CSRF | `selected → booked`, creates real appointment     |


**Invariants:**

- A proposal is never an appointment. `appointment_proposals.status='booked'` requires `booked_appointment_id` (DB CHECK). Booking creates a new `appointments` row using the same conflict-checked slot logic as §5.3, then updates the proposal in the same transaction.
- `follow_ups.status='scheduled'` only when the linked appointment reaches `confirmed`; do not set it at proposal time.
- `expires_at` on proposals must be validated (`> now()`) before selection; expired proposals return `409 proposal_expired`.
- Partial unique `uq_appointment_proposals_live_slot` will raise `23505` on a duplicate live slot — map to `409 slot_taken`.
- Audit `follow_up.recommended`, `proposal.created`, `proposal.selected`, `appointment.created` and status transitions as appropriate.

---

### 5.10 Doctor workspace — NEW (Phase 9)

| Method   | Path                           | Purpose                                                                     |
| -------- | ------------------------------ | --------------------------------------------------------------------------- |
| `GET`    | `/api/doctor/me`               | Doctor profile for this account (`doctor_profiles` + user)                  |
| `PATCH`  | `/api/doctor/me`               | Edit allowlisted non-credential fields (phone, bio, title, years, location) |
| `GET`    | `/api/doctor/availability`     | Weekly template + time-off                                                  |
| `POST`   | `/api/doctor/availability`     | Add a weekly window (CSRF)                                                  |
| `PATCH`  | `/api/doctor/availability/:id` | Edit/window deactivate (CSRF)                                               |
| `POST`   | `/api/doctor/time-off`         | Add blocked period (CSRF)                                                   |
| `DELETE` | `/api/doctor/time-off/:id`     | Cancel blocked period (CSRF)                                                |

**Rules:** `license_number`, `verification_status`, role, and status are **never** editable here (decision D4 of `PHASE2_003_DECISIONS.md`). Validate weekday 0–6, `end_time > start_time`, `slot_minutes 10–120`, `effective_to >= effective_from`. Audit all mutations as `configuration`.

---

### 5.11 Staff/reception workspace — NEW (Phase 9)

| Method | Path                      | Purpose                                         |
| ------ | ------------------------- | ----------------------------------------------- |
| `GET`  | `/api/staff/me`           | Staff profile for this account                  |
| `GET`  | `/api/staff/dashboard`    | Today's appointment counts, check-ins, no-shows |
| `GET`  | `/api/staff/patients/:id` | Demographics only (no clinical content)         |

Frontend currently has no staff screens (`/workspace` is a placeholder), so these endpoints are API-first: keep responses small and document them for a future UI.

---

### 5.12 Notifications — NEW (Phase 8)

| Method  | Path                              | Gate                  | Purpose                                |
| ------- | --------------------------------- | --------------------- | -------------------------------------- |
| `GET`   | `/api/notifications`              | session, owner        | Own notifications with unread count    |
| `PATCH` | `/api/notifications/:id/read`     | session, owner + CSRF | Mark read (`status='read'`, `read_at`) |
| `GET`   | `/api/notifications/unread-count` | session, owner        | Sidebar badge                          |

`recipient_user_id = req.user.id` on every query. Never include `body` containing tokens (the lifecycle code already respects this). Emit notifications from appointment confirmation, report publication, and invitation flows.

---

### 5.13 Reference knowledge — OCR/RAG — NEW (Phase 11)

| Method | Path                                         | Gate                       | Purpose                                                       |
| ------ | -------------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| `GET`  | `/api/reference/documents`                   | doctor or admin            | Document list                                                 |
| `GET`  | `/api/reference/documents/:id`               | doctor or admin            | Document + versions                                           |
| `POST` | `/api/reference/documents`                   | admin + CSRF               | Register document metadata                                    |
| `POST` | `/api/reference/versions`                    | admin + CSRF               | Register a version (storage key, checksum, extraction method) |
| `POST` | `/api/reference/versions/:id/extraction`     | service + CSRF             | Attach `agent_executions` result, set `normalized_text`       |
| `POST` | `/api/reference/versions/:id/quality-review` | doctor/admin + CSRF        | Quality decision + notes                                      |
| `POST` | `/api/reference/versions/:id/approve`        | doctor/admin + CSRF        | Approve a version                                             |
| `POST` | `/api/reference/versions/:id/index`          | service + CSRF             | Create `reference_chunks`, set `embedding_status`             |
| `GET`  | `/api/reference/versions/:id/chunks`         | doctor or admin            | Chunk list                                                    |
| `POST` | `/api/reference/rag/query`                   | doctor + rate limit + CSRF | Question → answer + citations                                 |
| `GET`  | `/api/reference/rag/queries/:id`             | doctor                     | Past query with citations                                     |

**Rules:**

- Statuses: `uploaded → extracting → extracted → quality_review → approved → indexed` (or `extraction_failed`, `retired`). Enforce forward-only transitions in the service.
- `status='indexed'` requires `approved_at` (DB CHECK). Chunking writes deterministic `chunk_index`, `content_hash`, `heading`, `page_from/page_to`.
- `embedding_ref` is an opaque pointer — do not add a vector column (§12 D-2).
- RAG query must persist `rag_queries` (no patient identifiers) and one `rag_citations` row per chunk with `rank`, `relevance_score`, `quoted_text`. If evidence is insufficient, return `answer_status='insufficient_evidence'` with a clear message and zero/few citations — never invent an answer.
- Audit: `reference.document_registered`, `reference.quality_reviewed`, `reference.approved`, `reference.indexed`, `rag.query_answered`.

---

### 5.14 Admin extensions — NEW (Phase 10)

The three mock-only admin pages need endpoints. Keep them strictly operational: **no clinical content may be joined into admin responses**.

| Method  | Path                                  | Purpose                                                                                                                        |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/admin/dashboard`                | KPIs, trend series, department distribution, notifications, system health, recent appointments, recent users (Appendix A §A.5) |
| `GET`   | `/api/admin/ai/reports`               | AI execution/report overview with `range=7d\|30d\|90d`, filters, pagination                                                    |
| `GET`   | `/api/admin/ai/summary`               | Counts, success rate, average processing time (current + previous period)                                                      |
| `GET`   | `/api/admin/ai/daily-series`          | Daily generated/approved/awaiting/failed counts                                                                                |
| `GET`   | `/api/admin/ai/doctors/ranking`       | Doctor-level execution counts                                                                                                  |
| `GET`   | `/api/admin/ai/health`                | Queue/processing/failure health                                                                                                |
| `GET`   | `/api/admin/ai/activities`            | Recent operational activity (no report content)                                                                                |
| `GET`   | `/api/admin/ai/reports/:id/events`    | Event timeline for one execution                                                                                               |
| `GET`   | `/api/admin/departments`              | Full department cards (stats, services, activity)                                                                              |
| `POST`  | `/api/admin/departments`              | Create support department (CSRF)                                                                                               |
| `PATCH` | `/api/admin/departments/:id`          | Edit name/description/status (CSRF)                                                                                            |
| `PUT`   | `/api/admin/departments/:id/doctors`  | Assign/unassign doctors (CSRF)                                                                                                 |
| `PUT`   | `/api/admin/departments/:id/services` | Manage service list (CSRF)                                                                                                     |

**Data sources:** `agent_executions`, `medical_reports`, `report_versions`, `audit_logs`, `appointments`, `users`, `departments`, `notifications`. Fields such as `doctorName`, `specialty`, `department` come from joins to workforce tables. Use `severity`, `status`, `error_code` for `processingStatus`/`failureCategory`. **Never return report `content`, transcript content, patient names, or clinical narratives** to AI-monitoring endpoints.

`departments.services` has no table — return `[]` unless §12 D-12 approves a new column/migration. Department `description`, `icon`, `displayOrder`, `headOfDepartment` likewise have no columns; either derive from `name`/`slug` or mark BLOCKED (§12 D-12). Do not silently invent fields.

---

### 5.15 Internal AI agent execution — NEW (Phase 5/6/7/11), gated

AI agents are **internal service workflows**, not human roles. Expose them under `/api/internal/agents/*` with a new `requireServiceAuth` middleware:

- Reads `AGENT_SERVICE_TOKEN` from env; constant-time compare (`crypto.timingSafeEqual`) against `x-service-token`.
- Rejects if env var is unset (fail closed).
- Applies `agentRunLimiter` and requires an `idempotency_key` in the body (unique with `agent_code` and `attempt_number` per DB constraint).

| Method | Path                                        | Agent                                        | Input contract                                                                        |
| ------ | ------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POST` | `/api/internal/agents/transcription`        | `speech_to_text`                             | `consultation_id`, `recording_id`, storage key, idempotency key                       |
| `POST` | `/api/internal/agents/reports`              | `agent_1_report_generation`                  | `source_transcript_version_id` (must be approved), `consultation_id`, idempotency key |
| `POST` | `/api/internal/agents/profile-organization` | `agent_2_profile_organization`               | `source_report_version_id` (Report 2, approved), idempotency key                      |
| `POST` | `/api/internal/agents/follow-up-scheduling` | `agent_3_follow_up_scheduling`               | `consultation_id`, `source_report_version_id`, idempotency key                        |
| `POST` | `/api/internal/agents/extraction`           | `ocr_extraction` / `digital_text_extraction` | `reference_document_version_id`, `engine`, idempotency key                            |

Every call inserts an `agent_executions` row with `status='queued'` (or `running/succeeded/failed`), model/provider/version, `input_hash`, `output_hash`, `started_at`, `completed_at`, `error_code` on failure. Retry uses `attempt_number` + `retry_of_execution_id`; the DB unique index enforces idempotency. All DB constraints on input combinations (§2.4, migration 008/009/012) must pass — they are the final safety net.

If the team prefers no HTTP surface for agents, implement the same service functions and call them from a worker/CLI; the contracts above then describe function signatures instead. **Do not expose agent triggers to browsers.**

---

## 6. Frontend data contracts (exact shapes)

See **Appendix A** for the complete TypeScript shapes the new endpoints must return. Summary of hard requirements:

- Patient endpoints return camelCase objects as the mocks define them (`doctorId`, `startsAt`, `consultationType`, `relatedVisitId`, `referenceRange`, `refillsRemaining`, `photoUrl`, …).
- Request bodies remain snake_case (`full_name`, `doctor_id`, `scheduled_start_at`, `license_number`, …).
- ISO strings for dates/datetimes; round-trip through `toISOString()` on the server where needed.
- `null`/`[]` are honest values for data with no source (ratings, reviews, imaging, documents, messages, vitals, duty, nextShift, services, availability). Never fabricate demo values.

---

## 7. Step-by-step implementation workflow

Implement in this order. Each phase has an acceptance gate; do not start the next phase until the current one is green.

### Phase 0 — Preparation and decisions (no code)

1. Read `AGENTS.md`, `Backend/server.js`, all controllers/services/middleware, migrations `001`–`013`, `src/lib/api/admin.ts`, and `src/lib/mock/*.ts`.
2. Copy `Backend/.env.example` → `Backend/.env`, set credentials, run `npm --prefix Backend run db:test` and `db:migrate`; confirm `schema_migrations` contains `001`–`013` and `tests/schema-v2.test.js` passes.
3. Resolve the BLOCKED items in §12 that affect your phase. Record decisions in a new `docs/API_DECISIONS.md` (or the team's tracker) — not by editing applied migrations.
4. Create a feature branch; do not mix this work with frontend redesign.


**Gate:** migrations verified, decisions recorded, branch clean.

### Phase 1 — Shared foundation

Files to add/modify:

- `Backend/utils/validators.js` — add `datetime`, `timeOfDay`, `weekday`, `jsonObject`, `hexHash` (§4.4).
- `Backend/utils/patientSerializers.js`, `Backend/utils/clinicalSerializers.js` — row→UI mapping (Appendix A).
- `Backend/services/accessService.js` — `assertCareAccess`, `assertConsultationAccess`, `assertAppointmentAccess`, `denyAndAudit`.
- `Backend/services/auditService.js` — add domain helpers (§4.7); do not change existing function signatures.
- `Backend/middleware/rateLimiter.js` — add `clinicalReadLimiter`, `agentRunLimiter`.
- `Backend/middleware/serviceAuth.js` — `requireServiceAuth` (§5.15).
- `Backend/server.js` — mount new routers as they are created; keep existing mounts untouched.

**Gate:** `npm test` and `npm run test:schema` still green; new validators have unit tests.

### Phase 2 — Patient profile, doctors, dashboard

1. Create `routes/patientRoutes.js` with `requireAuth, requireRole("patient")` at the top.
2. Implement `services/patientService.js` + `controllers/patientController.js` for §5.1–5.2.
3. Add `utils/patientSerializers.js` mappings for `Doctor`, `DashboardPayload`.
4. Add tests: profile GET/PATCH, doctor list filters, dashboard patient scoping (no cross-patient data).
5. Optional frontend handoff: replace mock imports in patient providers with a `src/lib/api/patient.ts` client mirroring `admin.ts` (credentials + CSRF).

**Gate:** own-profile only; no way to pass another `patient_user_id` and receive data.

### Phase 3 — Scheduling and appointments

1. `services/schedulingService.js` — slot generation, conflict checks, optimistic concurrency, `care_relationships` creation.
2. `routes/patientRoutes.js`, new `routes/staffRoutes.js`, `routes/doctorRoutes.js` — §5.3 endpoints.
3. Ensure every appointment status change writes `appointment.status_changed` audit in the same transaction; verify via `v_appointment_status_timeline`.
4. Tests: slot excludes time-off/bookings; race returns `409 version_conflict`; cancel requires reason; patient cannot read another patient's appointment; staff can set/check-in/complete; patient sees no `internal_notes`.

**Gate:** 12+ scheduling test cases pass, including audit rows.

### Phase 4 — Consultations, consent, recordings

1. `services/consultationService.js` + doctor routes (§5.4).
2. Enforce consent uniqueness, grant/revoke timestamps, and recording consent gate.
3. Tests: recording without consent → 403; duplicate consent → 409; revoke clears timestamps; doctor cannot access an unassigned consultation.

**Gate:** consent and access tests green; no audio bytes stored anywhere.

### Phase 5 — Transcripts and reports

1. `services/clinicalReviewService.js` — transcript versions, reviews, report versions, reviews, publication (§5.5–5.6).
2. Do not write `status` columns directly; let triggers maintain them. Fetch the updated row after each mutation (as `adminDirectoryService.setVerification` does).
3. `services/agentService.js` + `routes/internalAgentRoutes.js` (§5.15) for Agent 1; Agents 2/3/extraction in later phases.
4. Tests: approve transcript → Agent 1 allowed; unapproved transcript → DB/API rejection; report publish blocked for types 2/3; patient cannot see unpublished reports; version immutability.

**Gate:** approval chain proven end-to-end; no direct status writes.

### Phase 6 — Agent 2, medical record, patient clinical portal

1. `services/medicalRecordService.js` — proposals apply/supersede with provenance (§5.7).
2. `services/patientClinicalService.js` — record feed, labs, prescriptions, medications (§5.8).
3. Serializers mapping to `MedicalRecordEntry`, `LabResult`, `PrescriptionRecord`, `Medication`, `Visit` (Appendix A §A.3–A.4).
4. Tests: apply proposal creates provenance row; correction supersedes old row; lab trends exclude preliminary results; patient scoping on every query.

**Gate:** no clinical fact without provenance; no patient cross-read.

### Phase 7 — Follow-ups and Agent 3

1. `services/followUpService.js` — recommendations, proposals, booking handoff (§5.9).
2. Tests: proposal not counted as booking; booking creates appointment + link; duplicate live slot → 409; follow-up becomes `scheduled` only on confirmed appointment.

**Gate:** recommendation/proposal/booking distinctions verified in tests.

### Phase 8 — Notifications and patient report release

1. `services/notificationService.js` + routes (§5.12).
2. Wire notifications into appointment confirmation, report publication, invitations.
3. Verify unread-count endpoint matches sidebar badge needs.

**Gate:** no notification body contains a token or clinical narrative.

### Phase 9 — Doctor and staff workspaces

1. `services/doctorService.js`, `services/staffService.js` + routes (§5.10–5.11).
2. Tests: doctor cannot edit `license_number`/`verification_status`; availability CHECK violations rejected; staff cannot read clinical endpoints.

**Gate:** RBAC matrix (§8) fully passes for doctor and staff.

### Phase 10 — Admin extensions

1. `services/adminDashboardService.js`, `services/adminAiMonitoringService.js`, `services/adminDepartmentsService.js` + routes (§5.14).
2. Sanitize AI monitoring payloads: assert in tests that no `content`, `patient_user_id`, or clinical text appears.
3. Document which department fields are honest empties pending §12 D-12.

**Gate:** admin endpoints never return clinical content; response shapes match Appendix A §A.5.

### Phase 11 — Reference knowledge / OCR / RAG

1. `services/referenceService.js` + routes (§5.13).
2. Tests: status forward-only; `indexed` requires approval; RAG insufficient-evidence path; citation ranks unique.

**Gate:** no vector column added; no patient identifiers in `rag_queries`.

### Phase 12 — Final verification and handoff

1. Run `npm test`, `npm run test:schema`, `npx tsc --noEmit` (root), `npm run lint`, `npm run build`.
2. Update `README.md` endpoint table with every new route.
3. Produce a frontend handoff document listing new API client functions and response shapes (Appendix A), and mark remaining mock-only components.
4. Report exactly what was implemented, tested, and left BLOCKED.

---

## 8. Authorization matrix (must pass in tests)

| Endpoint family                                       | anon           | patient | doctor                          | receptionist | admin                    |
| ----------------------------------------------------- | -------------- | ------- | ------------------------------- | ------------ | ------------------------ |
| `/api/auth/*` public                                  | as implemented | —       | —                               | —            | —                        |
| `/api/patient/profile`, `/dashboard`, `/appointments` | 401            | 200 own | 403                             | 403          | 403                      |
| `/api/patient/reports` (released only)                | 401            | 200 own | 403                             | 403          | 403                      |
| `/api/doctor/*`                                       | 401            | 403     | 200 assigned/authorized         | 403          | 403                      |
| `/api/staff/*`                                        | 401            | 403     | 403 (unless explicitly allowed) | 200          | 403                      |
| `/api/admin/*` existing                               | 401            | 403     | 403                             | 403          | 200                      |
| `/api/admin/ai/*`, `/dashboard`, `/departments`       | 401            | 403     | 403                             | 403          | 200                      |
| `/api/internal/agents/*`                              | 401            | 403     | 403                             | 403          | 403 (service token only) |

Record-level tests are mandatory in addition to this matrix: patient A must never see patient B's rows; doctor without an active care relationship must receive `403 clinical_access_denied`.

---

## 9. Testing strategy

- **Style:** follow `tests/admin.test.js` — real Express app via `app.listen(0)`, `fetch`, manually minted sessions with hashed tokens and signed CSRF cookies; fixtures use `@medora.example`; clean up in `after`.
- **New suites to add:** `tests/patient.test.js`, `tests/scheduling.test.js`, `tests/clinical.test.js`, `tests/adminExtensions.test.js`, `tests/reference.test.js`. Add scripts to `Backend/package.json`.
- **Fixtures:** never real patient data. Use overridable temp DB (e.g. `medora_test`) for destructive-ish setup; `medora_db` must not be seeded.
- **Assertions to require:** status codes, `success` envelope, exact field names (Appendix A), absence of sensitive fields (`password_hash`, `token_hash`, `content` where forbidden), audit rows written, `v_*` view contents after transitions, rollback leaves zero orphans, idempotency/replay rejection.
- **Negative paths first:** every endpoint with a rule in §3 should have a test that violates the rule and expects 4xx.
- **Schema test:** `tests/schema-v2.test.js` asserts exactly 42 tables, 13 migrations, and 2 views. If §12 D-4 approves a new migration, update those expectations in the same commit.

---

## 10. Definition of done

1. Every endpoint in §5.1–5.14 (except BLOCKED items) is implemented behind the correct gate.
2. All patient-facing screens can be switched from mock data to the new API by changing only data-source imports — no JSX/layout changes.
3. No endpoint returns clinical data to an unauthorized role or to another patient.
4. Every mutation writes the correct audit row in the same transaction; appointment status changes are visible in `v_appointment_status_timeline`.
5. Approval gates (approved transcript → Agent 1 → approved Report 2 → Agent 2 → approved proposal → medical record) verified end-to-end.
6. `npm test`, `npm run test:schema`, frontend `tsc --noEmit`, `lint`, and `build` all pass; results reported honestly.
7. Documentation updated: `README.md` endpoint table, a new API handoff note, and a decisions log.
8. No applied migration changed; no `.env`, token, password, audio file, or real patient data committed.

---

## 11. Risk register

| Risk                                              | Mitigation                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Frontend camelCase vs backend snake_case mismatch | Central serializers + Appendix A contract tests; never edit JSX                                      |
| Double booking under concurrent requests          | Re-check slots inside transaction; optimistic `version`; map `23505` to `409 slot_taken`             |
| Trigger rejection of direct status writes         | Treat version status columns as read-only; re-fetch after mutation                                   |
| Admin clinical leak                               | Join allowlist; add automated assertion that AI-monitoring/admin payloads contain no clinical fields |
| Mock-only fields invited into schema              | Return honest `null`/`[]`; require approved migration before persisting new fields                   |
| Agent token misuse                                | `requireServiceAuth`, env unset → fail closed, rate limit, idempotency keys                          |
| Audit row bloat from list reads                   | Audit only access to individual clinical records, not aggregate list views                           |

---

## 12. Open decisions requiring approval (BLOCKED)


| #    | Decision                                                                                  | Why it blocks                                                    | Recommended default if no decision                                                                         |
| ---- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D-1  | Report 3's purpose, recipient, storage destination                                        | Cannot implement release/storage safely                          | Doctor-only drafts/review; no publish, no patient visibility                                               |
| D-2  | Vector store / embedding provider for RAG                                                 | Determines whether `embedding_ref` needs an external service     | Keep `embedding_ref` opaque; no DB schema change                                                           |
| D-3  | Booking confirmation policy (auto-confirm patient request vs staff confirmation)          | Changes appointment status flow and notifications                | `requested → pending_confirmation → confirmed` by staff                                                    |
| D-4  | Any new table/column (e.g. vitals, messages, imaging, documents, prescriptions, services) | Requires approved `014_*.sql` and schema-test updates            | Return honest empties; no schema change                                                                    |
| D-5  | New permissions for clinical endpoints                                                    | Current 15 permissions cover most flows but not lab/record reads | Use role + record access; request migration only if audit policy demands explicit codes                    |
| D-6  | Whether server should accept UI role `staff` in addition to `receptionist`                | Staff accounts are provisioned as `receptionist` in DB           | Accept both in `requireRole` for staff routes; keep DB canonical                                           |
| D-7  | Phone normalization target (E.164 vs local)                                               | Affects stored values and dedupe                                 | Store trimmed as submitted (current UI policy); normalize in a later migration                             |
| D-8  | Public visibility of unverified doctors                                                   | Affects directory query                                          | Only `verification_status='verified'`                                                                      |
| D-9  | Sources for dashboard vitals and messages                                                 | No tables exist                                                  | Return `[]`; document empty states                                                                         |
| D-10 | Prescription/imaging representation                                                       | No dedicated tables                                              | Derive prescriptions from `patient_medications`; imaging `[]`                                              |
| D-11 | Patient document upload/storage provider                                                  | No file table or storage decision                                | No upload endpoint; `documents: []`                                                                        |
| D-12 | Department extended fields (description, icon, order, services, head)                     | Columns absent in `departments`                                  | Derive where possible; return honest defaults; propose `014` if persistence required                       |
| D-13 | Agent HTTP surface vs worker-only                                                         | Affects `/api/internal` exposure                                 | Implement service functions + internal routes with service token; disable routes in production if not used |

---

## Appendix A — Frontend contract shapes (target responses)

### A.1 Patient dashboard (`src/lib/mock/patient.ts`)

|                                                                                                                                                                            |             |                                                                                                                                                                                                                                                                           |                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patient`, `today`, `nextAppointment { doctor, specialty, date, time, location, address }`, \`recentAppointments[] { id, doctor, specialty, date, time, status: "Upcoming" | "Completed" | "Cancelled" }`, `activePrescriptions[] { id, medication, dosage, status }`, `vitals[] { key, label, value, unit, icon, tone, trend: number[] }`, `quickActions[]`, `medicalRecords[] { id, title, doctor, date, icon }`, `labResults[] { id, name, date, status: "Normal" | "Slightly High", icon, tone }`, `careTeam[] { id, name, specialty }`, `patientMessages[] { id, sender, preview, time, unread, kind }`, `dashboardStats[] { key, label, value, icon, tone }\`. |

### A.2 Appointments (`src/lib/mock/appointments.ts`)

```ts
type Appointment = {
  id: string; reference: string; doctorId: string; startsAt: Date | string;
  durationMinutes: number; consultationType: "In-Person" | "Online";
  status: "Upcoming" | "Completed" | "Cancelled";
  reason?: string; notes?: string; cancellationReason?: string;
};
type Slot = { time: string; available: boolean };
```

DB mapping: `startsAt` ← `scheduled_start_at` (or `requested_start_at`); `durationMinutes` ← difference between start/end or `slot_minutes`; `reference` derived from `id`; DB `consultation_type in_person/online` → UI `In-Person/Online`; DB 9-value status → UI three buckets (`requested/pending_confirmation/confirmed/checked_in/in_progress → Upcoming`, `completed → Completed`, `cancelled/no_show/rescheduled → Cancelled`).

### A.3 Medical records (`src/lib/mock/medicalRecords.ts`)

`MedicalRecordEntry { key, type, id, title, subtitle, facility, date, time?, status, searchText }`; `Visit { id, title, doctorId, facility, specialty, date, time, status, summary, vitals, diagnosis, medicationIds, labIds, imagingIds, fileIds, followUp, reportId? }`; `LabResult { id, name, date, facility, category, status, doctorId, relatedVisitId?, specimen, method, collectedAt, reportedAt, notes, results: [{ name, value, unit, referenceRange, status }], trends?: [{ label, unit, range, points }] }`; `Prescription { id, medication, dosage, frequency, duration, startDate, endDate, refills, status, doctorId, facility, date, relatedVisitId?, instructions, warning }`; plus `ImagingResult`, `MedicalDocument`, `MedicalReport` shapes in the same file.

### A.4 Lab results & prescriptions (`src/lib/mock/labResults.ts`, `prescriptions.ts`)

|                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LabCounts { total, normal, attention }`; \`TrendRange = "3M" | "6M" | "1Y"`; `Medication { id, prescriptionId, name, dosage, strength, frequency, times: string[], duration, startDate, endDate, status, instructions, refillsRemaining, selfReported? }`; `PrescriptionRecord { id, title, doctorId, date, status, relatedVisitId?, instructions, notes?, fileIds }`; `PrescriptionCounts { activePrescriptions, totalPrescriptions, currentMedications, refillsSoon, allPrescriptions, myMedications, history }\`. |

### A.5 Doctors (`src/lib/mock/doctors.ts`)

`Doctor { id, name, title, specialty, departmentId, department, verified, rating, reviews, years, experience, languages, bio, tags, services, clinic, address, city, supportsInPerson, supportsOnline, photoUrl, featured, weekly: Record<number, TimeRange[]>, patientReviews }`; `TimeRange { start, end }`; `Department { id, name, icon, tone, blurb }`.

### A.6 Admin dashboard (`src/lib/mock/admin.ts`)

`kpis[]`, `trendDays[]`, `trendSeries[]`, `departments[]`, `notifications[]`, `quickActions[]`, `systemHealth[]`, `recentAppointments[]`, `recentUsers[]`, `adminUser`, `today`, `quote`.

### A.7 AI monitoring (`src/lib/mock/aiMonitoring.ts`)

|                                                                                                                                                                                                                                                                                                                                                                                                                             |     |        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ |
| `AiReport { id, caseRef, doctorId, doctorName, specialty, department, createdAt, workflowStatus, processingStatus, processingSeconds, failureCategory?, jobId, jobStartedAt, jobFinishedAt }`; `AiSummary { total, approved, awaiting, failures, drafts, successes, queued, processing, averageSeconds, successRate }`; `DailyPoint`, `DoctorRanking`, `AiServiceHealth`, `OperationalActivity`, `ReportEvent`. Ranges \`7d | 30d | 90d\`. |

### A.8 Admin departments (`src/lib/mock/departments.ts`)

`Department { id, name, slug, description, icon, status, displayOrder, assignedDoctorIds, services, headOfDepartment?, location, locationBadge?, locationAddress, createdAt, updatedAt, stats: { assignedDoctors, totalAppointments, completedAppointments, cancelledAppointments }, recentActivity[] }`.

---

## Appendix B — Controlled vocabularies (exact DB values)

| Field                                           | Values                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appointments.status`                           | `requested`, `pending_confirmation`, `confirmed`, `checked_in`, `in_progress`, `completed`, `cancelled`, `no_show`, `rescheduled`                          |
| `consultation_type`                             | `in_person`, `online` (availability also `both`)                                                                                                           |
| `consultations.status`                          | `scheduled`, `in_progress`, `completed`, `cancelled`                                                                                                       |
| `consultation_consents.consent_type`            | `audio_recording`, `transcription`, `ai_assisted_documentation`                                                                                            |
| `consultation_consents.status` / `.method`      | `granted`, `declined`, `revoked` / `in_person_verbal`, `patient_portal`, `written`                                                                         |
| `transcripts.status`                            | `draft`, `in_review`, `approved`, `rejected`, `superseded`                                                                                                 |
| `transcript_versions.review_decision`           | `null`, `approved`, `rejected`                                                                                                                             |
| `medical_reports.report_type`                   | `report_1_patient_summary`, `report_2_structured_profile`, `report_3_medical_report`                                                                       |
| `medical_reports.status` / `.publication_state` | `draft`, `in_review`, `approved`, `rejected`, `superseded`, `released` / `unpublished`, `published`, `withdrawn`                                           |
| `report_versions.review_decision`               | `null`, `approved`, `rejected`                                                                                                                             |
| `record_update_proposals.status`                | `proposed`, `approved`, `rejected`, `applied`, `superseded`                                                                                                |
| `follow_ups.status`                             | `recommended`, `accepted`, `scheduling`, `scheduled`, `completed`, `declined`, `cancelled`                                                                 |
| `appointment_proposals.status`                  | `proposed`, `selected`, `booked`, `declined`, `expired`, `cancelled`                                                                                       |
| `care_relationships.status` / `.source`         | `active`, `expired`, `revoked` / `appointment`, `consultation`, `admin_assignment`, `referral`                                                             |
| `agent_executions.agent_code`                   | `speech_to_text`, `agent_1_report_generation`, `agent_2_profile_organization`, `agent_3_follow_up_scheduling`, `ocr_extraction`, `digital_text_extraction` |
| `agent_executions.status`                       | `queued`, `running`, `succeeded`, `failed`, `cancelled`                                                                                                    |
| `reference_document_versions.status`            | `uploaded`, `extracting`, `extraction_failed`, `extracted`, `quality_review`, `approved`, `indexed`, `retired`                                             |
| `reference_chunks.embedding_status`             | `pending`, `indexed`, `failed`, `stale`                                                                                                                    |
| `rag_queries.answer_status`                     | `pending`, `answered`, `insufficient_evidence`, `failed`                                                                                                   |
| `users.status`                                  | `active`, `pending_activation`, `suspended`, `disabled` (API: `active`, `pending`, `suspended`, `inactive`)                                                |
| `audit_logs.event_category`                     | `appointment`, `security`, `clinical_access`, `approval`, `provisioning`, `configuration`, `system`                                                        |

---

## Appendix C — Error codes to standardize

Reuse existing codes: `validation_error`, `not_found`, `email_taken`, `license_taken`, `employment_id_taken`, `unknown_specialty`, `unknown_department`, `unknown_location`, `invalid_status_transition`, `status_unchanged`, `self_lockout`, `admin_protected`, `token_invalid`, `token_expired`, `invitation_not_applicable`, `cors_origin_denied`.

New codes: `clinical_access_denied`, `consent_required`, `consent_exists`, `slot_taken`, `version_conflict`, `invalid_appointment_transition`, `transcript_not_approved`, `report_not_approved`, `publication_not_allowed`, `proposal_expired`, `dependency_conflict`, `agent_execution_conflict`, `insufficient_evidence`, `service_auth_failed`.

Always create these via `httpError(status, code, message, errors?)` so `errorHandler` passes them through.

---

**End of guide.** Report deviations from this specification in the handoff note with a reason; do not silently change response shapes or bypass approval gates.


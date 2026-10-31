# Medora Database Architecture

> **⚠ SUPERSEDED — read this banner before using the document.**
> This file describes the original **45-table V1 design** (28 October 2026) and
> is kept for history only. It no longer matches the database.
>
> The implemented schema is **39 tables**, applied by migrations `001`–`010`:
> six tables were consolidated into existing ones. The current sources of truth are:
> - **ERD:** [`database/medora.dbml`](./medora.dbml) — verified against PostgreSQL
> - **Beginner explanation of the real design:** [`database/DATABASE_ARCHITECTURE_V2.md`](./DATABASE_ARCHITECTURE_V2.md)
> - **Verified starting state:** [`database/PREFLIGHT_REPORT_V2.md`](./PREFLIGHT_REPORT_V2.md)
>
> Do not treat any table list, column list or "PROPOSED" status below as current.

**Status (historical):** Design only — no SQL was executed, no database was altered, and no backend or frontend code was changed.
**Canonical ERD:** [`database/medora.dbml`](./medora.dbml)
**Data dictionary:** [`database/SCHEMA_DATA_DICTIONARY.md`](./SCHEMA_DATA_DICTIONARY.md)
**Date:** 28 October 2026

---

## 1. Scope, sources and verified state

### 1.1 What this document covers

This is the logical PostgreSQL architecture for the complete Medora platform:

- identity and authorization;
- patient and doctor profiles;
- clinics, availability, appointments, proposals and follow-ups;
- consultations, recording consent, audio metadata, transcripts and doctor approvals;
- AI executions, the three medical reports, report versions, approvals, delivery and Agent 2 update proposals;
- longitudinal clinical records, conditions, medications, allergies, history, ordered tests and results;
- the separate medical-reference knowledge base, OCR jobs, chunks and RAG citations;
- notifications, audit logs and security events.

It documents intended behaviour and proposed schema. It does not prove that a proposed table exists.

### 1.2 Repository evidence inspected

| Source | What was verified |
|---|---|
| `AGENTS.md` | Repository rules, role policy, workflow, migration constraints |
| `database/migrations/001_identity_access.sql` | Six auth/RBAC tables, seeds, session indexes |
| `database/migrations/002_single_admin_enforcement.sql` | Single-Admin trigger on `user_roles` |
| `database/migrations/003_patient_doctor_profiles.sql` | `patient_profiles`, `specialties`, `doctor_profiles`, triggers, backfill |
| `Backend/scripts/migrate.js` and `Backend/scripts/lib/migrations.js` | Migration discovery, checksums, advisory lock, per-file transaction |
| `database/medora.dbml` | Previous Phase 1–2 ERD |
| `Admin.md` | Admin boundaries, provisioning, audit and privacy rules |
| `PatientJourney.md` | Existing appointment UI vocabulary and deferred backend work |
| `PHASE2_003_DECISIONS.md` | Profile decisions already made and their rationale |

### 1.3 Implemented versus proposed

| Category | Count | Meaning |
|---|---:|---|
| Implemented tables | 10 | Created by applied migrations `001`–`003`, plus the runner-owned `schema_migrations` table |
| Proposed tables | 35 | Logical design only; not present in PostgreSQL until future migrations are approved and applied |
| **Total logical tables** | **45** | Master ERD |
| Relationships in ERD | 129 | 10 implemented + 119 proposed |
| Applied migrations modified | 0 | `001`, `002`, `003` untouched |

The existing DBML did not include `schema_migrations`. It is added here because the runner creates and uses it, and the task requires an accurate existing-table inventory. It is grouped separately as platform infrastructure.

**Not verified:** the live contents of any developer database. The repository files are the source of truth for this task. A developer's local `medora_db` may differ.

### 1.4 Source conflicts and how they were resolved

| Conflict | Resolution |
|---|---|
| `AGENTS.md` says clinical data must not live in `patient_profiles` | Clinical facts are in new medical-record tables; `patient_profiles` remains demographic only |
| `Admin.md` forbids Admin access to confidential clinical records | Admin receives no clinical table grants by default; access is not implied by the `admin` role |
| `PatientJourney.md` uses `Upcoming / Completed / Cancelled` | Those are UI tabs, not the full operational state machine; the schema uses explicit operational statuses and the API maps them |
| Existing DBML omitted `schema_migrations` | Added as an implemented, runner-owned table |
| `AGENTS.md` had uncommitted changes before this task | Left untouched; no attempt was made to commit or revert them |
| Appointment requests: separate table or not | Modelled as one `appointments` table with request fields and statuses; the alternative remains an open decision |

---

## 2. Design principles

1. **One identity system.** Every human role uses `users`, `user_roles` and the existing permission model. No dashboard gets its own user or role table.
2. **Authorization is server-side and record-specific.** A role is necessary but not sufficient. Clinical access also requires a patient/doctor relationship or an assigned encounter.
3. **AI is a service workflow, not a role.** Agents are represented by execution rows and service credentials. They never approve clinical content.
4. **Approved clinical artifacts are immutable.** Transcript and report versions are append-only. Corrections create new versions; approvals attach to exact versions.
5. **No silent clinical overwrites.** Longitudinal facts keep provenance and a `superseded_by_id` correction chain. Agent 2 writes only through an approved proposal.
6. **Provenance is a first-class requirement.** Every AI-generated or imported clinical fact links to its source version or execution where one exists.
7. **No blanket cascade of clinical history.** Clinical and audit foreign keys use `RESTRICT` or `SET NULL`, not `CASCADE`. Hard deletion of clinical records is not a normal operation.
8. **Separate knowledge domains.** The medical-reference knowledge base is separate from patient records, recordings and reports, with its own authorization and retention.
9. **Storage-provider neutrality.** The schema stores object references, checksums and metadata, not audio or document bytes. Provider choice remains open.
10. **One canonical ERD.** Supporting documents explain the ERD; they do not define a competing schema.

---

## 3. Module map

| Module | Tables | Status | Responsibility |
|---|---|---|---|
| Identity & Access | `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions` | Implemented | Authentication, human roles, permissions, sessions |
| Profiles & Care Access | `patient_profiles`, `doctor_profiles`, `specialties`, `care_relationships` | 3 implemented, 1 proposed | Demographic/professional profiles and record-specific doctor access |
| Scheduling & Follow-Up | `clinic_locations`, `doctor_availability`, `doctor_time_off`, `appointments`, `appointment_status_history`, `follow_ups`, `appointment_proposals` | Proposed | Availability, booking, operational history, recommendations and proposed slots |
| Consultations & Transcripts | `consultations`, `consultation_consents`, `consultation_recordings`, `transcripts`, `transcript_versions`, `transcript_approvals` | Proposed | Encounter capture, consent, audio metadata, versioned transcripts |
| AI Agents & Reports | `agent_executions`, `medical_reports`, `report_versions`, `report_approvals`, `report_deliveries`, `record_update_proposals` | Proposed | AI execution audit, three reports, approvals, patient delivery, Agent 2 proposals |
| Medical Records | `medical_conditions`, `patient_medications`, `patient_allergies`, `medical_history_entries`, `test_orders`, `test_results` | Proposed | Longitudinal clinical facts, ordered versus completed tests, results |
| Reference Knowledge (OCR & RAG) | `reference_documents`, `reference_document_versions`, `document_extraction_jobs`, `reference_chunks`, `rag_queries`, `rag_citations` | Proposed | Reference ingestion, OCR, quality review, chunks, retrieval evidence |
| Operations & Audit | `notifications`, `audit_logs`, `security_events` | Proposed | User notifications, clinical/administrative audit, security operations |
| Platform Infrastructure | `schema_migrations` | Implemented | Migration history and checksums |

---

## 4. Canonical workflows

### 4.1 Appointment and scheduling lifecycle

```
Patient requests / Staff books
        │
        ▼
   requested ──────────────► cancelled
        │
        ▼
pending_confirmation ─────► cancelled
        │
        ▼
    confirmed ─────────────► rescheduled ──► new appointment row
        │
        ▼
   checked_in
        │
        ▼
   in_progress
        │
        ├──► completed
        └──► no_show
```

- A **request** is a row with `status = requested`, optional `requested_start_at` / `requested_end_at`, and null `scheduled_start_at` / `scheduled_end_at`.
- A **booking** has non-null scheduled timestamps and a status in the active set.
- **Staff** manages daily scheduling, check-in, reschedule and cancellation within permission.
- **Doctor** may view assigned appointments but does not administer the booking queue.
- **Patient** may request or book own appointments and cancel within policy.
- **Admin** has operational oversight, not clinical approval authority.

Whether confirmation is manual or automatic is **unresolved**. The model supports both: `pending_confirmation` exists for a staff gate, while `confirmed` can be reached automatically if policy later allows it. No default policy is encoded in the database.

**Request versus separate table.** The design uses one table. A separate `appointment_requests` table was considered and rejected for the MVP because it duplicates patient, doctor, time and status concepts. This is reversible: a future view or a new table can split requests without changing identity or clinical data.

### 4.2 Consultation, consent, recording and transcript

```
confirmed appointment
        │
        ▼
   consultation (scheduled → in_progress → completed)
        │
        ├── consultation_consents (audio_recording = granted)
        │
        ▼
   consultation_recordings (metadata + object reference)
        │
        ▼
   transcripts (draft)
        │
        ▼
   transcript_versions (v1, v2, ...)
        │
        ▼
   transcript_approvals (doctor decision on an exact version)
        │
        ▼
   approved transcript version ──► Agent 1 only
```

Rules:

1. Audio capture requires a `consultation_consents` row with `consent_type = audio_recording` and `status = granted`. The recording row references that exact consent.
2. Speech-to-text produces a **draft** transcript version. It does not produce an approved clinical document.
3. A doctor may correct the draft. Every correction is a new immutable `transcript_versions` row.
4. `transcript_approvals` records one decision per version: `approved` or `rejected`.
5. Only an approved version may be consumed by Agent 1.
6. Revoking consent stops future processing. Retention of an existing recording after revocation is an **open policy decision**.

### 4.3 Agent 1 and the three reports

```
approved transcript version
        │
        ▼
 agent_executions (agent_1_report_generation)
        │
        ├── medical_reports (report_1_patient_summary) ──► report_versions ──► report_approvals
        ├── medical_reports (report_2_structured_profile) ──► report_versions ──► report_approvals
        └── medical_reports (report_3_medical_report) ──► report_versions ──► report_approvals
```

- Agent 1 creates exactly three `medical_reports` rows for the consultation, one per type, in one transaction.
- Each report has one or more `report_versions`. AI-generated and doctor-edited versions are separate rows.
- The doctor approves an exact `report_version`, not the report document as a whole.
- A rejected version can be followed by a new version; an approved version is never edited.
- `report_approvals` is the only source of clinical approval. AI output is a draft until that row exists.

| Report | Purpose | Approval | Release path |
|---|---|---|---|
| Report 1 — Patient-friendly | Approved summary, instructions, ordered tests, follow-up where available | Doctor, per version | `report_deliveries` after approval; patient portal / email |
| Report 2 — Structured profile | Structured clinical facts for Agent 2 | Doctor, per version | No patient delivery; feeds Agent 2 only |
| Report 3 — Separate medical report | **Unresolved** | Doctor, per version | **No destination or recipient modelled** |

**Report 3 is deliberately incomplete.** The design keeps a stable report type and generic `content` so a future specification can be added without rewriting Agent 1. It invents no recipient, storage destination, regulatory purpose or clinical workflow.

### 4.4 Agent 2 — longitudinal record proposals

```
approved Report 2 version
        │
        ▼
 agent_executions (agent_2_profile_organization)
        │
        ▼
 record_update_proposals
   ├── create / update / resolve / discontinue / correct
   ├── conflict_detected + conflict_details
   └── status: proposed
        │
        ▼
 doctor review (approve or reject)
        │
        ▼
 apply in one transaction
        │
        ├── medical_conditions
        ├── patient_medications
        ├── patient_allergies
        ├── medical_history_entries
        ├── test_orders
        └── test_results
```

Rules:

1. Agent 2 never writes a clinical fact directly.
2. Every proposal links to the Agent 2 execution and the approved Report 2 version.
3. A conflict is recorded explicitly; it is not resolved by overwriting.
4. Only a doctor may approve a proposal. The approval policy (per proposal, bulk, or rule-based) is **unresolved**; the schema supports per-proposal review.
5. On apply, a new fact row is inserted or a corrected row is created. The prior row is retained and linked through `superseded_by_id`.
6. `applied_at` is set only after the fact write commits.

### 4.5 Agent 3 — follow-up recommendations and proposed slots

```
approved report / follow-up recommendation
        │
        ▼
   follow_ups (recommended)
        │
        ▼
 agent_executions (agent_3_follow_up_scheduling)
        │
        ▼
 appointment_proposals (proposed)
        │
        ├── selected / declined / expired
        │
        ▼
 Staff or patient completes booking
        │
        ▼
   appointments (confirmed)
        │
        ▼
 appointment_proposals.status = booked + booked_appointment_id
```

The three states are distinct:

- **Recommendation** — `follow_ups`: clinically recommended, not scheduled.
- **Proposed slot** — `appointment_proposals`: an option, not a commitment.
- **Confirmed booking** — `appointments`: authoritative schedule after authorization and confirmation.

Agent 3 may read approved follow-up recommendations and availability. It may not create a confirmed booking, bypass Staff ownership, or treat a proposal as a booking.

### 4.6 OCR and RAG reference workflow

```
reference document
        │
        ▼
 reference_document_versions (source file + checksum)
        │
        ▼
 document_extraction_jobs (digital extraction or OCR)
        │
        ▼
 normalized_text
        │
        ▼
 quality review (reviewer, decision, notes)
        │
        ▼
 approved version
        │
        ▼
 reference_chunks (content + embedding reference)
        │
        ▼
 retrieval
        │
        ▼
 rag_queries ──► rag_citations ──► reference_chunks
```

Rules:

1. This module contains **no patient identifiers** and no patient-specific documents.
2. OCR is an extraction method, not a source of clinical approval.
3. A version must pass quality review and approval before indexing.
4. Chunks belong to an immutable document version; a new version creates new chunks.
5. RAG answers carry citations. Insufficient evidence is an explicit answer status, not a reason to invent an answer.
6. No vector column is declared. `embedding_ref` is an opaque external identifier. pgvector versus an external vector store is **unresolved**.

---

## 5. Approval and provenance matrix

| Artifact | Draft state | Who may approve | Approval record | Immutable version | Release gate |
|---|---|---|---|---|---|
| Transcript | `transcripts.status = draft/in_review` | Doctor assigned to the care relationship | `transcript_approvals` on `transcript_version_id` | `transcript_versions` append-only | Agent 1 may consume only an approved version |
| Report 1 | `medical_reports.status = draft/in_review` | Doctor | `report_approvals` on `report_version_id` | `report_versions` append-only | `report_deliveries` only after approval |
| Report 2 | Same | Doctor | Same | Same | Agent 2 only after approval |
| Report 3 | Same | Doctor | Same | Same | No release path defined |
| Agent 2 update | `record_update_proposals.status = proposed` | Doctor | `reviewed_by_user_id`, `reviewed_at`, `status` | Fact rows are never overwritten; `superseded_by_id` | Apply only after approval |
| Reference document | `status = extracted/quality_review` | Authorized reviewer | `quality_reviewed_by_user_id`, `approved_by_user_id` | `reference_document_versions` immutable | Indexing only after approval |
| Appointment | `requested/pending_confirmation` | Staff or policy | `confirmed_by_user_id`, `confirmed_at`, status history | Status history append-only | Becomes a booking only when confirmed |

**No AI row can approve anything.** `agent_executions` records what a service did; it is not a clinical decision.

---

## 6. Authorization model

### 6.1 Existing role model

The implemented roles are `patient`, `doctor`, `receptionist` (Staff) and `admin`. Permissions are seeded in migration `001` and assigned through `role_permissions`. The single-Admin rule is enforced by the migration `002` trigger.

New permission codes will be needed for later modules. They are **PROPOSED**, not applied. Examples:

- `appointments.request`, `appointments.confirm`, `appointments.reschedule`, `appointments.cancel`, `appointments.check_in`
- `availability.manage`
- `consultations.start`, `recordings.manage`, `transcripts.edit`
- `reports.generate`, `reports.deliver`
- `clinical_records.view_authorized`, `clinical_records.review`
- `reference_documents.manage`, `rag.query`
- `audit.view`, `notifications.view_own`

Do not grant these to roles until the policy is reviewed. The database `permissions` table is not an authorization boundary by itself.

### 6.2 Record-specific clinical access

`care_relationships` materialises a doctor's authorization for a patient. A doctor may read clinical data only when:

1. the user holds the `doctor` role; **and**
2. an active `care_relationships` row exists for `(doctor_user_id, patient_user_id)` with `status = active` and `expires_at` null or in the future; **or**
3. the doctor is assigned to the specific appointment/consultation being accessed, within the encounter scope.

A role alone never grants access to every patient. The service must include the relationship predicate in the query, not filter after loading.

### 6.3 Access matrix

| Resource | Patient | Doctor | Receptionist / Staff | Admin | AI service |
|---|---|---|---|---|---|
| Own account/profile | Read/update own | Read/update own professional fields | Read/update own | Manage accounts | None |
| Doctor directory | Read public fields | Read own | Read operational fields | Manage | None |
| Appointment operational data | Own appointments | Assigned appointments, read | All operational scheduling | Operational oversight | Scoped read for Agent 3 |
| Consultation clinical content | Own, after authorization | Assigned / active care relationship | **No clinical content** | **No clinical content by default** | Scoped execution input |
| Recording and transcript | Own consent; transcript only when released | Assigned doctor | No | No | Scoped processing |
| Reports | Own approved and released reports | Assigned doctor; approve | No | Workflow status only | Source versions only |
| Longitudinal record | Own approved information | Active care relationship | No | No | Approved source only |
| Reference knowledge base | No | Authorized query | No | Manage documents, not patient data | Retrieval service |
| Audit logs | No | No | No | Authorized audit view | Write own execution audit |

`Admin.md` requires Admin oversight without a general right to inspect confidential report content. The schema enforces this by policy and service authorization, not by a database grant. A future break-glass workflow would need its own justification, time limit and audit; it is not designed here.

### 6.4 Provisioning and activation

Doctor and Staff accounts are provisioned by Admin. Public signup remains patient-only. Migration `001` already allows `password_hash` to be null while an account is `pending_activation`.

A dedicated invitation/activation table is **not** included. The activation-token design belongs to the authentication phase and must store only hashed, time-limited tokens. Do not add plaintext tokens to `users` or audit logs.

### 6.5 AI service identities

AI agents should use a dedicated service credential or database role, not a human account. They receive:

- read access to the exact approved source version for an execution;
- write access to their own execution, generated draft, and proposal rows;
- no access to `report_approvals`, `transcript_approvals`, `consultation_consents` writes, or final delivery;
- no interactive login and no role in `roles`.

---

## 7. Consent, privacy, retention and audit

### 7.1 Consent

- `consultation_consents` is unique per `(consultation_id, consent_type)`.
- `audio_recording` consent is required before a recording row can exist.
- `transcription` and `ai_assisted_documentation` scopes are proposed. The exact legal consent set is unresolved.
- Revocation is recorded, not deleted. Whether an existing recording must be deleted on revocation is unresolved.
- Re-granting after revocation updates the current consent row; the earlier decision remains in `audit_logs`. If append-only consent history is required, add a consent-event table in a later migration (open decision 16).
- Consent is not inferred from a signed general terms document.

### 7.2 Minimum necessary data

- Clinical narratives belong in consultations, transcripts, reports and medical records, not in `users`, `patient_profiles`, notifications or audit metadata.
- `audit_logs.before_state` and `after_state` must be redacted.
- No passwords, raw tokens, audio bytes, report bodies or full request bodies in logs.
- Notification bodies contain a short non-clinical prompt and a link, not a diagnosis.

### 7.3 Retention and deletion

| Data | Policy in this design |
|---|---|
| Clinical facts and approvals | No hard delete; correction chains and immutable versions |
| Transcript/report versions | Append-only; approved versions immutable |
| Recordings | Metadata retained; object lifecycle governed by `retention_expires_at` and a future policy |
| Audit logs | Append-only; no cascade from users |
| Security events | Append-only; resolution fields only |
| Notifications | May cascade with the recipient; not a clinical record |
| RAG citations | Cascade with the query; chunks are restricted while cited |
| Reference documents | Retire versions; do not delete cited versions |

Clinical foreign keys use `RESTRICT` so a user with clinical history cannot be hard-deleted without a deliberate retention/de-identification workflow. That workflow is **not implemented**. Do not claim GDPR-style erasure is solved.

### 7.4 Audit

`audit_logs` records clinical access, approvals, disclosures, provisioning and configuration. `security_events` records authentication, session, rate-limit, CSRF, privilege and suspicious-access signals. They are separate because their retention and access audiences differ.

Application database roles should have `INSERT` and `SELECT` on audit tables, not `UPDATE` or `DELETE`. Monthly partitioning is a proposed operational step, not part of the logical model.

---

## 8. Concurrency, idempotency and integrity

### 8.1 Booking concurrency

The schema stores `appointments.version` for optimistic concurrency. The authoritative overlap guard must be a PostgreSQL exclusion constraint, added in migration hardening:

```sql
-- PROPOSED, not executed. Requires btree_gist.
ALTER TABLE appointments
  ADD CONSTRAINT ex_appointments_doctor_overlap
  EXCLUDE USING gist (
    doctor_user_id WITH =,
    tstzrange(scheduled_start_at, scheduled_end_at, '[)') WITH &&
  )
  WHERE (status IN ('pending_confirmation', 'confirmed', 'checked_in', 'in_progress'));
```

A second constraint should prevent the same patient from holding overlapping active appointments. The service must also:

1. start a transaction;
2. re-check availability, time off and existing appointments;
3. insert or update with the expected `version`;
4. handle the exclusion violation as a conflict, not a generic 500.

Time zones: `clinic_locations.timezone` defines the local wall clock; appointments store `timestamptz`. Availability windows are local `time` values plus a weekday.

### 8.2 AI retries and idempotency

- `agent_executions` has `idempotency_key`, `attempt_number` and `retry_of_execution_id`.
- Unique `(agent_code, idempotency_key, attempt_number)` prevents duplicate attempt rows.
- Unique `(consultation_id, report_type)` on `medical_reports` prevents Agent 1 from creating a second report document for the same type.
- A retry creates a new version or attempt; it does not mutate the prior output.
- Agent 2 applies proposals in one transaction with a row lock and re-checks the conflict state before writing.
- Agent 3 proposals are advisory; only a real booking sets `booked_appointment_id`.

### 8.3 Approval integrity

- `transcript_approvals.transcript_version_id` is unique.
- `report_approvals.report_version_id` is unique.
- One decision per version. A later decision requires a new version.
- Hardening should add triggers that reject `UPDATE`/`DELETE` on approved transcript/report versions and on approval rows.

### 8.4 Foreign-key cycles

The logical ERD contains deliberate cycles:

- `agent_executions.source_transcript_version_id` ↔ `transcript_versions.generated_by_execution_id`
- `agent_executions.source_report_version_id` ↔ `report_versions.generated_by_execution_id`

This is valid in PostgreSQL when tables are created first and foreign keys are added afterwards. Each migration must create tables in dependency order, then `ALTER TABLE ... ADD CONSTRAINT`. The migration runner wraps each file in one transaction, so this is safe. Do not add `BEGIN`/`COMMIT` inside migration files.

---

## 9. Storage architecture

Storage is **unresolved**. The schema stores references and integrity metadata only:

| Object | Table | Fields |
|---|---|---|
| Consultation audio | `consultation_recordings` | `storage_provider`, `storage_key`, `mime_type`, `size_bytes`, `checksum_sha256`, `retention_expires_at` |
| Reference source file | `reference_document_versions` | `file_storage_provider`, `file_key`, `file_checksum_sha256`, `mime_type`, `file_size_bytes` |
| Test result attachment | `test_results` | `document_provider`, `document_key` |
| Report rendering/PDF | Not modelled | `report_versions.rendered_text` is content, not a stored artefact |

Options to decide later: S3-compatible object storage, Azure Blob, or a local development adapter. The API should issue short-lived signed URLs; never store signed URLs or credentials in the database. Encryption at rest, malware scanning and object lifecycle rules are operational requirements, not columns.

---

## 10. Existing versus proposed inventory

### 10.1 Existing implemented tables (10)

| Table | Migration | Purpose |
|---|---|---|
| `users` | 001 | Human accounts, status, activation |
| `roles` | 001 | Four human roles |
| `user_roles` | 001 | Role assignment; single-Admin trigger in 002 |
| `permissions` | 001 | Permission catalogue |
| `role_permissions` | 001 | Role-permission grants |
| `sessions` | 001 | Hashed session tokens |
| `patient_profiles` | 003 | Demographic profile only |
| `specialties` | 003 | Clinical specialty reference data |
| `doctor_profiles` | 003 | Professional profile and credential verification |
| `schema_migrations` | Runner | Applied migration history and checksums |

### 10.2 Proposed tables (35)

| Module | Proposed tables |
|---|---|
| Profiles & Care Access | `care_relationships` |
| Scheduling & Follow-Up | `clinic_locations`, `doctor_availability`, `doctor_time_off`, `appointments`, `appointment_status_history`, `follow_ups`, `appointment_proposals` |
| Consultations & Transcripts | `consultations`, `consultation_consents`, `consultation_recordings`, `transcripts`, `transcript_versions`, `transcript_approvals` |
| AI Agents & Reports | `agent_executions`, `medical_reports`, `report_versions`, `report_approvals`, `report_deliveries`, `record_update_proposals` |
| Medical Records | `medical_conditions`, `patient_medications`, `patient_allergies`, `medical_history_entries`, `test_orders`, `test_results` |
| Reference Knowledge | `reference_documents`, `reference_document_versions`, `document_extraction_jobs`, `reference_chunks`, `rag_queries`, `rag_citations` |
| Operations & Audit | `notifications`, `audit_logs`, `security_events` |

### 10.3 Counts

| Measure | Count |
|---|---:|
| Implemented tables | 10 |
| Proposed tables | 35 |
| Total tables | 45 |
| Implemented relationships | 10 |
| Proposed relationships | 119 |
| Total relationships | 129 |
| Proposed CHECK/unique/index rules documented | See data dictionary; PostgreSQL-specific constraints listed per table |

**No proposed table is claimed to exist in PostgreSQL.** The only implemented objects are those created by migrations `001`–`003` plus the runner's history table.

---

## 11. Staged SQL migration plan (not executed)

Each stage is a separate numbered migration. The existing runner discovers files by numeric prefix, wraps each file in one transaction, and records a checksum. Do not put `BEGIN`/`COMMIT` inside a file. Do not edit `001`, `002` or `003`.

| Stage | Proposed file | Creates | Depends on | Notes |
|---|---|---|---|---|
| 004 | `004_scheduling_and_care_access.sql` | `clinic_locations`, `appointments`, `appointment_status_history`, `care_relationships`, `doctor_availability`, `doctor_time_off` | 001–003 | Create `appointments` before `care_relationships` because of `source_appointment_id`. Seed one clinic only after clinic identity is confirmed. Add proposed permission codes separately. |
| 005 | `005_consultation_capture.sql` | `consultations`, `consultation_consents`, `consultation_recordings` | 004 | Consent and recording metadata. No audio bytes. |
| 006 | `006_ai_execution_envelope.sql` | `agent_executions` (without the two source-version foreign keys) | 001, 005 | Shared execution audit. Add source-version FKs in 007 and 008 after the target tables exist. |
| 007 | `007_transcripts_and_approvals.sql` | `transcripts`, `transcript_versions`, `transcript_approvals`; `ALTER agent_executions` add `source_transcript_version_id` FK | 005, 006 | Enforce one approval per version. Append-only trigger in 013. |
| 008 | `008_reports_and_delivery.sql` | `medical_reports`, `report_versions`, `report_approvals`, `report_deliveries`; `ALTER agent_executions` add `source_report_version_id` FK | 006, 007 | Unique report type per consultation. Delivery gate for approved Report 1 in 013. |
| 009 | `009_medical_records_and_agent2.sql` | `record_update_proposals`, `medical_conditions`, `patient_medications`, `patient_allergies`, `medical_history_entries`, `test_orders`, `test_results` | 006, 008 | Create proposals before facts so `source_proposal_id` can be a real FK. No seed clinical data. |
| 010 | `010_followups_and_proposals.sql` | `follow_ups`, `appointment_proposals` | 004, 008, 009 | Recommendation ≠ proposal ≠ booking. Unique booked proposal. |
| 011 | `011_reference_knowledge.sql` | `reference_documents`, `reference_document_versions`, `document_extraction_jobs`, `reference_chunks`, `rag_queries`, `rag_citations` | 001 | No patient data. No vector column. Add FTS index in 013. |
| 012 | `012_notifications_audit_security.sql` | `notifications`, `audit_logs`, `security_events` | 001 | Append-only audit. No cascading delete from users. |
| 013 | `013_constraints_seeds_and_hardening.sql` | `btree_gist`; appointment/time-off exclusion constraints; partial unique indexes; GIN full-text index; immutability and delivery-gate triggers; permission seeds | 004–012 | PostgreSQL-specific rules that DBML cannot express. Review separately; can be merged into earlier stages if the team prefers fewer migrations. |

### 11.1 Rules for every stage

1. Apply only to a throwaway database first. Never test a destructive change against `medora_db`.
2. Verify the migration runner checksum for `001`–`003` is unchanged.
3. Add PK, FK, CHECK, UNIQUE and indexes in the same stage as the table unless a dependency requires `ALTER`.
4. Add foreign keys after tables in the same file when a cycle exists.
5. Do not backfill clinical data. There is no approved source of real patient data for development.
6. Do not grant new role permissions until the authorization policy is reviewed.
7. Record rollback as a compensating forward migration. Do not add destructive `DROP` statements to production migrations.

### 11.2 Validation gates before applying to `medora_db`

- Parse `database/medora.dbml` with the DBML CLI.
- Apply all stages to a disposable PostgreSQL 18 database.
- Test: double booking rejected, consent gate, one approval per version, immutable approved version, one booking per proposal, Agent 2 apply transaction, RAG citation integrity.
- Run `EXPLAIN` for patient appointment history, doctor day schedule, active care relationship lookup and report delivery lookup.
- Review row-level access predicates with the backend authorization tests.
- Obtain explicit approval before touching a developer database.

---

## 12. Open decisions

| # | Decision | Current design | Options | Recommendation | Reversibility |
|---|---|---|---|---|---|
| 1 | Manual versus automatic appointment confirmation | Supports both `pending_confirmation` and `confirmed`; no default policy | Staff confirms every request; auto-confirm when availability matches; hybrid by consultation type | Staff-confirmed for MVP; add auto-confirm only after a written policy and audit rules | High — status policy, not schema |
| 2 | Separate appointment-request table | One `appointments` table with request fields and statuses | Keep one table; split requests; separate request and booking tables | Keep one table for MVP | High — a view or new table can split later |
| 3 | Scheduling ownership and availability updates | Staff/Admin write availability; doctor reads; `created_by_user_id` records actor | Staff-only; doctor self-service; doctor proposes and Staff approves | Staff/Admin write for MVP; add a doctor change-request workflow later | Medium — a request table can be added |
| 4 | Report 3 purpose and destination | `report_3_medical_report` type with generic content; no delivery path | Internal clinical record; referral document; research export; other | Do not implement until a specification is approved | High — no recipient or storage is fixed |
| 5 | Agent 2 update approval policy | One doctor decision per proposal | Per proposal; bulk approval; rule-based auto-apply for low-risk facts | Per-proposal doctor review for all clinical facts | Medium — bulk workflow can be added above the table |
| 6 | Recording and document storage | Provider, key, checksum and retention metadata only | S3-compatible; Azure Blob; local adapter; managed clinical store | Choose after security review; keep provider abstraction | High — provider fields are generic |
| 7 | RAG vector search | `embedding_ref` external identifier; no vector column | pgvector; external vector database; keyword-only first | Start with keyword/BM25 or external store; add pgvector only after approval | High — add a vector column and index later |
| 8 | Clinical retention and deletion | `RESTRICT` clinical FKs; correction chains; no erasure workflow | Fixed retention; de-identification; legal hold; patient-requested deletion | Define retention by data class before production; do not promise erasure yet | Medium — retention columns and jobs can be added |
| 9 | Multi-clinic support | `clinic_locations` supports multiple rows; no tenant isolation | Single clinic; multi-clinic shared staff; multi-tenant clinics | Single clinic for MVP; add tenant keys and RLS only after an architecture decision | Medium — adding `tenant_id` is a broad migration |
| 10 | Consent scopes | `audio_recording`, `transcription`, `ai_assisted_documentation` | Audio only; separate AI processing consent; jurisdiction-specific | Confirm with legal/privacy review before production | Medium — values are a CHECK list |
| 11 | Patient deletion and de-identification | Clinical FKs block hard delete | Anonymisation; legal hold; archive | Design a de-identification workflow; do not cascade clinical history | Medium |
| 12 | Notification channels | `in_app`, `email`, `sms` | Add push; preferences table | Start in-app plus email; add preferences when delivery is built | High |
| 13 | Report PDF artefacts | `rendered_text` only | Store PDF; render on demand; external document service | Decide with Report 1 delivery and Report 3 specification | High |
| 14 | Staff invitation/activation | No invitation table; `pending_activation` exists | Add `user_invitations`; use an external identity provider | Design with the authentication phase; store only hashed tokens | High |
| 15 | Break-glass Admin clinical access | Not designed | No access; time-limited justified access; dual approval | Do not add until policy, audit and UI are specified | High |
| 16 | Append-only consent history | One current row per consent scope; re-grant updates it and prior decisions remain in audit | Keep current row; add a consent-event table; forbid re-grant in the same consultation | Keep current row for MVP; add consent events if legal review requires versioned consent | High — an event table can be added without changing recordings |

---

## 13. Validation record

| Check | Result |
|---|---|
| DBML parse with `@dbml/cli` `dbml2sql` 11.0.0 | Passed, exit code 0 |
| PostgreSQL SQL generation to a temp file | Passed; file was not executed |
| Table count | 45 (10 implemented + 35 proposed) |
| Relationship count | 129 (10 implemented + 119 proposed) |
| Broken table/column references | 0 |
| Tables outside a TableGroup | 0 |
| FK-like columns without a relationship | 1: `audit_logs.request_id`, a correlation id, not a foreign key; no missing relationships |
| Proposed columns documented | 480 of 480 in the data dictionary |
| Applied migrations edited | 0 |
| SQL executed against any database | 0 |
| Backend/frontend files changed | 0 |

**Limitations of DBML validation:** DBML cannot express `CHECK` constraints, partial indexes, exclusion constraints, triggers or grants. Those are documented in table notes and in this architecture, and must be validated when the SQL migrations are written and applied to a disposable database.

---

## 14. What is deliberately not included

- No backend API implementation.
- No frontend changes.
- No SQL migration files and no database execution.
- No changes to `Admin.md`.
- No duplicate users/roles per dashboard.
- No invitation table, system settings table, favorites, reviews, payments, video links or notification preferences.
- No claim that Report 3 has an approved purpose, recipient or storage destination.
- No claim that AI output is clinically approved.
- No claim that proposed tables exist in PostgreSQL.

---

## 15. Next safe actions

1. Review the 15 open decisions, starting with appointment confirmation, Report 3, Agent 2 approval and storage.
2. Approve the module boundaries and table names before writing SQL.
3. Write migration `004` only, on a branch, and apply it to a disposable PostgreSQL 18 database.
4. Add backend authorization tests for record-specific access before exposing any clinical endpoint.
5. Re-run the DBML validation after any schema change and keep `database/medora.dbml` as the single canonical ERD.

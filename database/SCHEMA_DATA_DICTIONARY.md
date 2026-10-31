# Medora Schema Data Dictionary

> **⚠ SUPERSEDED — read this banner before using the document.**
> This dictionary describes the original **45-table V1 design** and is kept for
> history only. Six tables it documents no longer exist:
> `appointment_status_history`, `security_events`, `transcript_approvals`,
> `report_approvals`, `report_deliveries`, `document_extraction_jobs`.
>
> Current sources of truth:
> - **ERD:** [`database/medora.dbml`](./medora.dbml) — 39 tables, verified against PostgreSQL
> - **Beginner explanation:** [`database/DATABASE_ARCHITECTURE_V2.md`](./DATABASE_ARCHITECTURE_V2.md)
>
> Column definitions below are accurate only for the tables that survived V2.

**Status (historical):** Design only. Proposed tables are not present in PostgreSQL until future migrations are approved and applied.
**Canonical ERD:** [`database/medora.dbml`](./medora.dbml)
**Architecture:** [`database/SCHEMA_ARCHITECTURE.md`](./SCHEMA_ARCHITECTURE.md)
**Date:** 28 October 2026

---

## 1. How to read this dictionary

### 1.1 Scope

- **Implemented tables** are summarised in section 2. Their authoritative definitions are the applied migrations `001`–`003` and the runner-owned `schema_migrations` table.
- **Proposed tables** are documented column by column in sections 3–9. They exist only in the logical ERD.
- Every proposed column in `database/medora.dbml` appears here. If the two disagree, the DBML is the canonical structural source and this document must be corrected.

### 1.2 Conventions

| Convention | Meaning |
|---|---|
| `uuid` primary keys | `gen_random_uuid()` from `pgcrypto`, already enabled by migration `001` |
| `timestamptz` | Stored in UTC; the API renders in the clinic or user time zone |
| `date` | Calendar date without time or zone (birth dates, clinical dates) |
| `varchar(n)` statuses | PostgreSQL `CHECK` constraints, not native enums, so values can evolve in a new migration without an enum rewrite |
| `NULL` | The column is nullable; the API decides whether the field is required for a given operation |
| `default` | Database default; service code may still set an explicit value |
| `RESTRICT` | Deletion of the referenced row is blocked while dependent rows exist |
| `SET NULL` | The reference is cleared when the referenced row is deleted; used for actors and optional links |
| `CASCADE` | Child rows are deleted with the parent; used only for non-clinical ownership such as notifications and RAG citations |
| Provenance columns | `source_type`, `source_report_version_id`, `source_proposal_id`, `created_by_user_id`, `superseded_by_id` |
| `PROPOSED` | Not implemented in any database |

### 1.3 Cross-cutting rules

1. Clinical tables never use `ON DELETE CASCADE` from `users`.
2. Clinical facts are corrected by inserting a new row and setting `superseded_by_id` on the old row; they are not updated in place.
3. Approved transcript and report versions are immutable. A correction is a new version.
4. AI executions, approvals and audit rows are append-only.
5. No table stores raw passwords, session tokens, audio bytes, report bodies in audit metadata, or signed storage URLs.
6. Polymorphic columns are explicitly marked and require service-side integrity checks.

---

## 2. Implemented tables (summary)

The following tables already exist. Their columns, constraints and delete behaviour are defined by the applied migrations and are not redefined here.

| Table | Primary key | Migration | Purpose and important implemented rules |
|---|---|---|---|
| `users` | `id` | 001 | Human accounts. Case-insensitive unique email index `uq_users_email_lower`. Status CHECK: `pending_activation`, `active`, `suspended`, `disabled`. `created_by` self-reference. |
| `roles` | `id` | 001 | Seeded `patient`, `doctor`, `receptionist`, `admin`. Receptionist represents Staff. |
| `user_roles` | `(user_id, role_id)` | 001, 002 | Role assignment. Migration 002 trigger prevents more than one Admin. Cascades on user/role deletion. |
| `permissions` | `id` | 001 | Permission catalogue. Seeded codes for appointments, consultations, transcripts, reports, users, roles and staff accounts. |
| `role_permissions` | `(role_id, permission_id)` | 001 | Role-permission grants. |
| `sessions` | `id` | 001 | Hashed opaque session tokens. Indexes on `user_id` and `expires_at`. Cascades on user deletion. |
| `patient_profiles` | `user_id` | 003 | Demographic profile only. Nullable DOB, phone, gender; `profile_completed_at`; gender and DOB CHECKs; `set_updated_at()` trigger. No clinical data. |
| `specialties` | `id` | 003 | Twelve seeded specialties. Unique name and slug. `is_active` for new assignments. |
| `doctor_profiles` | `user_id` | 003 | Professional profile. Unique licence index; specialty FK with `RESTRICT`; licence verification fields; `set_updated_at()` trigger. |
| `schema_migrations` | `version` | Runner | Applied migration name, SHA-256 checksum and timestamp. Runner-owned; never edit manually. |

**Implemented relationships:** 10. **Implemented tables:** 10.

---

## 3. Profiles and care access (proposed)

### 3.1 `care_relationships`

**Purpose.** Materialises record-specific doctor authorization for a patient. It is the explicit link that prevents a doctor role from implying access to every patient.

**Access.** Read by the authorization service and by the doctor/patient involved. Written by the provisioning or care-assignment workflow; Admin and Staff may create an operational assignment only within approved policy. Clinical access requires `status = active` and an unexpired grant.

**Delete policy.** `patient_user_id` and `doctor_user_id` are `RESTRICT`. `source_appointment_id`, `granted_by_user_id` and `revoked_by_user_id` are `SET NULL`. Grants are revoked, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id`; must hold the patient role (service-enforced) |
| `doctor_user_id` | uuid | NOT NULL; FK `users.id`; must hold the doctor role (service-enforced) |
| `source` | varchar(30) | NOT NULL; `appointment`, `consultation`, `admin_assignment`, `referral` |
| `source_appointment_id` | uuid | NULL; FK `appointments.id`; the encounter that created the grant, when applicable |
| `granted_by_user_id` | uuid | NULL; FK `users.id`; NULL for a system-created grant |
| `granted_at` | timestamptz | NOT NULL; default `now()` |
| `expires_at` | timestamptz | NULL; must be after `granted_at` when present |
| `revoked_at` | timestamptz | NULL; set only on revocation |
| `revoked_by_user_id` | uuid | NULL; FK `users.id` |
| `revocation_reason` | varchar(500) | NULL |
| `status` | varchar(20) | NOT NULL; default `active`; `active`, `expired`, `revoked` |

**Indexes and table constraints.**

- `idx_care_relationships_patient_status` on `(patient_user_id, status)`.
- `idx_care_relationships_doctor_status` on `(doctor_user_id, status)`.
- `idx_care_relationships_appointment` on `source_appointment_id`.
- Partial unique index `uq_care_relationships_active_pair` on `(patient_user_id, doctor_user_id) WHERE status = 'active'` — prevents duplicate live grants.
- CHECK `(expires_at IS NULL OR expires_at > granted_at)`.
- CHECK `(status <> 'revoked' OR revoked_at IS NOT NULL)`.
- CHECK `(status <> 'active' OR revoked_at IS NULL)`.
- Service rule: `expires_at` in the past is treated as expired even before a status update.

---

## 4. Scheduling and follow-up (proposed)

### 4.1 `clinic_locations`

**Purpose.** Physical clinic or virtual-service location, with the time zone that governs local availability windows.

**Access.** Read by patients for public booking information, by doctors and Staff for scheduling, and by Admin for management. Written by Admin/Staff within permission.

**Delete policy.** `RESTRICT` while referenced by appointments, availability or proposals. Deactivate instead of deleting.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `name` | varchar(150) | NOT NULL; unique together with `city` |
| `address_line1` | varchar(200) | NOT NULL |
| `address_line2` | varchar(200) | NULL |
| `city` | varchar(100) | NOT NULL |
| `country_code` | char(2) | NOT NULL; default `EG`; ISO 3166-1 alpha-2 |
| `timezone` | varchar(64) | NOT NULL; default `Africa/Cairo`; IANA zone name |
| `phone` | varchar(32) | NULL; normalised by the API |
| `is_active` | boolean | NOT NULL; default `true` |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- Unique `uq_clinic_locations_name_city` on `(name, city)`.
- `idx_clinic_locations_city` on `city`.
- `idx_clinic_locations_active` on `is_active`.
- MVP seeds one row only after the clinic identity is confirmed. Multi-clinic support is an open decision.

### 4.2 `doctor_availability`

**Purpose.** Recurring weekly availability template from which bookable slots are generated.

**Access.** Doctors read their own template. Staff/Admin manage it within permission. Patients read derived availability, not the raw template. `created_by_user_id` records the actor.

**Delete policy.** `RESTRICT` from doctors and clinics. Windows are deactivated or given an `effective_to` date; they are not deleted once appointments reference the period.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `doctor_user_id` | uuid | NOT NULL; FK `users.id`; must hold the doctor role |
| `clinic_location_id` | uuid | NOT NULL; FK `clinic_locations.id` |
| `weekday` | smallint | NOT NULL; `0` = Sunday through `6` = Saturday |
| `start_time` | time | NOT NULL; local clinic time |
| `end_time` | time | NOT NULL; local clinic time; must be after `start_time` |
| `slot_minutes` | smallint | NOT NULL; default `30`; allowed 10–120 |
| `consultation_type` | varchar(20) | NOT NULL; `in_person`, `online`, `both` |
| `effective_from` | date | NOT NULL; default `CURRENT_DATE` |
| `effective_to` | date | NULL; must be on or after `effective_from` |
| `is_active` | boolean | NOT NULL; default `true` |
| `created_by_user_id` | uuid | NULL; FK `users.id`; `SET NULL` |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- Unique `uq_doctor_availability_window` on `(doctor_user_id, clinic_location_id, weekday, start_time, end_time, consultation_type, effective_from)`.
- `idx_doctor_availability_doctor_weekday` on `(doctor_user_id, weekday, is_active)`.
- `idx_doctor_availability_clinic_weekday` on `(clinic_location_id, weekday)`.
- CHECK `(weekday BETWEEN 0 AND 6)`.
- CHECK `(end_time > start_time)`.
- CHECK `(slot_minutes BETWEEN 10 AND 120)`.
- CHECK `(effective_to IS NULL OR effective_to >= effective_from)`.
- Planned `btree_gist` exclusion constraint prevents overlapping windows for the same doctor and weekday across overlapping date ranges. DBML cannot express it.
- An appointment's `consultation_type` must be supported by the selected window (service rule).

### 4.3 `doctor_time_off`

**Purpose.** Blocked periods such as leave, conferences or emergency closure. Slot generation subtracts these ranges.

**Access.** Doctors read their own time off. Staff/Admin manage it within permission.

**Delete policy.** `RESTRICT` from doctors. Delete is allowed only while no confirmed appointment falls inside the period; otherwise reschedule first. The service should prefer keeping the row and auditing the change.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `doctor_user_id` | uuid | NOT NULL; FK `users.id` |
| `starts_at` | timestamptz | NOT NULL |
| `ends_at` | timestamptz | NOT NULL; must be after `starts_at` |
| `reason` | varchar(255) | NULL; operational text, no clinical narrative |
| `created_by_user_id` | uuid | NULL; FK `users.id`; `SET NULL` |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- `idx_doctor_time_off_doctor_range` on `(doctor_user_id, starts_at, ends_at)`.
- `idx_doctor_time_off_starts` on `starts_at`.
- CHECK `(ends_at > starts_at)`.
- Planned `btree_gist` exclusion constraint prevents overlapping time-off rows for the same doctor.

### 4.4 `appointments`

**Purpose.** The operational appointment record, covering a request, a confirmed booking, check-in, completion, cancellation and reschedule linkage.

**Access.** Patients access their own rows. Doctors access assigned rows and operational fields, not the booking queue. Staff manage all operational scheduling. Admin has oversight. Clinical content is not stored here.

**Delete policy.** `patient_user_id`, `doctor_user_id`, `specialty_id`, `clinic_location_id` and `booked_by_user_id` are `RESTRICT`. `confirmed_by_user_id`, `cancelled_by_user_id` and `rescheduled_from_appointment_id` are `SET NULL`. Hard delete is not supported; use status transitions.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id`; must hold the patient role |
| `doctor_user_id` | uuid | NOT NULL; FK `users.id`; must hold the doctor role |
| `specialty_id` | uuid | NOT NULL; FK `specialties.id`; snapshot at booking time |
| `clinic_location_id` | uuid | NULL; FK `clinic_locations.id`; required for in-person by service rule |
| `consultation_type` | varchar(20) | NOT NULL; `in_person`, `online` |
| `status` | varchar(30) | NOT NULL; default `requested`; `requested`, `pending_confirmation`, `confirmed`, `checked_in`, `in_progress`, `completed`, `cancelled`, `no_show`, `rescheduled` |
| `requested_start_at` | timestamptz | NULL; preferred start; may be null when the patient has no preference |
| `requested_end_at` | timestamptz | NULL; must be after `requested_start_at` when both exist |
| `scheduled_start_at` | timestamptz | NULL until confirmed; authoritative start |
| `scheduled_end_at` | timestamptz | NULL until confirmed; must be after `scheduled_start_at` when both exist |
| `requested_at` | timestamptz | NOT NULL; default `now()` |
| `reason` | varchar(500) | NULL; patient-supplied reason for visit |
| `patient_notes` | varchar(1000) | NULL; patient-supplied, non-clinical scheduling notes |
| `internal_notes` | text | NULL; Staff operational note; never clinical documentation |
| `booked_by_user_id` | uuid | NOT NULL; FK `users.id`; patient self-booking or Staff |
| `confirmed_by_user_id` | uuid | NULL; FK `users.id`; Staff or system actor |
| `confirmed_at` | timestamptz | NULL; required when status is confirmed or later |
| `checked_in_at` | timestamptz | NULL |
| `completed_at` | timestamptz | NULL |
| `cancelled_by_user_id` | uuid | NULL; FK `users.id` |
| `cancelled_at` | timestamptz | NULL; required when status is cancelled |
| `cancellation_reason` | varchar(500) | NULL |
| `rescheduled_from_appointment_id` | uuid | NULL; self-FK to the prior appointment; `SET NULL` |
| `version` | integer | NOT NULL; default `1`; optimistic concurrency token |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_appointments_patient_status_start` on `(patient_user_id, status, scheduled_start_at)`.
- `idx_appointments_doctor_status_start` on `(doctor_user_id, status, scheduled_start_at)`.
- `idx_appointments_clinic_start` on `(clinic_location_id, scheduled_start_at)`.
- `idx_appointments_status_requested` on `(status, requested_at)`.
- `idx_appointments_rescheduled_from` on `rescheduled_from_appointment_id`.
- CHECK `(scheduled_start_at IS NULL AND scheduled_end_at IS NULL) OR (scheduled_start_at IS NOT NULL AND scheduled_end_at IS NOT NULL AND scheduled_end_at > scheduled_start_at)`.
- CHECK `(requested_end_at IS NULL OR requested_start_at IS NULL OR requested_end_at > requested_start_at)`.
- CHECK `(status NOT IN ('confirmed','checked_in','in_progress','completed') OR scheduled_start_at IS NOT NULL)`.
- CHECK `(status <> 'cancelled' OR cancelled_at IS NOT NULL)`.
- CHECK `(version > 0)`.
- Planned `btree_gist` exclusion constraints prevent overlapping active appointments for the same doctor and for the same patient.
- Active set for overlap: `requested`, `pending_confirmation`, `confirmed`, `checked_in`, `in_progress`.
- Request versus booking is a status and timestamp distinction, not a separate table.

### 4.5 `appointment_status_history`

**Purpose.** Append-only operational timeline of appointment status changes.

**Access.** Read by the patient for their own appointment, the assigned doctor, Staff and Admin. Written by the service handling the transition.

**Delete policy.** `appointment_id` is `RESTRICT`; history is not deleted. `changed_by_user_id` is `SET NULL`.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `appointment_id` | uuid | NOT NULL; FK `appointments.id` |
| `from_status` | varchar(30) | NULL only for the initial row |
| `to_status` | varchar(30) | NOT NULL; same value set as `appointments.status` |
| `changed_by_user_id` | uuid | NULL; FK `users.id`; NULL for a system transition |
| `change_source` | varchar(20) | NOT NULL; default `system`; `patient`, `staff`, `doctor`, `admin`, `system`, `agent` |
| `reason` | varchar(500) | NULL |
| `changed_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- `idx_appointment_status_history_appointment` on `(appointment_id, changed_at)`.
- `idx_appointment_status_history_changed_at` on `changed_at`.
- Append-only: the application role should not have `UPDATE` or `DELETE`.

### 4.6 `follow_ups`

**Purpose.** A doctor-approved follow-up recommendation derived from an approved report version. It is a recommendation, not a slot and not a booking.

**Access.** Patients read their own released recommendation. Doctors read and create for patients in an active care relationship. Staff read scheduling-relevant fields to coordinate. Agent 3 reads approved recommendations for its scoped patient.

**Delete policy.** All patient, doctor, consultation and report-version references are `RESTRICT`. A recommendation is cancelled or declined, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `doctor_user_id` | uuid | NOT NULL; FK `users.id` |
| `consultation_id` | uuid | NOT NULL; FK `consultations.id` |
| `source_report_version_id` | uuid | NOT NULL; FK `report_versions.id`; must be an approved version |
| `recommendation` | text | NOT NULL |
| `recommended_interval_days` | integer | NULL; must be greater than zero when present |
| `due_on` | date | NULL; explicit due date when known |
| `status` | varchar(20) | NOT NULL; default `recommended`; `recommended`, `accepted`, `scheduling`, `scheduled`, `completed`, `declined`, `cancelled` |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_follow_ups_patient_status_due` on `(patient_user_id, status, due_on)`.
- `idx_follow_ups_doctor_status` on `(doctor_user_id, status)`.
- `idx_follow_ups_consultation` on `consultation_id`.
- `idx_follow_ups_report_version` on `source_report_version_id`.
- CHECK `(recommended_interval_days IS NULL OR recommended_interval_days > 0)`.
- Service rule: the source report version must have an approved `report_approvals` row.
- A follow-up becomes `scheduled` only when a linked appointment is confirmed.

### 4.7 `appointment_proposals`

**Purpose.** A proposed appointment slot generated by Agent 3 or Staff. A proposal is not a booking.

**Access.** Patients see their own proposals. Doctors see proposals for their own schedule. Staff manage and convert them into bookings. Agent 3 writes proposals only within its execution scope.

**Delete policy.** Patient, doctor, follow-up, clinic, creator and Agent execution references are `RESTRICT`. `booked_appointment_id` is `RESTRICT`. Proposals expire or are cancelled; they are not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `doctor_user_id` | uuid | NOT NULL; FK `users.id` |
| `follow_up_id` | uuid | NULL; FK `follow_ups.id`; NULL for a proposal unrelated to a follow-up |
| `clinic_location_id` | uuid | NULL; FK `clinic_locations.id` |
| `consultation_type` | varchar(20) | NOT NULL; `in_person`, `online` |
| `proposed_start_at` | timestamptz | NOT NULL |
| `proposed_end_at` | timestamptz | NOT NULL; must be after `proposed_start_at` |
| `status` | varchar(20) | NOT NULL; default `proposed`; `proposed`, `selected`, `booked`, `declined`, `expired`, `cancelled` |
| `created_by_user_id` | uuid | NULL; FK `users.id`; set when Staff created it |
| `created_by_agent_execution_id` | uuid | NULL; FK `agent_executions.id`; set when Agent 3 created it |
| `expires_at` | timestamptz | NULL |
| `booked_appointment_id` | uuid | NULL; UNIQUE; FK `appointments.id`; set only on a real booking |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_appointment_proposals_patient_status` on `(patient_user_id, status, proposed_start_at)`.
- `idx_appointment_proposals_doctor_start` on `(doctor_user_id, proposed_start_at)`.
- `idx_appointment_proposals_follow_up` on `follow_up_id`.
- `idx_appointment_proposals_execution` on `created_by_agent_execution_id`.
- Unique `booked_appointment_id` — one proposal cannot claim the same booking twice.
- CHECK `(proposed_end_at > proposed_start_at)`.
- CHECK `((status = 'booked') = (booked_appointment_id IS NOT NULL))`.
- CHECK `(created_by_user_id IS NOT NULL OR created_by_agent_execution_id IS NOT NULL)` — every proposal has an accountable creator.
- Partial unique index `uq_appointment_proposals_live_slot` on `(doctor_user_id, proposed_start_at) WHERE status IN ('proposed','selected')` — prevents duplicate live options for the same slot.

---

## 5. Consultations and transcripts (proposed)

### 5.1 `consultations`

**Purpose.** The clinical encounter container for one appointment.

**Access.** The patient, the assigned doctor with an active care relationship, and the service performing the encounter. Staff and Admin do not read clinical content. Read access to the transcript or report does not automatically grant access to the raw recording.

**Delete policy.** All references are `RESTRICT`. An encounter is cancelled, not deleted, once clinical artefacts exist.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `appointment_id` | uuid | NOT NULL; UNIQUE; FK `appointments.id`; one consultation per appointment |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `doctor_user_id` | uuid | NOT NULL; FK `users.id` |
| `status` | varchar(20) | NOT NULL; default `scheduled`; `scheduled`, `in_progress`, `completed`, `cancelled` |
| `started_at` | timestamptz | NULL |
| `ended_at` | timestamptz | NULL; must be after `started_at` when both exist |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- Unique `appointment_id`.
- `idx_consultations_patient_created` on `(patient_user_id, created_at)`.
- `idx_consultations_doctor_created` on `(doctor_user_id, created_at)`.
- CHECK `(ended_at IS NULL OR started_at IS NULL OR ended_at > started_at)`.
- Service rule: the patient and doctor must match the appointment.

### 5.2 `consultation_consents`

**Purpose.** Records the patient's decision for a specific consent scope in a consultation.

**Access.** The patient and assigned doctor may read. The recording/consultation service writes the decision. Staff may record a witnessed decision only within policy. Admin does not read clinical consent details by default.

**Delete policy.** `consultation_id`, `patient_user_id` and `recorded_by_user_id` are `RESTRICT`. Consent is revoked, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `consultation_id` | uuid | NOT NULL; FK `consultations.id` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `consent_type` | varchar(30) | NOT NULL; `audio_recording`, `transcription`, `ai_assisted_documentation` |
| `status` | varchar(20) | NOT NULL; `granted`, `declined`, `revoked` |
| `method` | varchar(20) | NOT NULL; `in_person_verbal`, `patient_portal`, `written` |
| `recorded_by_user_id` | uuid | NOT NULL; FK `users.id`; doctor or Staff witness |
| `granted_at` | timestamptz | NULL; required for granted or revoked |
| `revoked_at` | timestamptz | NULL; required only for revoked |
| `revocation_reason` | varchar(500) | NULL |
| `notes` | text | NULL; consent context, no clinical narrative |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- Unique `uq_consultation_consents_scope` on `(consultation_id, consent_type)`.
- `idx_consultation_consents_patient` on `(patient_user_id, consent_type)`.
- CHECK `(status <> 'granted' OR (granted_at IS NOT NULL AND revoked_at IS NULL))`.
- CHECK `(status <> 'revoked' OR (granted_at IS NOT NULL AND revoked_at IS NOT NULL))`.
- CHECK `(status <> 'declined' OR (granted_at IS NULL AND revoked_at IS NULL))`.
- Service rule: audio recording requires `audio_recording` status `granted`. Revocation stops future capture and processing.
- Re-granting after revocation updates this current row; the earlier decision remains in `audit_logs`. Append-only consent events are a documented future option, not part of this design.

### 5.3 `consultation_recordings`

**Purpose.** Metadata and object reference for consultation audio. Never stores audio bytes.

**Access.** The assigned doctor and the processing service. Staff do not access audio content. The patient may request their own recording only under an approved disclosure policy, which is not implemented here.

**Delete policy.** `consultation_id`, `consent_id` and `created_by_user_id` are `RESTRICT`. Object deletion is a lifecycle action: status becomes `deleted`, `deleted_at` is set, and the event is audited.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `consultation_id` | uuid | NOT NULL; FK `consultations.id` |
| `consent_id` | uuid | NOT NULL; FK `consultation_consents.id`; must be an audio_recording grant |
| `storage_provider` | varchar(50) | NOT NULL; provider identifier, decision open |
| `storage_key` | text | NOT NULL; object key, never a signed URL |
| `mime_type` | varchar(100) | NOT NULL |
| `size_bytes` | bigint | NULL; must be non-negative |
| `duration_seconds` | integer | NULL; must be positive |
| `checksum_sha256` | char(64) | NULL; integrity check |
| `status` | varchar(20) | NOT NULL; default `pending_upload`; `pending_upload`, `uploaded`, `processing`, `available`, `failed`, `deleted` |
| `recorded_started_at` | timestamptz | NULL |
| `recorded_ended_at` | timestamptz | NULL; must be after start when both exist |
| `retention_expires_at` | timestamptz | NULL; policy input for object lifecycle |
| `deleted_at` | timestamptz | NULL; set with status `deleted` |
| `created_by_user_id` | uuid | NOT NULL; FK `users.id` |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_consultation_recordings_consultation` on `consultation_id`.
- Unique `uq_consultation_recordings_object` on `(storage_provider, storage_key)`.
- `idx_consultation_recordings_status` on `status`.
- CHECK `(size_bytes IS NULL OR size_bytes >= 0)`.
- CHECK `(duration_seconds IS NULL OR duration_seconds > 0)`.
- CHECK `(recorded_ended_at IS NULL OR recorded_started_at IS NULL OR recorded_ended_at > recorded_started_at)`.
- CHECK `(status <> 'deleted' OR deleted_at IS NOT NULL)`.
- Service rule: the referenced consent must be granted at capture time; a later revocation does not rewrite the historical consent.

### 5.4 `transcripts`

**Purpose.** A transcript document for a consultation, with immutable versions.

**Access.** The assigned doctor and the processing service. Patients receive transcript-derived information only through an approved report, not raw transcript access by default.

**Delete policy.** `consultation_id` and `recording_id` are `RESTRICT`. `created_by_user_id` is `SET NULL`. Transcripts are superseded, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `consultation_id` | uuid | NOT NULL; FK `consultations.id` |
| `recording_id` | uuid | NULL; FK `consultation_recordings.id`; required for speech-to-text |
| `source` | varchar(20) | NOT NULL; `speech_to_text`, `manual` |
| `language` | varchar(16) | NOT NULL; default `en`; BCP-47 or ISO language tag |
| `status` | varchar(20) | NOT NULL; default `draft`; `draft`, `in_review`, `approved`, `rejected`, `superseded` |
| `created_by_user_id` | uuid | NULL; FK `users.id`; NULL for a system-generated transcript |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_transcripts_consultation` on `consultation_id`.
- `idx_transcripts_recording` on `recording_id`.
- `idx_transcripts_status` on `status`.
- CHECK `(source <> 'speech_to_text' OR recording_id IS NOT NULL)`.
- Service rule: status is a summary; the authoritative approval is `transcript_approvals` on a specific version.

### 5.5 `transcript_versions`

**Purpose.** Immutable transcript content versions, including the original speech-to-text draft and doctor corrections.

**Access.** The assigned doctor and the processing service. Only an approved version may be read by Agent 1. Patients do not read raw versions by default.

**Delete policy.** `transcript_id`, `generated_by_execution_id` and `edited_by_user_id` are `RESTRICT`. Append-only; no update or delete after creation.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `transcript_id` | uuid | NOT NULL; FK `transcripts.id` |
| `version_number` | integer | NOT NULL; greater than zero |
| `content` | text | NOT NULL |
| `content_format` | varchar(20) | NOT NULL; default `plain_text`; `plain_text`, `json` |
| `is_doctor_edited` | boolean | NOT NULL; default `false` |
| `generated_by_execution_id` | uuid | NULL; FK `agent_executions.id`; set for speech-to-text output |
| `edited_by_user_id` | uuid | NULL; FK `users.id`; required when `is_doctor_edited` is true |
| `content_hash` | char(64) | NOT NULL; SHA-256 of canonical content |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- Unique `uq_transcript_versions_number` on `(transcript_id, version_number)`.
- `idx_transcript_versions_execution` on `generated_by_execution_id`.
- CHECK `(version_number > 0)`.
- CHECK `(is_doctor_edited = false OR edited_by_user_id IS NOT NULL)`.
- CHECK `(generated_by_execution_id IS NOT NULL OR is_doctor_edited = true)` — every version has an origin.
- Append-only trigger in migration hardening rejects `UPDATE` and `DELETE`.
- A correction to an approved transcript creates a new version; the approved version is never mutated.

### 5.6 `transcript_approvals`

**Purpose.** Doctor decision on one exact transcript version. This is the gate that releases a transcript to Agent 1.

**Access.** The assigned doctor writes the decision. The patient and Staff do not write it. Admin cannot substitute for a doctor.

**Delete policy.** `transcript_version_id` and `decided_by_user_id` are `RESTRICT`. Approval rows are never deleted; a later decision requires a new version.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `transcript_version_id` | uuid | NOT NULL; UNIQUE; FK `transcript_versions.id` |
| `decision` | varchar(20) | NOT NULL; `approved`, `rejected` |
| `decided_by_user_id` | uuid | NOT NULL; FK `users.id`; must hold the doctor role |
| `decided_at` | timestamptz | NOT NULL; default `now()` |
| `note` | text | NULL; clinical rationale for rejection or approval |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- Unique `transcript_version_id` — one decision per version.
- Service rule: the deciding user must be the assigned doctor with an active care relationship.
- Service rule: only `decision = approved` may be consumed by Agent 1.

---

## 6. AI agents, reports and Agent 2 proposals (proposed)

### 6.1 `agent_executions`

**Purpose.** Shared audit envelope for internal AI services: speech-to-text, Agent 1, Agent 2 and Agent 3. It is not a human role and never grants clinical approval.

**Access.** The AI service writes its own execution. Authorized operators and auditors may read metadata. Clinical users see workflow status, not internal prompts. Admin sees operational status without confidential report content.

**Delete policy.** Patient, consultation and source-version references are `RESTRICT`. `requested_by_user_id` and `retry_of_execution_id` are `SET NULL`. Execution history is retained.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `agent_code` | varchar(40) | NOT NULL; `speech_to_text`, `agent_1_report_generation`, `agent_2_profile_organization`, `agent_3_follow_up_scheduling` |
| `status` | varchar(20) | NOT NULL; default `queued`; `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| `patient_user_id` | uuid | NULL; FK `users.id`; required for patient-scoped work |
| `consultation_id` | uuid | NULL; FK `consultations.id` |
| `source_transcript_version_id` | uuid | NULL; FK `transcript_versions.id`; required for Agent 1 |
| `source_report_version_id` | uuid | NULL; FK `report_versions.id`; required for Agent 2 |
| `requested_by_user_id` | uuid | NULL; FK `users.id`; NULL for a scheduled service run |
| `idempotency_key` | varchar(150) | NOT NULL; caller-supplied stable key |
| `attempt_number` | integer | NOT NULL; default `1`; greater than zero |
| `retry_of_execution_id` | uuid | NULL; self-FK; `SET NULL` |
| `model_provider` | varchar(80) | NULL |
| `model_name` | varchar(120) | NULL |
| `model_version` | varchar(80) | NULL |
| `prompt_version` | varchar(50) | NULL; version identifier, not the prompt text |
| `input_hash` | char(64) | NULL; integrity and deduplication |
| `output_hash` | char(64) | NULL |
| `started_at` | timestamptz | NULL |
| `completed_at` | timestamptz | NULL; not before `started_at` |
| `error_code` | varchar(80) | NULL |
| `error_message` | text | NULL; must not contain clinical narrative |
| `metadata` | jsonb | NOT NULL; default `{}`; non-clinical execution metadata only |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- Unique `uq_agent_executions_idempotency` on `(agent_code, idempotency_key, attempt_number)`.
- `idx_agent_executions_status` on `status`.
- `idx_agent_executions_patient_created` on `(patient_user_id, created_at)`.
- `idx_agent_executions_consultation` on `consultation_id`.
- `idx_agent_executions_transcript` on `source_transcript_version_id`.
- `idx_agent_executions_report` on `source_report_version_id`.
- CHECK `(attempt_number > 0)`.
- CHECK `(completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)`.
- CHECK `(agent_code <> 'agent_1_report_generation' OR source_transcript_version_id IS NOT NULL)`.
- CHECK `(agent_code <> 'agent_2_profile_organization' OR source_report_version_id IS NOT NULL)`.
- CHECK `(agent_code <> 'agent_3_follow_up_scheduling' OR consultation_id IS NOT NULL)`.
- CHECK `(agent_code NOT IN ('speech_to_text','agent_1_report_generation','agent_2_profile_organization') OR consultation_id IS NOT NULL)` — every consultation-scoped execution names its encounter.
- Service rule: metadata and error messages are redacted of patient narrative.

### 6.2 `medical_reports`

**Purpose.** One report document per type for a consultation: patient-friendly summary, structured profile input, or separate medical report.

**Access.** The assigned doctor, the patient for released Report 1, the AI service for generation, and Agent 2 for approved Report 2. Staff and Admin do not read report content by default.

**Delete policy.** `consultation_id`, `patient_user_id` and `doctor_user_id` are `RESTRICT`. Reports are superseded, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `consultation_id` | uuid | NOT NULL; FK `consultations.id` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `doctor_user_id` | uuid | NOT NULL; FK `users.id`; accountable doctor |
| `report_type` | varchar(40) | NOT NULL; `report_1_patient_summary`, `report_2_structured_profile`, `report_3_medical_report` |
| `status` | varchar(20) | NOT NULL; default `draft`; `draft`, `in_review`, `approved`, `rejected`, `superseded`, `released` |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- Unique `uq_medical_reports_consultation_type` on `(consultation_id, report_type)`.
- `idx_medical_reports_patient_status` on `(patient_user_id, status)`.
- `idx_medical_reports_doctor_status` on `(doctor_user_id, status)`.
- Service rule: Agent 1 creates all three report types in one transaction from one approved transcript version. The exact source is recorded on each `report_versions` row, not on the report document.
- Report 3 has no defined recipient, purpose or delivery path. Do not invent one.

### 6.3 `report_versions`

**Purpose.** Immutable content versions for a report, whether AI-generated or doctor-edited.

**Access.** The assigned doctor, the generation service and Agent 2 for approved Report 2. Report 1 is rendered to the patient only after approval and delivery.

**Delete policy.** `report_id`, `source_transcript_version_id`, `generated_by_execution_id` and `edited_by_user_id` are `RESTRICT`. Append-only; approved versions are immutable.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `report_id` | uuid | NOT NULL; FK `medical_reports.id` |
| `version_number` | integer | NOT NULL; greater than zero |
| `content` | jsonb | NOT NULL; schema varies by report type |
| `content_schema_version` | varchar(20) | NOT NULL; default `v1` |
| `source_transcript_version_id` | uuid | NOT NULL; FK `transcript_versions.id`; must be an approved transcript version |
| `rendered_text` | text | NULL; patient-safe or PDF-ready rendering |
| `generated_by_execution_id` | uuid | NULL; FK `agent_executions.id` |
| `edited_by_user_id` | uuid | NULL; FK `users.id` |
| `content_hash` | char(64) | NOT NULL; SHA-256 of canonical content |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- Unique `uq_report_versions_number` on `(report_id, version_number)`.
- `idx_report_versions_source_transcript` on `source_transcript_version_id`.
- `idx_report_versions_execution` on `generated_by_execution_id`.
- CHECK `(version_number > 0)`.
- Each version records the exact approved transcript version that produced it, so provenance survives a later transcript approval.
- CHECK `(generated_by_execution_id IS NOT NULL OR edited_by_user_id IS NOT NULL)` — every version has an origin.
- Append-only trigger in migration hardening rejects `UPDATE` and `DELETE` after creation.
- A doctor edit creates a new version; it does not overwrite the AI draft.

### 6.4 `report_approvals`

**Purpose.** Doctor decision on one exact report version. This is the only clinical approval for a report.

**Access.** The assigned doctor writes. Patients, Staff, Admin and AI services cannot write. Auditors may read.

**Delete policy.** `report_version_id` and `decided_by_user_id` are `RESTRICT`. Approval rows are never deleted; a new decision requires a new version.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `report_version_id` | uuid | NOT NULL; UNIQUE; FK `report_versions.id` |
| `decision` | varchar(20) | NOT NULL; `approved`, `rejected` |
| `decided_by_user_id` | uuid | NOT NULL; FK `users.id`; must hold the doctor role |
| `decided_at` | timestamptz | NOT NULL; default `now()` |
| `note` | text | NULL |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- Unique `report_version_id` — one decision per version.
- Service rule: doctor role plus active care relationship.
- Report 1 delivery requires an approved version. Report 2 may feed Agent 2 only when approved. Report 3 has no delivery path.

### 6.5 `report_deliveries`

**Purpose.** Delivery record for an approved Report 1 version to its patient. It is not a copy of the report.

**Access.** The patient reads their own delivery status and the released report. The service writes delivery events. Staff and Admin do not read report content; they may see operational delivery status only.

**Delete policy.** `report_version_id` and `patient_user_id` are `RESTRICT`. `delivered_by_user_id` is `SET NULL`. Revocation preserves the row.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `report_version_id` | uuid | NOT NULL; FK `report_versions.id` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `channel` | varchar(20) | NOT NULL; `patient_portal`, `email` |
| `status` | varchar(20) | NOT NULL; default `pending`; `pending`, `delivered`, `viewed`, `failed`, `revoked` |
| `delivered_by_user_id` | uuid | NULL; FK `users.id` |
| `delivered_at` | timestamptz | NULL |
| `viewed_at` | timestamptz | NULL |
| `revoked_at` | timestamptz | NULL |
| `revocation_reason` | varchar(500) | NULL |
| `metadata` | jsonb | NOT NULL; default `{}`; transport metadata only |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- Unique `uq_report_deliveries_target` on `(report_version_id, patient_user_id, channel)`.
- `idx_report_deliveries_patient_status` on `(patient_user_id, status, delivered_at)`.
- CHECK `(status NOT IN ('delivered','viewed') OR delivered_at IS NOT NULL)`.
- CHECK `(status <> 'viewed' OR viewed_at IS NOT NULL)`.
- CHECK `(status <> 'revoked' OR revoked_at IS NOT NULL)`.
- Service rule: only an approved Report 1 version may be delivered. Add a database trigger in migration hardening if the team wants defence in depth.
- No report content or clinical narrative in `metadata`.

### 6.6 `record_update_proposals`

**Purpose.** Agent 2 proposal to create, update, resolve, discontinue or correct a longitudinal clinical fact. It is a proposal, never an applied fact.

**Access.** The assigned doctor reviews. The Agent 2 service writes proposals. Patients do not see raw proposals. Staff and Admin do not approve them.

**Delete policy.** `patient_user_id`, `agent_execution_id`, `source_report_version_id` and `reviewed_by_user_id` are `RESTRICT`. Proposals are superseded or rejected, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `agent_execution_id` | uuid | NOT NULL; FK `agent_executions.id` |
| `source_report_version_id` | uuid | NOT NULL; FK `report_versions.id`; must be approved Report 2 |
| `target_entity_type` | varchar(40) | NOT NULL; `medical_condition`, `patient_medication`, `patient_allergy`, `medical_history_entry`, `test_order`, `test_result` |
| `target_entity_id` | uuid | NULL; polymorphic target; NULL for create; no database FK |
| `proposal_type` | varchar(20) | NOT NULL; `create`, `update`, `resolve`, `discontinue`, `correct` |
| `proposed_changes` | jsonb | NOT NULL |
| `rationale` | text | NULL |
| `conflict_detected` | boolean | NOT NULL; default `false` |
| `conflict_details` | jsonb | NULL; required when a conflict is detected |
| `status` | varchar(20) | NOT NULL; default `proposed`; `proposed`, `approved`, `rejected`, `applied`, `superseded` |
| `reviewed_by_user_id` | uuid | NULL; FK `users.id`; required after review |
| `reviewed_at` | timestamptz | NULL |
| `applied_at` | timestamptz | NULL; set only after the fact write commits |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_record_update_proposals_patient_status` on `(patient_user_id, status, created_at)`.
- `idx_record_update_proposals_execution` on `agent_execution_id`.
- `idx_record_update_proposals_source_version` on `source_report_version_id`.
- `idx_record_update_proposals_target` on `(target_entity_type, target_entity_id)`.
- CHECK `(conflict_detected = false OR conflict_details IS NOT NULL)`.
- CHECK `(status = 'proposed' OR reviewed_by_user_id IS NOT NULL)`.
- CHECK `(status <> 'applied' OR applied_at IS NOT NULL)`.
- CHECK `(proposal_type <> 'create' OR target_entity_id IS NULL)`.
- CHECK `(proposal_type = 'create' OR target_entity_id IS NOT NULL)`.
- Service rule: validate `target_entity_type` and `target_entity_id` in the same transaction as apply; a polymorphic target cannot have a database FK.
- Service rule: only a doctor may approve; Agent 2 cannot approve or apply its own proposal.

---

## 7. Longitudinal medical records (proposed)

### 7.1 Common provenance rules

All six tables in this module share these rules:

- `source_type` is `patient_reported`, `doctor_entered`, `agent_2_derived` or `imported`.
- `source_report_version_id` is set when the fact came from an approved report.
- `source_proposal_id` is set when Agent 2 proposed the fact and a doctor approved it.
- `created_by_user_id` is the human who entered or approved the fact; it is NULL for an automated import with no human author.
- `superseded_by_id` forms a correction chain. The old row is retained and remains visible in history.
- Clinical rows are never hard-deleted. The patient, author and source references are `RESTRICT`.

### 7.2 `medical_conditions`

**Purpose.** Longitudinal diagnoses and conditions, including suspected, active, resolved and in-remission states.

**Access.** Patient reads own released information. Doctor reads with an active care relationship. Staff and Admin do not read clinical content by default. Agent 2 writes only through an approved proposal.

**Delete policy.** `patient_user_id`, `source_report_version_id`, `source_proposal_id`, `created_by_user_id` and `superseded_by_id` are `RESTRICT`.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `condition_name` | varchar(200) | NOT NULL |
| `condition_code` | varchar(32) | NULL; coded value when available |
| `coding_system` | varchar(30) | NULL; `icd_10`, `icd_11`, `snomed`, `local` |
| `clinical_status` | varchar(20) | NOT NULL; default `active`; `active`, `resolved`, `in_remission`, `suspected`, `entered_in_error` |
| `onset_date` | date | NULL |
| `resolved_date` | date | NULL; not before `onset_date` when both exist |
| `severity` | varchar(20) | NULL; `mild`, `moderate`, `severe`, `unknown` |
| `source_type` | varchar(30) | NOT NULL; default `doctor_entered`; `patient_reported`, `doctor_entered`, `agent_2_derived`, `imported` |
| `source_report_version_id` | uuid | NULL; FK `report_versions.id` |
| `source_proposal_id` | uuid | NULL; FK `record_update_proposals.id` |
| `created_by_user_id` | uuid | NULL; FK `users.id` |
| `recorded_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |
| `superseded_by_id` | uuid | NULL; self-FK to the correcting row; `RESTRICT` |

**Indexes and table constraints.**

- `idx_medical_conditions_patient_status` on `(patient_user_id, clinical_status)`.
- `idx_medical_conditions_patient_onset` on `(patient_user_id, onset_date)`.
- `idx_medical_conditions_source_version` on `source_report_version_id`.
- CHECK `(resolved_date IS NULL OR onset_date IS NULL OR resolved_date >= onset_date)`.
- CHECK `(coding_system IS NULL OR condition_code IS NOT NULL)`.
- Service rule: `source_type = agent_2_derived` requires an approved `source_proposal_id`.

### 7.3 `patient_medications`

**Purpose.** Longitudinal medication list with lifecycle state and prescriber attribution.

**Access.** Patient reads own released information. Doctor reads with an active care relationship. Staff and Admin do not read clinical content by default.

**Delete policy.** Patient, prescriber, source and supersession references are `RESTRICT`. Stopping a medication creates a corrected row; it does not delete history.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `medication_name` | varchar(200) | NOT NULL |
| `medication_code` | varchar(32) | NULL; RxNorm, ATC or local code |
| `coding_system` | varchar(30) | NULL; `rxnorm`, `atc`, `local` |
| `dosage` | varchar(100) | NULL; free text such as `500 mg`; structured dosing is not specified |
| `frequency` | varchar(100) | NULL |
| `route` | varchar(50) | NULL |
| `indication` | varchar(300) | NULL |
| `started_on` | date | NULL |
| `ended_on` | date | NULL; not before `started_on` when both exist |
| `status` | varchar(20) | NOT NULL; default `active`; `active`, `stopped`, `completed`, `on_hold`, `entered_in_error` |
| `prescriber_user_id` | uuid | NULL; FK `users.id` |
| `source_type` | varchar(30) | NOT NULL; default `doctor_entered` |
| `source_report_version_id` | uuid | NULL; FK `report_versions.id` |
| `source_proposal_id` | uuid | NULL; FK `record_update_proposals.id` |
| `created_by_user_id` | uuid | NULL; FK `users.id` |
| `recorded_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |
| `superseded_by_id` | uuid | NULL; self-FK; `RESTRICT` |

**Indexes and table constraints.**

- `idx_patient_medications_patient_status` on `(patient_user_id, status)`.
- `idx_patient_medications_patient_started` on `(patient_user_id, started_on)`.
- `idx_patient_medications_source_version` on `source_report_version_id`.
- CHECK `(ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)`.
- CHECK `(coding_system IS NULL OR medication_code IS NOT NULL)`.

### 7.4 `patient_allergies`

**Purpose.** Allergy and intolerance history with reaction and severity. Allergies are clinically significant and are never silently removed.

**Access.** Patient reads own released information. Doctor reads with an active care relationship. Staff and Admin do not read clinical content by default.

**Delete policy.** Patient, source, author and supersession references are `RESTRICT`. Resolution creates a corrected row and preserves the prior record.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `allergen` | varchar(200) | NOT NULL |
| `allergen_code` | varchar(32) | NULL |
| `coding_system` | varchar(30) | NULL; `snomed`, `local` |
| `reaction` | text | NULL |
| `severity` | varchar(20) | NULL; `mild`, `moderate`, `severe`, `life_threatening`, `unknown` |
| `status` | varchar(20) | NOT NULL; default `active`; `active`, `resolved`, `entered_in_error` |
| `onset_date` | date | NULL |
| `source_type` | varchar(30) | NOT NULL; default `doctor_entered` |
| `source_report_version_id` | uuid | NULL; FK `report_versions.id` |
| `source_proposal_id` | uuid | NULL; FK `record_update_proposals.id` |
| `created_by_user_id` | uuid | NULL; FK `users.id` |
| `recorded_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |
| `superseded_by_id` | uuid | NULL; self-FK; `RESTRICT` |

**Indexes and table constraints.**

- `idx_patient_allergies_patient_status` on `(patient_user_id, status)`.
- `idx_patient_allergies_source_version` on `source_report_version_id`.
- CHECK `(coding_system IS NULL OR allergen_code IS NOT NULL)`.

### 7.5 `medical_history_entries`

**Purpose.** General longitudinal history that is not a condition, medication or allergy: surgeries, hospitalizations, procedures, family history, immunizations, social history and other events.

**Access.** Patient reads own released information. Doctor reads with an active care relationship. Staff and Admin do not read clinical content by default.

**Delete policy.** Patient, source, author and supersession references are `RESTRICT`. Entries are corrected, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `entry_type` | varchar(30) | NOT NULL; `surgery`, `hospitalization`, `procedure`, `family_history`, `immunization`, `social_history`, `other` |
| `title` | varchar(200) | NOT NULL |
| `description` | text | NULL |
| `occurred_on` | date | NULL |
| `record_status` | varchar(20) | NOT NULL; default `historical`; `active`, `resolved`, `historical`, `entered_in_error` |
| `source_type` | varchar(30) | NOT NULL; default `doctor_entered` |
| `source_report_version_id` | uuid | NULL; FK `report_versions.id` |
| `source_proposal_id` | uuid | NULL; FK `record_update_proposals.id` |
| `created_by_user_id` | uuid | NULL; FK `users.id` |
| `recorded_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |
| `superseded_by_id` | uuid | NULL; self-FK; `RESTRICT` |

**Indexes and table constraints.**

- `idx_medical_history_patient_type` on `(patient_user_id, entry_type)`.
- `idx_medical_history_patient_occurred` on `(patient_user_id, occurred_on)`.
- `idx_medical_history_source_version` on `source_report_version_id`.
- Family history is represented here because no separate family-member model is approved.

### 7.6 `test_orders`

**Purpose.** A test ordered for a patient. Ordered, collected and resulted states are distinct; completion is not assumed at order time.

**Access.** Patient reads own released information. Doctor reads and orders with an active care relationship. Staff may coordinate collection within operational permission. Admin does not read clinical results by default.

**Delete policy.** Patient, ordering doctor, consultation, source and proposal references are `RESTRICT`. Cancel instead of delete.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `patient_user_id` | uuid | NOT NULL; FK `users.id` |
| `ordered_by_doctor_user_id` | uuid | NOT NULL; FK `users.id` |
| `consultation_id` | uuid | NULL; FK `consultations.id`; the encounter that generated the order |
| `source_report_version_id` | uuid | NULL; FK `report_versions.id` |
| `source_proposal_id` | uuid | NULL; FK `record_update_proposals.id` |
| `test_name` | varchar(200) | NOT NULL |
| `test_code` | varchar(32) | NULL; LOINC or local code |
| `coding_system` | varchar(30) | NULL; `loinc`, `local` |
| `priority` | varchar(20) | NOT NULL; default `routine`; `routine`, `urgent`, `stat` |
| `status` | varchar(20) | NOT NULL; default `ordered`; `ordered`, `scheduled`, `collected`, `resulted`, `cancelled` |
| `ordered_at` | timestamptz | NOT NULL; default `now()` |
| `scheduled_for` | timestamptz | NULL |
| `completed_at` | timestamptz | NULL; not before `ordered_at` |
| `cancelled_at` | timestamptz | NULL; required when cancelled |
| `cancellation_reason` | varchar(500) | NULL |
| `notes` | text | NULL; order context, no result value |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_test_orders_patient_status` on `(patient_user_id, status, ordered_at)`.
- `idx_test_orders_doctor_status` on `(ordered_by_doctor_user_id, status)`.
- `idx_test_orders_consultation` on `consultation_id`.
- `idx_test_orders_source_version` on `source_report_version_id`.
- CHECK `(completed_at IS NULL OR completed_at >= ordered_at)`.
- CHECK `(status <> 'cancelled' OR cancelled_at IS NOT NULL)`.
- CHECK `(coding_system IS NULL OR test_code IS NOT NULL)`.
- Ordered tests from Report 1 remain distinguishable from completed results; the report can list a test without implying it was performed.

### 7.7 `test_results`

**Purpose.** One analyte or reported value for a test order, with verification and correction history.

**Access.** Patient reads own released results. Doctor reads with an active care relationship. Staff and Admin do not read clinical result values by default.

**Delete policy.** Test order, report version, proposal, verifier and supersession references are `RESTRICT`. `resulted_by_user_id` is `SET NULL` to preserve the row if an account is lawfully removed. Corrected results are new rows.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `test_order_id` | uuid | NOT NULL; FK `test_orders.id` |
| `analyte_name` | varchar(200) | NOT NULL |
| `value_text` | text | NULL; qualitative result |
| `value_numeric` | numeric(18,6) | NULL; quantitative result |
| `unit` | varchar(50) | NULL |
| `reference_range` | varchar(150) | NULL |
| `abnormal_flag` | varchar(20) | NULL; `low`, `normal`, `high`, `critical_low`, `critical_high`, `unknown` |
| `result_status` | varchar(20) | NOT NULL; default `preliminary`; `preliminary`, `final`, `corrected`, `entered_in_error` |
| `resulted_at` | timestamptz | NOT NULL; default `now()` |
| `resulted_by_user_id` | uuid | NULL; FK `users.id`; `SET NULL` |
| `verified_by_user_id` | uuid | NULL; FK `users.id`; `RESTRICT`; clinical verification attribution is retained |
| `verified_at` | timestamptz | NULL; requires a verifier when present |
| `source_type` | varchar(30) | NOT NULL; default `doctor_entered`; `doctor_entered`, `imported`, `agent_2_derived`, `patient_reported` |
| `source_report_version_id` | uuid | NULL; FK `report_versions.id` |
| `source_proposal_id` | uuid | NULL; FK `record_update_proposals.id` |
| `document_provider` | varchar(50) | NULL; optional result document storage provider |
| `document_key` | text | NULL; optional object key |
| `notes` | text | NULL |
| `superseded_by_id` | uuid | NULL; self-FK; `RESTRICT` |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_test_results_order` on `test_order_id`.
- `idx_test_results_flag_resulted` on `(abnormal_flag, resulted_at)`.
- `idx_test_results_source_version` on `source_report_version_id`.
- `idx_test_results_superseded_by` on `superseded_by_id`.
- CHECK `(value_text IS NOT NULL OR value_numeric IS NOT NULL OR document_key IS NOT NULL)` — a result must contain a value or a document.
- CHECK `(verified_at IS NULL OR verified_by_user_id IS NOT NULL)`.
- CHECK `(document_provider IS NULL OR document_key IS NOT NULL)`.
- A corrected result creates a new row; the prior row points to it through `superseded_by_id`.
- Storage provider and key are placeholders until storage architecture is approved.

---

## 8. Reference knowledge base, OCR and RAG (proposed)

### 8.1 `reference_documents`

**Purpose.** Bibliographic work in the medical reference knowledge base. This module is separate from patient-specific data.

**Access.** Clinicians with `rag.query` may search approved content. Authorized knowledge-base managers ingest and retire documents. Admin may manage the catalogue without accessing patient data. Patients do not access the reference library by default.

**Delete policy.** `created_by_user_id` is `SET NULL`. Documents referenced by versions and citations are retired, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `title` | varchar(300) | NOT NULL |
| `authors` | text | NULL |
| `publisher` | varchar(200) | NULL |
| `publication_year` | smallint | NULL; 1800–2100 |
| `source_type` | varchar(30) | NOT NULL; `clinical_guideline`, `systematic_review`, `journal_article`, `textbook`, `protocol`, `patient_education`, `other` |
| `language` | varchar(16) | NOT NULL; default `en` |
| `description` | text | NULL |
| `is_active` | boolean | NOT NULL; default `true` |
| `created_by_user_id` | uuid | NULL; FK `users.id`; `SET NULL` |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- `idx_reference_documents_title` on `title`.
- `idx_reference_documents_type_active` on `(source_type, is_active)`.
- CHECK `(publication_year IS NULL OR publication_year BETWEEN 1800 AND 2100)`.
- No patient identifiers are permitted in this table.

### 8.2 `reference_document_versions`

**Purpose.** Immutable source file plus extraction, quality-review and approval state for a reference document.

**Access.** Knowledge-base managers and quality reviewers. RAG retrieval reads only approved, indexed versions. Admin manages the catalogue within permission.

**Delete policy.** `document_id`, reviewer, approver and creator references are `RESTRICT`. A cited version is retired, not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `document_id` | uuid | NOT NULL; FK `reference_documents.id` |
| `version_label` | varchar(50) | NOT NULL; e.g. edition or revision label |
| `file_storage_provider` | varchar(50) | NOT NULL |
| `file_key` | text | NOT NULL; object key, never a signed URL |
| `file_checksum_sha256` | char(64) | NOT NULL |
| `mime_type` | varchar(100) | NOT NULL |
| `file_size_bytes` | bigint | NULL; non-negative |
| `page_count` | integer | NULL; positive |
| `extraction_method` | varchar(20) | NOT NULL; `digital_text`, `ocr`, `hybrid` |
| `normalized_text` | text | NULL; quality-reviewed normalized text |
| `status` | varchar(30) | NOT NULL; default `uploaded`; `uploaded`, `extracting`, `extraction_failed`, `extracted`, `quality_review`, `approved`, `indexed`, `retired` |
| `quality_reviewed_by_user_id` | uuid | NULL; FK `users.id` |
| `quality_reviewed_at` | timestamptz | NULL; requires reviewer |
| `quality_notes` | text | NULL |
| `approved_by_user_id` | uuid | NULL; FK `users.id` |
| `approved_at` | timestamptz | NULL; requires approver |
| `created_by_user_id` | uuid | NOT NULL; FK `users.id` |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- Unique `uq_reference_document_versions_label` on `(document_id, version_label)`.
- Unique `uq_reference_document_versions_object` on `(file_storage_provider, file_key)`.
- `idx_reference_document_versions_document_status` on `(document_id, status)`.
- `idx_reference_document_versions_status` on `status`.
- CHECK `(file_size_bytes IS NULL OR file_size_bytes >= 0)`.
- CHECK `(page_count IS NULL OR page_count > 0)`.
- CHECK `(quality_reviewed_at IS NULL OR quality_reviewed_by_user_id IS NOT NULL)`.
- CHECK `(approved_at IS NULL OR approved_by_user_id IS NOT NULL)`.
- Service rule: indexing requires quality review and approval. A new version creates new chunks; prior chunks are retired.

### 8.3 `document_extraction_jobs`

**Purpose.** One extraction or OCR attempt for a reference document version, including retries and engine provenance.

**Access.** Knowledge-base managers and the ingestion service. Clinicians do not need raw job records.

**Delete policy.** `document_version_id` is `RESTRICT`. `created_by_user_id` is `SET NULL`. Jobs are retained as provenance.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `document_version_id` | uuid | NOT NULL; FK `reference_document_versions.id` |
| `job_type` | varchar(20) | NOT NULL; `text_extraction`, `ocr` |
| `engine` | varchar(80) | NOT NULL |
| `engine_version` | varchar(50) | NULL |
| `status` | varchar(20) | NOT NULL; default `queued`; `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| `started_at` | timestamptz | NULL |
| `completed_at` | timestamptz | NULL; not before `started_at` |
| `output_checksum` | char(64) | NULL |
| `output_character_count` | integer | NULL; non-negative |
| `error_code` | varchar(80) | NULL |
| `error_message` | text | NULL |
| `created_by_user_id` | uuid | NULL; FK `users.id`; `SET NULL` |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- `idx_document_extraction_jobs_version_status` on `(document_version_id, status)`.
- `idx_document_extraction_jobs_status` on `status`.
- CHECK `(completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)`.
- CHECK `(output_character_count IS NULL OR output_character_count >= 0)`.
- Retries create new rows; they do not overwrite a failed attempt.

### 8.4 `reference_chunks`

**Purpose.** Retrieval unit derived from an approved reference document version.

**Access.** RAG retrieval and knowledge-base managers. Clinicians see cited excerpts, not arbitrary chunk management.

**Delete policy.** `document_version_id` is `RESTRICT`. Chunks are retired or marked stale; cited chunks are not deleted.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `document_version_id` | uuid | NOT NULL; FK `reference_document_versions.id` |
| `chunk_index` | integer | NOT NULL; zero-based order |
| `heading` | varchar(300) | NULL |
| `content` | text | NOT NULL |
| `token_count` | integer | NULL; positive |
| `page_from` | integer | NULL |
| `page_to` | integer | NULL; not before `page_from` |
| `content_hash` | char(64) | NOT NULL |
| `embedding_provider` | varchar(50) | NULL |
| `embedding_model` | varchar(100) | NULL |
| `embedding_ref` | varchar(255) | NULL; opaque external vector identifier |
| `embedding_status` | varchar(20) | NOT NULL; default `pending`; `pending`, `indexed`, `failed`, `stale` |
| `metadata` | jsonb | NOT NULL; default `{}`; section, page and source metadata |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `updated_at` | timestamptz | NOT NULL; default `now()`; maintained by trigger |

**Indexes and table constraints.**

- Unique `uq_reference_chunks_version_index` on `(document_version_id, chunk_index)`.
- `idx_reference_chunks_version_embedding` on `(document_version_id, embedding_status)`.
- CHECK `(chunk_index >= 0)`.
- CHECK `(token_count IS NULL OR token_count > 0)`.
- CHECK `(page_to IS NULL OR page_from IS NULL OR page_to >= page_from)`.
- No vector column is declared. If pgvector is approved, add a vector column and an ANN index in a new migration.
- A GIN full-text index on `content` is planned for keyword retrieval before vector search is approved.

### 8.5 `rag_queries`

**Purpose.** A clinician question answered from the reference knowledge base, with model metadata and an explicit evidence status.

**Access.** The asking clinician and authorized auditors. Admin sees operational metrics, not clinical question content by default.

**Delete policy.** `asked_by_user_id` is `RESTRICT`. Queries are retained for audit and quality review; citations cascade with the query only if a query is lawfully removed.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `asked_by_user_id` | uuid | NOT NULL; FK `users.id` |
| `question` | text | NOT NULL |
| `answer` | text | NULL |
| `answer_status` | varchar(20) | NOT NULL; default `pending`; `pending`, `answered`, `insufficient_evidence`, `failed` |
| `model_provider` | varchar(80) | NULL |
| `model_name` | varchar(120) | NULL |
| `model_version` | varchar(80) | NULL |
| `latency_ms` | integer | NULL; non-negative |
| `prompt_tokens` | integer | NULL; non-negative |
| `completion_tokens` | integer | NULL; non-negative |
| `created_at` | timestamptz | NOT NULL; default `now()` |
| `completed_at` | timestamptz | NULL; not before `created_at` |

**Indexes and table constraints.**

- `idx_rag_queries_user_created` on `(asked_by_user_id, created_at)`.
- `idx_rag_queries_status_created` on `(answer_status, created_at)`.
- CHECK `(answer_status <> 'answered' OR answer IS NOT NULL)`.
- CHECK `(latency_ms IS NULL OR latency_ms >= 0)`.
- CHECK `(prompt_tokens IS NULL OR prompt_tokens >= 0)`.
- CHECK `(completion_tokens IS NULL OR completion_tokens >= 0)`.
- CHECK `(completed_at IS NULL OR completed_at >= created_at)`.
- Must not store patient identifiers or patient-specific documents. If patient context is supplied in a question, it is not persisted here.

### 8.6 `rag_citations`

**Purpose.** Evidence linking an answer to specific reference chunks.

**Access.** The asking clinician and authorized auditors. Retrieval service writes. No patient data.

**Delete policy.** `rag_query_id` is `CASCADE`; `chunk_id` is `RESTRICT`. A cited chunk cannot be deleted while evidence exists.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `rag_query_id` | uuid | NOT NULL; FK `rag_queries.id` |
| `chunk_id` | uuid | NOT NULL; FK `reference_chunks.id` |
| `rank` | smallint | NOT NULL; greater than zero |
| `relevance_score` | numeric(6,5) | NULL; 0–1 |
| `quoted_text` | text | NULL; exact excerpt used as evidence |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- Unique `uq_rag_citations_query_chunk` on `(rag_query_id, chunk_id)`.
- Unique `uq_rag_citations_query_rank` on `(rag_query_id, rank)`.
- CHECK `(rank > 0)`.
- CHECK `(relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1))`.
- A missing citation indicates insufficient evidence; the answer must not present unsupported claims as established fact.

---

## 9. Operations, audit and security (proposed)

### 9.1 `notifications`

**Purpose.** User-facing notification record for operational events. It is not a clinical record.

**Access.** The recipient reads and marks their own notifications. The service writes delivery state. Admin may see operational metrics, not message bodies by default.

**Delete policy.** `recipient_user_id` is `CASCADE`. Notifications are not clinical history and may be removed with the recipient. Do not use notifications as the only record of a clinical disclosure.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `recipient_user_id` | uuid | NOT NULL; FK `users.id` |
| `category` | varchar(40) | NOT NULL; `appointment`, `report_ready`, `account`, `system`, `security` |
| `channel` | varchar(20) | NOT NULL; default `in_app`; `in_app`, `email`, `sms` |
| `title` | varchar(200) | NOT NULL |
| `body` | text | NOT NULL; minimum-necessary text, no diagnosis or report content |
| `related_entity_type` | varchar(40) | NULL; polymorphic operational link |
| `related_entity_id` | uuid | NULL; no database FK |
| `status` | varchar(20) | NOT NULL; default `pending`; `pending`, `sent`, `delivered`, `read`, `failed`, `cancelled` |
| `scheduled_for` | timestamptz | NULL |
| `sent_at` | timestamptz | NULL |
| `read_at` | timestamptz | NULL |
| `failure_reason` | varchar(500) | NULL |
| `metadata` | jsonb | NOT NULL; default `{}`; transport metadata only |
| `created_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- `idx_notifications_recipient_status` on `(recipient_user_id, status, created_at)`.
- `idx_notifications_scheduled` on `(scheduled_for, status)`.
- CHECK `(status <> 'sent' OR sent_at IS NOT NULL)`.
- CHECK `(status <> 'read' OR read_at IS NOT NULL)`.
- Service rule: the recipient must be authorized to open the linked object; a notification is not an access grant.
- Notification preferences are not modelled.

### 9.2 `audit_logs`

**Purpose.** Append-only audit trail for clinical access, approvals, disclosures, provisioning and configuration.

**Access.** Authorized auditors and security administrators. Clinical users do not read the global log. Patients may receive access history through a separate disclosure process, not direct table access.

**Delete policy.** `actor_user_id` and `patient_user_id` are `SET NULL`; the row is retained. No cascading delete. Application role should have `INSERT` and `SELECT` only.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `actor_user_id` | uuid | NULL; FK `users.id`; NULL for system or service, or after a lawful account removal |
| `actor_type` | varchar(20) | NOT NULL; default `user`; `user`, `system`, `service` |
| `action` | varchar(100) | NOT NULL; stable action code |
| `entity_type` | varchar(50) | NOT NULL |
| `entity_id` | uuid | NULL; no FK; the entity may be deleted or retained separately |
| `patient_user_id` | uuid | NULL; FK `users.id`; subject for access-history queries |
| `outcome` | varchar(20) | NOT NULL; default `success`; `success`, `denied`, `failure` |
| `request_id` | varchar(100) | NULL; correlation id, not a foreign key |
| `ip_address` | inet | NULL |
| `user_agent` | text | NULL |
| `before_state` | jsonb | NULL; redacted |
| `after_state` | jsonb | NULL; redacted |
| `metadata` | jsonb | NOT NULL; default `{}`; redacted |
| `occurred_at` | timestamptz | NOT NULL; default `now()` |

**Indexes and table constraints.**

- `idx_audit_logs_patient_occurred` on `(patient_user_id, occurred_at)`.
- `idx_audit_logs_actor_occurred` on `(actor_user_id, occurred_at)`.
- `idx_audit_logs_entity` on `(entity_type, entity_id)`.
- `idx_audit_logs_occurred` on `occurred_at`.
- `actor_user_id` may become NULL after a lawful account removal; `actor_type` still records that the original actor was a human user. Do not add a CHECK that requires a non-null actor.
- Never store passwords, tokens, raw audio, full clinical narratives or unredacted request bodies.
- Monthly partitioning and a retention policy are proposed operational steps, not part of this logical model.

### 9.3 `security_events`

**Purpose.** Operational and security event stream: authentication failures, session revocation, rate limiting, CSRF rejection, privilege changes and suspicious access.

**Access.** Security administrators and authorized auditors. Clinical users do not read this stream.

**Delete policy.** `user_id` and `session_id` are `SET NULL`; `resolved_by_user_id` is `RESTRICT` so resolution attribution is retained. Events are append-only.

| Column | Type | Null / default / constraints |
|---|---|---|
| `id` | uuid | PK; default `gen_random_uuid()` |
| `event_type` | varchar(60) | NOT NULL; `login_failed`, `session_revoked`, `rate_limited`, `csrf_rejected`, `privilege_changed`, `suspicious_access`, `other` |
| `severity` | varchar(20) | NOT NULL; default `info`; `info`, `warning`, `critical` |
| `user_id` | uuid | NULL; FK `users.id` |
| `session_id` | uuid | NULL; FK `sessions.id` |
| `ip_address` | inet | NULL |
| `user_agent` | text | NULL |
| `outcome` | varchar(20) | NULL; `success`, `failure`, `blocked` |
| `metadata` | jsonb | NOT NULL; default `{}`; no credentials, tokens or clinical content |
| `occurred_at` | timestamptz | NOT NULL; default `now()` |
| `resolved_at` | timestamptz | NULL |
| `resolved_by_user_id` | uuid | NULL; FK `users.id`; `RESTRICT` |
| `resolution_notes` | text | NULL |

**Indexes and table constraints.**

- `idx_security_events_type_occurred` on `(event_type, occurred_at)`.
- `idx_security_events_severity_occurred` on `(severity, occurred_at)`.
- `idx_security_events_user_occurred` on `(user_id, occurred_at)`.
- CHECK `(resolved_at IS NULL OR resolved_by_user_id IS NOT NULL)`.
- Separate from `audit_logs` because access audiences and retention differ.

---

## 10. Appendix — controlled vocabularies

| Domain | Values | Used by |
|---|---|---|
| User status | `pending_activation`, `active`, `suspended`, `disabled` | `users` |
| Appointment status | `requested`, `pending_confirmation`, `confirmed`, `checked_in`, `in_progress`, `completed`, `cancelled`, `no_show`, `rescheduled` | `appointments`, `appointment_status_history` |
| Consultation type | `in_person`, `online` | `appointments`, `appointment_proposals` |
| Appointment change source | `patient`, `staff`, `doctor`, `admin`, `system`, `agent` | `appointment_status_history` |
| Follow-up status | `recommended`, `accepted`, `scheduling`, `scheduled`, `completed`, `declined`, `cancelled` | `follow_ups` |
| Proposal status | `proposed`, `selected`, `booked`, `declined`, `expired`, `cancelled` | `appointment_proposals` |
| Consultation status | `scheduled`, `in_progress`, `completed`, `cancelled` | `consultations` |
| Consent type | `audio_recording`, `transcription`, `ai_assisted_documentation` | `consultation_consents` |
| Consent status | `granted`, `declined`, `revoked` | `consultation_consents` |
| Consent method | `in_person_verbal`, `patient_portal`, `written` | `consultation_consents` |
| Recording status | `pending_upload`, `uploaded`, `processing`, `available`, `failed`, `deleted` | `consultation_recordings` |
| Transcript status | `draft`, `in_review`, `approved`, `rejected`, `superseded` | `transcripts` |
| Transcript source | `speech_to_text`, `manual` | `transcripts` |
| Approval decision | `approved`, `rejected` | `transcript_approvals`, `report_approvals` |
| Agent code | `speech_to_text`, `agent_1_report_generation`, `agent_2_profile_organization`, `agent_3_follow_up_scheduling` | `agent_executions` |
| Execution status | `queued`, `running`, `succeeded`, `failed`, `cancelled` | `agent_executions` |
| Report type | `report_1_patient_summary`, `report_2_structured_profile`, `report_3_medical_report` | `medical_reports` |
| Report status | `draft`, `in_review`, `approved`, `rejected`, `superseded`, `released` | `medical_reports` |
| Delivery channel | `patient_portal`, `email` | `report_deliveries` |
| Delivery status | `pending`, `delivered`, `viewed`, `failed`, `revoked` | `report_deliveries` |
| Proposal target | `medical_condition`, `patient_medication`, `patient_allergy`, `medical_history_entry`, `test_order`, `test_result` | `record_update_proposals` |
| Agent 2 proposal type | `create`, `update`, `resolve`, `discontinue`, `correct` | `record_update_proposals` |
| Agent 2 proposal status | `proposed`, `approved`, `rejected`, `applied`, `superseded` | `record_update_proposals` |
| Clinical source | `patient_reported`, `doctor_entered`, `agent_2_derived`, `imported` | medical-record tables |
| Condition status | `active`, `resolved`, `in_remission`, `suspected`, `entered_in_error` | `medical_conditions` |
| Medication status | `active`, `stopped`, `completed`, `on_hold`, `entered_in_error` | `patient_medications` |
| Allergy status | `active`, `resolved`, `entered_in_error` | `patient_allergies` |
| History type | `surgery`, `hospitalization`, `procedure`, `family_history`, `immunization`, `social_history`, `other` | `medical_history_entries` |
| Test order status | `ordered`, `scheduled`, `collected`, `resulted`, `cancelled` | `test_orders` |
| Result status | `preliminary`, `final`, `corrected`, `entered_in_error` | `test_results` |
| Abnormal flag | `low`, `normal`, `high`, `critical_low`, `critical_high`, `unknown` | `test_results` |
| Reference source type | `clinical_guideline`, `systematic_review`, `journal_article`, `textbook`, `protocol`, `patient_education`, `other` | `reference_documents` |
| Extraction method | `digital_text`, `ocr`, `hybrid` | `reference_document_versions` |
| Reference status | `uploaded`, `extracting`, `extraction_failed`, `extracted`, `quality_review`, `approved`, `indexed`, `retired` | `reference_document_versions` |
| Extraction job type | `text_extraction`, `ocr` | `document_extraction_jobs` |
| Embedding status | `pending`, `indexed`, `failed`, `stale` | `reference_chunks` |
| RAG answer status | `pending`, `answered`, `insufficient_evidence`, `failed` | `rag_queries` |
| Notification category | `appointment`, `report_ready`, `account`, `system`, `security` | `notifications` |
| Notification channel | `in_app`, `email`, `sms` | `notifications` |
| Notification status | `pending`, `sent`, `delivered`, `read`, `failed`, `cancelled` | `notifications` |
| Audit actor type | `user`, `system`, `service` | `audit_logs` |
| Audit outcome | `success`, `denied`, `failure` | `audit_logs` |
| Security severity | `info`, `warning`, `critical` | `security_events` |

---

## 11. Dictionary validation

| Check | Result |
|---|---|
| Proposed tables documented | 35 of 35 |
| Implemented tables summarised | 10 of 10 |
| Proposed columns documented | 480 of 480; exact match with `database/medora.dbml` |
| Tables claimed to exist without a migration | 0 |
| SQL executed | 0 |
| Migration files changed | 0 |

**Note:** DBML cannot express `CHECK`, exclusion, partial-index or trigger rules. The rules listed in this dictionary are the intended physical implementation and must be verified when each migration is written and applied to a disposable PostgreSQL database.


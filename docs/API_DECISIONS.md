# Medora — Backend API decisions log

**Status:** implementation decisions for the complete endpoint work (17 November 2026)  
**Rule:** no applied migration `001`–`013` was changed. Every decision below is implemented in code or documented as an honest empty / blocked response. Where the guide left a choice open, the guide's own "recommended default" was adopted.

---

## 1. Open decisions from §12 (adopted defaults)

| # | Decision | Adopted default | Implementation |
|---|---|---|---|
| D-1 | Report 3 purpose/recipient/storage | Doctor-only drafts/review; no publish, no patient visibility | `clinicalReviewService.publishReport` refuses any type other than `report_1_patient_summary`; patient queries filter to published Report 1 |
| D-2 | Vector store / embedding provider | `embedding_ref` stays opaque; no schema change | `referenceService.indexVersion` writes `embedding_status='pending'` and never sets `embedding_ref`; retrieval is lexical over approved chunks |
| D-3 | Booking confirmation policy | `requested → pending_confirmation → confirmed`, staff confirms | `staffSchedule`, `staffConfirm`; patient self-registration of a request never sets `confirmed` |
| D-4 | New tables/columns (vitals, messages, imaging, documents, prescriptions, services) | No `014` migration; honest empties | `vitals: []`, `patientMessages: []`, `imaging: []`, `documents: []`, `services: []`; prescriptions are derived from `patient_medications` |
| D-5 | New permissions for clinical reads | Role + record access only; no new permission codes | `accessService` (`assertCareAccess`, `assertConsultationAccess`, …); seeded 15 permissions unchanged |
| D-6 | `staff` vs `receptionist` | Accept both in `requireRole`, DB canonical is `receptionist` | `staffRoutes` uses `requireRole("receptionist", "staff")` |
| D-7 | Phone normalization | Store trimmed as submitted | `Validator.phone` unchanged; no rewriting |
| D-8 | Unverified doctors visible | Only `verification_status='verified'` and `users.status='active'` | `patientService.DOCTOR_SELECT` filters; `schedulingService.doctorContext` re-checks |
| D-9 | Dashboard vitals/messages source | `[]` | `patientService.getDashboard` |
| D-10 | Prescription / imaging representation | Prescriptions derived from `patient_medications`; imaging `[]` | `patientClinicalService.loadPrescriptionGroups` / `getMedicalRecordFeed` |
| D-11 | Patient document upload | No upload endpoint | `medical-records` feed reports `documents: 0`; detail for `document` returns 404 |
| D-12 | Department extended fields | Honest derived defaults; no persistence | `description: ""`, `icon: "activity"`, `displayOrder: 0`, `services: []`, `headOfDepartment: undefined`; `PUT /services` returns `409 dependency_conflict` |
| D-13 | Agent HTTP surface vs worker-only | Service functions + internal routes behind a service token | `services/agentService.js` + `routes/internalAgentRoutes.js`; routes fail closed when `AGENT_SERVICE_TOKEN` is unset |

---

## 2. Decisions the guide did not list but implementation required

| Topic | Decision | Reason |
|---|---|---|
| Guide structural gap | §4 and §5.2 are absent from the guide although Phase 2 references them. Implemented `GET /api/patient/dashboard`, `GET /api/patient/doctors`, `GET /api/patient/doctors/:id`, `GET /api/patient/departments` from Appendix A.1/A.5. | Needed to make the patient screens switchable from mocks. Documented as a reconstruction, not a silent invention. |
| Consultation creation | A `consultations` row is created when staff confirms an appointment (`ensureConsultation`), and when a proposal is booked. | The schema declares one consultation per appointment but no guide endpoint creates it; without this the whole clinical chain is unreachable. |
| Appointment slot storage | A patient request writes `requested_start_at/end_at` only; staff `/schedule` writes `scheduled_*`. Slot generation subtracts `COALESCE(scheduled_start_at, requested_start_at)`. | Matches the guide's status flow and prevents double booking of request-only rows. |
| Reschedule | The superseded row becomes `status='rescheduled'`; a replacement row is inserted with `rescheduled_from_appointment_id` and `version=1`. | Preserves clinical/operational history instead of rewriting the original slot; still uses optimistic `version` on the old row. |
| Doctor `rating`/`reviews` | `0` / `0` rather than `null` | The UI calls `.toFixed(1)` on `rating`; zero is the true count when no review table exists, and keeps the "no JSX changes" requirement. All other unsupported fields are `null`/`[]`. |
| Admin dashboard patient label | Masked `Patient <4 hex>` derived from the appointment id | Prevents patient names from leaking into an admin operational payload. Response keeps the `patient` field name from Appendix A.6. |
| AI generation | No LLM provider is configured. Internal agent endpoints register an `agent_executions` row and (for Agent 1) create three honest draft scaffolds whose content is `{generated:false, sections:[]}`. A worker may pass real model output through the `reports` / `proposals` / `proposed_slots` body fields. | Never fabricates clinical text; keeps the approval gates end-to-end and leaves a clean integration point for a model provider. |
| RAG answers | Returns verbatim retrieved excerpts with citations; `insufficient_evidence` when no approved chunk matches. | No diagnosis or generated clinical conclusion is produced without a provider decision. |
| Service endpoints and CSRF | `/api/internal/agents/*` uses `requireServiceAuth` + `agentRunLimiter` and no session CSRF (no cookie exists). `/api/reference/versions/:id/extraction` and `/index` keep `verifyCsrf` as specified; it is a no-op for token-only callers. | CSRF protects cookie-authenticated mutations; a service token is a different credential type. |
| Department doctor assignment | Assignments update `doctor_profiles.specialty_id` for clinical departments; unassignment returns `409 dependency_conflict`. | No join table exists; inventing one would require an approved migration. |
| `test_orders` corrections | `POST /api/doctor/proposals/:id/apply` returns `409 dependency_conflict` for corrections of `test_order`. | `test_orders` has no `superseded_by_id` column; guide rule 7 forbids in-place clinical rewrites. |
| Doctor/staff transition roles | `/api/staff/appointments/:id/start` and `/complete` accept `doctor` in addition to staff; equivalents exist under `/api/doctor/appointments/:id/*`. | §5.3 explicitly allows "doctor or staff"; the §8 matrix allows an explicit exception. |

---

## 3. Deliberately NOT implemented (BLOCKED)

- Report 3 publication or patient visibility (D-1).
- Any vector column, pgvector extension or embedding provider (D-2).
- Patient document upload / storage provider (D-11).
- Persisted department services, description, icon, display order, head of department (D-12).
- Vitals and messaging tables (D-9).
- Any `014_*.sql` migration. No applied migration was edited and `tests/schema-v2.test.js` expectations (42 tables / 13 migrations / 2 views) are unchanged.

---

## 4. Security invariants applied to every new mutation

1. `requireAuth` + role (+ permission where seeded) on the route.
2. Record-specific access re-checked in the service (`care_relationships` active + `expires_at`, or assigned appointment/consultation).
3. Server-side validation with `Validator` and allowlisted columns only; all values are parameterized.
4. Audit row in the same transaction; appointment transitions additionally write `from_status`/`to_status`/`change_source`/`change_reason` so `v_appointment_status_timeline` is complete.
5. Doctor approval gates are enforced by database triggers; services never write `transcripts.status`, `medical_reports.status` or `report_versions.review_decision` outside the prescribed review endpoints.
6. Denials write `security.clinical_access_denied` to `audit_logs`/`v_security_events` on a separate connection so they survive the rolled-back transaction.

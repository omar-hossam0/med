# Medora — Frontend API handoff

**Date:** 17 November 2026  
**Scope:** the complete HTTP API added behind the existing auth/admin baseline. No JSX, layout or styling was changed.

---

## 1. Client conventions (mirror `src/lib/api/admin.ts`)

| Rule | Value |
|---|---|
| Base URL | relative `/api/...` (rewritten by `next.config.mjs` to `http://localhost:5000/api/...`) |
| Credentials | `credentials: "include"` — the session is the HttpOnly `medora_session` cookie |
| CSRF | every non-GET request echoes the readable `medora_csrf` cookie in the `x-csrf-token` header |
| Request bodies | **snake_case** (`doctor_id`, `scheduled_start_at`, `license_number`, `version`, …) |
| Responses | **camelCase** UI-shaped objects (Appendix A), wrapped as `{ success: true, ...payload }` |
| Dates | ISO-8601 strings; `toISOString()` round-trips on the server |
| Errors | `{ error, message, code?, errors? }` with HTTP status; `code` is the stable machine-readable value from Appendix C |
| Empty data | honest `null` / `[]` / `0`. No demo values are invented. |

Suggested client modules (not created here — the frontend was intentionally untouched):

```
src/lib/api/patient.ts     profile, doctors, dashboard, appointments, clinical portal, reports, follow-ups
src/lib/api/doctor.ts      workspace, consultations, transcripts, reports, proposals, chart
src/lib/api/staff.ts       scheduling operations, booking handoff
src/lib/api/reference.ts   reference documents and RAG
src/lib/api/adminExtra.ts  dashboard, AI monitoring, departments
```

Each should reuse the `ApiError` class and the cookie/CSRF helper from `src/lib/api/admin.ts`.

---

## 2. Endpoint catalogue (new endpoints)

### Patient (`/api/patient`) — session + role `patient`

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/profile` | snake_case shape (no existing UI contract); PATCH allowlist `date_of_birth`, `phone`, `gender` |
| GET | `/doctors`, `/doctors/:id`, `/departments` | verified + active doctors only; `Doctor` shape from A.5 |
| GET | `/dashboard` | A.1 payload; `vitals`/`patientMessages` are `[]` |
| GET | `/availability/slots?doctor_id&date&consultation_type` | authoritative slots; returns `slots[{startsAt,endsAt,time,available}]` |
| GET | `/appointments`, `/appointments/:id`, `/appointments/:id/timeline` | A.2 shapes; no `internalNotes` |
| POST | `/appointments` | 201, status `requested`; creates a care relationship |
| POST | `/appointments/:id/reschedule`, `/appointments/:id/cancel` | requires `version`; cancel requires one of the five `CANCEL_REASONS` |
| GET | `/medical-records`, `/medical-records/:type/:id` | `entries`, `stats`, `pagination`; `type ∈ visit\|prescription\|lab\|imaging\|document\|report` |
| GET | `/lab-results`, `/lab-results/:id` | `labResults` + `counts{total,normal,attention}`; preliminary results excluded |
| GET | `/prescriptions`, `/prescriptions/:id`, `/medications` | `PrescriptionRecord`, `Medication`, `PrescriptionCounts`, `todaySchedule` |
| GET | `/reports`, `/reports/:id`, `/transcripts/:id` | released (approved + published) content only |
| GET | `/follow-ups` | recommendations + proposals |
| POST | `/appointment-proposals/:id/select` | `proposed → selected`; expired → `409 proposal_expired` |

### Doctor (`/api/doctor`) — session + role `doctor` + care access

| Method | Path |
|---|---|
| GET / PATCH | `/me` (credential fields read-only) |
| GET / POST | `/availability`; PATCH `/availability/:id`; POST `/time-off`; DELETE `/time-off/:id` |
| GET | `/appointments`; POST `/appointments/:id/start`, `/appointments/:id/complete` |
| GET | `/consultations`, `/consultations/:id`; POST `/consultations/:id/start`, `/complete` |
| POST | `/consultations/:id/consents`, `/consents/:consentId/revoke`, `/recordings`; PATCH `/recordings/:recordingId` |
| GET | `/consultations/:id/transcripts`, `/transcripts/:id`; POST `/transcripts`, `/transcripts/:id/versions`, `/transcript-versions/:id/review` |
| GET | `/consultations/:id/reports`, `/reports/:id`, `/reports/:id/versions/:versionId` |
| POST | `/reports/:id/versions`, `/report-versions/:id/review`, `/reports/:id/publish`, `/reports/:id/withdraw` |
| GET | `/patients/:id/proposals`, `/proposals/:id`, `/patients/:id/record`, `/patients/:id/follow-ups` |
| POST | `/proposals/:id/review`, `/proposals/:id/apply`, `/patients/:id/record-entries`, `/follow-ups/:id/accept`, `/decline`, `/proposals` |

### Staff (`/api/staff`) — session + role `receptionist`/`staff`

`GET /me`, `/dashboard`, `/patients/:id`; `GET /appointments`, `/appointments/:id`;
`PATCH /appointments/:id/schedule`, `/notes`; `POST /appointments/:id/confirm`, `/check-in`, `/start`, `/complete`, `/no-show`;
`POST /appointment-proposals/:id/book`.

`start`/`complete` also accept a doctor session. Staff responses may contain `internalNotes`; patient responses never do.

### Notifications (`/api/notifications`) — any session, owner-scoped

`GET /`, `GET /unread-count`, `PATCH /:id/read`.

### Reference knowledge (`/api/reference`)

`GET /documents`, `/documents/:id`, `/versions/:id/chunks`, `/rag/queries/:id`;
`POST /documents`, `/versions` (admin);
`POST /versions/:id/quality-review`, `/approve` (doctor or admin);
`POST /versions/:id/extraction`, `/index` (service token);
`POST /rag/query` (doctor, rate-limited).

### Admin extensions (`/api/admin`) — admin only, operational data only

`GET /dashboard`; `GET /ai/reports`, `/ai/summary`, `/ai/daily-series`, `/ai/doctors/ranking`, `/ai/health`, `/ai/activities`, `/ai/reports/:id/events`;
`GET /departments`, `POST /departments`, `PATCH /departments/:id`, `PUT /departments/:id/doctors`, `PUT /departments/:id/services`.

### Internal agents (`/api/internal/agents`) — service token only

`POST /transcription`, `/reports`, `/profile-organization`, `/follow-up-scheduling`, `/extraction`.
Header `x-service-token`, body requires `idempotency_key`. Fails closed with 503 when `AGENT_SERVICE_TOKEN` is unset.

---

## 3. Response shapes (Appendix A)

| Area | Shape |
|---|---|
| Dashboard | `dashboard { patient, today, nextAppointment, recentAppointments[], activePrescriptions[], vitals[], quickActions[], medicalRecords[], labResults[], careTeam[], patientMessages[], dashboardStats[] }` |
| Appointment | `{ id, reference, doctorId, startsAt, endsAt, durationMinutes, consultationType, status, rawStatus, version, reason?, notes?, cancellationReason?, … }` |
| Doctor | A.5 `Doctor` with `weekly: Record<number, {start,end}[]>`; `rating`/`reviews` are 0, `photoUrl: null`, `patientReviews: []` |
| Record feed | `entries: MedicalRecordEntry[]` with `key = "${type}:${id}"` and lowercased `searchText`; plus `stats`, `pagination` |
| Lab | `LabResult` with `results[]`, `trends[]`; abnormal flags `low/high/critical_*` → `"Abnormal"` |
| Prescriptions | `prescriptionRecords[]`, `medications[]`, `counts` (`PrescriptionCounts`) |
| Admin dashboard | A.6 keys (`kpis`, `trendDays`, `trendSeries`, `departments`, `notifications`, `quickActions`, `systemHealth`, `recentAppointments`, `recentUsers`, `adminUser`, `today`) |
| AI monitoring | `AiReport`, `AiSummary`, `DailyPoint`, `DoctorRanking`, `AiServiceHealth`, `OperationalActivity`, `ReportEvent`; `range=7d\|30d\|90d` |
| Departments | A.8 `Department` with honest empties for columns that do not exist |

---

## 4. Status vocabularies exposed to the UI

- `status` on patient appointments is one of `Upcoming | Completed | Cancelled`; the exact DB value is in `rawStatus`.
- `consultationType` is `In-Person | Online` in responses, `in_person | online` in requests.
- Cancellation reasons: `Schedule conflict`, `Feeling better`, `Found another provider`, `Financial reasons`, `Other`.
- New error codes: `clinical_access_denied`, `consent_required`, `consent_exists`, `slot_taken`, `version_conflict`, `invalid_appointment_transition`, `transcript_not_approved`, `report_not_approved`, `publication_not_allowed`, `proposal_expired`, `dependency_conflict`, `agent_execution_conflict`, `insufficient_evidence`, `service_auth_failed`.

---

## 5. Frontend components still mock-driven

This task was backend-only. The following screens still import `src/lib/mock/*` and can be switched by replacing **only the data-source import** (no JSX change):

- Patient dashboard, appointments/booking, my-doctors, medical-records, lab-results, prescriptions.
- Admin dashboard, AI monitoring, departments.
- `src/app/workspace` (staff placeholder) — no staff UI exists yet; the staff API is API-first.

The auth shell and admin users/doctors-staff/reference-data pages already use the real API via `src/lib/api/admin.ts`.

---

## 6. Deviations from the specification (with reasons)

See `docs/API_DECISIONS.md`. Summary:

1. The guide has no §4 and no §5.2; the doctors/dashboard endpoints were reconstructed from Appendix A.1/A.5.
2. `rating`/`reviews` are `0` rather than `null` because the UI calls `.toFixed(1)`; no review table exists.
3. Admin dashboard masks patient names to keep the payload strictly operational.
4. Agent 1 produces honest draft scaffolding (no LLM provider configured); a worker can supply model output through the request body.
5. RAG returns verbatim excerpts with citations, not a generated clinical conclusion.
6. Department `PUT /services` and `test_order` corrections return `409 dependency_conflict` because the required schema columns do not exist (no unapproved migration).
7. `POST /api/internal/agents/*` uses service-token auth instead of session CSRF (no browser cookie exists).

---

## 7. What remains BLOCKED

Report 3 destination (D-1), vector provider (D-2), vitals/messages (D-9), imaging/documents/prescriptions tables (D-4/D-10/D-11), department extended fields (D-12), and any `014_*.sql` migration. No applied migration was edited.

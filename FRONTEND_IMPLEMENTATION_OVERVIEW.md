# Medora Frontend — Implemented Pages and Content

**Scope:** Next.js App Router pages and their current UI/data behavior in this repository. “Implemented” here means the page or interface exists; it does not necessarily mean its data is connected to the backend.

> **Data-status rule:** A polished screen or interactive demo is not proof of API integration. This overview marks screens as **API-connected**, **demo/mock**, or **placeholder** based on the code currently in the repository.

## Contents

1. [Frontend at a glance](#1-frontend-at-a-glance)
2. [Shared application behavior](#2-shared-application-behavior)
3. [Public and account pages](#3-public-and-account-pages)
4. [Patient workspace](#4-patient-workspace)
5. [Admin workspace](#5-admin-workspace)
6. [Doctor workspace](#6-doctor-workspace)
7. [Navigation items that are not implemented pages](#7-navigation-items-that-are-not-implemented-pages)
8. [Backend integration map](#8-backend-integration-map)
9. [UI conventions and supporting code](#9-ui-conventions-and-supporting-code)
10. [Page route index](#10-page-route-index)
11. [Related documentation](#11-related-documentation)

## 1. Frontend at a glance

- **Framework:** Next.js 14 App Router, React 18, TypeScript.
- **Styling:** Tailwind CSS with shared Medora design tokens and components.
- **Icons and motion:** `lucide-react` and `motion`.
- **App entry:** the `src/app` route tree.
- **Data utilities:** `src/lib`, including mock datasets and the Admin API client.
- **Frontend and backend run separately** and are proxied together during local development; see the root README.

The route tree currently contains **26 page routes**:

| Area | Routes | Current state |
|---|---:|---|
| Public and account | 5 | Marketing page is static; login, patient registration, and activation call backend auth endpoints; staff workspace is a placeholder |
| Patient | 8 | UI modules are present, but patient workspace data/actions remain mock-driven |
| Admin | 8 | User/workforce operations are partly API-connected; dashboard, AI monitoring, and departments are demo-driven |
| Doctor | 5 | Overview, schedule, patient records, and consultation route are frontend prototypes using fixtures |

## 2. Shared application behavior

### 2.1 Root layout and session context

[`src/app/layout.tsx`](src/app/layout.tsx) supplies the shared HTML shell, locally bundled Inter font, metadata, global styles, and the `AuthProvider`.

[`src/lib/auth-context.tsx`](src/lib/auth-context.tsx):

- Calls `GET /api/auth/me` on application load to resolve the current session.
- Stores the returned user in React context for navigation and identity display.
- Exposes `refreshUser`, `logout`, and session state.
- Signs out through `POST /api/auth/logout`, then clears local auth state and routes to `/login`.

The root layout gives the pages one shared auth context. It does not by itself make every page protected.

### 2.2 Route guards

[`src/components/auth/RouteGuard.tsx`](src/components/auth/RouteGuard.tsx) is used by the Patient and Admin layouts and the `/workspace` placeholder. It shows a session-loading state, redirects unauthenticated users to `/login`, and redirects users with the wrong role to their own role home.

This is a navigation safeguard, **not an authorization boundary**. Backend APIs must enforce access independently.

The Doctor layout currently has a comment explicitly stating that its guard is bypassed for visual preview. Doctor pages are therefore not protected by a frontend route guard in the current implementation.

Role landing destinations are centralized in [`src/lib/role-home.ts`](src/lib/role-home.ts):

- Admin → `/admin/dashboard`
- Patient → `/patient/dashboard`
- Doctor → `/doctor/dashboard`
- Receptionist → `/workspace`

### 2.3 Shared shell and responsive navigation

- Patient routes share a sidebar/topbar shell, mobile navigation drawer, and a “coming soon” provider.
- Admin routes share a collapsible sidebar/topbar shell, Admin data providers, responsive navigation, and reduced-motion-aware page transitions.
- Doctor routes share a sidebar/topbar shell and a React-context workspace state provider.
- The Public site uses a responsive marketing navbar and a footer.

Several shared components expose links to future areas. Those controls display a neutral “coming soon” message rather than navigating to a nonexistent page or pretending to save data.

## 3. Public and account pages

### 3.1 `/` — Public landing page

**State:** Implemented marketing/education UI; not an authenticated app workspace.

The page combines these sections in order:

1. **Navbar:** Home, About Us, For Patients, For Doctors, For Clinics, Resources, Login, and Get Started navigation. The mobile version uses a menu drawer.
2. **Hero:** “Smarter Healthcare for Healthier Lives,” AI-assisted healthcare messaging, a Get Started action, a “Watch Video” link to the workflow section, benefit labels, and a healthcare hero image. The video itself is not implemented.
3. **Platform stats:** illustrative counts for user roles, AI agents, connected platform, and assisted workflows.
4. **About Medora:** describes the platform and its connected-care goals.
5. **How It Works:** five illustrated steps—appointment booking, consultation, AI analysis, doctor review/approval, and continuous care. This is explanatory product content, not an interactive clinical workflow.
6. **Features:** AI-assisted consultation, patient records, scheduling, and medical knowledge/RAG.
7. **User roles:** patient, doctor, reception staff, and Admin cards with their intended responsibilities.
8. **Why Medora** and **Health Access:** additional product-benefit sections.
9. **Testimonials:** static illustrative stories/claims in the landing dataset.
10. **Call to action** and **Contact:** contact details and a form for name, email, optional organization/phone, and message.
11. **Footer:** platform/company/resource links and unavailable policy/social destinations.

The contact form validates fields in the browser, but its source explicitly says message delivery is not connected; submitting it does not send a message. The “Watch Video” action points to the workflow section, and legal/social links are unavailable placeholders.

### 3.2 `/login` — Sign in

**State:** API-connected for email/password login; secondary sign-in options are placeholders.

The page contains:

- Medora logo, back-to-home link, and sign-up navigation.
- Email and password fields, inline validation, password visibility toggle, and submit/loading/error feedback.
- “Keep me signed in” checkbox.
- Forgot password and Google sign-in controls.
- Clinic image panel at larger breakpoints.

On submit, it calls `POST /api/auth/login` with email/password and credentials enabled. A successful response populates the shared auth context and CSRF token, then redirects according to the user's role.

The checkbox is currently visual state only; the login request does not send a persistent-session preference. “Forgot password?” and Google sign-in display future-phase messages rather than invoking a provider/reset flow from this page.

### 3.3 `/signup` — Patient registration

**State:** API-connected for patient registration.

The form includes first/last name, email, optional phone/date of birth/gender, password and confirmation, password requirement indicators, and Terms/Privacy consent checkboxes.

The page validates the entered values and sends `POST /api/auth/register`. The request currently includes only `full_name`, `email`, and `password`; optional phone, date of birth, and gender are not sent by this signup form. On success it routes to `/login`.

Google sign-up, Terms of Service, and Privacy Policy are informational placeholders and are not integrated providers/documents.

### 3.4 `/activate` — Set account password

**State:** API-connected.

The page reads the one-time token from the URL query string, asks for a password and confirmation, provides client-side checks, and calls the shared `activateAccount` API helper. The screen has states for checking the link, missing token, successful password set, and request error. Success links back to `/login`.

The backend activation endpoint supports invitation and password-reset token purposes; the visible screen is framed primarily as account activation.

### 3.5 `/workspace` — Receptionist/staff destination

**State:** Placeholder, not a staff dashboard.

The guarded page confirms the account is signed in and displays name, email, role, and status, with sign-out and a link back to Medora. It explicitly tells the user that the doctor/staff workspace is not available yet. No staff schedule, patient queue, or appointment operations are rendered here.

## 4. Patient workspace

The Patient layout is role-guarded and provides the navigation destinations Home, Appointments, My Doctors, Medical Records, Prescriptions, Lab Results, Messages, Billing & Payments, Profile, and Settings.

**Data boundary:** Patient-facing workspace pages currently use `src/lib/mock/*` datasets; the frontend API handoff also identifies these pages as mock-driven. The real backend has patient APIs, but these page modules do not yet consume a patient API client. A few patient profile/name elements can use the current authenticated user, while dashboard clinical data remains demo data.

### 4.1 `/patient/dashboard` — Patient overview

**State:** UI implemented; mostly demo/mock data.

Content includes:

- Time-aware greeting and date; the displayed name can come from the authenticated user, with a mock fallback.
- “Your Health Matters” hero card and appointment-booking call to action.
- Next appointment with doctor, specialty, location, date/time, and reschedule/details controls.
- Dashboard stats.
- Recent appointments.
- Health summary cards with mock vital values and trends.
- Quick actions.
- Recent lab results, care-team doctors, and healthcare-team message previews.

The page explicitly labels demo data. Its dashboard appointment, metrics, and message actions use “coming soon” feedback rather than backend mutations.

### 4.2 `/patient/appointments` — Appointment list and booking flow

**State:** Interactive UI prototype; bookings and changes are local React state only.

The module contains three internal views:

- **List:** upcoming/completed/cancelled appointment history, search/filtering, appointment rows, and booking actions.
- **Booking:** choose doctor, date/time slot, consultation type, and reason/notes; checks availability against the local fixture set.
- **Details:** selected appointment information and actions.

It includes booking-success, cancellation, and rescheduling dialogs, eligibility rules for upcoming appointments, URL query state for booking/details, and in-page history handling. New bookings, reschedules, and cancellations update only the current browser session's React state; no request is sent to the backend, and the success copy identifies the behavior as demo-only.

### 4.3 `/patient/my-doctors` — Doctor directory and profiles

**State:** Interactive directory prototype using mock doctors and departments.

Content and controls include:

- Department selection, including featured departments and an option to show more.
- Search by doctor name, specialty, department, clinic/city, services, or tags.
- Filters for location, consultation type (in-person/online), and availability (today/this week).
- Featured and other doctor cards, profile details, and local favorite toggles.
- Doctor profile navigation reflected in the `?doctor=...` query parameter.
- “Book” navigation opens the appointment page with the selected doctor preselected.

Directory and profile data are local fixture data; favorites are component state and are not persisted to an account or backend.

### 4.4 `/patient/medical-records` — Unified record feed

**State:** Rich interactive prototype; uses mock records/files.

The module provides an overview and category/detail navigation for:

- Visits
- Prescriptions
- Lab results
- Imaging
- Documents
- Medical reports
- Upload document

It includes a record feed, counts/stat cards, category tabs, search/filter/sort and list state, record previews, detail panels for supported record categories, file preview, download/export-style actions, toast feedback, and URL-based tab/detail state. The tab/detail state is designed to survive browser back/forward navigation.

The upload and document/file previews are demo UI, not patient document storage or upload to the backend. The backend handoff separately notes that patient document upload and some represented record categories lack implemented persistence.

### 4.5 `/patient/lab-results` — Lab result list

**State:** UI implemented; mock data.

Includes lab-result counts, search, Normal/Abnormal filtering, result rows/status badges, empty states, and a link to each result. Search/filter state and scroll position are preserved when returning from a detail page.

The UI describes values as laboratory-reported and not editable. It does not currently fetch the backend lab-results endpoints.

### 4.6 `/patient/lab-results/[id]` — Lab result detail

**State:** UI implemented; mock data.

The detail view includes:

- Test name, date, and facility.
- Tabs for Results, Trends, Report, and Related Visit.
- Individual measurements/reference ranges, trend visualization, attached report information, and related visit context where present.
- Download control when a report file is present, and an honest not-found state for unknown fixture IDs.

The route obtains the result from a mock helper; it is not backed by `GET /api/patient/lab-results/:id`.

### 4.7 `/patient/prescriptions` — Prescriptions and medication list

**State:** Interactive prototype; mock data and local state.

The page contains:

- Tabs for all prescriptions, medications, and history.
- Counts/stat cards, search and status/doctor/date filters.
- Prescription rows and medication rows.
- Today's medication schedule and quick actions.
- Medication detail drawer; add medication, reminders, scheduling, download, and related-visit dialogs.

Self-reported medication entries and reminder toggles are local to the current component session and are not written to the medical record or backend. The UI distinguishes active treatment from historical prescriptions and warns users not to restart older prescriptions without consulting a doctor.

### 4.8 `/patient/prescriptions/[id]` — Prescription detail

**State:** UI implemented; mock data.

Shows prescription identity, date, doctor/facility/specialty, status, and detail tabs for medications, instructions, related visit, and files. Includes medication detail drawer, related-visit navigation, copy-ID action, and a download/document state. It reads the prescription from fixture data; no patient prescription API client is used here.

## 5. Admin workspace

The Admin layout is role-guarded and shares the sidebar, topbar, user provider, reference-data provider, transitions, and “coming soon” handling.

### 5.1 `/admin/dashboard` — Admin overview

**State:** Demo/mock data.

The page combines:

- Admin greeting/hero and KPI cards.
- Appointment trend chart and department breakdown chart.
- Recent appointments and recent users tables.
- Right-side date/quote, notifications, quick actions, and system-health panels.

The page is not wired to the Admin dashboard API; its data is sourced from `src/lib/mock/admin`.

### 5.2 `/admin/users` — User management

**State:** User list and core account operations are API-connected; some decorative analytics are illustrative.

The screen includes:

- Total users, patients, doctors, and staff statistic cards.
- Role tabs, search, status filtering, row selection, pagination, and CSV export.
- User list with account status and account actions.
- Add User link and status-change dialog.
- Explicit loading and error states; account rows are not replaced with sample rows after an API failure.

The `UsersProvider` loads users and counts with `GET /api/admin/users`. Status changes call `PATCH /api/admin/users/:id/status` and require a reason. The trend percentages/sparklines on the statistic cards are fixed illustrative UI values, not live analytics.

### 5.3 `/admin/users/new` — Provision doctor or staff

**State:** Account creation is API-connected; some form controls are presentation-only or local.

The four-step form covers:

1. **Basic Information:** user type (doctor/staff), personal details, and contact details.
2. **Role & Details:** doctor professional/specialty/license fields or staff job/employment fields, plus department/location/schedule details.
3. **Permissions:** the form displays role permission choices.
4. **Review & Create:** confirmation before submitting.

Specialties, departments, and locations are loaded through the shared Admin reference-data provider. On successful creation, the page displays the one-time activation link returned by the API.

The actual create request sends identity/profile fields to `POST /api/admin/users`; the current `UsersProvider` payload does **not** include the permission selections made in the UI. A doctor profile photo is only a local preview URL and is not uploaded. Treat both as frontend-only controls, not persisted permissions/media.

### 5.4 `/admin/doctors-staff` — Workforce directory

**State:** Directory data is API-connected; filtering and presentation happen in the browser.

Includes:

- Doctor, staff, pending-verification, and on-duty statistics derived from directory members.
- All Members / Doctors / Staff tabs.
- Search; department, role, verification, account-status, and location filters.
- Grid/list views and pagination.
- Member cards linking to doctor or staff detail routes.
- Loading and API-error states; no seed data is shown as a fallback.

The page loads members with `GET /api/admin/doctors-staff`. The department options use live reference data, while filtering/pagination is client-side.

### 5.5 `/admin/doctors-staff/doctors/[id]` and `/admin/doctors-staff/staff/[id]` — Member details

**State:** Initial profile is API-connected; a subset of actions is functional.

Both routes load a member through `GET /api/admin/doctors-staff/:id` and use a shared detail interface. It includes a profile header, role/status badges, and tabs for overview, professional/employment details, work/schedule, account/access, and (for doctors) activity log.

Implemented API actions include:

- Issue/resend an invitation or issue a password-reset link.
- Verify or reject a doctor through the verification endpoint.
- Display loading, missing-member, and API error states.

The “Edit Details” action and other controls that rely on future modules show a coming-soon message. The existence of tabs does not mean each tab is a fully connected management workflow.

### 5.6 `/admin/departments` — Department management

**State:** Frontend-only demo using seeded department fixtures.

The page shows total/active departments, assigned doctors, and appointment totals; supports all/active/inactive tabs, search, status filter, sort, grid/list view, and empty-state reset. It includes add/edit department, manage doctors, manage services, and deactivate dialogs.

The page's provider initializes from `seedDepartments` and mutations update local React state. It does not call `/api/admin/departments`; changes are not persisted and will reset on reload.

### 5.7 `/admin/ai-monitoring` — AI reports monitoring

**State:** Demo/mock data, explicitly labeled as such.

Includes reporting-period controls, KPI summaries, generated/approved/pending/failed report trends, processing/service health, operational activity, doctor ranking, a reports table, report detail/timeline drawers, and CSV export.

The CSV itself labels the source as a frontend demo dataset and says it contains nonclinical operational metrics. This page does not consume the Admin AI-monitoring endpoints yet.

## 6. Doctor workspace

The Doctor UI currently is a visual/interaction prototype:

- `src/app/doctor/layout.tsx` intentionally bypasses the authentication guard for preview.
- Doctor fixtures come from `src/lib/mock/doctorPortal`, `doctorSchedule`, and `doctorPatients`.
- Appointment changes and consultation state are held in React context and reset on a full page reload.
- No doctor API client is present in `src/lib/api` in the current repository snapshot.

### 6.1 `/doctor/dashboard` — Doctor overview

**State:** Prototype using mock appointments, patients, and tasks.

The page contains:

- Time-aware greeting and current date.
- Doctor workspace hero and Start Consultation action.
- KPI cards for today's appointments, waiting patients, pending reports, and follow-ups.
- Today's schedule and appointment status cards.
- Recent patients, pending tasks, and quick actions.
- Appointment quick-view, patient quick-profile, and selection/overlay dialogs.

Starting an eligible consultation updates the shared in-memory doctor workspace state to “In Progress” and opens `/doctor/consultation/[id]`. Other report, prescription, lab, follow-up, and queue actions display future-phase notices.

### 6.2 `/doctor/appointments` — My Schedule

**State:** Interactive prototype with mock schedule appointments.

Includes a date selector/calendar, Today/Upcoming/Completed/Cancelled tabs, search, visit-type/status filters, appointment table, row selection, patient quick profile, appointment details, and reschedule dialogs. The module updates mock appointment statuses/dates locally and can launch the consultation route for a supported demo appointment.

The date-based page is marked dynamic to avoid caching the current-day view, but the appointment records themselves are local fixtures. There are no calls to `/api/doctor/appointments`.

### 6.3 `/doctor/patients` — Patient directory

**State:** Prototype using mock patient records.

Includes search, summary cards, filters for patient attributes such as conditions, age, and gender, filter chips, patient table, row selection, quick-profile overlay, and a start-consultation dialog. It provides links to a patient's full profile.

The “Add Patient” action explains that registration belongs to reception rather than doctors. Patient data is not loaded from the doctor patient API.

### 6.4 `/doctor/patients/[patientId]` — Full patient profile

**State:** Prototype using fixture records.

The header displays patient identity/MRN and summary badges for conditions, medications, and allergies. The page has tabs for:

- Overview and patient/clinical summary.
- Medical history.
- Visits.
- Lab results.
- Medications.
- Documents.

The overview includes demographics/contact details, conditions/allergies/current medications, recent visits, and recent lab results. The consultation entry point is a demo dialog; the component explicitly identifies the content as a demo record and states that it is not read from or written to PostgreSQL.

### 6.5 `/doctor/consultation/[id]` — Consultation handoff prototype

**State:** Deliberately limited prototype; clinical documentation is not implemented in this screen.

Shows the selected patient's identity and summary, appointment/location/context, last recorded note, and tabs for Summary, Notes, Prescription, Lab Request, and Report. Only the Summary view has a basic visit summary; the other tabs show that they belong to a future Consultation Workspace phase.

“Complete Visit” changes the appointment status in the local doctor workspace context and returns to the dashboard. It does not write to the backend, create clinical notes, capture audio, create a transcript, issue a prescription, order a test, or generate/approve a report.

## 7. Navigation items that are not implemented pages

These are visible navigation or action items, but should not be counted as completed pages/workflows:

| Area | Items currently unavailable or partial |
|---|---|
| Public | Watch Video, Google login/signup, contact form delivery, Terms/Privacy content, social profile links |
| Patient | Messages, billing/payments, profile/settings pages, support; dashboard shortcut actions that show “coming soon” |
| Admin | Analytics, Audit Logs, System Settings, support; some member-edit and detail actions |
| Doctor | Consultation Workspace navigation destination, separate Medical Records, Prescriptions, Lab Results, Messages, Reports, Profile, Settings, support |
| Receptionist/staff | Full front-desk workspace; `/workspace` is an account/status placeholder only |

The doctor has a route named `/doctor/consultation/[id]`, but it is a limited handoff prototype and should not be confused with the full Consultation Workspace named in the navigation.

## 8. Backend integration map

### 8.1 Connected frontend flows

The current frontend has a small shared Admin/auth client at [`src/lib/api/admin.ts`](src/lib/api/admin.ts). Existing integrations include:

| Frontend feature | Backend/API |
|---|---|
| Login | `POST /api/auth/login` |
| Resolve current session | `GET /api/auth/me` |
| Logout | `POST /api/auth/logout` |
| Patient signup | `POST /api/auth/register` |
| Invitation/reset activation | `POST /api/auth/activate` |
| Admin user list/create/status | `/api/admin/users` and related mutations |
| Admin doctor/staff directory and member details | `/api/admin/doctors-staff` and related routes |
| Admin invite/reset and doctor verification | Admin invitation/verification routes |
| Admin form lookup data | `GET /api/admin/reference-data` |

The Admin client includes credentials on requests and echoes the readable CSRF cookie on mutations.

### 8.2 Backend routes without a corresponding connected page client

The backend includes patient, doctor, staff, notification, reference/RAG, and Admin extension APIs. The pages described above do not yet consume most of those APIs. In particular:

- Patient dashboard, appointments, doctor directory, medical records, labs, and prescriptions are still mock-driven.
- Admin dashboard, AI monitoring, and departments are still mock-driven.
- Doctor pages are fixture-driven and lack API calls.
- Staff has no operational frontend workspace.

The detailed endpoint/response contract and mock-only screen list are documented in [`docs/FRONTEND_API_HANDOFF.md`](docs/FRONTEND_API_HANDOFF.md).

## 9. UI conventions and supporting code

- The interface consistently uses Medora teal/turquoise, navy, white, and pale-mint surfaces, existing logo/assets, and responsive layouts.
- Shared primitives live under `src/components/ui`, `src/components/layout`, and area-specific `src/components/{auth,patient,admin,doctor}`.
- Motion helpers include reduced-motion handling for key transitions/reveals.
- Patient/Admin layout shells stay mounted across page navigation; several modules preserve search, tab, or scroll state through URL/session state.
- Shared mock files live in `src/lib/mock`. They are fixtures and presentation models, not evidence that a corresponding server endpoint is called.
- Admin API response errors are represented through `ApiError` and UI error states for connected screens.
- The signup/login experience has local validation and field-level accessible labels; the shell includes global focus-visible styling.

## 10. Page route index

### Public and account

| Route | Page |
|---|---|
| `/` | Marketing landing page |
| `/login` | Sign in |
| `/signup` | Patient registration |
| `/activate` | Invitation/password activation form |
| `/workspace` | Receptionist/doctor account destination placeholder |

### Patient

| Route | Page |
|---|---|
| `/patient/dashboard` | Patient overview |
| `/patient/appointments` | Appointment list, booking, details, reschedule/cancel |
| `/patient/my-doctors` | Doctor directory and profile |
| `/patient/medical-records` | Medical record categories and details |
| `/patient/lab-results` | Lab result list |
| `/patient/lab-results/[id]` | Lab result details |
| `/patient/prescriptions` | Prescription and medication overview |
| `/patient/prescriptions/[id]` | Prescription details |

### Admin

| Route | Page |
|---|---|
| `/admin/dashboard` | Admin overview |
| `/admin/users` | User management |
| `/admin/users/new` | Doctor/staff provisioning form |
| `/admin/doctors-staff` | Workforce directory |
| `/admin/doctors-staff/doctors/[id]` | Doctor detail |
| `/admin/doctors-staff/staff/[id]` | Staff detail |
| `/admin/departments` | Department-management demo |
| `/admin/ai-monitoring` | AI monitoring demo |

### Doctor

| Route | Page |
|---|---|
| `/doctor/dashboard` | Doctor overview |
| `/doctor/appointments` | Schedule |
| `/doctor/patients` | Patient directory |
| `/doctor/patients/[patientId]` | Full patient profile |
| `/doctor/consultation/[id]` | Consultation handoff prototype |

## 11. Related documentation

- [Backend implementation overview](BACKEND_IMPLEMENTATION_OVERVIEW.md) — backend architecture, workflows, API coverage, and backend limitations.
- [Frontend API handoff](docs/FRONTEND_API_HANDOFF.md) — endpoint contracts, response shapes, and frontend integration notes.
- [API decisions log](docs/API_DECISIONS.md) — backend implementation decisions and blocked schema/product questions.
- [Repository README](README.md) — local setup, app commands, and endpoint summary.

# MEDORA Healthcare — System Administration Context & Rules

> **Document:** `Admin.md`  
> **Purpose:** Persistent product, UX, architecture, security, and quality context for the Medora Administration module.  
> **Status:** Planning reference, not an implementation request.  
> **Current phase:** Frontend UI with local mock data only. Backend, database, and authentication are **not implemented yet**.  
> **Read before:** Any work involving `/admin`, admin components, admin data models, administrative workflows, or related navigation.

---

## 1. What Medora Is

Medora Healthcare is a healthcare web platform connecting patients, doctors, reception/staff, and administrators. Its intended workflows include patient registration, doctor discovery and appointments, clinical consultations, approved medical records and prescriptions, and AI-assisted documentation that must be reviewed and approved by a qualified doctor.

Medora is not a generic CRM or ecommerce dashboard. It handles sensitive healthcare workflows, so user roles, data visibility, auditability, and truthful UI states matter.

**Existing frontend stack:** Next.js App Router, React, TypeScript, Tailwind CSS. Inspect the repository to verify versions, conventions, available packages, and existing components; do not assume a specific animation or charting library is installed.

## 2. Scope and Current State

### Current state
- Landing Page, Login UI, Sign Up UI, and Patient Dashboard UI may exist in varying stages. Inspect the repository before modifying anything.
- No functioning backend, database, real authentication, session, or role authorization has been implemented.
- The current Admin task is **Admin Dashboard Overview UI only**, using typed mock data.
- All other Admin pages are **future planned pages**. Show their entries in the sidebar, but do not implement them until explicitly requested.
- Existing Medora branding assets and approved design references are supplied in the project. Locate them; do not guess filenames or recreate the logo.

### Explicitly out of scope for this phase
- Database schema, migrations, ORM, REST/GraphQL APIs, Server Actions for mutations, authentication providers, role middleware, email/invitation delivery, password management, actual user provisioning, medical data ingestion, real analytics, live monitoring, and AI report generation.
- Do not create fake backend endpoints or simulate real administrative actions.
- Do not modify the Landing, Login, Sign Up, or Patient UI to make the Admin demo work.
- Do not redirect users from Login to Admin until real authentication and authorization are implemented.

## 3. Four System Roles and Boundaries

| Role | Core responsibilities | Account provisioning |
|---|---|---|
| Patient | Public signup/login, own appointments, approved records, prescriptions and results | **Self-registers** using public Sign Up; role assigned server-side in future |
| Doctor | Own schedule, consultations, patient care, medical record creation, review/approval of AI-assisted reports | Created/invited by Admin after verification |
| Receptionist / Staff | Appointment operations, check-in, administrative front-desk workflows within granted permissions | Created/invited by Admin |
| Admin | Staff/doctor provisioning, permissions, departments, schedules, operational monitoring, configuration, audit and security oversight | Secure initial provisioning/bootstrap; **never public signup** |

**Non-negotiable:** Admin **does not create normal Patient accounts** as a routine workflow. Patients create their own accounts through public Sign Up and can later log in normally. Admin can view/search/manage relevant patient account **status and operational metadata** within authorized limits; avoid implying that Admin registers patients on their behalf.

Public Sign Up must not offer Doctor, Staff, or Admin role selection. A client-provided role must never grant privileges when a backend is eventually implemented.

## 4. Administration Module — Product Goals

1. Give administrators a clear, actionable picture of clinic/platform operations.
2. Enable controlled onboarding and lifecycle management for Doctors and Staff.
3. Help manage departments, doctor availability, and operational scheduling.
4. Show appointment workload and operational bottlenecks.
5. Surface **status/metadata** about AI documentation workflows without replacing clinical approval.
6. Provide useful analytics, system-health indicators, and audit trails.
7. Keep sensitive data exposure minimal and permissions explicit.

The Admin dashboard should emphasize **actionable operations**, not clinical decision-making.

## 5. Future Admin Information Architecture

Suggested sidebar order (preserve the approved screenshot's exact labels/order if it differs):

1. **Overview** — `/admin/dashboard` — **the only page implemented in the current phase**.
2. **Users** — `/admin/users` — patient directory/account status and cross-role account lookup; no routine patient creation.
3. **Doctors & Staff** — `/admin/doctors-staff` — create/invite/verify doctor and staff accounts; manage employment status and scoped permissions.
4. **Departments** — `/admin/departments` — clinical departments and specialties.
5. **Appointments** — `/admin/appointments` — operational appointment list, filters, status tracking, escalation.
6. **Schedules** — `/admin/schedules` — doctor availability, hours, time off, slots.
7. **AI Reports** — `/admin/ai-reports` — workflow monitoring, pending review counts, processing failures, review turnaround; not admin medical approval.
8. **Analytics** — `/admin/analytics` — booking trends, utilization, cancellations, department activity.
9. **Audit Logs** — `/admin/audit-logs` — administrative/security event history.
10. **System Settings** — `/admin/settings` — clinic profile, operational rules, notifications, configuration.

Support/help can appear at the bottom of the sidebar. Future destinations should be visibly present in the UI but should not navigate to missing routes. Use a disabled/Coming Soon treatment that remains accessible.

### Navigation rule
Keep `Overview` active on the Overview page. All other entries are informational placeholders **for now**. Do not generate empty pages or fake functional screens.

## 6. Detailed Future Page Requirements

### 6.1 Overview
- Welcome/hero with clear administrator context and the supplied Medora admin hero image.
- Operational KPI cards: Total Patients, Active Doctors, Today's Appointments, AI Reports, Pending Actions.
- Appointment trend chart with labeled series and selectable time range (visual/local-only initially).
- Department distribution chart and legend.
- Important Notifications panel.
- Quick Actions: Manage Doctors, Manage Staff, View Appointments, View AI Reports.
- Recent Appointments table.
- Recent Users table.
- System Health panel (only demo values until real telemetry exists).
- A date/quote or editorial panel if present in approved screenshot.
- Demo data must be identifiable as sample data; no fabricated live claims.

### 6.2 Users
- Search and filter by role, account state, signup date.
- View Patient accounts and operational metadata; no routine **Create Patient** action.
- Account status controls require authorization, confirmation, justification, and audit in future backend.
- Minimize exposure to patient medical content; do not make an Admin directory a backdoor to clinical records.

### 6.3 Doctors & Staff
- Invite Doctor or Staff; assign role and permitted organizational scope.
- Doctor onboarding includes verification of professional credentials before clinical privileges or public bookability.
- Invite lifecycle: draft → invited → accepted/activated (with expiry/revocation paths).
- Activate, suspend, deactivate; reassign department/schedule as allowed.
- Admin may initiate a secure time-limited password reset/invitation flow in future, **never view plaintext passwords** or silently impersonate users.
- Do not expose an unrestricted role dropdown that permits unauthorized self-promotion.

### 6.4 Departments
- Specialty/department name, description, active status, assigned doctors.
- Prevent deleting departments with dependent operational records without a defined policy.

### 6.5 Appointments
- Filters: date, doctor, department, status, type.
- Possible states: scheduled, confirmed, checked-in, in-progress, completed, cancelled, no-show, rescheduled. Final state machine to be defined with backend.
- Staff handles daily check-in/booking operations; Admin oversees and configures.
- Changes must later be audited and avoid double booking.

### 6.6 Schedules
- Working hours, availability, breaks, leave, appointment slot duration, clinic/department.
- Detect scheduling conflicts before accepting future changes.
- Timezone and locale must be explicit when backend arrives.

### 6.7 AI Reports
- AI may assist with transcription/drafting; output is **not an approved medical report**.
- Doctor is responsible for review, editing, and clinical approval.
- Admin sees workflow status/operational metrics, not a general right to inspect confidential report content.
- Example states: queued, processing, draft, pending doctor review, approved, failed.
- Never allow Admin to approve a report as a doctor.

### 6.8 Analytics
- Operational metrics only, with defined date range, source, aggregation, and comparison periods.
- Avoid implying clinical outcomes from booking metrics.
- Ensure charts have accessible labels and non-color-only legends.

### 6.9 Audit Logs
- Record actor, action, target, timestamp, result, and appropriate context when backend exists.
- Avoid storing secrets or sensitive report text in logs.
- Restrict visibility and protect integrity.

### 6.10 System Settings
- Clinic identity, departments, business hours, appointment policies, notification preferences, role permissions and integrations.
- Dangerous actions require confirmation and auditing once functional.

## 7. Approved Admin Overview Visual Direction

**Primary visual reference:** the user-supplied approved Admin Overview screenshot in the WorkBuddy project.  
**Hero asset:** the standalone image featuring a **male professional/administrator wearing glasses at monitors with healthcare analytics in a modern Medora office**. Locate the actual asset in the repository. Do not substitute the earlier female-doctor image or reuse the whole dashboard screenshot as the hero image.

Medora style:
- Airy, premium healthcare SaaS aesthetic.
- White/off-white surfaces, pale mint/aqua ambient backgrounds.
- Deep navy headings; teal/turquoise gradient primary CTAs.
- Soft shadows, subtle borders, rounded cards, restrained glassy effects.
- Clean readable typography; icons from existing project library.
- White left sidebar, compact topbar, hero banner, KPI row, analytics, tables, right utility column.
- Preserve exact composition, spacing, visual hierarchy, and crop from screenshot as closely as possible.
- Use the approved transparent Medora logo; no white rectangle baked behind it.
- Avoid heavy blur, page-wide zoom, unnecessary scrollbars, or overanimated transitions.

**Screenshot is a visual reference, not a single image to place on the page.** Rebuild all cards, charts, tables, navigation, buttons, text, and statuses as real responsive React UI.

## 8. UI/UX Principles

- Desktop: readable fixed/sticky sidebar and topbar; content grid matches screenshot; no horizontal overflow.
- Tablet: adapt grid and utility panels without shrinking the whole UI via CSS `zoom` or `scale`.
- Mobile: accessible sidebar drawer, stacked content, scrollable tables inside their own containers as needed.
- Accessible semantics, keyboard navigation, visible focus states, adequate contrast, alt text, reduced-motion support.
- Use real links only for implemented routes. Placeholder buttons should clearly indicate unavailable functionality, not misleading success.
- Search, chart range selectors, dropdowns can be local UI interactions if needed, with no fake remote results.
- Use coherent loading/empty/error states later; for now show clearly defined demo content.
- Dates and counts in the screenshot are illustrative; never present them as real production data.

## 9. Frontend Architecture Guidance

- Keep `/admin` separate from `/patient` and future doctor/staff dashboard layouts.
- Suggested App Router organization:
  ```
  app/
    admin/
      layout.tsx
      dashboard/
        page.tsx
  components/
    admin/
      AdminSidebar.tsx
      AdminTopbar.tsx
      AdminHero.tsx
      AdminKpiCard.tsx
      AppointmentTrends.tsx
      DepartmentDistribution.tsx
      RecentAppointments.tsx
      RecentUsers.tsx
      NotificationsPanel.tsx
      QuickActions.tsx
      SystemHealth.tsx
  lib/
    mock-data/
      admin.ts
  types/
    admin.ts
  ```
  Adapt to actual project conventions. Do not create unnecessary files.
- Prefer Server Components where possible, client components only for interactive elements.
- Keep demo data typed, centralized, deterministic, and clearly separated from view components.
- Reuse existing design tokens and icon/chart packages when suitable. Avoid unnecessary dependencies.
- Use Next.js `<Image>` and correct `sizes`/`object-position` for the hero and avatar assets.
- Reuse existing MedoraLogo component/assets; never redraw the logo with CSS.
- No API requests or `localStorage` as a pretend database.
- No new global page transition system.

## 10. Security & Privacy Rules for Future Implementation

These rules describe **future backend requirements**, not permission to build a backend now.

- Enforce authorization **on the server** for every sensitive operation; hiding UI is not security.
- Use least privilege and fine-grained permissions. Admin is not automatically a clinician.
- Public signup creates Patient only; no client-controlled role elevation.
- Doctor/Staff invitation and provisioning are controlled and audited.
- Verify Doctor credentials before granting clinical permissions.
- Passwords must never be displayed, logged, emailed in plaintext, or retrievable by Admin.
- Use secure password reset/invitation tokens with expiry, one-time use, and appropriate rate limits.
- Protect patient medical information; apply minimum-necessary access and audit sensitive access.
- Use HTTPS, secure session cookies, CSRF protection where applicable, input validation, and appropriate rate limiting when backend is introduced.
- Doctor review/approval is required before AI-assisted clinical reports are patient-visible.
- Do not implement fake security gates in the UI-only phase that imply actual protection.
- Before public deployment, `/admin/*` must be protected by real server-side Admin authorization. Current open route is strictly a local/demo development arrangement.

## 11. Code Review Checklist (Every Admin Task)

### Before coding
- [ ] Read this `Admin.md` and root `AGENTS.md` if present.
- [ ] Inspect the actual repository and existing Medora design conventions.
- [ ] Identify approved screenshot, logo, and male hero asset.
- [ ] Confirm task scope; do not implement future pages prematurely.

### During implementation
- [ ] Use reusable components and typed mock data.
- [ ] Maintain role boundaries: Admin creates Doctor/Staff, not Patient.
- [ ] Keep clinical approval exclusively with Doctor.
- [ ] Preserve approved visual fidelity and existing unrelated pages.
- [ ] Make unimplemented navigation explicit and non-broken.
- [ ] No backend/auth/database/API or misleading fake functionality.
- [ ] No console warnings, inaccessible controls, broken image paths, or layout overflow.

### Before completion
- [ ] Compare rendered page with approved screenshot at comparable viewport.
- [ ] Test desktop, tablet, mobile.
- [ ] Verify Sidebar and Topbar alignment, chart legends, tables, hero crop, CTA spacing.
- [ ] Verify no accidental new routes, fake user creation, or patient creation actions.
- [ ] Run project typecheck/lint/build where available and report actual results.
- [ ] Report files changed, assets used, deviations, and remaining TODOs.

## 12. Agent Operating Rules

1. **Read this file as reference context; do not interpret it as an instruction to build the entire Admin module.**
2. Follow the user's current task scope. The first task is **Admin Overview UI only**.
3. Do not invent asset paths; search the project and ask/report if missing.
4. Do not silently modify existing Medora pages or authentication.
5. Prefer small, reviewable changes; explain architecture decisions.
6. Never claim functional backend features exist when only mock UI is present.
7. Never claim pixel-perfect accuracy without visual verification.
8. Do not silently change the four-role model or account creation policy.
9. Report any conflict between this document and the approved design or explicit user instruction before making a consequential change.
10. Treat future pages described here as product roadmap/context, not authorization to implement them.

## 13. Future Development Sequence

1. **Now:** Admin shared shell + Overview page, using approved design and mock data.
2. **Later:** Users directory and Doctors & Staff provisioning UI.
3. **Later:** Departments, Appointments, Schedules.
4. **Later:** AI Reports workflow monitoring, Analytics, Audit Logs, Settings.
5. **Later:** Backend/database/auth, server-side RBAC, real integrations, security review, production readiness.

**End of background reference.**

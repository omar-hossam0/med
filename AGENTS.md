# Medora Healthcare — Repository-wide Coding Agent Instructions

> Purpose: durable instructions for every coding agent working in this repository.
> Read before each task. This is **not** a request to implement every feature.
> Current project name: **Medora**. **CareOS** is the former name of the same graduation project.
> **Source of truth:** inspect the actual repository and applied SQL migrations for implemented behavior. Product workflows below describe intended behavior; they are not proof of implementation.

## 1. Scope and operating principles

- Medora is an AI-assisted healthcare platform, **not** a generic CRM. It supports patients, doctors, receptionists/staff, and administrators.
- It has concurrent frontend, backend, PostgreSQL, and AI development streams. Do **not** assume frontend-only status or that a backend is absent.
- Start by reading the current task, relevant existing code, migrations, and documentation. Distinguish **implemented / verified / proposed / unresolved**.
- Make the smallest coherent change for the requested scope. Do not redesign, rename, or replace unrelated working code.
- A user request to design an ERD is **design-only** unless it explicitly authorizes migrations or runtime changes.
- Preserve approved UI screenshots, branding, layouts, components, and existing behavior when working on frontend code.
- Report actual file changes, tests performed, failures, and unverified assumptions. Do not claim a test passed unless executed.

## 2. Current technology and known foundations (verify in repository)

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS. Check actual installed versions.
- Backend: Node.js, Express.js, JavaScript/CommonJS, `pg`, PostgreSQL 18, environment-based connection configuration.
- Database: development database commonly named `medora_db`, with a PostgreSQL `public` schema. Local developers have **separate database instances**.
- Earlier work reportedly implemented migrations:
  - `001_identity_access.sql` — six auth tables and role/permission seeds.
  - `002_single_admin_enforcement.sql` — one-Admin constraint/trigger.
  - `003_patient_doctor_profiles.sql` — `patient_profiles`, `doctor_profiles`, `specialties`.
- `schema_migrations` and a migration runner with version/checksum tracking have also been reported. **Verify current files and local DB before relying on that report.**
- Existing identity/auth tables: `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions`.
- Existing profile-related tables reported: `patient_profiles`, `doctor_profiles`, `specialties`. Profile registration may create an empty patient profile transactionally; verify before changing signup.
- Never claim a developer's local DB reflects another developer's state simply because Git has been pulled.

## 3. Human roles and account policy

- **Patient:** self-registers with full name, email, password; role always assigned server-side; completes demographic profile after registration; can access own authorized data and approved reports.
- **Doctor:** account provisioned by Admin; views own assigned schedule and authorized patients; conducts consultations and reviews/approves transcripts and clinical reports. Does not manage day-to-day bookings.
- **Receptionist/Staff:** account provisioned by Admin; manages daily appointment scheduling, check-in, rescheduling, cancellations, and front-desk workflow within granted permission.
- **Admin:** current MVP policy is at most one Admin account per database, initially provisioned securely. Can manage users, doctor/staff provisioning and operations. Does **not** automatically get access to private clinical records or doctor-only approval abilities.
- Doctor/staff must not have public signup. Use secure time-limited invitation/activation workflow when that feature is built. Never hardcode or reveal passwords.
- All roles use a common authentication service; frontend route access is not an authorization boundary. Enforce role, permission **and record-specific access** on the server.

## 4. End-to-end Medora patient/doctor workflow

1. Patient creates an account, completes basic profile, and requests or books an appointment.
2. Reception/Staff handles operational scheduling; doctor may view assigned appointments but does not administer them. Do not assume staff must manually approve every request until booking policy is explicitly decided.
3. On consultation, doctor reviews authorized patient information. Capture recording consent and record audio only where enabled and consented.
4. Speech-to-text creates a **draft** transcript; retain sources/versions and doctor corrections. **Only a doctor-approved transcript version** enters the report-generation stage.
5. **Agent 1** consumes the approved transcript and prepares **three report drafts**. The doctor reviews/approves report versions; the AI does not grant clinical approval.
6. **Report 1:** approved patient-friendly summary, instructions, tests and follow-up where available; only released after approval.
7. **Report 2:** structured patient information for **Agent 2**, which proposes/classifies longitudinal clinical record updates with provenance, conflict detection and approval history. Never silently overwrite a prior medical fact. Demographic `patient_profiles` is not the entire medical record.
8. **Report 3:** a separate medical report; purpose, recipient and storage destination remain **unresolved** until the team approves a specification. Do not invent them.
9. **Agent 3** supports recommended follow-up and scheduling by checking availability and proposing options. **Recommendation != proposed slot != confirmed booking**. Actual booking must follow authorization and a defined confirmation policy.
10. Patients only receive doctor-approved final clinical information. Revisions, approvals, and disclosures must be auditable.

AI agents are **internal service workflows**, not additional human Roles in `roles`.

## 5. OCR / RAG medical-reference workflow

- Reference documents (PDFs/scans) are ingested, text extracted directly or by OCR, quality-reviewed, cleaned, chunked/indexed, and made searchable for RAG.
- RAG retrieves relevant reference passages and returns answers with citations/evidence and uncertainty when evidence is insufficient.
- The reference knowledge base is separate from patient-specific documents, recordings and clinical records. Do not merge their authorization/retention policies.
- Do not assume vector storage provider or pgvector until the implementation choice is approved; keep schema flexible.
- OCR/RAG is support for clinicians and authorized users, never automatic diagnosis, treatment authorization or report approval.

## 6. Database and migration rules

- Prefer **one canonical** `database/medora.dbml` for the complete ERD, grouped by module as needed. Logical documentation may have supporting module views; avoid conflicting sources of truth.
- The project's PostgreSQL database stays `medora_db` for local development and normally uses `public`, unless a deliberate architecture decision changes it.
- Do **not** edit previously applied migrations `001`/`002`/`003` or rename established tables/columns silently. New schema changes require new numbered migrations **after approval**.
- Existing profiles connect to `users.id`; do not duplicate `users` or add separate identity systems for each dashboard.
- Use explicit PK/FK, cardinality, nullable rules, CHECK/UNIQUE constraints, timestamps, statuses, indexes and deletion policies; preserve clinical history and approval data rather than blanket CASCADE.
- Use transaction-safe registration/provisioning, safe session handling, parameterized SQL, migration history and checksums. For schema design tasks, plan constraints without applying SQL.
- Never run `DROP`, resets, forced migration replay, Admin bootstrap, or other data-modifying commands without explicit authorization.
- Protect clinical records with minimum-necessary permissions, provenance, consent, doctor approval, audit logs and revision history. Database role names alone are not sufficient.
- Separate **logical ERD design** from **physical migrations**, and both from **API implementation**.

## 7. Backend quality and security

- Follow the existing Express routes/controllers/services/middleware architecture and reuse the `pg` connection pool.
- Validate server-side; use least privilege, robust session revocation, rate limiting, CSRF protection for cookie-authenticated mutations, safe CORS and non-leaking error handling.
- Do not put secrets, raw tokens, medical narratives or plaintext passwords in Git, logs, localStorage or mock analytics.
- For clinical records, preserve attribution, timestamps, doctor approval, version links, and data origin; distinguish requested tests from completed tests and results.
- AI work should be idempotent where possible, retry-aware, linked to the source versions, and auditable.
- Keep frontend data/API contracts aligned with backend. A mock UI is not evidence that a backend feature exists.
- Run relevant tests and report actual results. Never use real patient data for development fixtures.

## 8. Frontend identity and accessibility

- Follow approved Medora teal/turquoise, navy, white/mint visual identity and **actual approved reference screenshots**. Preserve existing logo/assets.
- Inspect installed component, icon, chart and animation libraries. Avoid unnecessary dependencies or alternate design systems.
- Use accessible form labels, keyboard focus, contrast, responsive layouts, reduced-motion support, and honest empty/loading/error states.
- Reuse internal client navigation; do not add arbitrary delays or fake successes. Do not silently change Login, Sign Up, or dashboards for an unrelated task.

## 9. Multi-developer Git workflow

- Multiple contributors may work on frontend and database simultaneously. Inspect `git status` and recent commits; avoid overwriting another developer's changes.
- Separate branches are preferred for nontrivial work; if collaborating on `main`, coordinate affected files and review before push.
- Changes to `database/medora.dbml` and migrations must have a clear owner/review path. Git synchronizes migration **files**, not PostgreSQL databases.
- Do not commit `.env`, credentials, recordings, private clinical data, or personally identifying production fixtures.

## 10. Per-task checklist

1. Read this `AGENTS.md`, the user's newest request, and inspect the actual repo.
2. State the requested scope and any source conflicts in brief.
3. Identify reused files, module boundaries and dependencies.
4. Make minimal changes within scope. For design-only requests, do **not** execute database modifications.
5. Validate syntax, links, tests, and visualization relevant to the deliverable.
6. Report modified files, verified outcomes, unverified assumptions, pending decisions and next safe actions.

**Important:** General rules in this file do not authorize building all modules. The user's current task defines what may actually be changed. Clinical safety and non-destructive data handling always apply.

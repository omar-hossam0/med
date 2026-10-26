# Medora Healthcare — Coding Agent Instructions

> Project-wide instructions for AI coding agents working in this repository.
> Read this file at the beginning of every task and follow it together with the user's latest request.

## 1. Project Context

Medora Healthcare is a healthcare web platform with four distinct user roles:
- **Patient:** appointments, approved medical reports, personal health information.
- **Doctor:** consultations, patient care workflows, medical report review and approval.
- **Receptionist / Staff:** scheduling, front-desk operations, permitted patient coordination.
- **Admin:** organization and user management, account provisioning, permissions, and operational oversight.

AI-assisted transcription and report drafting are support features, not autonomous medical approval. Clinical reports require authorized clinician review and approval before being treated as final.

**Current implementation priority:** frontend UI/UX. Do not assume backend APIs, databases, authentication, or dashboards already exist. Inspect the repository to determine what is implemented.

## 2. Technology and Repository Reality

The intended frontend stack is **Next.js App Router, React, TypeScript, and Tailwind CSS**. Use the installed versions and conventions actually present in `package.json` and the repository.

Before editing:
1. Inspect the relevant route, shared components, styles, assets, and existing navigation/animation patterns.
2. Identify existing reusable components and design tokens.
3. Confirm file paths and installed dependencies; do not invent them.
4. Keep changes limited to the requested feature and necessary shared fixes.
5. Preserve unrelated functionality and the established project structure.

Do not create a new project, replace the architecture, add dependencies, or reorganize folders without a clear need and user approval for substantial changes.

## 3. Visual Identity and Design Fidelity

Medora's established visual language includes:
- Teal/turquoise accents and gradients.
- Deep navy primary text.
- White and very pale mint surfaces.
- Soft rounded controls and cards, subtle borders and shadows.
- Clean, trustworthy, modern healthcare presentation.

**Existing implemented pages and user-provided approved screenshots take precedence over general style descriptions.**

When implementing a reference design:
- Treat the approved screenshot as the visual target, not inspiration for a redesign.
- Match layout, spacing, proportions, typography, colors, border radii, and image cropping as closely as practical.
- Reuse existing logo, icons, image assets, design tokens, and components.
- Never replace or regenerate a referenced image unless explicitly asked.
- Keep responsive layouts accessible and avoid horizontal overflow.
- If the screenshot conflicts with functional accessibility, preserve accessibility and report the deviation.

## 4. Landing Page and Authentication UI

Known routes / intended routes:
- `/` — Landing Page.
- `/login` — Login Page.
- `/signup` — Patient Sign Up Page.

Follow the actual repository implementation; do not assume these routes exist until checked.

Auth pages should share the existing visual system where available:
- Medora branding and typography.
- Clinic image asset already used on Login.
- Organic layered teal/mint wave divider.
- Consistent form inputs and primary buttons.
- Consistent split-screen desktop proportions and mobile adaptation.

Public Sign Up is **Patient-only**. Do not expose Doctor, Receptionist, Staff, or Admin self-registration or role selection. Privileged accounts are provisioned through authorized administrative workflows when a backend is implemented.

When specifically requested, all Landing Page **Get Started** calls to action should link to `/signup`. Preserve the purpose of unrelated buttons.

## 5. Navigation and Motion

- Inspect and reuse the existing page-transition implementation and motion library, if any.
- Do not invent a separate animation system or install a new motion library without approval.
- Use client-side internal navigation (`next/link` or the established router approach).
- Avoid full reloads, blank white frames, flicker, unnecessary delays, and layout jumps.
- Never add arbitrary `setTimeout` delays to simulate smooth navigation.
- Consider image/font loading, route prefetching, transition wrappers, and Suspense fallbacks when debugging navigation.
- Respect `prefers-reduced-motion`.
- Do not claim transitions are bug-free without testing.

## 6. Security, Privacy, and Role Boundaries

- Treat all client input as untrusted; authorization must ultimately be enforced server-side.
- Never trust a client-supplied role for privilege assignment.
- Public registration must not grant Doctor, Staff, Receptionist, or Admin privileges.
- Use role-based access control and finer-grained permissions when implementing backend authorization.
- Admins may initiate secure account invitations or password resets, but must not view users' plaintext passwords.
- Never store passwords or sensitive medical information in browser local storage, logs, or mock analytics.
- Do not fabricate patient data as real data; clearly label any demonstration data.
- Do not treat AI-generated clinical content as final without doctor review and approval.
- Do not implement real authentication, payments, or clinical workflows when the request is frontend-only.

## 7. Frontend Engineering Standards

- Prefer clear, maintainable TypeScript and small reusable React components.
- Use semantic HTML and accessible form labels.
- Ensure keyboard access, focus visibility, readable contrast, and helpful validation messages.
- Implement working interactions for controls within the requested frontend scope.
- Avoid dead links and fake success states. If backend integration is not present, communicate that honestly in the UI.
- Handle responsive behavior on desktop, tablet, and mobile, including short viewports.
- Keep decorative elements noninteractive (`pointer-events: none` when appropriate).
- Avoid unnecessary client components and expensive effects.
- Follow existing linting, formatting, and import conventions.

## 8. Task Execution Workflow

For every task:
1. **Read instructions:** this `AGENTS.md`, then the latest user request and attached references.
2. **Inspect:** relevant routes, components, styles, assets, dependencies, and existing behavior.
3. **Plan briefly:** identify files to change and what to reuse.
4. **Implement narrowly:** make the smallest coherent set of changes that fulfills the request.
5. **Validate:** run available relevant TypeScript, lint, test, and build checks; test key navigation and interactions when browser access is available.
6. **Review visually:** compare against screenshots at representative desktop and mobile widths when possible.
7. **Report accurately:** list changed files, completed behavior, checks performed, failures, and anything not tested.

Do not say a test passed unless you ran it. Do not claim pixel-perfect fidelity without visual comparison. Do not silently change product requirements.

## 9. Scope and Approval Rules

- The user's current explicit instructions override general defaults in this file, except for essential safety and security boundaries.
- Ask before large refactors, dependency migrations, destructive edits, or changes outside the requested scope.
- Do not modify Landing, Login, dashboards, or shared styles unnecessarily while implementing an isolated page.
- Do not add new routes, backend endpoints, databases, or third-party services unless requested.
- Preserve existing assets and established UI behavior.

## 10. Working With This File

This document contains durable project-wide rules, not the specification for a single screen. Individual task prompts and approved screenshots supply feature-specific requirements.

If this file conflicts with the actual codebase, inspect and report the mismatch rather than guessing. If the user intentionally changes a lasting project convention, propose a focused update to this file.

**At the start of a task, confirm that you have read `AGENTS.md` and name the existing components/patterns you plan to reuse.**

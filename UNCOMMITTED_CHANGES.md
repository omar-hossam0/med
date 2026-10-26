# Medora — Uncommitted Changes

> **Status:** Documentation of the complete working-tree change set.  
> **Generated:** 2026-10-25  
> **Repository:** `omar-hossam0/Medora`  
> **Base commit:** `9471e75` — `feat: add mock data for Doctors & Staff module and Admin Users Management`  
> **Important:** This file documents the changes that are currently not committed. No commit was created as part of this documentation task.

## 1. Change-set overview

The uncommitted work adds an end-to-end frontend patient journey:

1. The patient opens **My Doctors**.
2. The patient browses departments and doctor cards.
3. The patient searches and filters the doctor directory.
4. The patient opens a public-style doctor profile.
5. The patient chooses **Book Appointment**.
6. The patient is routed to the existing appointments module with the selected doctor already loaded.
7. The patient chooses a consultation type, date and available time.
8. The patient enters visit details, reviews the booking and confirms it.
9. The new appointment appears in the in-memory appointments list.

This is a frontend-only demo implementation. It does not add a backend, authentication, persistence, payments, real availability locking, notification delivery or clinical approval workflow.

## 2. Working-tree inventory

### Modified tracked files

| File | Change |
|---|---|
| [`src/components/patient/PatientSidebar.tsx`](./src/components/patient/PatientSidebar.tsx) | Added routes for **Appointments** and **My Doctors**, allowing the sidebar items to navigate to their new pages and receive the existing active-route treatment. |
| [`src/components/patient/ui.tsx`](./src/components/patient/ui.tsx) | Added configurable avatar corner treatment and a medium `StatusBadge` size while preserving existing defaults. |

### New Markdown and reference assets

| File | Purpose |
|---|---|
| [`PatientJourney.md`](./PatientJourney.md) | Existing detailed design/change summary for the approved Patient journey, including scope, behavior, verification notes, visual deviations and deferred backend work. |
| [`src/assets/Medora Healthcare Appointment Workflow.png`](./src/assets/Medora%20Healthcare%20Appointment%20Workflow.png) | New untracked appointment-workflow reference image. |
| [`src/assets/Medora Healthcare Patient Journey.png`](./src/assets/Medora%20Healthcare%20Patient%20Journey.png) | New untracked Patient journey reference image used as the visual target and not modified by the UI. |

### New routes

| File | Route | Purpose |
|---|---|---|
| [`src/app/patient/my-doctors/page.tsx`](./src/app/patient/my-doctors/page.tsx) | `/patient/my-doctors` | Adds route metadata and mounts `MyDoctorsModule`. |
| [`src/app/patient/appointments/page.tsx`](./src/app/patient/appointments/page.tsx) | `/patient/appointments` | Adds route metadata and mounts `AppointmentsModule`. |

### New shared patient component

| File | Purpose |
|---|---|
| [`src/components/patient/DoctorPortrait.tsx`](./src/components/patient/DoctorPortrait.tsx) | Displays an approved doctor image through `next/image`, or falls back to the shared initials `Avatar`. Supports circular and rounded-square presentation, responsive sizing, priority loading and consistent borders. |

### New My Doctors components

| File | Purpose |
|---|---|
| [`src/components/patient/my-doctors/MyDoctorsModule.tsx`](./src/components/patient/my-doctors/MyDoctorsModule.tsx) | Client-side orchestrator for the directory and profile views. Owns selected doctor, department, search, filters, filter-panel state and session-only favorites. Synchronizes `?doctor=<id>` with browser history and preserves directory state when returning from a profile. |
| [`src/components/patient/my-doctors/DoctorDirectory.tsx`](./src/components/patient/my-doctors/DoctorDirectory.tsx) | Renders the directory heading, search field, filter controls, department cards, grouped doctor results, empty state and reset actions. |
| [`src/components/patient/my-doctors/DoctorCard.tsx`](./src/components/patient/my-doctors/DoctorCard.tsx) | Renders a doctor portrait, name, specialty, rating, review count, experience, clinic, city, favorite controls and `View Details`. |
| [`src/components/patient/my-doctors/DoctorProfileView.tsx`](./src/components/patient/my-doctors/DoctorProfileView.tsx) | Renders the doctor breadcrumb, profile header and conditional tabs for overview, services, availability, reviews and location. Provides favorite and booking actions. |

### New Appointments components

| File | Purpose |
|---|---|
| [`src/components/patient/appointments/AppointmentsModule.tsx`](./src/components/patient/appointments/AppointmentsModule.tsx) | Client-side appointments orchestrator. Handles list, booking, details, success, reschedule, cancel and toast states; synchronizes supported URL query parameters; validates booking and reschedule availability; keeps mutations in React state. |
| [`src/components/patient/appointments/AppointmentsList.tsx`](./src/components/patient/appointments/AppointmentsList.tsx) | Appointments list UI with tabs, search, filters, sorting, pagination and actions for viewing, rescheduling, cancelling and booking again. |
| [`src/components/patient/appointments/AppointmentDetailsView.tsx`](./src/components/patient/appointments/AppointmentDetailsView.tsx) | Appointment detail view with overview, location, preparation and policy sections, plus reschedule, cancel, book-again, notification and calendar-export actions. |
| [`src/components/patient/appointments/BookingView.tsx`](./src/components/patient/appointments/BookingView.tsx) | Three-step booking flow: `Doctor & Time`, `Details` and `Review`. Uses doctor-specific consultation support, working days, slots, conflict checks and honest demo states. |
| [`src/components/patient/appointments/BookingSuccessModal.tsx`](./src/components/patient/appointments/BookingSuccessModal.tsx) | Confirmation modal showing the newly created appointment and actions for viewing appointments or booking another visit with the same doctor. |
| [`src/components/patient/appointments/Calendar.tsx`](./src/components/patient/appointments/Calendar.tsx) | Reusable month calendar with previous/next navigation, selected date, today styling, disabled dates and a caller-provided `isDateDisabled` rule. |
| [`src/components/patient/appointments/CancelModal.tsx`](./src/components/patient/appointments/CancelModal.tsx) | Accessible cancellation dialog with a required reason selection, optional notes, appointment context and explicit confirmation. |
| [`src/components/patient/appointments/ModalShell.tsx`](./src/components/patient/appointments/ModalShell.tsx) | Shared modal shell with reduced-motion support, focus restoration, keyboard escape handling, focus trapping and backdrop close behavior. |
| [`src/components/patient/appointments/RescheduleModal.tsx`](./src/components/patient/appointments/RescheduleModal.tsx) | Rescheduling dialog using the appointment doctor's working days, consultation type, available slots and conflict validation. |

### New mock data

| File | Purpose |
|---|---|
| [`src/lib/mock/doctors.ts`](./src/lib/mock/doctors.ts) | Canonical typed doctor roster and directory data. Defines departments, doctor records, clinic data, supported consultation types, weekly availability, services, tags, reviews, portrait references and availability helpers. |
| [`src/lib/mock/appointments.ts`](./src/lib/mock/appointments.ts) | Appointment types, seeded appointments, date/time formatting utilities, slot generation, conflict checks, booking references, cancellation reasons, visit reasons and preparation tips. Reuses the canonical doctor roster instead of duplicating doctor data. |

## 3. My Doctors behavior

### Directory

- The page title and supporting copy establish the doctor-discovery purpose.
- The search field matches against doctor name, professional title, specialty, department, clinic, city, services and tags.
- The filter panel supports:
  - Location: all locations, Cairo or Giza.
  - Consultation type: all, in-person or online.
  - Availability: any, works today or works this week.
- Availability filters derive their result from the doctor's weekly clinic hours.
- Department cards are data-driven and display derived doctor counts.
- Featured departments are shown initially; `View All` reveals the additional department.
- Selecting a department filters the results. Selecting or resetting the directory can clear that department selection.
- Results are separated into featured specialists and other doctors.
- Search/filter/reset actions include an empty state when no doctor matches.
- Favorites are available from both the card portrait area and the card footer. They are session-only and are not presented as persisted data.

### Doctor cards

Each card includes:

- Approved portrait asset or initials fallback.
- Doctor name and specialty.
- Rating and review count.
- Years of experience.
- Clinic and city.
- Accessible favorite/save actions.
- `View Details` action.
- Hover/focus treatments consistent with the existing teal, navy, mint and white Medora visual language.

### Doctor profile

The profile view includes:

- Breadcrumb navigation from My Doctors to department to doctor.
- Back action that preserves directory state.
- Portrait and optional demo-only verified indicator based on the record.
- Doctor name, title, rating, review count, experience, clinic and languages.
- Session-only favorite control.
- `Book Appointment` action.
- Conditional tabs:
  - **Overview:** about section, fact tiles, areas of expertise, upcoming availability and demo review summary.
  - **Services:** medical services and specialty tags.
  - **Availability:** weekly hours, day status and supported consultation types.
  - **Reviews:** shown only when review records exist and labeled as demo feedback.
  - **Location:** public clinic address, visit information and external map link.
- No credentials, clinical claims or verification facts are invented beyond the data explicitly present in the mock record.

## 4. Appointments behavior

### Routes and URL state

The appointments route supports:

- `/patient/appointments` — appointment list.
- `/patient/appointments?view=book&doctor=<id>` — booking with a selected doctor.
- `/patient/appointments?view=book&doctorId=<id>` — backward-compatible alternate doctor query parameter.
- `/patient/appointments?view=details&id=<id>` — a specific appointment detail view.

The module listens for browser back/forward events and resets internal overlays when the URL view changes.

### Booking flow

1. **Doctor & Time**
   - Shows the selected doctor and a `Change Doctor` action.
   - Prevents silent fallback when the doctor ID is missing or invalid.
   - Lets the patient choose supported in-person or online consultation.
   - Displays only dates on which the doctor works for the selected consultation type.
   - Displays 30-minute slots generated from doctor working ranges.
   - Applies lead-time, seeded-block and in-memory conflict checks.
   - Clears an incompatible date/time when consultation type changes.
   - Uses explicit placeholders such as `Select a date` and `Select a time` before a choice is made.

2. **Details**
   - Collects visit reason.
   - Collects optional notes with a 500-character limit.
   - Keeps the draft in React state only; it is not written to browser storage.

3. **Review**
   - Shows doctor, specialty, consultation type, date, time, location, reason and notes.
   - Revalidates slot availability when the patient confirms.
   - Returns to the first step with a clear message if the selected slot became unavailable.

After confirmation:

- A new appointment is inserted into the in-memory list.
- The success modal shows the appointment reference and visit information.
- `View My Appointments` returns to the list.
- `Book Another Appointment` keeps the same doctor but clears the date/time draft.

### Existing appointment management

- Existing tabs, search, filters, sort, pagination and details behavior remain available.
- Only upcoming appointments can be rescheduled or cancelled.
- Rescheduling respects the appointment doctor's working days and consultation type.
- The appointment being rescheduled is ignored when checking its own conflict.
- Cancellation captures a reason and optional notes, then marks the appointment as cancelled in memory.
- Toasts explicitly communicate demo-only mutations and invalid actions.
- Appointment rows/details/success/cancel surfaces use the shared `DoctorPortrait`.

## 5. Shared data and consistency

[`src/lib/mock/doctors.ts`](D:/MEDORA/medora/src/lib/mock/doctors.ts) is the single source of truth for:

- Department definitions and visual tones.
- Featured department IDs.
- Doctor IDs and profiles.
- Clinic and location values.
- Consultation support.
- Weekly working ranges.
- Services, tags, languages and demo reviews.
- Portrait asset references.
- Department counts and availability calculations.
- Slot range generation.

[`src/lib/mock/appointments.ts`](D:/MEDORA/medora/src/lib/mock/appointments.ts):

- Re-exports the canonical doctor-related values needed by appointment screens.
- Seeds appointments using doctor IDs from the same roster.
- Computes dates, formatted labels, time ranges and references.
- Generates available slots from doctor schedules.
- Checks conflicts against current in-memory appointments.
- Provides shared cancellation reasons, visit reasons and preparation tips.

This avoids having separate, potentially inconsistent doctor lists in the directory, profile, booking, reschedule and appointment-list screens.

## 6. Accessibility, motion and responsive behavior

- Interactive elements use semantic buttons and labels.
- Favorite controls expose pressed state and descriptive accessible labels.
- Search, filter and modal controls expose labels/state to assistive technology.
- Appointment dialogs support focus management, escape-to-close and focus restoration.
- Reduced-motion preferences are respected in the appointment transitions, profile tabs, skeletons and modal behavior.
- Responsive layouts cover desktop, tablet and mobile widths without intentionally introducing horizontal overflow.
- Decorative icons and imagery are kept noninteractive.
- Loading skeletons use `aria-busy` and an accessible loading label.

## 7. Reference images and visual decisions

- The Patient journey reference image is used as a visual target and is not regenerated or replaced.
- The appointment workflow reference image is included with the uncommitted assets.
- Existing Medora styling patterns are reused: teal/turquoise accents, deep navy text, pale mint surfaces, rounded cards, subtle borders and restrained shadows.
- The implementation uses the approved portrait assets where available and initials fallback where the source crop is not suitable for a large card.
- Demo labels are intentionally visible so the UI does not imply real booking, payment, verification or clinical approval.

## 8. Verification recorded for this change set

The existing [`PatientJourney.md`](./PatientJourney.md) records the following verification results from the implementation work:

| Check | Recorded result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass with 16 routes |
| Patient journey QA | 59/59 passed |
| Appointments regression QA | 16/16 passed |
| Horizontal overflow checks at 1280, 768 and 390 widths | None reported |
| Mobile profile interactive-target check | 0 controls below 24px |

Those results are historical notes from the implementation summary; they were not rerun while creating this documentation file.

## 9. Known demo limitations and deferred backend work

The uncommitted implementation intentionally does not provide:

- Server-backed doctor directory/search/filter APIs.
- Authoritative availability, timezone handling, slot locking or race-safe conflict resolution.
- Persistent booking, rescheduling or cancellation.
- Real authentication or server-side patient authorization.
- Persistent saved doctors/favorites.
- Email/SMS reminders or notification delivery.
- Secure video-link generation for online consultations.
- Verified-visit review moderation or server-side rating aggregation.
- Credential verification for the demo `Verified Doctor` badge.
- A production map-provider integration.
- High-resolution clinician imagery beyond the approved local assets.
- Real-time updates or multi-device synchronization.

## 10. Final uncommitted-file count

Before adding this documentation file, the working tree contained:

- **2 modified tracked files**
- **20 other untracked files**:
  - 1 existing journey summary
  - 2 route files
  - 2 reference images
  - 1 shared portrait component
  - 9 appointment components
  - 4 My Doctors components
  - 2 mock-data files

This file is itself intentionally untracked until the complete change set is reviewed and committed.

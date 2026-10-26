# Medora Patient Journey — Change Summary

> **Scope:** Approved three-screen Patient journey — **My Doctors → Doctor Details → Appointments booking**.
> **Reference:** `src/assets/Medora Healthcare Patient Journey.png` (used as the visual target, not modified).
> **Phase:** Frontend UI with typed demo data only. No backend, payments, real availability, or authentication changes.
> **Last updated:** 2026-10-25

---

## 1. What was built

A connected patient flow in which a doctor is discovered on **My Doctors**, reviewed on a **public-style profile**, and then booked through the **existing Appointments module** with that doctor already selected.

| Route | Purpose |
|---|---|
| `/patient/my-doctors` | Directory, search, filters, department browsing, doctor profiles |
| `/patient/my-doctors?doctor=<id>` | Deep link to a doctor profile |
| `/patient/appointments` | Existing appointments list, details, reschedule and cancel |
| `/patient/appointments?view=book&doctor=<id>` | Booking with the selected doctor, three-step flow |

---

## 2. Files

### New

| File | Purpose |
|---|---|
| `src/lib/mock/doctors.ts` | Canonical departments, 16-doctor roster, weekly clinic hours, services, tags, demo reviews, portrait references, availability helpers |
| `src/components/patient/DoctorPortrait.tsx` | Shared portrait with initials fallback and circle/rounded shapes |
| `src/components/patient/my-doctors/MyDoctorsModule.tsx` | Directory/profile orchestration, URL sync, lifted search/filter/favorite state |
| `src/components/patient/my-doctors/DoctorDirectory.tsx` | Search, filter panel, department cards, grouped results, empty state |
| `src/components/patient/my-doctors/DoctorCard.tsx` | Doctor card with favorite and `View Details` |
| `src/components/patient/my-doctors/DoctorProfileView.tsx` | Profile header and Overview / Services / Availability / Reviews / Location tabs |
| `src/app/patient/my-doctors/page.tsx` | Route metadata |

### Updated

| File | Change |
|---|---|
| `src/lib/mock/appointments.ts` | Re-exports the canonical roster; doctor- and consultation-type-aware slots; prep tips; seeded records aligned to the roster |
| `src/components/patient/appointments/BookingView.tsx` | Rebuilt to the approved booking composition with three steps, guards and doctor-specific availability |
| `src/components/patient/appointments/AppointmentsModule.tsx` | Reads `doctor` / `doctorId` query params, Change Doctor routing, Book Another keeps the doctor |
| `src/components/patient/appointments/Calendar.tsx` | `isDateDisabled` now overrides the Sunday default |
| `src/components/patient/appointments/RescheduleModal.tsx` | Doctor working days and consultation-type slot rules |
| `src/components/patient/appointments/AppointmentsList.tsx` | Uses the shared doctor portrait |
| `src/components/patient/appointments/AppointmentDetailsView.tsx` | Uses the shared doctor portrait |
| `src/components/patient/appointments/BookingSuccessModal.tsx` | Uses the shared doctor portrait |
| `src/components/patient/appointments/CancelModal.tsx` | Uses the shared doctor portrait |
| `src/components/patient/PatientSidebar.tsx` | `Appointments` and `My Doctors` now route and highlight correctly |
| `src/components/patient/ui.tsx` | `Avatar` accepts a corner-radius override; `StatusBadge` gains a medium size |

> The Appointments module files were already present in the working tree before this change set; they are updated here rather than introduced from scratch.

---

## 3. My Doctors

- Heading, subtitle, search and filter panel.
- **Departments:** Cardiology, Dermatology, Pediatrics, Orthopedics, General Medicine, Neurology. Five are featured; `View All` reveals Neurology. Counts are **derived** from the roster (Cardiology 6, others 2).
- **Search:** name, title, specialty, department, clinic, city, services and tags.
- **Filters:** location (Cairo / Giza), consultation type (In-Person / Online), availability (`Works today`, `Works this week`) based on the doctor's demo weekly clinic hours.
- **Results:** grouped into `… Specialists` and `Other … Doctors`, count line, `View All` on both groups, and reset controls.
- **Empty state:** explains the mismatch and resets department, search and filters.
- **Cards:** portrait, name, specialty, rating/reviews, years of experience, clinic, city, favorite and `View Details`. Favorites are **session-only** and make no persistence claim.
- Selecting a department card filters the list; selecting it again clears the filter.
- Directory search, filters and department survive opening a profile and returning.

---

## 4. Doctor Details

- Dynamic breadcrumb: `My Doctors > Department > Doctor`.
- Back control preserves search and filters; scroll is reset to the top.
- Header: portrait, name, **Verified Doctor** only when the record supports it, professional title, rating, years, clinic, languages, favorite and `Book Appointment`.
- Tabs:
  - **Overview** — about, fact tiles, areas of expertise, upcoming available days, demo review summary.
  - **Services** — medical services and specialty tags.
  - **Availability** — weekly hours, status per day, supported consultation types, booking shortcut.
  - **Reviews** — only shown when review records exist; labelled demo feedback.
  - **Location** — public clinic address, visit information, external Google Maps link.
- No invented credentials, verification, or clinical-quality claims. Reviews are clearly demo content.

---

## 5. Booking

### Entry and handoff

- `Book Appointment` navigates to `/patient/appointments?view=book&doctor=<id>`.
- The booking view accepts both `doctor` and `doctorId`.
- The doctor ID is validated against the roster; an unknown ID shows “Doctor not available”, a missing ID shows “Choose a doctor first”. Both offer `Find a Doctor` instead of silently choosing someone else.
- The sidebar highlights **Appointments**; there is no second booking form or doctor directory under My Doctors.

### Flow

- Header: `Book New Appointment` with the doctor-named subtitle.
- Three-step indicator: **Doctor & Time → Details → Review**.
- **Selected Doctor** card: portrait, name, specialty label, rating, years, clinic, city and `Change Doctor` (navigates back to My Doctors; the draft resets).
- Consultation type cards are enabled only for supported types.
- Calendar shows only days the doctor works (for the chosen type); slots are 30-minute intervals from the doctor's weekly ranges. Online adds weekday 18:00–20:00 for doctors who support video.
- Slots respect a one-hour lead time, seeded demo blocks and real conflicts with in-memory appointments.
- Changing consultation type clears the time; the date is cleared when the doctor does not work that day with the new type.
- The summary uses honest placeholders (`Select a date`, `Select a time`) until selected.
- Details step preserves reason and notes (max 500 characters, not persisted to browser storage).
- Review step shows doctor, specialty, type, date, time, location, reason and notes.
- Confirm is re-validated; if the slot became unavailable, the view returns to step 1 with a message.
- Existing success modal appears; the new appointment is added to the in-memory list and is searchable.
- `Book Another Appointment` keeps the same doctor and clears date/time; `View My Appointments` returns to the list.

### Preserved Appointments behavior

- Tabs, search, filters, sort, pagination, details, reschedule and cancel remain.
- Reschedule now respects the doctor's working days and the appointment's consultation type, and ignores the appointment being moved when checking conflicts.
- Cancel/keep, success, and list updates still behave as before.

---

## 6. Data consistency

- `src/lib/mock/doctors.ts` is the single roster for the directory, profile, booking, reschedule and list.
- `appointments.ts` re-exports `doctors`, `getDoctor`, `specialties`, `CLINIC` instead of holding a second doctor list.
- Seeded appointments reference the same doctor IDs as the roster.
- Department counts, availability filters, profile hours and booking slots all derive from the same records.
- Doctor portraits reuse approved member crops; doctors without an approved crop use the initials fallback. No images were regenerated or replaced.

---

## 7. Verification

Run against the production build on `http://localhost:3000` with headless Chrome via CDP.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass, no errors |
| `npm run lint` | Pass, no warnings or errors |
| `npm run build` | Pass (16 routes) |
| Journey QA | **59/59 passed**, 0 console errors |
| Appointments regression QA | **16/16 passed** |
| Horizontal overflow at 1280 / 768 / 390 | None on directory, profile and booking |
| Mobile interactive targets on profile | 0 below 24px |

Journey coverage included: directory render, derived counts, search, all profile tabs, preserved search on back, department filtering, booking handoff, sidebar highlight, URL ID, honest placeholders, no secondary booking form, date/slot selection, Details, Review, success, new list record, details/reschedule/cancel open-close, invalid and missing doctor guards.

Regression coverage included: confirm reschedule, confirm cancellation, and `Book Another` reopening the same doctor with cleared date/time.

Artifacts:
- `C:\Users\Omar\AppData\Local\Temp\opencode\journey-qa.mjs`
- `C:\Users\Omar\AppData\Local\Temp\opencode\journey-shots\`
- `C:\Users\Omar\AppData\Local\Temp\opencode\appointments-regression.mjs`
- `C:\Users\Omar\AppData\Local\Temp\opencode\regression-shots\`

The temporary QA session was deleted from the backend after testing.

**Not tested:** Firefox/Safari, real screen readers, network latency, real backend integration, multi-device sync.

---

## 8. Visual notes and deliberate deviations

- The mock's **large full-width portraits** could not be reproduced with the available assets: member crops are 36×36 px (one is 62×62), so portraits are displayed at a compact size with an initials fallback rather than upscaling them across the card.
- The booking summary shows a `DEMO` chip and the page shows a `Demo booking` note; the mock has no such labels. They are deliberate honesty cues.
- Review rating-distribution bars from the mock were omitted because no per-star data exists.
- The profile uses the roster's professional title (“Consultant Cardiologist”); the booking card uses the mock's specialty label.
- “Need to Reschedule?” is a bordered card with a working `View My Appointments` action; the mock shows it as plain text.
- All clinical/demo states are labelled; no real booking, payment, verification or clinical approval is implied.

---

## 9. Deferred backend work

- Doctor directory, search, filtering and pagination APIs.
- Authoritative availability, timezone handling, slot locking and conflict resolution.
- Server-side booking, reschedule and cancellation persistence.
- Authentication/RBAC for patient booking and administrative provisioning.
- Favorite/saved-doctor persistence.
- Email/SMS reminders and notification delivery.
- Secure video-link generation for online visits.
- Verified-visit reviews, moderation and rating aggregation.
- Credential verification for the `Verified Doctor` badge.
- Map provider integration and higher-resolution clinician images.
- Real-time updates and multi-device synchronization.

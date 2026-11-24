/**
 * Typed demo fixtures for the Doctor Portal — My Schedule.
 *
 * Frontend-only phase: nothing here is persisted. The schedule is derived from
 * the same patient pool as the Overview, and today's clinic day reuses
 * `portalAppointments` verbatim so the Overview and My Schedule never disagree
 * about who is in the clinic today.
 *
 * Dates are anchored to the day the page is rendered (see `todayISO`). The route
 * is dynamic, so the server render and the client hydration share the same day.
 */

import {
  portalAppointments,
  portalPatients,
  type DoctorAppointmentStatus,
  type PortalAppointment,
} from "./doctorPortal";

export type ScheduleAppointment = PortalAppointment & {
  /** ISO `yyyy-mm-dd`, clinic local date. */
  date: string;
  /** Short visit label used in the table ("Follow-up", "Check-up", …). */
  visitType: string;
  notes?: string;
};

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

export function toISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDays(iso: string, days: number): string {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function todayISO(): string {
  return toISO(new Date());
}

const LONG_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Fri, Nov 6, 2026" */
export function formatLongDate(iso: string): string {
  const date = fromISO(iso);
  return `${LONG_DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "Nov 6, 2026" */
export function formatShortDate(iso: string): string {
  const date = fromISO(iso);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "November 2026" */
export function formatMonthTitle(iso: string): string {
  const date = fromISO(iso);
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

export function monthGrid(iso: string): { iso: string; day: number; inMonth: boolean }[] {
  const base = fromISO(iso);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const cells: { iso: string; day: number; inMonth: boolean }[] = [];

  for (let i = 0; i < startOffset; i += 1) {
    const date = new Date(base.getFullYear(), base.getMonth(), i - startOffset + 1);
    cells.push({ iso: toISO(date), day: date.getDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: toISO(new Date(base.getFullYear(), base.getMonth(), day)), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = fromISO(cells[cells.length - 1].iso);
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ iso: toISO(next), day: next.getDate(), inMonth: false });
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Visit types                                                         */
/* ------------------------------------------------------------------ */

const VISIT_REASONS = [
  "Follow-up (Hypertension)",
  "Routine Check-up",
  "Chest Pain Evaluation",
  "ECG Review",
  "Medication Review",
  "Annual Check-up",
  "Respiratory Review",
  "Renal Function Review",
  "General Consultation",
];

export function visitTypeFor(reason: string): string {
  const value = reason.toLowerCase();
  if (value.includes("ecg")) return "ECG Review";
  if (value.includes("evaluation")) return "Evaluation";
  if (value.includes("check-up") || value.includes("check up")) return "Check-up";
  if (value.includes("follow-up") || value.includes("review")) return "Follow-up";
  if (value.includes("consultation")) return "Consultation";
  return "Consultation";
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
];

function buildSchedule(today: string): ScheduleAppointment[] {
  const rows: ScheduleAppointment[] = [];

  // Today: the same clinic day the Overview renders.
  portalAppointments.forEach((appointment) => {
    rows.push({
      ...appointment,
      date: today,
      visitType: visitTypeFor(appointment.reason),
      notes:
        appointment.id === "apt-03"
          ? "Review recent lab results and adjust medication if needed."
          : undefined,
    });
  });

  // Surrounding weeks: a deterministic spread of past and future clinics.
  for (let offset = -16; offset <= 16; offset += 1) {
    if (offset === 0) continue;
    const date = addDays(today, offset);
    const weekday = fromISO(date).getDay();
    if (weekday === 5) continue; // clinic closed on Fridays

    const dayNumber = fromISO(date).getDate();
    const count = 2 + (Math.abs(offset * 7 + dayNumber) % 3);

    for (let index = 0; index < count; index += 1) {
      const seed = Math.abs(offset * 13 + dayNumber * 5 + index * 3);
      const patient = portalPatients[seed % portalPatients.length];
      const slot = SLOTS[(seed + index * 3) % SLOTS.length];
      const reason = VISIT_REASONS[(seed + index) % VISIT_REASONS.length];
      const cancelled = seed % 17 === 0;
      const status: DoctorAppointmentStatus = cancelled
        ? "Cancelled"
        : offset < 0
          ? "Completed"
          : "Upcoming";

      rows.push({
        id: `apt-${date}-${index}`,
        patientId: patient.id,
        date,
        time: slot,
        durationMinutes: 30,
        reason,
        visitType: visitTypeFor(reason),
        location: "Medora Clinic — Room 304",
        status,
      });
    }
  }

  return rows.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

export const TODAY_ISO = todayISO();

export const scheduleAppointments: ScheduleAppointment[] = buildSchedule(TODAY_ISO);

export const VISIT_TYPE_OPTIONS = Array.from(
  new Set(scheduleAppointments.map((appointment) => appointment.visitType)),
).sort();

export const STATUS_OPTIONS: DoctorAppointmentStatus[] = [
  "Upcoming",
  "Waiting",
  "Arrived",
  "In Progress",
  "Completed",
  "Cancelled",
];

/** Half-hour slots offered by the reschedule form (demo availability only). */
export const RESCHEDULE_SLOTS = SLOTS;

/** The next 30 days, used by the reschedule date select. */
export function rescheduleDateOptions(today: string): string[] {
  return Array.from({ length: 30 }, (_, index) => addDays(today, index + 1));
}

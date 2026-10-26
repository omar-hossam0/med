/**
 * Typed demo data and local scheduling helpers for the Patient Appointments
 * module.
 *
 * Frontend-only phase: appointments, bookings, reschedules and cancellations
 * live in React state for the current session. Nothing here is sent to a
 * backend, and no real slot is reserved.
 */

import type { AppointmentStatus } from "./patient";
import {
  CLINIC,
  doctors,
  formatSlotTime,
  getDoctor,
  slotTimesFor,
  specialties,
  type ConsultationType,
  type Doctor,
} from "./doctors";

export type { AppointmentStatus };
export type { ConsultationType, Doctor };
export { CLINIC, doctors, formatSlotTime, getDoctor, specialties };

export type AppointmentTab = "All" | AppointmentStatus;
export type SortOption = "nearest" | "newest" | "oldest";

export type Appointment = {
  id: string;
  reference: string;
  doctorId: string;
  startsAt: Date;
  durationMinutes: number;
  consultationType: ConsultationType;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  cancellationReason?: string;
};

export type BookingDraft = {
  doctorId: string;
  consultationType: ConsultationType;
  dateKey: string;
  time: string;
  reason: string;
  notes: string;
};

/* ------------------------------------------------------------------ */
/* Date + slot helpers                                                 */
/* ------------------------------------------------------------------ */

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
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

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, days: number): Date {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function combineDateAndTime(dateKey: string, time: string): Date {
  const date = dateFromKey(dateKey);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function isPastDay(date: Date, today: Date): boolean {
  return startOfDay(date).getTime() < startOfDay(today).getTime();
}

export function isClosedDay(date: Date): boolean {
  return date.getDay() === 0;
}

export function formatLongDate(date: Date): string {
  return `${WEEKDAY_SHORT[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatShortDate(date: Date): string {
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatMonthYear(date: Date): string {
  return `${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatMonthLong(date: Date): string {
  return `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
}

export function dateParts(date: Date): { day: string; month: string; year: string } {
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: MONTH_SHORT[date.getMonth()],
    year: String(date.getFullYear()),
  };
}

function formatTimeValue(date: Date): string {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s/g, " ");
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return formatTimeValue(date);
}

export function formatTimeRange(start: Date, durationMinutes: number): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${formatTimeValue(start)} – ${formatTimeValue(end)}`;
}

function timeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(result);
}

export type Slot = { time: string; available: boolean };

/**
 * Demo availability driven by each doctor's own weekly clinic hours.
 * Past/too-soon slots are disabled, some slots are seeded as "already booked"
 * for variety, and real conflicts with the in-memory appointments list are
 * respected. Nothing is reserved on a server.
 */
export function getAvailableSlots({
  doctor,
  dateKey,
  consultationType = "In-Person",
  appointments,
  now,
  ignoreAppointmentId,
}: {
  doctor: Doctor;
  dateKey: string;
  consultationType?: ConsultationType;
  appointments: Appointment[];
  now: Date;
  ignoreAppointmentId?: string;
}): Slot[] {
  const booked = new Set(
    appointments
      .filter(
        (appointment) =>
          appointment.doctorId === doctor.id &&
          appointment.status === "Upcoming" &&
          appointment.id !== ignoreAppointmentId,
      )
      .map((appointment) => `${toDateKey(appointment.startsAt)}:${timeKey(appointment.startsAt)}`),
  );

  return slotTimesFor(doctor, dateKey, consultationType).map((time) => {
    const slotDate = combineDateAndTime(dateKey, time);
    const tooSoon = slotDate.getTime() < now.getTime() + 60 * 60 * 1000;
    const seedBlocked =
      hash(`${doctor.id}|${dateKey}|${time}|${consultationType}`) % 7 === 0;
    const conflict = booked.has(`${dateKey}:${time}`);
    return { time, available: !tooSoon && !seedBlocked && !conflict };
  });
}

export function isSlotAvailable(args: {
  doctor: Doctor;
  dateKey: string;
  time: string;
  consultationType?: ConsultationType;
  appointments: Appointment[];
  now: Date;
  ignoreAppointmentId?: string;
}): boolean {
  return getAvailableSlots(args).some((slot) => slot.time === args.time && slot.available);
}

/* ------------------------------------------------------------------ */
/* Demo appointments                                                   */
/* ------------------------------------------------------------------ */

function at(base: Date, offsetDays: number, hours: number, minutes: number): Date {
  const date = addDays(base, offsetDays);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Eight records: 2 upcoming, 5 completed and 1 cancelled — matching the
 * approved reference counts. Dates are relative to the patient's current day
 * so upcoming records never become stale.
 */
export function buildAppointments(now: Date): Appointment[] {
  const base = startOfDay(now);
  const year = now.getFullYear();

  return [
    {
      id: "apt-1042",
      reference: `APT-${year}-1042`,
      doctorId: "d1",
      startsAt: at(base, 1, 10, 0),
      durationMinutes: 30,
      consultationType: "In-Person",
      status: "Upcoming",
      reason: "Routine cardiac follow-up",
      notes: "Please review my latest lab results during the visit.",
    },
    {
      id: "apt-1038",
      reference: `APT-${year}-1038`,
      doctorId: "d2",
      startsAt: at(base, 3, 11, 30),
      durationMinutes: 30,
      consultationType: "Online",
      status: "Upcoming",
      reason: "Blood pressure medication review",
    },
    {
      id: "apt-1011",
      reference: `APT-${year}-1011`,
      doctorId: "d3",
      startsAt: at(base, -5, 9, 0),
      durationMinutes: 30,
      consultationType: "In-Person",
      status: "Completed",
      reason: "Palpitation assessment",
    },
    {
      id: "apt-0987",
      reference: `APT-${year}-0987`,
      doctorId: "d4",
      startsAt: at(base, -10, 13, 30),
      durationMinutes: 30,
      consultationType: "In-Person",
      status: "Cancelled",
      reason: "Knee pain consultation",
      cancellationReason: "Schedule conflict",
    },
    {
      id: "apt-0964",
      reference: `APT-${year}-0964`,
      doctorId: "d1",
      startsAt: at(base, -18, 10, 0),
      durationMinutes: 30,
      consultationType: "In-Person",
      status: "Completed",
      reason: "Blood pressure review",
    },
    {
      id: "apt-0921",
      reference: `APT-${year}-0921`,
      doctorId: "d5",
      startsAt: at(base, -25, 15, 0),
      durationMinutes: 30,
      consultationType: "Online",
      status: "Completed",
      reason: "Recurring headache follow-up",
    },
    {
      id: "apt-0876",
      reference: `APT-${year}-0876`,
      doctorId: "d3",
      startsAt: at(base, -40, 11, 0),
      durationMinutes: 30,
      consultationType: "In-Person",
      status: "Completed",
      reason: "Annual cardiac check",
    },
    {
      id: "apt-0812",
      reference: `APT-${year}-0812`,
      doctorId: "d6",
      startsAt: at(base, -60, 9, 30),
      durationMinutes: 30,
      consultationType: "In-Person",
      status: "Completed",
      reason: "Child wellness visit",
    },
  ];
}

export function nextReference(appointments: Appointment[], now: Date): string {
  const year = now.getFullYear();
  const highest = appointments.reduce((max, appointment) => {
    const match = appointment.reference.match(/(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Math.max(max, value);
  }, 1042);
  return `APT-${year}-${highest + 1}`;
}

/* ------------------------------------------------------------------ */
/* Shared content                                                      */
/* ------------------------------------------------------------------ */

export const CANCEL_REASONS = [
  "Schedule conflict",
  "Feeling better",
  "Found another provider",
  "Financial reasons",
  "Other",
] as const;

export const REASONS_FOR_VISIT = [
  "Routine check-up",
  "Follow-up visit",
  "New symptom or concern",
  "Second opinion",
  "Other",
] as const;

export const PREPARATION_TIPS: Record<ConsultationType, string[]> = {
  "In-Person": [
    "Arrive 10 minutes early",
    "Bring your ID and insurance card",
    "List your current medications",
    "Write down any questions",
  ],
  Online: [
    "Test your camera and microphone",
    "Use a quiet, private space",
    "Keep your medication list nearby",
    "Write down any questions",
  ],
};

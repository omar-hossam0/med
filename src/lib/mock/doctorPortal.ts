/**
 * Typed demo fixtures for the Doctor Portal — Overview.
 *
 * Frontend-only phase: nothing here is persisted. The doctor portal has no
 * backend endpoints yet, so every count on the dashboard is derived from these
 * arrays rather than hardcoded, which keeps the summary cards, the status chart
 * and the schedule list telling the same story.
 *
 * Status vocabulary is doctor-specific and richer than the patient booking
 * statuses (`Upcoming | Completed | Cancelled`): a clinic day also has patients
 * physically waiting, checked in, and in consultation.
 */

export type DoctorAppointmentStatus =
  | "Upcoming"
  | "Waiting"
  | "Arrived"
  | "In Progress"
  | "Completed"
  | "Cancelled";

export type PortalPatient = {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: "Male" | "Female";
  email: string;
  phone: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  recentNote?: { text: string; date: string };
  previousVisits: { id: string; date: string; title: string }[];
  recentLabs: { id: string; date: string; name: string; status: "Normal" | "High" | "Low" }[];
};

export type PortalAppointment = {
  id: string;
  patientId: string;
  /** "HH:MM" 24h, clinic local time. */
  time: string;
  durationMinutes: number;
  reason: string;
  location: string;
  status: DoctorAppointmentStatus;
};

export type PendingTask = {
  id: string;
  label: string;
  count: number;
  tone: "mint" | "amber" | "blue";
};

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export const portalPatients: PortalPatient[] = [
  {
    id: "pt-omar",
    mrn: "1045872",
    name: "Omar Hassan",
    age: 45,
    gender: "Male",
    email: "omar.hassan@mail.com",
    phone: "+20 100 456 7890",
    allergies: ["Penicillin"],
    conditions: ["Hypertension"],
    medications: ["Amlodipine 5 mg daily"],
    recentNote: {
      text: "BP improving, continue current medication. Advised lifestyle modification and follow up in 4 weeks.",
      date: "2026-10-20",
    },
    previousVisits: [
      { id: "v-1", date: "2026-10-20", title: "Follow-up (Hypertension)" },
      { id: "v-2", date: "2026-09-15", title: "BP Review & Medication Adjustment" },
    ],
    recentLabs: [
      { id: "lab-cbc", date: "2026-10-18", name: "CBC", status: "Normal" },
      { id: "lab-lipid", date: "2026-10-18", name: "Lipid Profile", status: "High" },
    ],
  },
  {
    id: "pt-salma",
    mrn: "1038219",
    name: "Salma Khaled",
    age: 38,
    gender: "Female",
    email: "salma.khaled@mail.com",
    phone: "+20 101 223 4455",
    allergies: [],
    conditions: ["Migraine"],
    medications: ["Sumatriptan 50 mg as needed"],
    recentNote: {
      text: "Reported intermittent chest tightness during exertion. ECG requested before the next visit.",
      date: "2026-10-18",
    },
    previousVisits: [{ id: "v-3", date: "2026-10-18", title: "Chest Pain Evaluation" }],
    recentLabs: [{ id: "lab-tsh", date: "2026-10-18", name: "Thyroid Function (TSH)", status: "Normal" }],
  },
  {
    id: "pt-youssef",
    mrn: "1022644",
    name: "Youssef Ali",
    age: 52,
    gender: "Male",
    email: "youssef.ali@mail.com",
    phone: "+20 102 998 1122",
    allergies: ["Sulfa drugs"],
    conditions: ["Type 2 Diabetes"],
    medications: ["Metformin 500 mg twice daily"],
    recentNote: {
      text: "HbA1c stable. Continue current dose; repeat blood work in three months.",
      date: "2026-10-16",
    },
    previousVisits: [{ id: "v-4", date: "2026-10-16", title: "Routine Check-up" }],
    recentLabs: [{ id: "lab-lft", date: "2026-10-16", name: "Liver Function Test (LFT)", status: "Normal" }],
  },
  {
    id: "pt-mona",
    mrn: "1051330",
    name: "Mona Ibrahim",
    age: 47,
    gender: "Female",
    email: "mona.ibrahim@mail.com",
    phone: "+20 106 334 7788",
    allergies: [],
    conditions: ["Arrhythmia"],
    medications: ["Bisoprolol 2.5 mg daily"],
    previousVisits: [{ id: "v-5", date: "2026-09-30", title: "ECG Review" }],
    recentLabs: [],
  },
  {
    id: "pt-karim",
    mrn: "1019902",
    name: "Karim Nabil",
    age: 61,
    gender: "Male",
    email: "karim.nabil@mail.com",
    phone: "+20 109 552 3311",
    allergies: [],
    conditions: ["Hyperlipidaemia"],
    medications: ["Atorvastatin 20 mg nightly"],
    previousVisits: [{ id: "v-6", date: "2026-08-21", title: "Lipid Review" }],
    recentLabs: [],
  },
  {
    id: "pt-nadia",
    mrn: "1062218",
    name: "Nadia Fahmy",
    age: 34,
    gender: "Female",
    email: "nadia.fahmy@mail.com",
    phone: "+20 111 220 9944",
    allergies: ["Latex"],
    conditions: [],
    medications: [],
    previousVisits: [{ id: "v-7", date: "2026-07-11", title: "General Consultation" }],
    recentLabs: [],
  },
  {
    id: "pt-tarek",
    mrn: "1044471",
    name: "Tarek Samir",
    age: 58,
    gender: "Male",
    email: "tarek.samir@mail.com",
    phone: "+20 115 667 2233",
    allergies: [],
    conditions: ["Hypertension", "Chronic Kidney Disease"],
    medications: ["Losartan 50 mg daily"],
    previousVisits: [{ id: "v-8", date: "2026-09-02", title: "Renal Function Review" }],
    recentLabs: [],
  },
  {
    id: "pt-huda",
    mrn: "1037755",
    name: "Huda Adel",
    age: 29,
    gender: "Female",
    email: "huda.adel@mail.com",
    phone: "+20 128 441 6677",
    allergies: [],
    conditions: [],
    medications: [],
    previousVisits: [{ id: "v-9", date: "2026-06-19", title: "Annual Check-up" }],
    recentLabs: [],
  },
  {
    id: "pt-rami",
    mrn: "1058814",
    name: "Rami Fouad",
    age: 41,
    gender: "Male",
    email: "rami.fouad@mail.com",
    phone: "+20 122 310 5588",
    allergies: [],
    conditions: ["Asthma"],
    medications: ["Salbutamol inhaler as needed"],
    previousVisits: [{ id: "v-10", date: "2026-05-08", title: "Respiratory Review" }],
    recentLabs: [],
  },
  {
    id: "pt-dina",
    mrn: "1060123",
    name: "Dina Youssef",
    age: 36,
    gender: "Female",
    email: "dina.youssef@mail.com",
    phone: "+20 100 771 2299",
    allergies: [],
    conditions: ["Iron-deficiency anaemia"],
    medications: ["Ferrous sulfate 200 mg daily"],
    previousVisits: [{ id: "v-11", date: "2026-04-27", title: "Anaemia Follow-up" }],
    recentLabs: [],
  },
];

export function getPortalPatient(id?: string | null): PortalPatient | undefined {
  if (!id) return undefined;
  return portalPatients.find((patient) => patient.id === id);
}

/* ------------------------------------------------------------------ */
/* Today's appointments                                                */
/* ------------------------------------------------------------------ */

const CLINIC_LOCATION = "Medora Clinic — Room 304";

export const portalAppointments: PortalAppointment[] = [
  {
    id: "apt-01",
    patientId: "pt-karim",
    time: "09:00",
    durationMinutes: 30,
    reason: "Lipid review",
    location: CLINIC_LOCATION,
    status: "Completed",
  },
  {
    id: "apt-02",
    patientId: "pt-nadia",
    time: "09:30",
    durationMinutes: 30,
    reason: "General consultation",
    location: CLINIC_LOCATION,
    status: "Completed",
  },
  {
    id: "apt-03",
    patientId: "pt-omar",
    time: "10:00",
    durationMinutes: 30,
    reason: "Follow-up (Hypertension) — review BP control and medication adjustment",
    location: CLINIC_LOCATION,
    status: "Waiting",
  },
  {
    id: "apt-04",
    patientId: "pt-salma",
    time: "10:30",
    durationMinutes: 30,
    reason: "Chest Pain Evaluation",
    location: CLINIC_LOCATION,
    status: "Arrived",
  },
  {
    id: "apt-05",
    patientId: "pt-youssef",
    time: "11:00",
    durationMinutes: 30,
    reason: "Routine Check-up",
    location: CLINIC_LOCATION,
    status: "Upcoming",
  },
  {
    id: "apt-06",
    patientId: "pt-mona",
    time: "11:30",
    durationMinutes: 30,
    reason: "ECG Review",
    location: CLINIC_LOCATION,
    status: "Upcoming",
  },
  {
    id: "apt-07",
    patientId: "pt-tarek",
    time: "12:00",
    durationMinutes: 30,
    reason: "Renal function review",
    location: CLINIC_LOCATION,
    status: "Waiting",
  },
  {
    id: "apt-08",
    patientId: "pt-huda",
    time: "12:30",
    durationMinutes: 30,
    reason: "Annual check-up",
    location: CLINIC_LOCATION,
    status: "Upcoming",
  },
  {
    id: "apt-09",
    patientId: "pt-rami",
    time: "14:00",
    durationMinutes: 30,
    reason: "Respiratory review",
    location: CLINIC_LOCATION,
    status: "Upcoming",
  },
  {
    id: "apt-10",
    patientId: "pt-dina",
    time: "15:00",
    durationMinutes: 30,
    reason: "Anaemia follow-up",
    location: CLINIC_LOCATION,
    status: "In Progress",
  },
];

/* ------------------------------------------------------------------ */
/* Derived dashboard numbers                                           */
/* ------------------------------------------------------------------ */

/** Patients physically in the clinic: checked in or waiting to be seen. */
const WAITING_STATUSES: DoctorAppointmentStatus[] = ["Waiting", "Arrived"];

export type DoctorOverviewCounts = {
  todaysAppointments: number;
  waitingPatients: number;
  pendingReports: number;
  followUps: number;
};

/** Reports awaiting this doctor's review. Also the "Reports awaiting approval" alert. */
export const PENDING_REPORTS = 7;
/** Follow-ups recommended by this doctor and due this week. */
export const FOLLOW_UPS_DUE = 12;
/** Lab results flagged for clinician review. */
export const LABS_AWAITING_REVIEW = 2;

export function getDoctorOverviewCounts(
  appointments: PortalAppointment[] = portalAppointments,
): DoctorOverviewCounts {
  return {
    todaysAppointments: appointments.length,
    waitingPatients: appointments.filter((appointment) =>
      WAITING_STATUSES.includes(appointment.status),
    ).length,
    pendingReports: PENDING_REPORTS,
    followUps: FOLLOW_UPS_DUE,
  };
}

export type StatusSlice = {
  status: DoctorAppointmentStatus;
  count: number;
  percent: number;
  color: string;
  dot: string;
};

const STATUS_ORDER: DoctorAppointmentStatus[] = [
  "Completed",
  "In Progress",
  "Waiting",
  "Arrived",
  "Upcoming",
  "Cancelled",
];

const STATUS_COLORS: Record<DoctorAppointmentStatus, { color: string; dot: string }> = {
  Completed: { color: "#0A9189", dot: "bg-[#0A9189]" },
  "In Progress": { color: "#3B6EF6", dot: "bg-[#3B6EF6]" },
  Waiting: { color: "#E0A106", dot: "bg-[#E0A106]" },
  Arrived: { color: "#8B5CF6", dot: "bg-[#8B5CF6]" },
  Upcoming: { color: "#C3CFDA", dot: "bg-[#C3CFDA]" },
  Cancelled: { color: "#E5484D", dot: "bg-[#E5484D]" },
};

/**
 * Distribution used by the donut and its legend. Slices always sum to the same
 * total the summary card shows.
 */
export function getStatusBreakdown(
  appointments: PortalAppointment[] = portalAppointments,
): StatusSlice[] {
  const total = appointments.length || 1;

  return STATUS_ORDER.map((status) => {
    const count = appointments.filter((appointment) => appointment.status === status).length;
    return {
      status,
      count,
      percent: Math.round((count / total) * 100),
      color: STATUS_COLORS[status].color,
      dot: STATUS_COLORS[status].dot,
    };
  }).filter((slice) => slice.count > 0);
}

/** The next few appointments to show in the compact schedule list. */
export function getSchedulePreview(limit = 4): PortalAppointment[] {
  return [...portalAppointments]
    .filter((appointment) => appointment.status !== "Completed" && appointment.status !== "Cancelled")
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, limit);
}

export const recentPatientIds = ["pt-omar", "pt-salma", "pt-youssef"];

export const recentPatientLastVisit: Record<string, string> = {
  "pt-omar": "2026-10-20",
  "pt-salma": "2026-10-18",
  "pt-youssef": "2026-10-16",
};

export const pendingTasks: PendingTask[] = [
  { id: "task-labs", label: "Lab results awaiting review", count: LABS_AWAITING_REVIEW, tone: "mint" },
  { id: "task-reports", label: "Reports awaiting approval", count: PENDING_REPORTS, tone: "amber" },
];

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatPortalDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1]} ${String(day).padStart(2, "0")}, ${year}`;
}

export function formatClock(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** Statuses that may start a consultation. */
export const CONSULTATION_ELIGIBLE: DoctorAppointmentStatus[] = [
  "Waiting",
  "Arrived",
  "Upcoming",
  "In Progress",
];

export function isConsultationEligible(appointment: PortalAppointment): boolean {
  return CONSULTATION_ELIGIBLE.includes(appointment.status);
}

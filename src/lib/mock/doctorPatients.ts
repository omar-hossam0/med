/**
 * Doctor Portal — Patients module fixtures.
 *
 * Frontend-only phase: nothing here is persisted.
 *
 * Identity (name, MRN, age, gender, allergies, conditions, medications, notes,
 * visits, labs) always comes from `portalPatients`, so the Overview, My Schedule
 * and Patients module can never disagree about the same person. This file only
 * adds the extra depth the Patients module needs — date of birth, address,
 * structured medications, documents, follow-up dates — keyed by the same ids.
 */

import { portalAppointments, portalPatients, type PortalPatient } from "./doctorPortal";
import { todayISO } from "./doctorSchedule";

/** The doctor this demo portal is signed in as. */
export const DOCTOR_NAME = "Dr. Sarah Ahmed";
export const CLINIC_LOCATION = "Medora Clinic — Room 304";

export type ConditionGroup = "Hypertension" | "Diabetes" | "Heart Disease" | "Other";

export type PatientVisit = {
  id: string;
  date: string;
  title: string;
  note?: string;
  doctor: string;
  location: string;
  status: "Completed" | "Cancelled";
};

export type PatientLab = {
  id: string;
  date: string;
  name: string;
  status: "Normal" | "High" | "Low";
  value?: string;
  reference?: string;
};

export type PatientMedication = {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  started: string;
  status: "Active" | "Stopped";
};

export type PatientDocument = {
  id: string;
  title: string;
  type: "Lab report" | "Imaging" | "Referral" | "Consent" | "Visit summary";
  date: string;
};

export type PatientNote = {
  id: string;
  date: string;
  author: string;
  text: string;
};

export type PatientRecord = {
  patient: PortalPatient;
  dateOfBirth: string;
  address: string;
  /** Grouping used by the Primary Condition filter. `null` = none recorded. */
  conditionGroup: ConditionGroup | null;
  /** What the table shows in "Primary Condition". */
  primaryCondition: string | null;
  firstVisit: string | null;
  lastVisit: string | null;
  /** Next scheduled review, when one exists. */
  followUpDue: string | null;
  visits: PatientVisit[];
  labs: PatientLab[];
  medications: PatientMedication[];
  documents: PatientDocument[];
  notes: PatientNote[];
};

/* ------------------------------------------------------------------ */
/* Per-patient detail                                                  */
/* ------------------------------------------------------------------ */

type Detail = {
  dob: string;
  address: string;
  group: ConditionGroup | null;
  followUpDue?: string;
  /** Extra clinician note beyond the one carried by `portalPatients`. */
  extraNotes?: { date: string; text: string };
  documents?: { title: string; type: PatientDocument["type"]; date: string }[];
};

const DETAILS: Record<string, Detail> = {
  "pt-omar": {
    dob: "1981-03-15",
    address: "Cairo, Egypt",
    group: "Hypertension",
    followUpDue: "2026-11-18",
    documents: [
      { title: "ECG report", type: "Imaging", date: "2026-10-18" },
      { title: "Visit summary — BP review", type: "Visit summary", date: "2026-10-20" },
    ],
  },
  "pt-salma": {
    dob: "1988-07-02",
    address: "Giza, Egypt",
    group: "Other",
    followUpDue: "2026-11-20",
    extraNotes: {
      date: "2026-10-18",
      text: "Exertional chest tightness for two weeks. ECG and troponin requested; advised to return immediately if pain occurs at rest.",
    },
    documents: [{ title: "ECG request form", type: "Referral", date: "2026-10-18" }],
  },
  "pt-youssef": {
    dob: "1974-01-22",
    address: "Cairo, Egypt",
    group: "Diabetes",
    followUpDue: "2026-12-02",
    documents: [{ title: "Diabetic review summary", type: "Visit summary", date: "2026-10-16" }],
  },
  "pt-mona": {
    dob: "1979-05-09",
    address: "Alexandria, Egypt",
    group: "Heart Disease",
    followUpDue: "2026-12-10",
    extraNotes: {
      date: "2026-09-30",
      text: "Paroxysmal palpitations, rate controlled on bisoprolol. Holter monitoring advised if symptoms persist.",
    },
    documents: [{ title: "Holter monitoring report", type: "Imaging", date: "2026-09-30" }],
  },
  "pt-karim": {
    dob: "1965-02-18",
    address: "Cairo, Egypt",
    group: "Other",
    documents: [{ title: "Lipid panel — historic", type: "Lab report", date: "2026-08-21" }],
  },
  "pt-nadia": {
    dob: "1992-09-30",
    address: "Cairo, Egypt",
    group: null,
    documents: [{ title: "General consultation summary", type: "Visit summary", date: "2026-07-11" }],
  },
  "pt-tarek": {
    dob: "1968-11-05",
    address: "Giza, Egypt",
    group: "Hypertension",
    followUpDue: "2026-11-25",
    extraNotes: {
      date: "2026-09-02",
      text: "Renal function stable on losartan. Repeat creatinine and electrolytes in six weeks.",
    },
    documents: [{ title: "Renal ultrasound", type: "Imaging", date: "2026-09-02" }],
  },
  "pt-huda": {
    dob: "1997-04-12",
    address: "Cairo, Egypt",
    group: null,
  },
  "pt-rami": {
    dob: "1985-06-25",
    address: "Mansoura, Egypt",
    group: "Other",
    extraNotes: {
      date: "2026-05-08",
      text: "Well controlled asthma, no night-time symptoms. Inhaler technique reviewed.",
    },
  },
  "pt-dina": {
    dob: "1990-08-14",
    address: "Cairo, Egypt",
    group: "Other",
    documents: [{ title: "CBC — historic", type: "Lab report", date: "2026-04-27" }],
  },
};

/** Reference ranges used by the lab table. Keyed by lab name. */
const LAB_REFERENCE: Record<string, { value: string; reference: string }> = {
  CBC: { value: "Hb 13.8 g/dL", reference: "13.0 – 17.0 g/dL" },
  "Lipid Profile": { value: "LDL 168 mg/dL", reference: "< 130 mg/dL" },
  "Thyroid Function (TSH)": { value: "2.1 mIU/L", reference: "0.4 – 4.0 mIU/L" },
  "Liver Function Test (LFT)": { value: "ALT 28 U/L", reference: "7 – 56 U/L" },
};

/* ------------------------------------------------------------------ */
/* Derivations                                                         */
/* ------------------------------------------------------------------ */

function parseMedication(text: string, started: string, index: number): PatientMedication {
  // "Amlodipine 5 mg daily" → name / dose / frequency. The dose is two tokens
  // ("5" + "mg"), so it has to be matched against the whole string.
  const match = text.trim().match(/^(.+?)\s+(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|IU))\b\s*(.*)$/i);

  if (match) {
    return {
      id: `med-${index}`,
      name: match[1],
      dose: match[2],
      frequency: match[3].trim() || "As directed",
      started,
      status: "Active",
    };
  }

  const asNeeded = /as needed$/i.test(text);
  return {
    id: `med-${index}`,
    name: asNeeded ? text.replace(/\s*as needed$/i, "") : text,
    dose: "—",
    frequency: asNeeded ? "as needed" : "As directed",
    started,
    status: "Active",
  };
}

function buildRecord(patient: PortalPatient): PatientRecord {
  const detail: Detail = DETAILS[patient.id] ?? {
    dob: "",
    address: "—",
    group: null,
  };

  const sortedVisits = [...patient.previousVisits].sort((a, b) => b.date.localeCompare(a.date));
  const firstVisit = sortedVisits.length > 0 ? sortedVisits[sortedVisits.length - 1].date : null;
  const latestVisit = sortedVisits[0]?.date ?? null;

  // A completed or in-progress appointment today counts as a visit today.
  const todays = portalAppointments.filter(
    (appointment) =>
      appointment.patientId === patient.id &&
      (appointment.status === "Completed" || appointment.status === "In Progress"),
  );
  const today = todayISO();
  const lastVisit =
    todays.length > 0 ? today : latestVisit;

  const visits: PatientVisit[] = sortedVisits.map((visit, index) => ({
    id: visit.id,
    date: visit.date,
    title: visit.title,
    note:
      index === 0 && patient.recentNote && patient.recentNote.date === visit.date
        ? patient.recentNote.text
        : detail.extraNotes?.date === visit.date
          ? detail.extraNotes.text
          : undefined,
    doctor: DOCTOR_NAME,
    location: CLINIC_LOCATION,
    status: "Completed",
  }));

  for (const appointment of todays) {
    if (visits.some((visit) => visit.date === today)) continue;
    visits.unshift({
      id: `visit-${appointment.id}`,
      date: today,
      title: appointment.reason,
      note: appointment.status === "In Progress" ? "Consultation in progress." : undefined,
      doctor: DOCTOR_NAME,
      location: appointment.location,
      status: "Completed",
    });
  }

  const labs: PatientLab[] = [...patient.recentLabs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((lab) => ({
      id: lab.id,
      date: lab.date,
      name: lab.name,
      status: lab.status,
      value: LAB_REFERENCE[lab.name]?.value,
      reference: LAB_REFERENCE[lab.name]?.reference,
    }));

  const medications = patient.medications.map((medication, index) =>
    parseMedication(medication, firstVisit ?? today, index),
  );

  const documents: PatientDocument[] = [
    ...(detail.documents ?? []).map((document, index) => ({
      id: `doc-${patient.id}-${index}`,
      title: document.title,
      type: document.type,
      date: document.date,
    })),
    ...labs
      .filter((lab) => lab.status !== "Normal")
      .map((lab, index) => ({
        id: `doc-lab-${patient.id}-${index}`,
        title: `${lab.name} report`,
        type: "Lab report" as const,
        date: lab.date,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const notes: PatientNote[] = [];
  if (patient.recentNote) {
    notes.push({
      id: `note-${patient.id}-0`,
      date: patient.recentNote.date,
      author: DOCTOR_NAME,
      text: patient.recentNote.text,
    });
  }
  if (detail.extraNotes && detail.extraNotes.date !== patient.recentNote?.date) {
    notes.push({
      id: `note-${patient.id}-1`,
      date: detail.extraNotes.date,
      author: DOCTOR_NAME,
      text: detail.extraNotes.text,
    });
  }
  notes.sort((a, b) => b.date.localeCompare(a.date));

  return {
    patient,
    dateOfBirth: detail.dob,
    address: detail.address,
    conditionGroup: detail.group,
    primaryCondition: patient.conditions[0] ?? null,
    firstVisit,
    lastVisit,
    followUpDue: detail.followUpDue ?? null,
    visits,
    labs,
    medications,
    documents,
    notes,
  };
}

export const patientRecords: PatientRecord[] = portalPatients.map(buildRecord);

export function getPatientRecord(id?: string | null): PatientRecord | undefined {
  if (!id) return undefined;
  return patientRecords.find((record) => record.patient.id === id);
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export const CONDITION_GROUPS: ConditionGroup[] = [
  "Hypertension",
  "Diabetes",
  "Heart Disease",
  "Other",
];

export const AGE_MIN = 18;
export const AGE_MAX = 80;

export type PatientFilters = {
  conditions: ConditionGroup[];
  ageMin: number;
  ageMax: number;
  gender: "All" | "Male" | "Female";
};

export const EMPTY_PATIENT_FILTERS: PatientFilters = {
  conditions: [],
  ageMin: AGE_MIN,
  ageMax: AGE_MAX,
  gender: "All",
};

export function patientFilterCount(filters: PatientFilters): number {
  return (
    filters.conditions.length +
    (filters.ageMin !== AGE_MIN || filters.ageMax !== AGE_MAX ? 1 : 0) +
    (filters.gender !== "All" ? 1 : 0)
  );
}

export function matchesFilters(record: PatientRecord, filters: PatientFilters): boolean {
  if (filters.conditions.length > 0) {
    if (!record.conditionGroup || !filters.conditions.includes(record.conditionGroup)) return false;
  }
  if (record.patient.age < filters.ageMin || record.patient.age > filters.ageMax) return false;
  if (filters.gender !== "All" && record.patient.gender !== filters.gender) return false;
  return true;
}

export function matchesSearch(record: PatientRecord, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const { patient } = record;
  return (
    patient.name.toLowerCase().includes(term) ||
    patient.mrn.toLowerCase().includes(term) ||
    patient.phone.toLowerCase().includes(term) ||
    (record.primaryCondition ?? "").toLowerCase().includes(term)
  );
}

/* ------------------------------------------------------------------ */
/* Summary statistics — always derived from the records                */
/* ------------------------------------------------------------------ */

export type PatientStats = {
  total: number;
  seenThisWeek: number;
  followUps: number;
  newPatients: number;
};

function daysBetween(fromISO: string, toISODate: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISODate.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

export function getPatientStats(records: PatientRecord[] = patientRecords): PatientStats {
  const today = todayISO();

  const seenIds = new Set(
    portalAppointments
      .filter(
        (appointment) =>
          appointment.status === "Completed" || appointment.status === "In Progress",
      )
      .map((appointment) => appointment.patientId),
  );

  return {
    total: records.length,
    // Consultations completed or in progress — not merely booked.
    seenThisWeek: records.filter((record) => seenIds.has(record.patient.id)).length,
    followUps: records.filter((record) => record.followUpDue !== null).length,
    newPatients: records.filter(
      (record) => record.firstVisit !== null && daysBetween(record.firstVisit, today) <= 30,
    ).length,
  };
}

/** Patients the doctor can start a consultation with right now. */
export function eligibleAppointmentFor(patientId: string) {
  return portalAppointments.find(
    (appointment) =>
      appointment.patientId === patientId &&
      ["Waiting", "Arrived", "Upcoming", "In Progress"].includes(appointment.status),
  );
}

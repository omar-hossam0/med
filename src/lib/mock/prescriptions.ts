/**
 * Typed demo data for the Patient Prescriptions module.
 *
 * Frontend-only phase: nothing here is written to PostgreSQL. Every record is
 * derived from, or consistent with, the fixtures in `medicalRecords.ts`:
 *
 *   - doctors and facilities come from `getMedicalDoctor`, never duplicated
 *   - `rx-vitd`, `rx-omega` and `rx-amox` are the SAME records that
 *     `medicalRecords.prescriptions` exposes in the Medical Records tab, with
 *     the same id, doctor, date and status. That file stays the flat
 *     one-medication projection used by the existing records screens; this file
 *     is the prescription-level view with its medications grouped underneath.
 *   - `relatedVisitId` points at real visit ids from `medicalRecords.visits`.
 *
 * Medication status, refill counts and schedule times are recorded data, not
 * values inferred from dates. Nothing here authorises a patient to change a
 * clinician-authored dose.
 */

import {
  DEMO_TODAY,
  getMedicalDoctor,
  isWithinRange,
  type MedicalDoctor,
} from "./medicalRecords";

export type MedicationStatus = "Active" | "Completed" | "Expired";
export type PrescriptionStatus = "Active" | "Completed" | "Expired";

export type Medication = {
  id: string;
  prescriptionId: string;
  name: string;
  /** Clinician-authored dose, e.g. "One tablet (5000 IU)". Read-only. */
  dosage: string;
  strength: string;
  frequency: string;
  /** Recorded administration times for one day, 24h "HH:MM". */
  times: string[];
  duration: string;
  startDate: string;
  endDate: string;
  status: MedicationStatus;
  instructions: string[];
  /** Recorded refills left. <= 1 while active is what the UI calls "refill soon". */
  refillsRemaining: number;
  /** True only for medications the patient entered themselves. */
  selfReported?: boolean;
};

export type PrescriptionRecord = {
  id: string;
  title: string;
  doctorId: string;
  date: string;
  status: PrescriptionStatus;
  relatedVisitId?: string;
  instructions: string[];
  notes?: string;
  /** Attached documents. Empty when no file has been uploaded for this record. */
  fileIds: string[];
};

/* ------------------------------------------------------------------ */
/* Prescriptions                                                       */
/* ------------------------------------------------------------------ */

export const prescriptionRecords: PrescriptionRecord[] = [
  {
    id: "rx-omega",
    title: "General Health Prescription",
    doctorId: "d-sarah",
    date: "2026-10-20",
    status: "Active",
    relatedVisitId: "v-general",
    notes: "Continue alongside a balanced diet. Repeat blood work in six months.",
    instructions: [
      "Take one Omega-3 capsule daily with food.",
      "Take Calcium twice daily, morning and evening.",
      "Continue alongside a balanced diet.",
      "Report any unusual bruising or bleeding.",
      "Contact your doctor if you experience any side effects.",
    ],
    fileIds: [],
  },
  {
    id: "rx-vitd",
    title: "Vitamin D Supplement",
    doctorId: "d-youssef",
    date: "2026-09-20",
    status: "Active",
    relatedVisitId: "v-followup",
    notes: "Recheck vitamin D levels after three months.",
    instructions: [
      "Take one tablet daily after meals.",
      "Continue for 3 months.",
      "Maintain adequate hydration.",
      "Recheck vitamin D levels after 3 months.",
      "Contact your doctor if you experience any side effects.",
    ],
    fileIds: [],
  },
  {
    id: "rx-bp",
    title: "Blood Pressure Medication",
    doctorId: "d-youssef",
    date: "2026-08-10",
    status: "Active",
    relatedVisitId: "v-cardio",
    notes: "Home blood pressure readings twice weekly. Bring the log to the next visit.",
    instructions: [
      "Take Lisinopril once daily in the evening.",
      "Take Aspirin once daily with the evening dose.",
      "Record home blood pressure readings twice weekly.",
      "Do not stop either medication without speaking to your doctor.",
    ],
    fileIds: [],
  },
  {
    id: "rx-derm",
    title: "Dermatology Follow-up Prescription",
    doctorId: "d-mona",
    date: "2026-07-02",
    status: "Expired",
    relatedVisitId: "v-derm",
    notes: "Short course. Do not restart without a new consultation.",
    instructions: [
      "Apply a thin layer to the affected area twice daily.",
      "Do not apply to broken skin.",
      "Stop and contact your doctor if irritation worsens.",
    ],
    fileIds: [],
  },
  {
    id: "rx-amox",
    title: "Skin Treatment Prescription",
    doctorId: "d-mona",
    date: "2026-06-05",
    status: "Completed",
    relatedVisitId: "v-derm",
    notes: "Full 7-day course completed.",
    instructions: [
      "Take one capsule every 8 hours with water.",
      "Complete the full 7-day course.",
      "Take with food if you experience stomach upset.",
    ],
    fileIds: [],
  },
  {
    id: "rx-emergency",
    title: "Emergency Visit Prescription",
    doctorId: "d-karim",
    date: "2026-05-18",
    status: "Completed",
    relatedVisitId: "v-emergency",
    notes: "Short course for pain and inflammation after the visit.",
    instructions: [
      "Take one tablet every 8 hours with food.",
      "Do not exceed three tablets in 24 hours.",
      "Stop if you develop stomach pain.",
    ],
    fileIds: [],
  },
  {
    id: "rx-respiratory",
    title: "Respiratory Infection Prescription",
    doctorId: "d-sarah",
    date: "2025-12-03",
    status: "Expired",
    notes: "Completed course from a previous season.",
    instructions: [
      "Take one tablet daily for five days.",
      "Complete the full course even if symptoms improve.",
      "Contact your doctor if fever returns.",
    ],
    fileIds: [],
  },
  {
    id: "rx-allergy",
    title: "Allergy Season Prescription",
    doctorId: "d-sarah",
    date: "2025-11-12",
    status: "Expired",
    notes: "Seasonal course. A new prescription is needed before restarting.",
    instructions: [
      "Take one tablet daily during the allergy season.",
      "Avoid taking a double dose if a dose is missed.",
      "Report drowsiness to your doctor.",
    ],
    fileIds: [],
  },
];

/* ------------------------------------------------------------------ */
/* Medications                                                         */
/* ------------------------------------------------------------------ */

export const medications: Medication[] = [
  {
    id: "med-omega3",
    prescriptionId: "rx-omega",
    name: "Omega-3 1000 mg",
    dosage: "One capsule (1000 mg)",
    strength: "1000 mg",
    frequency: "Once daily",
    times: ["13:00"],
    duration: "6 months",
    startDate: "2026-10-20",
    endDate: "2027-04-20",
    status: "Active",
    instructions: ["Take one capsule daily with food.", "Report any unusual bruising or bleeding."],
    refillsRemaining: 2,
  },
  {
    id: "med-calcium",
    prescriptionId: "rx-omega",
    name: "Calcium 600 mg",
    dosage: "One tablet (600 mg)",
    strength: "600 mg",
    frequency: "Twice daily",
    times: ["09:00", "21:00"],
    duration: "3 months",
    startDate: "2026-10-20",
    endDate: "2027-01-20",
    status: "Active",
    instructions: [
      "Take one tablet with breakfast and one with dinner.",
      "Take with water.",
      "Maintain a balanced diet and regular exercise.",
    ],
    refillsRemaining: 1,
  },
  {
    id: "med-vitd",
    prescriptionId: "rx-vitd",
    name: "Vitamin D 5000 IU",
    dosage: "One tablet (5000 IU)",
    strength: "5000 IU",
    frequency: "Once daily",
    times: ["09:00"],
    duration: "3 months",
    startDate: "2026-09-20",
    endDate: "2026-12-20",
    status: "Active",
    instructions: ["Take one tablet daily after meals.", "Maintain adequate hydration."],
    refillsRemaining: 2,
  },
  {
    id: "med-lisinopril",
    prescriptionId: "rx-bp",
    name: "Lisinopril 10 mg",
    dosage: "One tablet (10 mg)",
    strength: "10 mg",
    frequency: "Once daily",
    times: ["20:00"],
    duration: "6 months",
    startDate: "2026-08-10",
    endDate: "2027-02-10",
    status: "Active",
    instructions: ["Take one tablet in the evening.", "Record home blood pressure readings."],
    refillsRemaining: 1,
  },
  {
    id: "med-aspirin",
    prescriptionId: "rx-bp",
    name: "Aspirin 81 mg",
    dosage: "One tablet (81 mg)",
    strength: "81 mg",
    frequency: "Once daily",
    times: ["20:00"],
    duration: "6 months",
    startDate: "2026-08-10",
    endDate: "2027-02-10",
    status: "Active",
    instructions: ["Take one tablet with the evening dose.", "Report any unusual bleeding."],
    refillsRemaining: 3,
  },
  {
    id: "med-hydrocortisone",
    prescriptionId: "rx-derm",
    name: "Hydrocortisone 1% cream",
    dosage: "Thin layer",
    strength: "1%",
    frequency: "Twice daily",
    times: ["08:00", "20:00"],
    duration: "14 days",
    startDate: "2026-07-02",
    endDate: "2026-07-16",
    status: "Expired",
    instructions: ["Apply a thin layer to the affected area.", "Do not apply to broken skin."],
    refillsRemaining: 0,
  },
  {
    id: "med-amoxicillin",
    prescriptionId: "rx-amox",
    name: "Amoxicillin 500 mg",
    dosage: "One capsule (500 mg)",
    strength: "500 mg",
    frequency: "Three times daily",
    times: ["08:00", "16:00", "00:00"],
    duration: "7 days",
    startDate: "2026-06-05",
    endDate: "2026-06-12",
    status: "Completed",
    instructions: ["Complete the full 7-day course.", "Take with food if you experience stomach upset."],
    refillsRemaining: 0,
  },
  {
    id: "med-ibuprofen",
    prescriptionId: "rx-emergency",
    name: "Ibuprofen 400 mg",
    dosage: "One tablet (400 mg)",
    strength: "400 mg",
    frequency: "Three times daily",
    times: ["08:00", "16:00", "00:00"],
    duration: "5 days",
    startDate: "2026-05-18",
    endDate: "2026-05-23",
    status: "Completed",
    instructions: ["Take with food.", "Do not exceed three tablets in 24 hours."],
    refillsRemaining: 0,
  },
  {
    id: "med-azithromycin",
    prescriptionId: "rx-respiratory",
    name: "Azithromycin 250 mg",
    dosage: "One tablet (250 mg)",
    strength: "250 mg",
    frequency: "Once daily",
    times: ["10:00"],
    duration: "5 days",
    startDate: "2025-12-03",
    endDate: "2025-12-08",
    status: "Expired",
    instructions: ["Complete the full five-day course."],
    refillsRemaining: 0,
  },
  {
    id: "med-cetirizine",
    prescriptionId: "rx-allergy",
    name: "Cetirizine 10 mg",
    dosage: "One tablet (10 mg)",
    strength: "10 mg",
    frequency: "Once daily",
    times: ["22:00"],
    duration: "30 days",
    startDate: "2025-11-12",
    endDate: "2025-12-12",
    status: "Expired",
    instructions: ["Take one tablet daily during the allergy season."],
    refillsRemaining: 0,
  },
];

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function getPrescriptionRecord(id?: string | null): PrescriptionRecord | undefined {
  if (!id) return undefined;
  return prescriptionRecords.find((item) => item.id === id);
}

export function getMedication(id?: string | null): Medication | undefined {
  if (!id) return undefined;
  return medications.find((item) => item.id === id);
}

export function getPrescriptionMedications(prescriptionId: string): Medication[] {
  return medications.filter((item) => item.prescriptionId === prescriptionId);
}

/** Doctor, facility and specialty resolved from the shared doctor fixture. */
export function getPrescriptionMeta(prescription: PrescriptionRecord): {
  doctor?: MedicalDoctor;
  facility: string;
  specialty: string;
} {
  const doctor = getMedicalDoctor(prescription.doctorId);
  return {
    doctor,
    facility: doctor?.facility ?? "Medora Medical Center",
    specialty: doctor?.specialty ?? "General Medicine",
  };
}

/** Statuses that put a prescription in the History tab. */
export function isHistorical(prescription: PrescriptionRecord): boolean {
  return prescription.status !== "Active";
}

/**
 * "Refill soon" is a recorded-data rule: an active medication with at most one
 * refill left. It is never derived from the end date.
 */
export function needsRefillSoon(medication: Medication): boolean {
  // A self-reported medication has no prescription and no refill record, so it
  // can never be "refill soon".
  return (
    !medication.selfReported &&
    medication.status === "Active" &&
    medication.refillsRemaining <= 1
  );
}

export function getActiveMedications(list: Medication[] = medications): Medication[] {
  return list.filter((item) => item.status === "Active");
}

export function getRefillSoonMedications(list: Medication[] = medications): Medication[] {
  return list.filter(needsRefillSoon);
}

export type PrescriptionCounts = {
  activePrescriptions: number;
  totalPrescriptions: number;
  currentMedications: number;
  refillsSoon: number;
  allPrescriptions: number;
  myMedications: number;
  history: number;
};

/** Every headline number is derived from the dataset, never hardcoded. */
export function getPrescriptionCounts(
  prescriptions: PrescriptionRecord[] = prescriptionRecords,
  medicationList: Medication[] = medications,
): PrescriptionCounts {
  const ids = new Set(prescriptions.map((item) => item.id));
  const scoped = medicationList.filter((item) => ids.has(item.prescriptionId));

  return {
    activePrescriptions: prescriptions.filter((item) => item.status === "Active").length,
    totalPrescriptions: prescriptions.length,
    currentMedications: getActiveMedications(scoped).length,
    refillsSoon: getRefillSoonMedications(scoped).length,
    allPrescriptions: prescriptions.length,
    // The tab lists every medication the patient has, including self-reported
    // ones, so the badge counts the same set.
    myMedications: medicationList.length,
    history: prescriptions.filter(isHistorical).length,
  };
}

/* ------------------------------------------------------------------ */
/* Today's schedule                                                    */
/* ------------------------------------------------------------------ */

export type ScheduleSlot = {
  medication: Medication;
  time: string;
  /** 24h minutes, for sorting. */
  minutes: number;
};

/**
 * Today's medication times, built only from recorded `times` on active
 * medications. The demo fixtures describe a stable daily schedule, so the same
 * slots apply to every day; there is no adherence record anywhere in the
 * product, and the UI must not imply one.
 */
export function getTodaySchedule(
  medicationList: Medication[] = medications,
): ScheduleSlot[] {
  return getActiveMedications(medicationList)
    .flatMap((medication) =>
      medication.times.map((time) => {
        const [hours, minutes] = time.split(":").map(Number);
        return { medication, time, minutes: hours * 60 + minutes };
      }),
    )
    .sort((a, b) => a.minutes - b.minutes);
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

export type StatusFilter = "all" | PrescriptionStatus | MedicationStatus;
export type DateRangeFilter = "any" | "30" | "90" | "year";

export const STATUS_FILTER_LABEL: Record<string, string> = {
  all: "All Status",
  Active: "Active",
  Completed: "Completed",
  Expired: "Expired",
};

export function matchesDateRange(date: string, range: DateRangeFilter): boolean {
  return isWithinRange(date, range);
}

export function formatPrescriptionDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** Days between the demo "today" and an ISO date, used only for display copy. */
export function daysFromToday(iso: string): number {
  const today = new Date(`${DEMO_TODAY}T00:00:00Z`).getTime();
  const value = new Date(`${iso}T00:00:00Z`).getTime();
  return Math.round((value - today) / (24 * 60 * 60 * 1000));
}

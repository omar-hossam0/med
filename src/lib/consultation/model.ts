/**
 * Consultation Workspace — workflow model.
 *
 * Frontend-only phase. Every value here is demo data generated from the same
 * patient fixtures the rest of the Doctor Portal uses, so the workspace can
 * never invent a different person or condition. Nothing is persisted: the
 * provider keeps state in React memory for the browser session.
 *
 * The three reports mirror the product rules in AGENTS.md: Agent 1 drafts them
 * from the doctor-approved transcript, only Report 1 is patient-facing, and no
 * report reaches the patient until the doctor approves *and* publishes it.
 */

import { formatPortalDate, type PortalPatient } from "@/lib/mock/doctorPortal";
import { addDays, todayISO } from "@/lib/mock/doctorSchedule";

export type StepKey = "consent" | "recording" | "transcript" | "reports" | "record-updates" | "follow-up";

export const STEPS: { key: StepKey; label: string; short: string }[] = [
  { key: "consent", label: "Patient Consent", short: "Consent" },
  { key: "recording", label: "Recording", short: "Recording" },
  { key: "transcript", label: "Transcript", short: "Transcript" },
  { key: "reports", label: "Reports", short: "Reports" },
  { key: "record-updates", label: "Record Updates", short: "Updates" },
  { key: "follow-up", label: "Follow-up", short: "Follow-up" },
];

export type RecordingStatus = "idle" | "recording" | "paused" | "stopped" | "processing" | "failed";
export type TranscriptStatus = "draft" | "approved";
export type GenerationStatus = "idle" | "running" | "done" | "failed";
export type ReportStatus = "draft" | "approved" | "rejected" | "published";
export type ReportKey = "report1" | "report2" | "report3";
export type FollowUpStatus =
  | "none"
  | "recommended"
  | "accepted"
  | "proposed"
  | "confirmed"
  | "declined";

export type TranscriptEntry = {
  id: string;
  time: string;
  speaker: "Doctor" | "Patient";
  text: string;
  /** Terms the demo flags for a second look. Not verified AI detection. */
  highlights?: string[];
};

export type Report = {
  key: ReportKey;
  title: string;
  subtitle: string;
  body: string;
  status: ReportStatus;
  version: number;
  /** Doctor edited the draft. */
  edited: boolean;
};

export type ProposalCategory = "condition" | "medication" | "allergy" | "history" | "test";

export type RecordProposal = {
  id: string;
  category: ProposalCategory;
  action: "new" | "update";
  title: string;
  detail: string;
  current?: string;
  proposed?: string;
  source: string;
  conflict?: string;
  selected: boolean;
  applied: boolean;
};

export type AppointmentSlot = {
  id: string;
  date: string;
  time: string;
};

export type ConsentState = {
  audio: boolean;
  transcription: boolean;
  ai: boolean;
  /** The patient explicitly declined recording. */
  declined: boolean;
  recordedAt: string | null;
};

export type ConsultationState = {
  appointmentId: string;
  patientId: string;
  reason: string;
  startedAt: string | null;
  consent: ConsentState;
  recording: { status: RecordingStatus; seconds: number };
  transcript: { status: TranscriptStatus; version: number; entries: TranscriptEntry[]; dirty: boolean };
  generation: { status: GenerationStatus; progress: number; stage: number };
  reports: Record<ReportKey, Report>;
  recordUpdates: {
    proposals: RecordProposal[];
    status: "pending" | "applied" | "deferred";
    appliedAt: string | null;
  };
  followUp: {
    status: FollowUpStatus;
    weeks: number;
    reason: string;
    slots: AppointmentSlot[];
    selectedSlotId: string | null;
    sentAt: string | null;
  };
  notes: string;
  completed: boolean;
};

/* ------------------------------------------------------------------ */
/* Demo content                                                        */
/* ------------------------------------------------------------------ */

export function buildTranscript(patient: PortalPatient, reason: string): TranscriptEntry[] {
  const first = patient.name.split(" ")[0];
  const condition = patient.conditions[0]?.toLowerCase() ?? "your symptoms";
  const medication = patient.medications[0]?.split(" ")[0] ?? "your medication";

  return [
    {
      id: "t1",
      time: "00:00",
      speaker: "Doctor",
      text: `Good morning, ${first}. How have you been feeling since your last visit?`,
    },
    {
      id: "t2",
      time: "00:12",
      speaker: "Patient",
      text: `I've been feeling better overall, but my blood pressure is still sometimes high, especially at night.`,
      highlights: ["blood pressure"],
    },
    {
      id: "t3",
      time: "00:28",
      speaker: "Doctor",
      text: `Are you still taking ${medication} regularly?`,
    },
    {
      id: "t4",
      time: "00:35",
      speaker: "Patient",
      text: "Yes, once a day as prescribed.",
    },
    {
      id: "t5",
      time: "00:48",
      speaker: "Doctor",
      text: `Thanks. Given the readings, I'd like to adjust the dose for ${condition} and request some lab tests to check kidney function before the next review.`,
    },
  ];
}

function report1Body(patient: PortalPatient, reason: string) {
  const first = patient.name.split(" ")[0];
  return [
    `Summary of your visit on ${formatPortalDate(todayISO())}`,
    `You were seen today for ${reason.toLowerCase()}. Your blood pressure readings were reviewed and are improving, although they are still high at times, especially at night.`,
    "What we discussed",
    "• Your current medication is working, but the dose needs a small adjustment.",
    "• We agreed to check how your kidneys are working with a blood test before the next visit.",
    "• Continue measuring your blood pressure at home, ideally in the evening.",
    "Your next steps",
    "• Take the updated dose once daily, as written on your prescription.",
    "• Book the blood test at reception before you leave.",
    `• Book a follow-up appointment in about four weeks.`,
    `If you feel unwell before then, please contact the clinic.`,
    `— ${first}'s care team, Medora Clinic`,
  ].join("\n\n");
}

function report2Body(patient: PortalPatient, reason: string) {
  return [
    `PATIENT: ${patient.name} · MRN ${patient.mrn} · ${patient.age}y ${patient.gender}`,
    `VISIT REASON: ${reason}`,
    `CONDITIONS: ${patient.conditions.join(", ") || "None recorded"}`,
    `ALLERGIES: ${patient.allergies.join(", ") || "None recorded"}`,
    `CURRENT MEDICATIONS: ${patient.medications.join("; ") || "None recorded"}`,
    "OBSERVATIONS",
    "• Home BP readings elevated in the evening over the last two weeks.",
    "• Adherence confirmed: once daily dosing.",
    "PLAN",
    "• Increase current antihypertensive dose.",
    "• Order renal function test and electrolytes.",
    "• Review in four weeks with results.",
  ].join("\n");
}

function report3Body(patient: PortalPatient, reason: string) {
  return [
    `CLINICAL REPORT — ${formatPortalDate(todayISO())}`,
    `Patient: ${patient.name} (MRN ${patient.mrn}), ${patient.age} years, ${patient.gender}.`,
    `Reason for consultation: ${reason}.`,
    "History",
    `${patient.conditions[0] ?? "No chronic condition recorded"} under treatment. Reports intermittent evening blood-pressure elevation with good adherence to ${patient.medications[0] ?? "current therapy"}.`,
    "Assessment",
    "Sub-optimally controlled blood pressure with preserved functional status. No red-flag symptoms reported during this consultation.",
    "Plan",
    "1. Adjust antihypertensive dosing as documented in the prescription.",
    "2. Request renal function test and electrolytes.",
    "3. Clinical review in four weeks with laboratory results.",
    "Prepared with AI assistance from the doctor-approved transcript; reviewed and approved by the treating physician.",
  ].join("\n\n");
}

export function buildReports(patient: PortalPatient, reason: string): Record<ReportKey, Report> {
  return {
    report1: {
      key: "report1",
      title: "Report 1",
      subtitle: "Patient-friendly Summary",
      body: report1Body(patient, reason),
      status: "draft",
      version: 1,
      edited: false,
    },
    report2: {
      key: "report2",
      title: "Report 2",
      subtitle: "Structured Medical Profile",
      body: report2Body(patient, reason),
      status: "draft",
      version: 1,
      edited: false,
    },
    report3: {
      key: "report3",
      title: "Report 3",
      subtitle: "Medical Report",
      body: report3Body(patient, reason),
      status: "draft",
      version: 1,
      edited: false,
    },
  };
}

export function buildProposals(patient: PortalPatient): RecordProposal[] {
  const condition = patient.conditions[0] ?? "Essential hypertension";
  const medication = patient.medications[0] ?? "Amlodipine 5 mg daily";
  const dose = /(\d+(?:\.\d+)?\s?mg)/i.exec(medication)?.[1] ?? "5 mg";

  return [
    {
      id: "p1",
      category: "condition",
      action: "update",
      title: "Update Current Conditions",
      detail: `Add: ${condition} (severity noted as controlled with treatment)`,
      current: condition,
      proposed: `${condition} — controlled, evening BP elevation`,
      source: "Report 2 · v1",
      selected: true,
      applied: false,
    },
    {
      id: "p2",
      category: "medication",
      action: "update",
      title: "Update Medications",
      detail: `Modify: ${medication} → dose increased (once daily)`,
      current: medication,
      proposed: `${medication.replace(dose, dose.replace(/(\d+)/, (n) => String(Number(n) * 2)))} (once daily)`,
      source: "Report 2 · v1",
      selected: true,
      applied: false,
    },
    {
      id: "p3",
      category: "test",
      action: "new",
      title: "Add Test Orders",
      detail: "Add: Renal Function Test, Electrolytes",
      proposed: "Renal Function Test; Electrolytes",
      source: "Report 2 · v1",
      selected: true,
      applied: false,
    },
  ];
}

export function buildSlots(): AppointmentSlot[] {
  const today = todayISO();
  return [
    { id: "s1", date: addDays(today, 28), time: "10:00" },
    { id: "s2", date: addDays(today, 29), time: "14:30" },
    { id: "s3", date: addDays(today, 30), time: "11:00" },
  ];
}

export function initialState(
  appointmentId: string,
  patientId: string,
  reason: string,
): ConsultationState {
  return {
    appointmentId,
    patientId,
    reason,
    startedAt: null,
    consent: { audio: false, transcription: false, ai: false, declined: false, recordedAt: null },
    recording: { status: "idle", seconds: 0 },
    transcript: { status: "draft", version: 1, entries: [], dirty: false },
    generation: { status: "idle", progress: 0, stage: 0 },
    reports: {} as Record<ReportKey, Report>,
    recordUpdates: { proposals: [], status: "pending", appliedAt: null },
    followUp: {
      status: "none",
      weeks: 4,
      reason: "Routine follow-up and clinical evaluation",
      slots: [],
      selectedSlotId: null,
      sentAt: null,
    },
    notes: "",
    completed: false,
  };
}

/* ------------------------------------------------------------------ */
/* Gates — the single source of truth for what is allowed             */
/* ------------------------------------------------------------------ */

export const canRecord = (s: ConsultationState) => s.consent.audio;
export const canTranscribe = (s: ConsultationState) => s.consent.transcription;
export const canGenerate = (s: ConsultationState) =>
  s.transcript.status === "approved" && s.transcript.entries.length > 0 && s.consent.ai;
export const canPublishReport1 = (s: ConsultationState) => s.reports.report1?.status === "approved";
export const canRunAgent2 = (s: ConsultationState) => s.reports.report2?.status === "approved";
export const canApplyUpdates = (s: ConsultationState) =>
  canRunAgent2(s) && s.recordUpdates.proposals.some((p) => p.selected && !p.applied);

/** Steps the doctor is allowed to open, in order. */
export function unlockedSteps(s: ConsultationState): StepKey[] {
  const unlocked: StepKey[] = ["consent"];
  if (s.consent.recordedAt) unlocked.push("recording");
  if (s.recording.status === "stopped" || s.recording.status === "processing") unlocked.push("transcript");
  if (s.transcript.status === "approved") unlocked.push("reports");
  if (canRunAgent2(s)) unlocked.push("record-updates");
  if (s.recordUpdates.status === "applied" || s.recordUpdates.status === "deferred")
    unlocked.push("follow-up");
  return unlocked;
}

export function stepState(
  s: ConsultationState,
  step: StepKey,
): "done" | "current" | "available" | "locked" | "attention" {
  const unlocked = unlockedSteps(s);
  const index = STEPS.findIndex((item) => item.key === step);
  const unlockedIndex = unlocked.findIndex((item) => item === step);

  if (!unlocked.includes(step)) return "locked";

  const done: Record<StepKey, boolean> = {
    consent: Boolean(s.consent.recordedAt),
    recording: s.recording.status === "stopped" || s.recording.status === "processing",
    transcript: s.transcript.status === "approved",
    reports:
      s.reports.report1?.status === "approved" &&
      s.reports.report2?.status === "approved" &&
      s.reports.report3?.status === "approved",
    "record-updates": s.recordUpdates.status === "applied" || s.recordUpdates.status === "deferred",
    "follow-up": s.followUp.status !== "none",
  };

  if (done[step]) return "done";

  const next = STEPS.find((item) => unlocked.includes(item.key) && !done[item.key]);
  if (next?.key === step) return "current";
  if (index === unlockedIndex) return "current";
  return "available";
}

/** Next step the doctor should land on when resuming. */
export function resumeStep(s: ConsultationState): StepKey {
  if (s.completed) return "follow-up";
  const next = STEPS.find((item) => !["done", "locked"].includes(stepState(s, item.key)));
  return next?.key ?? "follow-up";
}

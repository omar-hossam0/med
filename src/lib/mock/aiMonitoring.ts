/**
 * Typed demo data for the Admin AI Reports Monitoring page.
 * Frontend-only and fully deterministic — no backend, database, or live AI
 * service is contacted. Clinical report content is intentionally absent.
 */

export type AiRangeKey = "7d" | "30d" | "90d";

export const AI_RANGE_OPTIONS: {
  value: AiRangeKey;
  label: string;
  days: number;
}[] = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

export function getRangeDays(key: AiRangeKey) {
  return AI_RANGE_OPTIONS.find((r) => r.value === key)?.days ?? 30;
}

const DAY_MS = 86_400_000;
const TOTAL_DAYS = 270;
const EXACT_DAYS = 30;

/** Fixed demo clock so server and client render identical content. */
export const AI_NOW = new Date(Date.UTC(2026, 9, 25, 15, 45, 0));
export const AI_TODAY_END = new Date(Date.UTC(2026, 9, 25, 23, 59, 59, 999));

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

export function formatMonthDay(date: Date) {
  return MONTH_DAY.format(date);
}
export function formatDate(date: Date) {
  return MONTH_DAY_YEAR.format(date);
}
export function formatTime(date: Date) {
  return TIME_FMT.format(date);
}
export function formatDateTime(date: Date) {
  return `${formatDate(date)}, ${formatTime(date)}`;
}

export function getRangeBounds(key: AiRangeKey, anchor = AI_TODAY_END) {
  const days = getRangeDays(key);
  const start = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - days * DAY_MS);
  return { start, end: anchor, prevStart, prevEnd, days };
}

export function formatRangeLabel(key: AiRangeKey) {
  const { start, end } = getRangeBounds(key);
  return `${formatDate(start)} - ${formatDate(end)}`;
}

export type WorkflowStatus = "approved" | "awaiting_review" | "draft";
export type ProcessingStatus = "success" | "failed" | "queued" | "processing";

export const WORKFLOW_LABEL: Record<WorkflowStatus, string> = {
  approved: "Approved",
  awaiting_review: "Awaiting Review",
  draft: "Draft",
};

export const PROCESSING_LABEL: Record<ProcessingStatus, string> = {
  success: "Success",
  failed: "Failed",
  queued: "Queued",
  processing: "Processing",
};

export type AiDoctor = {
  id: string;
  name: string;
  specialty: string;
  department: string;
};

/** Reuses existing Medora doctor names where possible, plus department heads. */
export const aiDoctors: AiDoctor[] = [
  { id: "doc-ahmed-hassan", name: "Dr. Ahmed Hassan", specialty: "Cardiology", department: "Cardiology" },
  { id: "doc-sarah-mohamed", name: "Dr. Sarah Mohamed", specialty: "Dermatology", department: "Dermatology" },
  { id: "doc-youssef-ali", name: "Dr. Youssef Ali", specialty: "Orthopedics", department: "Orthopedics" },
  { id: "doc-nourhan-ibrahim", name: "Dr. Nourhan Ibrahim", specialty: "Pediatrics", department: "Pediatrics" },
  { id: "doc-fatma-adel", name: "Dr. Fatma Adel", specialty: "Gynecology", department: "Gynecology" },
  { id: "doc-hala-mostafa", name: "Dr. Hala Mostafa", specialty: "Gynecology", department: "Gynecology" },
  { id: "doc-alya-samir", name: "Dr. Alya Samir", specialty: "ENT", department: "ENT" },
  { id: "doc-omar-hassan", name: "Dr. Omar Hassan", specialty: "General Medicine", department: "General Medicine" },
  { id: "doc-mona-khaled", name: "Dr. Mona Khaled", specialty: "Neurology", department: "Neurology" },
];

/** These totals add up to the default 30-day 1,248 reports. */
const DOCTOR_COUNTS_30D: Record<string, number> = {
  "doc-ahmed-hassan": 245,
  "doc-sarah-mohamed": 189,
  "doc-youssef-ali": 156,
  "doc-nourhan-ibrahim": 142,
  "doc-fatma-adel": 128,
  "doc-hala-mostafa": 100,
  "doc-alya-samir": 103,
  "doc-omar-hassan": 97,
  "doc-mona-khaled": 88,
};

export const FAILURE_CATEGORIES = [
  "Processing timeout",
  "Model service unavailable",
  "Document parse error",
  "Queue worker restart",
];

export type AiReport = {
  id: string;
  caseRef: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  department: string;
  createdAt: string;
  workflowStatus: WorkflowStatus;
  processingStatus: ProcessingStatus;
  processingSeconds: number | null;
  failureCategory?: string;
  jobId: string;
  jobStartedAt: string | null;
  jobFinishedAt: string | null;
};

type StatusPlan = {
  workflow: WorkflowStatus;
  processing: ProcessingStatus;
};

type DraftPlan = StatusPlan & { duration: number };

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Daily generated counts for the exact 30-day demo window (sums to 1,248). */
const LAST_30_COUNTS = [
  25, 31, 33, 36, 32, 40, 35, 37, 42, 49, 44, 37, 32, 41, 36,
  43, 39, 42, 41, 48, 50, 47, 43, 51, 50, 44, 45, 55, 47, 53,
];

/** Reserved anchor-day slots guarantee 4 failures and a queue of 2. */
const ANCHOR_RESERVED: Record<number, StatusPlan> = {
  8: { workflow: "draft", processing: "failed" },
  17: { workflow: "draft", processing: "failed" },
  26: { workflow: "draft", processing: "failed" },
  35: { workflow: "draft", processing: "failed" },
  44: { workflow: "draft", processing: "queued" },
  50: { workflow: "draft", processing: "processing" },
};

function dailyCount(dayIndex: number) {
  if (dayIndex >= TOTAL_DAYS - EXACT_DAYS) {
    return LAST_30_COUNTS[dayIndex - (TOTAL_DAYS - EXACT_DAYS)];
  }
  const value =
    37 +
    6 * Math.sin(dayIndex / 4.3) +
    4 * Math.cos(dayIndex / 9.1) +
    3 * Math.sin(dayIndex / 2.1);
  return Math.max(18, Math.round(value));
}

function weightedDoctor(random: () => number) {
  const total = aiDoctors.reduce((sum, d) => sum + DOCTOR_COUNTS_30D[d.id], 0);
  let pick = random() * total;
  for (const doctor of aiDoctors) {
    pick -= DOCTOR_COUNTS_30D[doctor.id];
    if (pick <= 0) return doctor;
  }
  return aiDoctors[aiDoctors.length - 1];
}

function looseStatus(random: () => number): StatusPlan {
  // Historical jobs are resolved: only the anchor day keeps a live queue.
  const r = random();
  if (r < 0.0032) return { workflow: "draft", processing: "failed" };
  if (r < 0.0168) return { workflow: "draft", processing: "success" };
  if (r < 0.0424) return { workflow: "awaiting_review", processing: "success" };
  return { workflow: "approved", processing: "success" };
}

function createReport(
  index: number,
  created: Date,
  doctor: AiDoctor,
  plan: StatusPlan,
  random: () => number,
): AiReport {
  const idNumber = 1000 + index;
  const duration = plan.processing === "success" ? 8 + Math.floor(random() * 9) : null;
  const jobStartedAt =
    plan.processing === "queued" ? null : new Date(created.getTime() + 2000);
  const jobFinishedAt =
    duration !== null && jobStartedAt ? new Date(jobStartedAt.getTime() + duration * 1000) : null;

  return {
    id: `RPT-${idNumber}`,
    caseRef: `CASE-${((0x8f2a + index * 137) % 0xffff).toString(16).toUpperCase().padStart(4, "0")}`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    department: doctor.department,
    createdAt: created.toISOString(),
    workflowStatus: plan.workflow,
    processingStatus: plan.processing,
    processingSeconds: duration,
    failureCategory:
      plan.processing === "failed"
        ? FAILURE_CATEGORIES[index % FAILURE_CATEGORIES.length]
        : undefined,
    jobId: `JOB-${idNumber}`,
    jobStartedAt: jobStartedAt?.toISOString() ?? null,
    jobFinishedAt: jobFinishedAt?.toISOString() ?? null,
  };
}

function buildReports() {
  const reports: AiReport[] = [];
  const random = mulberry32(20261025);
  const durationRandom = mulberry32(48151623);
  const dayDates: Date[] = [];

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = new Date(Date.UTC(2026, 9, 25));
    date.setUTCDate(date.getUTCDate() - (TOTAL_DAYS - 1 - i));
    dayDates.push(date);
  }

  let index = 0;

  // Older days: weighted random statuses, enough history for comparisons.
  for (let dayIndex = 0; dayIndex < TOTAL_DAYS - EXACT_DAYS; dayIndex++) {
    const count = dailyCount(dayIndex);
    for (let slot = 0; slot < count; slot++) {
      const created = new Date(
        dayDates[dayIndex].getTime() +
          8 * 3_600_000 +
          Math.round(((slot + 0.4) / count) * 7.5 * 3_600_000) +
          Math.floor(random() * 2000),
      );
      reports.push(
        createReport(index++, created, weightedDoctor(random), looseStatus(random), durationRandom),
      );
    }
  }

  // Exact 30-day window: preserve KPI, tab and doctor-ranking totals.
  const doctorQueue = shuffled(
    Object.entries(DOCTOR_COUNTS_30D).flatMap(([id, count]) => {
      const doctor = aiDoctors.find((d) => d.id === id)!;
      return Array.from({ length: count }, () => doctor);
    }),
    random,
  );

  const statusQueue: StatusPlan[] = [
    ...Array.from({ length: 1201 }, () => ({ workflow: "approved" as const, processing: "success" as const })),
    ...Array.from({ length: 32 }, () => ({ workflow: "awaiting_review" as const, processing: "success" as const })),
    ...Array.from({ length: 9 }, () => ({ workflow: "draft" as const, processing: "success" as const })),
  ];
  const shuffledStatuses = shuffled(statusQueue, random);

  let statusCursor = 0;
  let doctorCursor = 0;

  for (let offset = 0; offset < EXACT_DAYS; offset++) {
    const dayIndex = TOTAL_DAYS - EXACT_DAYS + offset;
    const count = dailyCount(dayIndex);
    for (let slot = 0; slot < count; slot++) {
      const reserved = dayIndex === TOTAL_DAYS - 1 ? ANCHOR_RESERVED[slot] : undefined;
      const plan =
        reserved ??
        shuffledStatuses[statusCursor++] ??
        ({ workflow: "approved", processing: "success" } satisfies StatusPlan);
      const doctor = doctorQueue[doctorCursor++] ?? aiDoctors[0];
      const created = new Date(
        dayDates[dayIndex].getTime() +
          8 * 3_600_000 +
          Math.round(((slot + 0.4) / count) * 7.5 * 3_600_000) +
          Math.floor(random() * 2000),
      );
      reports.push(createReport(index++, created, doctor, plan, durationRandom));
    }
  }

  return reports.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export const aiReports: AiReport[] = buildReports();

export function inRange(report: AiReport, start: Date, end: Date) {
  const time = Date.parse(report.createdAt);
  return time >= start.getTime() && time <= end.getTime();
}

export function filterReportsByRange(reports: AiReport[], key: AiRangeKey) {
  const { start, end } = getRangeBounds(key);
  return reports.filter((r) => inRange(r, start, end));
}

export type AiSummary = {
  total: number;
  approved: number;
  awaiting: number;
  failures: number;
  drafts: number;
  successes: number;
  queued: number;
  processing: number;
  averageSeconds: number;
  successRate: number;
};

export function summarizeReports(reports: AiReport[]): AiSummary {
  let approved = 0;
  let awaiting = 0;
  let failures = 0;
  let drafts = 0;
  let successes = 0;
  let queued = 0;
  let processing = 0;
  let durationTotal = 0;

  for (const report of reports) {
    if (report.workflowStatus === "approved") approved++;
    if (report.workflowStatus === "awaiting_review") awaiting++;
    if (report.workflowStatus === "draft") drafts++;
    if (report.processingStatus === "success") {
      successes++;
      durationTotal += report.processingSeconds ?? 0;
    }
    if (report.processingStatus === "failed") failures++;
    if (report.processingStatus === "queued") queued++;
    if (report.processingStatus === "processing") processing++;
  }

  const completed = successes + failures;
  return {
    total: reports.length,
    approved,
    awaiting,
    failures,
    drafts,
    successes,
    queued,
    processing,
    averageSeconds: successes ? Math.round(durationTotal / successes) : 0,
    successRate: completed ? (successes / completed) * 100 : 100,
  };
}

export type DailyPoint = {
  key: string;
  label: string;
  fullLabel: string;
  generated: number;
  approved: number;
  awaiting: number;
  failed: number;
};

export function getDailySeries(periodReports: AiReport[], key: AiRangeKey): DailyPoint[] {
  const { start, days } = getRangeBounds(key);
  const points: DailyPoint[] = [];
  const map = new Map<string, DailyPoint>();

  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * DAY_MS);
    const point: DailyPoint = {
      key: date.toISOString().slice(0, 10),
      label: formatMonthDay(date),
      fullLabel: formatDate(date),
      generated: 0,
      approved: 0,
      awaiting: 0,
      failed: 0,
    };
    points.push(point);
    map.set(point.key, point);
  }

  for (const report of periodReports) {
    const point = map.get(report.createdAt.slice(0, 10));
    if (!point) continue;
    point.generated++;
    if (report.workflowStatus === "approved") point.approved++;
    if (report.workflowStatus === "awaiting_review") point.awaiting++;
    if (report.processingStatus === "failed") point.failed++;
  }

  return points;
}

export type DoctorRanking = { doctor: AiDoctor; count: number };

export function getDoctorRanking(periodReports: AiReport[]): DoctorRanking[] {
  const counts = new Map<string, number>();
  for (const report of periodReports) {
    counts.set(report.doctorId, (counts.get(report.doctorId) ?? 0) + 1);
  }
  return aiDoctors
    .map((doctor) => ({ doctor, count: counts.get(doctor.id) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.doctor.name.localeCompare(b.doctor.name));
}

export type ServiceState = "operational" | "degraded" | "unavailable";

export const SERVICE_STATE_LABEL: Record<ServiceState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  unavailable: "Unavailable",
};

export type AiServiceHealth = {
  state: ServiceState;
  averageSeconds: number;
  successRate: number;
  failedLast24h: number;
  queueLength: number;
  lastUpdated: string;
  successes: number;
  failures: number;
  queued: number;
  processing: number;
};

export function getServiceHealth(
  allReports: AiReport[],
  periodReports: AiReport[],
): AiServiceHealth {
  const summary = summarizeReports(periodReports);
  const last24Start = new Date(AI_TODAY_END.getTime() - DAY_MS);
  const failedLast24h = allReports.filter(
    (r) => r.processingStatus === "failed" && Date.parse(r.createdAt) >= last24Start.getTime(),
  ).length;
  const queueLength = allReports.filter(
    (r) => r.processingStatus === "queued" || r.processingStatus === "processing",
  ).length;

  return {
    state: "operational",
    averageSeconds: summary.averageSeconds,
    successRate: summary.successRate,
    failedLast24h,
    queueLength,
    lastUpdated: AI_NOW.toISOString(),
    successes: summary.successes,
    failures: summary.failures,
    queued: summary.queued,
    processing: summary.processing,
  };
}

export type ActivityType =
  | "generated"
  | "approved"
  | "failed"
  | "retry"
  | "health"
  | "maintenance";

export type OperationalActivity = {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  occurredAt: string;
  reportId?: string;
};

export function getOperationalActivities(allReports: AiReport[]): OperationalActivity[] {
  const sorted = [...allReports].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const approved = sorted.find((r) => r.workflowStatus === "approved") ?? sorted[0];
  const failed = sorted.find((r) => r.processingStatus === "failed") ?? sorted[0];
  const retry =
    sorted.find((r) => r.processingStatus === "success" && r.workflowStatus === "draft") ??
    sorted[2] ??
    sorted[0];
  const generated = sorted[0];
  const generated2 = sorted[1] ?? sorted[0];
  const approved2 = sorted.find((r) => r.workflowStatus === "approved" && r.id !== approved.id) ?? approved;
  const base = AI_NOW.getTime();
  const at = (minutes: number) => new Date(base - minutes * 60_000).toISOString();

  return [
    {
      id: "act-1",
      type: "generated",
      title: "Report generated",
      detail: `${generated.id} · ${generated.department}`,
      occurredAt: at(2),
      reportId: generated.id,
    },
    {
      id: "act-2",
      type: "approved",
      title: "Report approved",
      detail: `${approved.id} by ${approved.doctorName}`,
      occurredAt: at(12),
      reportId: approved.id,
    },
    {
      id: "act-3",
      type: "failed",
      title: "Processing failed",
      detail: `${failed.id} · ${failed.failureCategory ?? "Processing error"}`,
      occurredAt: at(25),
      reportId: failed.id,
    },
    {
      id: "act-4",
      type: "generated",
      title: "Report generated",
      detail: `${generated2.id} · ${generated2.department}`,
      occurredAt: at(60),
      reportId: generated2.id,
    },
    {
      id: "act-5",
      type: "maintenance",
      title: "System maintenance",
      detail: "AI processing service updated",
      occurredAt: at(120),
    },
    {
      id: "act-6",
      type: "retry",
      title: "Processing retry succeeded",
      detail: `${retry.id} completed after an automatic retry`,
      occurredAt: at(180),
      reportId: retry.id,
    },
    {
      id: "act-7",
      type: "approved",
      title: "Report approved",
      detail: `${approved2.id} by ${approved2.doctorName}`,
      occurredAt: at(240),
      reportId: approved2.id,
    },
    {
      id: "act-8",
      type: "health",
      title: "AI service health changed",
      detail: "Processing service returned to Operational",
      occurredAt: at(300),
    },
    {
      id: "act-9",
      type: "failed",
      title: "Processing failed",
      detail: `${failed.id} · sanitized error logged`,
      occurredAt: at(360),
      reportId: failed.id,
    },
    {
      id: "act-10",
      type: "maintenance",
      title: "Queue maintenance",
      detail: "Stale processing jobs cleared",
      occurredAt: at(720),
    },
    {
      id: "act-11",
      type: "generated",
      title: "Report generated",
      detail: `${sorted[3]?.id ?? generated.id} · ${sorted[3]?.department ?? generated.department}`,
      occurredAt: at(900),
      reportId: sorted[3]?.id ?? generated.id,
    },
    {
      id: "act-12",
      type: "health",
      title: "Service health check",
      detail: "No reliability issues detected",
      occurredAt: at(1440),
    },
  ];
}

export function relativeActivityTime(occurredAt: string) {
  const minutes = Math.max(
    0,
    Math.round((AI_NOW.getTime() - Date.parse(occurredAt)) / 60_000),
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export type ReportEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
};

/** Sanitized operational timeline — never includes clinical report content. */
export function getReportEvents(report: AiReport): ReportEvent[] {
  const created = new Date(report.createdAt);
  const started = report.jobStartedAt ? new Date(report.jobStartedAt) : null;
  const finished = report.jobFinishedAt ? new Date(report.jobFinishedAt) : null;
  const events: ReportEvent[] = [
    {
      id: "evt-queued",
      at: created.toISOString(),
      title: "Processing job queued",
      detail: `${report.jobId} entered the AI processing queue.`,
    },
  ];

  if (started) {
    events.push({
      id: "evt-started",
      at: started.toISOString(),
      title: "Generation started",
      detail: "The AI drafting service began processing the request.",
    });
  }

  if (report.processingStatus === "success" && finished) {
    events.push({
      id: "evt-generated",
      at: finished.toISOString(),
      title: "Draft generated",
      detail: `Processing completed in ${report.processingSeconds ?? 0} seconds.`,
    });
    if (report.workflowStatus === "awaiting_review") {
      events.push({
        id: "evt-review",
        at: new Date(finished.getTime() + 60_000).toISOString(),
        title: "Sent for clinician review",
        detail: "The draft was assigned to the responsible doctor.",
      });
    }
    if (report.workflowStatus === "approved") {
      events.push({
        id: "evt-approved",
        at: new Date(finished.getTime() + 240_000).toISOString(),
        title: "Clinical approval recorded",
        detail: `Approved by ${report.doctorName}. Approval authority remains with the doctor.`,
      });
    }
    if (report.workflowStatus === "draft") {
      events.push({
        id: "evt-draft",
        at: new Date(finished.getTime() + 120_000).toISOString(),
        title: "Draft saved",
        detail: "The generated draft remains with the doctor for review.",
      });
    }
  }

  if (report.processingStatus === "failed") {
    events.push({
      id: "evt-failed",
      at: new Date(created.getTime() + 20_000).toISOString(),
      title: "Processing failed",
      detail: `Sanitized error category: ${report.failureCategory ?? "Processing error"}.`,
    });
  }

  if (report.processingStatus === "queued") {
    events.push({
      id: "evt-waiting",
      at: new Date(created.getTime() + 5_000).toISOString(),
      title: "Waiting in queue",
      detail: "The job has not started processing yet.",
    });
  }

  if (report.processingStatus === "processing") {
    events.push({
      id: "evt-processing",
      at: new Date(created.getTime() + 10_000).toISOString(),
      title: "Processing in progress",
      detail: "The processing job is currently active.",
    });
  }

  return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

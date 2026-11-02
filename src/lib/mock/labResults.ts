/**
 * Derived view layer for the Patient Lab Results module.
 *
 * This file adds NO clinical data. Every result comes from
 * `medicalRecords.labResults`, so a test opened from Lab Results and the same
 * test opened from Medical Records are literally the same object with the same
 * id, values, units, reference ranges and status.
 *
 * What lives here is presentation-independent derivation: summary counts,
 * search/status filtering, the report-file link, and trend windowing.
 */

import {
  getMedicalDoctor,
  getVisit,
  getVisitFile,
  labResults,
  type LabResult,
  type LabStatus,
  type LabTrend,
  type MedicalFile,
  type Visit,
  type MedicalDoctor,
} from "./medicalRecords";

export type { LabResult, LabStatus, LabTrend, MedicalFile };

/** The single source of truth, re-exported so the UI never imports a copy. */
export { labResults };

/**
 * Links a lab result to an existing clinician-uploaded report file.
 *
 * Only CBC has a report in the current fixture set (`visitFiles`). The mapping
 * is explicit rather than guessed: a result without an entry genuinely has no
 * attached document, and the Report tab must say so instead of inventing one.
 */
const LAB_REPORT_FILE: Record<string, string> = {
  "lab-cbc": "f-cbc-report",
};

export function getLabReportFile(lab: LabResult): MedicalFile | undefined {
  const fileId = LAB_REPORT_FILE[lab.id];
  return fileId ? getVisitFile(fileId) : undefined;
}

export function getLabDoctor(lab: LabResult): MedicalDoctor | undefined {
  return getMedicalDoctor(lab.doctorId);
}

export function getLabVisit(lab: LabResult): Visit | undefined {
  return getVisit(lab.relatedVisitId);
}

/* ------------------------------------------------------------------ */
/* Summary counts                                                      */
/* ------------------------------------------------------------------ */

export type LabCounts = {
  total: number;
  normal: number;
  attention: number;
};

/**
 * Counts are derived from the same list the page renders, so the cards can
 * never contradict the rows. "Abnormal" is the laboratory's own flag; it is
 * surfaced as "Need attention" in the UI without being re-diagnosed here.
 */
export function getLabCounts(list: LabResult[] = labResults): LabCounts {
  return {
    total: list.length,
    normal: list.filter((lab) => lab.status === "Normal").length,
    attention: list.filter((lab) => lab.status === "Abnormal").length,
  };
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

export type LabStatusFilter = "all" | LabStatus;

export const LAB_STATUS_LABEL: Record<LabStatusFilter, string> = {
  all: "All Results",
  Normal: "Normal",
  Abnormal: "Abnormal",
};

export function filterLabResults(
  list: LabResult[],
  { search, status }: { search: string; status: LabStatusFilter },
): LabResult[] {
  const term = search.trim().toLowerCase();

  return list.filter((lab) => {
    if (status !== "all" && lab.status !== status) return false;
    if (!term) return true;

    const doctor = getLabDoctor(lab);
    const haystack = [lab.name, lab.category, lab.facility, doctor?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
}

/* ------------------------------------------------------------------ */
/* Trends                                                              */
/* ------------------------------------------------------------------ */

export type TrendRange = "3M" | "6M" | "1Y";

export const TREND_RANGES: TrendRange[] = ["3M", "6M", "1Y"];

const RANGE_DAYS: Record<TrendRange, number> = {
  "3M": 92,
  "6M": 183,
  "1Y": 366,
};

/** `DEMO_TODAY` keeps the demo dataset internally consistent. */
export const LAB_DEMO_TODAY = "2026-10-28";

/**
 * Windows a trend to a range. Points are kept only when they fall inside the
 * window, so a range with no measurements renders an honest empty state rather
 * than a fabricated line.
 */
export function filterTrendPoints(trend: LabTrend, range: TrendRange): LabTrend["points"] {
  const today = new Date(`${LAB_DEMO_TODAY}T00:00:00Z`).getTime();
  const cutoff = today - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;

  return trend.points.filter((point) => {
    const value = new Date(`${point.date}T00:00:00Z`).getTime();
    return value >= cutoff && value <= today;
  });
}

/** True when a result has any recorded history to chart. */
export function hasTrendData(lab: LabResult): boolean {
  return Boolean(lab.trends && lab.trends.some((trend) => trend.points.length > 0));
}

export function getLatestPoint(trend: LabTrend) {
  if (trend.points.length === 0) return undefined;
  return [...trend.points].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatLabDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatShortMonth(iso: string): string {
  const [, month] = iso.split("-").map(Number);
  return MONTHS[(month ?? 1) - 1] ?? iso;
}

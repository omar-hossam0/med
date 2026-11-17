/**
 * Admin AI monitoring (Phase 10).
 *
 * Built strictly from operational tables (agent_executions, medical_reports,
 * report_versions, audit_logs and workforce joins). The `sanitize()` step is
 * an explicit allowlist: report content, transcript text, patient identifiers
 * and patient names can never appear in a monitoring payload.
 */
const pool = require("../config/db");
const { iso, dateOnly, pagination } = require("../utils/dbHelpers");

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };
const PROCESSING = {
  succeeded: "success",
  failed: "failed",
  cancelled: "failed",
  queued: "queued",
  running: "processing",
};

function rangeBounds(query = {}) {
  const key = RANGE_DAYS[query.range] ? query.range : "30d";
  const days = RANGE_DAYS[key];
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return { key, days, start, end };
}

function sanitize(row) {
  return {
    id: row.id,
    caseRef: `MDR-${String(row.consultation_id || row.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    doctorId: row.doctor_id || null,
    doctorName: row.doctor_name || "Unassigned",
    specialty: row.specialty || "",
    department: row.department || "",
    createdAt: iso(row.created_at),
    workflowStatus: row.workflow_status,
    processingStatus: PROCESSING[row.status] || "queued",
    processingSeconds: row.processing_seconds === null || row.processing_seconds === undefined
      ? null
      : Number(row.processing_seconds),
    ...(row.error_code ? { failureCategory: row.error_code } : {}),
    jobId: row.id,
    jobStartedAt: iso(row.started_at),
    jobFinishedAt: iso(row.completed_at),
  };
}

async function loadReports({ start, end }) {
  const { rows } = await pool.query(
    `SELECT ae.id, ae.agent_code, ae.status, ae.started_at, ae.completed_at,
            ae.error_code, ae.created_at, ae.consultation_id,
            u.id AS doctor_id, u.full_name AS doctor_name,
            s.name AS specialty, d.name AS department,
            EXTRACT(EPOCH FROM (ae.completed_at - ae.started_at)) AS processing_seconds,
            (SELECT count(*) FROM report_versions rv
               JOIN medical_reports mr ON mr.id = rv.report_id
              WHERE mr.consultation_id = ae.consultation_id
                AND rv.review_decision = 'approved')::int AS approved_versions,
            (SELECT count(*) FROM report_versions rv
               JOIN medical_reports mr ON mr.id = rv.report_id
              WHERE mr.consultation_id = ae.consultation_id
                AND rv.review_decision IS NULL)::int AS awaiting_versions
       FROM agent_executions ae
       LEFT JOIN consultations c  ON c.id = ae.consultation_id
       LEFT JOIN users u          ON u.id = c.doctor_user_id
       LEFT JOIN appointments a  ON a.id = c.appointment_id
       LEFT JOIN specialties s   ON s.id = a.specialty_id
       LEFT JOIN departments d   ON d.specialty_id = s.id
      WHERE ae.created_at >= $1 AND ae.created_at <= $2
      ORDER BY ae.created_at DESC`,
    [start, end]
  );
  return rows.map((row) => sanitize({
    ...row,
    workflow_status: row.approved_versions > 0
      ? "approved"
      : row.awaiting_versions > 0 ? "awaiting_review" : "draft",
  }));
}

function summarize(reports) {
  const summary = {
    total: reports.length,
    approved: 0, awaiting: 0, failures: 0, drafts: 0,
    successes: 0, queued: 0, processing: 0,
    averageSeconds: 0, successRate: 100,
  };
  let seconds = 0;
  for (const report of reports) {
    if (report.workflowStatus === "approved") summary.approved++;
    if (report.workflowStatus === "awaiting_review") summary.awaiting++;
    if (report.workflowStatus === "draft") summary.drafts++;
    if (report.processingStatus === "success") {
      summary.successes++;
      seconds += report.processingSeconds || 0;
    }
    if (report.processingStatus === "failed") summary.failures++;
    if (report.processingStatus === "queued") summary.queued++;
    if (report.processingStatus === "processing") summary.processing++;
  }
  const completed = summary.successes + summary.failures;
  summary.averageSeconds = summary.successes ? Math.round(seconds / summary.successes) : 0;
  summary.successRate = completed ? Math.round((summary.successes / completed) * 100) : 100;
  return summary;
}

async function getReports({ query }) {
  const { start, end, key } = rangeBounds(query);
  const reports = await loadReports({ start, end });
  let filtered = reports;
  if (query.workflowStatus) filtered = filtered.filter((row) => row.workflowStatus === query.workflowStatus);
  if (query.processingStatus) filtered = filtered.filter((row) => row.processingStatus === query.processingStatus);
  if (query.doctorId) filtered = filtered.filter((row) => row.doctorId === query.doctorId);
  if (query.search) {
    const term = String(query.search).toLowerCase();
    filtered = filtered.filter((row) => [row.caseRef, row.doctorName, row.specialty].join(" ").toLowerCase().includes(term));
  }
  const { limit, offset } = pagination(query, { defaultLimit: 50 });
  return {
    reports: filtered.slice(offset, offset + limit),
    range: key,
    pagination: {
      total: filtered.length, limit, offset,
      returned: Math.min(limit, Math.max(filtered.length - offset, 0)),
      hasMore: offset + limit < filtered.length,
    },
  };
}

async function getSummary({ query }) {
  const { start, end, days, key } = rangeBounds(query);
  const current = await loadReports({ start, end });
  const previous = await loadReports({
    start: new Date(start.getTime() - days * 86400000),
    end: start,
  });
  return { summary: summarize(current), previous: summarize(previous), range: key };
}

async function getDailySeries({ query }) {
  const { start, end, days, key } = rangeBounds(query);
  const reports = await loadReports({ start, end });
  const points = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * 86400000);
    const dayKey = dateOnly(date);
    const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
    const fullLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
    const dayReports = reports.filter((report) => String(report.createdAt).slice(0, 10) === dayKey);
    points.push({
      key: dayKey,
      label,
      fullLabel,
      generated: dayReports.length,
      approved: dayReports.filter((report) => report.workflowStatus === "approved").length,
      awaiting: dayReports.filter((report) => report.workflowStatus === "awaiting_review").length,
      failed: dayReports.filter((report) => report.processingStatus === "failed").length,
    });
  }
  return { series: points, range: key };
}

async function getDoctorRanking({ query }) {
  const { start, end, key } = rangeBounds(query);
  const reports = await loadReports({ start, end });
  const grouped = new Map();
  for (const report of reports) {
    if (!report.doctorId) continue;
    const current = grouped.get(report.doctorId) || {
      doctor: {
        id: report.doctorId,
        name: report.doctorName,
        specialty: report.specialty,
        department: report.department,
      },
      count: 0,
    };
    current.count++;
    grouped.set(report.doctorId, current);
  }
  const ranking = [...grouped.values()].sort((a, b) => b.count - a.count || a.doctor.name.localeCompare(b.doctor.name));
  return { ranking, range: key };
}

async function getHealth() {
  const { start, end } = rangeBounds({ range: "30d" });
  const [all, period] = await Promise.all([
    pool.query(
      `SELECT status, count(*)::int AS total, created_at::date AS day
         FROM agent_executions GROUP BY status, created_at::date`
    ),
    loadReports({ start, end }),
  ]);
  const summary = summarize(period);
  const last24h = new Date(Date.now() - 86400000);
  const failedLast24h = period.filter(
    (report) => report.processingStatus === "failed" && new Date(report.createdAt) >= last24h
  ).length;
  const queueLength = period.filter(
    (report) => ["queued", "processing"].includes(report.processingStatus)
  ).length;
  const state = summary.successRate < 50 ? "degraded" : "operational";

  return {
    health: {
      state,
      averageSeconds: summary.averageSeconds,
      successRate: summary.successRate,
      failedLast24h,
      queueLength,
      lastUpdated: new Date().toISOString(),
      successes: summary.successes,
      failures: summary.failures,
      queued: summary.queued,
      processing: summary.processing,
    },
    dailyTotals: all.rows.map((row) => ({ status: row.status, day: dateOnly(row.day), total: row.total })),
  };
}

const ACTIVITY_TITLES = {
  "agent.execution_registered": { type: "generated", title: "AI job registered" },
  "report.reviewed": { type: "approved", title: "Report version reviewed" },
  "report.published": { type: "approved", title: "Patient summary released" },
  "transcript.reviewed": { type: "approved", title: "Transcript version reviewed" },
};

async function getActivities({ query }) {
  const { rows } = await pool.query(
    `SELECT id, event_type, occurred_at, entity_type, entity_id
       FROM audit_logs
      WHERE event_type = ANY($1::text[])
      ORDER BY occurred_at DESC LIMIT $2`,
    [Object.keys(ACTIVITY_TITLES), Math.min(Number(query.limit) || 20, 100)]
  );
  return {
    activities: rows.map((row) => ({
      id: row.id,
      type: ACTIVITY_TITLES[row.event_type].type,
      title: ACTIVITY_TITLES[row.event_type].title,
      detail: `Operational event ${row.event_type} recorded.`,
      occurredAt: iso(row.occurred_at),
      reportId: row.entity_type === "medical_report" ? row.entity_id : undefined,
    })),
  };
}

async function getReportEvents({ params }) {
  const { rows } = await pool.query(
    `SELECT id, agent_code, status, created_at, started_at, completed_at, error_code
       FROM agent_executions WHERE id = $1`,
    [params.id]
  );
  if (rows.length === 0) return { events: [] };
  const row = rows[0];
  const events = [{
    id: `${row.id}-queued`,
    at: iso(row.created_at),
    title: "Processing job queued",
    detail: `${row.agent_code} entered the AI processing queue.`,
  }];
  if (row.started_at) {
    events.push({ id: `${row.id}-started`, at: iso(row.started_at), title: "Processing started", detail: "Worker picked up the job." });
  }
  if (row.completed_at) {
    events.push({
      id: `${row.id}-finished`,
      at: iso(row.completed_at),
      title: row.status === "failed" ? "Processing failed" : "Processing finished",
      detail: row.status === "failed" ? `Error code: ${row.error_code || "unknown"}.` : "Job completed successfully.",
    });
  }
  return { events };
}

module.exports = {
  RANGE_DAYS,
  rangeBounds,
  sanitize,
  summarize,
  loadReports,
  getReports,
  getSummary,
  getDailySeries,
  getDoctorRanking,
  getHealth,
  getActivities,
  getReportEvents,
};

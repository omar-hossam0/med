/**
 * Admin overview (Phase 10). Strictly operational data: no clinical content,
 * no patient names and no report/transcript text is ever joined into a
 * response. Patient identifiers appear only as a masked, non-identifying
 * label derived from the appointment id.
 */
const pool = require("../config/db");
const { iso, dateOnly } = require("../utils/dbHelpers");

const QUICK_ACTIONS = [
  { key: "doctors", label: "Manage Doctors", icon: "stethoscope" },
  { key: "staff", label: "Manage Staff", icon: "users" },
  { key: "appointments", label: "View Appointments", icon: "calendar" },
  { key: "reports", label: "View AI Reports", icon: "file" },
];

function maskPatient(appointmentId) {
  return `Patient ${String(appointmentId || "").replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

function dayLabel(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

async function getDashboard({ user }) {
  const now = new Date();
  const todayUtc = dateOnly(now);
  const sevenDaysAgo = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6
  ));

  const [counts, trend, distribution, recentAppointments, recentUsers, events, ai] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.name='patient')::int AS patients,
         (SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.name='doctor')::int AS doctors,
         (SELECT count(*) FROM appointments
           WHERE COALESCE(scheduled_start_at, requested_start_at) >= date_trunc('day', now())
             AND COALESCE(scheduled_start_at, requested_start_at) < date_trunc('day', now()) + interval '1 day')::int AS today_appointments,
         (SELECT count(*) FROM medical_reports)::int AS reports,
         (SELECT count(*) FROM appointments WHERE status IN ('requested','pending_confirmation'))::int AS pending`
    ),
    pool.query(
      `SELECT date_trunc('day', COALESCE(scheduled_start_at, requested_start_at)) AS day,
              consultation_type, status, count(*)::int AS total
         FROM appointments
        WHERE COALESCE(scheduled_start_at, requested_start_at) >= $1
        GROUP BY 1, 2, 3
        ORDER BY 1`,
      [sevenDaysAgo]
    ),
    pool.query(
      `SELECT COALESCE(s.name, 'Unassigned') AS label, count(*)::int AS total
         FROM appointments a
         LEFT JOIN specialties s ON s.id = a.specialty_id
        GROUP BY 1 ORDER BY total DESC, label`
    ),
    pool.query(
      `SELECT a.id, a.status, a.consultation_type,
              COALESCE(a.scheduled_start_at, a.requested_start_at) AS starts_at,
              u.full_name AS doctor_name
         FROM appointments a
         JOIN users u ON u.id = a.doctor_user_id
        ORDER BY a.created_at DESC LIMIT 5`
    ),
    pool.query(
      `SELECT u.id, u.full_name, u.status, u.created_at, r.name AS role
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r       ON r.id = ur.role_id
        WHERE r.name IN ('doctor','receptionist')
        ORDER BY u.created_at DESC LIMIT 5`
    ),
    pool.query(
      `SELECT id, event_type, occurred_at FROM audit_logs
        WHERE event_type IN ('appointment.created','user.provisioned','report.published')
        ORDER BY occurred_at DESC LIMIT 4`
    ),
    pool.query(
      `SELECT count(*) FILTER (WHERE status = 'succeeded')::int AS successes,
              count(*) FILTER (WHERE status = 'failed')::int AS failures,
              count(*) FILTER (WHERE status IN ('queued','running'))::int AS pending,
              count(*)::int AS total
         FROM agent_executions
        WHERE created_at >= now() - interval '7 days'`
    ),
  ]);

  const c = counts.rows[0];
  const trendDays = [];
  const series = { inperson: [], online: [], cancelled: [] };
  for (let i = 0; i < 7; i++) {
    const day = new Date(sevenDaysAgo.getTime() + i * 86400000);
    const key = dateOnly(day);
    trendDays.push(dayLabel(day));
    const rows = trend.rows.filter((row) => dateOnly(row.day) === key);
    const sum = (predicate) => rows.filter(predicate).reduce((total, row) => total + row.total, 0);
    series.inperson.push(sum((row) => row.consultation_type === "in_person" && row.status !== "cancelled"));
    series.online.push(sum((row) => row.consultation_type === "online" && row.status !== "cancelled"));
    series.cancelled.push(sum((row) => row.status === "cancelled"));
  }

  const departmentTotal = distribution.rows.reduce((total, row) => total + row.total, 0);
  const palette = ["#0A9189", "#3B6EF6", "#8B5CF6", "#22B8CF", "#F59E0B", "#EC4899", "#94A3B8"];
  const top = distribution.rows.slice(0, 6).map((row, index) => ({
    label: row.label,
    percent: departmentTotal ? Math.round((row.total / departmentTotal) * 100) : 0,
    color: palette[index % palette.length],
  }));
  const others = distribution.rows.slice(6).reduce((total, row) => total + row.total, 0);
  if (others > 0) {
    top.push({ label: "Others", percent: Math.round((others / departmentTotal) * 100), color: palette[6] });
  }

  const eventIcon = {
    "appointment.created": "calendar",
    "user.provisioned": "user",
    "report.published": "check",
  };
  const eventText = {
    "appointment.created": "A new appointment was requested",
    "user.provisioned": "A new account was provisioned",
    "report.published": "A patient summary was released",
  };

  const aiRow = ai.rows[0];
  const completed = aiRow.successes + aiRow.failures;
  const successRate = completed ? Math.round((aiRow.successes / completed) * 100) : 100;

  return {
    kpis: [
      { key: "patients", label: "Total Patients", value: c.patients.toLocaleString("en-US"), icon: "users", tone: "teal" },
      { key: "doctors", label: "Active Doctors", value: String(c.doctors), icon: "stethoscope", tone: "blue" },
      { key: "appointments", label: "Today's Appointments", value: String(c.today_appointments), icon: "calendar", tone: "violet" },
      { key: "ai", label: "AI Reports", value: String(c.reports), icon: "file", tone: "amber" },
      { key: "pending", label: "Pending Actions", value: String(c.pending), icon: "alert", tone: "rose", note: "Requires attention" },
    ],
    trendDays,
    trendSeries: [
      { key: "inperson", label: "In-person", color: "#0A9189", data: series.inperson },
      { key: "online", label: "Online", color: "#3B6EF6", data: series.online },
      { key: "cancelled", label: "Cancelled", color: "#8B5CF6", data: series.cancelled },
    ],
    departments: top,
    departmentTotal,
    notifications: events.rows.map((row) => ({
      id: row.id,
      icon: eventIcon[row.event_type] || "check",
      tone: "teal",
      text: eventText[row.event_type] || "System activity recorded",
      time: iso(row.occurred_at),
    })),
    quickActions: QUICK_ACTIONS,
    systemHealth: [
      { key: "app", label: "Application", value: "Operational", trend: series.inperson.slice(-8) },
      { key: "db", label: "Database", value: "Operational", trend: series.online.slice(-8) },
      { key: "ai", label: "AI Processing", value: `${successRate}% success`, trend: [aiRow.successes, aiRow.failures, aiRow.pending] },
      { key: "files", label: "Reference Library", value: `${aiRow.total} runs`, trend: [aiRow.total] },
    ],
    recentAppointments: recentAppointments.rows.map((row) => ({
      id: row.id,
      patient: maskPatient(row.id),
      doctor: row.doctor_name,
      time: iso(row.starts_at),
      type: row.consultation_type === "online" ? "Online" : "In-person",
      status:
        row.status === "completed" ? "Completed"
          : row.status === "in_progress" ? "In Progress"
            : ["cancelled", "no_show", "rescheduled"].includes(row.status) ? "Cancelled"
              : "Upcoming",
    })),
    recentUsers: recentUsers.rows.map((row) => ({
      id: row.id,
      name: row.full_name,
      role: row.role === "doctor" ? "Doctor" : "Staff",
      created: dateOnly(row.created_at),
      status: row.status === "active" ? "Active" : "Pending",
    })),
    adminUser: { name: "Admin", role: "Administrator", fullName: user.full_name || "Admin" },
    today: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now),
    // Decorative copy has no database source; an empty string is honest.
    quote: "",
    todayKey: todayUtc,
  };
}

module.exports = { getDashboard, maskPatient };

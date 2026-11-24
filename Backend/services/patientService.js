/**
 * Patient-facing profile, doctor directory and dashboard.
 *
 * Every query is scoped to req.user.id for personal data. There is no code
 * path that accepts a patient_user_id from the client — this is Phase 2's
 * "own-profile only" gate.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const {
  assertUuid,
  iso,
  dateOnly,
  timeLabel,
  optionalText,
  withTransaction,
  localDateIn,
} = require("../utils/dbHelpers");
const {
  serializePatientProfile,
  serializeDoctor,
  serializeDoctorDepartment,
  serializeDashboardAppointment,
  toDbConsultationType,
} = require("../utils/patientSerializers");
const { labStatusFromFlag } = require("../utils/clinicalSerializers");

const GENDERS = ["female", "male", "non_binary", "prefer_not_to_say"];

async function profileRow(executor, userId) {
  const { rows } = await executor.query(
    `SELECT p.user_id, p.date_of_birth, p.phone, p.gender, p.profile_completed_at,
            u.full_name, u.email
       FROM patient_profiles p
       JOIN users u ON u.id = p.user_id
      WHERE p.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getProfile({ actorId, user }) {
  const row = await profileRow(pool, actorId);
  // Registration guarantees a row. Legacy data may not have one; return a
  // stable empty shape instead of a 404.
  return { profile: serializePatientProfile(row, { ...user, full_name: row?.full_name || user.full_name }) };
}

async function updateProfile({ body, actorId, user, context }) {
  const v = new Validator();
  const sets = [];
  const values = [];
  // Track submitted values by column as well as by position, so the audit
  // snapshot and the completion check do not depend on SQL SET ordering.
  const submitted = {};
  const add = (column, value) => {
    submitted[column] = value;
    sets.push(`${column} = $${values.length + 1}`);
    values.push(value);
  };

  if (Object.prototype.hasOwnProperty.call(body, "date_of_birth")) {
    add("date_of_birth", v.date(body.date_of_birth, "date_of_birth"));
  }
  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    add("phone", v.phone(body.phone, "phone"));
  }
  if (Object.prototype.hasOwnProperty.call(body, "gender")) {
    add(
      "gender",
      v.oneOf(body.gender, "gender", GENDERS, { required: false, label: "Gender" })
    );
  }
  v.done();

  return withTransaction(async (client) => {
    const before = await profileRow(client, actorId);
    if (!before) {
      // Self-heal legacy accounts without a profile row; never create a second
      // identity. This does not change the registration flow.
      await client.query(`INSERT INTO patient_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [actorId]);
    }

    const merged = {
      date_of_birth: "date_of_birth" in submitted ? submitted.date_of_birth : dateOnly(before?.date_of_birth),
      phone: "phone" in submitted ? submitted.phone : before?.phone || null,
      gender: "gender" in submitted ? submitted.gender : before?.gender || null,
    };
    const alreadyCompleted = Boolean(before?.profile_completed_at);
    const nowComplete =
      alreadyCompleted ||
      Boolean(merged.date_of_birth && merged.phone && merged.gender);

    // Compute completion in JS: PostgreSQL SET expressions see OLD column
    // values, so a CASE inside the UPDATE would miss fields set in this very
    // statement.
    values.push(nowComplete ? new Date() : null);
    const completionIndex = values.length;
    values.push(actorId);
    await client.query(
      `UPDATE patient_profiles
          SET ${sets.length ? `${sets.join(", ")},` : ""}
              profile_completed_at = CASE
                WHEN profile_completed_at IS NOT NULL THEN profile_completed_at
                ELSE $${completionIndex}
              END
        WHERE user_id = $${values.length}`,
      values
    );

    await auditService.recordMutation(client, {
      actorUserId: actorId,
      eventType: "patient.profile_updated",
      eventCategory: "configuration",
      entityType: "user",
      entityId: actorId,
      patientUserId: actorId,
      before: {
        date_of_birth: dateOnly(before?.date_of_birth),
        phone: before?.phone || null,
        gender: before?.gender || null,
      },
      after: merged,
      metadata: { fields: Object.keys(submitted), completed: nowComplete },
      context,
    });

    const after = await profileRow(client, actorId);
    return { profile: serializePatientProfile(after, { ...user, full_name: after?.full_name || user.full_name }) };
  });
}

const DOCTOR_SELECT = `
  SELECT u.id, u.full_name, u.status,
         dp.professional_title, dp.bio, dp.years_of_experience, dp.verification_status,
         s.name AS specialty, s.slug AS specialty_slug,
         d.name AS department_name, d.slug AS department_slug,
         cl.name AS location_name, cl.address_line1, cl.city, cl.timezone
    FROM users u
    JOIN user_roles ur   ON ur.user_id = u.id
    JOIN roles r         ON r.id = ur.role_id AND r.name = 'doctor'
    JOIN doctor_profiles dp ON dp.user_id = u.id
    JOIN specialties s   ON s.id = dp.specialty_id
    LEFT JOIN departments d       ON d.specialty_id = s.id
    LEFT JOIN clinic_locations cl ON cl.id = dp.primary_location_id
`;

async function availabilityFor(executor, doctorIds) {
  if (!doctorIds.length) return new Map();
  const { rows } = await executor.query(
    `SELECT doctor_user_id, weekday, start_time, end_time, consultation_type, slot_minutes
       FROM doctor_availability
      WHERE doctor_user_id = ANY($1::uuid[])
        AND is_active
        AND effective_from <= CURRENT_DATE
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      ORDER BY weekday, start_time`,
    [doctorIds]
  );
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.doctor_user_id)) grouped.set(row.doctor_user_id, []);
    grouped.get(row.doctor_user_id).push(row);
  }
  return grouped;
}

async function listDoctors({ query }) {
  const search = optionalText(query.search, 120);
  const specialty = optionalText(query.specialty, 100);
  const department = optionalText(query.department, 100);
  const location = optionalText(query.location, 150);
  const type = toDbConsultationType(query.consultation_type);

  const { rows } = await pool.query(
    `${DOCTOR_SELECT}
      WHERE u.status = 'active'
        AND dp.verification_status = 'verified'
        AND ($1::text IS NULL
             OR u.full_name ILIKE '%' || $1 || '%'
             OR s.name ILIKE '%' || $1 || '%'
             OR COALESCE(d.name, '') ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR s.name = $2 OR s.slug = $2)
        AND ($3::text IS NULL OR d.name = $3 OR d.slug = $3)
        AND ($4::text IS NULL OR cl.name = $4)
        AND ($5::text IS NULL OR EXISTS (
              SELECT 1 FROM doctor_availability da
               WHERE da.doctor_user_id = u.id
                 AND da.is_active
                 AND (da.consultation_type = $5 OR da.consultation_type = 'both')
            ))
      ORDER BY u.full_name`,
    [search, specialty, department, location, type]
  );

  const availability = await availabilityFor(pool, rows.map((row) => row.id));
  return {
    doctors: rows.map((row) => serializeDoctor(row, availability.get(row.id) || [])),
    total: rows.length,
  };
}

async function getDoctor({ params }) {
  const id = assertUuid(params.id, "Doctor");
  const { rows } = await pool.query(`${DOCTOR_SELECT} WHERE u.id = $1 AND u.status = 'active' AND dp.verification_status = 'verified'`, [id]);
  if (rows.length === 0) throw httpError(404, "not_found", "Doctor not found.");
  const availability = await availabilityFor(pool, [id]);
  return { doctor: serializeDoctor(rows[0], availability.get(id) || []) };
}

async function listDepartments() {
  const { rows } = await pool.query(
    `SELECT id, name, slug, kind, is_active FROM departments WHERE is_active ORDER BY name`
  );
  return { departments: rows.map(serializeDoctorDepartment) };
}

const QUICK_ACTIONS = [
  { key: "book", label: "Book Appointment", icon: "calendar-plus" },
  { key: "prescriptions", label: "View Prescriptions", icon: "pill" },
  { key: "labs", label: "View Lab Results", icon: "flask" },
  { key: "records", label: "Access Medical Records", icon: "folder" },
];

async function getDashboard({ actorId, user }) {
  const userId = actorId;

  const [appointments, medications, labs, careTeam, records, reports] = await Promise.all([
    pool.query(
      `SELECT a.*, s.name AS specialty, u.full_name AS doctor_full_name,
              cl.name AS location_name, cl.address_line1, cl.city
         FROM appointments a
         JOIN specialties s ON s.id = a.specialty_id
         JOIN users u       ON u.id = a.doctor_user_id
         LEFT JOIN clinic_locations cl ON cl.id = a.clinic_location_id
        WHERE a.patient_user_id = $1
        ORDER BY COALESCE(a.scheduled_start_at, a.requested_start_at) DESC NULLS LAST
        LIMIT 20`,
      [userId]
    ),
    pool.query(
      `SELECT id, medication_name, dosage, status, started_on, ended_on
         FROM patient_medications
        WHERE patient_user_id = $1 AND superseded_by_id IS NULL AND status = 'active'
        ORDER BY recorded_at DESC`,
      [userId]
    ),
    pool.query(
      `SELECT tr.id AS result_id, tr.abnormal_flag, tr.resulted_at,
              tor.id AS order_id, tor.test_name, tor.completed_at, tor.ordered_at
         FROM test_orders tor
         JOIN test_results tr ON tr.test_order_id = tor.id
        WHERE tor.patient_user_id = $1
          AND tr.result_status <> 'preliminary'
          AND tr.superseded_by_id IS NULL
        ORDER BY tr.resulted_at DESC
        LIMIT 20`,
      [userId]
    ),
    pool.query(
      `SELECT DISTINCT ON (u.id) u.id, u.full_name, s.name AS specialty
         FROM care_relationships cr
         JOIN users u          ON u.id = cr.doctor_user_id
         LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
         LEFT JOIN specialties s      ON s.id = dp.specialty_id
        WHERE cr.patient_user_id = $1
          AND cr.status = 'active'
          AND (cr.expires_at IS NULL OR cr.expires_at > now())
        ORDER BY u.id, cr.granted_at DESC`,
      [userId]
    ),
    pool.query(
      `SELECT c.id, s.name AS specialty, u.full_name AS doctor_full_name,
              c.ended_at, c.started_at, c.created_at
         FROM consultations c
         LEFT JOIN appointments a ON a.id = c.appointment_id
         LEFT JOIN specialties s  ON s.id = a.specialty_id
         JOIN users u             ON u.id = c.doctor_user_id
        WHERE c.patient_user_id = $1 AND c.status = 'completed'
        ORDER BY c.ended_at DESC NULLS LAST
        LIMIT 10`,
      [userId]
    ),
    pool.query(
      `SELECT id, consultation_id, report_type, created_at, published_at
         FROM medical_reports
        WHERE patient_user_id = $1
          AND report_type = 'report_1_patient_summary'
          AND publication_state = 'published'
        ORDER BY published_at DESC NULLS LAST
        LIMIT 10`,
      [userId]
    ),
  ]);

  const appointmentRows = appointments.rows;
  const upcoming = appointmentRows.filter((row) =>
    ["requested", "pending_confirmation", "confirmed", "checked_in", "in_progress"].includes(row.status)
  );
  const next = upcoming.find((row) => {
    const at = new Date(row.scheduled_start_at || row.requested_start_at);
    return !Number.isNaN(at.getTime()) && at.getTime() >= Date.now();
  }) || upcoming[0] || null;

  const nextAppointment = next
    ? {
        doctor: next.doctor_full_name,
        specialty: next.specialty,
        date: dateOnly(next.scheduled_start_at || next.requested_start_at),
        time: timeLabel(next.scheduled_start_at || next.requested_start_at),
        location: next.location_name || "",
        address: next.address_line1 || "",
      }
    : null;

  const medicalRecords = [
    ...records.rows.map((row) => ({
      id: row.id,
      title: row.specialty ? `${row.specialty} consultation` : "Consultation",
      doctor: row.doctor_full_name || "",
      date: dateOnly(row.ended_at || row.started_at || row.created_at) || "",
      icon: "stethoscope",
    })),
    ...reports.rows.map((row) => ({
      id: row.id,
      title: "Patient summary report",
      doctor: "",
      date: dateOnly(row.published_at || row.created_at) || "",
      icon: "file",
    })),
  ].slice(0, 5);

  // Group lab results by order so the card count matches the lab list page.
  const labGroups = new Map();
  for (const row of labs.rows) {
    if (!labGroups.has(row.order_id)) {
      labGroups.set(row.order_id, { id: row.order_id, name: row.test_name, date: dateOnly(row.completed_at || row.resulted_at), abnormal: false });
    }
    if (labStatusFromFlag(row.abnormal_flag) === "Abnormal") labGroups.get(row.order_id).abnormal = true;
  }

  const labResults = [...labGroups.values()].slice(0, 5).map((group) => ({
    id: group.id,
    name: group.name,
    date: group.date || "",
    status: group.abnormal ? "Slightly High" : "Normal",
    icon: "flask",
    tone: group.abnormal ? "rose" : "teal",
  }));

  const activePrescriptions = medications.rows.map((row) => ({
    id: row.id,
    medication: row.medication_name,
    dosage: row.dosage || "",
    status: "Active",
  }));

  const nameParts = String(user.full_name || "").trim().split(/\s+/);
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    timeZone: "Africa/Cairo",
  }).format(now);

  return {
    dashboard: {
      patient: {
        id: userId,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" "),
        fullName: user.full_name,
        role: "Patient",
        avatar: null,
      },
      today,
      nextAppointment,
      recentAppointments: appointmentRows.slice(0, 5).map(serializeDashboardAppointment),
      activePrescriptions,
      // No vitals or messaging tables exist (decisions D-9/D-4).
      vitals: [],
      quickActions: QUICK_ACTIONS,
      medicalRecords,
      labResults,
      careTeam: careTeam.rows.map((row) => ({ id: row.id, name: row.full_name, specialty: row.specialty || "" })),
      patientMessages: [],
      unreadMessageCount: 0,
      dashboardStats: [
        { key: "appointments", label: "Upcoming Appointments", value: upcoming.length, icon: "calendar", tone: "teal" },
        { key: "records", label: "Medical Records", value: medicalRecords.length, icon: "file", tone: "blue" },
        { key: "prescriptions", label: "Active Prescriptions", value: activePrescriptions.length, icon: "pill", tone: "amber" },
        { key: "labs", label: "Lab Results", value: labResults.length, icon: "flask", tone: "violet" },
      ],
    },
  };
}

module.exports = {
  getProfile,
  updateProfile,
  listDoctors,
  getDoctor,
  listDepartments,
  getDashboard,
  DOCTOR_SELECT,
  availabilityFor,
  localDateIn,
  iso,
};

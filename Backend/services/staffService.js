/**
 * Receptionist/staff workspace (Phase 9). API-first: small, operational
 * payloads only, never clinical content.
 */
const pool = require("../config/db");
const { httpError } = require("../utils/httpError");
const { assertUuid, iso, dateOnly } = require("../utils/dbHelpers");

async function getMe({ actorId }) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.status, u.created_at,
            sp.*, d.name AS department, cl.name AS location_name
       FROM users u
       JOIN staff_profiles sp ON sp.user_id = u.id
       JOIN departments d     ON d.id = sp.department_id
       LEFT JOIN clinic_locations cl ON cl.id = sp.primary_location_id
      WHERE u.id = $1`,
    [actorId]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Staff profile not found.");
  const row = rows[0];
  return {
    profile: {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      accountStatus: row.status,
      jobTitle: row.job_title,
      department: row.department,
      employmentId: row.employment_id || null,
      phone: row.phone || null,
      workShift: row.work_shift || null,
      primaryLocationId: row.primary_location_id || null,
      locationName: row.location_name || null,
      joinedAt: iso(row.created_at),
    },
  };
}

async function getDashboard() {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*) FROM appointments
         WHERE COALESCE(scheduled_start_at, requested_start_at) >= date_trunc('day', now())
           AND COALESCE(scheduled_start_at, requested_start_at) < date_trunc('day', now()) + interval '1 day')::int AS today_total,
       (SELECT count(*) FROM appointments
         WHERE status IN ('requested', 'pending_confirmation'))::int AS awaiting_confirmation,
       (SELECT count(*) FROM appointments
         WHERE status = 'confirmed'
           AND scheduled_start_at >= date_trunc('day', now())
           AND scheduled_start_at < date_trunc('day', now()) + interval '1 day')::int AS today_confirmed,
       (SELECT count(*) FROM appointments
         WHERE status = 'checked_in')::int AS checked_in,
       (SELECT count(*) FROM appointments
         WHERE status = 'in_progress')::int AS in_progress,
       (SELECT count(*) FROM appointments
         WHERE status = 'completed'
           AND completed_at >= date_trunc('day', now()))::int AS completed_today,
       (SELECT count(*) FROM appointments
         WHERE status = 'no_show'
           AND COALESCE(scheduled_start_at, requested_start_at) >= date_trunc('day', now()))::int AS no_shows_today,
       (SELECT count(*) FROM appointments
         WHERE status = 'cancelled'
           AND cancelled_at >= date_trunc('day', now()))::int AS cancelled_today`
  );
  return { dashboard: rows[0] };
}

async function getPatient({ params }) {
  const id = assertUuid(params.id, "Patient");
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.status, u.created_at,
            p.date_of_birth, p.phone, p.gender, p.profile_completed_at
       FROM users u
       LEFT JOIN patient_profiles p ON p.user_id = u.id
      WHERE u.id = $1
        AND EXISTS (SELECT 1 FROM user_roles ur
                      JOIN roles r ON r.id = ur.role_id AND r.name = 'patient'
                     WHERE ur.user_id = u.id)`,
    [id]
  );
  if (rows.length === 0) throw httpError(404, "not_found", "Patient not found.");
  const row = rows[0];
  return {
    patient: {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      accountStatus: row.status,
      dateOfBirth: dateOnly(row.date_of_birth),
      phone: row.phone || null,
      gender: row.gender || null,
      profileCompletedAt: iso(row.profile_completed_at),
      joinedAt: iso(row.created_at),
    },
  };
}

module.exports = { getMe, getDashboard, getPatient };

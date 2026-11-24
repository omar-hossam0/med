/**
 * Shared fixtures for the database-backed endpoint suites.
 *
 * These suites only run when DB_PASSWORD is configured (see DB_ENABLED). Use a
 * DISPOSABLE database: fixtures are written with @medora.example addresses and
 * removed in cleanup. audit_logs is append-only, so its evidence rows remain.
 */
const crypto = require("crypto");
const pool = require("../../config/db");
const authService = require("../../services/authService");

const DB_ENABLED = Boolean(process.env.DB_PASSWORD) && process.env.MEDORA_RUN_DB_TESTS !== "0";
const PASSWORD = "FixturePassword123";

function unique(prefix) {
  return `${prefix}.${Date.now()}.${crypto.randomBytes(3).toString("hex")}@medora.example`;
}

async function startServer() {
  const app = require("../../server");
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function mintSession(userId, sessionHashes) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const random = crypto.randomBytes(24).toString("hex");
  const signature = crypto.createHmac("sha256", token).update(random).digest("hex");
  const csrf = `${random}.${signature}`;
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '2 hours')`,
    [userId, tokenHash]
  );
  sessionHashes.push(tokenHash);
  return { cookie: `medora_session=${token}; medora_csrf=${csrf}`, csrf, token };
}

function api(baseUrl, path, { method = "GET", body, session, csrf = true, headers = {} } = {}) {
  const requestHeaders = { Accept: "application/json", ...headers };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  if (session) requestHeaders.Cookie = session.cookie;
  if (csrf && method !== "GET" && session) requestHeaders["x-csrf-token"] = session.csrf;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (response) => ({
    status: response.status,
    body: await response.json().catch(() => null),
  }));
}

async function referenceIds() {
  const [specialty, department, location] = await Promise.all([
    pool.query(`SELECT id FROM specialties WHERE is_active ORDER BY name LIMIT 1`),
    pool.query(`SELECT id FROM departments WHERE is_active ORDER BY name LIMIT 1`),
    pool.query(`SELECT id, timezone FROM clinic_locations WHERE is_active ORDER BY name LIMIT 1`),
  ]);
  return {
    specialtyId: specialty.rows[0]?.id,
    departmentId: department.rows[0]?.id,
    locationId: location.rows[0]?.id,
    timezone: location.rows[0]?.timezone || "Africa/Cairo",
  };
}

async function createPatient(label, userIds) {
  const email = unique(`patient.${label}`);
  const patient = await authService.registerPatient({ fullName: `Fixture ${label} Patient`, email, password: PASSWORD });
  userIds.push(patient.id);
  return { id: patient.id, email };
}

async function createDoctor(label, userIds, { specialtyId, locationId }) {
  const email = unique(`doctor.${label}`);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, status)
     VALUES ($1, $2, NULL, 'active') RETURNING id`,
    [`Fixture ${label} Doctor`, email]
  );
  const id = rows[0].id;
  userIds.push(id);
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = 'doctor'`,
    [id]
  );
  await pool.query(
    `INSERT INTO doctor_profiles
       (user_id, specialty_id, license_number, verification_status,
        license_verified_at, years_of_experience, primary_location_id)
     VALUES ($1, $2, $3, 'verified', now(), 10, $4)`,
    [id, specialtyId, `FIXTURE-LIC-${id.slice(0, 8)}`, locationId]
  );
  return { id, email };
}

async function createStaff(label, userIds, { departmentId, locationId }) {
  const email = unique(`staff.${label}`);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, status)
     VALUES ($1, $2, NULL, 'active') RETURNING id`,
    [`Fixture ${label} Staff`, email]
  );
  const id = rows[0].id;
  userIds.push(id);
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = 'receptionist'`,
    [id]
  );
  await pool.query(
    `INSERT INTO staff_profiles (user_id, department_id, job_title, primary_location_id)
     VALUES ($1, $2, 'Fixture Receptionist', $3)`,
    [id, departmentId, locationId]
  );
  return { id, email };
}

async function findAdmin() {
  const { rows } = await pool.query(
    `SELECT u.id FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.name = 'admin'
     ORDER BY u.created_at LIMIT 1`
  );
  return rows[0]?.id || null;
}

/**
 * Best-effort cleanup for a disposable database. Deletes in dependency order
 * because most clinical foreign keys are ON DELETE RESTRICT. audit_logs is
 * append-only and intentionally retained as evidence.
 */
async function cleanup(userIds, sessionHashes) {
  if (userIds.length === 0) return;
  const ids = userIds;
  const statements = [
    `DELETE FROM rag_citations WHERE rag_query_id IN (SELECT id FROM rag_queries WHERE asked_by_user_id = ANY($1::uuid[]))`,
    `DELETE FROM rag_queries WHERE asked_by_user_id = ANY($1::uuid[])`,
    `DELETE FROM record_update_proposals WHERE patient_user_id = ANY($1::uuid[])`,
    `DELETE FROM test_results WHERE test_order_id IN (SELECT id FROM test_orders WHERE patient_user_id = ANY($1::uuid[]))`,
    `DELETE FROM test_orders WHERE patient_user_id = ANY($1::uuid[])`,
    `DELETE FROM medical_history_entries WHERE patient_user_id = ANY($1::uuid[])`,
    `DELETE FROM patient_allergies WHERE patient_user_id = ANY($1::uuid[])`,
    `DELETE FROM patient_medications WHERE patient_user_id = ANY($1::uuid[])`,
    `DELETE FROM medical_conditions WHERE patient_user_id = ANY($1::uuid[])`,
    `DELETE FROM appointment_proposals WHERE patient_user_id = ANY($1::uuid[]) OR doctor_user_id = ANY($1::uuid[])`,
    `DELETE FROM follow_ups WHERE patient_user_id = ANY($1::uuid[]) OR doctor_user_id = ANY($1::uuid[])`,
    `DELETE FROM notifications WHERE recipient_user_id = ANY($1::uuid[])`,
    `DELETE FROM report_versions WHERE report_id IN (SELECT id FROM medical_reports WHERE patient_user_id = ANY($1::uuid[]))`,
    `DELETE FROM medical_reports WHERE patient_user_id = ANY($1::uuid[]) OR doctor_user_id = ANY($1::uuid[])`,
    `DELETE FROM transcript_versions WHERE transcript_id IN (SELECT id FROM transcripts WHERE consultation_id IN (SELECT id FROM consultations WHERE patient_user_id = ANY($1::uuid[])))`,
    `DELETE FROM transcripts WHERE consultation_id IN (SELECT id FROM consultations WHERE patient_user_id = ANY($1::uuid[]))`,
    `DELETE FROM consultation_recordings WHERE consultation_id IN (SELECT id FROM consultations WHERE patient_user_id = ANY($1::uuid[]))`,
    `DELETE FROM consultation_consents WHERE consultation_id IN (SELECT id FROM consultations WHERE patient_user_id = ANY($1::uuid[]))`,
    `DELETE FROM consultations WHERE patient_user_id = ANY($1::uuid[]) OR doctor_user_id = ANY($1::uuid[])`,
    `DELETE FROM care_relationships WHERE patient_user_id = ANY($1::uuid[]) OR doctor_user_id = ANY($1::uuid[])`,
    `DELETE FROM doctor_time_off WHERE doctor_user_id = ANY($1::uuid[])`,
    `DELETE FROM doctor_availability WHERE doctor_user_id = ANY($1::uuid[])`,
    `DELETE FROM appointments WHERE patient_user_id = ANY($1::uuid[]) OR doctor_user_id = ANY($1::uuid[])`,
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql, [ids]);
    } catch (err) {
      // A table may not exist on an older schema; keep cleaning the rest.
      console.warn(`[fixtures] cleanup skipped: ${err.message}`);
    }
  }
  if (sessionHashes.length > 0) {
    await pool.query(`DELETE FROM sessions WHERE token_hash = ANY($1::text[])`, [sessionHashes]);
  }
  try {
    await pool.query(`DELETE FROM doctor_profiles WHERE user_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM staff_profiles WHERE user_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
  } catch (err) {
    console.warn(`[fixtures] user cleanup incomplete: ${err.message}`);
  }
}

module.exports = {
  DB_ENABLED,
  PASSWORD,
  unique,
  startServer,
  mintSession,
  api,
  referenceIds,
  createPatient,
  createDoctor,
  createStaff,
  findAdmin,
  cleanup,
};

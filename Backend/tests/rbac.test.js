/**
 * RBAC / CSRF regression tests that do not need a live database.
 *
 * The session lookup and the pg pool query method are replaced with in-memory
 * fakes, so the real Express stack (middleware → routes → controllers →
 * services → serializers) still runs end to end. Run with `npm run test:rbac`.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const pool = require("../config/db");
const authService = require("../services/authService");

const originalQuery = pool.query;
const originalGetSession = authService.getSessionByToken;
const originalToken = process.env.AGENT_SERVICE_TOKEN;

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";
const DOCTOR_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";

const sessions = new Map();

function mint(userId, roles, permissions) {
  const token = crypto.randomBytes(32).toString("hex");
  const random = crypto.randomBytes(24).toString("hex");
  const signature = crypto.createHmac("sha256", token).update(random).digest("hex");
  const csrf = `${random}.${signature}`;
  sessions.set(token, {
    session: { id: "44444444-4444-4444-8444-444444444444", expires_at: new Date(Date.now() + 3600000) },
    user: {
      id: userId,
      full_name: "Test User",
      email: `test-${userId.slice(0, 4)}@medora.example`,
      status: "active",
      roles,
      permissions,
    },
  });
  return { cookie: `medora_session=${token}; medora_csrf=${csrf}`, csrf };
}

// Patch BEFORE requiring the app: middleware/auth.js destructures this export
// at module load time.
authService.getSessionByToken = async (token) => sessions.get(token) || null;
const app = require("../server");

describe("Endpoint authorization matrix (stubbed DB)", () => {
  let server;
  let baseUrl;
  let patient;
  let doctor;
  let admin;

  before(async () => {
    process.env.AGENT_SERVICE_TOKEN = "rbac-test-service-token";
    patient = mint(PATIENT_ID, ["patient"], ["appointments.create", "appointments.view_own", "reports.view_own"]);
    doctor = mint(DOCTOR_ID, ["doctor"], ["appointments.view_own", "transcripts.approve", "reports.approve"]);
    admin = mint(ADMIN_ID, ["admin"], ["users.manage", "staff_accounts.view"]);

    pool.query = async (sql) => {
      if (sql.includes("FROM patient_profiles p")) {
        return {
          rows: [{
            user_id: PATIENT_ID,
            date_of_birth: "1990-01-01",
            phone: null,
            gender: null,
            profile_completed_at: null,
            full_name: "Test User",
            email: `test-${PATIENT_ID.slice(0, 4)}@medora.example`,
          }],
        };
      }
      return { rows: [], rowCount: 0 };
    };

    await new Promise((resolve) => { server = app.listen(0, resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    pool.query = originalQuery;
    authService.getSessionByToken = originalGetSession;
    if (originalToken === undefined) delete process.env.AGENT_SERVICE_TOKEN;
    else process.env.AGENT_SERVICE_TOKEN = originalToken;
  });

  async function api(path, { method = "GET", body, session, csrf = true } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (session) headers.Cookie = session.cookie;
    if (csrf && method !== "GET" && session) headers["x-csrf-token"] = session.csrf;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }

  it("401 for anonymous access to every protected family", async () => {
    for (const path of [
      "/api/patient/profile", "/api/doctor/me", "/api/staff/dashboard",
      "/api/admin/dashboard", "/api/notifications", "/api/reference/documents",
      "/api/internal/agents/reports",
    ]) {
      const result = await api(path);
      assert.equal(result.status, 401, `${path} should require authentication`);
    }
  });

  it("patient reads only their own profile, with no secrets in the payload", async () => {
    const result = await api("/api/patient/profile", { session: patient });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.profile.id, PATIENT_ID);
    const serialized = JSON.stringify(result.body);
    for (const forbidden of ["password_hash", "token_hash", "internal_notes", "content"]) {
      assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
    }
  });

  it("403 for a doctor on patient endpoints", async () => {
    assert.equal((await api("/api/patient/profile", { session: doctor })).status, 403);
    assert.equal((await api("/api/patient/dashboard", { session: doctor })).status, 403);
  });

  it("403 for a patient on doctor, staff and admin endpoints", async () => {
    assert.equal((await api("/api/doctor/me", { session: patient })).status, 403);
    assert.equal((await api("/api/staff/dashboard", { session: patient })).status, 403);
    assert.equal((await api("/api/admin/dashboard", { session: patient })).status, 403);
    assert.equal((await api("/api/admin/ai/reports", { session: patient })).status, 403);
  });

  it("403 for a doctor on admin and staff endpoints", async () => {
    assert.equal((await api("/api/admin/dashboard", { session: doctor })).status, 403);
    assert.equal((await api("/api/staff/appointments", { session: doctor })).status, 403);
  });

  it("baseline RBAC check endpoints still respond", async () => {
    assert.equal((await api("/api/patient/check", { session: patient })).status, 200);
    assert.equal((await api("/api/admin/check", { session: admin })).status, 200);
    assert.equal((await api("/api/admin/check", { session: patient })).status, 403);
  });

  it("CSRF is enforced on patient mutations", async () => {
    const missing = await api("/api/patient/profile", {
      method: "PATCH", session: patient, csrf: false, body: { gender: "female" },
    });
    assert.equal(missing.status, 403);
  });

  it("admin AI monitoring never returns clinical fields", async () => {
    // The service returns an allowlisted shape; the pool fake returns no rows,
    // so assert on the envelope rather than fabricated data.
    const result = await api("/api/admin/ai/reports", { session: admin });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(Array.isArray(result.body.reports), true);
    const serialized = JSON.stringify(result.body);
    for (const forbidden of ["content", "patient_user_id", "patientName"]) {
      assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
    }
  });
});

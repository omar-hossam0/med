/**
 * Phase 10 integration suite — admin dashboard, AI monitoring and departments.
 * Strictly operational: every assertion guards against clinical data leakage.
 * Requires a disposable DB with one Admin account already provisioned.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../config/db");
const fixtures = require("./helpers/fixtures");

const { DB_ENABLED } = fixtures;

describe("Admin extensions (DB)", { skip: !DB_ENABLED }, () => {
  let server;
  let baseUrl;
  const sessionHashes = [];
  const createdDepartmentIds = [];
  let adminSession;

  before(async () => {
    const adminId = await fixtures.findAdmin();
    assert.ok(adminId, "An Admin account is required. Run `npm run bootstrap:admin` against the disposable test database.");
    adminSession = await fixtures.mintSession(adminId, sessionHashes);
    const started = await fixtures.startServer();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    for (const id of createdDepartmentIds) {
      // Only departments created by this suite (support, no specialty) are removed.
      await pool.query(`DELETE FROM departments WHERE id = $1 AND kind = 'support' AND specialty_id IS NULL`, [id]);
    }
    if (sessionHashes.length > 0) {
      await pool.query(`DELETE FROM sessions WHERE token_hash = ANY($1::text[])`, [sessionHashes]);
    }
  });

  it("GET /api/admin/dashboard matches the A.6 shape and contains no clinical data", async () => {
    const response = await fixtures.api(baseUrl, "/api/admin/dashboard", { session: adminSession });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const body = response.body;
    for (const key of ["kpis", "trendDays", "trendSeries", "departments", "notifications", "quickActions", "systemHealth", "recentAppointments", "recentUsers", "adminUser", "today"]) {
      assert.ok(key in body, `missing ${key}`);
    }
    const serialized = JSON.stringify(body);
    for (const forbidden of ["content", "patient_user_id", "transcript", "diagnosis", "internal_notes"]) {
      assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
    }
    assert.equal(body.trendDays.length, 7);
    assert.equal(body.trendSeries.length, 3);
  });

  it("AI monitoring endpoints return sanitized, allowlisted payloads", async () => {
    const paths = [
      "/api/admin/ai/reports?range=7d",
      "/api/admin/ai/summary?range=30d",
      "/api/admin/ai/daily-series?range=7d",
      "/api/admin/ai/doctors/ranking?range=90d",
      "/api/admin/ai/health",
      "/api/admin/ai/activities",
    ];
    for (const path of paths) {
      const response = await fixtures.api(baseUrl, path, { session: adminSession });
      assert.equal(response.status, 200, `${path}: ${JSON.stringify(response.body)}`);
      assert.equal(response.body.success, true);
      const serialized = JSON.stringify(response.body);
      for (const forbidden of ["content", "patient_user_id", "patientName", "transcript", "CLINICAL"]) {
        assert.equal(serialized.includes(forbidden), false, `${path} leaked ${forbidden}`);
      }
    }
  });

  it("GET /api/admin/ai/reports/:id/events is empty for an unknown execution", async () => {
    const response = await fixtures.api(baseUrl, "/api/admin/ai/reports/00000000-0000-4000-8000-000000000000/events", { session: adminSession });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.events, []);
  });

  it("department cards expose honest empties for columns that do not exist", async () => {
    const response = await fixtures.api(baseUrl, "/api/admin/departments", { session: adminSession });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(Array.isArray(response.body.departments));
    for (const department of response.body.departments) {
      assert.deepEqual(department.services, []);
      assert.equal(department.description, "");
      assert.equal(department.displayOrder, 0);
      assert.ok("stats" in department);
      assert.ok(Array.isArray(department.recentActivity));
    }
  });

  it("an admin can create and edit a support department", async () => {
    const suffix = `${Date.now()}`;
    const created = await fixtures.api(baseUrl, "/api/admin/departments", {
      method: "POST", session: adminSession,
      body: { name: `Fixture Support ${suffix}`, slug: `fixture-support-${suffix}`, description: "ignored" },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    createdDepartmentIds.push(created.body.department.id);
    assert.equal(created.body.department.status, "active");

    const updated = await fixtures.api(baseUrl, `/api/admin/departments/${created.body.department.id}`, {
      method: "PATCH", session: adminSession, body: { status: "inactive" },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.department.status, "inactive");
  });

  it("services persistence is blocked until a migration is approved (D-12)", async () => {
    const list = await fixtures.api(baseUrl, "/api/admin/departments", { session: adminSession });
    const id = list.body.departments[0].id;
    const response = await fixtures.api(baseUrl, `/api/admin/departments/${id}/services`, {
      method: "PUT", session: adminSession, body: { services: ["Consultation"] },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "dependency_conflict");
  });

  it("admin extensions are 403 for non-admin roles", async () => {
    // Mint a patient session to prove the matrix, without requiring a second admin.
    const userIds = [];
    const patient = await fixtures.createPatient("admin-deny", userIds);
    const patientSession = await fixtures.mintSession(patient.id, sessionHashes);
    const response = await fixtures.api(baseUrl, "/api/admin/dashboard", { session: patientSession });
    assert.equal(response.status, 403);
    await fixtures.cleanup(userIds, []);
  });
});

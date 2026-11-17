/**
 * Phase 2 integration suite — patient profile, doctor directory, dashboard.
 * Requires a disposable migrated database (DB_PASSWORD + MEDORA_RUN_DB_TESTS).
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../config/db");
const fixtures = require("./helpers/fixtures");
const { iso } = require("../utils/dbHelpers");

const { DB_ENABLED } = fixtures;

describe("Patient endpoints (DB)", { skip: !DB_ENABLED }, () => {
  let server;
  let baseUrl;
  const userIds = [];
  const sessionHashes = [];
  let patientA;
  let patientB;
  let doctor;
  let sessionA;
  let sessionB;
  let refs;
  let otherAppointmentId;

  before(async () => {
    refs = await fixtures.referenceIds();
    assert.ok(refs.specialtyId && refs.departmentId && refs.locationId, "Seed vocabularies are required (migrations 003/004).");
    patientA = await fixtures.createPatient("a", userIds);
    patientB = await fixtures.createPatient("b", userIds);
    doctor = await fixtures.createDoctor("directory", userIds, refs);
    sessionA = await fixtures.mintSession(patientA.id, sessionHashes);
    sessionB = await fixtures.mintSession(patientB.id, sessionHashes);

    // An appointment belonging to patient B, used to prove dashboard scoping.
    const start = new Date(Date.now() + 3 * 86400000).toISOString();
    const end = new Date(Date.now() + 3 * 86400000 + 1800000).toISOString();
    const inserted = await pool.query(
      `INSERT INTO appointments
         (patient_user_id, doctor_user_id, specialty_id, clinic_location_id,
          consultation_type, status, requested_start_at, requested_end_at,
          scheduled_start_at, scheduled_end_at, confirmed_at, confirmed_by_user_id,
          booked_by_user_id, version)
       VALUES ($1, $2, $3, $4, 'in_person', 'confirmed', $5, $6, $5, $6, now(), $2, $2, 1)
       RETURNING id`,
      [patientB.id, doctor.id, refs.specialtyId, refs.locationId, start, end]
    );
    otherAppointmentId = inserted.rows[0].id;

    const started = await fixtures.startServer();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await fixtures.cleanup(userIds, sessionHashes);
  });

  it("GET /api/patient/profile returns only the caller's demographics", async () => {
    const response = await fixtures.api(baseUrl, "/api/patient/profile", { session: sessionA });
    assert.equal(response.status, 200);
    assert.equal(response.body.profile.id, patientA.id);
    assert.equal(response.body.profile.completed, false);
    assert.equal(JSON.stringify(response.body).includes("password_hash"), false);
  });

  it("PATCH /api/patient/profile ignores role/status/email and writes an audit row", async () => {
    const response = await fixtures.api(baseUrl, "/api/patient/profile", {
      method: "PATCH",
      session: sessionA,
      body: { phone: "+20 100 000 0000", gender: "female", date_of_birth: "1990-05-05", role: "admin", status: "disabled", email: "attacker@medora.example" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.profile.phone, "+20 100 000 0000");
    assert.equal(response.body.profile.completed, true);

    const { rows } = await pool.query(
      `SELECT u.email, u.status, p.phone, p.gender FROM users u
        JOIN patient_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [patientA.id]
    );
    assert.notEqual(rows[0].email, "attacker@medora.example");
    assert.equal(rows[0].status, "active");

    const audit = await pool.query(
      `SELECT id FROM audit_logs WHERE event_type = 'patient.profile_updated' AND entity_id = $1`,
      [patientA.id]
    );
    assert.ok(audit.rowCount >= 1, "profile update must be audited");
  });

  it("GET /api/patient/dashboard never contains another patient's appointment", async () => {
    const response = await fixtures.api(baseUrl, "/api/patient/dashboard", { session: sessionA });
    assert.equal(response.status, 200);
    assert.equal(JSON.stringify(response.body).includes(otherAppointmentId), false);
    assert.equal(Array.isArray(response.body.dashboard.vitals), true);
    assert.equal(response.body.dashboard.vitals.length, 0, "no vitals table exists");
    assert.equal(response.body.dashboard.patientMessages.length, 0, "no messaging table exists");
  });

  it("GET /api/patient/doctors returns the verified doctor with honest empties", async () => {
    const response = await fixtures.api(baseUrl, "/api/patient/doctors", { session: sessionA });
    assert.equal(response.status, 200);
    const found = response.body.doctors.find((item) => item.id === doctor.id);
    assert.ok(found, "verified doctor is listed");
    assert.equal(found.verified, true);
    assert.equal(found.photoUrl, null);
    assert.deepEqual(found.patientReviews, []);
    assert.equal(JSON.stringify(found).includes("license_number"), false);
  });

  it("GET /api/patient/doctors/:id and /departments respond", async () => {
    const detail = await fixtures.api(baseUrl, `/api/patient/doctors/${doctor.id}`, { session: sessionA });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.doctor.id, doctor.id);
    const departments = await fixtures.api(baseUrl, "/api/patient/departments", { session: sessionA });
    assert.equal(departments.status, 200);
    assert.ok(Array.isArray(departments.body.departments));
  });

  it("a patient cannot read another patient's appointment", async () => {
    const detail = await fixtures.api(baseUrl, `/api/patient/appointments/${otherAppointmentId}`, { session: sessionA });
    assert.equal(detail.status, 404);
    const timeline = await fixtures.api(baseUrl, `/api/patient/appointments/${otherAppointmentId}/timeline`, { session: sessionA });
    assert.equal(timeline.status, 404);
  });

  it("a second patient session cannot see the first patient's profile", async () => {
    const own = await fixtures.api(baseUrl, "/api/patient/profile", { session: sessionB });
    assert.equal(own.body.profile.id, patientB.id);
    assert.notEqual(own.body.profile.id, patientA.id);
  });

  it("rejects an invalid gender with 400 validation_error", async () => {
    const response = await fixtures.api(baseUrl, "/api/patient/profile", {
      method: "PATCH", session: sessionA, body: { gender: "not_a_value" },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "validation_error");
  });

  it("audit rows never contain the request body or clinical content", async () => {
    const { rows } = await pool.query(
      `SELECT before_state, after_state, metadata FROM audit_logs
        WHERE event_type = 'patient.profile_updated' AND entity_id = $1`,
      [patientA.id]
    );
    for (const row of rows) {
      assert.equal(JSON.stringify(row).includes("attacker@medora.example"), false);
    }
  });

  void iso;
});

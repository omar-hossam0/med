/**
 * Medora — Admin dashboard API test suite
 *
 * Drives the real Express app over HTTP against the development database.
 * Fixtures use @medora.example addresses and are removed in `after`.
 *
 * Requires an admin account (npm run bootstrap:admin) and migrations 004–005.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const pool = require("../config/db");
const app = require("../server");
const authService = require("../services/authService");

describe("Admin dashboard API", () => {
  let server;
  let baseUrl;
  let adminId;
  let adminSession;
  let patientSession;
  const createdUserIds = [];
  const createdEmails = [];
  const mintedSessionHashes = [];

  const stamp = Date.now();
  const doctorEmail = `test.doctor.${stamp}@medora.example`;
  const staffEmail = `test.staff.${stamp}@medora.example`;
  const patientEmail = `test.patient.${stamp}@medora.example`;
  const licenseNumber = `TEST-LIC-${stamp}`;
  const activationPassword = "StrongPassword123";

  let doctorId;
  let doctorInvitationToken;

  async function mintSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const random = crypto.randomBytes(24).toString("hex");
    const signature = crypto
      .createHmac("sha256", token)
      .update(random)
      .digest("hex");
    const csrf = `${random}.${signature}`;

    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '2 hours')`,
      [userId, tokenHash]
    );
    mintedSessionHashes.push(tokenHash);

    return {
      cookie: `medora_session=${token}; medora_csrf=${csrf}`,
      csrf,
    };
  }

  async function api(path, { method = "GET", body, session = adminSession, csrf = true } = {}) {
    const headers = { Accept: "application/json" };

    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (session) headers.Cookie = session.cookie;
    if (csrf && method !== "GET" && session) {
      headers["x-csrf-token"] = session.csrf;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const json = await response.json().catch(() => null);
    return { status: response.status, body: json };
  }

  before(async () => {
    const admin = await pool.query(
      `SELECT u.id
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r       ON r.id = ur.role_id
       WHERE r.name = 'admin'
       ORDER BY u.created_at
       LIMIT 1`
    );

    assert.ok(
      admin.rowCount > 0,
      "An admin account is required. Run `npm run bootstrap:admin` first."
    );

    adminId = admin.rows[0].id;
    adminSession = await mintSession(adminId);

    const patient = await authService.registerPatient({
      fullName: "Admin Test Patient",
      email: patientEmail,
      password: activationPassword,
    });
    createdUserIds.push(patient.id);
    createdEmails.push(patientEmail);
    patientSession = await mintSession(patient.id);

    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM security_events WHERE user_id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
      await pool.query("DELETE FROM audit_logs WHERE entity_id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [createdUserIds]);
    }

    if (mintedSessionHashes.length > 0) {
      await pool.query("DELETE FROM sessions WHERE token_hash = ANY($1::text[])", [
        mintedSessionHashes,
      ]);
    }

    await pool.end();
  });

  it("1. rejects an anonymous request", async () => {
    const { status } = await api("/api/admin/users", { session: null });
    assert.equal(status, 401);
  });

  it("2. rejects a non-admin session", async () => {
    const { status } = await api("/api/admin/users", { session: patientSession });
    assert.equal(status, 403);
  });

  it("3. lists accounts with a contract-shaped payload", async () => {
    const { status, body } = await api("/api/admin/users");

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.users));

    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes("password_hash"), "must never leak password hashes");

    for (const user of body.users) {
      assert.ok(user.id && user.name && user.email);
      assert.ok(["patient", "doctor", "staff"].includes(user.role));
      assert.ok(["active", "pending", "suspended", "inactive"].includes(user.status));
      assert.match(user.joinedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("4. stats add up and exclude the admin", async () => {
    const { body } = await api("/api/admin/users");
    const { stats, users } = body;

    assert.equal(stats.total, stats.patients + stats.doctors + stats.staff);
    assert.ok(!users.some((u) => u.email === "alaaeldeen@medora.local"));
  });

  it("5. filters by role", async () => {
    const { body } = await api("/api/admin/users?role=staff");
    assert.ok(body.users.every((u) => u.role === "staff"));
  });

  it("6. provisions a doctor atomically", async () => {
    const reference = await api("/api/admin/reference-data");
    const cardiology = reference.body.specialties.find((s) => s.name === "Cardiology");
    const location = reference.body.locations[0];

    const { status, body } = await api("/api/admin/users", {
      method: "POST",
      body: {
        full_name: "Dr. Test Cardiology",
        email: doctorEmail,
        phone: "+20 100 000 0001",
        date_of_birth: "1990-04-15",
        role: "doctor",
        location_id: location.id,
        about: "Automated test fixture.",
        doctor: {
          specialty_id: cardiology.id,
          department: "Cardiology",
          license_number: licenseNumber,
          professional_title: "Consultant Cardiologist",
          years_of_experience: 8,
        },
      },
    });

    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.user.role, "doctor");
    assert.equal(body.user.status, "pending");
    assert.ok(body.invitation.activation_token);

    doctorId = body.user.id;
    doctorInvitationToken = body.invitation.activation_token;
    createdUserIds.push(doctorId);
    createdEmails.push(doctorEmail);

    const counts = await pool.query(
      `SELECT
         (SELECT count(*) FROM users WHERE id = $1)::int AS users,
         (SELECT count(*) FROM doctor_profiles WHERE user_id = $1)::int AS profiles,
         (SELECT count(*) FROM user_invitations WHERE user_id = $1)::int AS invitations,
         (SELECT count(*) FROM notifications WHERE recipient_user_id = $1)::int AS notifications,
         (SELECT count(*) FROM audit_logs WHERE entity_id = $1 AND action = 'user.provisioned')::int AS audits`,
      [doctorId]
    );

    assert.deepEqual(counts.rows[0], {
      users: 1,
      profiles: 1,
      invitations: 1,
      notifications: 1,
      audits: 1,
    });
  });

  it("7. rejects a duplicate email", async () => {
    const { status, body } = await api("/api/admin/users", {
      method: "POST",
      body: {
        full_name: "Duplicate Doctor",
        email: doctorEmail.toUpperCase(),
        role: "doctor",
        doctor: { specialty: "Cardiology", license_number: `OTHER-${stamp}` },
      },
    });

    assert.equal(status, 409);
    assert.equal(body.code, "email_taken");
  });

  it("8. rejects a duplicate licence", async () => {
    const { status, body } = await api("/api/admin/users", {
      method: "POST",
      body: {
        full_name: "Second Doctor",
        email: `test.second.${stamp}@medora.example`,
        role: "doctor",
        doctor: { specialty: "Cardiology", license_number: licenseNumber },
      },
    });

    assert.equal(status, 409);
    assert.equal(body.code, "license_taken");
  });

  it("9. refuses to provision an admin", async () => {
    const { status } = await api("/api/admin/users", {
      method: "POST",
      body: {
        full_name: "Sneaky Admin",
        email: `test.admin.${stamp}@medora.example`,
        role: "admin",
      },
    });

    assert.equal(status, 400);
  });

  it("10. rejects a department that does not match the specialty", async () => {
    const { status, body } = await api("/api/admin/users", {
      method: "POST",
      body: {
        full_name: "Mismatched Doctor",
        email: `test.mismatch.${stamp}@medora.example`,
        role: "doctor",
        doctor: {
          specialty: "Cardiology",
          department: "Nursing",
          license_number: `MISMATCH-${stamp}`,
        },
      },
    });

    assert.equal(status, 400);
    assert.equal(body.code, "department_specialty_mismatch");
  });

  it("11. provisions staff with an employment record", async () => {
    const { status, body } = await api("/api/admin/users", {
      method: "POST",
      body: {
        full_name: "Test Receptionist",
        email: staffEmail,
        role: "staff",
        staff: {
          job_title: "Receptionist",
          department: "Administration",
          employment_id: `EMP-${stamp}`,
          work_shift: "Mon-Fri, 9:00 AM - 5:00 PM",
        },
      },
    });

    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.user.role, "staff");

    createdUserIds.push(body.user.id);
    createdEmails.push(staffEmail);
  });

  it("12. returns both kinds in the directory with honest empty fields", async () => {
    const { status, body } = await api("/api/admin/doctors-staff");

    assert.equal(status, 200);
    assert.equal(body.stats.total, body.stats.doctors + body.stats.staff);

    const doctor = body.members.find((m) => m.id === doctorId);
    assert.ok(doctor, "the provisioned doctor must appear");
    assert.equal(doctor.kind, "doctor");
    assert.equal(doctor.specialty, "Cardiology");
    assert.equal(doctor.department, "Cardiology");
    assert.equal(doctor.verification, "pending");
    assert.equal(doctor.duty, "off");
    assert.deepEqual(doctor.services, []);
    assert.deepEqual(doctor.availability, []);
    assert.equal(doctor.nextShift, null);

    const staff = body.members.find((m) => m.email === staffEmail);
    assert.ok(staff, "the provisioned staff member must appear");
    assert.equal(staff.kind, "staff");
    assert.equal(staff.jobTitle, "Receptionist");
    assert.equal(staff.department, "Administration");
  });

  it("13. refuses to activate a pending account through the status endpoint", async () => {
    const { status, body } = await api(`/api/admin/users/${doctorId}/status`, {
      method: "PATCH",
      body: { status: "active", reason: "Trying to skip activation" },
    });

    assert.equal(status, 409);
    assert.equal(body.code, "invalid_status_transition");
  });

  it("14. activates the account with the one-time token", async () => {
    const { status, body } = await api("/api/auth/activate", {
      method: "POST",
      session: null,
      csrf: false,
      body: { token: doctorInvitationToken, password: activationPassword },
    });

    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.user.status, "active");

    const replay = await api("/api/auth/activate", {
      method: "POST",
      session: null,
      csrf: false,
      body: { token: doctorInvitationToken, password: activationPassword },
    });
    assert.equal(replay.status, 400);
    assert.equal(replay.body.code, "token_invalid");
  });

  it("15. lets the activated doctor sign in", async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: doctorEmail, password: activationPassword }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.user.roles, ["doctor"]);

    // Clean the session this login created.
    const token = /medora_session=([^;]+)/.exec(response.headers.get("set-cookie") || "");
    if (token) {
      const hash = crypto.createHash("sha256").update(token[1]).digest("hex");
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hash]);
    }
  });

  it("16. issues a password-reset link and refuses a second activation invite", async () => {
    const reset = await api(`/api/admin/users/${doctorId}/invitations`, {
      method: "POST",
      body: { purpose: "password_reset" },
    });

    assert.equal(reset.status, 201, JSON.stringify(reset.body));
    assert.match(reset.body.invitation.activation_path, /token=[a-f0-9]{64}/);

    const second = await api(`/api/admin/users/${doctorId}/invitations`, {
      method: "POST",
      body: { purpose: "invite" },
    });

    assert.equal(second.status, 409);
    assert.equal(second.body.code, "invitation_not_applicable");

    const live = await pool.query(
      `SELECT count(*)::int AS total
       FROM user_invitations
       WHERE user_id = $1 AND purpose = 'password_reset'
         AND used_at IS NULL AND revoked_at IS NULL`,
      [doctorId]
    );
    assert.equal(live.rows[0].total, 1, "exactly one live reset token");
  });

  it("17. requires a reason for a status change", async () => {
    const { status } = await api(`/api/admin/users/${doctorId}/status`, {
      method: "PATCH",
      body: { status: "suspended" },
    });

    assert.equal(status, 400);
  });

  it("18. suspends with a reason and writes audit plus security events", async () => {
    const { status, body } = await api(`/api/admin/users/${doctorId}/status`, {
      method: "PATCH",
      body: { status: "suspended", reason: "Automated test suspension" },
    });

    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.user.status, "suspended");

    const audit = await pool.query(
      `SELECT metadata FROM audit_logs
       WHERE entity_id = $1 AND action = 'user.status_changed'
       ORDER BY occurred_at DESC LIMIT 1`,
      [doctorId]
    );
    assert.equal(audit.rows[0].metadata.reason, "Automated test suspension");

    const security = await pool.query(
      `SELECT count(*)::int AS total FROM security_events
       WHERE user_id = $1 AND event_type = 'privilege_changed'`,
      [doctorId]
    );
    assert.ok(security.rows[0].total >= 1);
  });

  it("19. refuses a self status change", async () => {
    const { status, body } = await api(`/api/admin/users/${adminId}/status`, {
      method: "PATCH",
      body: { status: "suspended", reason: "Self lockout attempt" },
    });

    assert.equal(status, 403);
    assert.equal(body.code, "self_lockout");
  });

  it("20. verifies and then rejects a licence", async () => {
    const verified = await api(`/api/admin/doctors-staff/${doctorId}/verification`, {
      method: "POST",
      body: { status: "verified", note: "Checked against the registry" },
    });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.member.verification, "verified");

    const rejected = await api(`/api/admin/doctors-staff/${doctorId}/verification`, {
      method: "POST",
      body: { status: "rejected", note: "Registry mismatch" },
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.member.verification, "rejected");

    const row = await pool.query(
      `SELECT license_verified_at FROM doctor_profiles WHERE user_id = $1`,
      [doctorId]
    );
    assert.equal(row.rows[0].license_verified_at, null);
  });

  it("21. rejects a mutation without the CSRF header", async () => {
    const { status } = await api(`/api/admin/users/${doctorId}/status`, {
      method: "PATCH",
      csrf: false,
      body: { status: "disabled", reason: "No CSRF token" },
    });

    assert.equal(status, 403);
  });

  it("22. returns 404 for an unknown member id", async () => {
    const { status } = await api(
      "/api/admin/doctors-staff/00000000-0000-4000-8000-000000000000"
    );
    assert.equal(status, 404);
  });

  it("23. returns the reference data the admin forms depend on", async () => {
    const { status, body } = await api("/api/admin/reference-data");

    assert.equal(status, 200);
    assert.ok(body.specialties.length >= 12, "all seeded specialties");
    assert.ok(body.locations.length >= 1, "at least one clinic location");

    const clinical = body.departments.filter((d) => d.kind === "clinical");
    const support = body.departments.filter((d) => d.kind === "support");

    assert.ok(clinical.length >= 12);
    assert.ok(support.length >= 3);
    assert.ok(clinical.every((d) => Boolean(d.specialty_id)));
    assert.ok(support.every((d) => d.specialty_id === null));
  });
});

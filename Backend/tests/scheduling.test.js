/**
 * Phase 3 integration suite — slot generation, booking, optimistic concurrency
 * and the audited appointment status timeline. Requires a disposable DB.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../config/db");
const fixtures = require("./helpers/fixtures");
const { zonedTimeToUtc, localDateIn } = require("../utils/dbHelpers");

const { DB_ENABLED } = fixtures;

describe("Scheduling endpoints (DB)", { skip: !DB_ENABLED }, () => {
  let server;
  let baseUrl;
  const userIds = [];
  const sessionHashes = [];
  let patient;
  let doctor;
  let staff;
  let patientSession;
  let staffSession;
  let refs;
  let date;
  let slot09;
  let slot10;
  let availabilityId;
  let timeOffId;

  before(async () => {
    refs = await fixtures.referenceIds();
    patient = await fixtures.createPatient("sched", userIds);
    doctor = await fixtures.createDoctor("sched", userIds, refs);
    staff = await fixtures.createStaff("sched", userIds, refs);
    patientSession = await fixtures.mintSession(patient.id, sessionHashes);
    staffSession = await fixtures.mintSession(staff.id, sessionHashes);

    const future = new Date(Date.now() + 4 * 86400000);
    date = localDateIn(refs.timezone, future);
    const [year, month, day] = date.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
    slot09 = zonedTimeToUtc(year, month, day, 9, 0, refs.timezone);
    slot10 = zonedTimeToUtc(year, month, day, 10, 0, refs.timezone);

    const window = await pool.query(
      `INSERT INTO doctor_availability
         (doctor_user_id, clinic_location_id, weekday, start_time, end_time,
          slot_minutes, consultation_type, effective_from, is_active)
       VALUES ($1, $2, $3, '09:00', '11:00', 30, 'both', CURRENT_DATE - interval '1 day', TRUE)
       RETURNING id`,
      [doctor.id, refs.locationId, weekday]
    );
    availabilityId = window.rows[0].id;

    const blocked = await pool.query(
      `INSERT INTO doctor_time_off (doctor_user_id, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, 'Fixture leave') RETURNING id`,
      [doctor.id, slot09, new Date(slot09.getTime() + 30 * 60000)]
    );
    timeOffId = blocked.rows[0].id;

    const started = await fixtures.startServer();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await fixtures.cleanup(userIds, sessionHashes);
  });

  function bookingBody(start) {
    return {
      doctor_id: doctor.id,
      specialty_id: refs.specialtyId,
      clinic_location_id: refs.locationId,
      consultation_type: "in_person",
      requested_start_at: start.toISOString(),
      requested_end_at: new Date(start.getTime() + 30 * 60000).toISOString(),
      reason: "Fixture consultation",
      patient_notes: "Fixture note",
    };
  }

  it("GET slots excludes doctor time-off", async () => {
    const response = await fixtures.api(
      baseUrl,
      `/api/patient/availability/slots?doctor_id=${doctor.id}&date=${date}&consultation_type=in_person`,
      { session: patientSession }
    );
    assert.equal(response.status, 200);
    const slots = response.body.slots;
    assert.ok(slots.length >= 3);
    assert.equal(slots[0].available, false, "09:00 is covered by time-off");
    assert.equal(slots[1].available, true);
    assert.equal(response.body.consultation_type, "in_person");
  });

  it("rejects invalid slot parameters", async () => {
    const response = await fixtures.api(
      baseUrl,
      `/api/patient/availability/slots?doctor_id=not-a-uuid&date=${date}&consultation_type=in_person`,
      { session: patientSession }
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "validation_error");
  });

  it("POST appointment creates a care relationship, audit rows and a staff notification", async () => {
    const response = await fixtures.api(baseUrl, "/api/patient/appointments", {
      method: "POST", session: patientSession, body: bookingBody(slot10),
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.appointment.status, "Upcoming");
    assert.equal(response.body.appointment.doctorId, doctor.id);

    const appointmentId = response.body.appointment.id;
    const care = await pool.query(
      `SELECT * FROM care_relationships WHERE patient_user_id = $1 AND doctor_user_id = $2 AND status = 'active'`,
      [patient.id, doctor.id]
    );
    assert.equal(care.rowCount, 1);
    assert.equal(care.rows[0].source, "appointment");

    const audit = await pool.query(
      `SELECT event_type FROM audit_logs WHERE event_type IN ('appointment.created','appointment.status_changed') AND entity_id = $1`,
      [appointmentId]
    );
    assert.ok(audit.rowCount >= 2, "creation and status transition must be audited");

    const timeline = await pool.query(
      `SELECT * FROM v_appointment_status_timeline WHERE appointment_id = $1`,
      [appointmentId]
    );
    assert.equal(timeline.rowCount >= 1, true);
    assert.equal(timeline.rows[0].to_status, "requested");

    const notifications = await pool.query(
      `SELECT count(*)::int AS total FROM notifications WHERE category = 'appointment' AND related_entity_id = $1`,
      [appointmentId]
    );
    assert.ok(notifications.rows[0].total >= 1);
  });

  it("rejects a double booking with 409 slot_taken", async () => {
    const response = await fixtures.api(baseUrl, "/api/patient/appointments", {
      method: "POST", session: patientSession, body: bookingBody(slot10),
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "slot_taken");
  });

  it("cancel requires an approved reason and the current version", async () => {
    const list = await fixtures.api(baseUrl, "/api/patient/appointments", { session: patientSession });
    const appointment = list.body.appointments[0];
    assert.ok(appointment);

    const badReason = await fixtures.api(baseUrl, `/api/patient/appointments/${appointment.id}/cancel`, {
      method: "POST", session: patientSession,
      body: { version: appointment.version, cancellation_reason: "Because I can" },
    });
    assert.equal(badReason.status, 400);

    const stale = await fixtures.api(baseUrl, `/api/patient/appointments/${appointment.id}/cancel`, {
      method: "POST", session: patientSession,
      body: { version: appointment.version + 99, cancellation_reason: "Schedule conflict" },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "version_conflict");

    const cancelled = await fixtures.api(baseUrl, `/api/patient/appointments/${appointment.id}/cancel`, {
      method: "POST", session: patientSession,
      body: { version: appointment.version, cancellation_reason: "Schedule conflict", notes: "Fixture" },
    });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(cancelled.body.appointment.status, "Cancelled");

    const timeline = await fixtures.api(baseUrl, `/api/patient/appointments/${appointment.id}/timeline`, { session: patientSession });
    assert.equal(timeline.status, 200);
    assert.ok(timeline.body.timeline.some((entry) => entry.toStatus === "cancelled"));
  });

  it("staff can schedule, confirm, check in and complete an appointment", async () => {
    // The last slot of the 09:00-11:00 window (10:30-11:00).
    const secondSlot = new Date(slot10.getTime() + 30 * 60000);
    const created = await fixtures.api(baseUrl, "/api/patient/appointments", {
      method: "POST", session: patientSession, body: bookingBody(secondSlot),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.appointment.id;
    let version = created.body.appointment.version;

    const scheduled = await fixtures.api(baseUrl, `/api/staff/appointments/${id}/schedule`, {
      method: "PATCH", session: staffSession,
      body: {
        version,
        scheduled_start_at: secondSlot.toISOString(),
        scheduled_end_at: new Date(secondSlot.getTime() + 30 * 60000).toISOString(),
        clinic_location_id: refs.locationId,
      },
    });
    assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body));
    version = scheduled.body.appointment.version;

    const confirmed = await fixtures.api(baseUrl, `/api/staff/appointments/${id}/confirm`, {
      method: "POST", session: staffSession, body: { version },
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.appointment.rawStatus, "confirmed");
    version = confirmed.body.appointment.version;

    const consultation = await pool.query(`SELECT id FROM consultations WHERE appointment_id = $1`, [id]);
    assert.equal(consultation.rowCount, 1, "confirmation creates the clinical encounter");

    const checkIn = await fixtures.api(baseUrl, `/api/staff/appointments/${id}/check-in`, {
      method: "POST", session: staffSession, body: {},
    });
    assert.equal(checkIn.status, 200);
    const start = await fixtures.api(baseUrl, `/api/staff/appointments/${id}/start`, {
      method: "POST", session: staffSession, body: {},
    });
    assert.equal(start.status, 200);
    const complete = await fixtures.api(baseUrl, `/api/staff/appointments/${id}/complete`, {
      method: "POST", session: staffSession, body: {},
    });
    assert.equal(complete.status, 200, JSON.stringify(complete.body));
    assert.equal(complete.body.appointment.rawStatus, "completed");

    const timeline = await pool.query(
      `SELECT to_status FROM v_appointment_status_timeline WHERE appointment_id = $1 ORDER BY changed_at`,
      [id]
    );
    const statuses = timeline.rows.map((row) => row.to_status);
    for (const expected of ["requested", "pending_confirmation", "confirmed", "checked_in", "in_progress", "completed"]) {
      assert.ok(statuses.includes(expected), `timeline missing ${expected}`);
    }
    void version;
  });

  it("patient responses never include internal_notes", async () => {
    const staffList = await fixtures.api(baseUrl, "/api/staff/appointments", { session: staffSession });
    assert.equal(staffList.status, 200);
    const patientList = await fixtures.api(baseUrl, "/api/patient/appointments", { session: patientSession });
    for (const appointment of patientList.body.appointments) {
      assert.equal("internalNotes" in appointment, false);
    }
  });

  it("doctor sees only assigned appointments", async () => {
    const doctorSession = await fixtures.mintSession(doctor.id, sessionHashes);
    const list = await fixtures.api(baseUrl, "/api/doctor/appointments", { session: doctorSession });
    assert.equal(list.status, 200);
    for (const appointment of list.body.appointments) {
      assert.equal(appointment.doctorId, doctor.id);
    }
  });

  void availabilityId;
  void timeOffId;
});

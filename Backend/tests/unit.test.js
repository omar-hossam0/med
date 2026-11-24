/**
 * Pure unit tests — no PostgreSQL required.
 *
 * Covers the shared foundation added for the endpoint work: validators,
 * serializers, error mapping, slot generation, service authentication and the
 * operational-data sanitization rules. Run with `npm run test:unit`.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const {
  mapDbError, sha256, pagination, page, zonedTimeToUtc, localDateIn, dateOnly, iso,
} = require("../utils/dbHelpers");
const {
  serializeAppointment, serializeDoctor, serializeSlot, appointmentReference,
  toUiAppointmentStatus, toDbConsultationType, serializePatientProfile,
} = require("../utils/patientSerializers");
const {
  labStatusFromFlag, medicalRecordEntry, serializeMedication, serializeLabObservation,
} = require("../utils/clinicalSerializers");
const { generateSlots } = require("../services/schedulingService");
const { hasCareAccess } = require("../services/accessService");
const { safeEqual, requireServiceAuth } = require("../middleware/serviceAuth");
const { sanitize, summarize } = require("../services/adminAiMonitoringService");
const { maskPatient } = require("../services/adminDashboardService");

describe("Validator extensions", () => {
  it("accepts and normalizes ISO datetimes", () => {
    const v = new Validator();
    assert.equal(v.datetime("2026-11-20T10:30:00Z", "at"), "2026-11-20T10:30:00.000Z");
    assert.equal(v.datetime("2026-11-20T10:30", "at"), "2026-11-20T10:30:00.000Z");
    assert.equal(v.hasErrors, false);
  });

  it("rejects a malformed datetime", () => {
    const v = new Validator();
    v.datetime("not-a-date", "at");
    assert.throws(() => v.done(), (err) => err.statusCode === 400 && err.code === "validation_error");
  });

  it("accepts future calendar dates but rejects impossible ones", () => {
    const v = new Validator();
    assert.equal(v.isoDate("2030-01-05", "date"), "2030-01-05");
    assert.equal(v.hasErrors, false);
    const bad = new Validator();
    bad.isoDate("2030-02-30", "date");
    assert.equal(bad.hasErrors, true);
  });

  it("validates time, weekday, JSON objects and SHA-256 hashes", () => {
    const v = new Validator();
    assert.equal(v.timeOfDay("09:30", "start"), "09:30:00");
    assert.equal(v.weekday(0, "weekday"), 0);
    assert.deepEqual(v.jsonObject({ a: 1 }, "payload"), { a: 1 });
    const hash = crypto.createHash("sha256").update("x").digest("hex");
    assert.equal(v.hexHash(hash, "hash"), hash);
    assert.equal(v.hasErrors, false);
  });

  it("rejects arrays as JSON objects, bad weekdays and bad hashes", () => {
    const v = new Validator();
    v.jsonObject([1, 2], "payload");
    v.weekday(9, "weekday");
    v.hexHash("nope", "hash");
    assert.equal(v.errors.length, 3);
  });

  it("accepts true/false in boolean and string form", () => {
    const v = new Validator();
    assert.equal(v.boolean("true", "flag"), true);
    assert.equal(v.boolean(false, "flag"), false);
    assert.equal(v.hasErrors, false);
  });
});

describe("dbHelpers", () => {
  it("maps PostgreSQL constraint failures to stable API codes", () => {
    assert.equal(mapDbError({ code: "23505", constraint: "uq_appointment_proposals_live_slot" }).code, "slot_taken");
    assert.equal(mapDbError({ code: "23505", constraint: "uq_agent_executions_idempotency" }).code, "agent_execution_conflict");
    assert.equal(mapDbError({ code: "23001" }).code, "version_conflict");
    assert.equal(mapDbError({ code: "42501" }).code, "clinical_access_denied");
    assert.equal(
      mapDbError({ code: "23514", message: "agent_executions/agent_1: transcript version X has not been reviewed by a doctor" }).code,
      "transcript_not_approved"
    );
    assert.equal(
      mapDbError({ code: "23514", message: "agent_executions/agent_2: report version X has not been reviewed by a doctor" }).code,
      "report_not_approved"
    );
  });

  it("preserves deliberate HttpErrors unchanged", () => {
    const err = httpError(409, "consent_required", "Consent missing");
    assert.equal(mapDbError(err), err);
  });

  it("produces deterministic hashes and bounded pagination", () => {
    assert.equal(sha256("abc"), crypto.createHash("sha256").update("abc").digest("hex"));
    assert.deepEqual(pagination({ limit: "9999", offset: "-4" }), { limit: 200, offset: 0 });
    const result = page([1, 2, 3, 4], { limit: 2, offset: 1 });
    assert.deepEqual(result.rows, [2, 3]);
    assert.equal(result.pagination.hasMore, true);
  });

  it("converts Cairo wall-clock time to the correct UTC instant", () => {
    // Africa/Cairo is UTC+2 in winter; 09:00 local = 07:00 UTC.
    const utc = zonedTimeToUtc(2026, 11, 20, 9, 0, "Africa/Cairo");
    assert.equal(utc.toISOString(), "2026-11-20T07:00:00.000Z");
    assert.match(localDateIn("Africa/Cairo", new Date("2026-11-20T22:30:00Z")), /^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalizes pg DATE and TIMESTAMPTZ values", () => {
    assert.equal(dateOnly("2026-11-20T10:00:00Z"), "2026-11-20");
    assert.equal(iso(new Date("2026-11-20T10:00:00Z")), "2026-11-20T10:00:00.000Z");
    assert.equal(iso(null), null);
  });
});

describe("Patient serializers", () => {
  it("maps the nine database statuses into the three UI buckets", () => {
    assert.equal(toUiAppointmentStatus("requested"), "Upcoming");
    assert.equal(toUiAppointmentStatus("in_progress"), "Upcoming");
    assert.equal(toUiAppointmentStatus("completed"), "Completed");
    assert.equal(toUiAppointmentStatus("cancelled"), "Cancelled");
    assert.equal(toUiAppointmentStatus("no_show"), "Cancelled");
    assert.equal(toDbConsultationType("In-Person"), "in_person");
    assert.equal(toDbConsultationType("Online"), "online");
  });

  it("never exposes internal_notes in a patient response", () => {
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      doctor_user_id: "22222222-2222-4222-8222-222222222222",
      consultation_type: "in_person",
      status: "confirmed",
      scheduled_start_at: "2026-11-20T09:00:00Z",
      scheduled_end_at: "2026-11-20T09:30:00Z",
      internal_notes: "STAFF ONLY",
      version: 1,
    };
    const patientShape = serializeAppointment(row);
    assert.equal(patientShape.internalNotes, undefined);
    assert.equal(patientShape.durationMinutes, 30);
    assert.equal(patientShape.consultationType, "In-Person");
    assert.equal(patientShape.status, "Upcoming");
    assert.match(appointmentReference(row.id), /^MDR-[0-9A-F]{8}$/);
    const staffShape = serializeAppointment(row, { includeInternal: true });
    assert.equal(staffShape.internalNotes, "STAFF ONLY");
  });

  it("returns honest empties for doctor fields with no table", () => {
    const doctor = serializeDoctor({
      id: "33333333-3333-4333-8333-333333333333",
      full_name: "Dr. Test",
      professional_title: "Consultant",
      specialty: "Cardiology",
      verification_status: "verified",
      years_of_experience: 12,
    }, []);
    assert.equal(doctor.verified, true);
    assert.equal(doctor.photoUrl, null);
    assert.deepEqual(doctor.patientReviews, []);
    assert.deepEqual(doctor.languages, []);
    assert.deepEqual(doctor.services, []);
    assert.deepEqual(doctor.weekly, {});
    assert.equal(doctor.supportsInPerson, false);
    assert.equal(doctor.supportsOnline, false);
  });

  it("builds doctor weekly windows and consultation support flags", () => {
    const doctor = serializeDoctor({ id: "x", full_name: "Dr. A" }, [
      { weekday: 1, start_time: "09:00:00", end_time: "12:00:00", consultation_type: "both" },
    ]);
    assert.deepEqual(doctor.weekly[1], [{ start: "09:00", end: "12:00" }]);
    assert.equal(doctor.supportsInPerson, true);
    assert.equal(doctor.supportsOnline, true);
  });

  it("serializes slots without leaking internal fields", () => {
    const slot = serializeSlot({
      startsAt: new Date("2026-11-20T09:00:00Z"),
      endsAt: new Date("2026-11-20T09:30:00Z"),
      time: "11:00",
      available: true,
    });
    assert.deepEqual(Object.keys(slot).sort(), ["available", "endsAt", "startsAt", "time"]);
    assert.equal(slot.available, true);
  });

  it("returns a stable empty profile shape for legacy accounts", () => {
    const profile = serializePatientProfile(null, { id: "p1", full_name: "Test Patient", email: "t@example.test" });
    assert.equal(profile.completed, false);
    assert.equal(profile.profile_completed_at, null);
    assert.equal(profile.id, "p1");
  });
});

describe("Clinical serializers", () => {
  it("maps abnormal flags and never leaks preliminary-only values", () => {
    assert.equal(labStatusFromFlag("high"), "Abnormal");
    assert.equal(labStatusFromFlag("critical_low"), "Abnormal");
    assert.equal(labStatusFromFlag("normal"), "Normal");
    assert.equal(labStatusFromFlag(null), "Normal");
    const observation = serializeLabObservation({
      analyte_name: "Hb", value_numeric: "13.2", unit: "g/dL",
      reference_range: "12-16", abnormal_flag: "normal",
    });
    assert.equal(observation.status, "Normal");
    assert.equal(observation.value, "13.2");
  });

  it("builds record-feed keys and lowercased search text", () => {
    const entry = medicalRecordEntry({
      type: "visit", id: "v1", title: "Cardiology Visit",
      subtitle: "Follow up", facility: "Main Clinic", date: "2026-11-20", status: "Completed",
    });
    assert.equal(entry.key, "visit:v1");
    assert.equal(entry.searchText, "cardiology visit follow up main clinic");
  });

  it("does not invent refills or administration times", () => {
    const medication = serializeMedication({
      id: "m1", medication_name: "Aspirin", status: "active", source_type: "doctor_entered",
    }, "rx-1");
    assert.equal(medication.refillsRemaining, 0);
    assert.deepEqual(medication.times, []);
    assert.equal(medication.status, "Active");
  });
});

describe("Slot generation (fake executor)", () => {
  /** Minimal executor that returns canned rows based on query fragments. */
  function fakeExecutor({ windows, timeOff = [], appointments = [], proposals = [] }) {
    return {
      async query(sql) {
        if (sql.includes("JOIN doctor_profiles dp") && sql.includes("FROM users u")) {
          return { rows: [{ id: "d1", status: "active", verification_status: "verified", timezone: "Africa/Cairo" }], rowCount: 1 };
        }
        if (sql.includes("FROM doctor_availability")) return { rows: windows };
        if (sql.includes("FROM doctor_time_off")) return { rows: timeOff };
        if (sql.includes("FROM appointment_proposals")) return { rows: proposals };
        if (sql.includes("FROM appointments")) return { rows: appointments };
        return { rows: [] };
      },
    };
  }

  const future = new Date(Date.now() + 3 * 86400000);
  const date = localDateIn("Africa/Cairo", future);
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const slotFor = (hour, minute) => {
    const start = zonedTimeToUtc(year, month, day, hour, minute, "Africa/Cairo");
    return { start, end: new Date(start.getTime() + 30 * 60000) };
  };

  it("generates slots from an availability window", async () => {
    const result = await generateSlots(fakeExecutor({
      windows: [{ weekday, start_time: "09:00:00", end_time: "10:00:00", slot_minutes: 30, consultation_type: "both", window_timezone: "Africa/Cairo" }],
    }), { doctorId: "d1", date, consultationType: "in_person" });
    assert.equal(result.slots.length, 2);
    assert.equal(result.slots.every((slot) => slot.available), true);
    assert.match(result.slots[0].time, /^\d{2}:\d{2}$/);
  });

  it("subtracts time-off, booked appointments and live proposals", async () => {
    const first = slotFor(9, 0);
    const second = slotFor(9, 30);
    const result = await generateSlots(fakeExecutor({
      windows: [{ weekday, start_time: "09:00:00", end_time: "10:00:00", slot_minutes: 30, consultation_type: "both", window_timezone: "Africa/Cairo" }],
      appointments: [{ starts_at: first.start, ends_at: first.end }],
      proposals: [{ starts_at: second.start, ends_at: second.end }],
    }), { doctorId: "d1", date, consultationType: "in_person" });
    assert.equal(result.slots.filter((slot) => slot.available).length, 0);
  });

  it("subtracts a doctor time-off range overlapping the slot", async () => {
    const first = slotFor(9, 0);
    const result = await generateSlots(fakeExecutor({
      windows: [{ weekday, start_time: "09:00:00", end_time: "10:00:00", slot_minutes: 30, consultation_type: "in_person", window_timezone: "Africa/Cairo" }],
      timeOff: [{ starts_at: new Date(first.start.getTime() - 60000), ends_at: first.end }],
    }), { doctorId: "d1", date, consultationType: "in_person" });
    assert.equal(result.slots[0].available, false);
    assert.equal(result.slots[1].available, true);
  });

  it("rejects a date in the past", async () => {
    await assert.rejects(
      () => generateSlots(fakeExecutor({ windows: [] }), { doctorId: "d1", date: "2000-01-01", consultationType: "online" }),
      (err) => err.statusCode === 400
    );
  });
});

describe("Access control helpers", () => {
  it("hasCareAccess uses a parameterized EXISTS query with an expiry check", async () => {
    let captured = "";
    const executor = {
      async query(sql, params) {
        captured = sql;
        assert.equal(params[0], "patient-1");
        assert.equal(params[1], "doctor-1");
        return { rows: [{ granted: true }] };
      },
    };
    assert.equal(await hasCareAccess(executor, "doctor-1", "patient-1"), true);
    assert.match(captured, /care_relationships/);
    assert.match(captured, /expires_at > now\(\)/);
    assert.match(captured, /appointments/);
    assert.match(captured, /consultations/);
  });
});

describe("Service authentication", () => {
  it("compares tokens in constant time and rejects empty/mismatched values", () => {
    assert.equal(safeEqual("secret", "secret"), true);
    assert.equal(safeEqual("secret", "different"), false);
    assert.equal(safeEqual("", ""), false);
  });

  it("fails closed when AGENT_SERVICE_TOKEN is unset", () => {
    const previous = process.env.AGENT_SERVICE_TOKEN;
    delete process.env.AGENT_SERVICE_TOKEN;
    let captured;
    requireServiceAuth({ get: () => undefined, cookies: {} }, {}, (err) => { captured = err; });
    assert.equal(captured.statusCode, 503);
    assert.equal(captured.code, "service_auth_failed");
    if (previous !== undefined) process.env.AGENT_SERVICE_TOKEN = previous;
  });

  it("returns 403 for a browser session and 401 for an anonymous caller", () => {
    const previous = process.env.AGENT_SERVICE_TOKEN;
    process.env.AGENT_SERVICE_TOKEN = "test-service-token";
    let missing;
    requireServiceAuth({ get: () => undefined, cookies: {} }, {}, (err) => { missing = err; });
    assert.equal(missing.statusCode, 401);
    let browser;
    requireServiceAuth({ get: () => undefined, cookies: { medora_session: "abc" } }, {}, (err) => { browser = err; });
    assert.equal(browser.statusCode, 403);
    let called = false;
    requireServiceAuth({ get: (name) => name === "x-service-token" ? "test-service-token" : undefined, cookies: {} }, {}, (err) => {
      called = err === undefined;
    });
    assert.equal(called, true);
    if (previous === undefined) delete process.env.AGENT_SERVICE_TOKEN;
    else process.env.AGENT_SERVICE_TOKEN = previous;
  });
});

describe("Operational data sanitization", () => {
  it("AI monitoring rows never contain clinical or patient fields", () => {
    const row = sanitize({
      id: "job-1", consultation_id: "consult-1", status: "succeeded",
      doctor_id: "doc-1", doctor_name: "Dr. Test", specialty: "Cardiology",
      department: "Cardiology", created_at: "2026-11-20T10:00:00Z",
      started_at: "2026-11-20T10:00:00Z", completed_at: "2026-11-20T10:00:05Z",
      processing_seconds: "5", workflow_status: "approved",
      content: "CLINICAL NARRATIVE", patient_user_id: "patient-1",
      patient_name: "Real Patient",
    });
    const serialized = JSON.stringify(row);
    for (const forbidden of ["CLINICAL NARRATIVE", "patient_user_id", "patient-1", "Real Patient", "content"]) {
      assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
    }
    assert.equal(row.processingStatus, "success");
    assert.equal(row.processingSeconds, 5);
  });

  it("summarize derives counts rather than hardcoding them", () => {
    const summary = summarize([
      { workflowStatus: "approved", processingStatus: "success", processingSeconds: 10 },
      { workflowStatus: "draft", processingStatus: "failed", processingSeconds: null },
      { workflowStatus: "awaiting_review", processingStatus: "queued", processingSeconds: null },
    ]);
    assert.equal(summary.total, 3);
    assert.equal(summary.approved, 1);
    assert.equal(summary.successRate, 50);
    assert.equal(summary.averageSeconds, 10);
  });

  it("admin dashboard masks patient names", () => {
    assert.match(maskPatient("12345678-abcd-0000-0000-000000000000"), /^Patient [0-9A-F]{4}$/);
  });
});

describe("Route inventory", () => {
  const routers = {
    patient: require("../routes/patientRoutes"),
    doctor: require("../routes/doctorRoutes"),
    staff: require("../routes/staffRoutes"),
    notifications: require("../routes/notificationRoutes"),
    reference: require("../routes/referenceRoutes"),
    adminExtensions: require("../routes/adminExtensionRoutes"),
    internalAgents: require("../routes/internalAgentRoutes"),
  };

  function paths(router) {
    return router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  }

  it("patient router exposes profile, doctors, dashboard and clinical reads", () => {
    const p = paths(routers.patient);
    for (const expected of ["/profile", "/doctors", "/dashboard", "/appointments", "/availability/slots", "/medical-records", "/lab-results", "/prescriptions", "/medications", "/reports", "/follow-ups"]) {
      assert.ok(p.includes(expected), `missing ${expected}`);
    }
  });

  it("doctor router exposes consultations, transcripts, reports and proposals", () => {
    const p = paths(routers.doctor);
    for (const expected of ["/me", "/availability", "/consultations", "/consultations/:id/consents", "/transcripts/:id/versions", "/transcript-versions/:id/review", "/consultations/:id/reports", "/report-versions/:id/review", "/reports/:id/publish", "/patients/:id/record", "/proposals/:id/apply", "/follow-ups/:id/proposals"]) {
      assert.ok(p.includes(expected), `missing ${expected}`);
    }
  });

  it("staff router exposes scheduling operations and booking handoff", () => {
    const p = paths(routers.staff);
    for (const expected of ["/me", "/dashboard", "/appointments", "/appointments/:id/schedule", "/appointments/:id/confirm", "/appointments/:id/check-in", "/appointments/:id/start", "/appointments/:id/complete", "/appointments/:id/no-show", "/appointments/:id/notes", "/appointment-proposals/:id/book"]) {
      assert.ok(p.includes(expected), `missing ${expected}`);
    }
  });

  it("admin, reference and internal agent routers expose their catalogues", () => {
    const admin = paths(routers.adminExtensions);
    for (const expected of ["/dashboard", "/ai/reports", "/ai/summary", "/ai/daily-series", "/ai/doctors/ranking", "/ai/health", "/ai/activities", "/ai/reports/:id/events", "/departments", "/departments/:id/doctors", "/departments/:id/services"]) {
      assert.ok(admin.includes(expected), `missing ${expected}`);
    }
    const reference = paths(routers.reference);
    for (const expected of ["/documents", "/documents/:id", "/versions", "/versions/:id/extraction", "/versions/:id/quality-review", "/versions/:id/approve", "/versions/:id/index", "/versions/:id/chunks", "/rag/query", "/rag/queries/:id"]) {
      assert.ok(reference.includes(expected), `missing ${expected}`);
    }
    const agents = paths(routers.internalAgents);
    for (const expected of ["/transcription", "/reports", "/profile-organization", "/follow-up-scheduling", "/extraction"]) {
      assert.ok(agents.includes(expected), `missing ${expected}`);
    }
  });
});

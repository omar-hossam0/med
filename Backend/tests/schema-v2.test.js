#!/usr/bin/env node

/**
 * Medora Healthcare — Database Simplification V2 verification suite.
 *
 * Runs against the REAL configured database (Backend/config/db.js), inside ONE
 * transaction that is always rolled back. It therefore proves real PostgreSQL
 * behaviour — constraints, triggers, foreign keys — without leaving a single
 * fake row behind.
 *
 * Two sections:
 *   A. Schema assertions — table inventory, retired tables absent, migration
 *      history, constraint/trigger presence, no unvalidated foreign keys.
 *   B. Workflow assertions — patient / admin / receptionist / doctor / Agent 1 /
 *      Agent 2 / Agent 3 / OCR+RAG / security, each positive path plus the
 *      negative paths that must be refused by the database itself.
 *
 * Usage: npm run test:schema
 */

const pool = require("../config/db");

let passed = 0;
let failed = 0;
const failures = [];

function ok(label) {
  passed += 1;
  console.log(`  [PASS] ${label}`);
}

function fail(label, detail) {
  failed += 1;
  failures.push(`${label} — ${detail}`);
  console.log(`  [FAIL] ${label}\n         ${detail}`);
}

/** Assert a statement succeeds. */
async function expectOk(client, label, sql, params = []) {
  await client.query("SAVEPOINT assertion");
  try {
    const result = await client.query(sql, params);
    await client.query("RELEASE SAVEPOINT assertion");
    ok(label);
    return result;
  } catch (err) {
    await client.query("ROLLBACK TO SAVEPOINT assertion");
    await client.query("RELEASE SAVEPOINT assertion");
    fail(label, `expected success, got: ${err.message}`);
    return null;
  }
}

/** Assert a statement is refused and the error mentions `pattern`. */
async function expectFail(client, label, pattern, sql, params = []) {
  await client.query("SAVEPOINT assertion");
  try {
    await client.query(sql, params);
    await client.query("RELEASE SAVEPOINT assertion");
    fail(label, "expected the database to refuse this statement, but it succeeded");
  } catch (err) {
    await client.query("ROLLBACK TO SAVEPOINT assertion");
    await client.query("RELEASE SAVEPOINT assertion");
    if (pattern.test(err.message)) {
      ok(`${label} (refused: ${err.code || "error"})`);
    } else {
      fail(label, `refused for the wrong reason: ${err.message}`);
    }
  }
}

/** Assert a scalar equals an expected value. */
function expectEqual(label, actual, expected) {
  if (String(actual) === String(expected)) {
    ok(`${label} = ${expected}`);
  } else {
    fail(label, `expected ${expected}, got ${actual}`);
  }
}

const EXPECTED_TABLES = [
  "agent_executions",
  "appointment_proposals",
  "appointments",
  "audit_logs",
  "care_relationships",
  "clinic_locations",
  "consultation_consents",
  "consultation_recordings",
  "consultations",
  "departments",
  "doctor_availability",
  "doctor_profiles",
  "doctor_time_off",
  "follow_ups",
  "medical_conditions",
  "medical_history_entries",
  "medical_reports",
  "notifications",
  "patient_allergies",
  "patient_medications",
  "patient_profiles",
  "permissions",
  "rag_citations",
  "rag_queries",
  "record_update_proposals",
  "reference_chunks",
  "reference_document_versions",
  "reference_documents",
  "report_versions",
  "role_permissions",
  "roles",
  "schema_migrations",
  "sessions",
  "specialties",
  "staff_profiles",
  "test_orders",
  "test_results",
  "transcript_versions",
  "transcripts",
  "user_invitations",
  "user_roles",
  "users",
];

const RETIRED_TABLES = [
  "appointment_status_history",
  "transcript_approvals",
  "report_approvals",
  "report_deliveries",
  "document_extraction_jobs",
  "security_events",
];

// ---------------------------------------------------------------------------
// A. Schema assertions
// ---------------------------------------------------------------------------
async function checkSchema(client) {
  console.log("\nA. Schema assertions\n");

  const { rows: tableRows } = await client.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `);
  const tables = tableRows.map((r) => r.table_name);

  expectEqual("physical base table count", tables.length, 42);

  const missing = EXPECTED_TABLES.filter((t) => !tables.includes(t));
  const extra = tables.filter((t) => !EXPECTED_TABLES.includes(t));
  if (missing.length === 0 && extra.length === 0) {
    ok("table inventory matches the 42-table target exactly");
  } else {
    fail("table inventory matches the 42-table target exactly",
      `missing: ${missing.join(",") || "none"}; unexpected: ${extra.join(",") || "none"}`);
  }

  for (const retired of RETIRED_TABLES) {
    if (tables.includes(retired)) {
      fail(`retired table absent: ${retired}`, "still physically present");
    } else {
      ok(`retired table absent: ${retired}`);
    }
  }

  const { rows: history } = await client.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  expectEqual("applied migration count", history.length, 13);
  expectEqual(
    "migration versions",
    history.map((r) => r.version).join(","),
    "001,002,003,004,005,006,007,008,009,010,011,012,013"
  );

  const { rows: unvalidated } = await client.query(`
    SELECT count(*)::int AS n
      FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace
       AND contype = 'f' AND convalidated = false
  `);
  expectEqual("unvalidated foreign keys", unvalidated[0].n, 0);

  const { rows: counts } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM pg_constraint
        WHERE connamespace='public'::regnamespace AND contype='f') AS fks,
      (SELECT count(*)::int FROM pg_constraint
        WHERE connamespace='public'::regnamespace AND contype='c') AS checks,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public') AS indexes,
      (SELECT count(*)::int FROM pg_trigger t
         JOIN pg_class c ON c.oid=t.tgrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE NOT t.tgisinternal AND n.nspname='public') AS triggers
  `);
  console.log(
    `         (inventory: ${counts[0].fks} FKs, ${counts[0].checks} CHECKs, ` +
      `${counts[0].indexes} indexes, ${counts[0].triggers} triggers)`
  );

  const requiredTriggers = [
    ["audit_logs", "trg_audit_logs_append_only"],
    ["transcript_versions", "trg_transcript_versions_immutable"],
    ["transcript_versions", "trg_transcript_versions_reviewer"],
    ["transcript_versions", "trg_transcript_versions_sync_status"],
    ["report_versions", "trg_report_versions_immutable"],
    ["report_versions", "trg_report_versions_reviewer"],
    ["report_versions", "trg_report_versions_source_transcript"],
    ["medical_reports", "trg_medical_reports_publication"],
    ["agent_executions", "trg_agent_executions_inputs"],
    ["medical_conditions", "trg_medical_conditions_provenance"],
    ["test_results", "trg_test_results_provenance"],
  ];

  for (const [table, trigger] of requiredTriggers) {
    const { rows } = await client.query(
      `SELECT 1 FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND c.relname = $1 AND t.tgname = $2`,
      [table, trigger]
    );
    if (rows.length === 1) ok(`trigger present: ${table}.${trigger}`);
    else fail(`trigger present: ${table}.${trigger}`, "missing");
  }

  const { rows: views } = await client.query(`
    SELECT table_name FROM information_schema.views
     WHERE table_schema='public' ORDER BY table_name
  `);
  expectEqual("read-model views", views.map((v) => v.table_name).join(","),
    "v_appointment_status_timeline,v_security_events");
}

// ---------------------------------------------------------------------------
// B. Workflow assertions
// ---------------------------------------------------------------------------
async function checkWorkflows(client) {
  console.log("\nB. Workflow assertions (all writes rolled back)\n");

  // -- Fixtures: users -----------------------------------------------------
  // The existing admin is reused: the single-admin trigger forbids a second one.
  const { rows: adminRows } = await client.query(
    `SELECT u.id FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'admin' LIMIT 1`
  );
  if (adminRows.length === 0) {
    fail("fixture: existing admin", "no admin account in this database");
    return;
  }
  const adminId = adminRows[0].id;

  const mkUser = async (email, name) => {
    const { rows } = await client.query(
      `INSERT INTO users (full_name, email) VALUES ($1, $2) RETURNING id`,
      [name, email]
    );
    return rows[0].id;
  };
  const assignRole = async (userId, roleName) => {
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = $2`,
      [userId, roleName]
    );
  };

  const patientA = await mkUser("v2.patient.a@medora.test", "Test Patient A");
  const patientB = await mkUser("v2.patient.b@medora.test", "Test Patient B");
  const doctorA = await mkUser("v2.doctor.a@medora.test", "Dr Test A");
  const doctorB = await mkUser("v2.doctor.b@medora.test", "Dr Test B");
  const staff = await mkUser("v2.staff@medora.test", "Test Receptionist");

  await assignRole(patientA, "patient");
  await assignRole(patientB, "patient");
  await assignRole(doctorA, "doctor");
  await assignRole(doctorB, "doctor");
  await assignRole(staff, "receptionist");
  ok("fixtures: 5 fake users with roles created");

  // Admin-only policy: a second admin must be refused by the existing trigger.
  await expectFail(client, "admin: a second admin account is refused",
    /single Admin account/i,
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = 'admin'`,
    [patientB]);

  const { rows: spec } = await client.query(
    "SELECT id FROM specialties ORDER BY name LIMIT 1"
  );
  const specialtyId = spec[0].id;

  // -- Scheduling: clinic, appointment, status trail ------------------------
  const { rows: clinic } = await client.query(
    `INSERT INTO clinic_locations (name, address_line1, city)
     VALUES ('V2 Test Clinic', '1 Test Street', 'Cairo') RETURNING id`
  );
  const clinicId = clinic[0].id;
  ok("receptionist: clinic location created");

  await expectFail(client, "scheduling: a confirmed appointment needs a real slot",
    /appointments_confirmed_slot_check/,
    `INSERT INTO appointments
       (patient_user_id, doctor_user_id, specialty_id, consultation_type,
        status, booked_by_user_id, confirmed_by_user_id, confirmed_at)
     VALUES ($1,$2,$3,'in_person','confirmed',$4,$4, now())`,
    [patientA, doctorA, specialtyId, staff]);

  const { rows: appt } = await client.query(
    `INSERT INTO appointments
       (patient_user_id, doctor_user_id, specialty_id, clinic_location_id,
        consultation_type, status, requested_start_at, scheduled_start_at,
        scheduled_end_at, booked_by_user_id, confirmed_by_user_id, confirmed_at, reason)
     VALUES ($1,$2,$3,$4,'in_person','confirmed', now() + interval '1 day',
             now() + interval '1 day', now() + interval '1 day 30 min',
             $5, $5, now(), 'Persistent cough')
     RETURNING id`,
    [patientA, doctorA, specialtyId, clinicId, staff]
  );
  const appointmentId = appt[0].id;
  ok("patient/receptionist: appointment requested and confirmed");

  // The status trail now lives in audit_logs (consolidation 1).
  await expectOk(client, "audit: appointment.status_changed recorded",
    `INSERT INTO audit_logs
       (event_type, event_category, entity_type, entity_id, patient_user_id,
        actor_user_id, change_source, from_status, to_status, change_reason, outcome)
     VALUES ('appointment.status_changed','appointment','appointment',$1,$2,$3,
             'staff','requested','confirmed','Slot confirmed at the front desk','success')`,
    [appointmentId, patientA, staff]);

  await expectFail(client, "audit: a transition without to_status is refused",
    /audit_logs_appointment_transition_check/,
    `INSERT INTO audit_logs
       (event_type, event_category, entity_type, entity_id, change_source)
     VALUES ('appointment.status_changed','appointment','appointment',$1,'staff')`,
    [appointmentId]);

  await expectFail(client, "audit: a no-op transition is refused",
    /audit_logs_appointment_status_change_check/,
    `INSERT INTO audit_logs
       (event_type, event_category, entity_type, entity_id, change_source,
        from_status, to_status)
     VALUES ('appointment.status_changed','appointment','appointment',$1,'staff',
             'confirmed','confirmed')`,
    [appointmentId]);

  const { rows: trail } = await client.query(
    "SELECT * FROM v_appointment_status_timeline WHERE appointment_id = $1",
    [appointmentId]
  );
  expectEqual("audit: appointment timeline readable through the view", trail.length, 1);

  // Access grant: doctor A may read patient A, doctor B may not.
  await expectOk(client, "access: care relationship granted to the treating doctor",
    `INSERT INTO care_relationships
       (patient_user_id, doctor_user_id, source, source_appointment_id, granted_by_user_id)
     VALUES ($1,$2,'appointment',$3,$4)`,
    [patientA, doctorA, appointmentId, staff]);

  await expectFail(client, "access: duplicate live grant for the same pair is refused",
    /uq_care_relationships_active_pair/,
    `INSERT INTO care_relationships
       (patient_user_id, doctor_user_id, source, granted_by_user_id)
     VALUES ($1,$2,'appointment',$3)`,
    [patientA, doctorA, staff]);

  // -- Consultation, consent, recording, transcript ------------------------
  const { rows: consult } = await client.query(
    `INSERT INTO consultations (appointment_id, patient_user_id, doctor_user_id, status)
     VALUES ($1,$2,$3,'completed') RETURNING id`,
    [appointmentId, patientA, doctorA]
  );
  const consultationId = consult[0].id;

  const { rows: consent } = await client.query(
    `INSERT INTO consultation_consents
       (consultation_id, patient_user_id, consent_type, status, method,
        recorded_by_user_id, granted_at)
     VALUES ($1,$2,'audio_recording','granted','in_person_verbal',$3, now())
     RETURNING id`,
    [consultationId, patientA, doctorA]
  );
  ok("doctor: recording consent captured");

  const { rows: recording } = await client.query(
    `INSERT INTO consultation_recordings
       (consultation_id, consent_id, storage_provider, storage_key, mime_type,
        status, created_by_user_id)
     VALUES ($1,$2,'test-object-store','v2/consultation.webm','audio/webm','available',$3)
     RETURNING id`,
    [consultationId, consent[0].id, doctorA]
  );

  const { rows: transcript } = await client.query(
    `INSERT INTO transcripts (consultation_id, recording_id, source, status)
     VALUES ($1,$2,'speech_to_text','draft') RETURNING id`,
    [consultationId, recording[0].id]
  );
  const transcriptId = transcript[0].id;

  const sttExecution = await client.query(
    `INSERT INTO agent_executions
       (agent_code, status, patient_user_id, consultation_id, idempotency_key,
        started_at, completed_at)
     VALUES ('speech_to_text','succeeded',$1,$2,'v2-stt-1', now(), now())
     RETURNING id`,
    [patientA, consultationId]
  );
  ok("agent: speech-to-text execution recorded in the shared envelope");

  const { rows: version1 } = await client.query(
    `INSERT INTO transcript_versions
       (transcript_id, version_number, content, content_hash, generated_by_execution_id)
     VALUES ($1, 1, 'Draft transcript of the consultation.',
             encode(sha256('Draft transcript of the consultation.'::bytea),'hex'), $2)
     RETURNING id`,
    [transcriptId, sttExecution.rows[0].id]
  );
  const version1Id = version1[0].id;

  const { rows: tState } = await client.query(
    "SELECT status FROM transcripts WHERE id = $1", [transcriptId]
  );
  expectEqual("transcript: summary status after draft insert", tState[0].status, "draft");

  // -- Agent 1 must not read an unreviewed transcript ----------------------
  await expectFail(client, "agent 1: unreviewed transcript is refused",
    /has not been reviewed by a doctor/,
    `INSERT INTO agent_executions
       (agent_code, status, patient_user_id, consultation_id,
        source_transcript_version_id, idempotency_key)
     VALUES ('agent_1_report_generation','queued',$1,$2,$3,'v2-a1-early')`,
    [patientA, consultationId, version1Id]);

  // -- Transcript approval: doctor only, authorised only -------------------
  await expectFail(client, "transcript: staff cannot approve",
    /can only be reviewed by a user holding the doctor role/,
    `UPDATE transcript_versions
        SET review_decision='approved', reviewed_by_user_id=$1
      WHERE id=$2`,
    [staff, version1Id]);

  await expectFail(client, "transcript: an unrelated doctor cannot approve",
    /is not authorised for consultation/,
    `UPDATE transcript_versions
        SET review_decision='approved', reviewed_by_user_id=$1
      WHERE id=$2`,
    [doctorB, version1Id]);

  await expectOk(client, "transcript: the treating doctor approves version 1",
    `UPDATE transcript_versions
        SET review_decision='approved', reviewed_by_user_id=$1,
            review_note='Accurate, no corrections.'
      WHERE id=$2`,
    [doctorA, version1Id]);

  const { rows: approvedRow } = await client.query(
    "SELECT review_decision, reviewed_at, review_note FROM transcript_versions WHERE id=$1",
    [version1Id]
  );
  expectEqual("transcript: decision persisted on the version", approvedRow[0].review_decision, "approved");
  if (approvedRow[0].reviewed_at) ok("transcript: reviewed_at defaulted by trigger");
  else fail("transcript: reviewed_at defaulted by trigger", "still NULL");

  const { rows: tApproved } = await client.query(
    "SELECT status FROM transcripts WHERE id=$1", [transcriptId]
  );
  expectEqual("transcript: summary status follows the decision", tApproved[0].status, "approved");

  await expectFail(client, "transcript: an approved version cannot be edited",
    /already reviewed and is immutable/,
    `UPDATE transcript_versions SET content='tampered' WHERE id=$1`,
    [version1Id]);

  await expectFail(client, "transcript: an approved version cannot be deleted",
    /append-only/,
    `DELETE FROM transcript_versions WHERE id=$1`, [version1Id]);

  await expectFail(client, "transcript: a decision cannot be changed twice",
    /already reviewed and is immutable/,
    `UPDATE transcript_versions SET review_decision='rejected' WHERE id=$1`,
    [version1Id]);

  // A correction is a new version, not an edit.
  const { rows: version2 } = await client.query(
    `INSERT INTO transcript_versions
       (transcript_id, version_number, content, content_hash, is_doctor_edited, edited_by_user_id)
     VALUES ($1, 2, 'Corrected transcript.',
             encode(sha256('Corrected transcript.'::bytea),'hex'), true, $2)
     RETURNING id`,
    [transcriptId, doctorA]
  );
  ok("transcript: a doctor correction creates version 2");
  const version2Id = version2[0].id;

  // -- Agent 1 and the three reports ---------------------------------------
  const a1 = await client.query(
    `INSERT INTO agent_executions
       (agent_code, status, patient_user_id, consultation_id,
        source_transcript_version_id, idempotency_key, model_name, prompt_version,
        input_hash, output_hash, started_at, completed_at)
     VALUES ('agent_1_report_generation','succeeded',$1,$2,$3,'v2-a1-1',
             'test-model','p1', encode(sha256('in'::bytea),'hex'),
             encode(sha256('out'::bytea),'hex'), now(), now())
     RETURNING id`,
    [patientA, consultationId, version1Id]
  );
  const a1Id = a1.rows[0].id;
  ok("agent 1: runs on an approved transcript version");

  const mkReport = async (type) => {
    const { rows } = await client.query(
      `INSERT INTO medical_reports
         (consultation_id, patient_user_id, doctor_user_id, report_type)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [consultationId, patientA, doctorA, type]
    );
    return rows[0].id;
  };
  const report1 = await mkReport("report_1_patient_summary");
  const report2 = await mkReport("report_2_structured_profile");
  const report3 = await mkReport("report_3_medical_report");
  ok("agent 1: three separately typed report documents created");

  await expectFail(client, "reports: a fourth document of the same type is refused",
    /uq_medical_reports_consultation_type/,
    `INSERT INTO medical_reports (consultation_id, patient_user_id, doctor_user_id, report_type)
     VALUES ($1,$2,$3,'report_1_patient_summary')`,
    [consultationId, patientA, doctorA]);

  const mkVersion = async (reportId, n, transcriptVersionId, hashSeed) => {
    const { rows } = await client.query(
      `INSERT INTO report_versions
         (report_id, version_number, content, source_transcript_version_id,
          generated_by_execution_id, content_hash)
       VALUES ($1,$2,$3::jsonb,$4,$5, encode(sha256($6::bytea),'hex'))
       RETURNING id`,
      [reportId, n, JSON.stringify({ seed: hashSeed }), transcriptVersionId, a1Id, hashSeed]
    );
    return rows[0].id;
  };

  await expectFail(client, "reports: a draft report cannot cite an unapproved transcript",
    /has not been reviewed by a doctor/,
    `INSERT INTO report_versions
       (report_id, version_number, content, source_transcript_version_id, content_hash)
     VALUES ($1, 1, '{}'::jsonb, $2, encode(sha256('x'::bytea),'hex'))`,
    [report1, version2Id]);

  const rv1 = await mkVersion(report1, 1, version1Id, "report-1-v1");
  const rv2 = await mkVersion(report2, 1, version1Id, "report-2-v1");
  const rv3 = await mkVersion(report3, 1, version1Id, "report-3-v1");
  ok("agent 1: one version per report, all citing the approved transcript");

  // -- Report approval -----------------------------------------------------
  await expectFail(client, "reports: staff cannot approve a report",
    /can only be reviewed by a user holding the doctor role/,
    `UPDATE report_versions SET review_decision='approved', reviewed_by_user_id=$1 WHERE id=$2`,
    [staff, rv1]);

  await expectOk(client, "reports: the doctor approves Report 1",
    `UPDATE report_versions SET review_decision='approved', reviewed_by_user_id=$1 WHERE id=$2`,
    [doctorA, rv1]);

  await expectFail(client, "reports: an approved version cannot be overwritten",
    /already reviewed and is immutable/,
    `UPDATE report_versions SET content = '{"tampered":true}'::jsonb WHERE id=$1`,
    [rv1]);

  // -- Publication (consolidation 4) ---------------------------------------
  // A second, unreviewed version of Report 1: approved content exists, but this
  // version has no doctor decision yet, so publishing it must be refused.
  const rv1b = await mkVersion(report1, 2, version1Id, "report-1-v2");

  await expectFail(client, "publication: an unapproved version cannot be published",
    /is not doctor-approved and cannot be published/,
    `UPDATE medical_reports
        SET publication_state='published', published_version_id=$1,
            published_at=now(), published_by_user_id=$2
      WHERE id=$3`,
    [rv1b, doctorA, report1]);

  await expectFail(client, "publication: Report 3 has no patient-visible path",
    /only report_1_patient_summary may be published/,
    `UPDATE medical_reports
        SET publication_state='published', published_version_id=$1,
            published_at=now(), published_by_user_id=$2
      WHERE id=$3`,
    [rv3, doctorA, report3]);

  await expectFail(client, "publication: a version from another report is refused",
    /does not belong to report/,
    `UPDATE medical_reports
        SET publication_state='published', published_version_id=$1,
            published_at=now(), published_by_user_id=$2
      WHERE id=$3`,
    [rv3, doctorA, report1]);

  await expectOk(client, "publication: approved Report 1 published to the portal",
    `UPDATE medical_reports
        SET publication_state='published', published_version_id=$1,
            published_at=now(), published_by_user_id=$2
      WHERE id=$3`,
    [rv1, doctorA, report1]);

  await expectFail(client, "publication: cannot be silently reverted to unpublished",
    /withdraw it instead/,
    `UPDATE medical_reports SET publication_state='unpublished',
            published_version_id=NULL, published_at=NULL, published_by_user_id=NULL
      WHERE id=$1`,
    [report1]);

  // Patient portal read: patient A sees their released report, patient B does not.
  const portalA = await client.query(
    `SELECT mr.id FROM medical_reports mr
      WHERE mr.patient_user_id = $1 AND mr.publication_state = 'published'`,
    [patientA]
  );
  const portalB = await client.query(
    `SELECT mr.id FROM medical_reports mr
      WHERE mr.patient_user_id = $1 AND mr.publication_state = 'published'`,
    [patientB]
  );
  expectEqual("portal: patient A sees exactly 1 released report", portalA.rows.length, 1);
  expectEqual("portal: patient B sees none of A's reports", portalB.rows.length, 0);

  // -- Agent 2 and the longitudinal record ---------------------------------
  await expectFail(client, "agent 2: an unapproved Report 2 is refused",
    /has not been reviewed by a doctor/,
    `INSERT INTO agent_executions
       (agent_code, status, patient_user_id, consultation_id,
        source_report_version_id, idempotency_key)
     VALUES ('agent_2_profile_organization','queued',$1,$2,$3,'v2-a2-early')`,
    [patientA, consultationId, rv2]);

  await expectOk(client, "reports: the doctor approves Report 2",
    `UPDATE report_versions SET review_decision='approved', reviewed_by_user_id=$1 WHERE id=$2`,
    [doctorA, rv2]);

  const a2 = await client.query(
    `INSERT INTO agent_executions
       (agent_code, status, patient_user_id, consultation_id,
        source_report_version_id, idempotency_key, started_at, completed_at)
     VALUES ('agent_2_profile_organization','succeeded',$1,$2,$3,'v2-a2-1', now(), now())
     RETURNING id`,
    [patientA, consultationId, rv2]
  );
  ok("agent 2: runs on an approved Report 2");

  const { rows: proposal } = await client.query(
    `INSERT INTO record_update_proposals
       (patient_user_id, agent_execution_id, source_report_version_id,
        target_entity_type, proposal_type, proposed_changes, rationale, status)
     VALUES ($1,$2,$3,'medical_condition','create',
             '{"condition_name":"Persistent cough"}'::jsonb,
             'Reported in the consultation and confirmed in Report 2.','proposed')
     RETURNING id`,
    [patientA, a2.rows[0].id, rv2]
  );
  const proposalId = proposal[0].id;
  ok("agent 2: change proposed, not applied");

  await expectFail(client, "agent 2: a record cannot be written from an unapproved proposal",
    /is proposed, not approved/,
    `INSERT INTO medical_conditions
       (patient_user_id, condition_name, source_type, source_report_version_id, source_proposal_id)
     VALUES ($1,'Persistent cough','agent_2_derived',$2,$3)`,
    [patientA, rv2, proposalId]);

  await expectFail(client, "agent 2: a derived fact without a proposal is refused",
    /requires an approved record_update_proposals row/,
    `INSERT INTO medical_conditions
       (patient_user_id, condition_name, source_type, source_report_version_id)
     VALUES ($1,'Persistent cough','agent_2_derived',$2)`,
    [patientA, rv2]);

  await expectOk(client, "agent 2: the doctor approves the proposal",
    `UPDATE record_update_proposals
        SET status='approved', reviewed_by_user_id=$1, reviewed_at=now()
      WHERE id=$2`,
    [doctorA, proposalId]);

  await expectOk(client, "agent 2: the approved proposal is applied as a new fact",
    `INSERT INTO medical_conditions
       (patient_user_id, condition_name, source_type, source_report_version_id, source_proposal_id)
     VALUES ($1,'Persistent cough','agent_2_derived',$2,$3)`,
    [patientA, rv2, proposalId]);

  // -- Agent 3: recommendation, proposal, booking --------------------------
  const { rows: followUp } = await client.query(
    `INSERT INTO follow_ups
       (patient_user_id, doctor_user_id, consultation_id, source_report_version_id,
        recommendation, recommended_interval_days, due_on)
     VALUES ($1,$2,$3,$4,'Review in two weeks if the cough persists',14, CURRENT_DATE + 14)
     RETURNING id`,
    [patientA, doctorA, consultationId, rv1]
  );
  ok("agent 3: follow-up recommended from an approved report version");

  await expectFail(client, "agent 3: a proposal cannot claim to be a booking",
    /appointment_proposals_booked_check/,
    `INSERT INTO appointment_proposals
       (patient_user_id, doctor_user_id, follow_up_id, consultation_type,
        proposed_start_at, proposed_end_at, status, created_by_user_id)
     VALUES ($1,$2,$3,'in_person', now() + interval '14 days',
             now() + interval '14 days 30 min','booked',$4)`,
    [patientA, doctorA, followUp[0].id, staff]);

  const { rows: proposalSlot } = await client.query(
    `INSERT INTO appointment_proposals
       (patient_user_id, doctor_user_id, follow_up_id, clinic_location_id,
        consultation_type, proposed_start_at, proposed_end_at, status, created_by_user_id)
     VALUES ($1,$2,$3,$4,'in_person', now() + interval '14 days',
             now() + interval '14 days 30 min','proposed',$5)
     RETURNING id`,
    [patientA, doctorA, followUp[0].id, clinicId, staff]
  );
  ok("agent 3: a slot is proposed, which is not a booking");

  await expectFail(client, "agent 3: the same live slot cannot be proposed twice",
    /uq_appointment_proposals_live_slot/,
    `INSERT INTO appointment_proposals
       (patient_user_id, doctor_user_id, consultation_type,
        proposed_start_at, proposed_end_at, status, created_by_user_id)
     VALUES ($1,$2,'in_person', now() + interval '14 days',
             now() + interval '14 days 30 min','proposed',$3)`,
    [patientB, doctorA, staff]);

  // -- OCR, chunks, RAG ----------------------------------------------------
  const { rows: doc } = await client.query(
    `INSERT INTO reference_documents (title, source_type, created_by_user_id)
     VALUES ('V2 Test Guideline', 'clinical_guideline', $1) RETURNING id`,
    [doctorA]
  );
  const { rows: docVersion } = await client.query(
    `INSERT INTO reference_document_versions
       (document_id, version_label, file_storage_provider, file_key,
        file_checksum_sha256, mime_type, extraction_method, created_by_user_id)
     VALUES ($1,'v1','test-object-store','v2/guideline.pdf',
             encode(sha256('guideline'::bytea),'hex'),'application/pdf','ocr',$2)
     RETURNING id`,
    [doc[0].id, doctorA]
  );
  const docVersionId = docVersion[0].id;
  ok("ocr: reference document and version registered");

  await expectFail(client, "ocr: an extraction cannot be tied to a patient",
    /agent_executions_extraction_no_patient_check/,
    `INSERT INTO agent_executions
       (agent_code, status, patient_user_id, reference_document_version_id,
        engine, idempotency_key)
     VALUES ('ocr_extraction','queued',$1,$2,'tesseract-test','v2-ocr-bad')`,
    [patientA, docVersionId]);

  await expectFail(client, "ocr: an extraction without a source version is refused",
    /agent_executions_extraction_source_check/,
    `INSERT INTO agent_executions (agent_code, status, engine, idempotency_key)
     VALUES ('ocr_extraction','queued','tesseract-test','v2-ocr-bad-2')`);

  const ocr = await client.query(
    `INSERT INTO agent_executions
       (agent_code, status, reference_document_version_id, engine, engine_version,
        output_hash, output_character_count, idempotency_key, started_at, completed_at)
     VALUES ('ocr_extraction','succeeded',$1,'tesseract-test','5.4',
             encode(sha256('extracted'::bytea),'hex'), 4821, 'v2-ocr-1', now(), now())
     RETURNING id`,
    [docVersionId]
  );
  ok("ocr: extraction recorded in the shared execution envelope");

  const { rows: chunks } = await client.query(
    `INSERT INTO reference_chunks
       (document_version_id, chunk_index, heading, content, token_count, content_hash)
     VALUES ($1, 0, 'Diagnosis',
             'Persistent cough lasting more than eight weeks requires imaging.',
             14, encode(sha256('chunk-0'::bytea),'hex'))
     RETURNING id`,
    [docVersionId]
  );
  ok("rag: chunk created from the document version");

  await expectFail(client, "rag: indexing without quality approval is refused",
    /reference_document_versions_indexed_check/,
    `UPDATE reference_document_versions SET status='indexed' WHERE id=$1`,
    [docVersionId]);

  await expectOk(client, "rag: version approved, extraction linked, then indexed",
    `UPDATE reference_document_versions
        SET extraction_execution_id=$1, normalized_text='Extracted guideline text.',
            quality_reviewed_by_user_id=$2, quality_reviewed_at=now(),
            approved_by_user_id=$2, approved_at=now(), status='indexed'
      WHERE id=$3`,
    [ocr.rows[0].id, doctorA, docVersionId]);

  const { rows: ragQuery } = await client.query(
    `INSERT INTO rag_queries (asked_by_user_id, question, answer, answer_status, completed_at)
     VALUES ($1,'When is imaging indicated for chronic cough?',
             'After eight weeks, per the cited guideline.','answered', now())
     RETURNING id`,
    [doctorA]
  );
  await expectOk(client, "rag: answer cites the retrieved chunk",
    `INSERT INTO rag_citations (rag_query_id, chunk_id, rank, relevance_score, quoted_text)
     VALUES ($1,$2,1,0.92345,'Persistent cough lasting more than eight weeks requires imaging.')`,
    [ragQuery[0].id, chunks[0].id]);

  await expectFail(client, "rag: an answered query must carry an answer",
    /rag_queries_answer_check/,
    `INSERT INTO rag_queries (asked_by_user_id, question, answer_status)
     VALUES ($1,'Empty answer?','answered')`,
    [doctorA]);

  // -- Security events in audit_logs (consolidation 6) ---------------------
  const sec = await client.query(
    `INSERT INTO audit_logs
       (event_type, event_category, severity, actor_user_id, entity_type,
        entity_id, outcome, ip_address, user_agent, metadata)
     VALUES ('security.login_failed','security','warning',$1,'user',$1,'failure',
             '203.0.113.10','test-agent','{"reason":"bad_password"}')
     RETURNING id`,
    [patientB]
  );
  const securityId = sec.rows[0].id;
  ok("security: authentication failure recorded in audit_logs");

  await expectFail(client, "security: a security event must use the security namespace",
    /audit_logs_security_namespace_check/,
    `INSERT INTO audit_logs (event_type, event_category, entity_type, outcome)
     VALUES ('report.approved','security','report','success')`);

  await expectFail(client, "security: event_type must be namespaced",
    /audit_logs_event_type_format_check/,
    `INSERT INTO audit_logs (event_type, event_category, entity_type)
     VALUES ('login_failed','security','user')`);

  await expectOk(client, "security: investigation resolved once",
    `UPDATE audit_logs
        SET resolved_at=now(), resolved_by_user_id=$1, resolution_notes='User contacted.'
      WHERE id=$2`,
    [adminId, securityId]);

  await expectFail(client, "security: a resolved event cannot be re-resolved",
    /already resolved and is now immutable/,
    `UPDATE audit_logs SET resolution_notes='Again' WHERE id=$1`,
    [securityId]);

  await expectFail(client, "audit: a normal event cannot be resolved",
    /is not a security event and cannot be resolved/,
    `UPDATE audit_logs SET resolved_at=now(), resolved_by_user_id=$1
      WHERE event_type='appointment.status_changed' AND entity_id=$2`,
    [adminId, appointmentId]);

  // An unresolved event is still fully immutable apart from the resolution trio.
  await expectFail(client, "audit: events cannot be edited",
    /only the resolution columns/,
    `UPDATE audit_logs SET outcome='denied'
      WHERE event_type='appointment.status_changed' AND entity_id=$1`,
    [appointmentId]);

  // Documented behaviour: an UPDATE that changes no column at all is accepted,
  // because it modifies nothing. Any real edit is refused (previous assertion).
  await expectOk(client, "audit: a no-op update is accepted (no content change)",
    `UPDATE audit_logs SET outcome='success'
      WHERE event_type='appointment.status_changed' AND entity_id=$1`,
    [appointmentId]);

  await expectFail(client, "audit: events cannot be deleted",
    /append-only: event .* cannot be deleted/,
    `DELETE FROM audit_logs WHERE id=$1`, [securityId]);

  const { rows: secView } = await client.query(
    "SELECT * FROM v_security_events WHERE id = $1", [securityId]
  );
  expectEqual("security: event readable through the security view", secView.length, 1);

  // -- Staff / admin separation -------------------------------------------
  // Staff has no care relationship and no doctor role, so the clinical tables
  // expose nothing to a staff-scoped query.
  const staffClinical = await client.query(
    `SELECT mr.id FROM medical_reports mr
       JOIN care_relationships cr
         ON cr.patient_user_id = mr.patient_user_id AND cr.doctor_user_id = $1
      WHERE mr.consultation_id = $2 AND cr.status = 'active'`,
    [staff, consultationId]
  );
  expectEqual("authorization: staff has no clinical read path", staffClinical.rows.length, 0);

  const adminClinical = await client.query(
    `SELECT mr.id FROM medical_reports mr
       JOIN care_relationships cr
         ON cr.patient_user_id = mr.patient_user_id AND cr.doctor_user_id = $1
      WHERE mr.consultation_id = $2 AND cr.status = 'active'`,
    [adminId, consultationId]
  );
  expectEqual("authorization: admin gains no clinical read path automatically",
    adminClinical.rows.length, 0);

  // -- Referential integrity spot checks ----------------------------------
  const { rows: orphanReports } = await client.query(`
    SELECT count(*)::int AS n
      FROM medical_reports mr
      LEFT JOIN report_versions rv ON rv.id = mr.published_version_id
     WHERE mr.published_version_id IS NOT NULL AND rv.id IS NULL
  `);
  expectEqual("integrity: no published report points at a missing version", orphanReports[0].n, 0);

  const { rows: orphanProvenance } = await client.query(`
    SELECT count(*)::int AS n
      FROM medical_conditions mc
      LEFT JOIN record_update_proposals p ON p.id = mc.source_proposal_id
     WHERE mc.source_proposal_id IS NOT NULL AND p.id IS NULL
  `);
  expectEqual("integrity: no clinical fact cites a missing proposal", orphanProvenance[0].n, 0);

  // -- Account deletion versus the append-only trail (migration 013) --------
  await expectFail(client, "audit: an actor cannot be reassigned to another account",
    /cannot be reassigned/,
    `UPDATE audit_logs SET actor_user_id = $1 WHERE id = $2`,
    [adminId, securityId]);

  await expectOk(client, "audit: the actor reference may be cleared when an account is deleted",
    `UPDATE audit_logs SET actor_user_id = NULL WHERE id = $1`,
    [securityId]);

  await expectOk(client, "audit: deleting an audited account keeps its trail",
    `DELETE FROM users WHERE id = $1`,
    [patientB]);

  const { rows: survived } = await client.query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE event_category = 'security'`
  );
  expectEqual("audit: security evidence survives account deletion", survived[0].n >= 1, true);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n==============================================");
  console.log("  Medora — Simplification V2 verification suite");
  console.log("==============================================");

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT current_database() AS db, current_user AS usr"
    );
    console.log(`\nDatabase: ${rows[0].db}   User: ${rows[0].usr}`);

    await checkSchema(client);

    await client.query("BEGIN");
    try {
      await checkWorkflows(client);
    } finally {
      await client.query("ROLLBACK");
      console.log("\n(workflow transaction rolled back — no test rows persisted)");
    }
  } catch (err) {
    console.error(`\n[SUITE ERROR] ${err.message}`);
    failed += 1;
    failures.push(`suite error — ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n----------------------------------------------`);
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  if (failed > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(` - ${f}`));
    process.exitCode = 1;
  }
  console.log("");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

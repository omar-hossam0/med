/**
 * Agent 2 proposals, longitudinal record writes and the doctor's chart read.
 *
 * Every clinical fact written here carries provenance. Corrections create a
 * new row and link the previous row via superseded_by_id — no clinical fact is
 * ever updated in place or deleted. The database trigger
 * enforce_medical_record_provenance() is the final gate on derived facts.
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const accessService = require("./accessService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const { assertUuid, iso, dateOnly, withTransaction, isPlainObject } = require("../utils/dbHelpers");
const { serializeProposal } = require("../utils/clinicalSerializers");

/**
 * Allowlisted columns per clinical fact table. Column names are server-side
 * constants; only values are ever parameterized from the request.
 */
const ENTITY_MAP = {
  medical_condition: {
    table: "medical_conditions",
    columns: ["condition_name", "condition_code", "coding_system", "clinical_status", "onset_date", "resolved_date", "severity"],
    required: ["condition_name"],
    creatorColumn: "created_by_user_id",
    supersede: true,
    patientColumn: "patient_user_id",
  },
  patient_medication: {
    table: "patient_medications",
    columns: ["medication_name", "medication_code", "coding_system", "dosage", "frequency", "route", "indication", "started_on", "ended_on", "status", "prescriber_user_id"],
    required: ["medication_name"],
    creatorColumn: "created_by_user_id",
    supersede: true,
    patientColumn: "patient_user_id",
  },
  patient_allergy: {
    table: "patient_allergies",
    columns: ["allergen", "allergen_code", "coding_system", "reaction", "severity", "status", "onset_date"],
    required: ["allergen"],
    creatorColumn: "created_by_user_id",
    supersede: true,
    patientColumn: "patient_user_id",
  },
  medical_history_entry: {
    table: "medical_history_entries",
    columns: ["entry_type", "title", "description", "occurred_on", "record_status"],
    required: ["entry_type", "title"],
    creatorColumn: "created_by_user_id",
    supersede: true,
    patientColumn: "patient_user_id",
  },
  test_order: {
    table: "test_orders",
    columns: ["consultation_id", "test_name", "test_code", "coding_system", "priority", "status", "ordered_at", "scheduled_for", "completed_at", "notes"],
    required: ["test_name"],
    creatorColumn: null,
    supersede: false,
    patientColumn: "patient_user_id",
    // test_orders has no created_by_user_id; the ordering doctor is the actor.
    extra: (actorId) => ({ ordered_by_doctor_user_id: actorId }),
  },
  test_result: {
    table: "test_results",
    columns: ["test_order_id", "analyte_name", "value_text", "value_numeric", "unit", "reference_range", "abnormal_flag", "result_status", "resulted_at", "notes", "document_provider", "document_key"],
    required: ["test_order_id", "analyte_name"],
    creatorColumn: null,
    supersede: true,
    patientColumn: null,
  },
};

function pickChanges(changes, definition) {
  if (!isPlainObject(changes)) {
    throw httpError(400, "validation_error", "proposed_changes must be a JSON object.");
  }
  const picked = {};
  for (const column of definition.columns) {
    if (Object.prototype.hasOwnProperty.call(changes, column)) {
      picked[column] = changes[column];
    }
  }
  for (const column of definition.required) {
    if (picked[column] === undefined || picked[column] === null || picked[column] === "") {
      throw httpError(400, "validation_error", `proposed_changes.${column} is required for ${definition.table}.`);
    }
  }
  return picked;
}

/** Insert one clinical fact with the full provenance contract. */
async function insertClinicalFact(client, {
  entityType,
  changes,
  patientUserId,
  actorId,
  sourceType,
  sourceReportVersionId = null,
  sourceProposalId = null,
}) {
  const definition = ENTITY_MAP[entityType];
  if (!definition) throw httpError(400, "validation_error", "Unknown target entity type.");
  const picked = pickChanges(changes, definition);

  if (entityType === "test_result" && picked.test_order_id) {
    const order = await client.query(
      `SELECT id FROM test_orders WHERE id = $1 AND patient_user_id = $2`,
      [picked.test_order_id, patientUserId]
    );
    if (order.rowCount === 0) {
      throw httpError(409, "dependency_conflict", "The test order does not belong to this patient.");
    }
  }

  const row = { ...picked };
  if (definition.patientColumn) row[definition.patientColumn] = patientUserId;
  if (definition.creatorColumn) row[definition.creatorColumn] = actorId;
  if (definition.extra) Object.assign(row, definition.extra(actorId));
  row.source_type = sourceType;
  if (sourceReportVersionId) row.source_report_version_id = sourceReportVersionId;
  if (sourceProposalId) row.source_proposal_id = sourceProposalId;

  const columns = Object.keys(row);
  const values = columns.map((column) => row[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const { rows } = await client.query(
    `INSERT INTO ${definition.table} (${columns.join(", ")})
     VALUES (${placeholders.join(", ")}) RETURNING id`,
    values
  );
  return { id: rows[0].id, table: definition.table };
}

async function listPatientProposals(ctx) {
  const patientId = assertUuid(ctx.params.id, "Patient");
  await accessService.assertCareAccess(pool, ctx, patientId);
  const { rows } = await pool.query(
    `SELECT * FROM record_update_proposals
      WHERE patient_user_id = $1
        AND ($2::text IS NULL OR status = $2)
      ORDER BY created_at DESC`,
    [patientId, ctx.query.status || null]
  );
  return { proposals: rows.map(serializeProposal) };
}

async function getProposal(ctx) {
  const proposal = await accessService.assertProposalAccess(pool, ctx, ctx.params.id);
  return { proposal: serializeProposal(proposal) };
}

async function reviewProposal(ctx) {
  const proposalId = assertUuid(ctx.params.id, "Proposal");
  const v = new Validator();
  const decision = v.oneOf(ctx.body.decision, "decision", ["approved", "rejected"], { label: "Decision" });
  const note = v.text(ctx.body.note, "note", { max: 1000, label: "Review note" });
  v.done();

  return withTransaction(async (client) => {
    const proposal = await accessService.assertProposalAccess(client, ctx, proposalId, { forUpdate: true });
    if (proposal.status !== "proposed") {
      throw httpError(409, "invalid_status_transition", "Only a proposed record update can be reviewed.");
    }
    const { rows } = await client.query(
      `UPDATE record_update_proposals
          SET status = $1, reviewed_by_user_id = $2, reviewed_at = now()
        WHERE id = $3 RETURNING *`,
      [decision, ctx.actorId, proposalId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "proposal.reviewed",
      eventCategory: "approval",
      entityType: "record_update_proposal",
      entityId: proposalId,
      patientUserId: proposal.patient_user_id,
      before: { status: "proposed" },
      after: { status: decision },
      metadata: { target_entity_type: proposal.target_entity_type, proposal_type: proposal.proposal_type, note: note || null },
      context: ctx.context,
    });
    return { proposal: serializeProposal(rows[0]) };
  });
}

async function applyProposal(ctx) {
  const proposalId = assertUuid(ctx.params.id, "Proposal");
  return withTransaction(async (client) => {
    const proposal = await accessService.assertProposalAccess(client, ctx, proposalId, { forUpdate: true });
    if (proposal.status === "applied") {
      throw httpError(409, "invalid_status_transition", "This proposal has already been applied.");
    }
    if (proposal.status !== "approved") {
      throw httpError(409, "dependency_conflict", "Only a doctor-approved proposal can be applied to the medical record.");
    }

    const definition = ENTITY_MAP[proposal.target_entity_type];
    if (!definition) throw httpError(400, "validation_error", "Unknown target entity type.");

    const isCorrection = ["correct", "update", "resolve", "discontinue"].includes(proposal.proposal_type);
    if (isCorrection && !proposal.target_entity_id) {
      throw httpError(409, "dependency_conflict", "A correction proposal must name the record it supersedes.");
    }
    if (isCorrection && !definition.supersede) {
      // test_orders has no superseded_by_id column; an approved migration is
      // required before this workflow can be supported honestly.
      throw httpError(409, "dependency_conflict", "This entity type has no supersede column; a schema decision is required before correcting it.");
    }

    const fact = await insertClinicalFact(client, {
      entityType: proposal.target_entity_type,
      changes: proposal.proposed_changes,
      patientUserId: proposal.patient_user_id,
      actorId: ctx.actorId,
      sourceType: "agent_2_derived",
      sourceReportVersionId: proposal.source_report_version_id,
      sourceProposalId: proposal.id,
    });

    if (isCorrection) {
      // Branch explicitly: a failed statement would abort the whole
      // transaction, so a catch-and-retry is not safe here.
      if (definition.table === "test_results") {
        const orderScope = await client.query(
          `UPDATE test_results tr SET superseded_by_id = $1
             FROM test_orders tor
            WHERE tr.id = $2 AND tor.id = tr.test_order_id
              AND tor.patient_user_id = $3`,
          [fact.id, proposal.target_entity_id, proposal.patient_user_id]
        );
        if (orderScope.rowCount === 0) {
          throw httpError(404, "not_found", "The record to supersede was not found for this patient.");
        }
      } else {
        const updated = await client.query(
          `UPDATE ${definition.table} SET superseded_by_id = $1 WHERE id = $2 AND patient_user_id = $3`,
          [fact.id, proposal.target_entity_id, proposal.patient_user_id]
        );
        if (updated.rowCount === 0) {
          throw httpError(404, "not_found", "The record to supersede was not found for this patient.");
        }
      }
    }

    const { rows } = await client.query(
      `UPDATE record_update_proposals
          SET status = 'applied', applied_at = now()
        WHERE id = $1 RETURNING *`,
      [proposalId]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "proposal.applied",
      eventCategory: "approval",
      entityType: "record_update_proposal",
      entityId: proposalId,
      patientUserId: proposal.patient_user_id,
      before: { status: "approved" },
      after: { status: "applied" },
      metadata: { target_entity_type: proposal.target_entity_type, entity_id: fact.id },
      context: ctx.context,
    });
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "clinical.record_created",
      eventCategory: "clinical_access",
      entityType: proposal.target_entity_type,
      entityId: fact.id,
      patientUserId: proposal.patient_user_id,
      after: { source_type: "agent_2_derived", source_proposal_id: proposalId },
      metadata: {},
      context: ctx.context,
    });

    return { proposal: serializeProposal(rows[0]), record: fact };
  });
}

async function getDoctorChart(ctx) {
  const patientId = assertUuid(ctx.params.id, "Patient");
  await accessService.assertCareAccess(pool, ctx, patientId);

  const [profile, conditions, medications, allergies, history, orders, results, reports] = await Promise.all([
    pool.query(`SELECT p.*, u.full_name, u.email FROM patient_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1`, [patientId]),
    pool.query(`SELECT * FROM medical_conditions WHERE patient_user_id = $1 AND superseded_by_id IS NULL ORDER BY recorded_at DESC`, [patientId]),
    pool.query(`SELECT * FROM patient_medications WHERE patient_user_id = $1 AND superseded_by_id IS NULL ORDER BY recorded_at DESC`, [patientId]),
    pool.query(`SELECT * FROM patient_allergies WHERE patient_user_id = $1 AND superseded_by_id IS NULL ORDER BY recorded_at DESC`, [patientId]),
    pool.query(`SELECT * FROM medical_history_entries WHERE patient_user_id = $1 AND superseded_by_id IS NULL ORDER BY occurred_on DESC NULLS LAST`, [patientId]),
    pool.query(`SELECT * FROM test_orders WHERE patient_user_id = $1 ORDER BY ordered_at DESC`, [patientId]),
    pool.query(
      `SELECT tr.* FROM test_results tr
         JOIN test_orders tor ON tor.id = tr.test_order_id
        WHERE tor.patient_user_id = $1 AND tr.superseded_by_id IS NULL
        ORDER BY tr.resulted_at DESC`,
      [patientId]
    ),
    pool.query(
      `SELECT id, report_type, status, publication_state, published_at, created_at
         FROM medical_reports WHERE patient_user_id = $1 ORDER BY created_at DESC`,
      [patientId]
    ),
  ]);

  // A chart read is a clinical access event with the patient id attached.
  await auditService.recordClinicalAccess(pool, {
    actorUserId: ctx.actorId,
    patientUserId: patientId,
    entityType: "patient_chart",
    entityId: patientId,
    metadata: { sections: ["conditions", "medications", "allergies", "history", "tests", "reports"] },
    context: ctx.context,
  });

  return {
    record: {
      patientUserId: patientId,
      demographics: profile.rows[0]
        ? {
            fullName: profile.rows[0].full_name,
            email: profile.rows[0].email,
            dateOfBirth: dateOnly(profile.rows[0].date_of_birth),
            phone: profile.rows[0].phone || null,
            gender: profile.rows[0].gender || null,
          }
        : null,
      conditions: conditions.rows,
      medications: medications.rows,
      allergies: allergies.rows,
      history: history.rows,
      testOrders: orders.rows,
      testResults: results.rows,
      reports: reports.rows.map((row) => ({ ...row, published_at: iso(row.published_at) })),
      // No imaging or document table exists (decisions D-10/D-11).
      imaging: [],
      documents: [],
    },
  };
}

async function createRecordEntry(ctx) {
  const patientId = assertUuid(ctx.params.id, "Patient");
  const v = new Validator();
  const entityType = v.oneOf(ctx.body.entity_type, "entity_type", Object.keys(ENTITY_MAP), { label: "Entity type" });
  const changes = v.jsonObject(ctx.body.fields, "fields", { required: true, label: "Record fields" });
  v.done();

  return withTransaction(async (client) => {
    await accessService.assertCareAccess(client, ctx, patientId);
    const fact = await insertClinicalFact(client, {
      entityType,
      changes,
      patientUserId: patientId,
      actorId: ctx.actorId,
      sourceType: "doctor_entered",
    });
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "clinical.record_created",
      eventCategory: "clinical_access",
      entityType,
      entityId: fact.id,
      patientUserId: patientId,
      after: { source_type: "doctor_entered" },
      metadata: {},
      context: ctx.context,
    });
    return { record: fact };
  });
}

module.exports = {
  ENTITY_MAP,
  pickChanges,
  insertClinicalFact,
  listPatientProposals,
  getProposal,
  reviewProposal,
  applyProposal,
  getDoctorChart,
  createRecordEntry,
};

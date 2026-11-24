/**
 * Patient clinical portal (Phase 6/8).
 *
 * Every query is scoped by patient_user_id = req.user.id. Imaging and uploaded
 * documents have no backing table (decisions D-10/D-11), so they are honest
 * empty arrays rather than fabricated records. Preliminary lab results never
 * reach a patient response.
 */
const pool = require("../config/db");
const { httpError } = require("../utils/httpError");
const { assertUuid, iso, dateOnly, sha256, pagination } = require("../utils/dbHelpers");
const { medicalRecordEntry } = require("../utils/clinicalSerializers");
const {
  serializeVisit,
  serializeLabResult,
  serializeLabObservation,
  serializeLabTrend,
  serializePrescription,
  serializePrescriptionRecord,
  serializeMedication,
  serializeReport,
} = require("../utils/clinicalSerializers");

const RECORD_TYPES = ["visit", "prescription", "lab", "imaging", "document", "report"];

function groupId(key) {
  return `rx-${sha256(key).slice(0, 16)}`;
}

/** One LabResult per test order, with its final (non-preliminary) analytes. */
async function loadLabGroups(executor, patientId) {
  const { rows } = await executor.query(
    `SELECT tor.id AS order_id, tor.test_name, tor.ordered_at, tor.completed_at,
            tor.notes, tor.consultation_id, tor.ordered_by_doctor_user_id,
            tor.status AS order_status,
            tr.id AS result_id, tr.analyte_name, tr.value_text, tr.value_numeric,
            tr.unit, tr.reference_range, tr.abnormal_flag, tr.result_status,
            tr.resulted_at,
            cl.name AS location_name
       FROM test_orders tor
       LEFT JOIN test_results tr ON tr.test_order_id = tor.id
        AND tr.result_status <> 'preliminary'
        AND tr.superseded_by_id IS NULL
       LEFT JOIN consultations co ON co.id = tor.consultation_id
       LEFT JOIN appointments a  ON a.id = co.appointment_id
       LEFT JOIN clinic_locations cl ON cl.id = a.clinic_location_id
      WHERE tor.patient_user_id = $1
      ORDER BY tor.completed_at DESC NULLS LAST, tor.ordered_at DESC, tr.resulted_at`,
    [patientId]
  );

  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.order_id)) {
      groups.set(row.order_id, {
        order: {
          id: row.order_id,
          test_name: row.test_name,
          ordered_at: row.ordered_at,
          completed_at: row.completed_at,
          notes: row.notes,
          consultation_id: row.consultation_id,
          ordered_by_doctor_user_id: row.ordered_by_doctor_user_id,
          location_name: row.location_name,
          category: "Laboratory",
        },
        results: [],
      });
    }
    if (row.result_id) groups.get(row.order_id).results.push(row);
  }
  return [...groups.values()];
}

/** Prescriptions are derived from patient_medications — no prescriptions table exists. */
async function loadPrescriptionGroups(executor, patientId) {
  const { rows } = await executor.query(
    `SELECT * FROM patient_medications
      WHERE patient_user_id = $1 AND superseded_by_id IS NULL
      ORDER BY recorded_at DESC`,
    [patientId]
  );
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.source_report_version_id || "manual"}:${row.prescriber_user_id || row.created_by_user_id || "unknown"}`;
    const id = groupId(key);
    if (!groups.has(id)) {
      groups.set(id, {
        group: {
          id,
          patient_user_id: patientId,
          prescriber_user_id: row.prescriber_user_id || row.created_by_user_id || null,
          created_by_user_id: row.created_by_user_id,
          source_report_version_id: row.source_report_version_id,
          recorded_at: row.recorded_at,
          location_name: "",
        },
        medications: [],
      });
    }
    groups.get(id).medications.push(row);
  }
  return [...groups.values()];
}

async function loadVisits(executor, patientId) {
  const { rows } = await executor.query(
    `SELECT c.id, c.doctor_user_id, c.started_at, c.ended_at, c.created_at,
            a.reason AS appointment_reason, a.scheduled_start_at,
            s.name AS specialty, cl.name AS location_name
       FROM consultations c
       LEFT JOIN appointments a   ON a.id = c.appointment_id
       LEFT JOIN specialties s    ON s.id = a.specialty_id
       LEFT JOIN clinic_locations cl ON cl.id = a.clinic_location_id
      WHERE c.patient_user_id = $1 AND c.status = 'completed'
      ORDER BY c.ended_at DESC NULLS LAST`,
    [patientId]
  );
  return rows;
}

async function loadPublishedReports(executor, patientId) {
  const { rows } = await executor.query(
    `SELECT mr.*, rv.content, rv.rendered_text, rv.version_number, rv.review_decision,
            s.name AS specialty, cl.name AS location_name
       FROM medical_reports mr
       LEFT JOIN report_versions rv ON rv.id = mr.published_version_id
       LEFT JOIN consultations c  ON c.id = mr.consultation_id
       LEFT JOIN appointments a  ON a.id = c.appointment_id
       LEFT JOIN specialties s   ON s.id = a.specialty_id
       LEFT JOIN clinic_locations cl ON cl.id = a.clinic_location_id
      WHERE mr.patient_user_id = $1
        AND mr.report_type = 'report_1_patient_summary'
        AND mr.publication_state = 'published'
      ORDER BY mr.published_at DESC NULLS LAST`,
    [patientId]
  );
  return rows;
}

async function getMedicalRecordFeed({ actorId, query }) {
  const { limit, offset } = pagination(query, { defaultLimit: 50 });
  const [visits, labGroups, prescriptionGroups, reports] = await Promise.all([
    loadVisits(pool, actorId),
    loadLabGroups(pool, actorId),
    loadPrescriptionGroups(pool, actorId),
    loadPublishedReports(pool, actorId),
  ]);

  const entries = [
    ...visits.map((row) =>
      medicalRecordEntry({
        type: "visit",
        id: row.id,
        title: row.specialty ? `${row.specialty} consultation` : "Consultation",
        subtitle: row.appointment_reason || "",
        facility: row.location_name || "",
        date: dateOnly(row.ended_at || row.started_at || row.created_at) || "",
        status: "Completed",
      })
    ),
    ...prescriptionGroups.map(({ group, medications }) =>
      medicalRecordEntry({
        type: "prescription",
        id: group.id,
        title: medications[0]?.medication_name || "Prescription",
        subtitle: medications.map((item) => item.medication_name).join(", "),
        facility: "",
        date: dateOnly(group.recorded_at) || "",
        status: medications.some((item) => item.status === "active") ? "Active" : "Completed",
      })
    ),
    ...labGroups.map(({ order, results }) =>
      medicalRecordEntry({
        type: "lab",
        id: order.id,
        title: order.test_name || "Lab result",
        subtitle: `${results.length} observation${results.length === 1 ? "" : "s"}`,
        facility: order.location_name || "",
        date: dateOnly(order.completed_at || order.ordered_at) || "",
        status: results.some((row) => ["low", "high", "critical_low", "critical_high"].includes(row.abnormal_flag)) ? "Abnormal" : "Normal",
      })
    ),
    ...reports.map((row) =>
      medicalRecordEntry({
        type: "report",
        id: row.id,
        title: "Patient summary report",
        subtitle: "Doctor-approved summary",
        facility: row.location_name || "",
        date: dateOnly(row.published_at || row.created_at) || "",
        status: "Completed",
      })
    ),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const filterType = RECORD_TYPES.includes(query.type) ? query.type : null;
  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const filtered = entries.filter(
    (entry) => (!filterType || entry.type === filterType) && (!search || entry.searchText.includes(search))
  );

  return {
    entries: filtered.slice(offset, offset + limit),
    stats: {
      total: entries.length,
      visits: visits.length,
      prescriptions: prescriptionGroups.length,
      labs: labGroups.length,
      reports: reports.length,
      // No imaging or document table exists.
      imaging: 0,
      documents: 0,
    },
    pagination: {
      total: filtered.length,
      limit,
      offset,
      returned: Math.min(limit, Math.max(filtered.length - offset, 0)),
      hasMore: offset + limit < filtered.length,
    },
  };
}

async function getRecordDetail({ actorId, params }) {
  const type = String(params.type || "");
  const id = assertUuid(params.id, "Record");
  if (!RECORD_TYPES.includes(type)) throw httpError(404, "not_found", "Record not found.");
  if (type === "imaging" || type === "document") {
    // Honest empty state: the schema has no table for these categories.
    throw httpError(404, "not_found", "Record not found.");
  }

  if (type === "visit") {
    const visits = await loadVisits(pool, actorId);
    const visit = visits.find((row) => row.id === id);
    if (!visit) throw httpError(404, "not_found", "Record not found.");
    return { record: serializeVisit({ ...visit, title: visit.specialty ? `${visit.specialty} consultation` : "Consultation" }, {}) };
  }

  if (type === "prescription") {
    const groups = await loadPrescriptionGroups(pool, actorId);
    const match = groups.find((entry) => entry.group.id === id);
    if (!match) throw httpError(404, "not_found", "Record not found.");
    return { record: serializePrescription(match.group, match.medications) };
  }

  if (type === "lab") {
    const groups = await loadLabGroups(pool, actorId);
    const match = groups.find((entry) => entry.order.id === id);
    if (!match) throw httpError(404, "not_found", "Record not found.");
    const trends = await buildTrends(pool, actorId, match.results);
    return { record: serializeLabResult(match.order, match.results, trends) };
  }

  const reports = await loadPublishedReports(pool, actorId);
  const report = reports.find((row) => row.id === id);
  if (!report) throw httpError(404, "not_found", "Record not found.");
  return { record: serializeReport({ ...report, title: "Patient summary report" }, { includeContent: true }) };
}

/** Historical points for each numeric analyte, ordered by resulted_at. */
async function buildTrends(executor, patientId, results) {
  const analytes = [...new Set(results.map((row) => row.analyte_name).filter(Boolean))];
  const trends = [];
  for (const analyte of analytes) {
    const { rows } = await executor.query(
      `SELECT tr.resulted_at AS date, tr.value_numeric AS value, tr.unit
         FROM test_results tr
         JOIN test_orders tor ON tor.id = tr.test_order_id
        WHERE tor.patient_user_id = $1
          AND tr.analyte_name = $2
          AND tr.value_numeric IS NOT NULL
          AND tr.result_status <> 'preliminary'
          AND tr.superseded_by_id IS NULL
        ORDER BY tr.resulted_at`,
      [patientId, analyte]
    );
    const trend = serializeLabTrend(analyte, rows);
    if (trend) trends.push(trend);
  }
  return trends;
}

async function listLabResults({ actorId, query }) {
  const groups = await loadLabGroups(pool, actorId);
  const labs = groups.map(({ order, results }) => serializeLabResult(order, results));
  let filtered = labs;
  if (query.status === "Normal" || query.status === "Abnormal") {
    filtered = filtered.filter((lab) => lab.status === query.status);
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const term = query.search.trim().toLowerCase();
    filtered = filtered.filter((lab) => [lab.name, lab.category, lab.facility].join(" ").toLowerCase().includes(term));
  }
  return {
    labResults: filtered,
    counts: {
      total: labs.length,
      normal: labs.filter((lab) => lab.status === "Normal").length,
      attention: labs.filter((lab) => lab.status === "Abnormal").length,
    },
  };
}

async function getLabResult({ actorId, params }) {
  const id = assertUuid(params.id, "Lab result");
  const groups = await loadLabGroups(pool, actorId);
  const match = groups.find((entry) => entry.order.id === id);
  if (!match) throw httpError(404, "not_found", "Lab result not found.");
  const trends = await buildTrends(pool, actorId, match.results);
  const lab = serializeLabResult(match.order, match.results, trends);
  const reports = await loadPublishedReports(pool, actorId);
  return {
    labResult: {
      ...lab,
      reportId: reports[0]?.id || undefined,
      observations: match.results.map(serializeLabObservation),
    },
  };
}

async function listPrescriptions({ actorId }) {
  const groups = await loadPrescriptionGroups(pool, actorId);
  // Build the record list together with its medications for accurate badges.
  const records = groups.map(({ group, medications }) => serializePrescriptionRecord(group, medications));
  const medications = groups.flatMap(({ group, medications: items }) =>
    items.map((item) => serializeMedication(item, group.id))
  );
  const active = medications.filter((item) => item.status === "Active");

  return {
    prescriptionRecords: records,
    medications,
    counts: {
      activePrescriptions: records.filter((record) => record.status === "Active").length,
      totalPrescriptions: records.length,
      currentMedications: active.length,
      refillsSoon: 0,
      allPrescriptions: records.length,
      myMedications: medications.length,
      history: records.filter((record) => record.status !== "Active").length,
    },
    // Alias for clients that expect the singular response field.
    prescriptions: records,
  };
}

async function getPrescription({ actorId, params }) {
  const id = String(params.id || "");
  const groups = await loadPrescriptionGroups(pool, actorId);
  const match = groups.find((entry) => entry.group.id === id);
  if (!match) throw httpError(404, "not_found", "Prescription not found.");
  return {
    prescription: serializePrescription(match.group, match.medications),
    prescriptionRecord: serializePrescriptionRecord(match.group, match.medications),
    medications: match.medications.map((item) => serializeMedication(item, id)),
  };
}

async function getMedications({ actorId }) {
  const groups = await loadPrescriptionGroups(pool, actorId);
  const medications = groups.flatMap(({ group, medications: items }) =>
    items.map((item) => serializeMedication(item, group.id))
  );
  // No administration-time or refill ledger exists; an empty schedule is the
  // honest representation rather than an invented adherence record.
  const schedule = medications
    .filter((item) => item.status === "Active")
    .flatMap((item) => item.times.map((time) => ({ medication: item, time, minutes: 0 })));
  return {
    medications,
    activeMedications: medications.filter((item) => item.status === "Active"),
    todaySchedule: schedule,
  };
}

module.exports = {
  RECORD_TYPES,
  groupId,
  loadLabGroups,
  loadPrescriptionGroups,
  loadVisits,
  loadPublishedReports,
  buildTrends,
  getMedicalRecordFeed,
  getRecordDetail,
  listLabResults,
  getLabResult,
  listPrescriptions,
  getPrescription,
  getMedications,
  iso,
};

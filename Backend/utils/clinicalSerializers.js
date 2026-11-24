/**
 * Database vocabulary → clinical portal UI vocabulary.
 *
 * Pure mapping functions only. Nothing here creates a clinical value that was
 * not present in the database row; missing data is rendered as an honest empty
 * string / array / null.
 */
const { iso, dateOnly, timeLabel } = require("./dbHelpers");

const ABNORMAL_FLAGS = new Set(["low", "high", "critical_low", "critical_high"]);

function labStatusFromFlag(flag) {
  return ABNORMAL_FLAGS.has(flag) ? "Abnormal" : "Normal";
}

function titleCase(value) {
  if (!value) return "";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Medication/condition status → the three UI buckets. */
function medicationStatus(status) {
  if (status === "active" || status === "on_hold") return "Active";
  if (status === "entered_in_error") return "Expired";
  return "Completed";
}

function medicalRecordEntry({ type, id, title, subtitle, facility, date, time, status }) {
  const searchText = [title, subtitle, facility]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return {
    key: `${type}:${id}`,
    type,
    id,
    title: title || "",
    subtitle: subtitle || "",
    facility: facility || "",
    date: date || "",
    ...(time ? { time } : {}),
    status: status || "",
    searchText,
  };
}

function serializeVisit(row, { medicationIds = [], labIds = [], reportId = null } = {}) {
  return {
    id: row.id,
    title: row.title || "Consultation",
    doctorId: row.doctor_user_id,
    facility: row.location_name || "",
    specialty: row.specialty || "",
    date: dateOnly(row.ended_at || row.scheduled_start_at || row.created_at),
    time: timeLabel(row.started_at || row.scheduled_start_at) || "",
    status: "Completed",
    summary: "",
    // No vitals table exists (decision D-4/D-9). Empty strings are honest.
    vitals: { height: "", weight: "", bloodPressure: "", heartRate: "", temperature: "" },
    diagnosis: { code: "", name: "", description: "", status: "" },
    medicationIds,
    labIds,
    imagingIds: [],
    fileIds: [],
    followUp: { recommendation: "", note: "" },
    reportId: reportId || undefined,
  };
}

function serializeLabObservation(row) {
  return {
    name: row.analyte_name || "",
    value: row.value_text !== null && row.value_text !== undefined
      ? String(row.value_text)
      : row.value_numeric !== null && row.value_numeric !== undefined
        ? String(row.value_numeric)
        : "",
    unit: row.unit || "",
    referenceRange: row.reference_range || "",
    status: labStatusFromFlag(row.abnormal_flag),
  };
}

function serializeLabTrend(analyteName, points) {
  if (!points.length) return null;
  const unit = points[points.length - 1].unit || "";
  return {
    label: analyteName,
    unit,
    range: [0, 0],
    points: points.map((point) => ({ date: dateOnly(point.date), value: Number(point.value) || 0 })),
  };
}

function serializeLabResult(order, results, trends = []) {
  const observations = results.map(serializeLabObservation);
  const abnormal = observations.some((observation) => observation.status === "Abnormal");
  return {
    id: order.id,
    name: order.test_name || "",
    date: dateOnly(order.completed_at || order.ordered_at),
    facility: order.location_name || "",
    category: order.category || "Laboratory",
    status: abnormal ? "Abnormal" : "Normal",
    doctorId: order.ordered_by_doctor_user_id,
    relatedVisitId: order.consultation_id || undefined,
    specimen: "",
    method: "",
    collectedAt: iso(order.completed_at || order.ordered_at),
    reportedAt: iso(results[0]?.resulted_at || order.completed_at || order.ordered_at),
    notes: order.notes || "",
    results: observations,
    trends: trends.filter(Boolean),
  };
}

function serializePrescription(group, medications) {
  return {
    id: group.id,
    medication: medications[0]?.medication_name || "Medication",
    dosage: medications[0]?.dosage || "",
    frequency: medications[0]?.frequency || "",
    duration: "",
    startDate: dateOnly(medications[0]?.started_on || group.recorded_at),
    endDate: dateOnly(medications[0]?.ended_on) || "",
    refills: "0",
    status: medications.some((item) => item.status === "active") ? "Active" : "Completed",
    doctorId: group.prescriber_user_id || group.created_by_user_id || null,
    facility: group.location_name || "",
    date: dateOnly(group.recorded_at),
    relatedVisitId: undefined,
    instructions: medications[0]?.indication ? [medications[0].indication] : [],
    warning: "",
    fileIds: [],
  };
}

function serializePrescriptionRecord(group, medications) {
  return {
    id: group.id,
    title: medications[0]?.medication_name || "Prescription",
    doctorId: group.prescriber_user_id || group.created_by_user_id || null,
    date: dateOnly(group.recorded_at),
    status: medications.some((item) => item.status === "active") ? "Active" : "Completed",
    relatedVisitId: undefined,
    instructions: medications[0]?.indication ? [medications[0].indication] : [],
    notes: undefined,
    fileIds: [],
  };
}

function serializeMedication(row, prescriptionId) {
  return {
    id: row.id,
    prescriptionId,
    name: row.medication_name || "",
    dosage: row.dosage || "",
    strength: "",
    frequency: row.frequency || "",
    times: [],
    duration: "",
    startDate: dateOnly(row.started_on) || "",
    endDate: dateOnly(row.ended_on) || "",
    status: medicationStatus(row.status),
    instructions: row.indication ? [row.indication] : [],
    // No refill ledger exists: 0 is the true remaining count on record.
    refillsRemaining: 0,
    selfReported: row.source_type === "patient_reported",
  };
}

function serializeReport(row, { includeContent = false } = {}) {
  const report = {
    id: row.id,
    title: row.title || titleCase(row.report_type || "Medical report"),
    date: dateOnly(row.published_at || row.created_at),
    doctorId: row.doctor_user_id,
    specialty: row.specialty || "",
    facility: row.location_name || "",
    description: "",
    status: row.publication_state === "published" ? "Completed" : "Draft",
    relatedVisitId: row.consultation_id || undefined,
    reportType: row.report_type,
    publicationState: row.publication_state,
    publishedAt: iso(row.published_at),
    publishedVersionId: row.published_version_id || null,
    sections: [],
  };
  if (includeContent) {
    report.content = row.content ?? {};
    report.renderedText = row.rendered_text || null;
    report.versionNumber = row.version_number ?? null;
    report.reviewDecision = row.review_decision || null;
  }
  return report;
}

function serializeProposal(row) {
  return {
    id: row.id,
    patientUserId: row.patient_user_id,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id || null,
    proposalType: row.proposal_type,
    proposedChanges: row.proposed_changes || {},
    rationale: row.rationale || null,
    conflictDetected: Boolean(row.conflict_detected),
    conflictDetails: row.conflict_details || null,
    status: row.status,
    reviewedAt: iso(row.reviewed_at),
    appliedAt: iso(row.applied_at),
    createdAt: iso(row.created_at),
    sourceReportVersionId: row.source_report_version_id,
  };
}

function serializeFollowUp(row) {
  return {
    id: row.id,
    patientUserId: row.patient_user_id,
    doctorUserId: row.doctor_user_id,
    consultationId: row.consultation_id,
    recommendation: row.recommendation,
    recommendedIntervalDays: row.recommended_interval_days || null,
    dueOn: dateOnly(row.due_on),
    status: row.status,
    createdAt: iso(row.created_at),
  };
}

function serializeAppointmentProposal(row) {
  return {
    id: row.id,
    followUpId: row.follow_up_id || null,
    doctorId: row.doctor_user_id,
    consultationType: row.consultation_type,
    startsAt: iso(row.proposed_start_at),
    endsAt: iso(row.proposed_end_at),
    expiresAt: iso(row.expires_at),
    status: row.status,
    bookedAppointmentId: row.booked_appointment_id || null,
    createdAt: iso(row.created_at),
  };
}

module.exports = {
  ABNORMAL_FLAGS,
  labStatusFromFlag,
  titleCase,
  medicationStatus,
  medicalRecordEntry,
  serializeVisit,
  serializeLabObservation,
  serializeLabTrend,
  serializeLabResult,
  serializePrescription,
  serializePrescriptionRecord,
  serializeMedication,
  serializeReport,
  serializeProposal,
  serializeFollowUp,
  serializeAppointmentProposal,
};

/**
 * Database vocabulary → patient-facing UI vocabulary.
 *
 * These functions are pure: they never touch the database and never invent
 * clinical values. Fields with no persisted source are honest empties
 * (empty arrays, empty strings, zero counts, null where the UI expects null).
 */
const { iso, dateOnly, timeLabel } = require("./dbHelpers");

const UI_APPOINTMENT_STATUS = {
  requested: "Upcoming",
  pending_confirmation: "Upcoming",
  confirmed: "Upcoming",
  checked_in: "Upcoming",
  in_progress: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Cancelled",
  rescheduled: "Cancelled",
};

const UI_CONSULTATION_TYPE = {
  in_person: "In-Person",
  online: "Online",
};

const DB_CONSULTATION_TYPE = {
  "In-Person": "in_person",
  Online: "online",
};

function appointmentReference(id) {
  return `MDR-${String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function toUiAppointmentStatus(status) {
  return UI_APPOINTMENT_STATUS[status] || "Cancelled";
}

function toUiConsultationType(type) {
  return UI_CONSULTATION_TYPE[type] || "In-Person";
}

function toDbConsultationType(type) {
  return DB_CONSULTATION_TYPE[type] || null;
}

function durationMinutes(row) {
  const start = row.scheduled_start_at || row.requested_start_at;
  const end = row.scheduled_end_at || row.requested_end_at;
  if (!start || !end) return row.slot_minutes || 30;
  const minutes = Math.round((new Date(end) - new Date(start)) / 60000);
  return minutes > 0 ? minutes : row.slot_minutes || 30;
}

function serializeAppointment(row, { includeInternal = false, includeTimeline = false } = {}) {
  if (!row) return null;
  const appointment = {
    id: row.id,
    reference: appointmentReference(row.id),
    doctorId: row.doctor_user_id,
    doctorName: row.doctor_name || row.doctor_full_name || null,
    specialty: row.specialty || null,
    startsAt: iso(row.scheduled_start_at || row.requested_start_at),
    endsAt: iso(row.scheduled_end_at || row.requested_end_at),
    durationMinutes: durationMinutes(row),
    consultationType: toUiConsultationType(row.consultation_type),
    status: toUiAppointmentStatus(row.status),
    rawStatus: row.status,
    version: row.version,
    reason: row.reason || undefined,
    notes: row.patient_notes || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    location: row.location_name || null,
    address: row.address_line1 || null,
    createdAt: iso(row.created_at),
  };
  if (includeInternal) appointment.internalNotes = row.internal_notes || null;
  if (includeTimeline) appointment.timeline = (row.timeline || []).map(serializeTimelineEntry);
  return appointment;
}

function serializeTimelineEntry(row) {
  return {
    id: row.id,
    fromStatus: row.from_status || null,
    toStatus: row.to_status,
    reason: row.reason || null,
    changedByUserId: row.changed_by_user_id || null,
    changeSource: row.change_source || null,
    changedAt: iso(row.changed_at),
  };
}

function serializeSlot(slot) {
  return {
    startsAt: iso(slot.startsAt),
    endsAt: iso(slot.endsAt),
    time: slot.time,
    available: slot.available === true,
  };
}

function formatTimeHHMM(value) {
  if (!value) return "00:00";
  return String(value).slice(0, 5);
}

/**
 * Doctor directory row + its availability windows → the UI `Doctor` shape.
 * `availabilityRows` may be empty; the UI already renders honest empty states.
 */
function serializeDoctor(row, availabilityRows = []) {
  const weekly = {};
  let supportsInPerson = false;
  let supportsOnline = false;

  for (const window of availabilityRows) {
    const day = Number(window.weekday);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!weekly[day]) weekly[day] = [];
    weekly[day].push({
      start: formatTimeHHMM(window.start_time),
      end: formatTimeHHMM(window.end_time),
    });
    if (window.consultation_type === "in_person" || window.consultation_type === "both") {
      supportsInPerson = true;
    }
    if (window.consultation_type === "online" || window.consultation_type === "both") {
      supportsOnline = true;
    }
  }

  const years = row.years_of_experience ?? 0;
  return {
    id: row.id,
    name: row.full_name,
    title: row.professional_title || "Doctor",
    specialty: row.specialty || "",
    departmentId: row.department_slug || row.specialty_slug || null,
    department: row.department_name || row.department || "",
    verified: row.verification_status === "verified",
    // No review table exists. Zero is the true count, not a fabricated score,
    // and keeps the UI's numeric formatting intact.
    rating: 0,
    reviews: 0,
    years,
    experience: years > 0 ? `${years} years of experience` : "",
    languages: [],
    bio: row.bio || "",
    tags: [],
    services: [],
    clinic: row.location_name || "",
    address: row.address_line1 || "",
    city: row.city || "",
    supportsInPerson,
    supportsOnline,
    photoUrl: null,
    featured: false,
    weekly,
    patientReviews: [],
  };
}

function serializeDoctorDepartment(row) {
  return {
    id: row.slug,
    name: row.name,
    icon: "plus",
    tone: "teal",
    blurb: "",
  };
}

function serializePatientProfile(row, user) {
  const dateOfBirth = dateOnly(row?.date_of_birth);
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    date_of_birth: dateOfBirth,
    phone: row?.phone || null,
    gender: row?.gender || null,
    profile_completed_at: iso(row?.profile_completed_at),
    completed: Boolean(row?.profile_completed_at),
  };
}

function serializeNotification(row) {
  return {
    id: row.id,
    category: row.category,
    channel: row.channel,
    title: row.title,
    body: row.body,
    status: row.status,
    readAt: iso(row.read_at),
    createdAt: iso(row.created_at),
    relatedEntityType: row.related_entity_type || null,
    relatedEntityId: row.related_entity_id || null,
    // UI-friendly label for the sidebar feed.
    icon: row.category === "appointment" ? "calendar" : row.category === "report_ready" ? "file" : "user",
    tone: "teal",
    text: row.title,
    time: iso(row.created_at),
  };
}

function serializeDashboardAppointment(row) {
  const startsAt = iso(row.scheduled_start_at || row.requested_start_at);
  return {
    id: row.id,
    doctor: row.doctor_full_name || "",
    specialty: row.specialty || "",
    date: dateOnly(row.scheduled_start_at || row.requested_start_at),
    time: timeLabel(row.scheduled_start_at || row.requested_start_at),
    status: toUiAppointmentStatus(row.status),
    startsAt,
  };
}

module.exports = {
  UI_APPOINTMENT_STATUS,
  UI_CONSULTATION_TYPE,
  appointmentReference,
  toUiAppointmentStatus,
  toUiConsultationType,
  toDbConsultationType,
  durationMinutes,
  serializeAppointment,
  serializeTimelineEntry,
  serializeSlot,
  serializeDoctor,
  serializeDoctorDepartment,
  serializePatientProfile,
  serializeNotification,
  serializeDashboardAppointment,
  formatTimeHHMM,
};

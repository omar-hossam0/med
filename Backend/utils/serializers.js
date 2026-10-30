/**
 * Translation layer between the database vocabulary and the shape the admin
 * pages already consume.
 *
 * The database keeps its canonical values (`receptionist`, `pending_activation`,
 * `disabled`). The API speaks the UI's vocabulary (`staff`, `pending`,
 * `inactive`). Nothing here writes to the database.
 */

const DB_TO_API_STATUS = {
  active: "active",
  pending_activation: "pending",
  suspended: "suspended",
  disabled: "inactive",
};

const API_TO_DB_STATUS = {
  active: "active",
  pending: "pending_activation",
  suspended: "suspended",
  inactive: "disabled",
};

const DB_TO_API_ROLE = {
  patient: "patient",
  doctor: "doctor",
  receptionist: "staff",
};

const API_TO_DB_ROLE = {
  doctor: "doctor",
  staff: "receptionist",
};

/** ISO timestamp or date -> YYYY-MM-DD, or null. */
function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function composeAddress(line1, city) {
  const parts = [line1, city].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function mapStatus(status) {
  return DB_TO_API_STATUS[status] || "inactive";
}

/**
 * One account row -> DemoUser.
 * Expects: id, full_name, email, phone, status, created_at, primary_role, roles.
 */
function serializeUser(row) {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone || "",
    role: DB_TO_API_ROLE[row.primary_role] || row.primary_role,
    roles: row.roles || [],
    status: mapStatus(row.status),
    joinedAt: toDateOnly(row.created_at),
  };
}

/**
 * Doctor row -> DoctorMember.
 * Expects the aliases produced by adminDirectoryService.
 */
function serializeDoctor(row) {
  return {
    id: row.id,
    kind: "doctor",
    name: row.full_name,
    title: row.professional_title || "Doctor",
    specialty: row.specialty || "",
    department: row.department || "",
    license: row.license_number,
    years: row.years_of_experience ?? 0,
    email: row.email,
    phone: row.phone || "—",
    dob: toDateOnly(row.date_of_birth) || "—",
    location: row.location_name || "—",
    address: composeAddress(row.address_line1, row.city),
    photoUrl: null,
    about: row.bio || undefined,
    // No services or scheduling tables exist yet; empty values are honest and
    // both UI components already render dedicated empty states.
    services: [],
    availability: [],
    verification: row.verification_status || "pending",
    accountStatus: mapStatus(row.status),
    duty: "off",
    nextShift: null,
  };
}

/**
 * Staff row -> StaffMember.
 * Expects the aliases produced by adminDirectoryService.
 */
function serializeStaff(row) {
  return {
    id: row.id,
    kind: "staff",
    name: row.full_name,
    jobTitle: row.job_title,
    department: row.department || "",
    email: row.email,
    phone: row.phone || "—",
    dob: toDateOnly(row.date_of_birth) || "—",
    location: row.location_name || "—",
    address: composeAddress(row.address_line1, row.city),
    photoUrl: null,
    about: row.bio || undefined,
    shift: row.work_shift || "—",
    accountStatus: mapStatus(row.status),
    duty: "off",
    nextShift: null,
  };
}

module.exports = {
  DB_TO_API_STATUS,
  API_TO_DB_STATUS,
  DB_TO_API_ROLE,
  API_TO_DB_ROLE,
  toDateOnly,
  composeAddress,
  mapStatus,
  serializeUser,
  serializeDoctor,
  serializeStaff,
};

/** Typed demo data for Admin Users Management (frontend-only, in-memory). */

export type UserRole = "patient" | "doctor" | "staff";
export type UserStatus = "active" | "inactive" | "pending" | "suspended";

export type DemoUser = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  status: UserStatus;
  joinedAt: string; // ISO yyyy-mm-dd
  /** Extra details captured by the Add New User flow (used by Doctors & Staff). */
  profile?: {
    dob?: string;
    specialty?: string;
    department?: string;
    license?: string;
    years?: string;
    location?: string;
    jobTitle?: string;
    employmentId?: string;
    schedule?: string;
    photoUrl?: string;
    about?: string;
  };
};

export type UserStats = {
  total: number;
  patients: number;
  doctors: number;
  staff: number;
};

export const ROLE_LABEL: Record<UserRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  staff: "Staff",
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending Invitation",
  suspended: "Suspended",
};

/** Illustrative aggregates shown in the stat cards / tabs (design values). */
export const baseStats: UserStats = {
  total: 1266,
  patients: 1025,
  doctors: 98,
  staff: 143,
};

export const seedUsers: DemoUser[] = [
  { id: "u1", name: "Ahmed Mohamed", role: "patient", email: "ahmed.mohamed@example.com", phone: "01012345678", status: "active", joinedAt: "2026-10-20" },
  { id: "u2", name: "Dr. Sarah Ahmed", role: "doctor", email: "sarah.ahmed@example.com", phone: "01098765432", status: "active", joinedAt: "2026-10-18" },
  { id: "u3", name: "Omar Hassan", role: "staff", email: "omar.hassan@example.com", phone: "01011223344", status: "active", joinedAt: "2026-10-18" },
  { id: "u4", name: "Mona Khaled", role: "patient", email: "mona.khaled@example.com", phone: "01055667788", status: "inactive", joinedAt: "2026-10-18" },
  { id: "u5", name: "Dr. Youssef Ali", role: "doctor", email: "youssef.ali@example.com", phone: "01099887766", status: "active", joinedAt: "2026-10-17" },
  { id: "u6", name: "Fatma Adel", role: "staff", email: "fatma.adel@example.com", phone: "01044332211", status: "active", joinedAt: "2026-10-17" },
  { id: "u7", name: "Karim Mostafa", role: "patient", email: "karim.mostafa@example.com", phone: "", status: "active", joinedAt: "2026-10-17" },
];

export function formatJoined(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ---------------- Add New User options ---------------- */
export const SPECIALTIES = [
  "Cardiology", "Dermatology", "Pediatrics", "Orthopedics", "Gynecology", "ENT", "General Medicine", "Neurology",
];

export const DEPARTMENTS = [
  "Cardiology", "Dermatology", "Pediatrics", "Orthopedics", "Gynecology", "ENT", "General Medicine", "Administration",
];

export const STAFF_TITLES = ["Receptionist", "Front Desk Staff", "Administrative Staff", "Clinic Coordinator"];

export const DOCTOR_PERMISSIONS = [
  { id: "doc-patients", label: "View and manage assigned patients", desc: "Access and manage patients assigned to this doctor." },
  { id: "doc-appts", label: "Manage appointments and schedules", desc: "Create and manage the doctor's appointment schedule." },
  { id: "doc-ai", label: "Create and view AI reports", desc: "Create and review AI-assisted reports for their consultations." },
  { id: "doc-dept", label: "Access department resources", desc: "Access resources shared within their department." },
  { id: "doc-analytics", label: "View analytics and insights", desc: "View operational analytics relevant to their practice." },
];

export const STAFF_PERMISSIONS = [
  { id: "stf-schedule", label: "View appointment schedules", desc: "See clinic appointment schedules." },
  { id: "stf-checkin", label: "Register patient arrivals", desc: "Check patients in for their appointments." },
  { id: "stf-frontdesk", label: "Manage front-desk workflows", desc: "Handle booking and rescheduling at reception." },
  { id: "stf-contact", label: "View permitted patient contact details", desc: "See contact and scheduling details only." },
];

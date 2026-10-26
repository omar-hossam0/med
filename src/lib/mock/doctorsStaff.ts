/** Typed demo data for the Doctors & Staff module (frontend-only, in-memory). */

export type VerificationStatus = "verified" | "pending" | "rejected";
export type AccountStatus = "active" | "inactive" | "pending" | "suspended";
export type DutyStatus = "on-duty" | "on-leave" | "off";
export type DayAvailability = { day: string; time: string | null };

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: "Verified",
  pending: "Pending",
  rejected: "Rejected",
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
  suspended: "Suspended",
};

export const DUTY_LABEL: Record<DutyStatus, string> = {
  "on-duty": "On Duty",
  "on-leave": "On Leave",
  off: "Off Duty",
};

/** Shared by the directory toolbar, side filter panel and the Add New User form. */
export const DS_DEPARTMENTS = [
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Orthopedics",
  "Gynecology",
  "ENT",
  "General Medicine",
  "Neurology",
  "Laboratory",
  "Administration",
  "Nursing",
];

export const DS_LOCATIONS = [
  "Main Hospital",
  "West Clinic",
  "Children's Clinic",
];

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Standard clinic availability matching Reference Image 2 (Mon-Fri with Fri half day, Sat-Sun unavailable). */
const standardAvailability = (): DayAvailability[] => [
  { day: "Mon", time: "9:00 AM – 5:00 PM" },
  { day: "Tue", time: "9:00 AM – 5:00 PM" },
  { day: "Wed", time: "9:00 AM – 5:00 PM" },
  { day: "Thu", time: "9:00 AM – 5:00 PM" },
  { day: "Fri", time: "9:00 AM – 1:00 PM" },
  { day: "Sat", time: null },
  { day: "Sun", time: null },
];

export type DoctorMember = {
  id: string;
  kind: "doctor";
  name: string;
  title: string;
  specialty: string;
  department: string;
  license: string;
  years: number;
  email: string;
  phone: string;
  dob: string;
  location: string;
  locationBadge?: "Primary";
  address?: string;
  photoUrl?: string;
  about?: string;
  services: string[];
  availability: DayAvailability[];
  verification: VerificationStatus;
  accountStatus: AccountStatus;
  duty: DutyStatus;
  nextShift?: { day: string; time: string; location: string };
};

export type StaffMember = {
  id: string;
  kind: "staff";
  name: string;
  jobTitle: string;
  area?: string;
  department: string;
  email: string;
  phone: string;
  dob: string;
  location: string;
  locationBadge?: "Primary";
  address?: string;
  photoUrl?: string;
  about?: string;
  shift: string;
  accountStatus: AccountStatus;
  duty: DutyStatus;
  nextShift?: { day: string; time: string; location: string };
};

export type DirectoryMember = DoctorMember | StaffMember;

const MAIN = "Main Hospital";
const WEST = "West Clinic";
const PEDS = "Children's Clinic";
const MAIN_ADDR = "123 Health St, Cairo, Egypt";
const WEST_ADDR = "45 El Nile St, Giza, Egypt";
const PEDS_ADDR = "12 El Horreya Rd, Maadi, Cairo";

const addrFor = (loc: string) =>
  loc === MAIN ? MAIN_ADDR : loc === WEST ? WEST_ADDR : PEDS_ADDR;

function doctor(
  d: Omit<DoctorMember, "kind" | "address" | "availability"> & {
    availability?: DayAvailability[];
  },
): DoctorMember {
  return {
    ...d,
    kind: "doctor",
    address: addrFor(d.location),
    availability: d.availability ?? standardAvailability(),
  };
}

function staff(s: Omit<StaffMember, "kind" | "address">): StaffMember {
  return { ...s, kind: "staff", address: addrFor(s.location) };
}

/* -------------------------------------------------------------------------- */
/* TOP 8 CORE MEMBERS (EXACT REFERENCE SCREENSHOTS 1 & 2)                    */
/* -------------------------------------------------------------------------- */

export const coreDoctors: DoctorMember[] = [
  doctor({
    id: "doc-ahmed-hassan",
    name: "Dr. Ahmed Hassan",
    title: "Consultant Cardiologist",
    specialty: "Cardiology",
    department: "Cardiology Department",
    license: "MD-2025-12345",
    years: 8,
    email: "ahmed.hassan@medora.com",
    phone: "+20 112 345 6789",
    dob: "Apr 15, 1990",
    location: MAIN,
    locationBadge: "Primary",
    photoUrl: "/images/members/ahmed_hassan.png",
    about:
      "Board-certified cardiologist with 8 years of experience in interventional cardiology and a strong focus on preventive heart care. Dedicated to providing high-quality, patient-centered care and utilizing the latest medical advancements.",
    services: [
      "General Cardiology",
      "Interventional Cardiology",
      "Echocardiography",
      "Preventive Cardiology",
    ],
    verification: "verified",
    accountStatus: "active",
    duty: "on-duty",
    nextShift: { day: "Today, 9:00 AM – 1:00 PM", time: "9:00 AM – 1:00 PM", location: MAIN },
  }),
  doctor({
    id: "doc-sarah-mohamed",
    name: "Dr. Sarah Mohamed",
    title: "Dermatologist",
    specialty: "Dermatology",
    department: "Dermatology Department",
    license: "MD-2023-88412",
    years: 6,
    email: "sarah.mohamed@medora.com",
    phone: "+20 100 987 6543",
    dob: "Sep 2, 1992",
    location: WEST,
    photoUrl: "/images/members/sarah_mohamed.png",
    about:
      "Dermatologist specializing in medical and cosmetic dermatology, with a patient-first approach to skin health and modern phototherapy treatments.",
    services: ["General Dermatology", "Acne Treatment", "Skin Screening"],
    verification: "pending",
    accountStatus: "active",
    duty: "on-duty",
    nextShift: { day: "Today, 10:00 AM – 2:00 PM", time: "10:00 AM – 2:00 PM", location: WEST },
  }),
  doctor({
    id: "doc-youssef-ali",
    name: "Dr. Youssef Ali",
    title: "Orthopedic Surgeon",
    specialty: "Orthopedics",
    department: "Orthopedics Department",
    license: "MD-2018-44910",
    years: 12,
    email: "youssef.ali@medora.com",
    phone: "+20 111 222 3333",
    dob: "Jan 18, 1984",
    location: MAIN,
    locationBadge: "Primary",
    photoUrl: "/images/members/youssef_ali.png",
    about:
      "Orthopedic surgeon focused on sports injuries and joint reconstruction, with more than a decade of surgical experience in minimally invasive arthroscopy.",
    services: ["Joint Replacement", "Sports Medicine", "Fracture Care"],
    verification: "verified",
    accountStatus: "active",
    duty: "on-leave",
    nextShift: { day: "Next Monday, 9:00 AM – 3:00 PM", time: "9:00 AM – 3:00 PM", location: MAIN },
  }),
  doctor({
    id: "doc-nourhan-ibrahim",
    name: "Dr. Nourhan Ibrahim",
    title: "Pediatrician",
    specialty: "Pediatrics",
    department: "Pediatrics Department",
    license: "MD-2020-77319",
    years: 9,
    email: "nourhan.ibrahim@medora.com",
    phone: "+20 122 456 7890",
    dob: "Mar 30, 1991",
    location: PEDS,
    photoUrl: "/images/members/nourhan_ibrahim.png",
    about:
      "Pediatrician providing comprehensive care for infants, children and adolescents, including preventive and developmental follow-up.",
    services: ["Well-child Visits", "Vaccinations", "Developmental Screening"],
    verification: "verified",
    accountStatus: "active",
    duty: "on-duty",
    nextShift: { day: "Today, 11:00 AM – 4:00 PM", time: "11:00 AM – 4:00 PM", location: PEDS },
  }),
];

export const coreStaff: StaffMember[] = [
  staff({
    id: "stf-omar-hassan",
    name: "Omar Hassan",
    jobTitle: "Receptionist",
    area: "Front Desk",
    department: "Administration",
    email: "omar.hassan@medora.com",
    phone: "+20 111 987 6543",
    dob: "Mar 12, 1996",
    location: MAIN,
    locationBadge: "Primary",
    photoUrl: "/images/members/omar_hassan.png",
    about:
      "Experienced medical receptionist managing patient intake, check-in, appointments and telephone enquiries with care and operational precision.",
    shift: "Mon–Fri, 9:00 AM – 5:00 PM",
    accountStatus: "active",
    duty: "on-duty",
    nextShift: { day: "Today, 9:00 AM – 5:00 PM", time: "9:00 AM – 5:00 PM", location: MAIN },
  }),
  staff({
    id: "stf-fatma-adel",
    name: "Fatma Adel",
    jobTitle: "Nurse",
    area: "Nursing",
    department: "Nursing",
    email: "fatma.adel@medora.com",
    phone: "+20 108 543 2198",
    dob: "Jan 25, 1994",
    location: WEST,
    photoUrl: "/images/members/fatma_adel.png",
    about:
      "Registered nurse supporting outpatient consultations, patient triage, immunizations and post-treatment education.",
    shift: "Mon–Fri, 8:00 AM – 4:00 PM",
    accountStatus: "active",
    duty: "on-duty",
    nextShift: { day: "Today, 8:00 AM – 4:00 PM", time: "8:00 AM – 4:00 PM", location: WEST },
  }),
  staff({
    id: "stf-kareem-mostafa",
    name: "Kareem Mostafa",
    jobTitle: "Lab Technician",
    area: "Laboratory",
    department: "Laboratory",
    email: "kareem.mostafa@medora.com",
    phone: "+20 109 878 5432",
    dob: "Sep 8, 1993",
    location: MAIN,
    locationBadge: "Primary",
    photoUrl: "/images/members/kareem_mostafa.png",
    about:
      "Certified medical laboratory technician handling diagnostic testing, blood analysis, sample processing and calibration.",
    shift: "Mon–Fri, 9:00 AM – 5:00 PM",
    accountStatus: "active",
    duty: "on-duty",
    nextShift: { day: "Today, 9:00 AM – 5:00 PM", time: "9:00 AM – 5:00 PM", location: MAIN },
  }),
  staff({
    id: "stf-alya-samir",
    name: "Alya Samir",
    jobTitle: "Administrator",
    area: "Administration",
    department: "Administration",
    email: "alya.samir@medora.com",
    phone: "+20 112 654 3210",
    dob: "Apr 2, 1990",
    location: MAIN,
    photoUrl: "/images/members/alya_samir.png",
    about:
      "Hospital operations administrator overseeing front-desk staffing, facility logistics and patient coordination workflows.",
    shift: "Mon–Fri, 9:00 AM – 5:00 PM",
    accountStatus: "inactive",
    duty: "off",
  }),
];

/* -------------------------------------------------------------------------- */
/* FULL DETERMINISTIC DATASET (98 DOCTORS, 143 STAFF = 241 TOTAL)            */
/* -------------------------------------------------------------------------- */

const DOCTOR_SPECS = [
  { spec: "Cardiology", dept: "Cardiology Department" },
  { spec: "Dermatology", dept: "Dermatology Department" },
  { spec: "Orthopedics", dept: "Orthopedics Department" },
  { spec: "Pediatrics", dept: "Pediatrics Department" },
  { spec: "Neurology", dept: "Neurology Department" },
  { spec: "Gynecology", dept: "Gynecology Department" },
  { spec: "ENT", dept: "ENT Department" },
  { spec: "General Medicine", dept: "General Medicine Department" },
];

const FIRST_NAMES = [
  "Tarek", "Mahmoud", "Salma", "Hoda", "Mariam", "Yasser", "Nada", "Amr",
  "Dina", "Khaled", "Sherif", "Rania", "Hazem", "Mona", "Wael", "Noha",
  "Karim", "Laila", "Hany", "Ghada", "Ibrahim", "Yasmin", "Hassan", "Amina",
];

const LAST_NAMES = [
  "Nabil", "Samir", "Ehab", "Fathy", "Salah", "Kamal", "Raouf", "Mansour",
  "Tawfik", "Zaki", "Ayman", "Fouad", "Gamil", "Badawi", "Shalaby", "Kandil",
  "Ghanem", "Zahran", "Darwish", "Farouk", "El-Sayed", "Soliman", "Radwan", "Shokry",
];

function generateRemainingDoctors(): DoctorMember[] {
  const result: DoctorMember[] = [];
  // coreDoctors has 4 (1 pending: Sarah, 3 on-duty: Ahmed, Sarah, Nourhan)
  // Target: total 98 doctors, exactly 12 pending verification, exactly 40 on-duty doctors
  const needed = 98 - coreDoctors.length; // 94
  const pendingNeeded = 12 - 1; // 11
  const onDutyNeeded = 40 - 3; // 37

  for (let i = 0; i < needed; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const name = `Dr. ${fn} ${ln}`;
    const sObj = DOCTOR_SPECS[i % DOCTOR_SPECS.length];
    const loc = i % 3 === 0 ? MAIN : i % 3 === 1 ? WEST : PEDS;
    const isPending = i < pendingNeeded;
    const isOnDuty = i < onDutyNeeded;
    const verification: VerificationStatus = isPending ? "pending" : "verified";
    const duty: DutyStatus = isOnDuty ? "on-duty" : (i % 5 === 0 ? "on-leave" : "off");

    result.push(
      doctor({
        id: `doc-gen-${i + 5}`,
        name,
        title: sObj.spec === "Cardiology" ? "Consultant Cardiologist" : `${sObj.spec} Specialist`,
        specialty: sObj.spec,
        department: sObj.dept,
        license: `MD-202${(i % 5) + 1}-${10000 + i * 17}`,
        years: 4 + (i % 18),
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@medora.com`,
        phone: `+20 1${(i % 3) + 0}${i % 10} ${100 + (i * 7) % 900} ${1000 + (i * 31) % 9000}`,
        dob: `May ${(i % 28) + 1}, ${1980 + (i % 15)}`,
        location: loc,
        locationBadge: loc === MAIN && i % 4 === 0 ? "Primary" : undefined,
        about: `Senior ${sObj.spec.toLowerCase()} specialist with extensive clinical background at Medora.`,
        services: [`General ${sObj.spec}`, "Consultation", "Specialized Care"],
        verification,
        accountStatus: "active",
        duty,
        nextShift: isOnDuty
          ? { day: "Today, 9:00 AM – 5:00 PM", time: "9:00 AM – 5:00 PM", location: loc }
          : undefined,
      }),
    );
  }
  return result;
}

const STAFF_ROLES = [
  { title: "Receptionist", area: "Front Desk", dept: "Administration" },
  { title: "Nurse", area: "Nursing", dept: "Nursing" },
  { title: "Lab Technician", area: "Laboratory", dept: "Laboratory" },
  { title: "Administrator", area: "Administration", dept: "Administration" },
  { title: "Clinic Coordinator", area: "Administration", dept: "Administration" },
  { title: "Front Desk Staff", area: "Front Desk", dept: "Administration" },
];

function generateRemainingStaff(): StaffMember[] {
  const result: StaffMember[] = [];
  // coreStaff has 4 (3 on-duty: Omar, Fatma, Kareem; 1 inactive: Alya)
  // Target: total 143 staff, exactly 36 on-duty staff (total 40 doctors + 36 staff = 76 on-duty)
  const needed = 143 - coreStaff.length; // 139
  const onDutyNeeded = 36 - 3; // 33

  for (let i = 0; i < needed; i++) {
    const fn = FIRST_NAMES[(i + 7) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i + 13) % LAST_NAMES.length];
    const name = `${fn} ${ln}`;
    const rObj = STAFF_ROLES[i % STAFF_ROLES.length];
    const loc = i % 2 === 0 ? MAIN : WEST;
    const isOnDuty = i < onDutyNeeded;
    const isInactive = i === 42 || i === 84;
    const accountStatus: AccountStatus = isInactive ? "inactive" : "active";
    const duty: DutyStatus = isOnDuty ? "on-duty" : (i % 7 === 0 ? "on-leave" : "off");

    result.push(
      staff({
        id: `stf-gen-${i + 5}`,
        name,
        jobTitle: rObj.title,
        area: rObj.area,
        department: rObj.dept,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@medora.com`,
        phone: `+20 1${(i % 3) + 0}${i % 10} ${200 + (i * 9) % 800} ${2000 + (i * 47) % 8000}`,
        dob: `Oct ${(i % 28) + 1}, ${1990 + (i % 10)}`,
        location: loc,
        locationBadge: loc === MAIN && i % 3 === 0 ? "Primary" : undefined,
        about: `${rObj.title} contributing to daily clinical operations and patient coordination at Medora.`,
        shift: "Mon–Fri, 9:00 AM – 5:00 PM",
        accountStatus,
        duty,
        nextShift: isOnDuty
          ? { day: "Today, 9:00 AM – 5:00 PM", time: "9:00 AM – 5:00 PM", location: loc }
          : undefined,
      }),
    );
  }
  return result;
}

export const seedDoctors: DoctorMember[] = [
  ...coreDoctors,
  ...generateRemainingDoctors(),
];

export const seedStaff: StaffMember[] = [
  ...coreStaff,
  ...generateRemainingStaff(),
];

/** Directory stats derived dynamically from the demo dataset (never hardcoded). */
export function directoryStats(members: DirectoryMember[]) {
  const doctors = members.filter((m) => m.kind === "doctor");
  const staffMembers = members.filter((m) => m.kind === "staff");
  return {
    doctors: doctors.length,
    staff: staffMembers.length,
    pendingVerification: doctors.filter((d) => d.verification === "pending").length,
    onDuty: members.filter((m) => m.duty === "on-duty").length,
    total: members.length,
  };
}

/* ---------------- Users Management integration ---------------- */

import type { DemoUser } from "./users";

/**
 * Maps a user created through the Add New User flow onto a directory record so
 * the same demo person appears in Users Management, the directory and details.
 * Patients are not directory members (they self-register publicly).
 */
export function demoUserToMember(u: DemoUser): DirectoryMember | null {
  if (u.role !== "doctor" && u.role !== "staff") return null;
  const p = u.profile ?? {};
  const shared = {
    id: u.id,
    email: u.email,
    phone: u.phone || "—",
    dob: p.dob || "—",
    location: p.location || "Main Hospital",
    about: p.about,
    photoUrl: p.photoUrl,
    accountStatus: u.status,
    duty: "off" as DutyStatus,
  };
  if (u.role === "doctor") {
    return {
      ...shared,
      kind: "doctor",
      name: /^dr\.?\s/i.test(u.name) ? u.name : `Dr. ${u.name}`,
      title: p.specialty ? `${p.specialty} Specialist` : "Doctor",
      specialty: p.specialty || "General Medicine",
      department: p.department || `${p.specialty || "General"} Department`,
      license: p.license || "MD-PENDING",
      years: Number(p.years) || 1,
      services: [p.specialty || "General Medicine", "Consultation"],
      availability: standardAvailability(),
      verification: "pending",
    };
  }
  return {
    ...shared,
    kind: "staff",
    name: u.name,
    jobTitle: p.jobTitle || "Staff",
    area: p.department || "Administration",
    department: p.department || "Administration",
    shift: p.schedule || "Mon–Fri, 9:00 AM – 5:00 PM",
  };
}

/** Added users come first, followed by the core 8 cards, followed by the rest. */
export function mergeMembers(users: DemoUser[]): DirectoryMember[] {
  const added = users
    .map(demoUserToMember)
    .filter((m): m is DirectoryMember => m !== null);
  // Ensure the top 8 core members from Reference Image 1 stay first on page 1 when no added users
  const restDoctors = seedDoctors.slice(coreDoctors.length);
  const restStaff = seedStaff.slice(coreStaff.length);
  return [...added, ...coreDoctors, ...coreStaff, ...restDoctors, ...restStaff];
}

/** Resolves a directory record by id (added users or seed data). */
export function findMember(users: DemoUser[], id: string): DirectoryMember | null {
  return mergeMembers(users).find((m) => m.id === id) ?? null;
}

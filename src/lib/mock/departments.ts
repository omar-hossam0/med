/**
 * Typed demo data and types for the Departments Management module.
 * Frontend-only implementation with local reactive state.
 */

export type DepartmentStatus = "active" | "inactive";

export type DepartmentActivity = {
  id: string;
  action: string;
  timestamp: string;
  actor: string;
  type: "updated" | "doctor_assigned" | "doctor_removed" | "status_changed" | "created";
};

export type DepartmentStats = {
  assignedDoctors: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
};

export type Department = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: DepartmentIconKey;
  status: DepartmentStatus;
  displayOrder: number;
  assignedDoctorIds: string[];
  services: string[];
  headOfDepartment?: string;
  location: string;
  locationBadge?: "Primary";
  locationAddress: string;
  createdAt: string;
  updatedAt: string;
  stats: DepartmentStats;
  recentActivity: DepartmentActivity[];
};

export type DepartmentIconKey =
  | "heart"
  | "skin"
  | "baby"
  | "bone"
  | "venus"
  | "ear"
  | "eye"
  | "brain"
  | "stethoscope"
  | "psychiatry"
  | "radiology"
  | "ribbon"
  | "activity"
  | "pill"
  | "microscope"
  | "syringe"
  | "dna"
  | "shield";

export type IconStyleConfig = {
  label: string;
  bg: string;
  color: string;
  border?: string;
};

export const DEPARTMENT_ICON_CONFIGS: Record<DepartmentIconKey, IconStyleConfig> = {
  heart: {
    label: "Heart (Cardiology)",
    bg: "bg-[#FDECEF]",
    color: "#EF4444",
  },
  skin: {
    label: "Skin & Hair (Dermatology)",
    bg: "bg-[#FFF4ED]",
    color: "#F97316",
  },
  baby: {
    label: "Pediatrics",
    bg: "bg-[#EFF6FF]",
    color: "#3B82F6",
  },
  bone: {
    label: "Orthopedics",
    bg: "bg-[#E0F2FE]",
    color: "#0284C7",
  },
  venus: {
    label: "Gynecology",
    bg: "bg-[#FDF2F8]",
    color: "#EC4899",
  },
  ear: {
    label: "ENT",
    bg: "bg-[#FFF1F2]",
    color: "#F43F5E",
  },
  eye: {
    label: "Ophthalmology",
    bg: "bg-[#EEF2FF]",
    color: "#4F46E5",
  },
  brain: {
    label: "Neurology",
    bg: "bg-[#FAF5FF]",
    color: "#A855F7",
  },
  stethoscope: {
    label: "General Medicine",
    bg: "bg-[#F0FDFA]",
    color: "#0D9488",
  },
  psychiatry: {
    label: "Psychiatry",
    bg: "bg-[#F3E8FF]",
    color: "#9333EA",
  },
  radiology: {
    label: "Radiology",
    bg: "bg-[#E0F2FE]",
    color: "#0284C7",
  },
  ribbon: {
    label: "Oncology",
    bg: "bg-[#FEE2E2]",
    color: "#EF4444",
  },
  activity: {
    label: "Emergency / Activity",
    bg: "bg-[#FEF3C7]",
    color: "#D97706",
  },
  pill: {
    label: "Pharmacy",
    bg: "bg-[#ECFDF5]",
    color: "#059669",
  },
  microscope: {
    label: "Laboratory",
    bg: "bg-[#F5F3FF]",
    color: "#7C3AED",
  },
  syringe: {
    label: "Anesthesiology",
    bg: "bg-[#EFF6FF]",
    color: "#2563EB",
  },
  dna: {
    label: "Genetics",
    bg: "bg-[#FDF4FF]",
    color: "#C026D3",
  },
  shield: {
    label: "Preventive Medicine",
    bg: "bg-[#ECFEFF]",
    color: "#0891B2",
  },
};

/**
 * Initial 12 medical departments matching Reference Image 1 & Reference Image 2.
 */
export const seedDepartments: Department[] = [
  {
    id: "cardiology",
    name: "Cardiology",
    slug: "cardiology",
    description: "Diagnosis and treatment of heart and cardiovascular conditions.",
    icon: "heart",
    status: "active",
    displayOrder: 1,
    assignedDoctorIds: [
      "doc-ahmed-hassan",
      "doc-sarah-mohamed",
      "doc-kareem-mostafa",
      "doc-gen-5",
      "doc-gen-6",
    ],
    services: [
      "General Cardiology",
      "Interventional Cardiology",
      "Echocardiography",
      "Cardiac Rehabilitation",
      "Preventive Cardiology",
      "Electrophysiology",
      "Heart Failure Management",
      "Cardiovascular Screening",
    ],
    headOfDepartment: "Dr. Ahmed Hassan",
    location: "Main Hospital",
    locationBadge: "Primary",
    locationAddress: "123 Health St, Cairo, Egypt",
    createdAt: "Oct 10, 2024",
    updatedAt: "Oct 20, 2026, 10:30 AM",
    stats: {
      assignedDoctors: 5,
      totalAppointments: 342,
      completedAppointments: 298,
      cancelledAppointments: 32,
    },
    recentActivity: [
      {
        id: "act-c-1",
        action: "Department updated",
        timestamp: "Oct 20, 2026, 10:30 AM",
        actor: "Medora Administrator",
        type: "updated",
      },
      {
        id: "act-c-2",
        action: "New doctor assigned",
        timestamp: "Oct 18, 2026, 02:15 PM",
        actor: "Medora Administrator",
        type: "doctor_assigned",
      },
      {
        id: "act-c-3",
        action: "Status changed to Active",
        timestamp: "Oct 15, 2026, 11:45 AM",
        actor: "Medora Administrator",
        type: "status_changed",
      },
    ],
  },
  {
    id: "dermatology",
    name: "Dermatology",
    slug: "dermatology",
    description: "Treatment of skin, hair, and nail conditions.",
    icon: "skin",
    status: "active",
    displayOrder: 2,
    assignedDoctorIds: ["doc-sarah-mohamed", "doc-gen-7", "doc-gen-8"],
    services: [
      "General Dermatology",
      "Acne & Rosacea Care",
      "Skin Cancer Screening",
      "Phototherapy",
      "Cosmetic Dermatology",
      "Nail & Hair Disorders",
    ],
    headOfDepartment: "Dr. Sarah Mohamed",
    location: "West Clinic",
    locationAddress: "45 West Palm Ave, Cairo, Egypt",
    createdAt: "Oct 12, 2024",
    updatedAt: "Oct 19, 2026, 09:15 AM",
    stats: {
      assignedDoctors: 3,
      totalAppointments: 198,
      completedAppointments: 175,
      cancelledAppointments: 14,
    },
    recentActivity: [
      {
        id: "act-d-1",
        action: "Services updated",
        timestamp: "Oct 19, 2026, 09:15 AM",
        actor: "Medora Administrator",
        type: "updated",
      },
      {
        id: "act-d-2",
        action: "Doctor assigned",
        timestamp: "Oct 11, 2026, 03:20 PM",
        actor: "Medora Administrator",
        type: "doctor_assigned",
      },
    ],
  },
  {
    id: "pediatrics",
    name: "Pediatrics",
    slug: "pediatrics",
    description: "Medical care for infants, children, and adolescents.",
    icon: "baby",
    status: "active",
    displayOrder: 3,
    assignedDoctorIds: ["doc-nourhan-ibrahim", "doc-gen-9", "doc-gen-10", "doc-gen-11"],
    services: [
      "Well-Child Visits",
      "Immunizations & Vaccines",
      "Developmental Screening",
      "Pediatric Acute Care",
      "Adolescent Medicine",
      "Newborn Care",
    ],
    headOfDepartment: "Dr. Nourhan Ibrahim",
    location: "Children's Clinic",
    locationAddress: "12 Pediatric Way, Cairo, Egypt",
    createdAt: "Oct 14, 2024",
    updatedAt: "Oct 17, 2026, 11:00 AM",
    stats: {
      assignedDoctors: 4,
      totalAppointments: 276,
      completedAppointments: 245,
      cancelledAppointments: 21,
    },
    recentActivity: [
      {
        id: "act-p-1",
        action: "Department schedule updated",
        timestamp: "Oct 17, 2026, 11:00 AM",
        actor: "Medora Administrator",
        type: "updated",
      },
    ],
  },
  {
    id: "orthopedics",
    name: "Orthopedics",
    slug: "orthopedics",
    description: "Diagnosis and treatment of musculoskeletal conditions.",
    icon: "bone",
    status: "active",
    displayOrder: 4,
    assignedDoctorIds: ["doc-youssef-ali", "doc-gen-12", "doc-gen-13", "doc-gen-14"],
    services: [
      "Joint Replacement",
      "Sports Medicine",
      "Fracture & Trauma Care",
      "Arthroscopy",
      "Spine Surgery Consultation",
    ],
    headOfDepartment: "Dr. Youssef Ali",
    location: "Main Hospital",
    locationBadge: "Primary",
    locationAddress: "123 Health St, Cairo, Egypt",
    createdAt: "Oct 15, 2024",
    updatedAt: "Oct 16, 2026, 04:45 PM",
    stats: {
      assignedDoctors: 4,
      totalAppointments: 210,
      completedAppointments: 188,
      cancelledAppointments: 16,
    },
    recentActivity: [
      {
        id: "act-o-1",
        action: "Doctor reassigned",
        timestamp: "Oct 16, 2026, 04:45 PM",
        actor: "Medora Administrator",
        type: "doctor_assigned",
      },
    ],
  },
  {
    id: "gynecology",
    name: "Gynecology",
    slug: "gynecology",
    description: "Women's reproductive health and related care.",
    icon: "venus",
    status: "active",
    displayOrder: 5,
    assignedDoctorIds: ["doc-fatma-adel", "doc-gen-15", "doc-gen-16"],
    services: [
      "Obstetrics & Prenatal Care",
      "Annual Well-Woman Exam",
      "Gynecologic Ultrasound",
      "Family Planning",
      "Menopause Management",
    ],
    headOfDepartment: "Dr. Fatma Adel",
    location: "Main Hospital",
    locationBadge: "Primary",
    locationAddress: "123 Health St, Cairo, Egypt",
    createdAt: "Oct 18, 2024",
    updatedAt: "Oct 14, 2026, 01:20 PM",
    stats: {
      assignedDoctors: 3,
      totalAppointments: 189,
      completedAppointments: 168,
      cancelledAppointments: 12,
    },
    recentActivity: [
      {
        id: "act-g-1",
        action: "Services updated",
        timestamp: "Oct 14, 2026, 01:20 PM",
        actor: "Medora Administrator",
        type: "updated",
      },
    ],
  },
  {
    id: "ent",
    name: "ENT",
    slug: "ent",
    description: "Ear, nose, throat and related head and neck conditions.",
    icon: "ear",
    status: "active",
    displayOrder: 6,
    assignedDoctorIds: ["doc-alya-samir", "doc-gen-17"],
    services: [
      "Hearing Tests & Audiology",
      "Sinus & Nasal Treatments",
      "Throat & Tonsil Care",
      "Head & Neck Surgery",
      "Vertigo & Balance Care",
    ],
    headOfDepartment: "Dr. Alya Samir",
    location: "West Clinic",
    locationAddress: "45 West Palm Ave, Cairo, Egypt",
    createdAt: "Oct 20, 2024",
    updatedAt: "Oct 12, 2026, 10:00 AM",
    stats: {
      assignedDoctors: 2,
      totalAppointments: 145,
      completedAppointments: 130,
      cancelledAppointments: 9,
    },
    recentActivity: [
      {
        id: "act-e-1",
        action: "Details reviewed",
        timestamp: "Oct 12, 2026, 10:00 AM",
        actor: "Medora Administrator",
        type: "updated",
      },
    ],
  },
  {
    id: "ophthalmology",
    name: "Ophthalmology",
    slug: "ophthalmology",
    description: "Eye care and vision health services.",
    icon: "eye",
    status: "active",
    displayOrder: 7,
    assignedDoctorIds: ["doc-gen-18", "doc-gen-19"],
    services: [
      "Comprehensive Eye Exams",
      "Cataract Evaluation",
      "Glaucoma Screening",
      "Refractive Laser Consultation",
      "Retinal Health",
    ],
    location: "Main Hospital",
    locationBadge: "Primary",
    locationAddress: "123 Health St, Cairo, Egypt",
    createdAt: "Oct 22, 2024",
    updatedAt: "Oct 10, 2026, 02:40 PM",
    stats: {
      assignedDoctors: 2,
      totalAppointments: 134,
      completedAppointments: 121,
      cancelledAppointments: 8,
    },
    recentActivity: [
      {
        id: "act-op-1",
        action: "Specialty profile updated",
        timestamp: "Oct 10, 2026, 02:40 PM",
        actor: "Medora Administrator",
        type: "updated",
      },
    ],
  },
  {
    id: "neurology",
    name: "Neurology",
    slug: "neurology",
    description: "Diagnosis and treatment of nervous system disorders.",
    icon: "brain",
    status: "active",
    displayOrder: 8,
    assignedDoctorIds: ["doc-gen-20", "doc-gen-21", "doc-gen-22"],
    services: [
      "Neurological Consultations",
      "EEG & Neuromonitoring",
      "Stroke Follow-up Care",
      "Epilepsy & Seizure Management",
      "Headache & Migraine Therapy",
    ],
    location: "Main Hospital",
    locationBadge: "Primary",
    locationAddress: "123 Health St, Cairo, Egypt",
    createdAt: "Oct 24, 2024",
    updatedAt: "Oct 08, 2026, 04:10 PM",
    stats: {
      assignedDoctors: 3,
      totalAppointments: 167,
      completedAppointments: 150,
      cancelledAppointments: 11,
    },
    recentActivity: [
      {
        id: "act-n-1",
        action: "Doctor added to roster",
        timestamp: "Oct 08, 2026, 04:10 PM",
        actor: "Medora Administrator",
        type: "doctor_assigned",
      },
    ],
  },
  {
    id: "general-medicine",
    name: "General Medicine",
    slug: "general-medicine",
    description: "Primary healthcare and general medical care.",
    icon: "stethoscope",
    status: "active",
    displayOrder: 9,
    assignedDoctorIds: ["doc-omar-hassan", "doc-gen-23"],
    services: [
      "Routine Physical Exams",
      "Chronic Disease Care",
      "Preventive Health Checkups",
      "Adult Immunizations",
      "Primary Triage",
    ],
    headOfDepartment: "Dr. Omar Hassan",
    location: "Main Hospital",
    locationBadge: "Primary",
    locationAddress: "123 Health St, Cairo, Egypt",
    createdAt: "Oct 25, 2024",
    updatedAt: "Oct 06, 2026, 08:30 AM",
    stats: {
      assignedDoctors: 2,
      totalAppointments: 98,
      completedAppointments: 89,
      cancelledAppointments: 5,
    },
    recentActivity: [
      {
        id: "act-gm-1",
        action: "Location updated",
        timestamp: "Oct 06, 2026, 08:30 AM",
        actor: "Medora Administrator",
        type: "updated",
      },
    ],
  },
  {
    id: "psychiatry",
    name: "Psychiatry",
    slug: "psychiatry",
    description: "Mental health and behavioral healthcare.",
    icon: "psychiatry",
    status: "active",
    displayOrder: 10,
    assignedDoctorIds: ["doc-gen-24", "doc-gen-25"],
    services: [
      "Psychiatric Assessment",
      "Medication Management",
      "Cognitive Behavioral Therapy",
      "Mood & Anxiety Disorder Care",
    ],
    location: "West Clinic",
    locationAddress: "45 West Palm Ave, Cairo, Egypt",
    createdAt: "Oct 27, 2024",
    updatedAt: "Oct 04, 2026, 03:00 PM",
    stats: {
      assignedDoctors: 2,
      totalAppointments: 87,
      completedAppointments: 79,
      cancelledAppointments: 4,
    },
    recentActivity: [
      {
        id: "act-psy-1",
        action: "Services updated",
        timestamp: "Oct 04, 2026, 03:00 PM",
        actor: "Medora Administrator",
        type: "updated",
      },
    ],
  },
  {
    id: "radiology",
    name: "Radiology",
    slug: "radiology",
    description: "Diagnostic imaging and radiology services.",
    icon: "radiology",
    status: "active",
    displayOrder: 11,
    assignedDoctorIds: ["doc-gen-26", "doc-gen-27"],
    services: [
      "Digital X-Ray",
      "Diagnostic MRI",
      "CT Scans",
      "Ultrasound & Doppler",
      "Mammography",
    ],
    location: "Main Hospital",
    locationBadge: "Primary",
    locationAddress: "123 Health St, Cairo, Egypt",
    createdAt: "Oct 29, 2024",
    updatedAt: "Oct 02, 2026, 11:30 AM",
    stats: {
      assignedDoctors: 2,
      totalAppointments: 120,
      completedAppointments: 112,
      cancelledAppointments: 6,
    },
    recentActivity: [
      {
        id: "act-rad-1",
        action: "Equipment check logged",
        timestamp: "Oct 02, 2026, 11:30 AM",
        actor: "Medora Administrator",
        type: "updated",
      },
    ],
  },
  {
    id: "oncology",
    name: "Oncology",
    slug: "oncology",
    description: "Cancer diagnosis, treatment and supportive care.",
    icon: "ribbon",
    status: "inactive",
    displayOrder: 12,
    assignedDoctorIds: ["doc-gen-28"],
    services: [
      "Medical Oncology Consultation",
      "Chemotherapy Infusion",
      "Palliative Care Support",
      "Cancer Genetic Risk Counseling",
    ],
    location: "Main Hospital",
    locationBadge: "Primary",
    locationAddress: "123 Health St, Cairo, Egypt",
    createdAt: "Nov 01, 2024",
    updatedAt: "Oct 01, 2026, 09:00 AM",
    stats: {
      assignedDoctors: 1,
      totalAppointments: 54,
      completedAppointments: 49,
      cancelledAppointments: 3,
    },
    recentActivity: [
      {
        id: "act-onc-1",
        action: "Status changed to Inactive",
        timestamp: "Oct 01, 2026, 09:00 AM",
        actor: "Medora Administrator",
        type: "status_changed",
      },
    ],
  },
];

/**
 * Calculates global summary metrics across all departments.
 * Deduplicates assigned doctors so doctors in multiple departments are not double-counted.
 */
export function calculateDepartmentsGlobalStats(departments: Department[]) {
  const allDoctorIds = new Set<string>();
  let active = 0;
  let inactive = 0;
  let totalAppointments = 0;

  for (const dept of departments) {
    if (dept.status === "active") active++;
    else inactive++;

    totalAppointments += dept.stats.totalAppointments;

    for (const dId of dept.assignedDoctorIds) {
      allDoctorIds.add(dId);
    }
  }

  return {
    totalDepartments: departments.length,
    assignedDoctors: allDoctorIds.size,
    activeDepartments: active,
    inactiveDepartments: inactive,
    totalAppointments,
  };
}

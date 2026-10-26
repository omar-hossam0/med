/**
 * Canonical Patient-facing doctor roster and department data.
 *
 * Frontend-only phase: every record here is typed demo data used by the
 * My Doctors directory, the public doctor profile and the Appointments
 * booking flow. Nothing is fetched from a backend, and no clinical claim
 * (verification, review, credential) should be treated as real.
 *
 * Doctor IDs are stable and shared with the seeded appointments so a doctor
 * never has two contradictory copies.
 */

export type ConsultationType = "In-Person" | "Online";

export type DepartmentId =
  | "cardiology"
  | "dermatology"
  | "pediatrics"
  | "orthopedics"
  | "general-medicine"
  | "neurology";

export type DepartmentIcon =
  | "heart"
  | "sparkles"
  | "baby"
  | "bone"
  | "plus"
  | "brain";

export type DepartmentTone = "rose" | "amber" | "violet" | "blue" | "teal" | "indigo";

export type Department = {
  id: DepartmentId;
  name: string;
  icon: DepartmentIcon;
  tone: DepartmentTone;
  blurb: string;
};

export type TimeRange = { start: string; end: string };

/** Weekly in-person clinic hours keyed by weekday (0 = Sunday). */
export type WeeklyAvailability = Record<number, TimeRange[]>;

export type PatientReview = {
  id: string;
  author: string;
  initials: string;
  rating: number;
  date: string;
  comment: string;
};

export type Doctor = {
  id: string;
  name: string;
  /** Public professional title, e.g. "Consultant Cardiologist". */
  title: string;
  specialty: string;
  departmentId: DepartmentId;
  department: string;
  verified: boolean;
  rating: number;
  reviews: number;
  years: number;
  experience: string;
  languages: string[];
  bio: string;
  tags: string[];
  services: string[];
  clinic: string;
  address: string;
  city: string;
  supportsInPerson: boolean;
  supportsOnline: boolean;
  /** Approved portrait asset; null falls back to the initials avatar. */
  photoUrl: string | null;
  /** Highlighted in the reference's first results row. */
  featured: boolean;
  weekly: WeeklyAvailability;
  patientReviews: PatientReview[];
};

export const CLINIC = {
  name: "Medora Medical Center",
  address: "123 Health Street, Cairo, Egypt",
  hours: "Mon – Sat, 8:00 AM – 5:00 PM",
} as const;

export const DEPARTMENTS: Department[] = [
  {
    id: "cardiology",
    name: "Cardiology",
    icon: "heart",
    tone: "rose",
    blurb: "Heart and vascular care",
  },
  {
    id: "dermatology",
    name: "Dermatology",
    icon: "sparkles",
    tone: "amber",
    blurb: "Skin, hair and nail care",
  },
  {
    id: "pediatrics",
    name: "Pediatrics",
    icon: "baby",
    tone: "violet",
    blurb: "Care for infants and children",
  },
  {
    id: "orthopedics",
    name: "Orthopedics",
    icon: "bone",
    tone: "blue",
    blurb: "Bones, joints and mobility",
  },
  {
    id: "general-medicine",
    name: "General Medicine",
    icon: "plus",
    tone: "teal",
    blurb: "Everyday primary care",
  },
  {
    id: "neurology",
    name: "Neurology",
    icon: "brain",
    tone: "indigo",
    blurb: "Brain and nervous system",
  },
];

/** Departments shown above the reference's "View All" control. */
export const FEATURED_DEPARTMENT_IDS: DepartmentId[] = [
  "cardiology",
  "dermatology",
  "pediatrics",
  "orthopedics",
  "general-medicine",
];

const range = (start: string, end: string): TimeRange => ({ start, end });

function week(days: Partial<Record<number, TimeRange[]>>): WeeklyAvailability {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], ...days };
}

const MORNING = () => [range("09:00", "12:00")];
const AFTERNOON = () => [range("14:00", "17:00")];

const STANDARD_WEEK = week({
  1: [...MORNING(), ...AFTERNOON()],
  2: [...MORNING(), ...AFTERNOON()],
  3: [...MORNING(), ...AFTERNOON()],
  4: [...MORNING(), ...AFTERNOON()],
  5: [...MORNING(), ...AFTERNOON()],
  6: MORNING(),
});

function makeDoctor(
  input: Omit<Doctor, "experience"> & { experience?: string },
): Doctor {
  return {
    ...input,
    experience: input.experience ?? `${input.years} years`,
  };
}

export const doctors: Doctor[] = [
  makeDoctor({
    id: "d1",
    name: "Dr. Sarah Ahmed",
    title: "Consultant Cardiologist",
    specialty: "Cardiology",
    departmentId: "cardiology",
    department: "Cardiology",
    verified: true,
    rating: 4.9,
    reviews: 124,
    years: 12,
    languages: ["English", "Arabic"],
    bio: "Dr. Sarah Ahmed is an experienced cardiologist focused on preventive cardiology, early detection and long-term heart health. She builds clear, evidence-based care plans with every patient and works closely with primary care colleagues on blood pressure, cholesterol and cardiac risk management.",
    tags: ["Heart Health", "Preventive Care", "Cardiac Imaging", "Hypertension"],
    services: [
      "General Cardiology",
      "Preventive Cardiology",
      "Heart Failure Management",
      "Hypertension",
      "Echocardiography",
      "Cardiac Risk Assessment",
    ],
    clinic: CLINIC.name,
    address: CLINIC.address,
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: "/images/members/sarah_mohamed.png",
    featured: true,
    weekly: STANDARD_WEEK,
    patientReviews: [
      {
        id: "r-d1-1",
        author: "Mona Ali",
        initials: "MA",
        rating: 5,
        date: "2 weeks ago",
        comment:
          "Dr. Sarah is an excellent doctor. She takes time to explain everything and makes you feel comfortable. Highly recommended!",
      },
      {
        id: "r-d1-2",
        author: "Hassan M.",
        initials: "HM",
        rating: 5,
        date: "1 month ago",
        comment:
          "Clear explanations and a thorough follow-up plan for my blood pressure. The visit never felt rushed.",
      },
    ],
  }),
  makeDoctor({
    id: "d2",
    name: "Dr. Youssef Ali",
    title: "Consultant Cardiologist",
    specialty: "Cardiology",
    departmentId: "cardiology",
    department: "Cardiology",
    verified: true,
    rating: 4.8,
    reviews: 96,
    years: 10,
    languages: ["English", "Arabic"],
    bio: "Dr. Youssef Ali is a consultant cardiologist with a special interest in coronary artery disease and cardiac rehabilitation. He supports patients through diagnosis, medication optimisation and structured recovery after cardiac events.",
    tags: ["Coronary Care", "Hypertension", "Cholesterol Care", "Cardiac Rehab"],
    services: [
      "Interventional Cardiology",
      "Coronary Artery Disease",
      "Hypertension",
      "Cholesterol Management",
      "ECG Interpretation",
      "Cardiac Rehabilitation",
    ],
    clinic: "Nile Specialized Hospital",
    address: "45 Nile Corniche, Cairo, Egypt",
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: "/images/members/youssef_ali.png",
    featured: true,
    weekly: week({
      1: [...MORNING(), ...AFTERNOON()],
      2: [...MORNING(), ...AFTERNOON()],
      3: [],
      4: [...MORNING(), ...AFTERNOON()],
      5: [...MORNING(), ...AFTERNOON()],
      6: MORNING(),
    }),
    patientReviews: [
      {
        id: "r-d2-1",
        author: "Nadia S.",
        initials: "NS",
        rating: 5,
        date: "3 weeks ago",
        comment:
          "Explained my ECG results in a way I could understand and adjusted my medication carefully.",
      },
    ],
  }),
  makeDoctor({
    id: "d3",
    name: "Dr. Mona Khaled",
    title: "Consultant Cardiologist",
    specialty: "Cardiology",
    departmentId: "cardiology",
    department: "Cardiology",
    verified: true,
    rating: 4.7,
    reviews: 88,
    years: 8,
    languages: ["English", "Arabic", "French"],
    bio: "Dr. Mona Khaled focuses on women's heart health, arrhythmia assessment and preventive cardiology. She uses a calm, practical approach to help patients understand their symptoms and reduce long-term cardiac risk.",
    tags: ["Women's Heart Health", "Arrhythmia", "Preventive Care", "Echocardiography"],
    services: [
      "Women's Heart Health",
      "Arrhythmia Assessment",
      "Preventive Cardiology",
      "Echocardiography",
      "Holter Monitoring",
      "Cardiac Nutrition",
    ],
    clinic: "Cairo Heart Center",
    address: "12 El Nasr Road, Nasr City, Cairo, Egypt",
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: "/images/members/fatma_adel.png",
    featured: true,
    weekly: week({
      1: [...MORNING(), ...AFTERNOON()],
      2: [...MORNING(), ...AFTERNOON()],
      3: [...MORNING(), ...AFTERNOON()],
      4: [...MORNING(), ...AFTERNOON()],
      5: [...MORNING(), ...AFTERNOON()],
      6: [range("10:00", "13:00")],
    }),
    patientReviews: [
      {
        id: "r-d3-1",
        author: "Salma R.",
        initials: "SR",
        rating: 5,
        date: "1 month ago",
        comment:
          "She listened carefully to my symptoms and ordered the right tests without over-medicating.",
      },
    ],
  }),
  makeDoctor({
    id: "d4",
    name: "Dr. Ahmed Hassan",
    title: "Consultant Orthopedic Surgeon",
    specialty: "Orthopedics",
    departmentId: "orthopedics",
    department: "Orthopedics",
    verified: true,
    rating: 4.7,
    reviews: 68,
    years: 14,
    languages: ["English", "Arabic"],
    bio: "Dr. Ahmed Hassan treats joint, spine and sports-related injuries. He prefers conservative care and rehabilitation first, and only considers surgery when it is genuinely necessary.",
    tags: ["Joint Pain", "Sports Injuries", "Spine Care", "Rehabilitation"],
    services: [
      "Joint Replacement",
      "Sports Injuries",
      "Spine Care",
      "Fracture Care",
      "Arthroscopy",
      "Rehabilitation Planning",
    ],
    clinic: CLINIC.name,
    address: CLINIC.address,
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: false,
    photoUrl: null,
    featured: false,
    weekly: week({
      1: [...MORNING(), ...AFTERNOON()],
      2: [...MORNING(), ...AFTERNOON()],
      3: [...MORNING(), ...AFTERNOON()],
      4: [...MORNING(), ...AFTERNOON()],
      5: MORNING(),
    }),
    patientReviews: [],
  }),
  makeDoctor({
    id: "d5",
    name: "Dr. Layla Ibrahim",
    title: "Consultant Neurologist",
    specialty: "Neurology",
    departmentId: "neurology",
    department: "Neurology",
    verified: true,
    rating: 4.9,
    reviews: 152,
    years: 13,
    languages: ["English", "Arabic"],
    bio: "Dr. Layla Ibrahim is a neurologist with a special interest in headache disorders, stroke prevention and long-term neurological rehabilitation. She takes a structured history-first approach to complex symptoms.",
    tags: ["Headache", "Stroke Prevention", "Epilepsy", "Nerve Health"],
    services: [
      "Headache & Migraine",
      "Stroke Prevention",
      "Epilepsy",
      "Nerve Health",
      "Memory Assessment",
      "Neurological Rehabilitation",
    ],
    clinic: CLINIC.name,
    address: CLINIC.address,
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: null,
    featured: false,
    weekly: STANDARD_WEEK,
    patientReviews: [
      {
        id: "r-d5-1",
        author: "Mostafa K.",
        initials: "MK",
        rating: 5,
        date: "2 months ago",
        comment:
          "After years of frequent migraines I finally have a plan that works. Very thorough and patient.",
      },
    ],
  }),
  makeDoctor({
    id: "d6",
    name: "Dr. Nourhan Ibrahim",
    title: "Consultant Pediatrician",
    specialty: "Pediatrics",
    departmentId: "pediatrics",
    department: "Pediatrics",
    verified: true,
    rating: 4.8,
    reviews: 87,
    years: 8,
    languages: ["English", "Arabic"],
    bio: "Dr. Nourhan Ibrahim cares for infants, children and adolescents, supporting healthy growth, vaccinations and family-centred care. She keeps parents informed at every step of the visit.",
    tags: ["Child Wellness", "Vaccinations", "Growth Monitoring", "Newborn Care"],
    services: [
      "Child Wellness",
      "Vaccinations",
      "Growth Monitoring",
      "Newborn Care",
      "Childhood Asthma",
      "Nutrition Guidance",
    ],
    clinic: CLINIC.name,
    address: CLINIC.address,
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: null,
    featured: false,
    weekly: STANDARD_WEEK,
    patientReviews: [
      {
        id: "r-d6-1",
        author: "Dina A.",
        initials: "DA",
        rating: 5,
        date: "3 weeks ago",
        comment:
          "Great with my toddler — calm, friendly and very clear about what to watch for at home.",
      },
    ],
  }),
  makeDoctor({
    id: "d7",
    name: "Dr. Karim Mostafa",
    title: "Consultant Cardiologist",
    specialty: "Cardiology",
    departmentId: "cardiology",
    department: "Cardiology",
    verified: true,
    rating: 4.6,
    reviews: 52,
    years: 15,
    languages: ["English", "Arabic"],
    bio: "Dr. Karim Mostafa has over fifteen years of experience in heart rhythm disorders and cardiac device follow-up. He works with patients to balance medication, monitoring and lifestyle changes.",
    tags: ["Heart Rhythm", "Pacemaker Care", "Cardiac Imaging", "Stress Testing"],
    services: [
      "Heart Rhythm Disorders",
      "Pacemaker Follow-up",
      "Hypertension",
      "Cardiac Imaging",
      "Stress Testing",
      "Preventive Cardiology",
    ],
    clinic: CLINIC.name,
    address: CLINIC.address,
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: "/images/members/kareem_mostafa.png",
    featured: false,
    weekly: week({
      1: [...MORNING(), ...AFTERNOON()],
      2: [range("12:00", "17:00")],
      3: [...MORNING(), ...AFTERNOON()],
      4: [...MORNING(), ...AFTERNOON()],
      5: [...MORNING(), ...AFTERNOON()],
      6: MORNING(),
    }),
    patientReviews: [
      {
        id: "r-d7-1",
        author: "Adel F.",
        initials: "AF",
        rating: 5,
        date: "1 month ago",
        comment:
          "Very experienced and reassuring. He reviewed my device readings and explained the next steps.",
      },
    ],
  }),
  makeDoctor({
    id: "d8",
    name: "Dr. Lina Hassan",
    title: "Consultant Cardiologist",
    specialty: "Cardiology",
    departmentId: "cardiology",
    department: "Cardiology",
    verified: false,
    rating: 4.8,
    reviews: 67,
    years: 9,
    languages: ["English", "Arabic"],
    bio: "Dr. Lina Hassan supports patients with preventive cardiology, women's heart health and cholesterol management. She emphasises sustainable lifestyle change alongside medical treatment.",
    tags: ["Preventive Care", "Women's Heart Health", "Cholesterol", "Lifestyle Medicine"],
    services: [
      "Preventive Cardiology",
      "Women's Heart Health",
      "Echocardiography",
      "Hypertension",
      "Cholesterol Management",
      "Lifestyle Medicine",
    ],
    clinic: "Nile Specialized Hospital",
    address: "45 Nile Corniche, Cairo, Egypt",
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: "/images/members/nourhan_ibrahim.png",
    featured: false,
    weekly: week({
      2: [...MORNING(), ...AFTERNOON()],
      3: [...MORNING(), ...AFTERNOON()],
      4: [...MORNING(), ...AFTERNOON()],
      5: [...MORNING(), ...AFTERNOON()],
      6: MORNING(),
    }),
    patientReviews: [
      {
        id: "r-d8-1",
        author: "Yara H.",
        initials: "YH",
        rating: 5,
        date: "2 weeks ago",
        comment:
          "Felt heard from the first minute. The lifestyle plan was realistic and easy to follow.",
      },
    ],
  }),
  makeDoctor({
    id: "d9",
    name: "Dr. Ahmed Rashed",
    title: "Consultant Cardiologist",
    specialty: "Cardiology",
    departmentId: "cardiology",
    department: "Cardiology",
    verified: true,
    rating: 4.5,
    reviews: 43,
    years: 11,
    languages: ["English", "Arabic"],
    bio: "Dr. Ahmed Rashed works in coronary care and cardiac rehabilitation, supporting patients after angioplasty and other cardiac procedures with close follow-up and clear recovery goals.",
    tags: ["Coronary Care", "Cardiac Rehab", "Hypertension", "ECG"],
    services: [
      "Interventional Cardiology",
      "Angioplasty Follow-up",
      "Coronary Care",
      "ECG Interpretation",
      "Hypertension",
      "Cardiac Rehabilitation",
    ],
    clinic: "Cairo Heart Center",
    address: "12 El Nasr Road, Nasr City, Cairo, Egypt",
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: "/images/members/ahmed_hassan.png",
    featured: false,
    weekly: week({
      1: [...MORNING(), ...AFTERNOON()],
      2: [...MORNING(), ...AFTERNOON()],
      3: [...MORNING(), ...AFTERNOON()],
      4: [...MORNING(), ...AFTERNOON()],
      5: [range("09:00", "12:00")],
      6: MORNING(),
    }),
    patientReviews: [],
  }),
  makeDoctor({
    id: "d10",
    name: "Dr. Farida El-Sayed",
    title: "Consultant Dermatologist",
    specialty: "Dermatology",
    departmentId: "dermatology",
    department: "Dermatology",
    verified: true,
    rating: 4.9,
    reviews: 131,
    years: 12,
    languages: ["English", "Arabic"],
    bio: "Dr. Farida El-Sayed treats medical and cosmetic skin conditions with a measured, evidence-based approach. She is particularly experienced in acne, eczema and skin cancer screening.",
    tags: ["Skin Health", "Acne Care", "Eczema", "Skin Screening"],
    services: [
      "Medical Dermatology",
      "Acne & Scar Care",
      "Eczema",
      "Skin Cancer Screening",
      "Cosmetic Dermatology",
      "Allergy Testing",
    ],
    clinic: CLINIC.name,
    address: CLINIC.address,
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: null,
    featured: false,
    weekly: STANDARD_WEEK,
    patientReviews: [
      {
        id: "r-d10-1",
        author: "Rana T.",
        initials: "RT",
        rating: 5,
        date: "1 week ago",
        comment:
          "A careful assessment and a simple routine that actually helped. No unnecessary products.",
      },
    ],
  }),
  makeDoctor({
    id: "d11",
    name: "Dr. Hassan Abdelrahim",
    title: "Dermatologist",
    specialty: "Dermatology",
    departmentId: "dermatology",
    department: "Dermatology",
    verified: false,
    rating: 4.6,
    reviews: 54,
    years: 7,
    languages: ["English", "Arabic"],
    bio: "Dr. Hassan Abdelrahim provides dermatology care for acne, hair loss and common skin infections, with practical treatment plans and clear aftercare instructions.",
    tags: ["Acne", "Hair Loss", "Psoriasis", "Laser Therapy"],
    services: [
      "Acne Care",
      "Hair Loss",
      "Psoriasis",
      "Laser Therapy",
      "Mole Checks",
      "Skin Infections",
    ],
    clinic: "Giza Skin & Laser Clinic",
    address: "18 Giza Square, Giza, Egypt",
    city: "Giza",
    supportsInPerson: true,
    supportsOnline: false,
    photoUrl: null,
    featured: false,
    weekly: week({
      2: [range("10:00", "16:00")],
      3: [range("10:00", "16:00")],
      4: [range("10:00", "16:00")],
      5: [range("10:00", "14:00")],
      6: [range("10:00", "14:00")],
    }),
    patientReviews: [],
  }),
  makeDoctor({
    id: "d12",
    name: "Dr. Salma Fahmy",
    title: "Consultant Pediatrician",
    specialty: "Pediatrics",
    departmentId: "pediatrics",
    department: "Pediatrics",
    verified: true,
    rating: 4.9,
    reviews: 143,
    years: 11,
    languages: ["English", "Arabic"],
    bio: "Dr. Salma Fahmy has over a decade of experience in newborn and childhood care. She supports families with growth monitoring, vaccinations and childhood asthma management.",
    tags: ["Newborn Care", "Vaccinations", "Childhood Asthma", "Growth"],
    services: [
      "Newborn Care",
      "Growth Monitoring",
      "Vaccinations",
      "Childhood Asthma",
      "Allergy Care",
      "Nutrition Guidance",
    ],
    clinic: CLINIC.name,
    address: CLINIC.address,
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: null,
    featured: false,
    weekly: STANDARD_WEEK,
    patientReviews: [
      {
        id: "r-d12-1",
        author: "Mariam E.",
        initials: "ME",
        rating: 5,
        date: "3 weeks ago",
        comment:
          "Very patient with a nervous child and gave us a clear asthma action plan.",
      },
    ],
  }),
  makeDoctor({
    id: "d13",
    name: "Dr. Omar Sultan",
    title: "Orthopedic Surgeon",
    specialty: "Orthopedics",
    departmentId: "orthopedics",
    department: "Orthopedics",
    verified: false,
    rating: 4.6,
    reviews: 71,
    years: 9,
    languages: ["English", "Arabic"],
    bio: "Dr. Omar Sultan treats knee, shoulder and sports injuries, with a focus on recovery through targeted rehabilitation before considering surgical options.",
    tags: ["Sports Injuries", "Knee & Shoulder", "Fracture Care", "Back Pain"],
    services: [
      "Sports Injuries",
      "Knee & Shoulder Care",
      "Fracture Care",
      "Physiotherapy Referral",
      "Back Pain",
      "Arthroscopy",
    ],
    clinic: "Giza Orthopedic Center",
    address: "22 Giza Square, Giza, Egypt",
    city: "Giza",
    supportsInPerson: true,
    supportsOnline: false,
    photoUrl: null,
    featured: false,
    weekly: week({
      1: [range("08:00", "14:00")],
      2: [range("08:00", "14:00")],
      3: [range("08:00", "14:00")],
      4: [range("08:00", "14:00")],
      5: [range("08:00", "12:00")],
    }),
    patientReviews: [],
  }),
  makeDoctor({
    id: "d14",
    name: "Dr. Hana Mostafa",
    title: "Consultant in General Medicine",
    specialty: "General Medicine",
    departmentId: "general-medicine",
    department: "General Medicine",
    verified: true,
    rating: 4.7,
    reviews: 102,
    years: 10,
    languages: ["English", "Arabic"],
    bio: "Dr. Hana Mostafa provides comprehensive primary care with a focus on chronic disease management, preventive screening and coordinating care across specialties.",
    tags: ["Primary Care", "Chronic Care", "Health Screening", "Diabetes"],
    services: [
      "Primary Care",
      "Chronic Disease Management",
      "Health Screening",
      "Diabetes Care",
      "Medication Review",
      "Travel Health",
    ],
    clinic: CLINIC.name,
    address: CLINIC.address,
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: null,
    featured: false,
    weekly: STANDARD_WEEK,
    patientReviews: [
      {
        id: "r-d14-1",
        author: "Khaled B.",
        initials: "KB",
        rating: 5,
        date: "1 month ago",
        comment:
          "Reviewed all my regular medication and removed one that was no longer needed. Very thorough.",
      },
    ],
  }),
  makeDoctor({
    id: "d15",
    name: "Dr. Tarek Nabil",
    title: "General Practitioner",
    specialty: "General Medicine",
    departmentId: "general-medicine",
    department: "General Medicine",
    verified: false,
    rating: 4.5,
    reviews: 63,
    years: 6,
    languages: ["English", "Arabic"],
    bio: "Dr. Tarek Nabil handles everyday primary care, minor illness and routine health checks, with straightforward advice and follow-up when needed.",
    tags: ["Primary Care", "Minor Illness", "Screening", "Vaccinations"],
    services: [
      "Primary Care",
      "Minor Illness",
      "Health Screening",
      "Vaccinations",
      "Blood Pressure Review",
      "Lifestyle Advice",
    ],
    clinic: "Nile Specialized Hospital",
    address: "45 Nile Corniche, Cairo, Egypt",
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: null,
    featured: false,
    weekly: week({
      1: [...MORNING(), ...AFTERNOON()],
      2: [...MORNING(), ...AFTERNOON()],
      3: [...MORNING(), ...AFTERNOON()],
      4: [...MORNING(), ...AFTERNOON()],
      5: [...MORNING(), ...AFTERNOON()],
      6: [...MORNING(), range("14:00", "17:00")],
    }),
    patientReviews: [],
  }),
  makeDoctor({
    id: "d16",
    name: "Dr. Rania Adel",
    title: "Consultant Neurologist",
    specialty: "Neurology",
    departmentId: "neurology",
    department: "Neurology",
    verified: true,
    rating: 4.8,
    reviews: 76,
    years: 9,
    languages: ["English", "Arabic", "French"],
    bio: "Dr. Rania Adel assesses migraine, nerve pain and memory concerns, with an emphasis on clear diagnosis and realistic long-term management.",
    tags: ["Migraine", "Nerve Pain", "Memory", "Sleep"],
    services: [
      "Migraine",
      "Multiple Sclerosis",
      "Neuropathy",
      "Memory Assessment",
      "Sleep Disorders",
      "Epilepsy",
    ],
    clinic: "Cairo Neuro Center",
    address: "8 El Hegaz Street, Heliopolis, Cairo, Egypt",
    city: "Cairo",
    supportsInPerson: true,
    supportsOnline: true,
    photoUrl: null,
    featured: false,
    weekly: week({
      1: [...MORNING(), ...AFTERNOON()],
      2: [...MORNING(), ...AFTERNOON()],
      3: [...MORNING(), ...AFTERNOON()],
      4: [],
      5: [...MORNING(), ...AFTERNOON()],
      6: MORNING(),
    }),
    patientReviews: [],
  }),
];

export const specialties: string[] = doctors.reduce<string[]>((list, doctor) => {
  if (!list.includes(doctor.specialty)) list.push(doctor.specialty);
  return list;
}, []);

export function getDoctor(id: string | null | undefined): Doctor | undefined {
  if (!id) return undefined;
  return doctors.find((doctor) => doctor.id === id);
}

export function getDepartment(id: DepartmentId | string): Department | undefined {
  return DEPARTMENTS.find((department) => department.id === id);
}

export function getDoctorsByDepartment(departmentId: DepartmentId): Doctor[] {
  return doctors.filter((doctor) => doctor.departmentId === departmentId);
}

export function departmentCount(departmentId: DepartmentId): number {
  return getDoctorsByDepartment(departmentId).length;
}

export const LOCATIONS: string[] = doctors.reduce<string[]>((list, doctor) => {
  if (!list.includes(doctor.city)) list.push(doctor.city);
  return list;
}, []);

/* ------------------------------------------------------------------ */
/* Availability helpers                                                */
/* ------------------------------------------------------------------ */

const ONLINE_EVENING: TimeRange = { start: "18:00", end: "20:00" };
const SLOT_MINUTES = 30;

/** Ranges for a doctor on a given weekday, extended for online evenings. */
export function rangesFor(
  doctor: Doctor,
  weekday: number,
  consultationType: ConsultationType,
): TimeRange[] {
  const base = doctor.weekly[weekday] ?? [];
  if (!base.length) return [];

  if (
    consultationType === "Online" &&
    doctor.supportsOnline &&
    weekday >= 1 &&
    weekday <= 5
  ) {
    return [...base, ONLINE_EVENING];
  }
  return base;
}

export function doctorWorksOn(
  doctor: Doctor,
  date: Date,
  consultationType: ConsultationType,
): boolean {
  if (consultationType === "Online" && !doctor.supportsOnline) return false;
  if (consultationType === "In-Person" && !doctor.supportsInPerson) return false;
  return rangesFor(doctor, date.getDay(), consultationType).length > 0;
}

/** Candidate 30-minute slot times for a date, before demo conflicts. */
export function slotTimesFor(
  doctor: Doctor,
  dateKey: string,
  consultationType: ConsultationType,
): string[] {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const ranges = rangesFor(doctor, date.getDay(), consultationType);
  const times: string[] = [];

  for (const item of ranges) {
    const [startHour, startMinute] = item.start.split(":").map(Number);
    const [endHour, endMinute] = item.end.split(":").map(Number);
    let cursor = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    while (cursor + SLOT_MINUTES <= end) {
      const hours = String(Math.floor(cursor / 60)).padStart(2, "0");
      const minutes = String(cursor % 60).padStart(2, "0");
      const value = `${hours}:${minutes}`;
      if (!times.includes(value)) times.push(value);
      cursor += SLOT_MINUTES;
    }
  }

  return times;
}

export function formatSlotTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export type DayPreview = {
  weekday: number;
  day: string;
  ranges: TimeRange[];
  status: "Available" | "Limited" | "Closed";
};

function rangesToMinutes(ranges: TimeRange[]): number {
  return ranges.reduce((total, item) => {
    const [startHour, startMinute] = item.start.split(":").map(Number);
    const [endHour, endMinute] = item.end.split(":").map(Number);
    return total + (endHour * 60 + endMinute - (startHour * 60 + startMinute));
  }, 0);
}

/** Informational weekly preview shown on the doctor profile. */
export function getWeeklyPreview(doctor: Doctor): DayPreview[] {
  return WEEKDAY_ORDER.map((weekday) => {
    const ranges = doctor.weekly[weekday] ?? [];
    const minutes = rangesToMinutes(ranges);
    const status: DayPreview["status"] = !ranges.length
      ? "Closed"
      : minutes < 180
        ? "Limited"
        : "Available";
    return { weekday, day: WEEKDAY_LABELS[weekday], ranges, status };
  });
}

/** Whether a doctor has any remaining working day this calendar week. */
export function worksThisWeek(doctor: Doctor, today: Date): boolean {
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    if (rangesFor(doctor, date.getDay(), "In-Person").length > 0) return true;
  }
  return false;
}

export function worksOnDay(doctor: Doctor, today: Date): boolean {
  return rangesFor(doctor, today.getDay(), "In-Person").length > 0;
}

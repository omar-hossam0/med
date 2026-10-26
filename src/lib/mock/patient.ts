/**
 * Typed demo data for the Patient Dashboard.
 * Frontend-only phase — no backend. Replace these with real API responses later.
 *
 * Every dashboard count is derived from these records so the summary cards,
 * appointment list, doctors, lab results, and message badge stay consistent.
 */

export type StatTone = "teal" | "blue" | "amber" | "violet";
export type VitalTone = "rose" | "blue" | "teal" | "violet";
export type LabTone = "rose" | "blue" | "teal" | "violet";
export type AppointmentStatus = "Upcoming" | "Completed" | "Cancelled";
export type LabStatus = "Normal" | "Slightly High";

export type StatIcon = "calendar" | "file" | "pill" | "flask";
export type QuickIcon = "calendar-plus" | "pill" | "flask" | "folder";
export type RecordIcon = "stethoscope" | "flask" | "xray" | "derm";
export type LabIcon = "flask" | "droplet" | "liver" | "heart";

export const patient = {
  id: "demo-patient",
  firstName: "Ahmed",
  lastName: "Mohamed",
  fullName: "Ahmed Mohamed",
  role: "Patient",
  avatar: null as string | null,
};

export const today = "Mon, Oct 20, 2026";

export const nextAppointment = {
  doctor: "Dr. Sarah Ahmed",
  specialty: "Cardiology",
  date: "Mon, Oct 20, 2026",
  time: "10:00 AM",
  location: "Medora Medical Center",
  address: "123 Health Street, Cairo, Egypt",
};

export const recentAppointments: {
  id: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  status: AppointmentStatus;
}[] = [
  {
    id: "a1",
    doctor: "Dr. Sarah Ahmed",
    specialty: "Cardiology",
    date: "Mon, Oct 20, 2026",
    time: "10:00 AM",
    status: "Upcoming",
  },
  {
    id: "a2",
    doctor: "Dr. Youssef Ali",
    specialty: "General Medicine",
    date: "Thu, Oct 23, 2026",
    time: "11:30 AM",
    status: "Upcoming",
  },
  {
    id: "a3",
    doctor: "Dr. Mona Khaled",
    specialty: "Dermatology",
    date: "Mon, Nov 2, 2026",
    time: "02:00 PM",
    status: "Completed",
  },
  {
    id: "a4",
    doctor: "Dr. Karim Mostafa",
    specialty: "Orthopedics",
    date: "Thu, Nov 14, 2026",
    time: "04:00 PM",
    status: "Cancelled",
  },
];

export const activePrescriptions = [
  { id: "p1", medication: "Atorvastatin", dosage: "20 mg", status: "Active" },
  { id: "p2", medication: "Metformin", dosage: "500 mg", status: "Active" },
  { id: "p3", medication: "Vitamin D3", dosage: "1000 IU", status: "Active" },
] as const;

export const vitals: {
  key: string;
  label: string;
  value: string;
  unit: string;
  icon: "heart" | "weight" | "droplet" | "activity";
  tone: VitalTone;
  trend: number[];
}[] = [
  {
    key: "bp",
    label: "Blood Pressure",
    value: "120/80",
    unit: "mmHg",
    icon: "heart",
    tone: "rose",
    trend: [42, 38, 44, 36, 40, 34],
  },
  {
    key: "weight",
    label: "Weight",
    value: "72",
    unit: "kg",
    icon: "weight",
    tone: "blue",
    trend: [30, 34, 31, 36, 33, 38],
  },
  {
    key: "oxygen",
    label: "Oxygen Level",
    value: "98",
    unit: "%",
    icon: "droplet",
    tone: "teal",
    trend: [36, 40, 37, 42, 39, 44],
  },
  {
    key: "hr",
    label: "Heart Rate",
    value: "78",
    unit: "bpm",
    icon: "activity",
    tone: "violet",
    trend: [28, 40, 30, 44, 32, 38],
  },
];

export const quickActions: { key: string; label: string; icon: QuickIcon }[] = [
  { key: "book", label: "Book Appointment", icon: "calendar-plus" },
  { key: "prescriptions", label: "View Prescriptions", icon: "pill" },
  { key: "labs", label: "View Lab Results", icon: "flask" },
  { key: "records", label: "Access Medical Records", icon: "folder" },
];

export const medicalRecords: {
  id: string;
  title: string;
  doctor: string;
  date: string;
  icon: RecordIcon;
}[] = [
  {
    id: "r1",
    title: "General Consultation",
    doctor: "Dr. Youssef Ali",
    date: "Oct 12, 2026",
    icon: "stethoscope",
  },
  {
    id: "r2",
    title: "Lab Test – Complete Blood Count",
    doctor: "Medora Laboratory",
    date: "Oct 5, 2026",
    icon: "flask",
  },
  {
    id: "r3",
    title: "Chest X-Ray",
    doctor: "Medora Imaging",
    date: "Sep 30, 2026",
    icon: "xray",
  },
  {
    id: "r4",
    title: "Dermatology Consultation",
    doctor: "Dr. Mona Khaled",
    date: "Sep 10, 2026",
    icon: "derm",
  },
  {
    id: "r5",
    title: "Annual Wellness Visit",
    doctor: "Dr. Sarah Ahmed",
    date: "Sep 2, 2026",
    icon: "stethoscope",
  },
];

export const labResults: {
  id: string;
  name: string;
  date: string;
  status: LabStatus;
  icon: LabIcon;
  tone: LabTone;
}[] = [
  {
    id: "lab1",
    name: "Complete Blood Count (CBC)",
    date: "Oct 18, 2026",
    status: "Normal",
    icon: "flask",
    tone: "violet",
  },
  {
    id: "lab2",
    name: "Lipid Panel",
    date: "Oct 10, 2026",
    status: "Slightly High",
    icon: "droplet",
    tone: "blue",
  },
  {
    id: "lab3",
    name: "Liver Function Test (LFT)",
    date: "Sep 28, 2026",
    status: "Normal",
    icon: "liver",
    tone: "teal",
  },
  {
    id: "lab4",
    name: "Thyroid Function (TSH)",
    date: "Sep 15, 2026",
    status: "Normal",
    icon: "heart",
    tone: "rose",
  },
];

export const careTeam: { id: string; name: string; specialty: string }[] = [
  { id: "d1", name: "Dr. Sarah Ahmed", specialty: "Cardiology" },
  { id: "d2", name: "Dr. Youssef Ali", specialty: "General Medicine" },
  { id: "d3", name: "Dr. Mona Khaled", specialty: "Dermatology" },
  { id: "d4", name: "Dr. Karim Mostafa", specialty: "Orthopedics" },
];

export const patientMessages: {
  id: string;
  sender: string;
  preview: string;
  time: string;
  unread: boolean;
  kind: "doctor" | "care" | "reminder";
}[] = [
  {
    id: "m1",
    sender: "Dr. Sarah Ahmed",
    preview: "Your lab results are now available.",
    time: "Today, 09:18 AM",
    unread: true,
    kind: "doctor",
  },
  {
    id: "m2",
    sender: "Medora Healthcare",
    preview: "Your appointment is confirmed for Oct 20.",
    time: "Yesterday, 03:24 PM",
    unread: true,
    kind: "care",
  },
  {
    id: "m3",
    sender: "Dr. Youssef Ali",
    preview: "Please remember to take your medication.",
    time: "Oct 17, 2026",
    unread: false,
    kind: "doctor",
  },
  {
    id: "m4",
    sender: "Appointment Reminder",
    preview: "You have an upcoming appointment on Oct 20.",
    time: "Oct 19, 2026",
    unread: false,
    kind: "reminder",
  },
];

export const unreadMessageCount = patientMessages.filter((message) => message.unread).length;

const upcomingAppointments = recentAppointments.filter(
  (appointment) => appointment.status === "Upcoming",
).length;

export const dashboardStats: {
  key: string;
  label: string;
  value: number;
  icon: StatIcon;
  tone: StatTone;
}[] = [
  {
    key: "appointments",
    label: "Upcoming Appointments",
    value: upcomingAppointments,
    icon: "calendar",
    tone: "teal",
  },
  {
    key: "records",
    label: "Medical Records",
    value: medicalRecords.length,
    icon: "file",
    tone: "blue",
  },
  {
    key: "prescriptions",
    label: "Active Prescriptions",
    value: activePrescriptions.length,
    icon: "pill",
    tone: "amber",
  },
  {
    key: "labs",
    label: "Lab Results",
    value: labResults.length,
    icon: "flask",
    tone: "violet",
  },
];

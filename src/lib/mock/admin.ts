/**
 * Typed demo data for the Admin Overview page.
 * Frontend-only phase — no backend. All values are illustrative mock data.
 */

export type KpiTone = "teal" | "blue" | "violet" | "amber" | "rose";
export type KpiIcon = "users" | "stethoscope" | "calendar" | "file" | "alert";
export type Direction = "up" | "down";

export const adminUser = {
  name: "Admin",
  role: "Administrator",
  fullName: "Admin User",
};

export const today = "Monday, October 20, 2026";

export const quote = "Data-driven decisions for better care. A healthier tomorrow.";

export const kpis: {
  key: string;
  label: string;
  value: string;
  icon: KpiIcon;
  tone: KpiTone;
  change?: { value: string; direction: Direction; label: string };
  note?: string;
}[] = [
  {
    key: "patients",
    label: "Total Patients",
    value: "1,248",
    icon: "users",
    tone: "teal",
    change: { value: "12%", direction: "up", label: "vs last month" },
  },
  {
    key: "doctors",
    label: "Active Doctors",
    value: "18",
    icon: "stethoscope",
    tone: "blue",
    change: { value: "6%", direction: "up", label: "vs last month" },
  },
  {
    key: "appointments",
    label: "Today's Appointments",
    value: "42",
    icon: "calendar",
    tone: "violet",
    change: { value: "8%", direction: "down", label: "vs yesterday" },
  },
  {
    key: "ai",
    label: "AI Reports",
    value: "89",
    icon: "file",
    tone: "amber",
    change: { value: "15%", direction: "up", label: "vs last week" },
  },
  {
    key: "pending",
    label: "Pending Actions",
    value: "6",
    icon: "alert",
    tone: "rose",
    note: "Requires attention",
  },
];

/* ---------------- Appointments trend (7 days) ---------------- */
export const trendDays = ["Oct 14", "Oct 15", "Oct 16", "Oct 17", "Oct 18", "Oct 19", "Oct 20"];

export const trendSeries: { key: string; label: string; color: string; data: number[] }[] = [
  { key: "inperson", label: "In-person", color: "#0A9189", data: [45, 62, 52, 72, 58, 55, 48] },
  { key: "online", label: "Online", color: "#3B6EF6", data: [20, 28, 22, 38, 30, 26, 24] },
  { key: "cancelled", label: "Cancelled", color: "#8B5CF6", data: [5, 8, 3, 0, 4, 6, 5] },
];

/* ---------------- Department distribution ---------------- */
export const departments: { label: string; percent: number; color: string }[] = [
  { label: "Cardiology", percent: 28, color: "#0A9189" },
  { label: "Dermatology", percent: 18, color: "#3B6EF6" },
  { label: "Pediatrics", percent: 16, color: "#8B5CF6" },
  { label: "Orthopedics", percent: 14, color: "#22B8CF" },
  { label: "Gynecology", percent: 12, color: "#F59E0B" },
  { label: "ENT", percent: 8, color: "#EC4899" },
  { label: "Others", percent: 4, color: "#94A3B8" },
];
export const departmentTotal = 42;

/* ---------------- Notifications ---------------- */
export type NotifIcon = "calendar" | "alert" | "user" | "check";
export const notifications: {
  id: string;
  icon: NotifIcon;
  tone: KpiTone;
  text: string;
  time: string;
}[] = [
  { id: "n1", icon: "calendar", tone: "violet", text: "6 appointments rescheduled", time: "Today, 10:24 AM" },
  { id: "n2", icon: "alert", tone: "rose", text: "3 AI reports pending review", time: "Today, 09:18 AM" },
  { id: "n3", icon: "user", tone: "blue", text: "New doctor account request", time: "Today, 08:45 AM" },
  { id: "n4", icon: "check", tone: "teal", text: "System update completed", time: "Yesterday, 11:30 PM" },
];

/* ---------------- Quick actions ---------------- */
export type QuickIcon = "stethoscope" | "users" | "calendar" | "file";
export const quickActions: { key: string; label: string; icon: QuickIcon }[] = [
  { key: "doctors", label: "Manage Doctors", icon: "stethoscope" },
  { key: "staff", label: "Manage Staff", icon: "users" },
  { key: "appointments", label: "View Appointments", icon: "calendar" },
  { key: "reports", label: "View AI Reports", icon: "file" },
];

/* ---------------- System health ---------------- */
export const systemHealth: { key: string; label: string; value: string; trend: number[] }[] = [
  { key: "app", label: "Application", value: "99.9%", trend: [8, 9, 8, 9, 9, 8, 9, 9] },
  { key: "db", label: "Database", value: "99.8%", trend: [7, 8, 9, 8, 9, 9, 8, 9] },
  { key: "ai", label: "AI Processing", value: "99.6%", trend: [8, 7, 8, 9, 8, 9, 8, 9] },
  { key: "files", label: "File Storage", value: "99.9%", trend: [9, 9, 8, 9, 9, 9, 8, 9] },
];

/* ---------------- Recent appointments ---------------- */
export type ApptStatus = "Completed" | "In Progress" | "Upcoming" | "Cancelled";
export const recentAppointments: {
  id: string;
  patient: string;
  doctor: string;
  time: string;
  type: "In-person" | "Online";
  status: ApptStatus;
}[] = [
  { id: "ap1", patient: "Ahmed Mohamed", doctor: "Dr. Sarah Ahmed", time: "09:00 AM", type: "In-person", status: "Completed" },
  { id: "ap2", patient: "Mona Khaled", doctor: "Dr. Youssef Ali", time: "10:30 AM", type: "In-person", status: "In Progress" },
  { id: "ap3", patient: "Youssef Hassan", doctor: "Dr. Mona Khaled", time: "12:00 PM", type: "Online", status: "Upcoming" },
  { id: "ap4", patient: "Sara Ali", doctor: "Dr. Karim Mostafa", time: "02:30 PM", type: "Online", status: "Upcoming" },
  { id: "ap5", patient: "Omar Tarek", doctor: "Dr. Ahmed Nour", time: "04:00 PM", type: "Online", status: "Cancelled" },
];

/* ---------------- Recent users ---------------- */
export type UserStatus = "Active" | "Pending";
export const recentUsers: {
  id: string;
  name: string;
  role: "Doctor" | "Staff";
  created: string;
  status: UserStatus;
}[] = [
  { id: "u1", name: "Dr. Lina Samir", role: "Doctor", created: "Oct 20, 2026", status: "Active" },
  { id: "u2", name: "Mohamed Gamal", role: "Staff", created: "Oct 19, 2026", status: "Active" },
  { id: "u3", name: "Fatma Adel", role: "Doctor", created: "Oct 18, 2026", status: "Pending" },
  { id: "u4", name: "Mostafa Ibrahim", role: "Staff", created: "Oct 17, 2026", status: "Active" },
  { id: "u5", name: "Nour Ahmed", role: "Doctor", created: "Oct 16, 2026", status: "Active" },
];

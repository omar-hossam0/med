import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Users,
  Bot,
  Layers,
  Stethoscope,
  Video,
  Activity,
  ClipboardList,
  Calendar,
  FileText,
  Database,
  Briefcase,
  ShieldCheck,
} from "@/lib/icons";
import { ASSETS } from "@/lib/constants";

export type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "#top" },
  { label: "About Us", href: "#about" },
  { label: "For Patients", href: "#roles" },
  { label: "For Doctors", href: "#roles" },
  { label: "For Clinics", href: "#roles" },
  { label: "Resources", href: "#features" },
];

export const STATS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "4", label: "User Roles", Icon: Users },
  { value: "3", label: "AI Agents", Icon: Bot },
  { value: "1", label: "Connected Platform", Icon: Layers },
  { value: "AI", label: "Assisted Workflows", Icon: Sparkles },
];

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Book Appointment",
    description:
      "Patients find an available appointment and confirm their booking.",
    Icon: Calendar,
  },
  {
    step: "02",
    title: "Consultation",
    description:
      "The doctor conducts the consultation and records the conversation with appropriate consent.",
    Icon: Video,
  },
  {
    step: "03",
    title: "AI Analysis",
    description:
      "Speech-to-text creates a draft transcript. After doctor approval, AI prepares structured medical reports.",
    Icon: Activity,
  },
  {
    step: "04",
    title: "Review & Approve",
    description:
      "The doctor reviews and approves the medical reports before they are delivered or used to update records.",
    Icon: ClipboardList,
  },
  {
    step: "05",
    title: "Continuous Care",
    description:
      "Approved information updates the patient profile and supports follow-up scheduling.",
    Icon: Stethoscope,
  },
];

export const FEATURES = [
  {
    title: "AI-Powered Consultation",
    description:
      "Automatic transcription, doctor-reviewed text, and AI-assisted report preparation.",
    Icon: Sparkles,
    href: "#how-it-works",
  },
  {
    title: "Comprehensive Patient Records",
    description:
      "Organized medical history, approved reports, medications, and test information.",
    Icon: Database,
    href: "#why-medora",
  },
  {
    title: "Smart Scheduling",
    description:
      "Appointment availability, booking management, and follow-up coordination.",
    Icon: Calendar,
    href: "#how-it-works",
  },
  {
    title: "Medical Knowledge Base",
    description:
      "Medical reference retrieval using document processing, OCR, and RAG with source-backed answers.",
    Icon: FileText,
    href: "#features",
  },
];

export const USER_ROLES = [
  {
    key: "patient",
    title: "For Patients",
    description:
      "Manage your healthcare journey with easy access to records, appointments, and follow-ups.",
    features: [
      "Book appointments",
      "Access medical records",
      "View approved reports",
      "Manage follow-ups",
    ],
    image: ASSETS.patient,
    Icon: Users,
  },
  {
    key: "doctor",
    title: "For Doctors",
    description:
      "Streamline consultations with AI-assisted documentation and unified patient workflows.",
    features: [
      "Review patient history",
      "Manage consultations",
      "Approve transcripts and reports",
      "Plan follow-up care",
    ],
    image: ASSETS.doctor,
    Icon: Stethoscope,
  },
  {
    key: "reception",
    title: "For Reception Staff",
    description:
      "Coordinate appointments, registrations, and daily operations across the clinic.",
    features: [
      "Register patients",
      "Manage appointments",
      "Coordinate daily schedules",
      "Support clinic operations",
    ],
    image: ASSETS.receptionStaff,
    Icon: Briefcase,
  },
  {
    key: "admin",
    title: "For Administrators",
    description:
      "Configure users, permissions, references, and document processing at scale.",
    features: [
      "Manage users and roles",
      "Configure permissions",
      "Manage medical references",
      "Oversee document processing",
    ],
    image: ASSETS.admin,
    Icon: ShieldCheck,
  },
];

export const HEALTH_BENEFITS = [
  "View Appointments",
  "Access Medical Records",
  "View Approved Reports",
  "Get Follow-up Notifications",
];

export const TESTIMONIALS = [
  {
    title: "A Simpler Patient Journey",
    description:
      "Patients can manage appointments, access approved reports, and follow their care information in one place.",
    accent: "Patient Experience",
  },
  {
    title: "Less Manual Documentation",
    description:
      "AI-assisted transcription and report preparation help doctors organize consultation information before approval.",
    accent: "Doctor Experience",
  },
  {
    title: "Connected Clinic Workflows",
    description:
      "Reception and administrative teams can coordinate appointments, users, and medical knowledge resources.",
    accent: "Clinic Coordination",
  },
];

export const HERO_BENEFITS = [
  { label: "Secure & Private", Icon: ShieldCheck },
  { label: "AI-Assisted Reports", Icon: Sparkles },
  { label: "All-in-One Platform", Icon: Layers },
  { label: "Better Patient Experience", Icon: Users },
];

export const FOOTER_PLATFORM = [
  { label: "For Patients", href: "#roles" },
  { label: "For Doctors", href: "#roles" },
  { label: "For Clinics", href: "#roles" },
  { label: "For Administrators", href: "#roles" },
];

export const FOOTER_COMPANY = [
  { label: "About Us", href: "#about" },
  { label: "Our Mission", href: "#about" },
  { label: "Our Vision", href: "#about" },
  { label: "Contact Us", href: "#contact" },
];

export const FOOTER_RESOURCES = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Medical Knowledge", href: "#features" },
  { label: "Privacy Policy", href: "#privacy", unavailable: true },
  { label: "Terms of Service", href: "#terms", unavailable: true },
];

/**
 * Centralized app constants and design tokens for Medora.
 *
 * Image strategy:
 * - Large display imagery (clinic, dashboard, devices) uses the high-resolution
 *   originals supplied in the workspace (see /hq) so they render sharply on
 *   high-density screens. The hero uses its supplied standalone image.
 * - Role portraits and decorative shapes use the individually supplied crops.
 */
import heroConsultation from "@/assets/01_hero_doctor.png";
import clinicCenter from "@/assets/hq/clinic-center.png";
import dashboardUi from "@/assets/hq/dashboard-ui.png";
import devicesMockup from "@/assets/hq/devices-mockup.png";
import reception from "@/assets/hq/reception.jpg";
import loginBg from "@/assets/Modern Medora Healthcare Lobby.png";
import adminHero from "@/assets/hq/admin-hero.jpg";
import patientHero from "@/assets/Warm Doctor-Patient Consultation at Medora Healthcare.png";

import aiAnalysis from "@/assets/05_ai_analysis.png";
import consultation from "@/assets/06_consultation.png";
import receptionStaff from "@/assets/07_reception_staff.png";
import patient from "@/assets/08_patient.png";
import doctor from "@/assets/09_doctor.png";
import admin from "@/assets/10_admin.png";
import medicalTech from "@/assets/11_medical_tech.png";
import clinicBackground from "@/assets/12_clinic_background.png";
import gradientBackground from "@/assets/13_gradient_bg.png";
import blobShape from "@/assets/14_blob_shape.png";
import waveShape from "@/assets/15_wave_shape.png";
import dotPattern from "@/assets/16_dot_pattern.png";
import circleGradient from "@/assets/17_circle_gradient.png";
import medicalPattern from "@/assets/18_medical_pattern.png";
import footerPattern from "@/assets/19_footer_pattern.png";

export const SITE = {
  name: "Medora",
  tagline: "Smarter Healthcare for Healthier Lives",
  description:
    "Medora combines intelligent AI with seamless clinical workflows to support doctors, patients, and healthcare teams — all in one secure platform.",
} as const;

export const SECTION_IDS = {
  top: "top",
  hero: "hero",
  stats: "stats",
  about: "about",
  howItWorks: "how-it-works",
  features: "features",
  roles: "roles",
  whyMedora: "why-medora",
  health: "health",
  testimonials: "testimonials",
  cta: "cta",
  footerContact: "footer-contact",
  privacy: "privacy",
  terms: "terms",
} as const;

export const ASSETS = {
  hero: heroConsultation,
  clinic: clinicCenter,
  dashboard: dashboardUi,
  devices: devicesMockup,
  reception,
  loginBg,
  adminHero,
  patientHero,
  aiAnalysis,
  consultation,
  receptionStaff,
  patient,
  doctor,
  admin,
  medicalTech,
  clinicBackground,
  gradientBackground,
  blob: blobShape,
  wave: waveShape,
  dots: dotPattern,
  circle: circleGradient,
  medicalPattern,
  footerPattern,
} as const;

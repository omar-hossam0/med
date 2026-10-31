import type { Metadata } from "next";
import { PrescriptionsModule } from "@/components/patient/prescriptions/PrescriptionsModule";

export const metadata: Metadata = {
  title: "Prescriptions — Medora",
  description:
    "Manage your Medora prescriptions and medications in one place: active prescriptions, your medication list, prescription history, medication details and daily schedules.",
};

export default function PatientPrescriptionsPage() {
  return <PrescriptionsModule />;
}

import type { Metadata } from "next";
import { MedicalRecordsModule } from "@/components/patient/medical-records/MedicalRecordsModule";

export const metadata: Metadata = {
  title: "Medical Records — Medora",
  description:
    "Review your Medora medical history: visits, prescriptions, lab results, imaging, medical reports and documents shared by your care team.",
};

export default function PatientMedicalRecordsPage() {
  return <MedicalRecordsModule />;
}

import type { Metadata } from "next";
import { DoctorConsultationWorkspace } from "@/components/doctor/consultation/DoctorConsultationWorkspace";

export const metadata: Metadata = {
  title: "Consultation Workspace — Medora",
  description: "Start or resume a doctor consultation.",
};

export default function DoctorConsultationWorkspacePage() {
  return <DoctorConsultationWorkspace />;
}

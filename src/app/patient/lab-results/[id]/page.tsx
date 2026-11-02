import type { Metadata } from "next";
import { LabResultDetail } from "@/components/patient/lab-results/LabResultDetail";
import { getLabResult } from "@/lib/mock/medicalRecords";

export const metadata: Metadata = {
  title: "Lab Result Details — Medora",
  description:
    "Review the measured values, reference ranges, trends, report and related visit for a Medora laboratory result.",
};

export default function PatientLabResultDetailPage({ params }: { params: { id: string } }) {
  return <LabResultDetail lab={getLabResult(params.id)} labId={params.id} />;
}

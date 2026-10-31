import type { Metadata } from "next";
import { PrescriptionDetail } from "@/components/patient/prescriptions/PrescriptionDetail";

export const metadata: Metadata = {
  title: "Prescription Details — Medora",
  description:
    "Review the medications, clinician instructions, related visit and files for a Medora prescription.",
};

export default function PatientPrescriptionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <PrescriptionDetail prescriptionId={params.id} />;
}

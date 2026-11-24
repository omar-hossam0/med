import { Suspense } from "react";
import type { Metadata } from "next";
import { PatientProfileRoute } from "@/components/doctor/patients/PatientProfileRoute";
import { getPatientRecord } from "@/lib/mock/doctorPatients";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { patientId: string } }): Metadata {
  const record = getPatientRecord(params.patientId);
  return {
    title: record ? `${record.patient.name} — Medora` : "Patient — Medora",
    description: "Full patient record: overview, medical history, visits, labs, medications and documents.",
  };
}

export default function DoctorPatientProfilePage({ params }: { params: { patientId: string } }) {
  return (
    <Suspense fallback={null}>
      <PatientProfileRoute patientId={params.patientId} />
    </Suspense>
  );
}

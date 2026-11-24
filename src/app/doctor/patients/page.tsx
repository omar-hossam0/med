import type { Metadata } from "next";
import { DoctorPatients } from "@/components/doctor/patients/DoctorPatients";

export const metadata: Metadata = {
  title: "Patients — Medora",
  description:
    "Search, find, and manage your patients, review their clinical summary, and start a consultation.",
};

/** Patient activity is anchored to the day of the request, so do not cache. */
export const dynamic = "force-dynamic";

export default function DoctorPatientsPage() {
  return <DoctorPatients />;
}

import type { Metadata } from "next";
import { DoctorsStaffDirectory } from "@/components/admin/doctors-staff/DoctorsStaffDirectory";

export const metadata: Metadata = {
  title: "Doctors & Staff — Medora",
  description: "Manage medical professionals and staff members.",
};

export default function DoctorsStaffPage() {
  return <DoctorsStaffDirectory />;
}

import type { Metadata } from "next";
import { DoctorOverview } from "@/components/doctor/overview/DoctorOverview";

export const metadata: Metadata = {
  title: "Doctor Overview — Medora",
  description:
    "Your clinical workspace: today's schedule, waiting patients, pending reports, follow-ups and patient summaries.",
};

export default function DoctorDashboardPage() {
  return <DoctorOverview />;
}

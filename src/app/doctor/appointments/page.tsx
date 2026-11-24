import type { Metadata } from "next";
import { DoctorSchedule } from "@/components/doctor/schedule/DoctorSchedule";

export const metadata: Metadata = {
  title: "My Schedule — Medora",
  description:
    "View and manage your appointments, browse the clinic calendar, and take action on a visit.",
};

/** Dates are anchored to the day of the request, so this route must not be cached. */
export const dynamic = "force-dynamic";

export default function DoctorAppointmentsPage() {
  return <DoctorSchedule />;
}

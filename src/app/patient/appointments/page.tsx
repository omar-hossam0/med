import type { Metadata } from "next";
import { AppointmentsModule } from "@/components/patient/appointments/AppointmentsModule";

export const metadata: Metadata = {
  title: "Appointments — Medora",
  description:
    "Manage your Medora appointments: view upcoming, completed and cancelled visits, book a new appointment, reschedule, or cancel an eligible booking.",
};

export default function PatientAppointmentsPage() {
  return <AppointmentsModule />;
}

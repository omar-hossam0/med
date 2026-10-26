import type { Metadata } from "next";
import { DashboardGreeting } from "@/components/patient/DashboardGreeting";
import { DashboardStats } from "@/components/patient/DashboardStats";
import {
  RecentAppointmentsCard,
  HealthSummaryCard,
  QuickActionsCard,
} from "@/components/patient/DashboardPanels";
import {
  RecentLabResultsCard,
  MyDoctorsCard,
  MessagesCard,
} from "@/components/patient/DashboardLowerPanels";

export const metadata: Metadata = {
  title: "Patient Dashboard — Medora",
  description:
    "Your Medora patient overview: upcoming appointments, medical records, prescriptions, lab results and health summary.",
};

export default function PatientDashboardPage() {
  return (
    <div className="space-y-4">
      <DashboardGreeting />
      <DashboardStats />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <RecentAppointmentsCard />
        <HealthSummaryCard />
        <QuickActionsCard />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1.12fr_1fr_1.18fr]">
        <RecentLabResultsCard />
        <MyDoctorsCard />
        <div className="h-full md:col-span-2 xl:col-span-1">
          <MessagesCard />
        </div>
      </div>
    </div>
  );
}

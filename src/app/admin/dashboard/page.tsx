import type { Metadata } from "next";
import { AdminHero } from "@/components/admin/AdminHero";
import { AdminKpiRow } from "@/components/admin/AdminKpiRow";
import {
  AppointmentsTrendCard,
  DepartmentDonutCard,
} from "@/components/admin/AdminCharts";
import {
  RecentAppointmentsTable,
  RecentUsersTable,
} from "@/components/admin/AdminTables";
import {
  DateQuotePanel,
  NotificationsPanel,
  QuickActionsPanel,
  SystemHealthPanel,
} from "@/components/admin/AdminRightColumn";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export const metadata: Metadata = {
  title: "Admin Overview — Medora",
  description:
    "Medora system administration overview: operational KPIs, appointment analytics, notifications and system health (demo data).",
};

export default function AdminDashboardPage() {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_268px]">
      {/* Main column */}
      <div className="min-w-0 space-y-3">
        <AdminHero />
        <AdminKpiRow />
        <RevealOnScroll
          stagger={50}
          className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        >
          <AppointmentsTrendCard />
          <DepartmentDonutCard />
        </RevealOnScroll>
        <RevealOnScroll
          stagger={50}
          className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        >
          <RecentAppointmentsTable />
          <RecentUsersTable />
        </RevealOnScroll>
      </div>

      {/* Right utility column */}
      <RevealOnScroll stagger={50} className="space-y-3">
        <DateQuotePanel />
        <NotificationsPanel />
        <QuickActionsPanel />
        <SystemHealthPanel />
      </RevealOnScroll>
    </div>
  );
}

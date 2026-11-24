"use client";

import { CalendarCheck, ClipboardCheck, UserPlus, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PatientStats } from "@/lib/mock/doctorPatients";

const CARDS: {
  key: keyof PatientStats;
  label: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  { key: "total", label: "Total Patients", icon: Users, tone: "bg-[#E7FBF8] text-[#0A9189]" },
  {
    key: "seenThisWeek",
    label: "Seen This Week",
    icon: ClipboardCheck,
    tone: "bg-[#EAF1FF] text-[#3B6EF6]",
  },
  {
    key: "followUps",
    label: "Follow-ups",
    icon: CalendarCheck,
    tone: "bg-[#FFF6E5] text-[#C77A0A]",
  },
  {
    key: "newPatients",
    label: "New Patients",
    icon: UserPlus,
    tone: "bg-[#F3ECFF] text-[#8B5CF6]",
  },
];

/** The four compact counters above the patient table. */
export function PatientSummaryCards({ stats }: { stats: PatientStats }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, tone }) => (
        <li
          key={key}
          className="flex items-center gap-3 rounded-2xl border border-[#E6EFEE] bg-white px-3.5 py-3 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]"
        >
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", tone)}>
            <Icon size={16} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[19px] font-bold leading-none text-[#0F2D4A]">
              {stats[key]}
            </span>
            <span className="mt-1 block truncate text-[10px] font-medium text-[#5B6B7C]">
              {label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

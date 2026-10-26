"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Heart,
  Weight,
  Droplets,
  Activity,
  CalendarPlus,
  Pill,
  FlaskConical,
  FolderOpen,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import {
  recentAppointments,
  vitals,
  quickActions,
  type VitalTone,
  type QuickIcon,
} from "@/lib/mock/patient";
import { Avatar, StatusBadge, Sparkline } from "./ui";
import { useComingSoon } from "./ComingSoon";
import { cn } from "@/lib/cn";

/* ---------------- Recent Appointments ---------------- */
export function RecentAppointmentsCard() {
  const comingSoon = useComingSoon();
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_8px_26px_-22px_rgba(15,45,74,0.28)] xl:col-span-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[#0F2D4A]">Recent Appointments</h3>
        <button
          type="button"
          onClick={() => comingSoon("All appointments")}
          className="text-[11px] font-semibold text-[#0A9189] transition hover:underline"
        >
          See All
        </button>
      </div>

      <ul className="mt-1.5 flex-1">
        {recentAppointments.map((appointment) => (
          <li key={appointment.id} className="border-b border-[#EEF4F4] last:border-0">
            <button
              type="button"
              onClick={() => comingSoon("Appointment details")}
              className="flex w-full items-center gap-2.5 py-2.5 text-left transition hover:bg-[#FAFDFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
            >
              <Avatar name={appointment.doctor} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-semibold text-[#0F2D4A]">
                  {appointment.doctor}
                </span>
                <span className="block truncate text-[9.5px] text-ink-muted">
                  {appointment.specialty}
                </span>
                <span className="mt-0.5 block truncate text-[8.5px] text-ink-muted sm:hidden">
                  {appointment.date} · {appointment.time}
                </span>
              </span>
              <span className="hidden shrink-0 text-right sm:block">
                <span className="block text-[9.5px] text-[#5B6B7C]">
                  {appointment.date}
                </span>
                <span className="block text-[9px] text-ink-muted">{appointment.time}</span>
              </span>
              <StatusBadge status={appointment.status} />
              <ChevronRight size={13} className="shrink-0 text-ink-muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Health Summary ---------------- */
const VITAL_ICONS: Record<string, LucideIcon> = {
  heart: Heart,
  weight: Weight,
  droplet: Droplets,
  activity: Activity,
};
const VITAL_TONES: Record<VitalTone, { bg: string; fg: string; line: string }> = {
  rose: { bg: "bg-[#FDECEF]", fg: "text-[#E5484D]", line: "#E5484D" },
  blue: { bg: "bg-[#EFF4FF]", fg: "text-[#3B6EF6]", line: "#3B6EF6" },
  teal: { bg: "bg-[#E6FAF7]", fg: "text-[#0A9189]", line: "#0A9189" },
  violet: { bg: "bg-[#F3EEFF]", fg: "text-[#8B5CF6]", line: "#8B5CF6" },
};

const HEALTH_RANGES = ["Last 3 Months", "Last 6 Months", "Last 12 Months"] as const;

export function HealthSummaryCard() {
  const comingSoon = useComingSoon();
  const [range, setRange] = useState<(typeof HEALTH_RANGES)[number]>("Last 6 Months");

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_8px_26px_-22px_rgba(15,45,74,0.28)] xl:col-span-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-[#0F2D4A]">Your Health Summary</h3>
        <label className="relative inline-flex shrink-0 items-center">
          <span className="sr-only">Health summary period</span>
          <select
            value={range}
            onChange={(event) =>
              setRange(event.target.value as (typeof HEALTH_RANGES)[number])
            }
            className="h-7 appearance-none rounded-full border border-[#E2ECEA] bg-white pl-2.5 pr-6 text-[9.5px] text-[#5B6B7C] outline-none transition hover:bg-[#F8FCFB] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
          >
            {HEALTH_RANGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown
            size={11}
            aria-hidden
            className="pointer-events-none absolute right-2 text-[#8A99A8]"
          />
        </label>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {vitals.map((vital) => {
          const Icon = VITAL_ICONS[vital.icon];
          const tone = VITAL_TONES[vital.tone];
          return (
            <div
              key={vital.key}
              className="rounded-xl border border-[#EBF2F1] bg-white p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    tone.bg,
                    tone.fg,
                  )}
                >
                  <Icon size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[14px] font-bold leading-none text-[#0F2D4A]">
                    {vital.value}
                    <span className="ml-0.5 text-[8.5px] font-medium text-ink-muted">
                      {vital.unit}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[9px] text-[#5B6B7C]">
                    {vital.label}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 flex justify-center">
                <Sparkline points={vital.trend} color={tone.line} width={128} height={22} />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => comingSoon("Health metrics")}
        className="mt-2.5 flex w-full items-center gap-2 rounded-xl bg-[#EAFBF8] px-3 py-2 text-left transition hover:bg-[#DDF7F2]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] font-semibold text-[#0F2D4A]">
            All Health Metrics
          </span>
          <span className="block text-[9px] text-[#7A8B9C]">
            View your detailed health information
          </span>
        </span>
        <ChevronRight size={13} className="shrink-0 text-[#5B6B7C]" />
      </button>
    </div>
  );
}

/* ---------------- Quick Actions ---------------- */
const QUICK_ICONS: Record<QuickIcon, LucideIcon> = {
  "calendar-plus": CalendarPlus,
  pill: Pill,
  flask: FlaskConical,
  folder: FolderOpen,
};

export function QuickActionsCard() {
  const comingSoon = useComingSoon();
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_8px_26px_-22px_rgba(15,45,74,0.28)] lg:col-span-2 xl:col-span-3">
      <h3 className="text-[15px] font-semibold text-[#0F2D4A]">Quick Actions</h3>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {quickActions.map((action) => {
          const Icon = QUICK_ICONS[action.icon];
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => comingSoon(action.label)}
              className="group flex items-center gap-1.5 rounded-xl border border-[#EBF2F1] p-2 text-left transition hover:border-[#CFE9E5] hover:bg-[#F8FCFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#E6FAF7] text-[#0A9189]">
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1 text-[9.5px] font-medium leading-tight text-[#0F2D4A]">
                {action.label}
              </span>
              <ChevronRight
                size={10}
                className="shrink-0 text-ink-muted transition group-hover:translate-x-0.5"
              />
            </button>
          );
        })}
      </div>

      <div className="relative mt-2.5 flex flex-1 items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#EFE9FF] via-[#E9F8F9] to-[#DDF7F1] p-3.5">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full bg-white/40"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-[#C7F0E8]/50"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold leading-snug text-[#0F2D4A]">
              Manage your health on the go
            </p>
            <p className="mt-0.5 text-[9px] leading-snug text-[#5B6B7C]">
              Access Medora from your phone or computer.
            </p>
          </div>
          <span className="grid h-11 w-9 shrink-0 place-items-center rounded-lg border border-white/70 bg-white/80 text-[#0A9189] shadow-sm">
            <Smartphone size={20} />
          </span>
        </div>
      </div>
    </div>
  );
}

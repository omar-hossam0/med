"use client";

import {
  CalendarDays,
  FileText,
  Pill,
  FlaskConical,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { dashboardStats, type StatIcon, type StatTone } from "@/lib/mock/patient";
import { useComingSoon } from "./ComingSoon";
import { cn } from "@/lib/cn";

const ICONS: Record<StatIcon, LucideIcon> = {
  calendar: CalendarDays,
  file: FileText,
  pill: Pill,
  flask: FlaskConical,
};

const TONES: Record<StatTone, { bg: string; fg: string }> = {
  teal: { bg: "bg-[#E7FBF8]", fg: "text-[#0A9189]" },
  blue: { bg: "bg-[#EFF4FF]", fg: "text-[#3B6EF6]" },
  amber: { bg: "bg-[#FFF6E5]", fg: "text-[#E09A1B]" },
  violet: { bg: "bg-[#F3EEFF]", fg: "text-[#8B5CF6]" },
};

export function DashboardStats() {
  const comingSoon = useComingSoon();

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {dashboardStats.map((stat) => {
        const Icon = ICONS[stat.icon];
        const tone = TONES[stat.tone];
        return (
          <button
            key={stat.key}
            type="button"
            onClick={() => comingSoon(stat.label)}
            className="group flex items-center gap-3 rounded-xl border border-[#E6EFEE] bg-white p-3.5 text-left shadow-[0_6px_20px_-18px_rgba(15,45,74,0.28)] transition duration-200 hover:-translate-y-0.5 hover:border-[#CFE9E5] hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
          >
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                tone.bg,
                tone.fg,
              )}
            >
              <Icon size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[19px] font-bold leading-none text-[#0F2D4A]">
                {stat.value}
              </span>
              <span className="mt-1 block truncate text-[10.5px] leading-tight text-[#5B6B7C]">
                {stat.label}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[9.5px] font-semibold text-[#0A9189]">
              <span className="hidden min-[1360px]:inline">View All</span>
              <ChevronRight
                size={12}
                aria-hidden
                className="transition group-hover:translate-x-0.5"
              />
            </span>
          </button>
        );
      })}
    </section>
  );
}

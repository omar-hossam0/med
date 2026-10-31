"use client";

import {
  Users,
  Stethoscope,
  CalendarDays,
  FileText,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { kpis, type KpiIcon, type KpiTone } from "@/lib/mock/admin";
import { useComingSoon } from "./ComingSoon";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { cn } from "@/lib/cn";

const ICONS: Record<KpiIcon, LucideIcon> = {
  users: Users,
  stethoscope: Stethoscope,
  calendar: CalendarDays,
  file: FileText,
  alert: AlertCircle,
};

const TONES: Record<KpiTone, { bg: string; fg: string }> = {
  teal: { bg: "bg-[#E6FAF7]", fg: "text-[#0A9189]" },
  blue: { bg: "bg-[#EFF4FF]", fg: "text-[#3B6EF6]" },
  violet: { bg: "bg-[#F3EEFF]", fg: "text-[#8B5CF6]" },
  amber: { bg: "bg-[#FFF6E5]", fg: "text-[#E09A1B]" },
  rose: { bg: "bg-[#FDECEF]", fg: "text-[#E5484D]" },
};

export function AdminKpiRow() {
  const comingSoon = useComingSoon();

  return (
    <RevealOnScroll
      as="section"
      stagger={50}
      y={14}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    >
      {kpis.map((kpi) => {
        const Icon = ICONS[kpi.icon];
        const tone = TONES[kpi.tone];
        return (
          <button
            key={kpi.key}
            type="button"
            onClick={() => comingSoon(kpi.label)}
            className="rounded-2xl border border-line bg-white p-3.5 text-left transition hover:border-primary/30 hover:shadow-soft"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", tone.bg, tone.fg)}
              >
                <Icon size={14} />
              </span>
              <span className="text-[10.5px] leading-tight text-[#5B6B7C]">{kpi.label}</span>
            </div>
            <p className="mt-2 text-[22px] font-bold leading-none text-[#0F2D4A]">{kpi.value}</p>
            {kpi.change ? (
              <p className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-muted">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold",
                    kpi.change.direction === "up" ? "text-[#1E9E56]" : "text-[#E5484D]",
                  )}
                >
                  {kpi.change.direction === "up" ? (
                    <ArrowUp size={10} />
                  ) : (
                    <ArrowDown size={10} />
                  )}
                  {kpi.change.value}
                </span>
                {kpi.change.label}
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] font-medium text-[#C77A0A]">{kpi.note}</p>
            )}
          </button>
        );
      })}
    </RevealOnScroll>
  );
}

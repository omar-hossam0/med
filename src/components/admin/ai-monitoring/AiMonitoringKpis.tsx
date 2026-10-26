"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  FileText,
  Minus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  SERVICE_STATE_LABEL,
  type AiSummary,
  type ServiceState,
} from "@/lib/mock/aiMonitoring";

type Tone = "green" | "blue" | "violet" | "rose";

const ICON_TONES: Record<Tone, string> = {
  green: "bg-[#E9F9EF] text-[#1E9E56]",
  blue: "bg-[#EFF4FF] text-[#3B6EF6]",
  violet: "bg-[#F3EEFF] text-[#8B5CF6]",
  rose: "bg-[#FDECEF] text-[#E5484D]",
};

const SERVICE_STYLES: Record<ServiceState, string> = {
  operational: "bg-[#E9F9EF] text-[#1E9E56]",
  degraded: "bg-[#FFF6E5] text-[#C77A0A]",
  unavailable: "bg-[#FDECEF] text-[#E5484D]",
};

function change(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function Trend({
  value,
  inverse = false,
}: {
  value: number | null;
  inverse?: boolean;
}) {
  if (value === null) {
    return (
      <span className="flex items-center gap-1 text-[9px] text-[#9AA9B8]">
        <Minus size={10} /> No prior data
      </span>
    );
  }

  const good = inverse ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[9.5px] font-semibold",
        good ? "text-[#1E9E56]" : "text-[#E5484D]",
      )}
      title={`${Math.abs(value).toFixed(1)}% versus the previous period`}
    >
      <Icon size={11} aria-hidden />
      {value >= 0 ? "+" : "−"}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  tone,
  current,
  previous,
  inverse,
  status,
}: {
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  tone: Tone;
  current: number;
  previous: number;
  inverse?: boolean;
  status?: ServiceState;
}) {
  return (
    <article className="flex h-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-soft">
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full",
          ICON_TONES[tone],
        )}
        aria-hidden
      >
        <Icon size={19} strokeWidth={1.9} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10.5px] leading-tight text-[#5B6B7C]">{label}</p>
          {status && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold",
                SERVICE_STYLES[status],
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {SERVICE_STATE_LABEL[status]}
            </span>
          )}
        </div>
        <p className="mt-1 text-[24px] font-bold leading-none tracking-[-0.02em] text-[#0F2D4A]">
          {value.toLocaleString("en-US")}
        </p>
        <p className="mt-1.5 text-[9.5px] leading-tight text-[#7A8B9C]">{caption}</p>
      </div>

      {!status && (
        <div className="shrink-0 text-right">
          <Trend value={change(current, previous)} inverse={inverse} />
          <p className="mt-1 text-[8.5px] text-[#9AA9B8]">vs prev. period</p>
        </div>
      )}
    </article>
  );
}

export function AiMonitoringKpis({
  summary,
  previous,
  serviceState,
}: {
  summary: AiSummary;
  previous: AiSummary;
  serviceState: ServiceState;
}) {
  return (
    <section
      aria-label="AI report monitoring summary"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <KpiCard
        label="Total Reports"
        value={summary.total}
        caption="Generated report records"
        icon={FileText}
        tone="green"
        current={summary.total}
        previous={previous.total}
      />
      <KpiCard
        label="Awaiting Doctor Review"
        value={summary.awaiting}
        caption="Waiting for clinical review"
        icon={Clock3}
        tone="blue"
        current={summary.awaiting}
        previous={previous.awaiting}
      />
      <KpiCard
        label="Approved by Doctors"
        value={summary.approved}
        caption="Clinician-approved reports"
        icon={BadgeCheck}
        tone="violet"
        current={summary.approved}
        previous={previous.approved}
      />
      <KpiCard
        label="Processing Failures"
        value={summary.failures}
        caption="Technical issues to investigate"
        icon={TriangleAlert}
        tone="rose"
        current={summary.failures}
        previous={previous.failures}
        inverse
        status={serviceState}
      />
    </section>
  );
}

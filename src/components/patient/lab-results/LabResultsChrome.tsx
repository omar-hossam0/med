"use client";

import { ArrowLeft, CheckCircle2, FlaskConical, ShieldAlert, type LucideIcon } from "lucide-react";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import type { LabCounts, LabStatus } from "@/lib/mock/labResults";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

export function LabResultsHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle: string;
  back?: { label: string; onClick: () => void };
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <button
            type="button"
            onClick={back.onClick}
            className="mb-1 inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold text-[#5B6B7C] transition-colors duration-150 hover:text-[#0A9189] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A9189]/30"
          >
            <ArrowLeft size={13} aria-hidden />
            {back.label}
          </button>
        ) : null}
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#0F2D4A] sm:text-[29px]">
          {title}
        </h1>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B7C] sm:text-[12.5px]">
          {subtitle}
        </p>
      </div>
      {action ? <div className="shrink-0 sm:pt-1">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */

const STATUS_TONE: Record<LabStatus, { pill: string; icon: LucideIcon }> = {
  Normal: { pill: "bg-[#E7FBF8] text-[#0A9189] border-[#C6EFE7]", icon: CheckCircle2 },
  Abnormal: { pill: "bg-[#FFF6E5] text-[#B4700A] border-[#FBE3B6]", icon: ShieldAlert },
};

export function LabStatusBadge({ status, className }: { status: LabStatus; className?: string }) {
  const tone = STATUS_TONE[status];
  const Icon = tone.icon;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[2px] text-[9.5px] font-semibold",
        tone.pill,
        className,
      )}
    >
      <Icon size={10} aria-hidden />
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

const STAT_ITEMS: {
  key: keyof LabCounts;
  label: string;
  icon: LucideIcon;
  iconTone: string;
}[] = [
  {
    key: "total",
    label: "Total Tests",
    icon: FlaskConical,
    iconTone: "bg-[#F3EEFF] text-[#8B5CF6]",
  },
  {
    key: "normal",
    label: "Normal Results",
    icon: CheckCircle2,
    iconTone: "bg-[#E7FBF8] text-[#0A9189]",
  },
  {
    key: "attention",
    label: "Need Attention",
    icon: ShieldAlert,
    iconTone: "bg-[#FFF6E5] text-[#D98A0B]",
  },
];

export function LabResultsSummary({ counts }: { counts: LabCounts }) {
  return (
    <RevealOnScroll
      as="section"
      stagger={60}
      y={14}
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
    >
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.key}
            className="flex items-center gap-3 rounded-2xl border border-[#E6EFEE] bg-white px-3.5 py-3 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px] hover:shadow-[0_16px_34px_-26px_rgba(15,45,74,0.45)]"
          >
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", item.iconTone)}>
              <Icon size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[20px] font-bold leading-none text-[#0F2D4A]">
                {counts[item.key]}
              </p>
              <p className="mt-1 truncate text-[10.5px] font-medium text-[#5B6B7C]">{item.label}</p>
            </div>
          </article>
        );
      })}
    </RevealOnScroll>
  );
}

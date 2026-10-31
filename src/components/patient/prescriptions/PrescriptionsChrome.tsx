"use client";

import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Pill,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import type { MedicationStatus, PrescriptionCounts, PrescriptionStatus } from "@/lib/mock/prescriptions";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

export function PrescriptionsHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle: string;
  back?: { label: string; onClick: () => void };
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <button
            type="button"
            onClick={back.onClick}
            className="mb-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:text-[#0A9189]"
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

const STATUS_TONE: Record<PrescriptionStatus | MedicationStatus, string> = {
  Active: "bg-[#E7FBF8] text-[#0A9189] border-[#C6EFE7]",
  Completed: "bg-[#EFF4FF] text-[#2563EB] border-[#D8E3FF]",
  Expired: "bg-[#FFE9EE] text-[#E5486B] border-[#FFD3DC]",
};

export function StatusBadge({
  status,
  className,
}: {
  status: PrescriptionStatus | MedicationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[2px] text-[9.5px] font-semibold",
        STATUS_TONE[status],
        className,
      )}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

type StatKey = "activePrescriptions" | "totalPrescriptions" | "currentMedications" | "refillsSoon";

const STAT_ITEMS: {
  key: StatKey;
  label: string;
  hint: string;
  icon: LucideIcon;
  iconTone: string;
}[] = [
  {
    key: "activePrescriptions",
    label: "Active Prescriptions",
    hint: "Currently in use",
    icon: ClipboardList,
    iconTone: "bg-[#E7FBF8] text-[#0A9189]",
  },
  {
    key: "totalPrescriptions",
    label: "Total Prescriptions",
    hint: "All time",
    icon: Pill,
    iconTone: "bg-[#EFF4FF] text-[#2563EB]",
  },
  {
    key: "currentMedications",
    label: "Current Medications",
    hint: "From active prescriptions",
    icon: CalendarClock,
    iconTone: "bg-[#F3EEFF] text-[#8B5CF6]",
  },
  {
    key: "refillsSoon",
    label: "Refills Soon",
    hint: "Need refill soon",
    icon: RefreshCw,
    iconTone: "bg-[#FFF6E5] text-[#D98A0B]",
  },
];

export function PrescriptionStats({ counts }: { counts: PrescriptionCounts }) {
  return (
    <RevealOnScroll as="section" stagger={50} y={14} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.key}
            className="rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]"
          >
            <span className={cn("grid h-8 w-8 place-items-center rounded-lg", item.iconTone)}>
              <Icon size={15} aria-hidden />
            </span>
            <p className="mt-2 text-[21px] font-bold leading-none text-[#0F2D4A]">
              {counts[item.key]}
            </p>
            <p className="mt-1 text-[10.5px] font-semibold leading-tight text-[#0F2D4A]">
              {item.label}
            </p>
            <p className="mt-[2px] text-[9.5px] leading-tight text-[#8A9AAA]">{item.hint}</p>
          </article>
        );
      })}
    </RevealOnScroll>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export type PrescriptionTab = "all" | "medications" | "history";

export const PRESCRIPTION_TABS: { key: PrescriptionTab; label: string; countKey: "allPrescriptions" | "myMedications" | "history" }[] = [
  { key: "all", label: "All Prescriptions", countKey: "allPrescriptions" },
  { key: "medications", label: "My Medications", countKey: "myMedications" },
  { key: "history", label: "History", countKey: "history" },
];

export function PrescriptionTabs({
  active,
  counts,
  onChange,
}: {
  active: PrescriptionTab;
  counts: PrescriptionCounts;
  onChange: (tab: PrescriptionTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Prescription views"
      className="flex flex-wrap items-center gap-1.5"
    >
      {PRESCRIPTION_TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`prescription-tab-${tab.key}`}
            aria-selected={selected}
            aria-controls={`prescription-panel-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition",
              selected
                ? "border-[#0A9189] bg-[#0A9189] text-white shadow-[0_8px_20px_-14px_rgba(10,145,137,0.9)]"
                : "border-[#E6EFEE] bg-white text-[#5B6B7C] hover:border-[#BFE6E1] hover:text-[#0F2D4A]",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-[1px] text-[9px] font-bold",
                selected ? "bg-white/25 text-white" : "bg-[#F1F6F6] text-[#5B6B7C]",
              )}
            >
              {counts[tab.countKey]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

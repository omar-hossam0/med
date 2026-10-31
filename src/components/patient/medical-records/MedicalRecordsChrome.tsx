"use client";

import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Pill,
  type LucideIcon,
} from "lucide-react";
import { BackLink } from "./ui";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { cn } from "@/lib/cn";

export type MedicalTab =
  | "overview"
  | "visits"
  | "prescriptions"
  | "lab-results"
  | "imaging"
  | "documents"
  | "reports";

export type MedicalCounts = Record<MedicalTab | "total", number>;

export function MedicalRecordsHeader({
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
        {back ? <BackLink label={back.label} onClick={back.onClick} /> : null}
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
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

const STAT_ITEMS: {
  key: "total" | "visits" | "prescriptions" | "lab-results" | "imaging";
  label: string;
  hint: string;
  icon: LucideIcon;
  iconTone: string;
  tab: MedicalTab;
}[] = [
  {
    key: "total",
    label: "Total Records",
    hint: "Visits, prescriptions & labs",
    icon: FileText,
    iconTone: "bg-[#EFF4FF] text-[#2563EB]",
    tab: "overview",
  },
  {
    key: "visits",
    label: "Medical Visits",
    hint: "Consultations with doctors",
    icon: CalendarDays,
    iconTone: "bg-[#E7FBF8] text-[#0A9189]",
    tab: "visits",
  },
  {
    key: "prescriptions",
    label: "Prescriptions",
    hint: "Current & past medications",
    icon: Pill,
    iconTone: "bg-[#FFF6E5] text-[#D98A0B]",
    tab: "prescriptions",
  },
  {
    key: "lab-results",
    label: "Lab Results",
    hint: "Test results & analysis",
    icon: FlaskConical,
    iconTone: "bg-[#F3EEFF] text-[#8B5CF6]",
    tab: "lab-results",
  },
  {
    key: "imaging",
    label: "Imaging",
    hint: "X-rays, MRI, CT scans",
    icon: ImageIcon,
    iconTone: "bg-[#FFE9EE] text-[#E5486B]",
    tab: "imaging",
  },
];

export function MedicalRecordsStats({
  counts,
  onNavigate,
}: {
  counts: MedicalCounts;
  onNavigate: (tab: MedicalTab) => void;
}) {
  return (
    <RevealOnScroll
      as="section"
      stagger={50}
      y={14}
      ariaLabel="Medical record summary"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5"
    >
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.tab)}
            className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#E6EFEE] bg-white p-3 text-left shadow-[0_8px_24px_-24px_rgba(15,45,74,0.35)] transition duration-200 hover:-translate-y-0.5 hover:border-[#CFE9E5] hover:shadow-[0_14px_34px_-24px_rgba(15,45,74,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
          >
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                item.iconTone,
              )}
            >
              <Icon size={19} strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[20px] font-bold leading-none tracking-[-0.02em] text-[#0F2D4A]">
                {counts[item.key]}
              </span>
              <span className="mt-1 block truncate text-[10.5px] font-semibold leading-tight text-[#33475B]">
                {item.label}
              </span>
              <span className="mt-0.5 block truncate text-[8.5px] leading-tight text-[#8A99A8]">
                {item.hint}
              </span>
            </span>
            <ChevronRight
              size={13}
              aria-hidden
              className="shrink-0 text-[#B3C0CC] transition group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
            />
          </button>
        );
      })}
    </RevealOnScroll>
  );
}

/* ------------------------------------------------------------------ */
/* Category tabs                                                       */
/* ------------------------------------------------------------------ */

const TABS: { key: MedicalTab; label: string }[] = [
  { key: "overview", label: "All Records" },
  { key: "visits", label: "Visits" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "lab-results", label: "Lab Results" },
  { key: "imaging", label: "Imaging" },
  { key: "documents", label: "Documents" },
  { key: "reports", label: "Medical Reports" },
];

export function MedicalRecordsTabs({
  active,
  counts,
  onSelect,
}: {
  active: MedicalTab;
  counts: MedicalCounts;
  onSelect: (tab: MedicalTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Medical record categories"
      className="flex gap-1 overflow-x-auto rounded-xl border border-[#E6EFEE] bg-white p-1.5 shadow-[0_8px_22px_-24px_rgba(15,45,74,0.35)]"
    >
      {TABS.map((tab) => {
        const selected = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab.key)}
            className={cn(
              "relative shrink-0 rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold transition-colors sm:px-3",
              selected
                ? "bg-[#F0FCFA] text-[#0A9189]"
                : "text-[#5B6B7C] hover:bg-[#F7FAFA] hover:text-[#0F2D4A]",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1 text-[9px] font-semibold",
                selected ? "text-[#0A9189]/80" : "text-[#9AA9B8]",
              )}
            >
              ({counts[tab.key]})
            </span>
            {selected && (
              <span className="absolute inset-x-2 -bottom-[7px] h-[2px] rounded-full bg-[#0A9189]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

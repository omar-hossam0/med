"use client";

import {
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Pill,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { RecordType } from "@/lib/mock/medicalRecords";
import { cn } from "@/lib/cn";

export const CATEGORY_LABELS: Record<RecordType, string> = {
  visit: "Visit",
  prescription: "Prescription",
  lab: "Lab Result",
  imaging: "Imaging",
  document: "Document",
  report: "Medical Report",
};

const CATEGORY_ICONS: Record<RecordType, LucideIcon> = {
  visit: Stethoscope,
  prescription: Pill,
  lab: FlaskConical,
  imaging: ImageIcon,
  document: FileText,
  report: ClipboardList,
};

const CATEGORY_STYLES: Record<RecordType, string> = {
  visit: "bg-[#EFF4FF] text-[#2563EB]",
  prescription: "bg-[#F3EEFF] text-[#7C3AED]",
  lab: "bg-[#FFF6E5] text-[#C77A0A]",
  imaging: "bg-[#FFE9EE] text-[#E5486B]",
  document: "bg-[#F1F5F9] text-[#5B6B7C]",
  report: "bg-[#E7FBF8] text-[#0A9189]",
};

const ICON_STYLES: Record<RecordType, string> = {
  visit: "bg-[#E7FBF8] text-[#0A9189]",
  prescription: "bg-[#FFF6E5] text-[#D98A0B]",
  lab: "bg-[#F3EEFF] text-[#8B5CF6]",
  imaging: "bg-[#FFE9EE] text-[#E5486B]",
  document: "bg-[#EFF4FF] text-[#3B6EF6]",
  report: "bg-[#EFF4FF] text-[#2563EB]",
};

export function RecordTypeIcon({
  type,
  size = "md",
  className,
}: {
  type: RecordType;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[type];
  const box =
    size === "lg" ? "h-12 w-12 rounded-xl" : size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  const icon = size === "lg" ? 22 : size === "sm" ? 14 : 18;

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        box,
        ICON_STYLES[type],
        className,
      )}
    >
      <Icon size={icon} strokeWidth={2} />
    </span>
  );
}

export function CategoryBadge({
  type,
  className,
}: {
  type: RecordType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[9.5px] font-semibold leading-none",
        CATEGORY_STYLES[type],
        className,
      )}
    >
      {CATEGORY_LABELS[type]}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Completed: "bg-[#E9F9EF] text-[#1E9E56]",
  Scheduled: "bg-[#EFF4FF] text-[#2563EB]",
  Upcoming: "bg-[#E7FBF8] text-[#0A9189]",
  Cancelled: "bg-[#FFE9EE] text-[#E5486B]",
  Pending: "bg-[#FFF6E5] text-[#C77A0A]",
  Active: "bg-[#E7FBF8] text-[#0A9189]",
  Normal: "bg-[#E9F9EF] text-[#1E9E56]",
  Abnormal: "bg-[#FFE9EE] text-[#E5486B]",
  Recorded: "bg-[#EFF4FF] text-[#2563EB]",
  "Patient Uploaded": "bg-[#EFF4FF] text-[#2563EB]",
  "Clinically Reviewed": "bg-[#F3EEFF] text-[#7C3AED]",
  "Awaiting Review": "bg-[#FFF6E5] text-[#C77A0A]",
  Draft: "bg-[#F1F5F9] text-[#5B6B7C]",
  Reviewed: "bg-[#E7FBF8] text-[#0A9189]",
};

export function RecordStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[9.5px] font-semibold leading-none",
        STATUS_STYLES[status] ?? "bg-[#F1F5F9] text-[#5B6B7C]",
        className,
      )}
    >
      {status}
    </span>
  );
}

export function CategoryCountBadge({ count }: { count: number }) {
  return (
    <span className="ml-1 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#F1F7F7] px-1 text-[9px] font-semibold text-[#5B6B7C]">
      {count}
    </span>
  );
}

export function SourceBadge({ source }: { source: "patient" | "clinician" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold",
        source === "patient"
          ? "bg-[#EFF4FF] text-[#2563EB]"
          : "bg-[#F3EEFF] text-[#7C3AED]",
      )}
    >
      {source === "patient" ? "Uploaded by you" : "Shared by care team"}
    </span>
  );
}

export function CalendarIcon() {
  return <CalendarDays size={13} aria-hidden />;
}

"use client";

import {
  Bell,
  CalendarClock,
  ChevronRight,
  Download,
  Pill,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { formatTime12h, type ScheduleSlot } from "@/lib/mock/prescriptions";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */

type QuickAction = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  onClick: () => void;
};

export function QuickActionsPanel({
  onDownload,
  onSchedule,
  onReminders,
  onRelatedVisit,
}: {
  onDownload: () => void;
  onSchedule: () => void;
  onReminders: () => void;
  onRelatedVisit: () => void;
}) {
  const actions: QuickAction[] = [
    {
      key: "download",
      label: "Download Prescription",
      hint: "Download a copy of your prescription",
      icon: Download,
      tone: "bg-[#E7FBF8] text-[#0A9189]",
      onClick: onDownload,
    },
    {
      key: "schedule",
      label: "View Medication Schedule",
      hint: "Check your daily medication times",
      icon: CalendarClock,
      tone: "bg-[#EFF4FF] text-[#2563EB]",
      onClick: onSchedule,
    },
    {
      key: "reminders",
      label: "Set Medication Reminders",
      hint: "Get reminded when it's time to take",
      icon: Bell,
      tone: "bg-[#FFF6E5] text-[#D98A0B]",
      onClick: onReminders,
    },
    {
      key: "visit",
      label: "View Related Visit",
      hint: "See the appointment details",
      icon: Stethoscope,
      tone: "bg-[#F3EEFF] text-[#8B5CF6]",
      onClick: onRelatedVisit,
    },
  ];

  return (
    <section className="rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
      <h2 className="text-[11px] font-semibold text-[#0F2D4A]">Quick Actions</h2>
      <ul className="mt-2 space-y-0.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.key}>
              <button
                type="button"
                onClick={action.onClick}
                className="group flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-[#F7FCFB]"
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", action.tone)}>
                  <Icon size={13} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-semibold text-[#0F2D4A]">
                    {action.label}
                  </span>
                  <span className="block truncate text-[9px] text-[#8A9AAA]">{action.hint}</span>
                </span>
                <ChevronRight
                  size={13}
                  aria-hidden
                  className="shrink-0 text-[#C3CFDA] transition group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Today's medications                                                 */
/* ------------------------------------------------------------------ */

export function TodaysMedicationsPanel({
  slots,
  onOpenMedication,
  onViewAll,
}: {
  slots: ScheduleSlot[];
  onOpenMedication: (medicationId: string) => void;
  onViewAll: () => void;
}) {
  // One row per medication; its recorded times are shown together.
  const grouped = slots.reduce<{ medication: ScheduleSlot["medication"]; times: string[] }[]>(
    (rows, slot) => {
      const existing = rows.find((row) => row.medication.id === slot.medication.id);
      if (existing) existing.times.push(slot.time);
      else rows.push({ medication: slot.medication, times: [slot.time] });
      return rows;
    },
    [],
  );

  return (
    <section className="rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold text-[#0F2D4A]">Today&apos;s Medications</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-[9.5px] font-semibold text-[#0A9189] transition hover:text-[#088078]"
        >
          View All
        </button>
      </div>

      {grouped.length === 0 ? (
        <p className="py-4 text-center text-[9.5px] text-[#8A9AAA]">
          No medication times recorded for today.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {grouped.slice(0, 4).map((row) => (
            <li key={row.medication.id}>
              <button
                type="button"
                onClick={() => onOpenMedication(row.medication.id)}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-[#F7FCFB]"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#F3EEFF] text-[#8B5CF6]">
                  <Pill size={11} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-semibold text-[#0F2D4A]">
                    {row.medication.name}
                  </span>
                  <span className="block truncate text-[8.5px] text-[#8A9AAA]">
                    {row.medication.dosage}
                  </span>
                </span>
                <span className="shrink-0 text-[8.5px] font-medium text-[#5B6B7C]">
                  {row.times.map(formatTime12h).join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[8.5px] leading-relaxed text-[#9AA9B8]">
        Times come from your recorded prescriptions. Medora does not track whether a dose was
        taken.
      </p>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { DoctorStatusBadge } from "@/components/doctor/overview/OverviewSections";
import { formatShortDate, todayISO } from "@/lib/mock/doctorSchedule";
import type { DoctorAppointmentStatus } from "@/lib/mock/doctorPortal";

export type ScheduleFilters = {
  visitTypes: string[];
  statuses: DoctorAppointmentStatus[];
};

export const EMPTY_FILTERS: ScheduleFilters = { visitTypes: [], statuses: [] };

export function filterCount(filters: ScheduleFilters, date: string): number {
  const applied = filters.visitTypes.length + filters.statuses.length;
  // The date chip is shown alongside the others, so it is counted with them.
  const showDate = applied > 0 || date !== todayISO();
  return applied + (showDate ? 1 : 0);
}

/** Search field + Filters trigger, above the appointment tabs. */
export function ScheduleToolbar({
  search,
  onSearch,
  filters,
  selectedDate,
  open,
  onTogglePanel,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: ScheduleFilters;
  selectedDate: string;
  open: boolean;
  onTogglePanel: () => void;
}) {
  const count = filterCount(filters, selectedDate);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8CA0]"
        />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search for patients, MRN, or appointment notes..."
          aria-label="Search appointments"
          className="h-10 w-full rounded-full border border-[#E6EFEE] bg-white pl-10 pr-9 text-[11.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#A8B6C4] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[#7A8CA0] transition hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
          >
            <X size={13} />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onTogglePanel}
        aria-expanded={open}
        className={cn(
          "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[11.5px] font-semibold transition",
          open || count > 0
            ? "bg-[#0A9189] text-white shadow-[0_12px_24px_-16px_rgba(10,145,137,0.9)] hover:bg-[#087F78]"
            : "border border-[#E6EFEE] bg-white text-[#0F2D4A] hover:border-[#BFE8E2] hover:text-[#0A9189]",
        )}
      >
        <SlidersHorizontal size={14} aria-hidden />
        Filters{count > 0 ? ` (${count})` : ""}
      </button>
    </div>
  );
}

/** Active filter chips, mirroring the approved Search & Filters state. */
export function ActiveFilterChips({
  filters,
  selectedDate,
  onRemoveVisitType,
  onRemoveStatus,
  onResetDate,
  onClearAll,
}: {
  filters: ScheduleFilters;
  selectedDate: string;
  onRemoveVisitType: (value: string) => void;
  onRemoveStatus: (value: DoctorAppointmentStatus) => void;
  onResetDate: () => void;
  onClearAll: () => void;
}) {
  const hasFilters = filters.visitTypes.length > 0 || filters.statuses.length > 0;
  const showDate = hasFilters || selectedDate !== todayISO();
  if (!hasFilters && !showDate) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.visitTypes.map((value) => (
        <Chip key={value} label={`Visit Type: ${value}`} onRemove={() => onRemoveVisitType(value)} />
      ))}
      {filters.statuses.map((value) => (
        <Chip key={value} label={`Status: ${value}`} onRemove={() => onRemoveStatus(value)} />
      ))}
      {showDate ? (
        <Chip
          label={`Date: ${formatShortDate(selectedDate)}`}
          icon={<CalendarDays size={12} aria-hidden />}
          onRemove={onResetDate}
        />
      ) : null}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-auto rounded-full border border-[#E6EFEE] px-3 py-1.5 text-[10.5px] font-semibold text-[#0F2D4A] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
      >
        Clear All
      </button>
    </div>
  );
}

function Chip({
  label,
  icon,
  onRemove,
}: {
  label: string;
  icon?: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAFBF7] px-2.5 py-1.5 text-[10.5px] font-medium text-[#0A9189]">
      {icon}
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="grid h-4 w-4 place-items-center rounded-full transition hover:bg-[#D3F3EC]"
      >
        <X size={10} />
      </button>
    </span>
  );
}

/** Filter panel (draft state, applied on submit). */
export function FilterPanel({
  open,
  filters,
  selectedDate,
  visitTypes,
  statuses,
  onApply,
  onClearAll,
  onClose,
}: {
  open: boolean;
  filters: ScheduleFilters;
  selectedDate: string;
  visitTypes: string[];
  statuses: DoctorAppointmentStatus[];
  onApply: (next: ScheduleFilters) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ScheduleFilters>(filters);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const toggleVisitType = (value: string) =>
    setDraft((current) => ({
      ...current,
      visitTypes: current.visitTypes.includes(value)
        ? current.visitTypes.filter((item) => item !== value)
        : [...current.visitTypes, value],
    }));

  const toggleStatus = (value: DoctorAppointmentStatus) =>
    setDraft((current) => ({
      ...current,
      statuses: current.statuses.includes(value)
        ? current.statuses.filter((item) => item !== value)
        : [...current.statuses, value],
    }));

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Filter appointments"
      className="absolute right-0 top-[calc(100%+8px)] z-30 w-[320px] rounded-2xl border border-[#E6EFEE] bg-white p-3.5 shadow-[0_24px_60px_-30px_rgba(15,45,74,0.45)]"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-semibold text-[#0F2D4A]">Filters</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="grid h-6 w-6 place-items-center rounded-lg text-[#7A8CA0] transition hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
        >
          <X size={13} />
        </button>
      </div>

      <div className="mt-3">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">Date</p>
        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#E6EFEE] px-2.5 py-1.5 text-[10.5px] font-medium text-[#33475B]">
          <CalendarDays size={12} aria-hidden className="text-[#0A9189]" />
          {formatShortDate(selectedDate)}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">
          Visit Type
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {visitTypes.map((value) => (
            <Toggle
              key={value}
              active={draft.visitTypes.includes(value)}
              onClick={() => toggleVisitType(value)}
              label={value}
            />
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">
          Status
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {statuses.map((value) => (
            <Toggle
              key={value}
              active={draft.statuses.includes(value)}
              onClick={() => toggleStatus(value)}
              label={value}
              badge={<DoctorStatusBadge status={value} />}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(EMPTY_FILTERS);
            onClearAll();
          }}
          className="h-9 flex-1 rounded-xl border border-[#E6EFEE] bg-white text-[10.5px] font-semibold text-[#0F2D4A] transition hover:bg-[#F8FCFB]"
        >
          Clear All
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
          className="h-9 flex-1 rounded-xl bg-[#0A9189] text-[10.5px] font-semibold text-white transition hover:bg-[#087F78]"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1.5 text-[10.5px] font-medium transition",
        active
          ? "border-[#0A9189] bg-[#EAFBF7] text-[#0A9189]"
          : "border-[#E6EFEE] bg-white text-[#5B6B7C] hover:border-[#BFE8E2] hover:text-[#0F2D4A]",
      )}
    >
      {badge ?? label}
    </button>
  );
}

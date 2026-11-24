"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search, SlidersHorizontal, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  AGE_MAX,
  AGE_MIN,
  CONDITION_GROUPS,
  EMPTY_PATIENT_FILTERS,
  patientFilterCount,
  type ConditionGroup,
  type PatientFilters,
} from "@/lib/mock/doctorPatients";

/** Search field, Filters trigger and the Add Patient affordance. */
export function PatientsToolbar({
  search,
  onSearch,
  filters,
  panelOpen,
  onTogglePanel,
  onAddPatient,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: PatientFilters;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onAddPatient: () => void;
}) {
  const count = patientFilterCount(filters);

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
          placeholder="Search for patients by name, MRN, phone, or condition..."
          aria-label="Search patients"
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[11.5px] font-semibold transition",
            panelOpen || count > 0
              ? "bg-[#0A9189] text-white shadow-[0_12px_24px_-16px_rgba(10,145,137,0.9)] hover:bg-[#087F78]"
              : "border border-[#E6EFEE] bg-white text-[#0F2D4A] hover:border-[#BFE8E2] hover:text-[#0A9189]",
          )}
        >
          <SlidersHorizontal size={14} aria-hidden />
          Filters{count > 0 ? ` (${count})` : ""}
        </button>

        <button
          type="button"
          onClick={onAddPatient}
          title="Patient registration is handled by the reception desk"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0A9189] px-4 text-[11.5px] font-semibold text-white shadow-[0_12px_24px_-16px_rgba(10,145,137,0.9)] transition hover:bg-[#087F78]"
        >
          <UserPlus size={14} aria-hidden />
          Add Patient
        </button>
      </div>
    </div>
  );
}

/** Active filter chips, mirroring the approved Search & Filters state. */
export function PatientFilterChips({
  filters,
  onRemoveCondition,
  onRemoveAge,
  onRemoveGender,
  onClearAll,
}: {
  filters: PatientFilters;
  onRemoveCondition: (value: ConditionGroup) => void;
  onRemoveAge: () => void;
  onRemoveGender: () => void;
  onClearAll: () => void;
}) {
  const ageActive = filters.ageMin !== AGE_MIN || filters.ageMax !== AGE_MAX;
  if (patientFilterCount(filters) === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.conditions.map((value) => (
        <Chip key={value} label={`Condition: ${value}`} onRemove={() => onRemoveCondition(value)} />
      ))}
      {ageActive ? (
        <Chip label={`Age: ${filters.ageMin} – ${filters.ageMax}`} onRemove={onRemoveAge} />
      ) : null}
      {filters.gender !== "All" ? (
        <Chip label={`Gender: ${filters.gender}`} onRemove={onRemoveGender} />
      ) : null}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-auto rounded-full border border-[#E6EFEE] bg-white px-3 py-1.5 text-[10.5px] font-semibold text-[#0F2D4A] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
      >
        Clear All
      </button>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAFBF7] px-2.5 py-1.5 text-[10.5px] font-medium text-[#0A9189]">
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

/** The Filter Patients panel (draft state, applied on submit). */
export function PatientFilterPanel({
  open,
  filters,
  onApply,
  onClearAll,
  onClose,
}: {
  open: boolean;
  filters: PatientFilters;
  onApply: (next: PatientFilters) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PatientFilters>(filters);
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

  const toggleCondition = (value: ConditionGroup) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.includes(value)
        ? current.conditions.filter((item) => item !== value)
        : [...current.conditions, value],
    }));

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Filter patients"
      className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[calc(100vh-140px)] w-[290px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-2xl border border-[#E6EFEE] bg-white p-3.5 shadow-[0_24px_60px_-30px_rgba(15,45,74,0.45)]"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-semibold text-[#0F2D4A]">Filter Patients</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="grid h-6 w-6 place-items-center rounded-lg text-[#7A8CA0] transition hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
        >
          <X size={13} />
        </button>
      </div>

      <div className="mt-3.5">
        <p className="text-[10px] font-semibold text-[#33475B]">Primary Condition</p>
        <div className="mt-2 space-y-1.5">
          {CONDITION_GROUPS.map((group) => {
            const checked = draft.conditions.includes(group);
            return (
              <label
                key={group}
                className="flex cursor-pointer items-center gap-2 text-[11px] text-[#33475B]"
              >
                <span
                  className={cn(
                    "grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border transition",
                    checked
                      ? "border-[#0A9189] bg-[#0A9189] text-white"
                      : "border-[#D5E3E2] bg-white text-transparent",
                  )}
                >
                  <Check size={10} aria-hidden strokeWidth={3} />
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCondition(group)}
                  aria-label={`Filter by ${group}`}
                  className="sr-only"
                />
                {group}
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[#33475B]">Age Range</p>
          <span className="rounded-full bg-[#EAFBF7] px-2.5 py-1 text-[10px] font-semibold text-[#0A9189]">
            {draft.ageMin} – {draft.ageMax} years
          </span>
        </div>
        <AgeRange
          min={draft.ageMin}
          max={draft.ageMax}
          onChange={(ageMin, ageMax) => setDraft((current) => ({ ...current, ageMin, ageMax }))}
        />
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold text-[#33475B]">Gender</p>
        <div className="mt-2 flex items-center gap-3">
          {(["All", "Male", "Female"] as const).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#33475B]"
            >
              <span
                className={cn(
                  "grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border transition",
                  draft.gender === value
                    ? "border-[#0A9189] bg-[#0A9189] text-white"
                    : "border-[#D5E3E2] bg-white text-transparent",
                )}
              >
                <Check size={9} aria-hidden strokeWidth={4} />
              </span>
              <input
                type="radio"
                name="patient-gender"
                checked={draft.gender === value}
                onChange={() => setDraft((current) => ({ ...current, gender: value }))}
                aria-label={`Filter by ${value}`}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(EMPTY_PATIENT_FILTERS);
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

/**
 * Two-thumb age slider.
 *
 * Both thumbs are native range inputs stacked over a shared track: the track is
 * pointer-transparent and only the thumbs accept pointer events, so either end
 * can be dragged without one input swallowing the other.
 */
function AgeRange({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const span = AGE_MAX - AGE_MIN;
  const left = ((min - AGE_MIN) / span) * 100;
  const right = 100 - ((max - AGE_MIN) / span) * 100;

  const thumb =
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-[15px] [&::-webkit-slider-thumb]:w-[15px] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#0A9189] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(15,45,74,0.25)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-[15px] [&::-moz-range-thumb]:w-[15px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[#0A9189] [&::-moz-range-thumb]:bg-white";

  return (
    <div className="relative mt-3.5 h-4">
      <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#E6EFEE]" />
      <span
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#0A9189]"
        style={{ left: `${left}%`, right: `${right}%` }}
      />
      <input
        type="range"
        min={AGE_MIN}
        max={AGE_MAX}
        value={min}
        aria-label="Minimum age"
        onChange={(event) => onChange(Math.min(Number(event.target.value), max - 1), max)}
        className={cn("pointer-events-none absolute inset-0 w-full appearance-none bg-transparent", thumb)}
      />
      <input
        type="range"
        min={AGE_MIN}
        max={AGE_MAX}
        value={max}
        aria-label="Maximum age"
        onChange={(event) => onChange(min, Math.max(Number(event.target.value), min + 1))}
        className={cn("pointer-events-none absolute inset-0 w-full appearance-none bg-transparent", thumb)}
      />
    </div>
  );
}

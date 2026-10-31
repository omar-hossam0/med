"use client";

import { ChevronRight, Pill, Search, SlidersHorizontal, X } from "lucide-react";
import {
  STATUS_FILTER_LABEL,
  formatPrescriptionDate,
  getPrescriptionMeta,
  type DateRangeFilter,
  type Medication,
  type PrescriptionRecord,
  type PrescriptionStatus,
  type MedicationStatus,
} from "@/lib/mock/prescriptions";
import { medicalDoctors } from "@/lib/mock/medicalRecords";
import { StatusBadge } from "./PrescriptionsChrome";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export type PrescriptionFilters = {
  search: string;
  status: "all" | PrescriptionStatus | MedicationStatus;
  doctorId: string;
  dateRange: DateRangeFilter;
  prescriptionId: string;
};

export const EMPTY_PRESCRIPTION_FILTERS: PrescriptionFilters = {
  search: "",
  status: "all",
  doctorId: "all",
  dateRange: "any",
  prescriptionId: "all",
};

const DATE_OPTIONS: { value: DateRangeFilter; label: string }[] = [
  { value: "any", label: "Date" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const selectClass =
  "h-8 shrink-0 rounded-lg border border-[#E6EFEE] bg-white px-2 pr-6 text-[10.5px] font-medium text-[#5B6B7C] outline-none transition focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15";

export function PrescriptionFilterBar({
  mode,
  filters,
  onChange,
  prescriptions,
  resultCount,
}: {
  mode: "prescriptions" | "medications" | "history";
  filters: PrescriptionFilters;
  onChange: (next: PrescriptionFilters) => void;
  prescriptions: PrescriptionRecord[];
  resultCount: number;
}) {
  const set = <K extends keyof PrescriptionFilters>(key: K, value: PrescriptionFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const isFiltered =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.doctorId !== "all" ||
    filters.dateRange !== "any" ||
    filters.prescriptionId !== "all";

  const reset = () => onChange({ ...EMPTY_PRESCRIPTION_FILTERS });

  const searchPlaceholder =
    mode === "medications"
      ? "Search medications…"
      : "Search prescriptions, medications, or doctors…";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search</span>
          <Search
            size={13}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
          />
          <input
            value={filters.search}
            onChange={(event) => set("search", event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white pl-8 pr-8 text-[10.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
          />
          {filters.search ? (
            <button
              type="button"
              onClick={() => set("search", "")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[#9AA9B8] hover:bg-[#F1F6F6] hover:text-[#0F2D4A]"
            >
              <X size={11} aria-hidden />
            </button>
          ) : null}
        </label>

        <label className="sr-only" htmlFor="rx-status-filter">
          Filter by status
        </label>
        <select
          id="rx-status-filter"
          value={filters.status}
          onChange={(event) => set("status", event.target.value as PrescriptionFilters["status"])}
          className={selectClass}
        >
          <option value="all">{STATUS_FILTER_LABEL.all}</option>
          <option value="Active">{STATUS_FILTER_LABEL.Active}</option>
          <option value="Completed">{STATUS_FILTER_LABEL.Completed}</option>
          <option value="Expired">{STATUS_FILTER_LABEL.Expired}</option>
        </select>

        {mode === "medications" ? (
          <>
            <label className="sr-only" htmlFor="rx-source-filter">
              Filter by prescription
            </label>
            <select
              id="rx-source-filter"
              value={filters.prescriptionId}
              onChange={(event) => set("prescriptionId", event.target.value)}
              className={cn(selectClass, "max-w-[190px]")}
            >
              <option value="all">All Prescriptions</option>
              {prescriptions.map((prescription) => (
                <option key={prescription.id} value={prescription.id}>
                  {prescription.title}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label className="sr-only" htmlFor="rx-doctor-filter">
              Filter by doctor
            </label>
            <select
              id="rx-doctor-filter"
              value={filters.doctorId}
              onChange={(event) => set("doctorId", event.target.value)}
              className={cn(selectClass, "max-w-[160px]")}
            >
              <option value="all">All Doctors</option>
              {medicalDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="rx-date-filter">
              Filter by date
            </label>
            <select
              id="rx-date-filter"
              value={filters.dateRange}
              onChange={(event) => set("dateRange", event.target.value as DateRangeFilter)}
              className={selectClass}
            >
              {DATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        )}

        {isFiltered ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#E6EFEE] bg-white px-2 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
          >
            <SlidersHorizontal size={12} aria-hidden />
            Reset
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="text-[9.5px] text-[#8A9AAA]">
        {resultCount === 0 ? "No matches" : `${resultCount} result${resultCount === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prescription row                                                    */
/* ------------------------------------------------------------------ */

export function PrescriptionRow({
  prescription,
  onOpen,
}: {
  prescription: PrescriptionRecord;
  onOpen: (id: string) => void;
}) {
  const { doctor, facility, specialty } = getPrescriptionMeta(prescription);

  return (
    <button
      type="button"
      onClick={() => onOpen(prescription.id)}
      className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-[#F7FCFB] focus-visible:bg-[#F7FCFB] focus-visible:outline-none"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E7FBF8] text-[#0A9189]">
        <Pill size={14} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold text-[#0F2D4A]">
          {prescription.title}
        </span>
        <span className="block truncate text-[9.5px] text-[#7187A6]">
          {doctor?.name ?? "Medora care team"} · {facility} · {specialty}
        </span>
      </span>

      <span className="hidden shrink-0 text-[9.5px] text-[#8A9AAA] sm:block">
        {formatPrescriptionDate(prescription.date)}
      </span>

      <StatusBadge status={prescription.status} />

      <ChevronRight
        size={14}
        aria-hidden
        className="shrink-0 text-[#C3CFDA] transition group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Medication row                                                      */
/* ------------------------------------------------------------------ */

export function MedicationRow({
  medication,
  prescription,
  onOpen,
}: {
  medication: Medication;
  prescription?: PrescriptionRecord;
  onOpen: (medicationId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(medication.id)}
      className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-[#F7FCFB] focus-visible:bg-[#F7FCFB] focus-visible:outline-none"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F3EEFF] text-[#8B5CF6]">
        <Pill size={14} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[11.5px] font-semibold text-[#0F2D4A]">
            {medication.name}
          </span>
          {medication.selfReported ? (
            <span className="shrink-0 rounded-full border border-[#E4E9F2] bg-[#F4F7FB] px-1.5 py-[1px] text-[8.5px] font-semibold text-[#5B6B7C]">
              Self-reported
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[9.5px] text-[#7187A6]">
          {medication.frequency} · {medication.duration}
        </span>
        {prescription ? (
          <span className="block truncate text-[9px] text-[#9AA9B8]">
            From: {prescription.title}
          </span>
        ) : null}
      </span>

      <StatusBadge status={medication.status} />

      <ChevronRight
        size={14}
        aria-hidden
        className="shrink-0 text-[#C3CFDA] transition group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* List shell                                                          */
/* ------------------------------------------------------------------ */

export function PrescriptionListShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[#F0F5F5] overflow-hidden rounded-xl border border-[#EDF3F3] bg-white">
      {children}
    </div>
  );
}

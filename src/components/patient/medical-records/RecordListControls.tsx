"use client";

import { useId } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type SortOrder = "newest" | "oldest";

export type DateRange = "any" | "30" | "90" | "year";

export type RecordFilters = {
  range: DateRange;
  status: string;
};

export const EMPTY_RECORD_FILTERS: RecordFilters = {
  range: "any",
  status: "all",
};

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

export function activeFilterCount(filters: RecordFilters): number {
  return (filters.range !== "any" ? 1 : 0) + (filters.status !== "all" ? 1 : 0);
}

export function RecordListControls({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  panelOpen,
  onPanelOpenChange,
  statusOptions,
  placeholder = "Search records, doctors, or documents...",
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filters: RecordFilters;
  onFiltersChange: (next: RecordFilters) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  statusOptions: string[];
  placeholder?: string;
}) {
  const panelId = useId();
  const count = activeFilterCount(filters);

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-9 w-full rounded-lg border border-[#E6EFEE] bg-[#FBFDFD] pl-9 pr-8 text-[10.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189]/40 focus:bg-white focus:ring-4 focus:ring-[#0A9189]/10"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[#9AA9B8] transition hover:bg-[#F1F7F7] hover:text-[#0F2D4A]"
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onPanelOpenChange(!panelOpen)}
          aria-expanded={panelOpen}
          aria-controls={panelId}
          aria-label="Filter medical records"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[10.5px] font-semibold transition",
            panelOpen || count > 0
              ? "border-[#BFE8E2] bg-[#F0FCFA] text-[#0A9189]"
              : "border-[#E6EFEE] bg-white text-[#5B6B7C] hover:border-[#BFE8E2] hover:text-[#0A9189]",
          )}
        >
          <SlidersHorizontal size={14} aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {count > 0 && (
            <span className="grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#0A9189] px-1 text-[8.5px] font-bold text-white">
              {count}
            </span>
          )}
        </button>
      </div>

      {panelOpen && (
        <div
          id={panelId}
          className="mt-2 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8A99A8]">
                Date range
              </span>
              <select
                value={filters.range}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    range: event.target.value as DateRange,
                  })
                }
                className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[10.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8A99A8]">
                Status
              </span>
              <select
                value={filters.status}
                onChange={(event) =>
                  onFiltersChange({ ...filters, status: event.target.value })
                }
                className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[10.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 border-t border-[#EDF3F3] pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[8.5px] leading-relaxed text-[#9AA9B8]">
              Only records available to your patient account are searched.
            </p>
            <button
              type="button"
              onClick={() => onFiltersChange(EMPTY_RECORD_FILTERS)}
              className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#E6EFEE] px-2.5 text-[9.5px] font-semibold text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
            >
              <RotateCcw size={11} aria-hidden />
              Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SortSelect({
  value,
  onChange,
}: {
  value: SortOrder;
  onChange: (value: SortOrder) => void;
}) {
  return (
    <label className="inline-flex shrink-0 items-center gap-1 text-[9.5px] text-[#8A99A8]">
      <span className="sr-only">Sort records</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortOrder)}
        className="h-8 rounded-lg border border-[#E6EFEE] bg-white px-2 text-[10px] font-semibold text-[#33475B] outline-none transition focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
      </select>
    </label>
  );
}

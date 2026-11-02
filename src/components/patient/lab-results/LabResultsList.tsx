"use client";

import { ChevronRight, FlaskConical, Search, X } from "lucide-react";
import {
  LAB_STATUS_LABEL,
  formatLabDate,
  type LabResult,
  type LabStatusFilter,
} from "@/lib/mock/labResults";
import { LabStatusBadge } from "./LabResultsChrome";
import { cn } from "@/lib/cn";

export function LabResultsFilterBar({
  search,
  onSearch,
  status,
  onStatus,
  resultCount,
}: {
  search: string;
  onSearch: (value: string) => void;
  status: LabStatusFilter;
  onStatus: (value: LabStatusFilter) => void;
  resultCount: number;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search lab tests</span>
        <Search
          size={13}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
        />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search for a test (e.g. CBC, Glucose...)"
          className="h-9 w-full rounded-xl border border-[#E6EFEE] bg-white pl-9 pr-8 text-[10.5px] text-[#0F2D4A] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#9AA9B8] hover:border-[#CFE3E0] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[#9AA9B8] transition-colors duration-150 hover:bg-[#F1F6F6] hover:text-[#0F2D4A]"
          >
            <X size={11} aria-hidden />
          </button>
        ) : null}
      </label>

      <label className="sm:w-[136px]">
        <span className="sr-only">Filter by status</span>
        <select
          value={status}
          onChange={(event) => onStatus(event.target.value as LabStatusFilter)}
          className="h-9 w-full rounded-xl border border-[#E6EFEE] bg-white px-2.5 text-[10.5px] font-medium text-[#5B6B7C] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[#CFE3E0] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
        >
          {(Object.keys(LAB_STATUS_LABEL) as LabStatusFilter[]).map((key) => (
            <option key={key} value={key}>
              {LAB_STATUS_LABEL[key]}
            </option>
          ))}
        </select>
      </label>

      <p aria-live="polite" className="sr-only">
        {resultCount} result{resultCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function LabResultRow({
  lab,
  onOpen,
}: {
  lab: LabResult;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(lab.id)}
      className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[#F7FCFB] focus-visible:bg-[#F7FCFB] focus-visible:outline-none"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E7FBF8] text-[#0A9189] transition-transform duration-150 group-hover:scale-[1.04]">
        <FlaskConical size={14} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold text-[#0F2D4A]">
          {lab.name}
        </span>
        <span className="block truncate text-[9.5px] text-[#7187A6]">{formatLabDate(lab.date)}</span>
      </span>

      <LabStatusBadge status={lab.status} />

      <ChevronRight
        size={14}
        aria-hidden
        className="shrink-0 text-[#C3CFDA] transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
      />
    </button>
  );
}

export function LabResultsListShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[#F0F5F5] overflow-hidden rounded-xl border border-[#EDF3F3] bg-white">
      {children}
    </div>
  );
}

export function LabRowSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className={cn(
            "flex items-center gap-2.5 rounded-xl border border-[#F0F5F5] bg-white px-3 py-3",
          )}
        >
          <span className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-[#F1F6F6]" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-2.5 w-1/3 animate-pulse rounded bg-[#F1F6F6]" />
            <span className="block h-2 w-1/4 animate-pulse rounded bg-[#F6FAFA]" />
          </span>
          <span className="h-4 w-16 animate-pulse rounded-full bg-[#F1F6F6]" />
        </div>
      ))}
    </div>
  );
}

"use client";

import { ChevronRight, FileSearch } from "lucide-react";
import type { MedicalRecordEntry } from "@/lib/mock/medicalRecords";
import { formatRecordDate } from "@/lib/mock/medicalRecords";
import { CategoryBadge, RecordTypeIcon } from "./badges";
import {
  RecordListControls,
  SortSelect,
  type RecordFilters,
  type SortOrder,
} from "./RecordListControls";
import { EmptyState } from "./ui";
import { cn } from "@/lib/cn";

export function RecordList({
  entries,
  mode,
  selectedKey,
  onSelect,
  onOpen,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filters.",
  listMaxHeight,
}: {
  entries: MedicalRecordEntry[];
  mode: "preview" | "navigate";
  selectedKey?: string;
  onSelect?: (entry: MedicalRecordEntry) => void;
  onOpen: (entry: MedicalRecordEntry) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  listMaxHeight?: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ul
      className={cn("space-y-1", listMaxHeight ? "overflow-y-auto pr-0.5" : undefined)}
      style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
    >
      {entries.map((entry) => (
        <li key={entry.key}>
          <RecordListItem
            entry={entry}
            mode={mode}
            selected={selectedKey === entry.key}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        </li>
      ))}
    </ul>
  );
}

export function RecordListItem({
  entry,
  mode,
  selected,
  onSelect,
  onOpen,
}: {
  entry: MedicalRecordEntry;
  mode: "preview" | "navigate";
  selected?: boolean;
  onSelect?: (entry: MedicalRecordEntry) => void;
  onOpen: (entry: MedicalRecordEntry) => void;
}) {
  const content = (
    <>
      {selected && (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#0A9189]"
        />
      )}
      <RecordTypeIcon type={entry.type} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold leading-snug text-[#0F2D4A]">
          {entry.title}
        </span>
        <span className="mt-0.5 block truncate text-[9.5px] leading-snug text-[#7187A6]">
          {entry.subtitle}
        </span>
      </span>
      <CategoryBadge type={entry.type} className="hidden min-[420px]:inline-flex" />
      <span className="hidden w-[76px] shrink-0 text-right text-[9.5px] text-[#8A99A8] sm:block">
        {formatRecordDate(entry.date)}
      </span>
      {mode === "navigate" && (
        <ChevronRight
          size={14}
          aria-hidden
          className="shrink-0 text-[#B3C0CC] transition group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
        />
      )}
    </>
  );

  const base = cn(
    "group relative flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
    selected
      ? "border-[#CFE9E5] bg-[#F0FCFA]"
      : "border-transparent hover:border-[#E6EFEE] hover:bg-[#FBFDFD]",
  );

  if (mode === "navigate") {
    return (
      <button type="button" onClick={() => onOpen(entry)} className={base}>
        {content}
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Preview ${entry.title}`}
      onClick={() => onSelect?.(entry)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(entry);
        }
      }}
      className={cn(base, "cursor-pointer pr-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]")}
    >
      {content}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(entry);
        }}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label={`Open ${entry.title}`}
        className="absolute right-1.5 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#9AA9B8] transition hover:bg-white hover:text-[#0A9189]"
      >
        <ChevronRight size={14} aria-hidden />
      </button>
    </div>
  );
}

export function RecordListCard({
  title,
  entries,
  mode,
  selectedKey,
  onSelect,
  onOpen,
  sort,
  onSortChange,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  filterOpen,
  onFilterOpenChange,
  statusOptions,
  emptyTitle,
  emptyDescription,
  listMaxHeight,
  className,
}: {
  title: string;
  entries: MedicalRecordEntry[];
  mode: "preview" | "navigate";
  selectedKey?: string;
  onSelect?: (entry: MedicalRecordEntry) => void;
  onOpen: (entry: MedicalRecordEntry) => void;
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  query: string;
  onQueryChange: (value: string) => void;
  filters: RecordFilters;
  onFiltersChange: (next: RecordFilters) => void;
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  statusOptions: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  listMaxHeight?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-[#E6EFEE] bg-white shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#EEF4F4] px-3.5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-[#0F2D4A]">
            {title}
          </h2>
          <p className="mt-0.5 text-[9px] text-[#8A99A8]">
            {entries.length} {entries.length === 1 ? "record" : "records"}
          </p>
        </div>
        <SortSelect value={sort} onChange={onSortChange} />
      </div>

      <div className="px-3.5 pt-2.5">
        <RecordListControls
          query={query}
          onQueryChange={onQueryChange}
          filters={filters}
          onFiltersChange={onFiltersChange}
          panelOpen={filterOpen}
          onPanelOpenChange={onFilterOpenChange}
          statusOptions={statusOptions}
        />
      </div>

      <div className="min-h-0 flex-1 px-2 pb-2 pt-2">
        <RecordList
          entries={entries}
          mode={mode}
          selectedKey={selectedKey}
          onSelect={onSelect}
          onOpen={onOpen}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          listMaxHeight={listMaxHeight}
        />
      </div>
    </section>
  );
}

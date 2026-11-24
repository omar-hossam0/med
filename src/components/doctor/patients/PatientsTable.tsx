"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, Eye, FlaskConical, MoreVertical, UserRound } from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import { formatPortalDate } from "@/lib/mock/doctorPortal";
import type { PatientRecord } from "@/lib/mock/doctorPatients";
import { cn } from "@/lib/cn";

type TableProps = {
  records: PatientRecord[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
  onOpenFull: (id: string) => void;
  onReviewLabs: (id: string) => void;
  menuId: string | null;
  onMenuChange: (id: string | null) => void;
};

export function PatientsTable({
  records,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  onOpenFull,
  onReviewLabs,
  menuId,
  onMenuChange,
}: TableProps) {
  const allSelected = records.length > 0 && selected.length === records.length;

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[34px_minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_96px] items-center gap-2 border-b border-[#EDF3F3] px-3 py-2.5 text-[10px] font-semibold text-[#33475B]">
          <Checkbox checked={allSelected} onChange={onToggleAll} label="Select all patients" />
          <span>Patient</span>
          <span>Age / Gender</span>
          <span>Primary Condition</span>
          <span>Last Visit</span>
          <span className="text-right">Actions</span>
        </div>

        <ul className="divide-y divide-[#F2F7F7]">
          {records.map((record) => (
            <li
              key={record.patient.id}
              className="grid grid-cols-[34px_minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_96px] items-center gap-2 px-3 py-2.5 transition-colors duration-150 hover:bg-[#F9FDFC]"
            >
              <Checkbox
                checked={selected.includes(record.patient.id)}
                onChange={() => onToggle(record.patient.id)}
                label={`Select ${record.patient.name}`}
              />

              <button
                type="button"
                onClick={() => onOpen(record.patient.id)}
                className="flex min-w-0 items-center gap-2.5 text-left"
              >
                <Avatar name={record.patient.name} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-semibold text-[#0F2D4A]">
                    {record.patient.name}
                  </span>
                  <span className="block truncate text-[9.5px] text-[#8A9AAA]">
                    MRN: {record.patient.mrn}
                  </span>
                </span>
              </button>

              <span className="text-[10.5px] text-[#4A5C6E]">
                {record.patient.age} y · {record.patient.gender}
              </span>

              <span className="truncate text-[10.5px] text-[#4A5C6E]">
                {record.primaryCondition ?? <span className="text-[#A8B6C4]">Not recorded</span>}
              </span>

              <span className="text-[10.5px] text-[#4A5C6E]">
                {record.lastVisit ? formatPortalDate(record.lastVisit) : "—"}
              </span>

              <span className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onOpen(record.patient.id)}
                  className="inline-flex h-7 items-center rounded-full border border-[#0A9189] px-3 text-[10px] font-semibold text-[#0A9189] transition hover:bg-[#EAFBF7]"
                >
                  View
                </button>
                <RowMenu
                  open={menuId === record.patient.id}
                  onToggle={() =>
                    onMenuChange(menuId === record.patient.id ? null : record.patient.id)
                  }
                  onClose={() => onMenuChange(null)}
                  onOpenFull={() => {
                    onMenuChange(null);
                    onOpenFull(record.patient.id);
                  }}
                  onReviewLabs={() => {
                    onMenuChange(null);
                    onReviewLabs(record.patient.id);
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-[#F2F7F7] md:hidden">
        {records.map((record) => (
          <li key={record.patient.id} className="px-3 py-3">
            <div className="flex items-start gap-2.5">
              <Avatar name={record.patient.name} size={34} />
              <button
                type="button"
                onClick={() => onOpen(record.patient.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-[12px] font-semibold text-[#0F2D4A]">
                  {record.patient.name}
                </span>
                <span className="block truncate text-[9.5px] text-[#8A9AAA]">
                  MRN: {record.patient.mrn} · {record.patient.age} y · {record.patient.gender}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#4A5C6E]">
                  <span>{record.primaryCondition ?? "Condition not recorded"}</span>
                  <span aria-hidden className="text-[#C3CFDA]">·</span>
                  <span>{record.lastVisit ? formatPortalDate(record.lastVisit) : "No visit yet"}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpen(record.patient.id)}
                aria-label={`Open quick profile for ${record.patient.name}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#E6EFEE] text-[#0A9189]"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="grid cursor-pointer place-items-center">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          "grid h-[15px] w-[15px] place-items-center rounded-[4px] border transition",
          checked ? "border-[#0A9189] bg-[#0A9189]" : "border-[#D5E3E2] bg-white",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 10 8" className="h-[7px] w-[9px]" fill="none" aria-hidden>
            <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    </label>
  );
}

function RowMenu({
  open,
  onToggle,
  onClose,
  onOpenFull,
  onReviewLabs,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenFull: () => void;
  onReviewLabs: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More patient actions"
        className="grid h-7 w-7 place-items-center rounded-full text-[#5B6B7C] transition hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
      >
        <MoreVertical size={14} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-30 w-[176px] overflow-hidden rounded-xl border border-[#E6EFEE] bg-white p-1 shadow-[0_20px_44px_-24px_rgba(15,45,74,0.45)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onOpenFull}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10.5px] text-[#33475B] transition hover:bg-[#F5FAFA]"
          >
            <UserRound size={12} aria-hidden className="text-[#0A9189]" />
            Open full profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onReviewLabs}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10.5px] text-[#33475B] transition hover:bg-[#F5FAFA]"
          >
            <FlaskConical size={12} aria-hidden className="text-[#8B5CF6]" />
            Review lab results
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Empty state used when search or filters return nothing. */
export function PatientsEmptyState({
  onReset,
  message,
}: {
  onReset: () => void;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F1F7F6] text-[#7A8CA0]">
        <Eye size={18} aria-hidden />
      </span>
      <p className="text-[12px] font-semibold text-[#0F2D4A]">No patients found</p>
      <p className="max-w-[320px] text-[10.5px] leading-relaxed text-[#7A8CA0]">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-1 rounded-full border border-[#E6EFEE] px-3 py-1.5 text-[10.5px] font-semibold text-[#0F2D4A] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
      >
        Clear search and filters
      </button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, Check, Clock, Pill, Search, X } from "lucide-react";
import {
  formatPrescriptionDate,
  formatTime12h,
  getPrescriptionMeta,
  type PrescriptionRecord,
  type ScheduleSlot,
} from "@/lib/mock/prescriptions";
import { StatusBadge } from "./PrescriptionsChrome";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Modal shell                                                         */
/* ------------------------------------------------------------------ */

function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  width = "max-w-[440px]",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Stable handler: callers pass inline arrows, and re-running this effect on
  // every parent render would re-focus the close button mid-interaction.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 30);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#0F2D4A]/35"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rx-dialog-title"
        className={cn(
          "relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_80px_-40px_rgba(15,45,74,0.6)] sm:rounded-2xl",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#EDF3F3] px-4 py-3">
          <div className="min-w-0">
            <h2 id="rx-dialog-title" className="text-[12.5px] font-semibold text-[#0F2D4A]">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#7187A6]">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#5B6B7C] transition hover:bg-[#F1F6F6] hover:text-[#0F2D4A]"
          >
            <X size={15} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-[#EDF3F3] px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Prescription picker                                                 */
/* ------------------------------------------------------------------ */

/**
 * Quick Actions that need a specific record ask which one, instead of silently
 * acting on an arbitrary prescription.
 */
export function PrescriptionPickerDialog({
  title,
  description,
  prescriptions,
  emptyMessage,
  onSelect,
  onClose,
}: {
  title: string;
  description: string;
  prescriptions: PrescriptionRecord[];
  emptyMessage: string;
  onSelect: (prescription: PrescriptionRecord) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return prescriptions;
    return prescriptions.filter((prescription) => {
      const { doctor, facility, specialty } = getPrescriptionMeta(prescription);
      return [prescription.title, doctor?.name, facility, specialty]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [prescriptions, query]);

  return (
    <Modal title={title} description={description} onClose={onClose}>
      {prescriptions.length === 0 ? (
        <p className="py-6 text-center text-[10.5px] text-[#7187A6]">{emptyMessage}</p>
      ) : (
        <>
          <label className="relative block">
            <span className="sr-only">Search prescriptions</span>
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prescriptions…"
              className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white pl-8 pr-2 text-[10.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
            />
          </label>

          <ul className="mt-2 divide-y divide-[#F2F7F7] overflow-hidden rounded-xl border border-[#EDF3F3]">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-[10px] text-[#8A9AAA]">No matches</li>
            ) : (
              results.map((prescription) => {
                const { doctor } = getPrescriptionMeta(prescription);
                return (
                  <li key={prescription.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(prescription)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#F7FCFB]"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#E7FBF8] text-[#0A9189]">
                        <Pill size={13} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-[#0F2D4A]">
                          {prescription.title}
                        </span>
                        <span className="block truncate text-[9px] text-[#8A9AAA]">
                          {doctor?.name ?? "Medora care team"} ·{" "}
                          {formatPrescriptionDate(prescription.date)}
                        </span>
                      </span>
                      <StatusBadge status={prescription.status} />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Schedule / reminders dialog                                         */
/* ------------------------------------------------------------------ */

export function ScheduleDialog({
  mode,
  slots,
  reminderIds,
  onToggleReminder,
  onClose,
}: {
  mode: "schedule" | "reminders";
  slots: ScheduleSlot[];
  reminderIds: string[];
  onToggleReminder: (medicationId: string) => void;
  onClose: () => void;
}) {
  const isReminders = mode === "reminders";

  return (
    <Modal
      title={isReminders ? "Medication Reminders" : "Today's Medication Schedule"}
      description={
        isReminders
          ? "Reminders are a local demo. Medora has no reminder service yet, so nothing is scheduled on a server."
          : "Built from the recorded times on your active medications."
      }
      onClose={onClose}
      width="max-w-[480px]"
    >
      {slots.length === 0 ? (
        <p className="py-6 text-center text-[10.5px] text-[#7187A6]">
          No scheduled times are recorded for your active medications.
        </p>
      ) : (
        <ul className="divide-y divide-[#F2F7F7] overflow-hidden rounded-xl border border-[#EDF3F3]">
          {slots.map((slot) => {
            const on = reminderIds.includes(slot.medication.id);
            return (
              <li
                key={`${slot.medication.id}-${slot.time}`}
                className="flex items-center gap-2.5 px-3 py-2.5"
              >
                <span className="inline-flex w-[62px] shrink-0 items-center gap-1 text-[9.5px] font-semibold text-[#0A9189]">
                  <Clock size={11} aria-hidden />
                  {formatTime12h(slot.time)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-[#0F2D4A]">
                    {slot.medication.name}
                  </span>
                  <span className="block truncate text-[9px] text-[#8A9AAA]">
                    {slot.medication.dosage}
                  </span>
                </span>

                {isReminders ? (
                  <button
                    type="button"
                    onClick={() => onToggleReminder(slot.medication.id)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-semibold transition",
                      on
                        ? "border-[#0A9189] bg-[#0A9189] text-white"
                        : "border-[#E6EFEE] bg-white text-[#5B6B7C] hover:border-[#BFE8E2] hover:text-[#0A9189]",
                    )}
                  >
                    {on ? <Check size={10} aria-hidden /> : null}
                    {on ? "Set" : "Remind"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Add medication (patient-reported)                                   */
/* ------------------------------------------------------------------ */

const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "As needed",
  "Weekly",
];

export function AddMedicationDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (draft: {
    name: string;
    strength: string;
    dosage: string;
    frequency: string;
    startDate: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [frequency, setFrequency] = useState(FREQUENCY_OPTIONS[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const canSubmit = name.trim().length > 1;

  return (
    <Modal
      title="Add a medication"
      description="For medications you take that are not on a Medora prescription. These are marked self-reported and never shown as doctor-issued."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E6EFEE] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onAdd({
                name: name.trim(),
                strength: strength.trim(),
                dosage: strength.trim() ? `${strength.trim()}` : "As entered",
                frequency,
                startDate,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A9189] px-3 py-2 text-[10.5px] font-semibold text-white transition hover:bg-[#088078] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarPlus size={13} aria-hidden />
            Add medication
          </button>
        </>
      }
    >
      <div className="space-y-2.5">
        <Field label="Medication name" htmlFor="add-med-name">
          <input
            id="add-med-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Vitamin C 500 mg"
            className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[10.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
          />
        </Field>

        <Field label="Strength (optional)" htmlFor="add-med-strength">
          <input
            id="add-med-strength"
            value={strength}
            onChange={(event) => setStrength(event.target.value)}
            placeholder="e.g. 500 mg"
            className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[10.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Frequency" htmlFor="add-med-frequency">
            <select
              id="add-med-frequency"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white px-2 text-[10.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Started on" htmlFor="add-med-date">
            <input
              id="add-med-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white px-2 text-[10.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
            />
          </Field>
        </div>

        <p className="rounded-lg border border-[#FFF0D2] bg-[#FFF9EE] p-2.5 text-[9.5px] leading-relaxed text-[#8A5B0B]">
          Demo behaviour: the medication is kept in this page only and is not saved to your medical
          record. Medora has no endpoint for patient-reported medications yet.
        </p>
      </div>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[9.5px] font-semibold text-[#5B6B7C]">
        {label}
      </label>
      {children}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  BellRing,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  Info,
  Pill,
  Repeat,
  Stethoscope,
  Timer,
  X,
} from "lucide-react";
import {
  formatPrescriptionDate,
  formatTime12h,
  getMedication,
  getPrescriptionMeta,
  getPrescriptionRecord,
} from "@/lib/mock/prescriptions";
import { StatusBadge } from "./PrescriptionsChrome";
import { cn } from "@/lib/cn";

/**
 * Right-side medication drawer.
 *
 * An overlay, never a route: closing it returns to the exact same page, tab,
 * filters and scroll position because nothing underneath is unmounted.
 */
export function MedicationDrawer({
  medicationId,
  onClose,
  onViewPrescription,
  onToast,
}: {
  medicationId: string | null;
  onClose: () => void;
  onViewPrescription: (prescriptionId: string) => void;
  onToast: (message: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  // Callers pass an inline arrow, so the effect below must not depend on the
  // callback identity: a parent re-render would otherwise re-run it, steal
  // focus back to the close button and re-lock scrolling mid-interaction.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const open = Boolean(medicationId);
  const medication = getMedication(medicationId);
  const prescription = medication ? getPrescriptionRecord(medication.prescriptionId) : undefined;
  const meta = prescription ? getPrescriptionMeta(prescription) : undefined;

  useEffect(() => setMounted(true), []);

  // Reset the local reminder flag whenever a different medication is opened.
  useEffect(() => {
    setReminderSet(false);
  }, [medicationId]);

  // Mount -> next frame -> slide in, so the transition actually runs.
  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Body scroll lock + focus management.
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const restore = restoreFocusRef.current;
      if (restore instanceof HTMLElement) restore.focus();
    };
  }, [open]);

  const handleReminder = useCallback(() => {
    setReminderSet(true);
    onToast("Reminder saved in this browser only — no notification is sent in the demo.");
  }, [onToast]);

  if (!mounted || !open || !medication) return null;

  const schedule = medication.times.map(formatTime12h).join(" · ");

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close medication details"
        onClick={onClose}
        className={cn(
          "absolute inset-0 cursor-default bg-[#0F2D4A]/35 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="medication-drawer-title"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-[380px] flex-col bg-white shadow-[-20px_0_60px_-30px_rgba(15,45,74,0.5)] transition-transform duration-200 ease-out",
          visible ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-[#EDF3F3] px-4 py-3">
          <h2 id="medication-drawer-title" className="text-[12.5px] font-semibold text-[#0F2D4A]">
            Medication Details
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-lg text-[#5B6B7C] transition hover:bg-[#F1F6F6] hover:text-[#0F2D4A]"
          >
            <X size={15} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="rounded-xl border border-[#EDF3F3] bg-[#FBFDFD] p-3">
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E7FBF8] text-[#0A9189]">
                <Pill size={16} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[12.5px] font-semibold leading-tight text-[#0F2D4A]">
                    {medication.name}
                  </h3>
                  <StatusBadge status={medication.status} />
                </div>
                <p className="mt-0.5 text-[9.5px] text-[#7187A6]">
                  {medication.selfReported
                    ? "Self-reported by you"
                    : `From: ${prescription?.title ?? "Prescription"}`}
                </p>
              </div>
            </div>
          </div>

          <section className="mt-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9AA9B8]">
              Details
            </h4>
            <dl className="mt-1.5 divide-y divide-[#F2F7F7] rounded-xl border border-[#EDF3F3] bg-white px-3">
              <DrawerRow icon={Clock} label="Schedule" value={schedule || medication.frequency} />
              <DrawerRow icon={Repeat} label="Frequency" value={medication.frequency} />
              <DrawerRow icon={Timer} label="Duration" value={medication.duration} />
              <DrawerRow
                icon={CalendarDays}
                label="Start Date"
                value={formatPrescriptionDate(medication.startDate)}
              />
              <DrawerRow
                icon={CalendarDays}
                label="End Date"
                value={formatPrescriptionDate(medication.endDate)}
              />
              <DrawerRow
                icon={Info}
                label="Dose"
                value={medication.dosage}
              />
              {medication.status === "Active" ? (
                <DrawerRow
                  icon={Repeat}
                  label="Refills left"
                  value={
                    medication.refillsRemaining === 0
                      ? "None remaining"
                      : `${medication.refillsRemaining} remaining`
                  }
                />
              ) : null}
            </dl>
          </section>

          {!medication.selfReported ? (
            <section className="mt-3 rounded-xl border border-[#EDF3F3] bg-white p-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9AA9B8]">
                Prescribed By
              </h4>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EFF4FF] text-[#2563EB]">
                  <Stethoscope size={14} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-[#0F2D4A]">
                    {meta?.doctor?.name ?? "Medora care team"}
                  </p>
                  <p className="truncate text-[9.5px] text-[#7187A6]">
                    {meta?.specialty ?? "General Medicine"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {medication.instructions.length > 0 ? (
            <section className="mt-3 rounded-xl border border-[#D9EEF8] bg-[#F3FAFD] p-3">
              <h4 className="text-[10.5px] font-semibold text-[#0F2D4A]">Instructions</h4>
              <ul className="mt-1.5 space-y-1">
                {medication.instructions.map((instruction) => (
                  <li key={instruction} className="flex gap-1.5 text-[10px] leading-relaxed text-[#4A5C6E]">
                    <span aria-hidden className="mt-[5px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#0A9189]" />
                    {instruction}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {reminderSet ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-[#FFF0D2] bg-[#FFF9EE] p-2.5 text-[9.5px] leading-relaxed text-[#8A5B0B]">
              <BellRing size={12} aria-hidden className="mt-[1px] shrink-0" />
              Demo reminder saved locally. Medora has no reminder service yet, so nothing is
              scheduled on a server and no notification will be sent.
            </p>
          ) : null}
        </div>

        <footer className="flex items-center gap-2 border-t border-[#EDF3F3] px-4 py-3">
          {prescription ? (
            <button
              type="button"
              onClick={() => onViewPrescription(prescription.id)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E6EFEE] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#0F2D4A] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
            >
              <FileText size={13} aria-hidden />
              View Prescription
              <ChevronRight size={12} aria-hidden />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleReminder}
            disabled={reminderSet}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0A9189] px-3 py-2 text-[10.5px] font-semibold text-white transition hover:bg-[#088078] disabled:cursor-default disabled:opacity-60"
          >
            <Bell size={13} aria-hidden />
            {reminderSet ? "Reminder set" : "Set Reminder"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function DrawerRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="flex items-center gap-1.5 text-[10px] text-[#7187A6]">
        <Icon size={12} aria-hidden className="text-[#9AA9B8]" />
        {label}
      </dt>
      <dd className="text-right text-[10.5px] font-semibold leading-snug text-[#0F2D4A]">{value}</dd>
    </div>
  );
}

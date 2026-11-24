"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, Check } from "lucide-react";
import { formatClock } from "@/lib/mock/doctorPortal";
import { formatLongDate } from "@/lib/mock/doctorSchedule";

/**
 * Appointment Updated (storyboard screen 5).
 *
 * Standalone confirmation state — no header bar, matching the approved design.
 * The copy is explicit that the change is local to this demo session.
 */
export function RescheduleSuccessDialog({
  open,
  patientName,
  date,
  time,
  onBack,
}: {
  open: boolean;
  patientName: string;
  date: string;
  time: string;
  onBack: () => void;
}) {
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => actionRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onBack]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <div className="absolute inset-0 bg-[#0F2D4A]/35" aria-hidden />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-success-title"
          className="w-full max-w-[520px] rounded-2xl bg-white p-6 text-center shadow-[0_30px_80px_-40px_rgba(15,45,74,0.6)]"
        >
          <div className="relative mx-auto grid h-16 w-16 place-items-center">
            <span className="absolute inset-0 rounded-full bg-[#D9F7EA]" aria-hidden />
            <span className="absolute inset-2 rounded-full bg-[#BCEFD9]" aria-hidden />
            <Check size={26} className="relative text-[#16A34A]" aria-hidden />
          </div>

          <h2
            id="reschedule-success-title"
            className="mt-4 text-[21px] font-bold tracking-[-0.01em] text-[#0F2D4A]"
          >
            Appointment Rescheduled
          </h2>

          <p className="mx-auto mt-2 max-w-[380px] text-[12px] leading-relaxed text-[#4E6875]">
            The appointment for <span className="font-semibold text-[#0F2D4A]">{patientName}</span>{" "}
            has been updated to{" "}
            <span className="font-semibold text-[#0F2D4A]">
              {formatLongDate(date)} at {formatClock(time)}
            </span>
            .
          </p>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#EAFBF5] px-3.5 py-3 text-left">
            <CalendarDays size={16} aria-hidden className="mt-0.5 shrink-0 text-[#0A9189]" />
            <p className="text-[10.5px] leading-relaxed text-[#3F6B63]">
              The schedule has been updated in this demo session. Patient notification requires
              backend integration.
            </p>
          </div>

          <button
            ref={actionRef}
            type="button"
            onClick={onBack}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0A9189] px-6 text-[12px] font-semibold text-white shadow-[0_16px_30px_-18px_rgba(10,145,137,0.95)] transition hover:bg-[#087F78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189] active:translate-y-px"
          >
            <CalendarDays size={15} aria-hidden />
            Back to My Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

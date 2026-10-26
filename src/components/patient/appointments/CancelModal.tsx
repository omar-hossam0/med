"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarX2,
  Clock,
  MapPin,
  ShieldCheck,
  Video,
} from "lucide-react";
import {
  CANCEL_REASONS,
  formatLongDate,
  formatTimeRange,
  getDoctor,
  type Appointment,
} from "@/lib/mock/appointments";
import { DoctorPortrait } from "../DoctorPortrait";
import { ModalShell } from "./ModalShell";

/**
 * Cancellation confirmation. Opening the dialog never changes data; only
 * Confirm Cancellation applies the local demo update.
 */
export function CancelModal({
  appointment,
  onClose,
  onConfirm,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
}) {
  const doctor = getDoctor(appointment?.doctorId);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Reset the form whenever a different appointment opens the dialog.
  useEffect(() => {
    setReason("");
    setNotes("");
  }, [appointment?.id]);

  return (
    <ModalShell
      open={Boolean(appointment)}
      onClose={onClose}
      labelledBy="cancel-title"
      maxWidth="max-w-[480px]"
      panelClassName="p-5"
      closeLabel="Close cancellation dialog"
    >
      {appointment && doctor ? (
        <>
          <div className="flex flex-col items-center text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FDECEF] text-[#E5484D]">
              <CalendarX2 size={22} />
            </span>
            <h2 id="cancel-title" className="mt-3 text-[17px] font-semibold text-[#0F2D4A]">
              Cancel Appointment?
            </h2>
            <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-[#5B6B7C]">
              Are you sure you want to cancel this appointment? This action cannot be
              undone in this demo.
            </p>
          </div>

          {/* Appointment summary */}
          <div className="mt-4 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3">
            <div className="flex items-center gap-2.5">
              <DoctorPortrait
                name={doctor.name}
                photoUrl={doctor.photoUrl}
                size={36}
              />
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-semibold text-[#0F2D4A]">
                  {doctor.name}
                </p>
                <p className="truncate text-[9.5px] text-[#8A99A8]">{doctor.specialty}</p>
              </div>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-[#5B6B7C] ring-1 ring-inset ring-[#E6EFEE]">
                {appointment.consultationType === "Online" ? (
                  <Video size={10} />
                ) : (
                  <MapPin size={10} />
                )}
                {appointment.consultationType}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#EEF4F4] pt-2">
              <p className="flex items-center gap-1 text-[10px] text-[#33475B]">
                <CalendarDays size={11} className="text-[#9AA9B8]" />
                {formatLongDate(appointment.startsAt)}
              </p>
              <p className="flex items-center gap-1 text-[10px] text-[#33475B]">
                <Clock size={11} className="text-[#9AA9B8]" />
                {formatTimeRange(appointment.startsAt, appointment.durationMinutes)}
              </p>
            </div>
            <p className="mt-1 text-[8.5px] text-[#9AA9B8]">
              Reference: {appointment.reference}
            </p>
          </div>

          <div className="mt-3 space-y-2.5">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-[#33475B]">
                Reason for Cancellation{" "}
                <span className="font-normal text-[#9AA9B8]">(optional)</span>
              </span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-9 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[11px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
              >
                <option value="">Select a reason</option>
                {CANCEL_REASONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-[#33475B]">
                Additional Notes <span className="font-normal text-[#9AA9B8]">(optional)</span>
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value.slice(0, 300))}
                rows={2}
                maxLength={300}
                placeholder="Anything you'd like the clinic to know..."
                className="w-full resize-none rounded-lg border border-[#E6EFEE] bg-white px-2.5 py-2 text-[11px] leading-relaxed text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="h-9 flex-1 rounded-xl border border-[#E6EFEE] bg-white text-[11px] font-semibold text-[#33475B] transition hover:bg-[#F7FAFA]"
            >
              Keep Appointment
            </button>
            <button
              type="button"
              onClick={() => onConfirm(reason, notes)}
              className="h-9 flex-1 rounded-xl bg-[#E5484D] text-[11px] font-semibold text-white shadow-[0_10px_20px_-14px_rgba(229,72,77,0.9)] transition hover:bg-[#CF3B40]"
            >
              Confirm Cancellation
            </button>
          </div>

          <p className="mt-2 flex items-start justify-center gap-1 text-center text-[9px] leading-relaxed text-[#9AA9B8]">
            <ShieldCheck size={11} className="mt-[1px] shrink-0" />
            Demo cancellation. No clinic system or notification is updated.
          </p>
        </>
      ) : null}
    </ModalShell>
  );
}

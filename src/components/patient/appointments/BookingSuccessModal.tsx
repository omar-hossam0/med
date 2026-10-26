"use client";

import {
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  ListChecks,
  MapPin,
  Video,
} from "lucide-react";
import {
  formatLongDate,
  formatTimeRange,
  getDoctor,
  type Appointment,
} from "@/lib/mock/appointments";
import { DoctorPortrait } from "../DoctorPortrait";
import { ModalShell } from "./ModalShell";

/**
 * Booking confirmation overlay. Shown only after a valid local demo booking
 * has been created. Copy deliberately avoids claiming a real confirmed visit.
 */
export function BookingSuccessModal({
  appointment,
  onViewAll,
  onBookAnother,
}: {
  appointment: Appointment | null;
  onViewAll: () => void;
  onBookAnother: () => void;
}) {
  const doctor = getDoctor(appointment?.doctorId);

  return (
    <ModalShell
      open={Boolean(appointment)}
      onClose={onViewAll}
      labelledBy="booking-success-title"
      maxWidth="max-w-[460px]"
      panelClassName="overflow-hidden p-0"
      closeLabel="Close booking confirmation"
    >
      {appointment && doctor ? (
        <div className="relative">
          {/* Decorative teal waves */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[136px]">
            <div className="absolute inset-0 bg-gradient-to-b from-[#E7FBF8] to-transparent" />
            <svg
              className="absolute inset-x-0 top-0 h-full w-full text-[#BFEDE6]"
              viewBox="0 0 460 136"
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                d="M0 78C68 42 118 108 192 88C266 68 296 18 372 30C414 37 438 58 460 70V0H0V78Z"
                fill="currentColor"
                fillOpacity="0.45"
              />
              <path
                d="M0 104C74 70 132 126 214 104C296 82 330 44 402 54C428 58 448 70 460 78V0H0V104Z"
                fill="currentColor"
                fillOpacity="0.35"
              />
            </svg>
            <span className="absolute left-8 top-6 h-1.5 w-1.5 rounded-full bg-[#0A9189]/30" />
            <span className="absolute right-12 top-10 h-1 w-1 rounded-full bg-[#0A9189]/30" />
            <span className="absolute left-16 top-[74px] h-1 w-1 rounded-full bg-[#0A9189]/20" />
            <span className="absolute left-[38%] top-5 h-1 w-1 rounded-full bg-[#F5A623]/45" />
            <span className="absolute right-[26%] top-4 h-1.5 w-1.5 rounded-full bg-[#7C3AED]/25" />
            <span className="absolute right-[34%] top-[58px] h-1 w-1 rounded-full bg-[#3B6EF6]/30" />
          </div>

          <div className="relative px-5 pb-5 pt-7">
            <div className="flex flex-col items-center text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[#0A9189] text-white shadow-[0_14px_28px_-14px_rgba(10,145,137,0.9)] ring-[6px] ring-white/70">
                <Check size={28} strokeWidth={3} />
              </span>
              <h2
                id="booking-success-title"
                className="mt-3 text-[18px] font-semibold tracking-[-0.01em] text-[#0F2D4A]"
              >
                Appointment Booked Successfully!
              </h2>
              <p className="mt-1 max-w-[340px] text-[10.5px] leading-relaxed text-[#5B6B7C]">
                Your appointment has been added to your Medora appointments. This is a demo
                booking, so no real visit was reserved.
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-[#E6EFEE] bg-white p-3 shadow-[0_8px_26px_-26px_rgba(15,45,74,0.4)]">
              <div className="flex items-center gap-2.5">
                <DoctorPortrait
                name={doctor.name}
                photoUrl={doctor.photoUrl}
                size={38}
              />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[#0F2D4A]">
                    {doctor.name}
                  </p>
                  <p className="truncate text-[9.5px] text-[#8A99A8]">{doctor.specialty}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-[#E6FAF7] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#0A9189]">
                  {appointment.status}
                </span>
              </div>

              <dl className="mt-2.5 space-y-1.5 border-t border-[#EEF4F4] pt-2.5">
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-[9.5px] text-[#8A99A8]">
                    <CalendarDays size={11} /> Date
                  </dt>
                  <dd className="text-right text-[10px] font-medium text-[#33475B]">
                    {formatLongDate(appointment.startsAt)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-[9.5px] text-[#8A99A8]">
                    <Clock size={11} /> Time
                  </dt>
                  <dd className="text-right text-[10px] font-medium text-[#33475B]">
                    {formatTimeRange(appointment.startsAt, appointment.durationMinutes)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-[9.5px] text-[#8A99A8]">
                    {appointment.consultationType === "Online" ? (
                      <Video size={11} />
                    ) : (
                      <MapPin size={11} />
                    )}
                    Type
                  </dt>
                  <dd className="text-right text-[10px] font-medium text-[#33475B]">
                    {appointment.consultationType === "Online"
                      ? "Online Consultation"
                      : "In-Person Visit"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-[9.5px] text-[#8A99A8]">
                    <ListChecks size={11} /> Reference
                  </dt>
                  <dd className="text-right text-[10px] font-medium text-[#33475B]">
                    {appointment.reference}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onViewAll}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0A9189] px-3 text-[11px] font-semibold text-white shadow-[0_12px_24px_-14px_rgba(10,145,137,0.75)] transition hover:bg-[#087F78]"
              >
                <CalendarDays size={13} />
                View My Appointments
              </button>
              <button
                type="button"
                onClick={onBookAnother}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#0A9189]/40 bg-white px-3 text-[11px] font-semibold text-[#0A9189] transition hover:bg-[#F1FBFA]"
              >
                <CalendarPlus size={13} />
                Book Another Appointment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

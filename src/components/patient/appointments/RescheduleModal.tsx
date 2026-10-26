"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  Clock,
  MapPin,
  RefreshCw,
  Star,
  Video,
} from "lucide-react";
import {
  dateFromKey,
  formatLongDate,
  formatTime,
  formatTimeRange,
  getAvailableSlots,
  getDoctor,
  startOfMonth,
  toDateKey,
  type Appointment,
} from "@/lib/mock/appointments";
import { ASSETS } from "@/lib/constants";
import { doctorWorksOn } from "@/lib/mock/doctors";
import { DoctorPortrait } from "../DoctorPortrait";
import { Calendar } from "./Calendar";
import { ModalShell } from "./ModalShell";
import { cn } from "@/lib/cn";

function timeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Reschedule overlay. The original booking is only replaced when the patient
 * presses Confirm Reschedule; closing or cancelling leaves it untouched.
 */
export function RescheduleModal({
  appointment,
  appointments,
  today,
  onClose,
  onConfirm,
}: {
  appointment: Appointment | null;
  appointments: Appointment[];
  today: Date;
  onClose: () => void;
  onConfirm: (dateKey: string, time: string) => void;
}) {
  const doctor = getDoctor(appointment?.doctorId);
  const currentDateKey = appointment ? toDateKey(appointment.startsAt) : "";
  const currentTime = appointment ? timeKey(appointment.startsAt) : "";

  const [dateKey, setDateKey] = useState<string | null>(currentDateKey || null);
  const [time, setTime] = useState<string | null>(null);
  const [month, setMonth] = useState(() =>
    startOfMonth(appointment?.startsAt ?? today),
  );

  const slots = useMemo(() => {
    if (!appointment || !doctor || !dateKey) return [];
    return getAvailableSlots({
      doctor,
      dateKey,
      consultationType: appointment.consultationType,
      appointments,
      now: new Date(),
      ignoreAppointmentId: appointment.id,
    });
  }, [appointment, doctor, dateKey, appointments]);

  const chosenSlot = slots.find((slot) => slot.time === time);
  const isSameSlot = Boolean(
    dateKey && time && dateKey === currentDateKey && time === currentTime,
  );
  const canConfirm = Boolean(chosenSlot?.available && !isSameSlot);

  return (
    <ModalShell
      open={Boolean(appointment)}
      onClose={onClose}
      labelledBy="reschedule-title"
      maxWidth="max-w-[760px]"
      panelClassName="p-4 sm:p-5"
      closeLabel="Close reschedule dialog"
    >
      {appointment && doctor ? (
        <>
          <div className="flex items-start gap-2.5 pr-8">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
              <RefreshCw size={16} />
            </span>
            <div className="min-w-0">
              <h2 id="reschedule-title" className="text-[16px] font-semibold text-[#0F2D4A]">
                Reschedule Appointment
              </h2>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#5B6B7C]">
                Choose a new date and time with the same doctor. Your current booking stays
                unchanged until you confirm.
              </p>
            </div>
          </div>

          {/* Current booking */}
          <div className="mt-4 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3">
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#9AA9B8]">
              Current booking
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-center gap-2.5">
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
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#33475B]">
                <CalendarDays size={12} className="text-[#9AA9B8]" />
                {formatLongDate(appointment.startsAt)}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#33475B]">
                <Clock size={12} className="text-[#9AA9B8]" />
                {formatTimeRange(appointment.startsAt, appointment.durationMinutes)}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EAFBF8] px-2 py-0.5 text-[9px] font-semibold text-[#0A9189]">
                {appointment.consultationType === "Online" ? (
                  <Video size={10} />
                ) : (
                  <MapPin size={10} />
                )}
                {appointment.consultationType}
              </span>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* Calendar */}
            <div className="rounded-xl border border-[#EEF4F4] p-2.5">
              <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-[#0F2D4A]">
                <CalendarDays size={12} className="text-[#0A9189]" /> Select a new date
              </p>
              <Calendar
                month={month}
                onMonthChange={setMonth}
                selected={dateKey}
                onSelect={(nextKey) => {
                  setDateKey(nextKey);
                  setTime(null);
                }}
                minDate={today}
                markedDateKey={currentDateKey}
                isDateDisabled={(date) =>
                  !doctorWorksOn(doctor, date, appointment.consultationType)
                }
                compact
              />
            </div>

            {/* Slots + location */}
            <div className="space-y-2.5">
              <div className="rounded-xl border border-[#EEF4F4] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#0F2D4A]">
                    <Clock size={12} className="text-[#0A9189]" /> Available time slots
                  </p>
                  {dateKey && (
                    <span className="text-[8.5px] text-[#8A99A8]">
                      {slots.filter((slot) => slot.available).length} available
                    </span>
                  )}
                </div>

                {!dateKey ? (
                  <p className="mt-2 rounded-lg bg-[#FBFDFD] px-2 py-3 text-center text-[10px] text-[#8A99A8]">
                    Select a date to see available times.
                  </p>
                ) : slots.every((slot) => !slot.available) ? (
                  <p className="mt-2 rounded-lg bg-[#FFF8EC] px-2 py-3 text-center text-[10px] text-[#A86A08]">
                    No times available on this date. Choose another day.
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {slots.map((slot) => {
                      const active = time === slot.time;
                      const unchanged = dateKey === currentDateKey && slot.time === currentTime;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available || unchanged}
                          onClick={() => setTime(slot.time)}
                          aria-pressed={active}
                          className={cn(
                            "h-8 rounded-lg border text-[10px] font-semibold transition",
                            active
                              ? "border-[#0A9189] bg-[#0A9189] text-white shadow-[0_6px_14px_-8px_rgba(10,145,137,0.9)]"
                              : slot.available && !unchanged
                                ? "border-[#E6EFEE] bg-white text-[#33475B] hover:border-[#BFE8E2] hover:bg-[#F1FBFA] hover:text-[#0A9189]"
                                : "cursor-not-allowed border-[#EEF4F4] bg-[#F8FBFA] text-[#C4D0D6] line-through",
                          )}
                        >
                          {formatTime(slot.time)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-2">
                {appointment.consultationType === "Online" ? (
                  <span className="grid h-[58px] w-[74px] shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#EFE9FF] via-[#E9F8F9] to-[#DDF7F1] text-[#3B6EF6]">
                    <Video size={18} />
                  </span>
                ) : (
                  <div className="relative h-[58px] w-[74px] shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={ASSETS.clinic}
                      alt="Medora Medical Center clinic exterior"
                      fill
                      sizes="74px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#0F2D4A]">
                    <Star size={11} className="fill-[#0A9189] text-[#0A9189]" />
                    {doctor.name}
                    <span className="font-normal text-[#8A99A8]">· {doctor.experience}</span>
                  </p>
                  <p className="mt-0.5 flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[#5B6B7C]">
                    {appointment.consultationType === "Online" ? (
                      <Video size={11} className="mt-[2px] shrink-0 text-[#9AA9B8]" />
                    ) : (
                      <MapPin size={11} className="mt-[2px] shrink-0 text-[#9AA9B8]" />
                    )}
                    {appointment.consultationType === "Online"
                      ? "Secure online consultation — a link would be shared after confirmation."
                      : `${doctor.clinic}, ${doctor.address}`}
                  </p>
                </div>
              </div>

              {time && !isSameSlot && (
                <div className="rounded-xl border border-[#D7F1EC] bg-[#F4FCFA] p-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#0A9189]">
                    <Check size={11} strokeWidth={3} /> New slot selected
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-[#33475B]">
                    {dateKey ? formatLongDate(dateFromKey(dateKey)) : ""} ·{" "}
                    {formatTime(time)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-[#EEF4F4] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[9px] leading-relaxed text-[#9AA9B8]">
              Demo reschedule — availability is simulated and no clinic is notified.
            </p>
            <div className="flex gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="h-9 flex-1 rounded-xl border border-[#E6EFEE] bg-white px-3.5 text-[11px] font-semibold text-[#33475B] transition hover:bg-[#F7FAFA] sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => {
                  if (!dateKey || !time) return;
                  onConfirm(dateKey, time);
                }}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0A9189] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#087F78] disabled:cursor-not-allowed disabled:bg-[#DCEBE9] disabled:text-[#8FAFAB] sm:flex-none"
              >
                <RefreshCw size={13} />
                Confirm Reschedule
              </button>
            </div>
          </div>

          {isSameSlot && (
            <p className="mt-2 text-right text-[9.5px] text-[#A86A08]" role="alert">
              That is the current appointment slot. Choose a different date or time.
            </p>
          )}
        </>
      ) : null}
    </ModalShell>
  );
}

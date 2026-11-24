"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarRange, ChevronDown, Clock } from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import { DoctorOverlay } from "@/components/doctor/overview/DoctorOverlay";
import { formatClock, type PortalPatient } from "@/lib/mock/doctorPortal";
import {
  RESCHEDULE_SLOTS,
  formatLongDate,
  rescheduleDateOptions,
  todayISO,
  type ScheduleAppointment,
} from "@/lib/mock/doctorSchedule";
import { cn } from "@/lib/cn";

/**
 * Reschedule Appointment (storyboard screen 4).
 *
 * Demo-only: the new slot is written to local state. No availability service is
 * called and no notification is sent, which the success state says explicitly.
 */
export function RescheduleDialog({
  appointment,
  patient,
  onClose,
  onConfirm,
}: {
  appointment: ScheduleAppointment | null;
  patient?: PortalPatient;
  onClose: () => void;
  onConfirm: (payload: { date: string; time: string; reason: string }) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ date?: string; time?: string }>({});

  useEffect(() => {
    setDate("");
    setTime("");
    setReason("");
    setErrors({});
  }, [appointment?.id]);

  const dateOptions = useMemo(() => rescheduleDateOptions(todayISO()), []);

  const submit = () => {
    const nextErrors: { date?: string; time?: string } = {};
    if (!date) nextErrors.date = "Choose a new date.";
    if (!time) nextErrors.time = "Choose a new time.";

    if (date && time) {
      const [hours, minutes] = time.split(":").map(Number);
      const [year, month, day] = date.split("-").map(Number);
      const target = new Date(year, month - 1, day, hours, minutes);
      if (target.getTime() <= Date.now()) {
        nextErrors.time = "Pick a time in the future.";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onConfirm({ date, time, reason: reason.trim() });
  };

  return (
    <DoctorOverlay
      open={Boolean(appointment && patient)}
      onClose={onClose}
      variant="dialog"
      title="Reschedule Appointment"
      description="Change the appointment date or time. The patient is not notified until notifications are connected."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-[#E6EFEE] bg-white text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-[#F8FCFB]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0A9189] text-[11.5px] font-semibold text-white shadow-[0_12px_26px_-16px_rgba(10,145,137,0.9)] transition hover:bg-[#087F78] active:translate-y-px"
          >
            <CalendarRange size={15} aria-hidden />
            Reschedule &amp; Notify
          </button>
        </div>
      }
    >
      {appointment && patient ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={patient.name} size={46} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0F2D4A]">{patient.name}</p>
              <p className="text-[10px] text-[#7187A6]">MRN: {patient.mrn}</p>
              <p className="mt-0.5 text-[10px] text-[#8A9AAA]">{appointment.visitType}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New Date" required error={errors.date}>
              <SelectShell icon={CalendarDays} error={Boolean(errors.date)}>
                <select
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setErrors((current) => ({ ...current, date: undefined }));
                  }}
                  aria-label="New date"
                  className="h-10 w-full appearance-none bg-transparent pl-9 pr-8 text-[11.5px] font-medium text-[#0F2D4A] outline-none"
                >
                  <option value="">Select a date</option>
                  {dateOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatLongDate(option)}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>

            <Field label="New Time" required error={errors.time}>
              <SelectShell icon={Clock} error={Boolean(errors.time)}>
                <select
                  value={time}
                  onChange={(event) => {
                    setTime(event.target.value);
                    setErrors((current) => ({ ...current, time: undefined }));
                  }}
                  aria-label="New time"
                  className="h-10 w-full appearance-none bg-transparent pl-9 pr-8 text-[11.5px] font-medium text-[#0F2D4A] outline-none"
                >
                  <option value="">Select a time</option>
                  {RESCHEDULE_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {formatClock(slot)} (30 min)
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>
          </div>

          <div>
            <label
              htmlFor="reschedule-reason"
              className="mb-1.5 block text-[10.5px] font-semibold text-[#0F2D4A]"
            >
              Reason (Optional)
            </label>
            <textarea
              id="reschedule-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Patient requested a different time."
              className="w-full resize-none rounded-xl border border-[#E6EFEE] bg-white px-3 py-2 text-[11.5px] leading-relaxed text-[#0F2D4A] outline-none transition placeholder:text-[#A8B6C4] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
            />
          </div>

          <p className="rounded-xl bg-[#F7FCFB] px-3 py-2 text-[9.5px] leading-relaxed text-[#8A9AAA]">
            Demo availability only — slots are not checked against the clinic calendar, and no
            notification is sent from this phase.
          </p>
        </div>
      ) : null}
    </DoctorOverlay>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-semibold text-[#0F2D4A]">
        {label}
        {required ? <span className="ml-0.5 text-[#E5484D]">*</span> : null}
      </p>
      {children}
      {error ? <p className="mt-1 text-[9.5px] text-[#C0353B]">{error}</p> : null}
    </div>
  );
}

function SelectShell({
  icon: Icon,
  error,
  children,
}: {
  icon: typeof CalendarDays;
  error: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border bg-white transition",
        error ? "border-[#F3C7CC]" : "border-[#E6EFEE] focus-within:border-[#0A9189]",
      )}
    >
      <Icon
        size={14}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#0A9189]"
      />
      {children}
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A8CA0]"
      />
    </div>
  );
}

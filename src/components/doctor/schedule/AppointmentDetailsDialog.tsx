"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  HeartPulse,
  MapPin,
  NotebookPen,
  Stethoscope,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import { DoctorOverlay } from "@/components/doctor/overview/DoctorOverlay";
import { DoctorStatusBadge } from "@/components/doctor/overview/OverviewSections";
import { formatClock, type PortalPatient } from "@/lib/mock/doctorPortal";
import { formatLongDate, type ScheduleAppointment } from "@/lib/mock/doctorSchedule";
import { cn } from "@/lib/cn";

/**
 * Appointment Quick View (storyboard screen 3).
 *
 * Read-only summary plus the appointment actions. Every action is a real branch
 * of the existing doctor workflow — nothing here mutates clinical data.
 */
export function AppointmentDetailsDialog({
  appointment,
  patient,
  canStartConsultation,
  onClose,
  onStartConsultation,
  onViewPatient,
  onReschedule,
  onMarkArrived,
  onCancel,
}: {
  appointment: ScheduleAppointment | null;
  patient?: PortalPatient;
  canStartConsultation: boolean;
  onClose: () => void;
  onStartConsultation: () => void;
  onViewPatient: () => void;
  onReschedule: () => void;
  onMarkArrived: () => void;
  onCancel: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    setConfirmCancel(false);
  }, [appointment?.id]);

  const canMarkArrived = appointment?.status === "Upcoming";

  return (
    <DoctorOverlay
      open={Boolean(appointment && patient)}
      onClose={onClose}
      variant="dialog"
      size="xl"
      title="Appointment Details"
    >
      {appointment && patient ? (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_252px]">
          {/* Patient + appointment information */}
          <div className="min-w-0">
            <div className="flex items-start gap-3.5">
              <Avatar name={patient.name} size={64} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[19px] font-bold leading-tight text-[#0F2D4A]">
                    {patient.name}
                  </h3>
                  <DoctorStatusBadge status={appointment.status} />
                </div>
                <p className="mt-1 text-[11px] text-[#7187A6]">MRN: {patient.mrn}</p>
              </div>
            </div>

            <ul className="mt-3 flex flex-wrap gap-2">
              <SummaryChip icon={CalendarDays} label={`${patient.age} years`} />
              <SummaryChip icon={Users} label={patient.gender} />
              <SummaryChip icon={HeartPulse} label="Cardiology" />
            </ul>

            <dl className="mt-4 divide-y divide-[#F2F7F7]">
              <DetailRow
                icon={CalendarClock}
                label="Appointment Time"
                value={`${formatLongDate(appointment.date)} · ${formatClock(appointment.time)} (${appointment.durationMinutes} min)`}
              />
              <DetailRow icon={Stethoscope} label="Visit Type" value={appointment.reason} />
              <DetailRow icon={MapPin} label="Location" value={appointment.location} />
              {appointment.notes ? (
                <DetailRow icon={NotebookPen} label="Notes" value={appointment.notes} />
              ) : null}
            </dl>
          </div>

          {/* Actions */}
          <div className="min-w-0 border-t border-[#EDF3F3] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <h4 className="text-[12px] font-semibold text-[#0F2D4A]">Actions</h4>

            <div className="mt-2.5 space-y-2">
              <button
                type="button"
                onClick={onStartConsultation}
                disabled={!canStartConsultation}
                className={cn(
                  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-[11.5px] font-semibold transition",
                  canStartConsultation
                    ? "bg-[#0A9189] text-white shadow-[0_12px_26px_-16px_rgba(10,145,137,0.9)] hover:bg-[#087F78] active:translate-y-px"
                    : "cursor-not-allowed bg-[#E7F1EF] text-[#8FA7A3]",
                )}
              >
                <Stethoscope size={15} aria-hidden />
                Start Consultation
              </button>

              <ActionButton icon={UserRound} label="View Patient Record" onClick={onViewPatient} />
              <ActionButton icon={CalendarDays} label="Reschedule" onClick={onReschedule} />
              <ActionButton
                icon={Check}
                label="Mark Arrived"
                onClick={onMarkArrived}
                disabled={!canMarkArrived}
                hint={canMarkArrived ? undefined : "Only upcoming appointments can be checked in"}
              />

              {confirmCancel ? (
                <div className="rounded-xl border border-[#FBD9DD] bg-[#FFF7F8] p-2.5">
                  <p className="text-[10.5px] font-medium text-[#8C2F35]">
                    Cancel this appointment?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      className="h-8 flex-1 rounded-lg border border-[#E6EFEE] bg-white text-[10.5px] font-semibold text-[#0F2D4A] transition hover:bg-[#F8FCFB]"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="h-8 flex-1 rounded-lg bg-[#E5484D] text-[10.5px] font-semibold text-white transition hover:bg-[#CE3B40]"
                    >
                      Yes, cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#E6EFEE] bg-white px-3 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:border-[#F3C7CC] hover:bg-[#FFF7F8] hover:text-[#C0353B]"
                >
                  <X size={15} aria-hidden />
                  Cancel Appointment
                </button>
              )}
            </div>

            <p className="mt-3 text-[9px] leading-relaxed text-[#9AA9B8]">
              Status changes apply to this demo session only and are not saved to the database.
            </p>
          </div>
        </div>
      ) : null}
    </DoctorOverlay>
  );
}

function SummaryChip({
  icon: Icon,
  label,
}: {
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EFEE] px-3 py-1.5 text-[11px] font-medium text-[#33475B]">
      <Icon size={13} aria-hidden className="text-[#0A9189]" />
      {label}
    </li>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F2FAF8] text-[#0A9189]">
        <Icon size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8A9AAA]">
          {label}
        </dt>
        <dd className="mt-0.5 text-[11.5px] leading-snug text-[#0F2D4A]">{value}</dd>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  hint,
}: {
  icon: typeof CalendarDays;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-3 text-[11.5px] font-semibold transition",
        disabled
          ? "cursor-not-allowed border-[#EDF3F3] bg-[#FBFDFD] text-[#A8B6C4]"
          : "border-[#E6EFEE] bg-white text-[#0F2D4A] hover:border-[#BFE8E2] hover:bg-[#F8FCFB] hover:text-[#0A9189]",
      )}
    >
      <Icon size={15} aria-hidden />
      {label}
    </button>
  );
}

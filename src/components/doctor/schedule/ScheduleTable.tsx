"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, MoreVertical, Stethoscope } from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import { DoctorStatusBadge } from "@/components/doctor/overview/OverviewSections";
import { formatClock, type PortalPatient } from "@/lib/mock/doctorPortal";
import { formatShortDate, type ScheduleAppointment } from "@/lib/mock/doctorSchedule";
import { cn } from "@/lib/cn";

/**
 * Appointment table for My Schedule.
 *
 * Desktop renders the approved five-column table; below `lg` the same rows
 * reflow into stacked cards so nothing is clipped.
 */
export function ScheduleTable({
  appointments,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  onReschedule,
  menuId,
  onMenuChange,
  patientOf,
  showDate,
}: {
  appointments: ScheduleAppointment[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (appointment: ScheduleAppointment) => void;
  onReschedule: (appointment: ScheduleAppointment) => void;
  menuId: string | null;
  onMenuChange: (id: string | null) => void;
  patientOf: (id: string) => PortalPatient | undefined;
  /** Cross-day tabs show the appointment date under the time. */
  showDate: boolean;
}) {
  const allSelected =
    appointments.length > 0 && appointments.every((item) => selected.includes(item.id));

  return (
    <div className="min-w-0">
      {/* Desktop table */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[28px_92px_minmax(0,1fr)_150px_120px_120px] items-center gap-3 border-b border-[#EDF3F3] px-2 pb-2 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            aria-label="Select all appointments"
            className="h-3.5 w-3.5 cursor-pointer accent-[#0A9189]"
          />
          <span>Time</span>
          <span>Patient</span>
          <span>Visit Type</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        <ul className="divide-y divide-[#F4F8F8]">
          {appointments.map((appointment) => {
            const patient = patientOf(appointment.patientId);
            if (!patient) return null;
            const isSelected = selected.includes(appointment.id);

            return (
              <li
                key={appointment.id}
                className={cn(
                  "grid grid-cols-[28px_92px_minmax(0,1fr)_150px_120px_120px] items-center gap-3 px-2 py-3 transition-colors",
                  isSelected ? "bg-[#F7FDFB]" : "hover:bg-[#FAFDFC]",
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(appointment.id)}
                  aria-label={`Select ${patient.name}`}
                  className="h-3.5 w-3.5 cursor-pointer accent-[#0A9189]"
                />

                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-[#0F2D4A]">
                    {formatClock(appointment.time)}
                  </span>
                  {showDate ? (
                    <span className="block text-[9px] text-[#8A9AAA]">
                      {formatShortDate(appointment.date)}
                    </span>
                  ) : null}
                </span>

                <button
                  type="button"
                  onClick={() => onOpen(appointment)}
                  className="flex min-w-0 items-center gap-2.5 text-left"
                >
                  <Avatar name={patient.name} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-semibold text-[#0F2D4A]">
                      {patient.name}
                    </span>
                    <span className="block truncate text-[9.5px] text-[#8A9AAA]">
                      {patient.age} y · MRN: {patient.mrn}
                    </span>
                  </span>
                </button>

                <span className="inline-flex min-w-0 items-center gap-1.5 text-[10.5px] text-[#5B6B7C]">
                  <Stethoscope size={13} aria-hidden className="shrink-0 text-[#8A9AAA]" />
                  <span className="truncate">{appointment.visitType}</span>
                </span>

                <span>
                  <DoctorStatusBadge status={appointment.status} />
                </span>

                <span className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onOpen(appointment)}
                    className="inline-flex h-8 items-center rounded-full border border-[#0A9189] px-3 text-[10.5px] font-semibold text-[#0A9189] transition hover:bg-[#EAFBF7]"
                  >
                    View
                  </button>
                  <RowMenu
                    open={menuId === appointment.id}
                    onToggle={() => onMenuChange(menuId === appointment.id ? null : appointment.id)}
                    onClose={() => onMenuChange(null)}
                    onView={() => onOpen(appointment)}
                    onReschedule={() => onReschedule(appointment)}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 lg:hidden">
        {appointments.map((appointment) => {
          const patient = patientOf(appointment.patientId);
          if (!patient) return null;
          const isSelected = selected.includes(appointment.id);

          return (
            <li
              key={appointment.id}
              className={cn(
                "rounded-xl border p-3",
                isSelected ? "border-[#BFE8E2] bg-[#F7FDFB]" : "border-[#EDF3F3] bg-white",
              )}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(appointment.id)}
                  aria-label={`Select ${patient.name}`}
                  className="mt-1 h-3.5 w-3.5 cursor-pointer accent-[#0A9189]"
                />
                <Avatar name={patient.name} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-[#0F2D4A]">{patient.name}</p>
                  <p className="truncate text-[10px] text-[#8A9AAA]">
                    {patient.age} y · MRN: {patient.mrn}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#5B6B7C]">
                      <CalendarDays size={11} aria-hidden className="text-[#8A9AAA]" />
                      {formatClock(appointment.time)}
                      {showDate ? ` · ${formatShortDate(appointment.date)}` : ""}
                    </span>
                    <DoctorStatusBadge status={appointment.status} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(appointment)}
                  className="inline-flex h-7 shrink-0 items-center rounded-full border border-[#0A9189] px-2.5 text-[10px] font-semibold text-[#0A9189]"
                >
                  View
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RowMenu({
  open,
  onToggle,
  onClose,
  onView,
  onReschedule,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onView: () => void;
  onReschedule: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label="More actions"
        aria-expanded={open}
        className="grid h-8 w-6 place-items-center rounded-lg text-[#8A9AAA] transition hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
      >
        <MoreVertical size={14} />
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-20 w-[168px] overflow-hidden rounded-xl border border-[#E6EFEE] bg-white py-1 shadow-[0_18px_40px_-24px_rgba(15,45,74,0.45)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onView();
            }}
            className="block w-full px-3 py-2 text-left text-[10.5px] font-medium text-[#0F2D4A] transition hover:bg-[#F5FAFA]"
          >
            View details
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onReschedule();
            }}
            className="block w-full px-3 py-2 text-left text-[10.5px] font-medium text-[#0F2D4A] transition hover:bg-[#F5FAFA]"
          >
            Reschedule
          </button>
        </div>
      ) : null}
    </div>
  );
}

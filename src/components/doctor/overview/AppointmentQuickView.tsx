"use client";

import { CalendarClock, CalendarDays, MapPin, Stethoscope, UserRound } from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import {
  formatClock,
  getPortalPatient,
  type DoctorAppointmentStatus,
  type PortalAppointment,
} from "@/lib/mock/doctorPortal";
import { DoctorOverlay, DetailRow } from "./DoctorOverlay";
import { DoctorStatusBadge } from "./OverviewSections";

export function AppointmentQuickView({
  appointment,
  dateLabel,
  onClose,
  onViewPatient,
  onStartConsultation,
  onReschedule,
  onMarkArrived,
}: {
  appointment: PortalAppointment | null;
  dateLabel: string;
  onClose: () => void;
  onViewPatient: (patientId: string) => void;
  onStartConsultation: (appointment: PortalAppointment) => void;
  onReschedule: () => void;
  onMarkArrived: () => void;
}) {
  const patient = getPortalPatient(appointment?.patientId);
  const status: DoctorAppointmentStatus = appointment?.status ?? "Upcoming";

  return (
    <DoctorOverlay
      open={Boolean(appointment)}
      onClose={onClose}
      title="Appointment Details"
      variant="sheet"
      footer={
        appointment ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onStartConsultation(appointment)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0A9189] px-3 py-2.5 text-[11px] font-semibold text-white shadow-[0_12px_26px_-16px_rgba(10,145,137,0.9)] transition-[background-color,transform] duration-150 hover:bg-[#088078] active:translate-y-[1px]"
            >
              <Stethoscope size={14} aria-hidden />
              Start Consultation
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => patient && onViewPatient(patient.id)}
                className="rounded-xl border border-[#E6EFEE] bg-white px-2 py-2.5 text-[10px] font-semibold text-[#0F2D4A] transition-[border-color,color,background-color] duration-150 hover:border-[#BFE8E2] hover:bg-[#F8FCFB] hover:text-[#0A9189]"
              >
                View Patient
              </button>
              <button
                type="button"
                onClick={onReschedule}
                className="rounded-xl border border-[#E6EFEE] bg-white px-2 py-2.5 text-[10px] font-semibold text-[#0F2D4A] transition-[border-color,color,background-color] duration-150 hover:border-[#BFE8E2] hover:bg-[#F8FCFB] hover:text-[#0A9189]"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={onMarkArrived}
                aria-disabled
                title="Check-in is handled by the reception desk"
                className="cursor-not-allowed rounded-xl border border-[#E6EFEE] bg-white px-2 py-2.5 text-[10px] font-semibold text-[#A8B6C4]"
              >
                Mark Arrived
              </button>
            </div>

            <p className="px-1 text-center text-[9px] leading-relaxed text-[#9AA9B8]">
              Patient check-in is handled by the reception desk; doctors cannot change arrival
              status.
            </p>
          </div>
        ) : null
      }
    >
      {appointment && patient ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#EDF3F3] bg-[#FBFDFD] p-3.5">
            <div className="flex items-start gap-2.5">
              <Avatar name={patient.name} size={38} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[13px] font-semibold text-[#0F2D4A]">{patient.name}</h3>
                  <DoctorStatusBadge status={status} />
                </div>
                <p className="mt-1 text-[10px] text-[#7187A6]">MRN: {patient.mrn}</p>
              </div>
            </div>

            <ul className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#EDF3F3] pt-2.5 text-[10px] text-[#5B6B7C]">
              <li className="inline-flex items-center gap-1">
                <UserRound size={11} aria-hidden className="text-[#9AA9B8]" />
                {patient.age} years
              </li>
              <li>{patient.gender}</li>
              <li className="inline-flex items-center gap-1">
                <Stethoscope size={11} aria-hidden className="text-[#9AA9B8]" />
                Cardiology
              </li>
            </ul>
          </div>

          <dl className="divide-y divide-[#F2F7F7] rounded-xl border border-[#EDF3F3] px-3.5">
            <DetailRow
              icon={CalendarClock}
              label="Appointment Time"
              value={`${dateLabel} · ${formatClock(appointment.time)} (${appointment.durationMinutes} min)`}
            />
            <DetailRow icon={Stethoscope} label="Visit Reason" value={appointment.reason} />
            <DetailRow icon={MapPin} label="Location" value={appointment.location} />
            <DetailRow
              icon={CalendarDays}
              label="Status"
              value={<DoctorStatusBadge status={status} />}
            />
          </dl>
        </div>
      ) : null}
    </DoctorOverlay>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, ChevronRight, Stethoscope } from "lucide-react";
import { useDoctorWorkspace } from "@/components/doctor/DoctorWorkspace";
import { DoctorCard, DoctorStatusBadge } from "@/components/doctor/overview/OverviewSections";
import { useConsultationWorkflow } from "./ConsultationWorkflowProvider";
import {
  formatClock,
  getPortalPatient,
  isConsultationEligible,
} from "@/lib/mock/doctorPortal";

export function DoctorConsultationWorkspace() {
  const router = useRouter();
  const { appointments, startConsultation } = useDoctorWorkspace();
  const { hasStarted } = useConsultationWorkflow();
  const consultations = appointments.filter(
    (appointment) =>
      isConsultationEligible(appointment) || hasStarted(appointment.id),
  );

  const openConsultation = (appointmentId: string) => {
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (appointment?.status === "Completed" && hasStarted(appointmentId)) {
      router.push(`/doctor/consultation/${appointmentId}?step=completed`);
      return;
    }
    if (appointment && isConsultationEligible(appointment)) {
      startConsultation(appointment.id);
    }
    router.push(`/doctor/consultation/${appointmentId}`);
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[25px]">
          Consultation Workspace
        </h1>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#5B6B7C]">
          Start or resume a consultation from today&apos;s clinic schedule.
        </p>
      </div>

      <DoctorCard className="p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EDF3F3] pb-3">
          <div>
            <h2 className="text-[13px] font-bold text-[#0F2D4A]">Today&apos;s Consultations</h2>
            <p className="mt-0.5 text-[10px] text-[#8A9AAA]">
              {consultations.length} scheduled patients
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3ECFF] px-2.5 py-1 text-[9.5px] font-semibold text-[#8B5CF6]">
            <Stethoscope size={11} aria-hidden />
            Doctor workspace
          </span>
        </div>

        {consultations.length > 0 ? (
          <ul className="divide-y divide-[#F2F7F7]">
            {consultations.map((appointment) => {
              const patient = getPortalPatient(appointment.patientId);
              const canOpen =
                isConsultationEligible(appointment) || hasStarted(appointment.id);
              const label =
                appointment.status === "Completed"
                  ? "View Summary"
                  : hasStarted(appointment.id)
                    ? "Resume Consultation"
                    : "Start Consultation";

              return (
                <li
                  key={appointment.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F3ECFF] text-[#8B5CF6]">
                    <Stethoscope size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[11.5px] font-semibold text-[#0F2D4A]">
                        {patient?.name ?? "Patient unavailable"}
                      </p>
                      {patient ? (
                        <span className="text-[9.5px] text-[#8A9AAA]">MRN {patient.mrn}</span>
                      ) : null}
                      <DoctorStatusBadge status={appointment.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-[#5B6B7C]">
                      {appointment.reason}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-[#8A9AAA]">
                      <CalendarClock size={11} aria-hidden />
                      {formatClock(appointment.time)} · {appointment.durationMinutes} min ·{" "}
                      {appointment.location}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openConsultation(appointment.id)}
                    disabled={!canOpen}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#0A9189] px-3 text-[10.5px] font-semibold text-white transition hover:bg-[#087F78] disabled:cursor-not-allowed disabled:bg-[#E7F1EF] disabled:text-[#8FA7A3]"
                  >
                    {canOpen ? label : "Completed"}
                    {canOpen ? <ChevronRight size={13} aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-10 text-center">
            <p className="text-[11.5px] font-semibold text-[#0F2D4A]">
              No consultations available
            </p>
            <p className="mt-1 text-[10.5px] text-[#8A9AAA]">
              Eligible appointments will appear here.
            </p>
          </div>
        )}

        <p className="mt-2 border-t border-[#EDF3F3] pt-3 text-[9.5px] leading-relaxed text-[#9AA9B8]">
          Demo workspace: consent, transcript, and report data are held in browser memory and are
          not saved to the database.
        </p>
      </DoctorCard>
    </div>
  );
}

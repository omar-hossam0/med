"use client";

import { CalendarClock, ClipboardList, Stethoscope } from "lucide-react";
import { DoctorOverlay } from "@/components/doctor/overview/DoctorOverlay";
import { formatClock } from "@/lib/mock/doctorPortal";
import { eligibleAppointmentFor, type PatientRecord } from "@/lib/mock/doctorPatients";

/**
 * Consultation handoff confirmation.
 *
 * A consultation must be attached to an eligible appointment, so when the
 * patient has none today the confirm action is disabled and explains why rather
 * than inventing a visit.
 */
export function StartConsultationDialog({
  record,
  onClose,
  onConfirm,
  onOpenSchedule,
}: {
  record: PatientRecord | null;
  onClose: () => void;
  onConfirm: (appointmentId: string) => void;
  onOpenSchedule: () => void;
}) {
  const appointment = record ? eligibleAppointmentFor(record.patient.id) : undefined;

  return (
    <DoctorOverlay
      open={Boolean(record)}
      onClose={onClose}
      variant="dialog"
      title="Start Consultation"
      description="Begin a new in-person consultation with the selected patient."
      footer={
        record ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="h-10 flex-1 rounded-full border border-[#E6EFEE] bg-white text-[11.5px] font-semibold text-[#0F2D4A] transition hover:border-[#BFE8E2] hover:bg-[#F8FCFB]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!appointment}
              onClick={() => appointment && onConfirm(appointment.id)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#0A9189] text-[11.5px] font-semibold text-white shadow-[0_12px_26px_-16px_rgba(10,145,137,0.9)] transition hover:bg-[#087F78] disabled:cursor-not-allowed disabled:bg-[#C3CFDA] disabled:shadow-none"
            >
              <Stethoscope size={14} aria-hidden />
              Start Consultation
            </button>
          </div>
        ) : null
      }
    >
      {record ? (
        <div className="space-y-3.5">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-[74px] w-[74px] place-items-center rounded-full bg-[#E7FBF8] text-[#0A9189]">
              <span className="grid h-[54px] w-[54px] place-items-center rounded-full border border-[#C9EEE7]">
                <Stethoscope size={26} aria-hidden />
              </span>
            </span>
            <p className="mt-3 max-w-[340px] text-[11.5px] leading-relaxed text-[#5B6B7C]">
              You are about to start a new consultation with{" "}
              <span className="font-semibold text-[#0F2D4A]">{record.patient.name}</span> (MRN:{" "}
              {record.patient.mrn}).
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-[#EAFBF7] p-3">
            <ClipboardList size={16} aria-hidden className="mt-[1px] shrink-0 text-[#0A9189]" />
            <p className="text-[10.5px] leading-relaxed text-[#33475B]">
              This will open the Consultation Workspace to document the visit, review history, and
              add clinical notes.
            </p>
          </div>

          {appointment ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#E6EFEE] px-3 py-2 text-[10px] text-[#4A5C6E]">
              <CalendarClock size={12} aria-hidden className="shrink-0 text-[#0A9189]" />
              <span className="min-w-0 flex-1 truncate">
                Linked appointment · {formatClock(appointment.time)} · {appointment.reason}
              </span>
              <span className="shrink-0 rounded-full bg-[#EAFBF7] px-2 py-[2px] text-[9px] font-semibold text-[#0A9189]">
                {appointment.status}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-[#F7E4BF] bg-[#FFF8EC] px-3 py-2.5">
              <p className="text-[10.5px] font-semibold text-[#A9740A]">
                No eligible appointment today
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#8A6A1E]">
                A consultation must be linked to a scheduled visit. Book or check in this patient
                from My Schedule first.
              </p>
              <button
                type="button"
                onClick={onOpenSchedule}
                className="mt-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-[#A9740A] transition hover:bg-[#FFFDF8]"
              >
                Open My Schedule
              </button>
            </div>
          )}

          <p className="text-[9.5px] leading-relaxed text-[#9AA9B8]">
            Demo session: starting a consultation only changes the in-browser appointment status. No
            clinical record is written to the database in this phase.
          </p>
        </div>
      ) : null}
    </DoctorOverlay>
  );
}

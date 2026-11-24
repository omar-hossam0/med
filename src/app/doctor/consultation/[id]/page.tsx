"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Info, Stethoscope } from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import { useDoctorWorkspace } from "@/components/doctor/DoctorWorkspace";
import { DoctorStatusBadge } from "@/components/doctor/overview/OverviewSections";
import { formatClock, getPortalPatient } from "@/lib/mock/doctorPortal";
import { cn } from "@/lib/cn";

const TABS = ["Summary", "Notes", "Prescription", "Lab Request", "Report"] as const;

/**
 * Consultation Workspace — scoped handoff prototype.
 *
 * This page exists so the Overview has a real destination and the "In Progress"
 * status is genuinely driven by starting a consultation. The full clinical
 * workspace (notes, recording, transcripts, AI report drafting, prescriptions,
 * lab requests, follow-up planning) is a later phase and is deliberately NOT
 * implemented here.
 */
export default function DoctorConsultationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { appointments, completeConsultation } = useDoctorWorkspace();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Summary");

  const appointment = appointments.find((item) => item.id === params.id);
  const patient = getPortalPatient(appointment?.patientId);

  if (!appointment || !patient) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => router.push("/doctor/dashboard")}
          className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition-colors duration-150 hover:text-[#0A9189]"
        >
          <ArrowLeft size={13} aria-hidden />
          Back to Overview
        </button>
        <section className="rounded-2xl border border-[#E6EFEE] bg-white p-6 text-center">
          <h1 className="text-[14px] font-semibold text-[#0F2D4A]">Consultation not found</h1>
          <p className="mt-1 text-[10.5px] text-[#7187A6]">
            No appointment matches “{params.id}”. Start a consultation from today&apos;s schedule.
          </p>
        </section>
      </div>
    );
  }

  const complete = () => {
    completeConsultation(appointment.id);
    router.push("/doctor/dashboard");
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => router.push("/doctor/dashboard")}
        className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition-colors duration-150 hover:text-[#0A9189]"
      >
        <ArrowLeft size={13} aria-hidden />
        Back to Overview
      </button>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-bold leading-tight tracking-[-0.02em] text-[#0F2D4A]">
            Consultation — {patient.name}
          </h1>
          <DoctorStatusBadge status={appointment.status} />
        </div>
        <button
          type="button"
          onClick={complete}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-[#0A9189] px-3 py-2 text-[10.5px] font-semibold text-white shadow-[0_12px_26px_-16px_rgba(10,145,137,0.9)] transition-[background-color,transform] duration-150 hover:bg-[#088078] active:translate-y-[1px]"
        >
          <CheckCircle2 size={13} aria-hidden />
          Complete Visit
        </button>
      </div>

      <section className="rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Consultation views">
          {TABS.map((item) => {
            const active = item === tab;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-[10.5px] font-semibold transition-[background-color,color] duration-150",
                  active
                    ? "bg-[#E7FBF8] text-[#0A9189]"
                    : "text-[#5B6B7C] hover:bg-[#F5FAFA] hover:text-[#0F2D4A]",
                )}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
          <div className="rounded-xl border border-[#EDF3F3] p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={patient.name} size={36} />
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-semibold text-[#0F2D4A]">{patient.name}</p>
                <p className="truncate text-[9px] text-[#7187A6]">MRN {patient.mrn}</p>
              </div>
            </div>
            <dl className="mt-2 space-y-1 border-t border-[#F2F7F7] pt-2 text-[9.5px]">
              <div className="flex justify-between gap-2">
                <dt className="text-[#7187A6]">Age</dt>
                <dd className="font-semibold text-[#0F2D4A]">{patient.age} years</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#7187A6]">Gender</dt>
                <dd className="font-semibold text-[#0F2D4A]">{patient.gender}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#7187A6]">Conditions</dt>
                <dd className="text-right font-semibold text-[#0F2D4A]">
                  {patient.conditions.length > 0 ? patient.conditions.join(", ") : "None"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#7187A6]">Allergies</dt>
                <dd className="text-right font-semibold text-[#0F2D4A]">
                  {patient.allergies.length > 0 ? patient.allergies.join(", ") : "None"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-[#EDF3F3] p-3">
            {tab === "Summary" ? (
              <>
                <h2 className="text-[10.5px] font-semibold text-[#0F2D4A]">
                  Visit Summary (In Progress)
                </h2>
                <dl className="mt-2 space-y-2">
                  <div>
                    <dt className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#9AA9B8]">
                      Appointment
                    </dt>
                    <dd className="mt-0.5 text-[10px] text-[#33475B]">
                      {formatClock(appointment.time)} · {appointment.reason}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#9AA9B8]">
                      Last recorded note
                    </dt>
                    <dd className="mt-0.5 text-[10px] leading-relaxed text-[#33475B]">
                      {patient.recentNote?.text ?? "No previous note recorded."}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-[#FFF0D2] bg-[#FFF9EE] p-2 text-[9px] leading-relaxed text-[#8A5B0B]">
                  <Info size={11} aria-hidden className="mt-[1px] shrink-0" />
                  This is a scoped handoff prototype. Notes, examination, assessment, treatment plan,
                  consented recording, transcript review and report drafting arrive in the
                  Consultation Workspace phase.
                </p>
              </>
            ) : (
              <div className="py-8 text-center">
                <Stethoscope size={20} aria-hidden className="mx-auto text-[#C3CFDA]" />
                <p className="mt-2 text-[10.5px] font-semibold text-[#0F2D4A]">
                  {tab} is part of the Consultation Workspace phase
                </p>
                <p className="mt-1 text-[9.5px] text-[#7187A6]">
                  It is not implemented in this Overview phase.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#EDF3F3] p-3">
            <h2 className="text-[10.5px] font-semibold text-[#0F2D4A]">Visit Context</h2>
            <dl className="mt-2 space-y-1.5 text-[9.5px]">
              <div className="flex justify-between gap-2">
                <dt className="text-[#7187A6]">Location</dt>
                <dd className="text-right font-semibold text-[#0F2D4A]">{appointment.location}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#7187A6]">Duration</dt>
                <dd className="font-semibold text-[#0F2D4A]">{appointment.durationMinutes} min</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#7187A6]">Status</dt>
                <dd>
                  <DoctorStatusBadge status={appointment.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#7187A6]">Medications</dt>
                <dd className="text-right font-semibold text-[#0F2D4A]">
                  {patient.medications.length > 0 ? patient.medications.join(", ") : "None"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <p className="text-[9px] leading-relaxed text-[#9AA9B8]">
        Consultation notes and clinical documentation are captured in the Consultation Workspace, not
        in the Overview. Completing the visit updates the demo session state only.
      </p>
    </div>
  );
}

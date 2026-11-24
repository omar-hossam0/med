"use client";

import {
  AlertTriangle,
  CalendarDays,
  FlaskConical,
  HeartPulse,
  Pill,
  Stethoscope,
} from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import { formatPortalDate, getPortalPatient } from "@/lib/mock/doctorPortal";
import { getPatientRecord } from "@/lib/mock/doctorPatients";
import { DoctorOverlay } from "./DoctorOverlay";
import { cn } from "@/lib/cn";

const LAB_TONE: Record<string, string> = {
  Normal: "bg-[#E7FBF8] text-[#0A9189]",
  High: "bg-[#FFF6E5] text-[#C77A0A]",
  Low: "bg-[#EFF4FF] text-[#3B6EF6]",
};

/**
 * Read-only clinical summary — shared by the Overview and the Patients module.
 *
 * Deliberately contains no editors: notes, diagnoses and prescriptions belong
 * to the Consultation Workspace, and the complete history belongs to the full
 * patient profile. This view is a pre-consultation glance only.
 */
export function PatientQuickProfile({
  patientId,
  onClose,
  onStartConsultation,
  onOpenFullProfile,
  onReviewLabs,
}: {
  patientId: string | null;
  onClose: () => void;
  onStartConsultation: (patientId: string) => void;
  onOpenFullProfile: () => void;
  onReviewLabs: () => void;
}) {
  const patient = getPortalPatient(patientId);
  const record = getPatientRecord(patientId);
  const previousVisits = record?.visits.slice(0, 2) ?? patient?.previousVisits ?? [];

  return (
    <DoctorOverlay
      open={Boolean(patient)}
      onClose={onClose}
      variant="dialog"
      title="Patient Quick Profile"
      description="A concise patient summary to quickly review key clinical information before the consultation."
      footer={
        patient ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onOpenFullProfile}
              className="h-10 flex-1 rounded-full border border-[#E6EFEE] bg-white text-[11px] font-semibold text-[#0F2D4A] transition hover:border-[#BFE8E2] hover:bg-[#F8FCFB]"
            >
              Open Full Profile
            </button>
            <button
              type="button"
              onClick={() => onStartConsultation(patient.id)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#0A9189] text-[11px] font-semibold text-white shadow-[0_12px_26px_-16px_rgba(10,145,137,0.9)] transition hover:bg-[#087F78] active:translate-y-px"
            >
              <Stethoscope size={13} aria-hidden />
              Start Consultation
            </button>
            <button
              type="button"
              onClick={onReviewLabs}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[#E6EFEE] bg-white text-[11px] font-semibold text-[#0F2D4A] transition hover:border-[#BFE8E2] hover:bg-[#F8FCFB]"
            >
              <FlaskConical size={13} aria-hidden />
              Review Labs
            </button>
          </div>
        ) : null
      }
    >
      {patient ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3.5">
            <Avatar name={patient.name} size={48} />
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-[#0F2D4A]">{patient.name}</h3>
              <p className="mt-1 text-[10.5px] text-[#7187A6]">
                {patient.age} years · {patient.gender} · MRN {patient.mrn}
              </p>
            </div>
          </div>

          <ul className="grid gap-2 sm:grid-cols-3">
            <ProfileChip
              icon={AlertTriangle}
              label="Allergies"
              values={patient.allergies}
              tone="bg-[#FDEEF1] text-[#C0353B]"
              empty="None recorded"
            />
            <ProfileChip
              icon={HeartPulse}
              label="Chronic Conditions"
              values={patient.conditions}
              tone="bg-[#FDF3E3] text-[#A9740A]"
              empty="None recorded"
            />
            <ProfileChip
              icon={Pill}
              label="Current Medications"
              values={patient.medications}
              tone="bg-[#E6F9F5] text-[#0A9189]"
              empty="None recorded"
            />
          </ul>

          <section className="rounded-2xl bg-[#F7F9FB] p-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11.5px] font-semibold text-[#0F2D4A]">Recent Notes</h4>
              {patient.recentNote ? (
                <span className="text-[9.5px] text-[#9AA9B8]">
                  {formatPortalDate(patient.recentNote.date)}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#4A5C6E]">
              {patient.recentNote?.text ?? "No recent clinical note recorded."}
            </p>
          </section>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <section className="rounded-2xl border border-[#EDF3F3] p-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11.5px] font-semibold text-[#0F2D4A]">Previous Visits</h4>
                <button
                  type="button"
                  onClick={onOpenFullProfile}
                  className="text-[9.5px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
                >
                  View All
                </button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {previousVisits.length === 0 ? (
                  <li className="text-[10px] text-[#9AA9B8]">No previous visits recorded.</li>
                ) : (
                  previousVisits.map((visit) => (
                    <li key={visit.id} className="flex items-start gap-1.5">
                      <CalendarDays
                        size={11}
                        aria-hidden
                        className="mt-[2px] shrink-0 text-[#9AA9B8]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[9.5px] text-[#8A9AAA]">
                          {formatPortalDate(visit.date)}
                        </span>
                        <span className="block truncate text-[10px] font-medium text-[#0F2D4A]">
                          {visit.title}
                        </span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-[#EDF3F3] p-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11.5px] font-semibold text-[#0F2D4A]">Recent Lab Results</h4>
                <button
                  type="button"
                  onClick={onReviewLabs}
                  className="text-[9.5px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
                >
                  View All
                </button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {patient.recentLabs.length === 0 ? (
                  <li className="text-[10px] text-[#9AA9B8]">No recent lab results.</li>
                ) : (
                  patient.recentLabs.map((lab) => (
                    <li key={lab.id} className="flex items-center gap-1.5">
                      <FlaskConical size={11} aria-hidden className="shrink-0 text-[#9AA9B8]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] font-medium text-[#0F2D4A]">
                          {lab.name}
                        </span>
                        <span className="block text-[9px] text-[#8A9AAA]">
                          {formatPortalDate(lab.date)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-[2px] text-[8.5px] font-semibold",
                          LAB_TONE[lab.status] ?? "bg-[#F1F6F6] text-[#5B6B7C]",
                        )}
                      >
                        {lab.status}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </DoctorOverlay>
  );
}

function ProfileChip({
  icon: Icon,
  label,
  values,
  tone,
  empty,
}: {
  icon: typeof AlertTriangle;
  label: string;
  values: string[];
  tone: string;
  empty: string;
}) {
  return (
    <li className={cn("rounded-3xl px-3.5 py-2.5", tone)}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold">
        <Icon size={11} aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-[10.5px] font-medium leading-snug">
        {values.length > 0 ? values.join(", ") : empty}
      </p>
    </li>
  );
}

"use client";

import { useState } from "react";
import {
  CalendarCheck,
  Check,
  ClipboardList,
  FileText,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";
import { DoctorOverlay } from "@/components/doctor/overview/DoctorOverlay";
import { formatPortalDate, formatClock, type PortalAppointment, type PortalPatient } from "@/lib/mock/doctorPortal";
import { formatShortDate } from "@/lib/mock/doctorSchedule";
import type { ConsultationState } from "@/lib/consultation/model";
import { Chip, OutlineButton, PrimaryButton, StepCard } from "./ui";
import { cn } from "@/lib/cn";

type Indicator = { label: string; value: string; done: boolean };

export function completionIndicators(state: ConsultationState): Indicator[] {
  const reports = [state.reports.report1, state.reports.report2, state.reports.report3].filter(Boolean);
  const approvedReports = reports.filter((report) => ["approved", "published"].includes(report.status)).length;

  return [
    {
      label: "Transcript",
      value: state.transcript.status === "approved" ? "Approved" : "Pending review",
      done: state.transcript.status === "approved",
    },
    {
      label: "Reports",
      value: reports.length === 0 ? "Not generated" : `${approvedReports}/3 approved`,
      done: reports.length === 3 && approvedReports === 3,
    },
    {
      label: "Medical Record",
      value:
        state.recordUpdates.status === "applied"
          ? "Updated"
          : state.recordUpdates.status === "deferred"
            ? "Updates pending"
            : "Not applied",
      done: state.recordUpdates.status === "applied",
    },
    {
      label: "Follow-up",
      value:
        state.followUp.status === "confirmed"
          ? "Awaiting staff confirmation"
          : state.followUp.status === "declined"
            ? "No follow-up required"
            : state.followUp.status === "proposed"
              ? "Awaiting patient selection"
              : state.followUp.status === "accepted"
                ? "Recommendation accepted"
                : "Not set",
      done: state.followUp.status === "confirmed" || state.followUp.status === "declined",
    },
  ];
}

export function isFullyComplete(state: ConsultationState): boolean {
  return completionIndicators(state).every((indicator) => indicator.done);
}

/** Screen 09 — Consultation Completed. */
export function CompletedStep({
  state,
  patient,
  appointment,
  onBackToWorkspace,
  onFinish,
}: {
  state: ConsultationState;
  patient: PortalPatient;
  appointment: PortalAppointment;
  onBackToWorkspace: () => void;
  onFinish: () => void;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const indicators = completionIndicators(state);
  const complete = indicators.every((indicator) => indicator.done);

  return (
    <>
      <StepCard className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#EAFBF7_0%,rgba(234,251,247,0)_62%)]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 flex justify-center gap-10">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span
              key={index}
              className={cn(
                "block h-[3px] w-4 rounded-full",
                index % 2 === 0 ? "bg-[#0A9189]/40" : "bg-[#BFE8E2]",
                index % 3 === 0 && "rotate-[18deg]",
                index % 3 === 1 && "-rotate-[24deg]",
              )}
            />
          ))}
        </div>

        <div className="relative flex flex-col items-center px-4 py-8 text-center sm:px-6">
          <span
            className={cn(
              "grid h-[74px] w-[74px] place-items-center rounded-full text-white shadow-[0_18px_36px_-18px_rgba(10,145,137,0.9)]",
              complete ? "bg-[#0A9189]" : "bg-[#C77A0A]",
            )}
          >
            <Check size={36} strokeWidth={3} aria-hidden />
          </span>

          <h1 className="mt-4 text-[19px] font-bold tracking-[-0.01em] text-[#0F2D4A] sm:text-[22px]">
            {complete ? "Consultation Completed Successfully" : "Consultation Ended — Review Pending"}
          </h1>
          <p className="mt-1.5 max-w-[460px] text-[11.5px] leading-relaxed text-[#5B6B7C]">
            {complete
              ? "The consultation workflow has been completed."
              : "The visit is finished, but some clinical review work is still open. Nothing pending has been marked as done."}
          </p>

          <ul className="mt-5 grid w-full max-w-[720px] gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {indicators.map((indicator) => (
              <li
                key={indicator.label}
                className={cn(
                  "flex items-start gap-2 rounded-xl px-3 py-2.5 text-left",
                  indicator.done ? "bg-[#EAFBF7]" : "bg-[#FFF8EC]",
                )}
              >
                <span
                  className={cn(
                    "mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full",
                    indicator.done ? "bg-[#0A9189] text-white" : "border border-[#E0A106] text-transparent",
                  )}
                >
                  <Check size={10} strokeWidth={3.5} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10.5px] font-bold text-[#0F2D4A]">{indicator.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[9.5px] leading-snug",
                      indicator.done ? "text-[#0A9189]" : "text-[#A9740A]",
                    )}
                  >
                    {indicator.value}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <OutlineButton onClick={() => setSummaryOpen(true)} size="lg">
              <ClipboardList size={14} aria-hidden />
              View Consultation Summary
            </OutlineButton>
            <PrimaryButton
              size="lg"
              onClick={() => {
                onFinish();
                onBackToWorkspace();
              }}
            >
              Back to Consultation Workspace
            </PrimaryButton>
          </div>

          <p className="mt-3 text-[9px] text-[#9AA9B8]">
            {patient.name} · MRN {patient.mrn} · {formatClock(appointment.time)}
          </p>
        </div>
      </StepCard>

      <ConsultationSummaryDialog
        open={summaryOpen}
        state={state}
        patient={patient}
        appointment={appointment}
        onClose={() => setSummaryOpen(false)}
        onBackToWorkspace={() => {
          setSummaryOpen(false);
          onFinish();
          onBackToWorkspace();
        }}
      />
    </>
  );
}

/** Consultation summary — the audit-friendly view of what actually happened. */
export function ConsultationSummaryDialog({
  open,
  state,
  patient,
  appointment,
  onClose,
  onBackToWorkspace,
}: {
  open: boolean;
  state: ConsultationState;
  patient: PortalPatient;
  appointment: PortalAppointment;
  onClose: () => void;
  onBackToWorkspace: () => void;
}) {
  const indicators = completionIndicators(state);
  const applied = state.recordUpdates.proposals.filter((proposal) => proposal.applied);
  const pending = indicators.filter((indicator) => !indicator.done);

  return (
    <DoctorOverlay
      open={open}
      onClose={onClose}
      variant="dialog"
      size="xl"
      title="Consultation Summary"
      description={`${patient.name} · MRN ${patient.mrn} · ${formatClock(appointment.time)}`}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OutlineButton onClick={onClose}>Close</OutlineButton>
          <PrimaryButton onClick={onBackToWorkspace} arrow>
            Back to Workspace
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <SummaryBlock icon={HeartPulse} title="Patient">
            <p className="text-[11px] font-semibold text-[#0F2D4A]">{patient.name}</p>
            <p className="mt-0.5 text-[10px] text-[#7187A6]">
              {patient.age} years · {patient.gender} · MRN {patient.mrn}
            </p>
          </SummaryBlock>

          <SummaryBlock icon={CalendarCheck} title="Consultation">
            <p className="text-[11px] font-semibold text-[#0F2D4A]">{state.reason}</p>
            <p className="mt-0.5 text-[10px] text-[#7187A6]">
              {formatPortalDate(new Date().toISOString().slice(0, 10))} · {formatClock(appointment.time)} ·{" "}
              {appointment.location}
            </p>
          </SummaryBlock>

          <SummaryBlock icon={ShieldCheck} title="Consent">
            <ul className="space-y-1">
              <ConsentLine on={state.consent.audio} label="Audio recording" />
              <ConsentLine on={state.consent.transcription} label="Transcription" />
              <ConsentLine on={state.consent.ai} label="AI-assisted documentation" />
            </ul>
            {state.consent.declined ? (
              <p className="mt-1.5 text-[9.5px] font-semibold text-[#A9740A]">
                Recording was declined by the patient.
              </p>
            ) : null}
          </SummaryBlock>

          <SummaryBlock icon={FileText} title="Transcript">
            <p className="text-[11px] font-semibold text-[#0F2D4A]">
              {state.transcript.status === "approved" ? "Approved" : "Draft"} · v{state.transcript.version}
            </p>
            <p className="mt-0.5 text-[10px] text-[#7187A6]">
              {state.transcript.entries.length} entries
              {state.recording.seconds > 0 ? ` · ${Math.round(state.recording.seconds / 60) || 1} min audio` : ""}
            </p>
          </SummaryBlock>
        </div>

        <div className="rounded-xl border border-[#EDF3F3] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">Reports</p>
          <ul className="mt-1.5 space-y-1.5">
            {(["report1", "report2", "report3"] as const).map((key) => {
              const report = state.reports[key];
              if (!report) return null;
              return (
                <li key={key} className="flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] font-medium text-[#0F2D4A]">
                    {report.title} · {report.subtitle}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="text-[9px] text-[#9AA9B8]">v{report.version}</span>
                    <Chip
                      tone={
                        report.status === "published"
                          ? "teal"
                          : report.status === "approved"
                            ? "green"
                            : report.status === "rejected"
                              ? "red"
                              : "amber"
                      }
                      dot
                    >
                      {report.status === "published"
                        ? "Published to patient"
                        : report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </Chip>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <SummaryBlock icon={ClipboardList} title="Record updates">
            {applied.length === 0 ? (
              <p className="text-[10px] text-[#8A9AAA]">
                {state.recordUpdates.status === "deferred"
                  ? "Deferred for later review — no changes applied."
                  : "No updates applied."}
              </p>
            ) : (
              <ul className="space-y-1">
                {applied.map((proposal) => (
                  <li key={proposal.id} className="text-[10px] text-[#33475B]">
                    • {proposal.title}
                  </li>
                ))}
              </ul>
            )}
          </SummaryBlock>

          <SummaryBlock icon={CalendarCheck} title="Follow-up">
            <p className="text-[11px] font-semibold text-[#0F2D4A]">
              {indicators[3].value}
            </p>
            {state.followUp.selectedSlotId ? (
              <p className="mt-0.5 text-[10px] text-[#7187A6]">
                Preferred slot:{" "}
                {formatShortDate(
                  state.followUp.slots.find((slot) => slot.id === state.followUp.selectedSlotId)?.date ?? "",
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-[10px] text-[#7187A6]">
                Recommended in {state.followUp.weeks} weeks
              </p>
            )}
          </SummaryBlock>
        </div>

        {pending.length > 0 ? (
          <div className="rounded-xl border border-[#F7E4BF] bg-[#FFF8EC] px-3 py-2.5">
            <p className="text-[10.5px] font-semibold text-[#A9740A]">Remaining clinical tasks</p>
            <ul className="mt-1 space-y-0.5">
              {pending.map((indicator) => (
                <li key={indicator.label} className="text-[10px] text-[#8A6A1E]">
                  • {indicator.label}: {indicator.value}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.notes ? (
          <div className="rounded-xl bg-[#F7FCFB] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">
              Doctor&apos;s notes
            </p>
            <p className="mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-[#33475B]">
              {state.notes}
            </p>
          </div>
        ) : null}
      </div>
    </DoctorOverlay>
  );
}

function SummaryBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof HeartPulse;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#EDF3F3] p-3">
      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">
        <Icon size={11} aria-hidden className="text-[#0A9189]" />
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ConsentLine({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-[10px] text-[#33475B]">
      <span
        className={cn(
          "grid h-3.5 w-3.5 place-items-center rounded-full",
          on ? "bg-[#0A9189] text-white" : "border border-[#DDE9E8] text-transparent",
        )}
      >
        <Check size={8} strokeWidth={4} aria-hidden />
      </span>
      {label}
      <span className="ml-auto text-[9px] text-[#9AA9B8]">{on ? "Given" : "Not given"}</span>
    </li>
  );
}

/** Small helper used by the workspace list for a completed row. */
export function CompletedBadge({ state }: { state: ConsultationState }) {
  return (
    <Chip tone={isFullyComplete(state) ? "green" : "amber"} dot>
      {isFullyComplete(state) ? "Completed" : "Review pending"}
    </Chip>
  );
}

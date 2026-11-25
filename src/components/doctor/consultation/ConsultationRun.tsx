"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { useDoctorWorkspace } from "@/components/doctor/DoctorWorkspace";
import { getPortalPatient } from "@/lib/mock/doctorPortal";
import {
  resumeStep,
  unlockedSteps,
  type ReportKey,
  type StepKey,
} from "@/lib/consultation/model";
import { ConsultationStepper, PatientContextHeader } from "./ConsultationShell";
import { useConsultationWorkflow } from "./ConsultationWorkflowProvider";
import { ConsentStep } from "./ConsentStep";
import { RecordingStep } from "./RecordingStep";
import { TranscriptStep } from "./TranscriptStep";
import { GenerationStep } from "./GenerationStep";
import { ReportsStep } from "./ReportsStep";
import { RecordUpdatesStep } from "./RecordUpdatesStep";
import { FollowUpStep } from "./FollowUpStep";
import { CompletedStep } from "./CompletedStep";
import { OutlineButton } from "./ui";

/**
 * The consultation runner.
 *
 * Owns step routing and the guards between steps. The URL can request a step,
 * but only the workflow state decides whether that step is unlocked — a
 * hand-typed `?step=reports` cannot skip consent or approval.
 */
export function ConsultationRun({
  appointmentId,
  requestedStep,
}: {
  appointmentId: string;
  requestedStep: string | null;
}) {
  const router = useRouter();
  const { appointments, completeConsultation } = useDoctorWorkspace();
  const workflow = useConsultationWorkflow();
  const [toast, setToast] = useState<string | null>(null);
  const [reviewKey, setReviewKey] = useState<ReportKey | null>(null);
  const ensured = useRef(false);

  const appointment = appointments.find((item) => item.id === appointmentId);
  const patient = getPortalPatient(appointment?.patientId);
  const state = workflow.stateFor(appointmentId);

  useEffect(() => {
    if (!appointment || ensured.current) return;
    ensured.current = true;
    workflow.ensure(appointment.id, appointment.patientId, appointment.reason);
  }, [appointment, workflow]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const go = useCallback(
    (step: StepKey | "completed") => {
      router.push(`/doctor/consultation/${appointmentId}?step=${step}`);
    },
    [router, appointmentId],
  );

  const unlocked = useMemo(() => unlockedSteps(state), [state]);

  const requested = requestedStep as StepKey | "completed" | null;
  const blocked = requested !== null && requested !== "completed" && !unlocked.includes(requested);
  const step: StepKey | "completed" = useMemo(() => {
    if (requested === "completed") return "completed";
    if (requested && unlocked.includes(requested)) return requested;
    return resumeStep(state);
  }, [requested, unlocked, state]);

  if (!appointment || !patient) {
    return (
      <div className="space-y-3">
        <Link
          href="/doctor/consultation"
          className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:text-[#0A9189]"
        >
          <ArrowLeft size={13} aria-hidden />
          Back to Consultation Workspace
        </Link>
        <section className="rounded-2xl border border-[#E6EFEE] bg-white p-8 text-center">
          <h1 className="text-[14px] font-semibold text-[#0F2D4A]">Consultation not found</h1>
          <p className="mt-1 text-[10.5px] text-[#7187A6]">
            No appointment matches “{appointmentId}”. Start a consultation from the workspace list.
          </p>
        </section>
      </div>
    );
  }

  const id = appointment.id;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/doctor/consultation"
          className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:text-[#0A9189]"
        >
          <ArrowLeft size={13} aria-hidden />
          Consultation Workspace
        </Link>
        <p className="text-[9.5px] text-[#9AA9B8]">
          Demo session — consent, transcript and reports stay in this browser tab.
        </p>
      </div>

      <PatientContextHeader patient={patient} appointment={appointment} reason={state.reason || appointment.reason} />

      <ConsultationStepper state={state} current={step} onNavigate={(next) => go(next)} />

      {blocked ? (
        <p className="flex items-start gap-1.5 rounded-xl border border-[#F7E4BF] bg-[#FFF8EC] px-3 py-2 text-[10px] leading-relaxed text-[#8A6A1E]">
          <Info size={12} aria-hidden className="mt-[1px] shrink-0" />
          That step is not available yet — the required approval has not been completed. You were moved
          to the next step you can work on.
        </p>
      ) : null}

      {step === "consent" ? (
        <ConsentStep
          state={state}
          onChange={(patch) => workflow.setConsent(id, patch)}
          onRecord={() => workflow.recordConsent(id)}
          onDecline={() => workflow.declineRecording(id)}
          onContinue={() => go("recording")}
          onContinueWithoutRecording={() => {
            workflow.recordConsent(id);
            go("transcript");
          }}
          onBack={() => router.push("/doctor/consultation")}
        />
      ) : null}

      {step === "recording" ? (
        <RecordingStep
          state={state}
          patient={patient}
          onStart={() => workflow.startRecording(id)}
          onPause={() => workflow.pauseRecording(id)}
          onResume={() => workflow.resumeRecording(id)}
          onStop={() => workflow.stopRecording(id)}
          onRetry={() => workflow.retryProcessing(id)}
          onContinue={() => go("transcript")}
          onBack={() => go("consent")}
          onNotes={(value) => workflow.setNotes(id, value)}
          onViewProfile={() => router.push(`/doctor/patients/${patient.id}`)}
        />
      ) : null}

      {step === "transcript" ? (
        <TranscriptStep
          state={state}
          onChangeEntry={(entryId, text) => workflow.setTranscriptEntry(id, entryId, text)}
          onSaveDraft={() => workflow.saveTranscriptDraft(id)}
          onApprove={() => {
            workflow.approveTranscript(id);
            setToast("Transcript approved. Report generation is unlocked.");
          }}
          onBack={() => go(state.consent.declined ? "consent" : "recording")}
          onContinue={() => go("reports")}
          onNotify={setToast}
        />
      ) : null}

      {step === "reports" ? (
        <>
          {state.generation.status === "done" || state.generation.status === "failed" ? (
            <ReportsStep
              state={state}
              reviewKey={reviewKey}
              onCloseReview={() => setReviewKey(null)}
              onOpenReview={(key) => setReviewKey(key)}
              onApproveSelected={(keys) => {
                keys.forEach((key) => workflow.setReportStatus(id, key, "approved"));
                setToast(`${keys.length} report${keys.length === 1 ? "" : "s"} approved.`);
              }}
              onPublishReport1={() => {
                workflow.publishReport1(id);
                setToast("Report 1 published to the patient in this demo session.");
              }}
              onContinue={() => go("record-updates")}
              onBack={() => go("transcript")}
            />
          ) : (
            <GenerationStep
              state={state}
              onRetry={() => workflow.startGeneration(id)}
              onReview={() => {
                /* drafts are shown by this same step once generation is done */
              }}
              onBack={() => go("transcript")}
              onFail={() => setToast("Simulated failure — no reports were created.")}
            />
          )}
        </>
      ) : null}

      {step === "record-updates" ? (
        <RecordUpdatesStep
          state={state}
          onToggle={(proposalId) => workflow.toggleProposal(id, proposalId)}
          onApply={() => {
            workflow.applyProposals(id);
            setToast("Selected updates applied to the demo record.");
          }}
          onRejectAll={() => {
            workflow.rejectAllProposals(id);
            setToast("All proposals rejected. Nothing was applied.");
          }}
          onDefer={() => {
            workflow.deferUpdates(id);
            setToast("Updates deferred for later review.");
          }}
          onContinue={() => go("follow-up")}
          onBack={() => go("reports")}
        />
      ) : null}

      {step === "follow-up" ? (
        <FollowUpStep
          state={state}
          onSetWeeks={(weeks) => workflow.setFollowUp(id, { weeks })}
          onPropose={() => {
            workflow.proposeSlots(id);
            setToast("Agent 3 proposed three demo slots — none of them is booked.");
          }}
          onSelectSlot={(slotId) => workflow.setFollowUp(id, { selectedSlotId: slotId })}
          onSend={() => {
            workflow.sendSlots(id);
            setToast("Slots sent in this demo session. Booking still needs staff confirmation.");
          }}
          onConfirm={() => {
            workflow.setFollowUp(id, { status: "confirmed" });
            setToast("Follow-up recommendation confirmed — awaiting staff confirmation.");
          }}
          onDecline={() => {
            workflow.setFollowUp(id, { status: "declined" });
            setToast("Follow-up declined.");
          }}
          onNoFollowUp={() => {
            workflow.setFollowUp(id, { status: "declined", selectedSlotId: null });
            setToast("Recorded as no follow-up required.");
          }}
          onContinue={() => go("completed")}
          onBack={() => go("record-updates")}
        />
      ) : null}

      {step === "completed" ? (
        <>
          <CompletedStep
            state={state}
            patient={patient}
            appointment={appointment}
            onBackToWorkspace={() => router.push("/doctor/consultation")}
            onFinish={() => {
              workflow.complete(id);
              completeConsultation(id);
            }}
          />
          {state.completed ? (
            <div className="flex justify-center">
              <OutlineButton onClick={() => router.push(`/doctor/patients/${patient.id}`)}>
                Open patient profile
              </OutlineButton>
            </div>
          ) : null}
        </>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[90] w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 rounded-xl bg-navy px-4 py-2.5 text-center text-[11.5px] font-medium text-white shadow-pop"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

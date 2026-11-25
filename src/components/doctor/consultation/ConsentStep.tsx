"use client";

import { ArrowLeft, Check, FileText, ShieldCheck } from "lucide-react";
import type { ConsultationState } from "@/lib/consultation/model";
import {
  ActionBar,
  ConsentCheckbox,
  DemoNote,
  OutlineButton,
  PrimaryButton,
  StepCard,
  StepHeading,
} from "./ui";

/**
 * Screen 02 — Patient Consent.
 *
 * The three decisions are independent and recorded explicitly. Nothing here is
 * pre-ticked: consent is never assumed, and declining recording is a first-class
 * outcome rather than an error.
 */
export function ConsentStep({
  state,
  onChange,
  onRecord,
  onDecline,
  onContinue,
  onBack,
  onContinueWithoutRecording,
}: {
  state: ConsultationState;
  onChange: (patch: Partial<ConsultationState["consent"]>) => void;
  onRecord: () => void;
  onDecline: () => void;
  onContinue: () => void;
  onBack: () => void;
  onContinueWithoutRecording: () => void;
}) {
  const { consent } = state;
  const recorded = Boolean(consent.recordedAt);
  const canContinue = consent.audio && recorded && !consent.declined;

  return (
    <StepCard>
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <StepHeading
          title="Patient Consent"
          description="Obtain the patient's consent for audio recording, transcription, and AI-assisted report generation as part of the consultation."
        />
      </div>

      <div className="grid gap-4 px-4 pb-4 pt-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_190px]">
        <div className="space-y-3.5">
          <ConsentCheckbox
            checked={consent.audio}
            onChange={(next) => onChange({ audio: next, declined: false })}
          >
            I consent to audio recording of this consultation.
          </ConsentCheckbox>
          <ConsentCheckbox checked={consent.transcription} onChange={(next) => onChange({ transcription: next })}>
            I consent to conversion of the recording to a text transcript.
          </ConsentCheckbox>
          <ConsentCheckbox checked={consent.ai} onChange={(next) => onChange({ ai: next })}>
            I consent to the use of AI to generate clinical reports and update my medical record (with
            doctor review and approval).
          </ConsentCheckbox>

          {consent.declined ? (
            <div className="rounded-xl border border-[#F7E4BF] bg-[#FFF8EC] px-3 py-2.5">
              <p className="text-[10.5px] font-semibold text-[#A9740A]">Recording declined</p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#8A6A1E]">
                The patient declined audio recording. No audio will be captured and no transcript will
                be produced automatically — you can document this consultation manually.
              </p>
            </div>
          ) : null}

          {recorded && !consent.declined && !consent.ai ? (
            <p className="rounded-xl bg-[#F7FCFB] px-3 py-2 text-[10px] leading-relaxed text-[#8A9AAA]">
              AI report generation stays disabled until the patient consents to AI-assisted
              documentation. You can still record and review the transcript.
            </p>
          ) : null}

          <DemoNote>
            Consent is recorded in this browser session only. In production it is stored with the
            consultation record and is auditable.
          </DemoNote>
        </div>

        <div className="hidden place-items-center lg:grid">
          <div className="relative grid h-[132px] w-[132px] place-items-center rounded-full bg-[#EAFBF7]">
            <div className="grid h-[86px] w-[86px] place-items-center rounded-full border border-[#CFEFE9] bg-white/70 text-[#0A9189]">
              <FileText size={34} aria-hidden />
            </div>
            <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-[#0A9189] text-white ring-4 ring-white">
              <Check size={16} strokeWidth={3} aria-hidden />
            </span>
            <ShieldCheck
              size={15}
              aria-hidden
              className="absolute -left-1 top-3 text-[#0A9189]/40"
            />
          </div>
        </div>
      </div>

      <ActionBar>
        <OutlineButton onClick={onBack} className="mr-auto">
          <ArrowLeft size={13} aria-hidden />
          Back
        </OutlineButton>
        {!recorded ? (
          <button
            type="button"
            onClick={onDecline}
            className="h-9 rounded-full px-3 text-[10.5px] font-semibold text-[#8A9AAA] transition hover:text-[#C0353B]"
          >
            Record declined consent
          </button>
        ) : null}
        {consent.declined ? (
          <PrimaryButton onClick={onContinueWithoutRecording} arrow>
            Continue without recording
          </PrimaryButton>
        ) : !recorded ? (
          <PrimaryButton onClick={onRecord} disabled={!consent.audio} arrow>
            Record Consent
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={onContinue} disabled={!canContinue} arrow>
            Continue to Recording
          </PrimaryButton>
        )}
      </ActionBar>
    </StepCard>
  );
}

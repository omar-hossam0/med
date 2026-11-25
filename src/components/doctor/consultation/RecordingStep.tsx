"use client";

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  FileText,
  Heart,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { formatPortalDate, type PortalPatient } from "@/lib/mock/doctorPortal";
import { getPatientRecord } from "@/lib/mock/doctorPatients";
import type { ConsultationState } from "@/lib/consultation/model";
import {
  ActionBar,
  Chip,
  DangerButton,
  DemoNote,
  OutlineButton,
  PrimaryButton,
  SecondaryButton,
  StepCard,
  StepHeading,
} from "./ui";
import { cn } from "@/lib/cn";

const BARS = 72;

/** Deterministic bar heights so the waveform looks the same on every render. */
const HEIGHTS = Array.from({ length: BARS }, (_, index) => {
  const wave = Math.sin(index / 3.1) * 0.5 + Math.sin(index / 1.7) * 0.3 + Math.sin(index / 7) * 0.2;
  return Math.round(10 + Math.abs(wave) * 30);
});

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
}

/**
 * Screen 03 — Audio Recording.
 *
 * No microphone is opened in this phase: the waveform and timer are labelled
 * demo pacing, and the transcript is generated from fixtures after "processing".
 */
export function RecordingStep({
  state,
  patient,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetry,
  onContinue,
  onBack,
  onNotes,
  onViewProfile,
}: {
  state: ConsultationState;
  patient: PortalPatient;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetry: () => void;
  onContinue: () => void;
  onBack: () => void;
  onNotes: (value: string) => void;
  onViewProfile: () => void;
}) {
  const { recording } = state;
  const record = getPatientRecord(patient.id);
  const active = recording.status === "recording";
  const paused = recording.status === "paused";
  const processing = recording.status === "processing";
  const stopped = recording.status === "stopped";

  // Transcription finishing moves the doctor on, as the workflow describes.
  const navigated = useRef(false);
  useEffect(() => {
    if (stopped && !navigated.current) {
      navigated.current = true;
      onContinue();
    }
  }, [stopped, onContinue]);

  if (processing) {
    return (
      <StepCard className="p-6 sm:p-10">
        <div className="mx-auto flex max-w-[420px] flex-col items-center text-center">
          <span className="relative grid h-[76px] w-[76px] place-items-center rounded-full bg-[#EAFBF7] text-[#0A9189]">
            <span className="absolute inset-0 animate-pulseRing rounded-full border border-[#0A9189]/30" />
            <Loader2 size={30} aria-hidden className="animate-spin" />
          </span>
          <h2 className="mt-4 text-[16px] font-bold text-[#0F2D4A]">Transcribing audio…</h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#5B6B7C]">
            The recording is being converted into a draft transcript. This usually takes a few
            seconds — the result still needs your review and approval.
          </p>
          <div className="mt-4 flex items-center gap-1.5">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0A9189]"
                style={{ animationDelay: `${index * 180}ms` }}
              />
            ))}
          </div>
          <DemoNote>
            Demo: transcription is simulated from fixture data. No speech-to-text engine is called.
          </DemoNote>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-[10px] font-semibold text-[#8A9AAA] transition hover:text-[#0A9189]"
          >
            Stuck? Retry transcription
          </button>
        </div>
      </StepCard>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_290px]">
      <StepCard className="flex flex-col">
        <div className="px-4 pt-4 sm:px-5">
          <StepHeading
            title="Consultation Recording"
            badge={
              active ? (
                <Chip tone="red" dot>
                  Live
                </Chip>
              ) : stopped ? (
                <Chip tone="green">Completed</Chip>
              ) : paused ? (
                <Chip tone="amber">Paused</Chip>
              ) : (
                <Chip tone="gray">Ready</Chip>
              )
            }
          />
        </div>

        <div className="px-4 pb-4 pt-3.5 sm:px-5">
          <div
            className={cn(
              "rounded-2xl bg-[#F2FBF9] px-4 py-4 transition-colors duration-200",
              active && "cw-wave-active",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11.5px] font-semibold",
                  active ? "text-[#C0353B]" : paused ? "text-[#A9740A]" : "text-[#0A9189]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-2 w-2 rounded-full",
                    active ? "animate-pulse bg-[#E5484D]" : paused ? "bg-[#E0A106]" : "bg-[#0A9189]",
                  )}
                />
                {active ? "Recording…" : paused ? "Paused" : stopped ? "Recording complete" : "Ready to record"}
              </span>
              <span className="text-[9.5px] text-[#8A9AAA]">
                {active || paused ? "Demo pacing — no microphone is captured" : "Consent recorded"}
              </span>
            </div>

            <div className="mt-3 flex h-[64px] items-center justify-center gap-[3px]" aria-hidden>
              {HEIGHTS.map((height, index) => (
                <span
                  key={index}
                  className="cw-wave-bar w-[3px] shrink-0 rounded-full bg-[#0A9189]"
                  style={{
                    height,
                    opacity: active ? 0.9 : paused ? 0.45 : 0.28,
                    animationDelay: `${(index % 12) * 70}ms`,
                    animationDuration: `${900 + (index % 5) * 120}ms`,
                  }}
                />
              ))}
            </div>

            <p className="mt-3 text-center text-[19px] font-bold tabular-nums tracking-[0.04em] text-[#0F2D4A]">
              {formatDuration(recording.seconds)}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {recording.status === "idle" || recording.status === "stopped" ? (
              <PrimaryButton onClick={onStart} size="lg">
                <Mic size={14} aria-hidden />
                {stopped ? "Record again" : "Start Recording"}
              </PrimaryButton>
            ) : null}
            {active ? (
              <SecondaryButton onClick={onPause} size="lg">
                <Pause size={14} aria-hidden />
                Pause
              </SecondaryButton>
            ) : null}
            {paused ? (
              <SecondaryButton onClick={onResume} size="lg">
                <Play size={14} aria-hidden />
                Resume
              </SecondaryButton>
            ) : null}
            {active || paused ? (
              <DangerButton onClick={onStop} size="lg">
                <Square size={13} aria-hidden />
                Stop
              </DangerButton>
            ) : null}
            {stopped ? (
              <OutlineButton onClick={onContinue} size="lg">
                <FileText size={13} aria-hidden />
                Review transcript
              </OutlineButton>
            ) : null}
          </div>

          {recording.status === "idle" ? (
            <p className="mt-3 text-center text-[10px] text-[#8A9AAA]">
              Keep the microphone within reach and confirm the patient is comfortable before starting.
            </p>
          ) : null}
        </div>

        <div className="border-t border-[#F2F7F7] px-4 py-3 sm:px-5">
          <label
            htmlFor="consultation-notes"
            className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]"
          >
            Clinical notes (optional)
          </label>
          <textarea
            id="consultation-notes"
            value={state.notes}
            onChange={(event) => onNotes(event.target.value)}
            rows={2}
            placeholder="Jot down anything you want to remember. Notes stay separate from the generated transcript."
            className="mt-1.5 w-full resize-y rounded-xl border border-[#E6EFEE] px-3 py-2 text-[11px] leading-relaxed text-[#0F2D4A] outline-none transition placeholder:text-[#A8B6C4] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
          />
          <p className="mt-1.5 text-[9px] text-[#9AA9B8]">
            Manual notes are not approved clinical reports and are not sent to the AI.
          </p>
        </div>

        <ActionBar className="mt-auto">
          <OutlineButton onClick={onBack} className="mr-auto">
            <ArrowLeft size={13} aria-hidden />
            Back to consent
          </OutlineButton>
          <PrimaryButton onClick={onContinue} disabled={!stopped} arrow>
            Continue to Transcript
          </PrimaryButton>
        </ActionBar>
      </StepCard>

      <StepCard className="h-fit p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[12.5px] font-bold text-[#0F2D4A]">Patient Snapshot</h3>
          <button
            type="button"
            onClick={onViewProfile}
            className="text-[9.5px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
          >
            View profile
          </button>
        </div>

        <ul className="mt-3 space-y-3">
          <SnapshotRow
            icon={Heart}
            label="Conditions"
            value={patient.conditions.join(", ") || "None recorded"}
          />
          <SnapshotRow
            icon={AlertTriangle}
            label="Allergies"
            value={patient.allergies.join(", ") || "None recorded"}
          />
          <SnapshotRow
            icon={FileText}
            label="Current Medications"
            value={patient.medications.join("; ") || "None recorded"}
          />
          <SnapshotRow
            icon={CalendarDays}
            label="Last Visit"
            value={record?.lastVisit ? formatPortalDate(record.lastVisit) : "—"}
          />
        </ul>

        <div className="mt-3 rounded-xl bg-[#F7FCFB] px-3 py-2">
          <p className="text-[9px] leading-relaxed text-[#8A9AAA]">
            Read-only snapshot from the patient record. Opening the full profile does not change this
            consultation.
          </p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 text-[9px] text-[#B6C2CE] transition hover:text-[#8A9AAA]"
        >
          <RotateCcw size={9} aria-hidden />
          Reset demo transcription
        </button>
      </StepCard>
    </div>
  );
}

function SnapshotRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EAFBF7] text-[#0A9189]">
        <Icon size={13} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold text-[#0F2D4A]">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-[#7187A6]">{value}</span>
      </span>
    </li>
  );
}

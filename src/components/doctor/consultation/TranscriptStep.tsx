"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Pencil,
  ShieldCheck,
  Sparkles,
  Undo2,
} from "lucide-react";
import { DoctorOverlay } from "@/components/doctor/overview/DoctorOverlay";
import type { ConsultationState, TranscriptEntry } from "@/lib/consultation/model";
import {
  ActionBar,
  Chip,
  DemoNote,
  OutlineButton,
  PrimaryButton,
  SecondaryButton,
  StepCard,
  StepHeading,
} from "./ui";
import { cn } from "@/lib/cn";

/**
 * Screen 04 — Transcript Review & Approval.
 *
 * The approved version is what Agent 1 receives. Editing after approval returns
 * the transcript to draft and bumps the version, so a report can never be
 * attributed to text the doctor did not approve.
 */
export function TranscriptStep({
  state,
  onChangeEntry,
  onSaveDraft,
  onApprove,
  onBack,
  onContinue,
  onNotify,
}: {
  state: ConsultationState;
  onChangeEntry: (entryId: string, text: string) => void;
  onSaveDraft: () => void;
  onApprove: () => void;
  onBack: () => void;
  onContinue: () => void;
  onNotify: (message: string) => void;
}) {
  const { transcript } = state;
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const approved = transcript.status === "approved";
  const empty = transcript.entries.length === 0;

  const copy = async () => {
    const text = transcript.entries
      .map((entry) => `${entry.time} ${entry.speaker}: ${entry.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      onNotify("Transcript copied to the clipboard.");
    } catch {
      onNotify("Copying is blocked by the browser in this preview.");
    }
  };

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_270px]">
        <StepCard className="flex flex-col">
          <div className="px-4 pt-4 sm:px-5">
            <StepHeading
              title="Consultation Transcript"
              description={
                approved
                  ? "This version is approved and is the source for report generation."
                  : "Review the draft, correct anything the transcription got wrong, then approve it."
              }
              badge={
                approved ? (
                  <Chip tone="green">
                    <Check size={9} strokeWidth={3} aria-hidden />
                    Approved · v{transcript.version}
                  </Chip>
                ) : (
                  <Chip tone="amber" dot>
                    Draft · v{transcript.version}
                  </Chip>
                )
              }
              action={
                <div className="flex items-center gap-1.5">
                  <OutlineButton size="sm" onClick={() => setEditing((current) => !current)}>
                    <Pencil size={11} aria-hidden />
                    {editing ? "Done editing" : "Edit"}
                  </OutlineButton>
                  <OutlineButton size="sm" onClick={copy}>
                    <Copy size={11} aria-hidden />
                    Copy
                  </OutlineButton>
                </div>
              }
            />
          </div>

          <div className="px-4 pb-4 pt-3 sm:px-5">
            {empty ? (
              <div className="rounded-2xl border border-dashed border-[#DDE9E8] bg-[#FBFDFD] px-4 py-8 text-center">
                <p className="text-[11.5px] font-semibold text-[#0F2D4A]">No transcript yet</p>
                <p className="mx-auto mt-1 max-w-[320px] text-[10.5px] leading-relaxed text-[#8A9AAA]">
                  The patient declined recording, so there is nothing to transcribe. Document the
                  consultation manually in the clinical notes on the recording step.
                </p>
              </div>
            ) : (
              <ol className="max-h-[420px] space-y-2 overflow-y-auto rounded-2xl bg-[#F7FCFB] p-3">
                {transcript.entries.map((entry) => (
                  <li key={entry.id} className="rounded-xl bg-white/70 px-3 py-2">
                    <div className="flex items-start gap-2.5">
                      <span className="w-[42px] shrink-0 pt-[2px] text-[9.5px] font-semibold tabular-nums text-[#0A9189]">
                        {entry.time}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10.5px] font-bold text-[#0F2D4A]">{entry.speaker}:</p>
                        {editing ? (
                          <textarea
                            value={entry.text}
                            onChange={(event) => onChangeEntry(entry.id, event.target.value)}
                            aria-label={`${entry.speaker} at ${entry.time}`}
                            rows={2}
                            className="mt-1 w-full resize-y rounded-lg border border-[#E6EFEE] px-2 py-1.5 text-[11px] leading-relaxed text-[#0F2D4A] outline-none focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
                          />
                        ) : (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-[#33475B]">
                            <Highlighted entry={entry} />
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {transcript.dirty ? (
              <p className="mt-2 flex items-center gap-1.5 text-[9.5px] font-semibold text-[#C77A0A]">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#E0A106]" />
                Unsaved edits — save the draft before approving.
              </p>
            ) : null}

            <DemoNote>
              Demo transcript from fixture data. Highlighted terms are illustrative, not verified AI
              error detection.
            </DemoNote>
          </div>

          <ActionBar className="mt-auto">
            <OutlineButton onClick={onBack} className="mr-auto">
              <ArrowLeft size={13} aria-hidden />
              Back
            </OutlineButton>
            <SecondaryButton onClick={onSaveDraft} disabled={empty || !transcript.dirty}>
              Save Draft
            </SecondaryButton>
            {approved ? (
              <PrimaryButton onClick={onContinue} arrow>
                <Sparkles size={13} aria-hidden />
                Generate Reports
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={() => setConfirmOpen(true)}
                disabled={empty || transcript.dirty}
                arrow
              >
                Approve Transcript
              </PrimaryButton>
            )}
          </ActionBar>
        </StepCard>

        <div className="space-y-3">
          <StepCard className="p-4">
            <h3 className="text-[12.5px] font-bold text-[#0F2D4A]">Transcript Status</h3>
            <div className="mt-2">
              {approved ? (
                <Chip tone="green">
                  <Check size={9} strokeWidth={3} aria-hidden />
                  Approved
                </Chip>
              ) : (
                <Chip tone="amber" dot>
                  Draft
                </Chip>
              )}
            </div>

            <ul className="mt-3.5 space-y-2.5">
              <ChecklistItem done={!transcript.dirty && !empty}>Review and correct any errors.</ChecklistItem>
              <ChecklistItem done={!empty}>Ensure clinical accuracy.</ChecklistItem>
              <ChecklistItem done={approved}>Approve to generate reports.</ChecklistItem>
            </ul>

            <div className="mt-3.5 rounded-xl bg-[#F7FCFB] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold text-[#0F2D4A]">
                <ShieldCheck size={11} aria-hidden className="text-[#0A9189]" />
                Version history
              </p>
              <p className="mt-1 text-[9px] leading-relaxed text-[#8A9AAA]">
                v{transcript.version} · {approved ? "approved" : "draft"} —{" "}
                {state.recording.seconds > 0
                  ? `${Math.max(1, Math.round(state.recording.seconds / 60))} min of audio`
                  : "no audio"}
              </p>
            </div>
          </StepCard>

          {approved ? (
            <StepCard className="p-4">
              <p className="text-[10px] font-semibold text-[#0F2D4A]">Need to change something?</p>
              <p className="mt-1 text-[9.5px] leading-relaxed text-[#8A9AAA]">
                Editing an approved transcript returns it to draft as a new version. Reports are always
                linked to the version they were generated from.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  onNotify("Editing reopens the transcript as a draft when you save.");
                }}
                className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
              >
                <Undo2 size={10} aria-hidden />
                Reopen for editing
              </button>
            </StepCard>
          ) : null}
        </div>
      </div>

      <DoctorOverlay
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        variant="dialog"
        title="Approve this transcript?"
        description="The approved version becomes the only source Agent 1 may use to draft the clinical reports."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <OutlineButton onClick={() => setConfirmOpen(false)} className="h-10 flex-1">
              Cancel
            </OutlineButton>
            <PrimaryButton
              className="h-10 flex-1"
              onClick={() => {
                setConfirmOpen(false);
                setEditing(false);
                onApprove();
              }}
            >
              <CheckCircle2 size={13} aria-hidden />
              Approve Transcript
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-2.5">
          <p className="text-[11px] leading-relaxed text-[#4A5C6E]">
            You are approving <span className="font-semibold text-[#0F2D4A]">v{transcript.version}</span>{" "}
            with {transcript.entries.length} entries. Clinical accuracy is your responsibility — the
            transcript was produced with AI assistance.
          </p>
          <p className="rounded-xl bg-[#F7FCFB] px-3 py-2 text-[9.5px] leading-relaxed text-[#8A9AAA]">
            Approving does not publish anything to the patient. Reports are drafted next and each one
            needs its own approval.
          </p>
        </div>
      </DoctorOverlay>
    </>
  );
}

function ChecklistItem({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full",
          done ? "bg-[#EAFBF7] text-[#0A9189]" : "border border-[#DDE9E8] text-transparent",
        )}
      >
        <Check size={10} strokeWidth={3} aria-hidden />
      </span>
      <span className={cn("text-[10px] leading-relaxed", done ? "text-[#33475B]" : "text-[#8A9AAA]")}>
        {children}
      </span>
    </li>
  );
}

function Highlighted({ entry }: { entry: TranscriptEntry }) {
  if (!entry.highlights?.length) return <>{entry.text}</>;

  const terms = entry.highlights;
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = entry.text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        terms.some((term) => term.toLowerCase() === part.toLowerCase()) ? (
          <mark key={index} className="rounded bg-[#FDF0D5] px-0.5 text-[#8A6A1E]">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Cpu,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { ConsultationState } from "@/lib/consultation/model";
import {
  Chip,
  DemoNote,
  OutlineButton,
  PrimaryButton,
  StepCard,
} from "./ui";
import { cn } from "@/lib/cn";

const STAGES = [
  "Analyzing transcript",
  "Extracting clinical information",
  "Generating Report 1 (Patient-friendly)",
  "Generating Report 2 (Structured profile)",
  "Generating Report 3 (Medical report)",
];

/**
 * Screen 05 — AI Report Generation (Agent 1).
 *
 * The progress bar is explicitly simulated: no model is called. A failed run
 * never leaves completed reports behind, and the approved transcript is never
 * discarded by a failure.
 */
export function GenerationStep({
  state,
  onRetry,
  onReview,
  onBack,
  onFail,
}: {
  state: ConsultationState;
  onRetry: () => void;
  onReview: () => void;
  onBack: () => void;
  onFail: () => void;
}) {
  const { generation } = state;
  const failed = generation.status === "failed";
  const done = generation.status === "done";
  const running = generation.status === "running";
  const [pulse, setPulse] = useState(false);
  const started = useRef(false);

  // Kick off on first render of this step.
  useEffect(() => {
    if (!started.current && state.generation.status === "idle") {
      started.current = true;
      onRetry();
    }
  }, [state.generation.status, onRetry]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setPulse((value) => !value), 1200);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <StepCard className="overflow-hidden">
      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative grid h-[190px] w-[190px] place-items-center">
            <span aria-hidden className="absolute inset-0 rounded-full border border-dashed border-[#CFEFE9]" />
            <span aria-hidden className="absolute inset-5 rounded-full border border-[#E3F6F2]" />
            <span
              aria-hidden
              className={cn(
                "absolute inset-10 rounded-full bg-[#F2FBF9] transition-opacity duration-700",
                running && pulse ? "opacity-60" : "opacity-100",
              )}
            />
            <span className="relative grid h-[76px] w-[76px] place-items-center rounded-2xl border border-[#CFEFE9] bg-white text-[#0A9189] shadow-[0_10px_30px_-20px_rgba(10,145,137,0.6)]">
              <Cpu size={30} aria-hidden />
            </span>
          </div>

          <h2 className="mt-3 text-[17px] font-bold text-[#0F2D4A] sm:text-[18px]">
            {failed ? "Report generation failed" : done ? "Reports ready for review" : "Generating Reports…"}
          </h2>
          <p className="mt-1.5 max-w-[280px] text-[11px] leading-relaxed text-[#5B6B7C]">
            {failed
              ? "Agent 1 could not finish. Your approved transcript is untouched — retry, or return to the transcript."
              : done
                ? "Three drafts were prepared from the approved transcript. None of them is approved yet."
                : "Agent 1 is analyzing the approved transcript and preparing the three clinical reports for doctor review."}
          </p>

          {done ? (
            <PrimaryButton className="mt-3.5" onClick={onReview} arrow>
              Review Reports
            </PrimaryButton>
          ) : null}
          {failed ? (
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              <PrimaryButton onClick={onRetry}>
                <RotateCcw size={13} aria-hidden />
                Retry
              </PrimaryButton>
              <OutlineButton onClick={onBack}>Back to transcript</OutlineButton>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A9AAA]">
              Agent 1 · Report drafting
            </p>
            <Chip tone={failed ? "red" : done ? "green" : "teal"} dot>
              {failed ? "Failed" : done ? "Completed" : "Running"}
            </Chip>
          </div>

          <ol className="mt-3 space-y-2.5">
            {STAGES.map((stage, index) => {
              const complete = done || generation.stage > index;
              const active = running && generation.stage === index;
              return (
                <li key={stage} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full",
                      complete
                        ? "bg-[#EAFBF7] text-[#0A9189]"
                        : active
                          ? "text-[#0A9189]"
                          : "border border-[#DDE9E8] text-transparent",
                    )}
                  >
                    {active ? (
                      <Loader2 size={14} aria-hidden className="animate-spin" />
                    ) : (
                      <Check size={11} strokeWidth={3} aria-hidden />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[11.5px]",
                      complete || active ? "font-semibold text-[#0F2D4A]" : "text-[#8A9AAA]",
                    )}
                  >
                    {stage}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-[#EDF3F3]">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300",
                  failed ? "bg-[#E5484D]" : "bg-[#0A9189]",
                )}
                style={{ width: `${failed ? generation.progress : generation.progress}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-[#8A9AAA]">
              <span>{failed ? "Stopped before completion" : "Simulated progress"}</span>
              <span className="font-semibold text-[#0F2D4A]">{generation.progress}%</span>
            </div>
          </div>

          {failed ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#FBD9DD] bg-[#FFF5F6] px-3 py-2.5">
              <AlertTriangle size={13} aria-hidden className="mt-[1px] shrink-0 text-[#C0353B]" />
              <p className="text-[10px] leading-relaxed text-[#8A3A3F]">
                No reports were created. Approved transcript v{state.transcript.version} is preserved
                and can be regenerated.
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <DemoNote>
              Demo mode: generation is paced in the browser. No AI model is executed and no clinical
              text leaves this page.
            </DemoNote>
            {running ? (
              <button
                type="button"
                onClick={onFail}
                className="shrink-0 text-[9px] font-semibold text-[#B6C2CE] underline-offset-2 transition hover:text-[#C0353B] hover:underline"
              >
                Simulate failure
              </button>
            ) : null}
          </div>

          {done ? (
            <p className="mt-2 flex items-center gap-1.5 text-[9.5px] text-[#0A9189]">
              <Sparkles size={11} aria-hidden />
              Each draft needs its own review before it can be used.
              <ArrowRight size={10} aria-hidden />
            </p>
          ) : null}
        </div>
      </div>
    </StepCard>
  );
}

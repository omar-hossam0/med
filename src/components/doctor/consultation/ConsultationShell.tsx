"use client";

import { Check, ChevronRight, Lock } from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import { formatClock, type PortalAppointment, type PortalPatient } from "@/lib/mock/doctorPortal";
import { STEPS, stepState, type ConsultationState, type StepKey } from "@/lib/consultation/model";
import { Chip, type Tone } from "./ui";
import { cn } from "@/lib/cn";

const STATUS_TONE: Record<string, Tone> = {
  Waiting: "amber",
  Arrived: "purple",
  "In Progress": "blue",
  Completed: "green",
  Upcoming: "gray",
  Cancelled: "red",
};

/** Persistent identity bar: the patient must never change mid-workflow. */
export function PatientContextHeader({
  patient,
  appointment,
  reason,
  right,
}: {
  patient: PortalPatient;
  appointment: PortalAppointment;
  reason: string;
  right?: React.ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E6EFEE] bg-white px-3.5 py-2.5 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
      <Avatar name={patient.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#0F2D4A]">{patient.name}</p>
        <p className="mt-0.5 text-[10px] text-[#7187A6]">
          {patient.age} years · ID: {patient.mrn} · {formatClock(appointment.time)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden text-right sm:block">
          <p className="text-[10.5px] font-semibold text-[#0F2D4A]">{reason}</p>
          <p className="mt-0.5 text-[9.5px] text-[#8A9AAA]">{appointment.location}</p>
        </div>
        <Chip tone={STATUS_TONE[appointment.status] ?? "gray"} dot>
          {appointment.status}
        </Chip>
      </div>
      {right}
    </section>
  );
}

/**
 * Workflow stepper.
 *
 * Reflects real consultation state: completed steps are clickable for review,
 * the current step is highlighted, and steps whose prerequisites are missing
 * stay locked — a URL cannot unlock them.
 */
export function ConsultationStepper({
  state,
  current,
  onNavigate,
}: {
  state: ConsultationState;
  current: StepKey | "completed";
  onNavigate: (step: StepKey) => void;
}) {
  return (
    <nav
      aria-label="Consultation workflow"
      className="overflow-x-auto rounded-2xl border border-[#E6EFEE] bg-white px-2 py-1.5 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ol className="flex min-w-max items-center gap-1">
        {STEPS.map((step, index) => {
          const status = stepState(state, step.key);
          const active = current === step.key;
          const locked = status === "locked";

          return (
            <li key={step.key} className="flex items-center">
              {index > 0 ? (
                <span aria-hidden className="mx-1 h-4 w-px bg-[#EDF3F3]" />
              ) : null}
              <button
                type="button"
                onClick={() => onNavigate(step.key)}
                disabled={locked}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[10.5px] font-semibold transition-colors duration-150",
                  active && "bg-[#0A9189] text-white shadow-[0_8px_18px_-12px_rgba(10,145,137,0.9)]",
                  !active && status === "done" && "bg-[#EAFBF7] text-[#0A9189] hover:bg-[#DDF7F2]",
                  !active && status === "current" && "bg-[#F1F6F6] text-[#0F2D4A]",
                  !active && status === "available" && "text-[#5B6B7C] hover:bg-[#F5FAFA]",
                  locked && "cursor-not-allowed text-[#B6C2CE]",
                )}
              >
                <StepGlyph status={status} active={active} />
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.short}</span>
              </button>
            </li>
          );
        })}
        <li className="flex items-center">
          <span aria-hidden className="mx-1 h-4 w-px bg-[#EDF3F3]" />
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-semibold",
              current === "completed" ? "bg-[#0A9189] text-white" : "text-[#B6C2CE]",
            )}
          >
            <Check size={11} aria-hidden />
            Completed
          </span>
        </li>
      </ol>
    </nav>
  );
}

function StepGlyph({
  status,
  active,
}: {
  status: ReturnType<typeof stepState>;
  active: boolean;
}) {
  if (status === "locked") return <Lock size={10} aria-hidden className="shrink-0" />;
  if (status === "done")
    return (
      <span
        aria-hidden
        className={cn(
          "grid h-3.5 w-3.5 place-items-center rounded-full",
          active ? "bg-white/25" : "bg-[#0A9189]",
        )}
      >
        <Check size={9} strokeWidth={3.2} className={active ? "text-white" : "text-white"} />
      </span>
    );
  if (active) return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />;
  return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#C3CFDA]" />;
}

/** Compact breadcrumb used on the completion screen. */
export function StepperTrail({ state }: { state: ConsultationState }) {
  return (
    <p className="flex flex-wrap items-center gap-1 text-[9.5px] text-[#9AA9B8]">
      {STEPS.map((step) => (
        <span key={step.key} className="inline-flex items-center gap-1">
          <span
            className={cn(
              stepState(state, step.key) === "done" ? "text-[#0A9189]" : "text-[#9AA9B8]",
            )}
          >
            {step.short}
          </span>
          <ChevronRight size={9} aria-hidden />
        </span>
      ))}
    </p>
  );
}

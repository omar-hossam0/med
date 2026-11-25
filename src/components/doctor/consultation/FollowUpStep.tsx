"use client";

import { ArrowLeft, CalendarCheck, CalendarDays, Check, Send, Sparkles, XCircle } from "lucide-react";
import { formatShortDate } from "@/lib/mock/doctorSchedule";
import { formatClock } from "@/lib/mock/doctorPortal";
import type { ConsultationState } from "@/lib/consultation/model";
import {
  ActionBar,
  Chip,
  DemoNote,
  OutlineButton,
  PrimaryButton,
  StepCard,
  StepHeading,
} from "./ui";
import { cn } from "@/lib/cn";

/**
 * Screen 08 — Follow-up & Next Steps (Agent 3).
 *
 * The demo can propose slots and record a recommendation, but it can never
 * confirm a booking: patient selection and staff confirmation happen outside the
 * doctor's workspace, so the honest end state is "awaiting staff confirmation".
 */
export function FollowUpStep({
  state,
  onSetWeeks,
  onPropose,
  onSelectSlot,
  onSend,
  onConfirm,
  onDecline,
  onNoFollowUp,
  onContinue,
  onBack,
}: {
  state: ConsultationState;
  onSetWeeks: (weeks: number) => void;
  onPropose: () => void;
  onSelectSlot: (slotId: string) => void;
  onSend: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  onNoFollowUp: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { followUp } = state;
  const hasSlots = followUp.slots.length > 0;
  const sent = Boolean(followUp.sentAt);
  const settled = followUp.status === "confirmed" || followUp.status === "declined";

  return (
    <div className="space-y-3">
      <StepCard className="flex flex-col">
        <div className="px-4 pt-4 sm:px-5">
          <StepHeading
            title="Follow-up Recommendation"
            description="Based on the consultation, a follow-up is recommended. Confirm the recommendation or propose slots for the patient to choose from."
            badge={
              followUp.status === "confirmed" ? (
                <Chip tone="green" dot>
                  Awaiting staff confirmation
                </Chip>
              ) : followUp.status === "declined" ? (
                <Chip tone="gray" dot>
                  No follow-up required
                </Chip>
              ) : followUp.status === "proposed" ? (
                <Chip tone="blue" dot>
                  {sent ? "Awaiting patient selection" : "Slots proposed"}
                </Chip>
              ) : (
                <Chip tone="amber" dot>
                  Recommendation drafted
                </Chip>
              )
            }
          />
        </div>

        <div className="grid gap-2.5 px-4 pb-4 pt-3.5 sm:px-5 lg:grid-cols-2">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#EDF3F3] px-4 py-5 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#EAFBF7] text-[#0A9189]">
              <CalendarDays size={20} aria-hidden />
            </span>
            <p className="mt-2.5 text-[11.5px] font-bold text-[#0F2D4A]">Recommended Follow-up</p>
            <p className="mt-1 text-[20px] font-bold text-[#0F2D4A]">{followUp.weeks} weeks</p>
            <p className="mt-0.5 text-[10px] text-[#7187A6]">({followUp.reason})</p>

            {!settled ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                {[2, 4, 6, 8].map((weeks) => (
                  <button
                    key={weeks}
                    type="button"
                    onClick={() => onSetWeeks(weeks)}
                    aria-pressed={followUp.weeks === weeks}
                    className={cn(
                      "h-7 rounded-full px-2.5 text-[10px] font-semibold transition",
                      followUp.weeks === weeks
                        ? "bg-[#0A9189] text-white"
                        : "border border-[#E6EFEE] text-[#5B6B7C] hover:border-[#BFE8E2] hover:text-[#0A9189]",
                    )}
                  >
                    {weeks}w
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#EDF3F3] px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11.5px] font-bold text-[#0F2D4A]">Proposed Appointment Slots (Agent 3)</p>
              <Chip tone="purple">Demo</Chip>
            </div>

            {hasSlots ? (
              <ul className="mt-2.5 space-y-1.5">
                {followUp.slots.map((slot) => {
                  const active = followUp.selectedSlotId === slot.id;
                  return (
                    <li key={slot.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[10.5px] transition",
                          active
                            ? "border-[#BFE8E2] bg-[#F2FBF9] font-semibold text-[#0F2D4A]"
                            : "border-transparent text-[#33475B] hover:bg-[#F9FDFC]",
                        )}
                      >
                        <input
                          type="radio"
                          name="follow-up-slot"
                          checked={active}
                          onChange={() => onSelectSlot(slot.id)}
                          disabled={followUp.status === "confirmed"}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "grid h-[15px] w-[15px] place-items-center rounded-full border transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0A9189]",
                            active ? "border-[#0A9189] bg-[#0A9189] text-white" : "border-[#C3CFDA] text-transparent",
                          )}
                        >
                          <Check size={9} strokeWidth={4} aria-hidden />
                        </span>
                        {formatShortDate(slot.date)} — {formatClock(slot.time)}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-2.5 rounded-xl border border-dashed border-[#DDE9E8] px-3 py-4 text-center">
                <p className="text-[10px] leading-relaxed text-[#8A9AAA]">
                  No slots proposed yet. Agent 3 suggests options; it does not check real availability.
                </p>
                <button
                  type="button"
                  onClick={onPropose}
                  className="mt-2 inline-flex h-7 items-center gap-1 rounded-full bg-[#EAFBF7] px-3 text-[10px] font-semibold text-[#0A9189] transition hover:bg-[#DDF7F2]"
                >
                  <Sparkles size={11} aria-hidden />
                  Propose Appointment Slots
                </button>
              </div>
            )}

            {sent ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[#EAF1FF] px-2.5 py-1.5 text-[9.5px] leading-relaxed text-[#3B6EF6]">
                <Send size={10} aria-hidden className="mt-[1px] shrink-0" />
                Slots were sent to the patient in this demo session. The appointment is not booked
                until the patient chooses and reception confirms.
              </p>
            ) : null}
          </div>
        </div>

        <ActionBar className="mt-auto">
          <OutlineButton onClick={onBack} className="mr-auto">
            <ArrowLeft size={13} aria-hidden />
            Back
          </OutlineButton>

          {!settled ? (
            <>
              <button
                type="button"
                onClick={onNoFollowUp}
                className="h-9 rounded-full px-3 text-[10.5px] font-semibold text-[#8A9AAA] transition hover:text-[#0F2D4A]"
              >
                No follow-up required
              </button>
              <button
                type="button"
                onClick={onDecline}
                className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[10.5px] font-semibold text-[#8A9AAA] transition hover:text-[#C0353B]"
              >
                <XCircle size={12} aria-hidden />
                Decline
              </button>
              {hasSlots ? (
                <OutlineButton onClick={onSend} disabled={!followUp.selectedSlotId || sent}>
                  <Send size={12} aria-hidden />
                  Send Proposed Slots
                </OutlineButton>
              ) : null}
              <PrimaryButton
                onClick={hasSlots ? onConfirm : onPropose}
                disabled={hasSlots && !followUp.selectedSlotId}
                arrow
              >
                <CalendarCheck size={13} aria-hidden />
                {hasSlots ? "Confirm Follow-up" : "Propose Appointment Slots"}
              </PrimaryButton>
            </>
          ) : (
            <PrimaryButton onClick={onContinue} arrow>
              Continue to Summary
            </PrimaryButton>
          )}
        </ActionBar>
      </StepCard>

      <div className="px-1">
        <DemoNote>
          A recommendation is not a booking. Confirming here records the clinical decision; the patient
          still chooses a slot and reception confirms the appointment.
        </DemoNote>
      </div>
    </div>
  );
}

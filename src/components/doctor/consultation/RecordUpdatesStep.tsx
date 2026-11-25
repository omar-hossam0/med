"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  FlaskConical,
  Heart,
  Pill,
  ShieldCheck,
} from "lucide-react";
import type { ConsultationState, ProposalCategory, RecordProposal } from "@/lib/consultation/model";
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

const CATEGORY: Record<ProposalCategory, { icon: typeof Heart; label: string }> = {
  condition: { icon: Heart, label: "Condition" },
  medication: { icon: Pill, label: "Medication" },
  allergy: { icon: AlertTriangle, label: "Allergy" },
  history: { icon: Clock, label: "History" },
  test: { icon: FlaskConical, label: "Test order" },
};

/**
 * Screen 07 — Medical Record Updates (Agent 2).
 *
 * Proposals are suggestions. Nothing is applied until the doctor selects them
 * and confirms, and applying is a separate transition from approving.
 */
export function RecordUpdatesStep({
  state,
  onToggle,
  onApply,
  onRejectAll,
  onDefer,
  onContinue,
  onBack,
}: {
  state: ConsultationState;
  onToggle: (proposalId: string) => void;
  onApply: () => void;
  onRejectAll: () => void;
  onDefer: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { proposals, status } = state.recordUpdates;
  const [expanded, setExpanded] = useState<string | null>(null);

  const selected = proposals.filter((proposal) => proposal.selected && !proposal.applied);
  const applied = proposals.filter((proposal) => proposal.applied);
  const counts = {
    total: proposals.length,
    new: proposals.filter((proposal) => proposal.action === "new").length,
    updates: proposals.filter((proposal) => proposal.action === "update").length,
    meds: proposals.filter((proposal) => proposal.category === "medication").length,
    tests: proposals.filter((proposal) => proposal.category === "test").length,
    conflicts: proposals.filter((proposal) => proposal.conflict).length,
    selected: selected.length,
  };

  const appliedState = status === "applied";
  const deferred = status === "deferred";

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_262px]">
      <StepCard className="flex flex-col">
        <div className="px-4 pt-4 sm:px-5">
          <StepHeading
            title="Proposed Record Updates"
            description="Agent 2 analyzed the approved structured medical profile and prepared the following proposed updates to the patient's medical record."
            badge={
              appliedState ? (
                <Chip tone="green">
                  <Check size={9} strokeWidth={3} aria-hidden />
                  Applied
                </Chip>
              ) : deferred ? (
                <Chip tone="gray" dot>
                  Deferred
                </Chip>
              ) : (
                <Chip tone="amber" dot>
                  Awaiting review
                </Chip>
              )
            }
          />
        </div>

        <div className="space-y-2 px-4 pb-4 pt-3.5 sm:px-5">
          {appliedState ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#C9EEE7] bg-[#F2FBF9] px-3 py-2.5">
              <ShieldCheck size={14} aria-hidden className="mt-[1px] shrink-0 text-[#0A9189]" />
              <div>
                <p className="text-[10.5px] font-semibold text-[#0A9189]">
                  {applied.length} update{applied.length === 1 ? "" : "s"} applied to the demo record
                </p>
                <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#5B6B7C]">
                  Previous values are kept in the history rather than overwritten. Nothing was written
                  to PostgreSQL in this phase.
                </p>
              </div>
            </div>
          ) : null}

          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              expanded={expanded === proposal.id}
              onToggleExpand={() => setExpanded((current) => (current === proposal.id ? null : proposal.id))}
              onSelect={() => onToggle(proposal.id)}
              disabled={appliedState || deferred}
            />
          ))}

          {proposals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#DDE9E8] px-4 py-8 text-center text-[10.5px] text-[#8A9AAA]">
              No record updates were proposed for this consultation.
            </p>
          ) : null}

          <DemoNote>
            Proposals are demonstration data derived from the approved report. Conflicts are shown
            instead of overwriting existing clinical facts.
          </DemoNote>
        </div>

        <ActionBar className="mt-auto">
          <OutlineButton onClick={onBack} className="mr-auto">
            <ArrowLeft size={13} aria-hidden />
            Back
          </OutlineButton>
          {appliedState ? (
            <PrimaryButton onClick={onContinue} arrow>
              Continue to Follow-up
            </PrimaryButton>
          ) : deferred ? (
            <PrimaryButton onClick={onContinue} arrow>
              Continue with pending updates
            </PrimaryButton>
          ) : (
            <>
              <button
                type="button"
                onClick={onRejectAll}
                className="h-9 rounded-full px-3 text-[10.5px] font-semibold text-[#8A9AAA] transition hover:text-[#C0353B]"
              >
                Reject All
              </button>
              <OutlineButton onClick={onDefer}>Review Later</OutlineButton>
              <PrimaryButton onClick={onApply} disabled={selected.length === 0} arrow>
                <CheckCheck size={13} aria-hidden />
                Approve &amp; Apply Updates ({selected.length})
              </PrimaryButton>
            </>
          )}
        </ActionBar>
      </StepCard>

      <StepCard className="h-fit p-4">
        <h3 className="text-[12.5px] font-bold text-[#0F2D4A]">Update Summary</h3>
        <ul className="mt-2.5 space-y-2">
          <SummaryRow label="Proposed changes" value={counts.total} />
          <SummaryRow label="New records" value={counts.new} />
          <SummaryRow label="Updated records" value={counts.updates} />
          <SummaryRow label="Medication updates" value={counts.meds} />
          <SummaryRow label="Test orders" value={counts.tests} />
          <SummaryRow label="Conflicts" value={counts.conflicts} tone={counts.conflicts > 0 ? "amber" : undefined} />
        </ul>

        <div className="mt-3 rounded-xl bg-[#F7FCFB] px-3 py-2">
          <p className="text-[9.5px] font-semibold text-[#0F2D4A]">
            {counts.selected} of {counts.total} selected
          </p>
          <p className="mt-0.5 text-[9px] leading-relaxed text-[#8A9AAA]">
            Only selected proposals are applied. Unselected ones stay pending for a later review.
          </p>
        </div>

        <p className="mt-2.5 flex items-start gap-1.5 text-[9px] leading-relaxed text-[#9AA9B8]">
          <ShieldCheck size={10} aria-hidden className="mt-[1px] shrink-0 text-[#0A9189]" />
          Applying a proposal never deletes prior values; each change keeps its source report version.
        </p>
      </StepCard>
    </div>
  );
}

function ProposalCard({
  proposal,
  expanded,
  onToggleExpand,
  onSelect,
  disabled,
}: {
  proposal: RecordProposal;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  disabled: boolean;
}) {
  const meta = CATEGORY[proposal.category];
  const Icon = meta.icon;

  return (
    <article
      className={cn(
        "rounded-xl border bg-white transition-colors duration-150",
        proposal.selected && !disabled ? "border-[#BFE8E2]" : "border-[#EDF3F3]",
      )}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <label className="mt-[2px] flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={proposal.selected}
            onChange={onSelect}
            disabled={disabled}
            className="peer sr-only"
            aria-label={`Select ${proposal.title}`}
          />
          <span
            aria-hidden
            className={cn(
              "grid h-[17px] w-[17px] place-items-center rounded-[4px] border transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0A9189]",
              proposal.selected
                ? "border-[#0A9189] bg-[#0A9189] text-white"
                : "border-[#D5E3E2] text-transparent",
              disabled && "opacity-60",
            )}
          >
            <Check size={10} strokeWidth={3} aria-hidden />
          </span>
        </label>

        <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#F1F6F6] text-[#5B6B7C]">
          <Icon size={12} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-[#0F2D4A]">{proposal.title}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-[#7187A6]">{proposal.detail}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Chip tone="green">{proposal.action === "new" ? "New" : "Update"}</Chip>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-[#8A9AAA] transition hover:text-[#0A9189]"
          >
            Details
            <ChevronDown size={10} aria-hidden className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-[#F2F7F7] px-3 py-2.5">
          <dl className="grid gap-2 sm:grid-cols-2">
            {proposal.current ? (
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">Current</dt>
                <dd className="mt-0.5 text-[10px] text-[#5B6B7C]">{proposal.current}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">Proposed</dt>
              <dd className="mt-0.5 text-[10px] font-medium text-[#0F2D4A]">{proposal.proposed}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">Source</dt>
              <dd className="mt-0.5 text-[10px] text-[#5B6B7C]">{proposal.source}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">Change type</dt>
              <dd className="mt-0.5 text-[10px] text-[#5B6B7C]">
                {proposal.action === "new" ? "New record" : "Update to existing record"}
              </dd>
            </div>
          </dl>
          {proposal.conflict ? (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[#FFF8EC] px-2.5 py-1.5 text-[9.5px] leading-relaxed text-[#8A6A1E]">
              <AlertTriangle size={10} aria-hidden className="mt-[1px] shrink-0" />
              {proposal.conflict}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: number; tone?: "amber" }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-[#5B6B7C]">{label}</span>
      <span
        className={cn(
          "text-[10.5px] font-bold",
          tone === "amber" && value > 0 ? "text-[#C77A0A]" : "text-[#0F2D4A]",
        )}
      >
        {value}
      </span>
    </li>
  );
}

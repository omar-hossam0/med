"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Database,
  FileCheck2,
  FileText,
  Send,
  UploadCloud,
} from "lucide-react";
import type { ConsultationState, ReportKey } from "@/lib/consultation/model";
import {
  ActionBar,
  Chip,
  DemoNote,
  OutlineButton,
  PrimaryButton,
  StepCard,
  StepHeading,
  type Tone,
} from "./ui";
import { ReportReviewPanel } from "./ReportReviewPanel";
import { cn } from "@/lib/cn";

const META: Record<ReportKey, { title: string; subtitle: string; description: string; tone: Tone; icon: typeof FileText; accent: string }> = {
  report1: {
    title: "Report 1",
    subtitle: "Patient-friendly Summary",
    description: "Plain-language explanation for the patient (diagnosis, treatment, tests, instructions).",
    tone: "teal",
    icon: FileCheck2,
    accent: "#0A9189",
  },
  report2: {
    title: "Report 2",
    subtitle: "Structured Medical Profile",
    description: "Structured clinical data to update the patient's medical record (via Agent 2).",
    tone: "blue",
    icon: Database,
    accent: "#3B6EF6",
  },
  report3: {
    title: "Report 3",
    subtitle: "Medical Report",
    description: "Detailed clinical report for medical use.",
    tone: "purple",
    icon: FileText,
    accent: "#8B5CF6",
  },
};

const ORDER: ReportKey[] = ["report1", "report2", "report3"];

const STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  published: { label: "Published to patient", tone: "teal" },
};

/**
 * Screen 06 — Reports Review & Approval.
 *
 * Approval is per report and never automatic. Report 1 additionally needs an
 * explicit publish step before the patient can see it; reports 2 and 3 have no
 * patient-facing action at all.
 */
export function ReportsStep({
  state,
  onOpenReview,
  onApproveSelected,
  onPublishReport1,
  onContinue,
  onBack,
  reviewKey,
  onCloseReview,
}: {
  state: ConsultationState;
  onOpenReview: (key: ReportKey) => void;
  onApproveSelected: (keys: ReportKey[]) => void;
  onPublishReport1: () => void;
  onContinue: () => void;
  onBack: () => void;
  reviewKey: ReportKey | null;
  onCloseReview: () => void;
}) {
  const [selected, setSelected] = useState<ReportKey[]>([]);
  const reports = ORDER.map((key) => state.reports[key]).filter(Boolean);

  const selectable = reports.filter((report) => report.status === "draft").map((report) => report.key);
  const allSelected = selectable.length > 0 && selectable.every((key) => selected.includes(key));
  const canContinue = state.reports.report2?.status === "approved";
  const approvedCount = reports.filter((report) => ["approved", "published"].includes(report.status)).length;

  const toggle = (key: ReportKey) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  return (
    <>
      <StepCard className="flex flex-col">
        <div className="px-4 pt-4 sm:px-5">
          <StepHeading
            title="Generated Reports (Drafts)"
            description="Review, edit, and approve the AI-generated reports. Each report has its own review."
            badge={
              <Chip tone={approvedCount === 3 ? "green" : "amber"} dot>
                {approvedCount}/3 approved
              </Chip>
            }
            action={
              <button
                type="button"
                onClick={() => setSelected(allSelected ? [] : selectable)}
                disabled={selectable.length === 0}
                className="text-[9.5px] font-semibold text-[#0A9189] transition hover:text-[#087F78] disabled:text-[#B6C2CE]"
              >
                {allSelected ? "Clear selection" : "Select all drafts"}
              </button>
            }
          />
        </div>

        <div className="grid gap-2.5 px-4 pb-4 pt-3.5 sm:px-5 lg:grid-cols-3">
          {reports.map((report) => {
            const meta = META[report.key];
            const Icon = meta.icon;
            const status = STATUS_LABEL[report.status];
            const isSelected = selected.includes(report.key);

            return (
              <article
                key={report.key}
                className={cn(
                  "flex flex-col rounded-2xl border bg-white p-3.5 transition-colors duration-150",
                  isSelected ? "border-[#0A9189] ring-1 ring-[#0A9189]/20" : "border-[#EDF3F3] hover:border-[#BFE8E2]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl"
                    style={{ backgroundColor: `${meta.accent}14`, color: meta.accent }}
                  >
                    <Icon size={19} aria-hidden />
                  </span>
                  {report.status === "draft" ? (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[9px] font-semibold text-[#8A9AAA]">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(report.key)}
                        className="peer sr-only"
                        aria-label={`Select ${meta.title} for approval`}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-4 w-4 place-items-center rounded-[4px] border transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0A9189]",
                          isSelected ? "border-[#0A9189] bg-[#0A9189] text-white" : "border-[#D5E3E2] text-transparent",
                        )}
                      >
                        <Check size={10} strokeWidth={3} aria-hidden />
                      </span>
                      Select
                    </label>
                  ) : (
                    <Chip tone={status.tone} dot>
                      {status.label}
                    </Chip>
                  )}
                </div>

                <h3 className="mt-2.5 text-[13px] font-bold text-[#0F2D4A]">{meta.title}</h3>
                <p className="text-[10.5px] font-semibold text-[#33475B]">{meta.subtitle}</p>
                <p className="mt-1.5 flex-1 text-[10px] leading-relaxed text-[#7A8CA0]">
                  {meta.description}
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-[9px] text-[#9AA9B8]">
                  <span>v{report.version}</span>
                  {report.edited ? <span>· edited</span> : null}
                  {report.status === "draft" ? <span>· awaiting review</span> : null}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenReview(report.key)}
                  className="mt-2.5 h-8 rounded-full bg-[#0A9189] text-[10.5px] font-semibold text-white transition hover:bg-[#087F78]"
                >
                  Review
                </button>

                {report.key === "report1" && report.status === "approved" ? (
                  <button
                    type="button"
                    onClick={onPublishReport1}
                    className="mt-1.5 inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#BFE8E2] bg-[#EAFBF7] text-[10px] font-semibold text-[#0A9189] transition hover:bg-[#DDF7F2]"
                  >
                    <UploadCloud size={12} aria-hidden />
                    Publish to Patient
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>

        {!canContinue ? (
          <p className="mx-4 mb-3 rounded-xl bg-[#FFF8EC] px-3 py-2 text-[10px] leading-relaxed text-[#8A6A1E] sm:mx-5">
            Report 2 must be approved before Agent 2 can prepare medical-record updates. Report 1 and
            Report 3 can be reviewed in any order.
          </p>
        ) : null}

        <ActionBar className="mt-auto">
          <OutlineButton onClick={onBack} className="mr-auto">
            <ArrowLeft size={13} aria-hidden />
            Back
          </OutlineButton>
          <DemoNote>
            <span className="mr-2">Drafts are AI-assisted. Nothing is published automatically.</span>
          </DemoNote>
          <PrimaryButton
            onClick={() => onApproveSelected(selected)}
            disabled={selected.length === 0}
            size="md"
          >
            <CheckCheck size={13} aria-hidden />
            Approve Selected ({selected.length})
          </PrimaryButton>
          <PrimaryButton onClick={onContinue} disabled={!canContinue} arrow>
            <Send size={12} aria-hidden />
            Record Updates
          </PrimaryButton>
        </ActionBar>
      </StepCard>

      <ReportReviewPanel
        state={state}
        reportKey={reviewKey}
        onClose={onCloseReview}
      />
    </>
  );
}

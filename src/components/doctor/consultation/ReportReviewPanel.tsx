"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Database,
  FileCheck2,
  FileText,
  Pencil,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { DoctorOverlay } from "@/components/doctor/overview/DoctorOverlay";
import { useConsultationWorkflow } from "./ConsultationWorkflowProvider";
import type { ConsultationState, ReportKey } from "@/lib/consultation/model";
import {
  Chip,
  DemoNote,
  DangerButton,
  OutlineButton,
  PrimaryButton,
  SecondaryButton,
} from "./ui";
import { cn } from "@/lib/cn";

const TITLES: Record<ReportKey, { title: string; subtitle: string; icon: typeof FileText; tone: "teal" | "blue" | "purple" }> = {
  report1: { title: "Report 1 — Patient-friendly Summary", subtitle: "Intended for the patient once approved and published.", icon: FileCheck2, tone: "teal" },
  report2: { title: "Report 2 — Structured Medical Profile", subtitle: "Source for Agent 2 record updates. Not patient-facing.", icon: Database, tone: "blue" },
  report3: { title: "Report 3 — Medical Report", subtitle: "Doctor-facing clinical report. Not patient-facing.", icon: FileText, tone: "purple" },
};

/**
 * Individual report review.
 *
 * Shows the report beside the approved transcript it was generated from, so the
 * doctor can verify claims against the source rather than trusting the draft.
 */
export function ReportReviewPanel({
  state,
  reportKey,
  onClose,
}: {
  state: ConsultationState;
  reportKey: ReportKey | null;
  onClose: () => void;
}) {
  const { setReportBody, setReportStatus, publishReport1 } = useConsultationWorkflow();
  const report = reportKey ? state.reports[reportKey] : undefined;
  const meta = reportKey ? TITLES[reportKey] : null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setEditing(false);
    setDraft(report?.body ?? "");
  }, [reportKey, report?.body]);

  if (!reportKey || !report || !meta) {
    return (
      <DoctorOverlay open={false} onClose={onClose} variant="dialog" title="">
        {null}
      </DoctorOverlay>
    );
  }

  const Icon = meta.icon;
  const approved = report.status === "approved" || report.status === "published";

  return (
    <DoctorOverlay
      open
      onClose={onClose}
      variant="dialog"
      size="xl"
      title={meta.title}
      description={meta.subtitle}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <OutlineButton onClick={onClose} className="mr-auto">
            Close
          </OutlineButton>
          {editing ? (
            <>
              <OutlineButton
                onClick={() => {
                  setDraft(report.body);
                  setEditing(false);
                }}
              >
                Cancel
              </OutlineButton>
              <PrimaryButton
                onClick={() => {
                  setReportBody(state.appointmentId, reportKey, draft);
                  setEditing(false);
                }}
              >
                Save Draft
              </PrimaryButton>
            </>
          ) : (
            <>
              {!approved ? (
                <>
                  <DangerButton
                    onClick={() => {
                      setReportStatus(state.appointmentId, reportKey, "rejected");
                      onClose();
                    }}
                  >
                    Reject
                  </DangerButton>
                  <SecondaryButton onClick={() => setEditing(true)}>
                    <Pencil size={12} aria-hidden />
                    Edit
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={() => {
                      setReportStatus(state.appointmentId, reportKey, "approved");
                      onClose();
                    }}
                  >
                    <Check size={13} strokeWidth={3} aria-hidden />
                    Approve Report
                  </PrimaryButton>
                </>
              ) : (
                <>
                  <Chip tone="green">
                    <Check size={9} strokeWidth={3} aria-hidden />
                    {report.status === "published" ? "Published" : "Approved"}
                  </Chip>
                  {reportKey === "report1" && report.status === "approved" ? (
                    <PrimaryButton
                      onClick={() => {
                        publishReport1(state.appointmentId);
                        onClose();
                      }}
                    >
                      <UploadCloud size={13} aria-hidden />
                      Publish to Patient
                    </PrimaryButton>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EAFBF7] text-[#0A9189]">
              <Icon size={15} aria-hidden />
            </span>
            <Chip tone={approved ? "green" : report.status === "rejected" ? "red" : "amber"} dot>
              {report.status === "published" ? "Published" : report.status === "approved" ? "Approved" : report.status === "rejected" ? "Rejected" : "Draft"}
            </Chip>
            <Chip tone="gray">v{report.version}</Chip>
            <Chip tone="blue">Source: transcript v{state.transcript.version}</Chip>
            {report.edited ? <Chip tone="purple">Edited</Chip> : null}
          </div>

          <div className="mt-2.5 max-h-[46vh] overflow-y-auto rounded-xl border border-[#EDF3F3] bg-[#FCFEFD] p-3">
            {editing ? (
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={18}
                aria-label="Report content"
                className="w-full resize-y rounded-lg border border-[#E6EFEE] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#0F2D4A] outline-none focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
              />
            ) : (
              <div className="space-y-2.5">
                {report.body.split("\n").filter(Boolean).map((line, index) => {
                  const isHeading = /^[A-Z][A-Z\s]{3,}$/.test(line.trim()) || /^(Summary|What we discussed|Your next steps|History|Assessment|Plan|OBSERVATIONS|PLAN|CONDITIONS|ALLERGIES|CURRENT MEDICATIONS|PATIENT|VISIT REASON)$/i.test(line.trim());
                  return isHeading ? (
                    <p key={index} className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#0A9189]">
                      {line}
                    </p>
                  ) : (
                    <p key={index} className="text-[11px] leading-relaxed text-[#33475B]">
                      {line}
                    </p>
                  );
                })}
              </div>
            )}
          </div>

          {!editing ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#F7FCFB] px-3 py-2">
              <ShieldCheck size={11} aria-hidden className="mt-[1px] shrink-0 text-[#0A9189]" />
              <p className="text-[9px] leading-relaxed text-[#8A9AAA]">
                {reportKey === "report1"
                  ? "Approving keeps this private. Use Publish to Patient to release it."
                  : "This report is never shown to the patient."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A9AAA]">
            Approved transcript · v{state.transcript.version}
          </p>
          <ol className="mt-2 max-h-[46vh] space-y-1.5 overflow-y-auto rounded-xl bg-[#F7FCFB] p-2.5">
            {state.transcript.entries.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-white/70 px-2.5 py-1.5">
                <p className="text-[9px] font-semibold tabular-nums text-[#0A9189]">
                  {entry.time} · {entry.speaker}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-[#4A5C6E]">{entry.text}</p>
              </li>
            ))}
          </ol>
          <DemoNote>
            Compare the draft against this source before approving. AI drafts can be incomplete or
            wrong.
          </DemoNote>
        </div>
      </div>

      {report.status === "rejected" ? (
        <div className={cn("mt-3 flex items-start gap-2 rounded-xl border border-[#FBD9DD] bg-[#FFF5F6] px-3 py-2")}>
          <X size={12} aria-hidden className="mt-[1px] shrink-0 text-[#C0353B]" />
          <p className="text-[10px] leading-relaxed text-[#8A3A3F]">
            This report was rejected and stays out of the workflow until it is edited and approved.
          </p>
        </div>
      ) : null}
    </DoctorOverlay>
  );
}

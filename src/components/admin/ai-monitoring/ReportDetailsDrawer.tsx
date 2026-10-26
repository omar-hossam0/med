"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/cn";
import { tabMotion } from "@/components/transitions/tabs";
import {
  formatDateTime,
  getReportEvents,
  type AiReport,
} from "@/lib/mock/aiMonitoring";
import { SideDrawer } from "./SideDrawer";
import { ProcessingBadge, WorkflowBadge } from "./ui";

type DrawerTab = "details" | "timeline";

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "red" | "teal";
}) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 border-b border-line/60 py-2 last:border-0">
      <dt className="text-[10px] text-[#7A8B9C]">{label}</dt>
      <dd
        className={cn(
          "text-right text-[10.5px] font-medium text-[#0F2D4A]",
          accent === "red" && "text-[#E5484D]",
          accent === "teal" && "text-[#0A9189]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function ReportDetailsDrawer({
  report,
  open,
  initialTab = "details",
  onClose,
}: {
  report: AiReport | null;
  open: boolean;
  initialTab?: DrawerTab;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<DrawerTab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab, report?.id]);

  const events = report ? getReportEvents(report) : [];

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={report?.id ?? "Report operations"}
      subtitle={report ? `Case reference ${report.caseRef} · administrative view` : undefined}
      width={460}
      footer={
        <p className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[#7A8B9C]">
          <LockKeyhole size={12} className="mt-px shrink-0" aria-hidden />
          Operational metadata only. Clinical report text, diagnoses, prescriptions, and
          patient identity are not available to administrators.
        </p>
      }
    >
      {report && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <WorkflowBadge status={report.workflowStatus} />
            <ProcessingBadge status={report.processingStatus} />
            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[9px] font-semibold text-[#64748B]">
              {report.department}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-line bg-[#FAFDFD] p-2.5">
              <p className="text-[8.5px] uppercase tracking-wide text-[#9AA9B8]">Assigned doctor</p>
              <p className="mt-0.5 truncate text-[10.5px] font-semibold text-[#0F2D4A]">
                {report.doctorName}
              </p>
              <p className="text-[9px] text-[#7A8B9C]">{report.specialty}</p>
            </div>
            <div className="rounded-xl border border-line bg-[#FAFDFD] p-2.5">
              <p className="text-[8.5px] uppercase tracking-wide text-[#9AA9B8]">Processing time</p>
              <p className="mt-0.5 text-[10.5px] font-semibold text-[#0F2D4A]">
                {report.processingSeconds !== null
                  ? `${report.processingSeconds} seconds`
                  : "Not available"}
              </p>
              <p className="text-[9px] text-[#7A8B9C]">
                {report.processingStatus === "failed" ? "Job did not complete" : "Job duration"}
              </p>
            </div>
          </div>

          <div
            className="mt-4 flex items-center gap-1 border-b border-line"
            role="tablist"
            aria-label="Report operational details"
          >
            {(
              [
                ["details", "Operational Details"],
                ["timeline", "Event Timeline"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "relative px-2.5 pb-2 pt-1 text-[10.5px] font-semibold transition",
                  tab === key ? "text-[#0A9189]" : "text-[#7A8B9C] hover:text-[#0F2D4A]",
                )}
              >
                {label}
                {tab === key && (
                  <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#0A9189]" />
                )}
              </button>
            ))}
          </div>

          <motion.div key={tab} {...tabMotion(Boolean(reduce))} className="pt-2">
            {tab === "details" ? (
              <dl>
                <DetailRow label="Report ID" value={report.id} />
                <DetailRow label="Case reference" value={report.caseRef} />
                <DetailRow label="Processing job" value={report.jobId} />
                <DetailRow label="Assigned doctor" value={report.doctorName} />
                <DetailRow label="Department" value={report.department} />
                <DetailRow label="Created" value={formatDateTime(new Date(report.createdAt))} />
                <DetailRow
                  label="Processing started"
                  value={
                    report.jobStartedAt
                      ? formatDateTime(new Date(report.jobStartedAt))
                      : "Not started"
                  }
                />
                <DetailRow
                  label="Processing finished"
                  value={
                    report.jobFinishedAt
                      ? formatDateTime(new Date(report.jobFinishedAt))
                      : "Not available"
                  }
                />
                <DetailRow
                  label="Workflow status"
                  value={
                    report.workflowStatus === "awaiting_review"
                      ? "Awaiting Review"
                      : report.workflowStatus === "approved"
                        ? "Approved"
                        : "Draft"
                  }
                />
                <DetailRow
                  label="Processing status"
                  value={
                    report.processingStatus.charAt(0).toUpperCase() +
                    report.processingStatus.slice(1)
                  }
                />
                <DetailRow
                  label="Processing duration"
                  value={
                    report.processingSeconds !== null
                      ? `${report.processingSeconds} seconds`
                      : "—"
                  }
                />
                <DetailRow
                  label="Error category"
                  value={report.failureCategory ?? "—"}
                  accent={report.failureCategory ? "red" : undefined}
                />
              </dl>
            ) : (
              <ol className="relative ml-1 space-y-3 border-l border-line pl-4">
                {events.map((event) => {
                  const isFailure = event.title.toLowerCase().includes("failed");
                  return (
                    <li key={event.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white",
                          isFailure ? "bg-[#E5484D]" : "bg-[#0A9189]",
                        )}
                        aria-hidden
                      />
                      <p className="text-[10.5px] font-semibold text-[#0F2D4A]">
                        {event.title}
                      </p>
                      <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#7A8B9C]">
                        {event.detail}
                      </p>
                      <p className="mt-0.5 text-[8.5px] text-[#9AA9B8]">
                        {formatDateTime(new Date(event.at))}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </motion.div>

          {report.processingStatus === "failed" && tab === "details" && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#F8D4D8] bg-[#FDF3F4] p-2.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#E5484D]" aria-hidden />
              <div>
                <p className="text-[9.5px] font-semibold text-[#B4232A]">
                  Sanitized technical error
                </p>
                <p className="mt-0.5 text-[9px] leading-relaxed text-[#9B4A4F]">
                  {report.failureCategory ?? "Processing error"}. Raw prompts, request
                  payloads, and clinical content are not exposed.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </SideDrawer>
  );
}

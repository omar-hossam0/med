"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Download,
  FileText,
  Hospital,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { EmptyState, SectionCard } from "@/components/patient/medical-records/ui";
import {
  formatLabDate,
  getLabDoctor,
  getLabReportFile,
  getLabVisit,
  type LabResult,
} from "@/lib/mock/labResults";
import { LabResultsHeader, LabStatusBadge } from "./LabResultsChrome";
import { LabTrends } from "./LabTrends";
import { LabReportPanel, downloadLabReport } from "./LabReportPanel";
import { cn } from "@/lib/cn";

type DetailTab = "results" | "trends" | "report" | "visit";

const TABS: { key: DetailTab; label: string }[] = [
  { key: "results", label: "Results" },
  { key: "trends", label: "Trends" },
  { key: "report", label: "Report" },
  { key: "visit", label: "Related Visit" },
];

const RETURN_KEY = "medora.lab-results.return";

export function LabResultDetail({ lab, labId }: { lab?: LabResult; labId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<DetailTab>("results");
  const [returnQuery, setReturnQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && TABS.some((item) => item.key === tabParam)) setTab(tabParam as DetailTab);

    try {
      const stored = window.sessionStorage.getItem(RETURN_KEY);
      if (stored) setReturnQuery(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const changeTab = (next: DetailTab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  const back = () => router.push(`/patient/lab-results${returnQuery}`);

  if (!lab) {
    return (
      <div className="space-y-3">
        <LabResultsHeader
          title="Lab result not found"
          subtitle="This test is not part of your Medora records."
          back={{ label: "Back to Lab Results", onClick: () => router.push("/patient/lab-results") }}
        />
        <SectionCard>
          <EmptyState
            icon={FileText}
            title="We couldn't open this lab result"
            description={`No result matches "${labId}". Return to Lab Results and choose a test from the list.`}
          />
        </SectionCard>
      </div>
    );
  }

  const doctor = getLabDoctor(lab);
  const reportFile = getLabReportFile(lab);

  return (
    <div className="space-y-3">
      <LabResultsHeader
        title={lab.name}
        subtitle={`${formatLabDate(lab.date)} · ${lab.facility}`}
        back={{ label: "Back to Lab Results", onClick: back }}
        action={
          reportFile ? (
            <button
              type="button"
              onClick={() => downloadLabReport(lab, reportFile)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#0A9189] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#0A9189] transition-[background-color,border-color,transform] duration-150 hover:bg-[#E7FBF8] active:translate-y-[1px]"
            >
              <Download size={13} aria-hidden />
              Download Report
            </button>
          ) : (
            <span
              title="No report file is attached to this result"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-[#E6EFEE] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#A8B6C4]"
            >
              <Download size={13} aria-hidden />
              Download Report
            </span>
          )
        }
      />

      <SectionCard className="p-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Lab result views">
          {TABS.map((item) => {
            const selected = item.key === tab;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`lab-tab-${item.key}`}
                aria-selected={selected}
                aria-controls={`lab-panel-${item.key}`}
                onClick={() => changeTab(item.key)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-[10.5px] font-semibold transition-[background-color,color,box-shadow] duration-150",
                  selected
                    ? "bg-[#0A9189] text-white shadow-[0_8px_20px_-14px_rgba(10,145,137,0.9)]"
                    : "text-[#5B6B7C] hover:bg-[#F1F8F7] hover:text-[#0F2D4A]",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`lab-panel-${tab}`}
          aria-labelledby={`lab-tab-${tab}`}
          className="mt-3"
        >
          {tab === "results" ? <ResultsTab lab={lab} /> : null}
          {tab === "trends" ? (
            <LabTrends trends={lab.trends ?? []} />
          ) : null}
          {tab === "report" ? <LabReportPanel lab={lab} file={reportFile} /> : null}
          {tab === "visit" ? <RelatedVisitTab lab={lab} /> : null}
        </div>
      </SectionCard>

      {doctor ? (
        <p className="text-[9px] text-[#9AA9B8]">
          Result recorded by {lab.facility}. Laboratory values are shown exactly as reported and
          cannot be edited.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results tab                                                         */
/* ------------------------------------------------------------------ */

function ResultsTab({ lab }: { lab: LabResult }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[#EDF3F3]">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#EDF3F3] bg-[#FBFDFD]">
              <th className="px-3 py-2 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-[#9AA9B8]">
                Test Item
              </th>
              <th className="px-3 py-2 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-[#9AA9B8]">
                Result
              </th>
              <th className="px-3 py-2 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-[#9AA9B8]">
                Reference Range
              </th>
              <th className="px-3 py-2 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-[#9AA9B8]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {lab.results.map((row) => (
              <tr
                key={row.name}
                className="border-b border-[#F5F9F9] transition-colors duration-150 last:border-0 hover:bg-[#FBFDFD]"
              >
                <td className="px-3 py-2 text-[10.5px] font-semibold text-[#0F2D4A]">{row.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-[10.5px] font-semibold text-[#0F2D4A]">
                  {row.value}
                  <span className="ml-1 text-[9px] font-normal text-[#7187A6]">{row.unit}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-[10px] text-[#7187A6]">
                  {row.referenceRange}
                </td>
                <td className="px-3 py-2">
                  <LabStatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lab.notes ? (
        <div className="flex gap-2.5 rounded-xl border border-[#CDEEE8] bg-[#EFFBF8] p-3">
          <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[#0A9189]">
            <Stethoscope size={12} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[10.5px] font-semibold text-[#0F2D4A]">Doctor&apos;s Note</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-[#3F5567]">{lab.notes}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#E6EFEE] bg-[#FBFDFD] p-3">
          <p className="text-[10px] text-[#7187A6]">
            No clinician note is recorded with this result.
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl border border-[#EDF3F3] bg-[#FBFDFD] p-3 sm:grid-cols-4">
        <Meta label="Specimen" value={lab.specimen} />
        <Meta label="Method" value={lab.method} />
        <Meta label="Collected" value={lab.collectedAt} />
        <Meta label="Reported" value={lab.reportedAt} />
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Related visit tab                                                   */
/* ------------------------------------------------------------------ */

function RelatedVisitTab({ lab }: { lab: LabResult }) {
  const router = useRouter();
  const visit = getLabVisit(lab);
  const doctor = getLabDoctor(lab);

  if (!visit) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No related visit recorded"
        description="This laboratory result is not linked to a consultation in your medical records."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-[#EDF3F3] bg-white p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EFF4FF] text-[#2563EB]">
          <UserRound size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-semibold text-[#0F2D4A]">
            {doctor?.name ?? "Medora care team"}
          </p>
          <p className="truncate text-[9.5px] text-[#7187A6]">
            {doctor?.specialty ?? visit.specialty}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/patient/medical-records?visit=${visit.id}`)}
          className="shrink-0 rounded-lg border border-[#0A9189] bg-white px-2.5 py-1.5 text-[9.5px] font-semibold text-[#0A9189] transition-[background-color,transform] duration-150 hover:bg-[#E7FBF8] active:translate-y-[1px]"
        >
          View Visit
        </button>
      </div>

      <dl className="divide-y divide-[#F2F7F7] rounded-xl border border-[#EDF3F3] px-3">
        <VisitRow
          icon={CalendarDays}
          label="Visit Date"
          value={`${formatLabDate(visit.date)} · ${visit.time}`}
        />
        <VisitRow icon={Hospital} label="Medical Center" value={visit.facility} />
        <VisitRow icon={FileText} label="Reason" value={visit.title} />
        <VisitRow icon={Stethoscope} label="Specialty" value={visit.specialty} />
      </dl>

      <p className="text-[9px] leading-relaxed text-[#9AA9B8]">
        Opens the consultation in Medical Records. Visit details are not duplicated here.
      </p>
    </div>
  );
}

function VisitRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="flex items-center gap-1.5 text-[9.5px] text-[#7187A6]">
        <Icon size={11} aria-hidden className="text-[#9AA9B8]" />
        {label}
      </dt>
      <dd className="max-w-[62%] text-right text-[10px] font-semibold leading-snug text-[#0F2D4A]">
        {value}
      </dd>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[8px] uppercase tracking-[0.08em] text-[#9AA9B8]">{label}</dt>
      <dd className="mt-[1px] text-[9.5px] font-semibold text-[#0F2D4A]">{value}</dd>
    </div>
  );
}

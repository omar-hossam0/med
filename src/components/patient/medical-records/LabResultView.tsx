"use client";

import { useState } from "react";
import {
  Activity,
  CalendarDays,
  Download,
  FlaskConical,
  Hospital,
  Info,
  TrendingUp,
  UserRound,
} from "lucide-react";
import {
  formatRecordDate,
  formatShortRecordDate,
  getMedicalDoctor,
  getVisit,
  type LabResult,
  type LabTrend,
} from "@/lib/mock/medicalRecords";
import { RecordStatusBadge, RecordTypeIcon } from "./badges";
import {
  DetailField,
  EmptyState,
  MoreMenu,
  SectionCard,
  demoExport,
  downloadTextFile,
} from "./ui";
import { cn } from "@/lib/cn";

type LabTab = "Results" | "Details" | "Trends" | "Related Visit";

const TABS: LabTab[] = ["Results", "Details", "Trends", "Related Visit"];

export function LabResultView({
  lab,
  compact = false,
  onOpenVisit,
  onOpenFull,
  onToast,
}: {
  lab: LabResult;
  compact?: boolean;
  onOpenVisit: (id: string) => void;
  onOpenFull?: () => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<LabTab>("Results");
  const doctor = getMedicalDoctor(lab.doctorId);
  const relatedVisit = getVisit(lab.relatedVisitId);

  const download = () => {
    downloadTextFile(
      `${lab.name.replace(/\s+/g, "-").toLowerCase()}-results.txt`,
      demoExport(lab.name, [
        `Date: ${formatRecordDate(lab.date)}`,
        `Laboratory: ${lab.facility}`,
        `Category: ${lab.category}`,
        `Status: ${lab.status}`,
        "",
        "Results",
        ...lab.results.map(
          (row) =>
            `${row.name}: ${row.value} ${row.unit} (reference ${row.referenceRange}) — ${row.status}`,
        ),
        "",
        "Notes",
        lab.notes,
      ]),
    );
    onToast("Lab results downloaded as a demo text file.");
  };

  return (
    <SectionCard className={cn(compact ? "p-3.5" : "p-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <RecordTypeIcon type="lab" size={compact ? "md" : "lg"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "font-bold leading-tight tracking-[-0.015em] text-[#0F2D4A]",
                compact ? "text-[14px]" : "text-[19px]",
              )}
            >
              {lab.name}
            </h2>
            <RecordStatusBadge status={lab.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[9.5px] text-[#5B6B7C]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={11} className="text-[#9AA9B8]" aria-hidden />
              {formatRecordDate(lab.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hospital size={11} className="text-[#9AA9B8]" aria-hidden />
              {lab.facility}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound size={11} className="text-[#9AA9B8]" aria-hidden />
              {doctor?.name ?? "Medora care team"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={download}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-[#E6EFEE] bg-white font-semibold text-[#33475B] transition hover:border-[#BFE8E2] hover:text-[#0A9189]",
              compact ? "h-7 px-2 text-[9px]" : "h-8 px-2.5 text-[10px]",
            )}
          >
            <Download size={12} aria-hidden />
            Download
          </button>
          <MoreMenu
            actions={[
              { label: "Download results", icon: Download, onClick: download },
              {
                label: "Ask about this result",
                icon: Info,
                onClick: () =>
                  onToast(
                    "Question noted in this demo. No message was sent to the laboratory.",
                  ),
              },
            ]}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-3 flex gap-1 overflow-x-auto border-b border-[#EDF3F3]">
          {TABS.map((item) => {
            const selected = tab === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item)}
                className={cn(
                  "relative shrink-0 px-2 py-2 text-[10px] font-semibold transition-colors",
                  selected ? "text-[#0A9189]" : "text-[#7187A6] hover:text-[#0F2D4A]",
                )}
              >
                {item}
                {selected && (
                  <span className="absolute inset-x-1 -bottom-[1px] h-[2px] rounded-full bg-[#0A9189]" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-3">
        {compact ? (
          <div className="space-y-2.5">
            <ResultsTable lab={lab} />
            {onOpenFull ? (
              <button
                type="button"
                onClick={onOpenFull}
                className="h-8 w-full rounded-lg bg-[#0A9189] text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
              >
                View Full Lab Result
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {tab === "Results" && <ResultsTable lab={lab} />}

            {tab === "Details" && <LabDetails lab={lab} />}

            {tab === "Trends" && <LabTrends lab={lab} />}

            {tab === "Related Visit" && (
              <div>
                {relatedVisit ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3 sm:flex-row sm:items-center">
                    <RecordTypeIcon type="visit" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-semibold text-[#0F2D4A]">
                        {relatedVisit.title}
                      </p>
                      <p className="mt-0.5 text-[8.5px] text-[#8A99A8]">
                        {formatRecordDate(relatedVisit.date)} •{" "}
                        {getMedicalDoctor(relatedVisit.doctorId)?.name ?? ""} •{" "}
                        {relatedVisit.facility}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenVisit(relatedVisit.id)}
                      className="h-7 shrink-0 rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[9px] font-semibold text-[#0A9189] transition hover:border-[#BFE8E2] hover:bg-[#F0FCFA]"
                    >
                      View Visit
                    </button>
                  </div>
                ) : (
                  <p className="rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-4 text-center text-[10.5px] text-[#7187A6]">
                    This result is not linked to a visit in your records.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}

function ResultsTable({ lab }: { lab: LabResult }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-[#E6EFEE]">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#E6EFEE] bg-[#FBFDFD]">
              {["Test Name", "Result", "Reference Range", "Status"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-3 py-2 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#8A99A8]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F5F5]">
            {lab.results.map((row) => (
              <tr key={row.name} className="transition hover:bg-[#FBFDFD]">
                <td className="px-3 py-2 text-[10px] font-medium text-[#0F2D4A]">
                  {row.name}
                </td>
                <td className="px-3 py-2 text-[10px] font-semibold text-[#0F2D4A]">
                  {row.value}{" "}
                  <span className="text-[8.5px] font-normal text-[#8A99A8]">
                    {row.unit}
                  </span>
                </td>
                <td className="px-3 py-2 text-[9.5px] text-[#7187A6]">
                  {row.referenceRange} {row.unit}
                </td>
                <td className="px-3 py-2">
                  <RecordStatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[8.5px] leading-relaxed text-[#9AA9B8]">
        <Info size={11} className="mt-[1px] shrink-0" aria-hidden />
        Reference ranges are provided by the laboratory. Status reflects the recorded
        flag and is not a new diagnosis.
      </p>
    </div>
  );
}

function LabDetails({ lab }: { lab: LabResult }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
        <div className="flex items-center gap-1.5">
          <FlaskConical size={13} className="text-[#0A9189]" aria-hidden />
          <h3 className="text-[11px] font-semibold text-[#0F2D4A]">Specimen</h3>
        </div>
        <div className="mt-1.5 divide-y divide-[#F0F5F5]">
          <DetailField label="Specimen" value={lab.specimen} />
          <DetailField label="Method" value={lab.method} />
          <DetailField label="Collected" value={lab.collectedAt} />
          <DetailField label="Reported" value={lab.reportedAt} />
        </div>
      </div>
      <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
        <div className="flex items-center gap-1.5">
          <Hospital size={13} className="text-[#0A9189]" aria-hidden />
          <h3 className="text-[11px] font-semibold text-[#0F2D4A]">Laboratory</h3>
        </div>
        <div className="mt-1.5 divide-y divide-[#F0F5F5]">
          <DetailField label="Facility" value={lab.facility} />
          <DetailField label="Category" value={lab.category} />
          <DetailField
            label="Ordering doctor"
            value={getMedicalDoctor(lab.doctorId)?.name ?? "Medora care team"}
          />
          <DetailField label="Overall status" value={<RecordStatusBadge status={lab.status} />} />
        </div>
      </div>
      <div className="md:col-span-2">
        <p className="rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3 text-[9.5px] leading-relaxed text-[#5B6B7C]">
          {lab.notes}
        </p>
      </div>
    </div>
  );
}

function LabTrends({ lab }: { lab: LabResult }) {
  if (!lab.trends || lab.trends.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No trend history yet"
        description="This is the first recorded result for this test, so there is no historical trend to display."
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {lab.trends.map((trend) => (
        <TrendChart key={trend.label} trend={trend} />
      ))}
    </div>
  );
}

function TrendChart({ trend }: { trend: LabTrend }) {
  const width = 340;
  const height = 150;
  const padding = { top: 16, right: 14, bottom: 28, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = trend.points.map((point) => point.value);
  const min = Math.min(trend.range[0], ...values);
  const max = Math.max(trend.range[1], ...values);
  const span = max - min || 1;
  const yMin = min - span * 0.08;
  const yMax = max + span * 0.08;

  const x = (index: number) =>
    padding.left + (trend.points.length === 1 ? plotWidth / 2 : (index / (trend.points.length - 1)) * plotWidth);
  const y = (value: number) =>
    padding.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  const line = trend.points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-[#0A9189]" aria-hidden />
          <h3 className="text-[10.5px] font-semibold text-[#0F2D4A]">{trend.label}</h3>
        </div>
        <span className="text-[8.5px] text-[#8A99A8]">{trend.unit}</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${trend.label} trend`}
        className="mt-1.5 w-full"
      >
        <rect
          x={padding.left}
          y={y(trend.range[1])}
          width={plotWidth}
          height={Math.max(2, y(trend.range[0]) - y(trend.range[1]))}
          fill="#0A9189"
          opacity="0.06"
        />
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + ratio * plotHeight}
            y2={padding.top + ratio * plotHeight}
            stroke="#EAF1F1"
            strokeWidth="1"
          />
        ))}
        <text x={4} y={y(trend.range[1]) + 3} fill="#9AA9B8" fontSize="7">
          {trend.range[1]}
        </text>
        <text x={4} y={y(trend.range[0]) + 3} fill="#9AA9B8" fontSize="7">
          {trend.range[0]}
        </text>
        <path
          d={line}
          fill="none"
          stroke="#0A9189"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {trend.points.map((point, index) => {
          const outside = point.value < trend.range[0] || point.value > trend.range[1];
          return (
            <g key={point.date}>
              <circle
                cx={x(index)}
                cy={y(point.value)}
                r="3.5"
                fill={outside ? "#E5484D" : "#0A9189"}
                stroke="#fff"
                strokeWidth="1.5"
              />
              <text
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                fill="#9AA9B8"
                fontSize="7"
              >
                {formatShortRecordDate(point.date)}
              </text>
              <text
                x={x(index)}
                y={y(point.value) - 7}
                textAnchor="middle"
                fill="#0F2D4A"
                fontSize="7.5"
                fontWeight="600"
              >
                {point.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

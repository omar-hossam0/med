"use client";

import { useEffect, useMemo, useState } from "react";
import { AI_RANGE_OPTIONS, formatRangeLabel, getDailySeries, type AiRangeKey, type AiReport } from "@/lib/mock/aiMonitoring";
import { cn } from "@/lib/cn";
import { Panel, RangeSelect } from "./ui";

const W = 760;
const H = 252;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

type SeriesKey = "generated" | "approved" | "awaiting" | "failed";

const SERIES: {
  key: SeriesKey;
  label: string;
  color: string;
  fill: boolean;
}[] = [
  { key: "generated", label: "Generated", color: "#3B82F6", fill: true },
  { key: "approved", label: "Approved", color: "#12B39C", fill: true },
  { key: "awaiting", label: "Awaiting Review", color: "#F59E0B", fill: false },
  { key: "failed", label: "Failed", color: "#EF4444", fill: false },
];

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function ReportsOverviewChart({
  periodReports,
  range,
  onRangeChange,
}: {
  periodReports: AiReport[];
  range: AiRangeKey;
  onRangeChange: (range: AiRangeKey) => void;
}) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const [active, setActive] = useState<number | null>(null);
  const daily = useMemo(() => getDailySeries(periodReports, range), [periodReports, range]);

  // A shorter range has fewer points; keep the cursor on a real data point.
  useEffect(() => {
    setActive(null);
  }, [range]);

  const yMax = useMemo(() => {
    const max = daily.reduce(
      (current, point) =>
        Math.max(current, point.generated, point.approved, point.awaiting, point.failed),
      0,
    );
    return Math.max(40, Math.ceil(max / 20) * 20);
  }, [daily]);

  const yFor = (value: number) => PAD_T + PLOT_H - (value / yMax) * PLOT_H;
  const xFor = (index: number) => PAD_L + (index / Math.max(1, daily.length - 1)) * PLOT_W;
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i));

  const labelStep = daily.length <= 10 ? 1 : Math.ceil((daily.length - 1) / 6);
  const labelIndices = daily
    .map((_, index) => index)
    .filter((index) => index === 0 || index === daily.length - 1 || index % labelStep === 0);

  const visibleSeries = SERIES.filter((series) => !hidden.has(series.key));
  // Guard against a stale index while a shorter range is being applied.
  const safeActive =
    active !== null && active >= 0 && active < daily.length ? active : null;
  const activePoint = safeActive !== null ? daily[safeActive] : null;
  const activeX = safeActive !== null ? xFor(safeActive) : 0;
  const tooltipLeft = Math.min(86, Math.max(12, (activeX / W) * 100));

  const toggleSeries = (key: SeriesKey) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const index = Math.round(((x - PAD_L) / PLOT_W) * Math.max(1, daily.length - 1));
    setActive(Math.max(0, Math.min(daily.length - 1, index)));
  };

  return (
    <Panel className="min-w-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-[#0F2D4A]">Reports Overview</h2>
          <p className="mt-0.5 text-[10.5px] text-[#7A8B9C]">
            Total reports, approvals, and failures over time.
          </p>
        </div>
        <RangeSelect
          value={range}
          options={AI_RANGE_OPTIONS}
          onChange={onRangeChange}
          label="Chart date range"
          display={AI_RANGE_OPTIONS.find((option) => option.value === range)?.label}
          compact
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
        {SERIES.map((series) => {
          const isHidden = hidden.has(series.key);
          return (
            <button
              key={series.key}
              type="button"
              onClick={() => toggleSeries(series.key)}
              aria-pressed={!isHidden}
              className={cn(
                "flex items-center gap-1.5 text-[9.5px] transition",
                isHidden ? "text-[#B7C2CE]" : "text-[#5B6B7C] hover:text-[#0F2D4A]",
              )}
            >
              <span
                className="h-2 w-2 rounded-full transition-opacity"
                style={{ background: series.color, opacity: isHidden ? 0.35 : 1 }}
              />
              {series.label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`Reports overview chart for the ${formatRangeLabel(range)} period. Daily generated, approved, awaiting review, and failed report counts.`}
          tabIndex={0}
          onPointerMove={handlePointer}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onFocus={() => setActive((current) => current ?? daily.length - 1)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              setActive((current) => {
                const index = current ?? daily.length - 1;
                return Math.max(
                  0,
                  Math.min(
                    daily.length - 1,
                    index + (event.key === "ArrowRight" ? 1 : -1),
                  ),
                );
              });
            }
          }}
        >
          <defs>
            <linearGradient id="ai-generated-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ai-approved-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#12B39C" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#12B39C" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="#EDF2F4"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 8}
                y={yFor(tick) + 3}
                textAnchor="end"
                className="fill-[#9AA9B8]"
                style={{ fontSize: 8.5 }}
              >
                {tick}
              </text>
            </g>
          ))}

          {labelIndices.map((index) => (
            <text
              key={daily[index].key}
              x={xFor(index)}
              y={H - 7}
              textAnchor={
                index === 0 ? "start" : index === daily.length - 1 ? "end" : "middle"
              }
              className="fill-[#9AA9B8]"
              style={{ fontSize: 8.5 }}
            >
              {daily[index].label}
            </text>
          ))}

          {safeActive !== null && (
            <line
              x1={activeX}
              x2={activeX}
              y1={PAD_T}
              y2={PAD_T + PLOT_H}
              stroke="#CBD5E1"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {SERIES.filter((series) => !hidden.has(series.key)).map((series) => {
            const points = daily.map((point, index) => ({
              x: xFor(index),
              y: yFor(point[series.key]),
            }));
            const line = smoothPath(points);
            const area = `${line} L${points[points.length - 1].x},${PAD_T + PLOT_H} L${points[0].x},${PAD_T + PLOT_H} Z`;

            return (
              <g key={series.key}>
                {series.fill && (
                  <path
                    d={area}
                    fill={
                      series.key === "generated"
                        ? "url(#ai-generated-fill)"
                        : "url(#ai-approved-fill)"
                    }
                  />
                )}
                <path
                  d={line}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={series.key === "generated" ? 2 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {safeActive !== null && (
                  <circle
                    cx={points[safeActive].x}
                    cy={points[safeActive].y}
                    r="3.2"
                    fill="#fff"
                    stroke={series.color}
                    strokeWidth="1.8"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {activePoint && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[128px] -translate-x-1/2 rounded-lg border border-line bg-white px-2.5 py-2 shadow-pop"
            style={{ left: `${tooltipLeft}%` }}
            role="status"
          >
            <p className="text-[9px] font-semibold text-[#0F2D4A]">{activePoint.fullLabel}</p>
            <div className="mt-1 space-y-0.5">
              {visibleSeries.map((series) => (
                <div
                  key={series.key}
                  className="flex items-center gap-1.5 text-[8.5px] text-[#5B6B7C]"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: series.color }}
                  />
                  {series.label}
                  <span className="ml-auto font-semibold text-[#0F2D4A]">
                    {activePoint[series.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

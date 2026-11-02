"use client";

import { useMemo, useState } from "react";
import { Activity, TrendingUp } from "lucide-react";
import {
  TREND_RANGES,
  filterTrendPoints,
  formatLabDate,
  formatShortMonth,
  getLatestPoint,
  type LabTrend,
  type TrendRange,
} from "@/lib/mock/labResults";
import { cn } from "@/lib/cn";

/**
 * Trends tab.
 *
 * Renders only measurements that already exist in the result fixture, windowed
 * by the selected range. A window with no points shows the empty state rather
 * than a synthetic line, and a single point is plotted as a single point.
 */
export function LabTrends({ trends }: { trends: LabTrend[] }) {
  const [trendIndex, setTrendIndex] = useState(0);
  const [range, setRange] = useState<TrendRange>("1Y");

  const trend = trends[trendIndex];
  const points = useMemo(() => (trend ? filterTrendPoints(trend, range) : []), [trend, range]);
  const latest = trend ? getLatestPoint(trend) : undefined;

  if (!trend) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
          <TrendingUp size={22} aria-hidden />
        </span>
        <h3 className="mt-3 text-[13px] font-semibold text-[#0F2D4A]">
          No previous results available for comparison
        </h3>
        <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-[#7187A6]">
          This test has no recorded history yet, so there is no trend to display.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#EDF3F3] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="min-w-0 flex-1 sm:max-w-[220px]">
          <span className="sr-only">Select a test component</span>
          <select
            value={trendIndex}
            onChange={(event) => setTrendIndex(Number(event.target.value))}
            className="h-8 w-full rounded-lg border border-[#E6EFEE] bg-white px-2 text-[10.5px] font-semibold text-[#0F2D4A] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[#CFE3E0] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
          >
            {trends.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1" role="group" aria-label="Time range">
          {TREND_RANGES.map((option) => {
            const active = option === range;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(option)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[9.5px] font-semibold transition-[background-color,color,border-color] duration-150",
                  active
                    ? "bg-[#0A9189] text-white"
                    : "border border-[#E6EFEE] bg-white text-[#5B6B7C] hover:border-[#BFE8E2] hover:text-[#0A9189]",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[#E6EFEE] bg-[#FBFDFD] px-3 py-8 text-center">
          <p className="text-[10.5px] font-semibold text-[#0F2D4A]">
            No measurements in the last {range === "3M" ? "3 months" : range === "6M" ? "6 months" : "year"}
          </p>
          <p className="mt-1 text-[9.5px] text-[#7187A6]">Try a wider time range.</p>
        </div>
      ) : (
        <>
          <TrendPlot trend={trend} points={points} />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#F2F7F7] pt-2">
            <span className="inline-flex items-center gap-1.5 text-[9.5px] text-[#7187A6]">
              <Activity size={11} aria-hidden className="text-[#0A9189]" />
              {points.length} measurement{points.length === 1 ? "" : "s"} in this range
            </span>
            {latest ? (
              <span className="text-[9.5px] text-[#7187A6]">
                Latest{" "}
                <strong className="text-[10.5px] font-semibold text-[#0F2D4A]">
                  {latest.value} {trend.unit}
                </strong>{" "}
                · {formatLabDate(latest.date)}
              </span>
            ) : null}
          </div>
        </>
      )}

      {points.length === 1 ? (
        <p className="mt-2 text-[9px] leading-relaxed text-[#9AA9B8]">
          Only one measurement falls in this range, so there is no line to compare yet.
        </p>
      ) : null}
    </div>
  );
}

function TrendPlot({ trend, points }: { trend: LabTrend; points: LabTrend["points"] }) {
  const width = 520;
  const height = 190;
  const padding = { top: 22, right: 58, bottom: 26, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = points.map((point) => point.value);
  const min = Math.min(trend.range[0], ...values);
  const max = Math.max(trend.range[1], ...values);
  const span = max - min || 1;
  const yMin = min - span * 0.12;
  const yMax = max + span * 0.12;

  const times = points.map((point) => new Date(`${point.date}T00:00:00Z`).getTime());
  const firstTime = Math.min(...times);
  const lastTime = Math.max(...times);
  const timeSpan = lastTime - firstTime;

  const x = (index: number) => {
    if (points.length === 1 || timeSpan === 0) return padding.left + plotWidth / 2;
    return padding.left + ((times[index] - firstTime) / timeSpan) * plotWidth;
  };
  const y = (value: number) => padding.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");

  const baseline = padding.top + plotHeight;
  const area =
    points.length > 1
      ? `${line} L${x(points.length - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`
      : "";

  const lastIndex = points.length - 1;
  const lastX = x(lastIndex);
  const lastY = y(points[lastIndex].value);
  const badgeWidth = 54;
  const badgeX = Math.min(lastX + 8, width - padding.right + 2);
  const badgeFits = badgeX + badgeWidth <= width - 2;

  const yTicks = [yMax, (yMax + yMin) / 2, yMin];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${trend.label} over time, unit ${trend.unit}`}
      className="mt-2 w-full"
    >
      <defs>
        <linearGradient id="labTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A9189" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0A9189" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {yTicks.map((tick, index) => (
        <g key={index}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="#EDF3F3"
            strokeWidth="1"
          />
          <text x={padding.left - 8} y={y(tick) + 3} textAnchor="end" fill="#9AA9B8" fontSize="8">
            {tick.toFixed(1)}
          </text>
        </g>
      ))}

      {area ? <path d={area} fill="url(#labTrendFill)" /> : null}

      {points.length > 1 ? (
        <path
          d={line}
          fill="none"
          stroke="#0A9189"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {points.map((point, index) => (
        <g key={point.date}>
          <circle cx={x(index)} cy={y(point.value)} r="3.4" fill="#0A9189" stroke="#fff" strokeWidth="1.6" />
          <text x={x(index)} y={height - 8} textAnchor="middle" fill="#9AA9B8" fontSize="8">
            {formatShortMonth(point.date)}
          </text>
        </g>
      ))}

      {badgeFits ? (
        <g>
          <rect
            x={badgeX}
            y={lastY - 9}
            width={badgeWidth}
            height="18"
            rx="5"
            fill="#0A9189"
          />
          <text
            x={badgeX + badgeWidth / 2}
            y={lastY + 3}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="8"
            fontWeight="600"
          >
            {points[lastIndex].value} {trend.unit.length > 6 ? "" : trend.unit}
          </text>
        </g>
      ) : (
        <text x={lastX} y={lastY - 10} textAnchor="middle" fill="#0F2D4A" fontSize="8.5" fontWeight="600">
          {points[lastIndex].value} {trend.unit}
        </text>
      )}
    </svg>
  );
}

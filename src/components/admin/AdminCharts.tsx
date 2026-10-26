"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  trendDays,
  trendSeries,
  departments,
  departmentTotal,
} from "@/lib/mock/admin";
import { useComingSoon } from "./ComingSoon";

/* ---------------- Line chart helpers ---------------- */
const W = 560;
const H = 200;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 22;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const MAX_Y = 100;

const yFor = (v: number) => PAD_T + PLOT_H - (v / MAX_Y) * PLOT_H;
const xFor = (i: number, n: number) => PAD_L + (i / (n - 1)) * PLOT_W;

function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function AppointmentsTrendCard() {
  const comingSoon = useComingSoon();
  const [active, setActive] = useState(3); // Oct 17, matching the design's tooltip
  const n = trendDays.length;
  const yTicks = [0, 25, 50, 75, 100];

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((x - PAD_L) / PLOT_W) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, idx)));
  };

  const leftPct = (xFor(active, n) / W) * 100;

  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-[#0F2D4A]">Appointments Overview</h3>
          <p className="mt-0.5 text-[10.5px] text-[#7A8B9C]">
            Track appointment trends and clinic activity over time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => comingSoon("Date range")}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] text-[#5B6B7C] transition hover:bg-surface-subtle"
        >
          Last 7 Days <ChevronDown size={11} />
        </button>
      </div>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Appointments overview line chart for the last 7 days"
          onMouseMove={handleMove}
          onMouseLeave={() => setActive(3)}
        >
          {/* grid + y labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke="#EDF2F4"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 6}
                y={yFor(t) + 3}
                textAnchor="end"
                className="fill-[#9AA9B8]"
                style={{ fontSize: 8 }}
              >
                {t}
              </text>
            </g>
          ))}

          {/* x labels */}
          {trendDays.map((d, i) => (
            <text
              key={d}
              x={xFor(i, n)}
              y={H - 6}
              textAnchor="middle"
              className="fill-[#9AA9B8]"
              style={{ fontSize: 8 }}
            >
              {d}
            </text>
          ))}

          {/* active guideline */}
          <line
            x1={xFor(active, n)}
            x2={xFor(active, n)}
            y1={PAD_T}
            y2={PAD_T + PLOT_H}
            stroke="#CBD5E1"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* series */}
          {trendSeries.map((s) => {
            const pts = s.data.map((v, i) => ({ x: xFor(i, n), y: yFor(v) }));
            return (
              <g key={s.key}>
                <path d={smooth(pts)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={i === active ? 3.4 : 2.2}
                    fill="#fff"
                    stroke={s.color}
                    strokeWidth="1.8"
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* tooltip */}
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-2.5 py-1.5 shadow-pop"
          style={{ left: `${Math.min(84, Math.max(16, leftPct))}%` }}
        >
          <p className="text-[9px] font-semibold text-[#0F2D4A]">{trendDays[active]}, 2026</p>
          <div className="mt-1 space-y-0.5">
            {trendSeries.map((s) => (
              <div key={s.key} className="flex items-center gap-1 text-[8.5px] text-[#5B6B7C]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
                <span className="ml-auto font-semibold text-[#0F2D4A]">{s.data[active]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {trendSeries.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-[#5B6B7C]">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Donut ---------------- */
const SIZE = 150;
const R = 56;
const CIRC = 2 * Math.PI * R;

export function DepartmentDonutCard() {
  const comingSoon = useComingSoon();
  let acc = 0;
  const segments = departments.map((d) => {
    const len = (d.percent / 100) * CIRC;
    const seg = { ...d, len, offset: acc };
    acc += len;
    return seg;
  });

  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-[#0F2D4A]">Appointments by Department</h3>
          <p className="mt-0.5 text-[10.5px] text-[#7A8B9C]">Distribution of today&apos;s appointments.</p>
        </div>
        <button
          type="button"
          onClick={() => comingSoon("Department filter")}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] text-[#5B6B7C] transition hover:bg-surface-subtle"
        >
          Today <ChevronDown size={11} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label="Appointments by department donut chart"
          >
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {segments.map((s) => (
                <circle
                  key={s.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="20"
                  strokeDasharray={`${Math.max(0, s.len - 1.5)} ${CIRC - Math.max(0, s.len - 1.5)}`}
                  strokeDashoffset={-s.offset}
                />
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="text-[19px] font-bold leading-none text-[#0F2D4A]">
              {departmentTotal}
            </span>
            <span className="mt-0.5 text-[9px] text-[#7A8B9C]">Total</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1">
          {departments.map((d) => (
            <li key={d.label} className="flex items-center gap-1.5 text-[9.5px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate text-[#5B6B7C]">{d.label}</span>
              <span className="ml-auto font-semibold text-[#0F2D4A]">{d.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";

import {
  Activity,
  CheckCircle2,
  FileText,
  ListOrdered,
  RefreshCw,
  Server,
  Timer,
  TrendingUp,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import {
  AI_RANGE_OPTIONS,
  SERVICE_STATE_LABEL,
  formatDateTime,
  relativeActivityTime,
  type ActivityType,
  type AiRangeKey,
  type AiServiceHealth,
  type DoctorRanking,
  type OperationalActivity,
  type ServiceState,
} from "@/lib/mock/aiMonitoring";
import { Panel, RangeSelect, SimulatedNote } from "./ui";

const SERVICE_STYLES: Record<ServiceState, string> = {
  operational: "bg-[#E9F9EF] text-[#1E9E56]",
  degraded: "bg-[#FFF6E5] text-[#C77A0A]",
  unavailable: "bg-[#FDECEF] text-[#E5484D]",
};

function HealthRow({
  icon: Icon,
  label,
  value,
  tone,
  last,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "green" | "red" | "normal";
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-2",
        !last && "border-b border-line/60",
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-[10px] text-[#5B6B7C]">
        <Icon size={12} className="shrink-0 text-[#9AA9B8]" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-right text-[10px] font-semibold",
          tone === "green" && "text-[#1E9E56]",
          tone === "red" && "text-[#E5484D]",
          (!tone || tone === "normal") && "text-[#0F2D4A]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ProcessingHealthPanel({ health }: { health: AiServiceHealth }) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 pb-1 pt-3.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Activity size={14} className="shrink-0 text-[#0A9189]" aria-hidden />
          <h2 className="truncate text-[12.5px] font-semibold text-[#0F2D4A]">
            AI Processing Health
          </h2>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-semibold",
            SERVICE_STYLES[health.state],
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {SERVICE_STATE_LABEL[health.state]}
        </span>
      </div>

      <div className="px-3.5 pb-1">
        <HealthRow icon={Server} label="Processing Service" value={SERVICE_STATE_LABEL[health.state]} tone="green" />
        <HealthRow
          icon={Timer}
          label="Average Processing Time"
          value={`${health.averageSeconds} seconds`}
        />
        <HealthRow
          icon={TrendingUp}
          label="Success Rate"
          value={`${health.successRate.toFixed(1)}%`}
        />
        <HealthRow
          icon={TriangleAlert}
          label="Failed Jobs (Last 24h)"
          value={String(health.failedLast24h)}
          tone="red"
        />
        <HealthRow
          icon={ListOrdered}
          label="Queue Length"
          value={`${health.queueLength} jobs`}
        />
        <HealthRow
          icon={RefreshCw}
          label="Last Updated"
          value={formatDateTime(new Date(health.lastUpdated))}
          last
        />
      </div>

      <SimulatedNote>
        Simulated demo telemetry. Not connected to a live AI processing service.
      </SimulatedNote>
    </Panel>
  );
}

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  generated: FileText,
  approved: CheckCircle2,
  failed: TriangleAlert,
  retry: RefreshCw,
  health: Activity,
  maintenance: Wrench,
};

const ACTIVITY_TONES: Record<ActivityType, string> = {
  generated: "bg-[#EFF4FF] text-[#3B6EF6]",
  approved: "bg-[#E9F9EF] text-[#1E9E56]",
  failed: "bg-[#FDECEF] text-[#E5484D]",
  retry: "bg-[#E6FAF7] text-[#0A9189]",
  health: "bg-[#F3EEFF] text-[#8B5CF6]",
  maintenance: "bg-[#FFF6E5] text-[#C77A0A]",
};

export function ActivityRows({ activities }: { activities: OperationalActivity[] }) {
  return (
    <ul className="divide-y divide-line/60">
      {activities.map((activity) => {
        const Icon = ACTIVITY_ICONS[activity.type];
        return (
          <li key={activity.id} className="flex items-start gap-2.5 py-2.5 first:pt-1 last:pb-0">
            <span
              className={cn(
                "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
                ACTIVITY_TONES[activity.type],
              )}
              aria-hidden
            >
              <Icon size={12} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-[10px] font-medium leading-tight text-[#0F2D4A]">
                  {activity.title}
                </p>
                <span className="shrink-0 text-[8.5px] text-[#9AA9B8]">
                  {relativeActivityTime(activity.occurredAt)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[9px] text-[#7A8B9C]" title={activity.detail}>
                {activity.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function RecentActivityPanel({
  activities,
  onSeeAll,
}: {
  activities: OperationalActivity[];
  onSeeAll: () => void;
}) {
  return (
    <Panel className="p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Recent Activity</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-[9.5px] font-semibold text-[#0A9189] transition hover:underline"
        >
          See All
        </button>
      </div>
      <div className="mt-1.5">
        <ActivityRows activities={activities.slice(0, 5)} />
      </div>
    </Panel>
  );
}

export function TopDoctorsPanel({
  ranking,
  range,
  onRangeChange,
}: {
  ranking: DoctorRanking[];
  range: AiRangeKey;
  onRangeChange: (range: AiRangeKey) => void;
}) {
  const top = ranking.slice(0, 5);
  const max = Math.max(1, ...top.map((entry) => entry.count));

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between gap-1.5 px-3.5 pb-1 pt-3.5">
        <h2 className="truncate whitespace-nowrap text-[11.5px] font-semibold tracking-tight text-[#0F2D4A]">
          Top Doctors by Reports
        </h2>
        <RangeSelect
          value={range}
          options={AI_RANGE_OPTIONS}
          onChange={onRangeChange}
          label="Doctor ranking period"
          display={AI_RANGE_OPTIONS.find((option) => option.value === range)?.label}
          compact
        />
      </div>

      <ul className="space-y-2 px-3.5 pb-3 pt-1.5">
        {top.map((entry, index) => (
          <li key={entry.doctor.id} className="flex items-center gap-1.5">
            <span className="w-3 shrink-0 text-[9px] font-semibold text-[#9AA9B8]">
              {index + 1}
            </span>
            <Avatar name={entry.doctor.name} size={23} />
            <div className="min-w-0 w-[100px] shrink-0">
              <p className="truncate text-[9.5px] font-semibold leading-tight text-[#0F2D4A]">
                {entry.doctor.name}
              </p>
              <p className="truncate text-[8.5px] leading-tight text-[#9AA9B8]">
                {entry.doctor.specialty}
              </p>
            </div>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#E7EFEF]">
              <span
                className="block h-full rounded-full bg-[#0A9189]"
                style={{ width: `${Math.max(10, (entry.count / max) * 100)}%` }}
              />
            </span>
            <span className="w-7 shrink-0 text-right text-[10px] font-semibold text-[#0F2D4A]">
              {entry.count}
            </span>
          </li>
        ))}
      </ul>

      <SimulatedNote>
        AI-assisted report activity only — an operational metric, not a clinical quality score.
      </SimulatedNote>
    </Panel>
  );
}

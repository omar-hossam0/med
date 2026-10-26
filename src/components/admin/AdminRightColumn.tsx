"use client";

import {
  Calendar,
  CalendarClock,
  AlertCircle,
  UserPlus,
  CheckCircle2,
  ChevronRight,
  Stethoscope,
  Users,
  CalendarDays,
  FileText,
  Activity,
  Database,
  Cpu,
  HardDrive,
  type LucideIcon,
} from "lucide-react";
import {
  today,
  quote,
  notifications,
  quickActions,
  systemHealth,
  type NotifIcon,
  type QuickIcon,
  type KpiTone,
} from "@/lib/mock/admin";
import { Sparkline } from "./ui";
import { useComingSoon } from "./ComingSoon";
import { cn } from "@/lib/cn";

/* ---------------- Date + quote ---------------- */
export function DateQuotePanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-[11px] text-[#5B6B7C] shadow-soft">
        <Calendar size={14} className="text-[#0A9189]" />
        {today}
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#EEF3FF_0%,#F3F0FF_100%)] p-4">
        <span aria-hidden className="block text-[30px] font-bold leading-none text-[#8B9BF6]">
          &ldquo;
        </span>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#3D4A63]">{quote}</p>
        <span aria-hidden className="mt-2 block h-px w-8 bg-[#8B9BF6]/50" />
      </div>
    </div>
  );
}

/* ---------------- Notifications ---------------- */
const NOTIF_ICONS: Record<NotifIcon, LucideIcon> = {
  calendar: CalendarClock,
  alert: AlertCircle,
  user: UserPlus,
  check: CheckCircle2,
};
const TONES: Record<KpiTone, { bg: string; fg: string }> = {
  teal: { bg: "bg-[#E6FAF7]", fg: "text-[#0A9189]" },
  blue: { bg: "bg-[#EFF4FF]", fg: "text-[#3B6EF6]" },
  violet: { bg: "bg-[#F3EEFF]", fg: "text-[#8B5CF6]" },
  amber: { bg: "bg-[#FFF6E5]", fg: "text-[#E09A1B]" },
  rose: { bg: "bg-[#FDECEF]", fg: "text-[#E5484D]" },
};

export function NotificationsPanel() {
  const comingSoon = useComingSoon();
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#0F2D4A]">Important Notifications</h3>
        <button
          type="button"
          onClick={() => comingSoon("All notifications")}
          className="text-[10px] font-semibold text-[#0A9189] hover:underline"
        >
          See All
        </button>
      </div>
      <ul className="mt-2.5 space-y-2.5">
        {notifications.map((n) => {
          const Icon = NOTIF_ICONS[n.icon];
          const tone = TONES[n.tone];
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => comingSoon("Notification details")}
                className="flex w-full items-center gap-2.5 rounded-lg text-left transition hover:bg-surface-subtle"
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", tone.bg, tone.fg)}>
                  <Icon size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-medium text-[#0F2D4A]">
                    {n.text}
                  </span>
                  <span className="block text-[9px] text-ink-muted">{n.time}</span>
                </span>
                <ChevronRight size={13} className="shrink-0 text-ink-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- Quick actions ---------------- */
const QUICK_ICONS: Record<QuickIcon, LucideIcon> = {
  stethoscope: Stethoscope,
  users: Users,
  calendar: CalendarDays,
  file: FileText,
};

export function QuickActionsPanel() {
  const comingSoon = useComingSoon();
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <h3 className="text-[13px] font-semibold text-[#0F2D4A]">Quick Actions</h3>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {quickActions.map((q) => {
          const Icon = QUICK_ICONS[q.icon];
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => comingSoon(q.label)}
              className="flex items-center gap-1.5 rounded-xl border border-line/70 p-2 text-left transition hover:border-primary/30 hover:bg-surface-subtle"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#E6FAF7] text-[#0A9189]">
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1 text-[10px] font-medium leading-tight text-[#0F2D4A]">
                {q.label}
              </span>
              <ChevronRight size={11} className="shrink-0 text-ink-muted" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- System health ---------------- */
const HEALTH_ICONS: Record<string, LucideIcon> = {
  app: Activity,
  db: Database,
  ai: Cpu,
  files: HardDrive,
};

export function SystemHealthPanel() {
  const comingSoon = useComingSoon();
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[#0F2D4A]">System Health</h3>
        <span className="flex items-center gap-1 text-[8.5px] font-medium text-[#1E9E56]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1E9E56]" />
          All Systems Operational
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {systemHealth.map((s) => {
          const Icon = HEALTH_ICONS[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => comingSoon(`${s.label} health`)}
              className="rounded-xl border border-line/70 p-2 text-left transition hover:border-primary/30"
            >
              <div className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-[#E9F9EF] text-[#1E9E56]">
                  <Icon size={11} />
                </span>
                <span className="text-[9px] text-[#7A8B9C]">{s.label}</span>
              </div>
              <p className="mt-1 text-[12.5px] font-bold leading-none text-[#0F2D4A]">{s.value}</p>
              <p className="text-[8.5px] text-ink-muted">Uptime</p>
              <div className="mt-1">
                <Sparkline points={s.trend} color="#1E9E56" width={72} height={14} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

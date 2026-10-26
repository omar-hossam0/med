"use client";

import {
  Activity,
  ChevronRight,
  Droplets,
  FlaskConical,
  HeartPulse,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import {
  careTeam,
  labResults,
  patientMessages,
  type LabIcon,
  type LabTone,
} from "@/lib/mock/patient";
import { Avatar, StatusBadge } from "./ui";
import { useComingSoon } from "./ComingSoon";
import { cn } from "@/lib/cn";

const LAB_ICONS: Record<LabIcon, LucideIcon> = {
  flask: FlaskConical,
  droplet: Droplets,
  liver: Activity,
  heart: HeartPulse,
};

const LAB_TONES: Record<LabTone, { bg: string; fg: string }> = {
  violet: { bg: "bg-[#F3EEFF]", fg: "text-[#8B5CF6]" },
  blue: { bg: "bg-[#EFF4FF]", fg: "text-[#3B6EF6]" },
  teal: { bg: "bg-[#E6FAF7]", fg: "text-[#0A9189]" },
  rose: { bg: "bg-[#FDECEF]", fg: "text-[#E5484D]" },
};

const CARD_CLASS =
  "flex h-full flex-col rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_8px_26px_-22px_rgba(15,45,74,0.28)]";

export function RecentLabResultsCard() {
  const comingSoon = useComingSoon();
  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[#0F2D4A]">Recent Lab Results</h3>
        <button
          type="button"
          onClick={() => comingSoon("All lab results")}
          className="text-[11px] font-semibold text-[#0A9189] transition hover:underline"
        >
          See All
        </button>
      </div>

      <ul className="mt-1.5 flex-1">
        {labResults.map((result) => {
          const Icon = LAB_ICONS[result.icon];
          const tone = LAB_TONES[result.tone];
          return (
            <li key={result.id} className="border-b border-[#EEF4F4] last:border-0">
              <button
                type="button"
                onClick={() => comingSoon("Lab result details")}
                className="flex w-full items-center gap-2.5 py-2.5 text-left transition hover:bg-[#FAFDFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    tone.bg,
                    tone.fg,
                  )}
                >
                  <Icon size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-medium text-[#0F2D4A]">
                    {result.name}
                  </span>
                  <span className="mt-0.5 block text-[8.5px] text-ink-muted">
                    {result.date}
                  </span>
                </span>
                <StatusBadge status={result.status} />
                <ChevronRight size={13} className="shrink-0 text-ink-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MyDoctorsCard() {
  const comingSoon = useComingSoon();
  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[#0F2D4A]">My Doctors</h3>
        <button
          type="button"
          onClick={() => comingSoon("All doctors")}
          className="text-[11px] font-semibold text-[#0A9189] transition hover:underline"
        >
          See All
        </button>
      </div>

      <ul className="mt-1.5 flex-1">
        {careTeam.map((doctor) => (
          <li
            key={doctor.id}
            className="flex items-center gap-1 border-b border-[#EEF4F4] py-2 last:border-0"
          >
            <button
              type="button"
              onClick={() => comingSoon("Doctor profile")}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
            >
              <Avatar name={doctor.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10.5px] font-semibold text-[#0F2D4A]">
                  {doctor.name}
                </span>
                <span className="block truncate text-[8.5px] text-ink-muted">
                  {doctor.specialty}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => comingSoon(`Message ${doctor.name}`)}
              aria-label={`Message ${doctor.name}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F0FBFA] text-[#0A9189] transition hover:bg-[#DFF7F2]"
            >
              <MessageCircle size={13} />
            </button>
            <ChevronRight size={13} className="shrink-0 text-ink-muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MessagesCard() {
  const comingSoon = useComingSoon();
  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-[#0F2D4A]">
          Messages from Healthcare Team
        </h3>
        <button
          type="button"
          onClick={() => comingSoon("All messages")}
          className="shrink-0 text-[11px] font-semibold text-[#0A9189] transition hover:underline"
        >
          See All
        </button>
      </div>

      <ul className="mt-1.5 flex-1">
        {patientMessages.map((message) => (
          <li key={message.id} className="border-b border-[#EEF4F4] last:border-0">
            <button
              type="button"
              onClick={() => comingSoon("Message thread")}
              className="flex w-full items-center gap-2.5 py-2.5 text-left transition hover:bg-[#FAFDFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
            >
              <Avatar name={message.sender} size={32} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[10.5px] text-[#0F2D4A]",
                    message.unread ? "font-semibold" : "font-medium",
                  )}
                >
                  {message.sender}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[9px]",
                    message.unread ? "text-[#5B6B7C]" : "text-[#8A99A8]",
                  )}
                >
                  {message.preview}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="whitespace-nowrap text-[8.5px] text-ink-muted">
                  {message.time}
                </span>
                {message.unread && (
                  <span
                    aria-label="Unread"
                    className="h-1.5 w-1.5 rounded-full bg-[#3B6EF6]"
                  />
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

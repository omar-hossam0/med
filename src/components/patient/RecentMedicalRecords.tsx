"use client";

import {
  Stethoscope,
  FlaskConical,
  ScanLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { medicalRecords, type RecordIcon } from "@/lib/mock/patient";
import { useComingSoon } from "./ComingSoon";

const ICONS: Record<RecordIcon, LucideIcon> = {
  stethoscope: Stethoscope,
  flask: FlaskConical,
  xray: ScanLine,
  derm: Sparkles,
};

export function RecentMedicalRecords() {
  const comingSoon = useComingSoon();

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[13.5px] font-semibold text-[#0F2D4A]">Recent Medical Records</h3>
        <button
          type="button"
          onClick={() => comingSoon("All medical records")}
          className="text-[11.5px] font-semibold text-[#0A9189] hover:underline"
        >
          View All
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {medicalRecords.map((r) => {
          const Icon = ICONS[r.icon];
          return (
            <div
              key={r.id}
              className="flex items-center gap-2.5 rounded-xl border border-line/70 p-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EFF4FF] text-[#3B6EF6]">
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-snug text-[#0F2D4A]">{r.title}</p>
                <p className="mt-0.5 truncate text-[10px] text-ink-muted">
                  {r.doctor} · {r.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => comingSoon("Record view")}
                className="h-7 shrink-0 rounded-full border border-line px-3 text-[10.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
              >
                View
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

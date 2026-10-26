"use client";

import { LockKeyhole } from "lucide-react";
import type { OperationalActivity } from "@/lib/mock/aiMonitoring";
import { SideDrawer } from "./SideDrawer";
import { ActivityRows } from "./MonitoringPanels";
import { DemoChip } from "./ui";

export function ActivityDrawer({
  open,
  onClose,
  activities,
}: {
  open: boolean;
  onClose: () => void;
  activities: OperationalActivity[];
}) {
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Operational Activity"
      subtitle="Nonclinical workflow events — demo feed"
      width={420}
      footer={
        <p className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[#7A8B9C]">
          <LockKeyhole size={12} className="mt-px shrink-0" aria-hidden />
          Administrative event feed. Report content, diagnoses, and patient identity are
          intentionally excluded.
        </p>
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] text-[#7A8B9C]">
          {activities.length} recent workflow events
        </p>
        <DemoChip label="Simulated feed" />
      </div>
      <ActivityRows activities={activities} />
    </SideDrawer>
  );
}

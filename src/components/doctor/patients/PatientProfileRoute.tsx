"use client";

import { useSearchParams } from "next/navigation";
import { FullPatientProfile } from "./FullPatientProfile";

const TABS = ["overview", "history", "visits", "labs", "medications", "documents"] as const;
type TabKey = (typeof TABS)[number];

function resolveTab(value: string | null): TabKey {
  return TABS.includes(value as TabKey) ? (value as TabKey) : "overview";
}

/** Reads `?tab=` so "Review Labs" can deep-link straight into the lab tab. */
export function PatientProfileRoute({ patientId }: { patientId: string }) {
  const searchParams = useSearchParams();
  return <FullPatientProfile patientId={patientId} initialTab={resolveTab(searchParams.get("tab"))} />;
}

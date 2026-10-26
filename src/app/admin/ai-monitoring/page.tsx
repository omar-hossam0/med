import type { Metadata } from "next";
import { AiMonitoring } from "@/components/admin/ai-monitoring/AiMonitoring";

export const metadata: Metadata = {
  title: "AI Reports Monitoring — Medora",
  description:
    "Administrative monitoring of AI-assisted report processing, workflow status, and service health using demo data.",
};

export default function AiMonitoringPage() {
  return <AiMonitoring />;
}

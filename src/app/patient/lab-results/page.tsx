import type { Metadata } from "next";
import { LabResultsModule } from "@/components/patient/lab-results/LabResultsModule";

export const metadata: Metadata = {
  title: "Lab Results — Medora",
  description:
    "View and track your Medora laboratory results: test values, reference ranges, trends, reports and related visits.",
};

export default function PatientLabResultsPage() {
  return <LabResultsModule />;
}

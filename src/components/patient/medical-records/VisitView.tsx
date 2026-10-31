"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  CalendarDays,
  Download,
  FileText,
  Heart,
  Hospital,
  MessageSquare,
  Ruler,
  Stethoscope,
  Thermometer,
  UserRound,
  Weight,
  type LucideIcon,
} from "lucide-react";
import {
  formatRecordDate,
  formatRecordDateTime,
  getLabResult,
  getMedicalDoctor,
  getPrescription,
  getVisitFile,
  type LabResult,
  type MedicalFile,
  type Prescription,
  type Visit,
} from "@/lib/mock/medicalRecords";
import { RecordStatusBadge, RecordTypeIcon } from "./badges";
import { FilePreviewItem } from "./FilePreviewItem";
import { EmptyState, InfoNote, MoreMenu, SectionCard, demoExport, downloadTextFile } from "./ui";
import { cn } from "@/lib/cn";

type VisitTab = "Summary" | "Diagnosis" | "Medications" | "Lab Results" | "Files";

const TAB_ORDER: VisitTab[] = [
  "Summary",
  "Diagnosis",
  "Medications",
  "Lab Results",
  "Files",
];

export function VisitView({
  visit,
  compact = false,
  onOpenPrescription,
  onOpenLab,
  onOpenFile,
  onViewReport,
  onBookFollowUp,
  onToast,
}: {
  visit: Visit;
  compact?: boolean;
  onOpenPrescription: (id: string) => void;
  onOpenLab: (id: string) => void;
  onOpenFile: (file: MedicalFile) => void;
  onViewReport: (id: string) => void;
  onBookFollowUp: (doctorId: string) => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<VisitTab>("Summary");
  const doctor = getMedicalDoctor(visit.doctorId);

  const medications = useMemo(
    () =>
      visit.medicationIds
        .map((id) => getPrescription(id))
        .filter((item): item is Prescription => Boolean(item)),
    [visit.medicationIds],
  );

  const labs = useMemo(
    () =>
      visit.labIds
        .map((id) => getLabResult(id))
        .filter((item): item is LabResult => Boolean(item)),
    [visit.labIds],
  );

  const files = useMemo(
    () =>
      visit.fileIds
        .map((id) => getVisitFile(id))
        .filter((item): item is MedicalFile => Boolean(item)),
    [visit.fileIds],
  );

  const counts: Record<VisitTab, number> = {
    Summary: 0,
    Diagnosis: 0,
    Medications: medications.length,
    "Lab Results": labs.length,
    Files: files.length,
  };

  const downloadSummary = () => {
    downloadTextFile(
      `${visit.title.replace(/\s+/g, "-").toLowerCase()}-summary.txt`,
      demoExport(visit.title, [
        `Date: ${formatRecordDateTime(visit.date, visit.time)}`,
        `Doctor: ${doctor?.name ?? "Medora care team"}`,
        `Facility: ${visit.facility}`,
        `Specialty: ${visit.specialty}`,
        `Status: ${visit.status}`,
        "",
        "Visit summary",
        visit.summary,
        "",
        "Diagnosis",
        `${visit.diagnosis.code} — ${visit.diagnosis.name}`,
        visit.diagnosis.description,
        "",
        "Follow-up",
        visit.followUp.recommendation,
        visit.followUp.note,
      ]),
    );
    onToast("Visit summary downloaded as a demo text file.");
  };

  return (
    <SectionCard className={cn(compact ? "p-3.5" : "p-4")}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <RecordTypeIcon type="visit" size={compact ? "md" : "lg"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "font-bold leading-tight tracking-[-0.015em] text-[#0F2D4A]",
                compact ? "text-[14px]" : "text-[19px]",
              )}
            >
              {visit.title}
            </h2>
            <RecordStatusBadge status={visit.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[9.5px] text-[#5B6B7C]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={11} className="text-[#9AA9B8]" aria-hidden />
              {formatRecordDateTime(visit.date, visit.time)}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound size={11} className="text-[#9AA9B8]" aria-hidden />
              {doctor?.name ?? "Medora care team"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hospital size={11} className="text-[#9AA9B8]" aria-hidden />
              {visit.facility}
            </span>
            <span className="inline-flex items-center gap-1">
              <Stethoscope size={11} className="text-[#9AA9B8]" aria-hidden />
              {visit.specialty}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {visit.reportId ? (
            <button
              type="button"
              onClick={() => onViewReport(visit.reportId!)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-[#BFE8E2] bg-white font-semibold text-[#0A9189] transition hover:bg-[#F0FCFA]",
                compact ? "h-7 px-2 text-[9px]" : "h-8 px-2.5 text-[10px]",
              )}
            >
              <FileText size={12} aria-hidden />
              View Medical Report
            </button>
          ) : null}
          <MoreMenu
            actions={[
              {
                label: "Download visit summary",
                icon: Download,
                onClick: downloadSummary,
              },
              {
                label: "Request a correction",
                icon: MessageSquare,
                onClick: () =>
                  onToast(
                    "Correction request noted in this demo. No message was sent.",
                  ),
              },
            ]}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex gap-1 overflow-x-auto border-b border-[#EDF3F3]">
        {TAB_ORDER.map((item) => {
          const selected = tab === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              aria-selected={selected}
              role="tab"
              className={cn(
                "relative shrink-0 px-2 py-2 text-[10px] font-semibold transition-colors",
                selected ? "text-[#0A9189]" : "text-[#7187A6] hover:text-[#0F2D4A]",
              )}
            >
              {item}
              {counts[item] > 0 ? (
                <span className="ml-1 text-[8.5px] text-[#9AA9B8]">({counts[item]})</span>
              ) : null}
              {selected && (
                <span className="absolute inset-x-1 -bottom-[1px] h-[2px] rounded-full bg-[#0A9189]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="pt-3">
        {tab === "Summary" && (
          <VisitSummary
            visit={visit}
            compact={compact}
            onBookFollowUp={() => onBookFollowUp(visit.doctorId)}
          />
        )}

        {tab === "Diagnosis" && (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#EFF4FF] px-2 py-0.5 text-[9px] font-bold tracking-wide text-[#2563EB]">
                    {visit.diagnosis.code}
                  </span>
                  <h3 className="text-[12px] font-semibold text-[#0F2D4A]">
                    {visit.diagnosis.name}
                  </h3>
                </div>
                <RecordStatusBadge status={visit.diagnosis.status} />
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-[#5B6B7C]">
                {visit.diagnosis.description}
              </p>
            </div>
            <InfoNote>
              This diagnosis was recorded by your clinician and is read-only. Contact
              your care team if you believe it needs correction.
            </InfoNote>
          </div>
        )}

        {tab === "Medications" && (
          <div className="space-y-2">
            {medications.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No medications recorded"
                description="No prescriptions were recorded for this visit."
              />
            ) : (
              medications.map((prescription) => (
                <div
                  key={prescription.id}
                  className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#E6EFEE] p-2.5"
                >
                  <RecordTypeIcon type="prescription" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] font-semibold text-[#0F2D4A]">
                      {prescription.medication}
                    </p>
                    <p className="mt-0.5 truncate text-[8.5px] text-[#8A99A8]">
                      {prescription.dosage} · {prescription.frequency}
                    </p>
                  </div>
                  <RecordStatusBadge status={prescription.status} />
                  <button
                    type="button"
                    onClick={() => onOpenPrescription(prescription.id)}
                    className="h-7 rounded-lg border border-[#E6EFEE] px-2.5 text-[9px] font-semibold text-[#0A9189] transition hover:border-[#BFE8E2] hover:bg-[#F0FCFA]"
                  >
                    View Prescription
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "Lab Results" && (
          <div className="space-y-2">
            {labs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No lab results"
                description="No laboratory results are linked to this visit."
              />
            ) : (
              labs.map((lab) => (
                <div
                  key={lab.id}
                  className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#E6EFEE] p-2.5"
                >
                  <RecordTypeIcon type="lab" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] font-semibold text-[#0F2D4A]">
                      {lab.name}
                    </p>
                    <p className="mt-0.5 truncate text-[8.5px] text-[#8A99A8]">
                      {formatRecordDate(lab.date)} · {lab.facility}
                    </p>
                  </div>
                  <RecordStatusBadge status={lab.status} />
                  <button
                    type="button"
                    onClick={() => onOpenLab(lab.id)}
                    className="h-7 rounded-lg border border-[#E6EFEE] px-2.5 text-[9px] font-semibold text-[#0A9189] transition hover:border-[#BFE8E2] hover:bg-[#F0FCFA]"
                  >
                    View Result
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "Files" && (
          <div className="space-y-2">
            {files.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No files attached"
                description="No documents are attached to this visit."
              />
            ) : (
              files.map((file) => (
                <FilePreviewItem
                  key={file.id}
                  file={file}
                  onPreview={() => onOpenFile(file)}
                  onDownload={() => {
                    downloadTextFile(
                      `${file.name.replace(/\.[^.]+$/, "")}-demo.txt`,
                      demoExport(file.name, [
                        `Category: ${file.category}`,
                        `Date: ${formatRecordDate(file.date)}`,
                        `Size: ${file.size}`,
                        "Demo export generated by the patient dashboard.",
                      ]),
                    );
                    onToast("Demo file downloaded. No clinical file was transferred.");
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Summary panel                                                       */
/* ------------------------------------------------------------------ */

function VisitSummary({
  visit,
  compact,
  onBookFollowUp,
}: {
  visit: Visit;
  compact: boolean;
  onBookFollowUp: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#E1F1ED] bg-[#F7FCFB] p-3">
        <div className="flex items-center gap-1.5">
          <FileText size={13} className="text-[#0A9189]" aria-hidden />
          <h3 className="text-[11px] font-semibold text-[#0F2D4A]">Visit Summary</h3>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#5B6B7C]">
          {visit.summary}
        </p>
      </div>

      <div>
        <h3 className="text-[10.5px] font-semibold text-[#33475B]">Vitals</h3>
        <div
          className={cn(
            "mt-1.5 grid gap-1.5",
            compact
              ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5"
              : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
          )}
        >
          <VitalCard
            icon={Ruler}
            label="Height"
            value={visit.vitals.height}
            tone="bg-[#EFF4FF] text-[#2563EB]"
          />
          <VitalCard
            icon={Weight}
            label="Weight"
            value={visit.vitals.weight}
            tone="bg-[#E7FBF8] text-[#0A9189]"
          />
          <VitalCard
            icon={Heart}
            label="Blood Pressure"
            value={visit.vitals.bloodPressure}
            tone="bg-[#FFE9EE] text-[#E5486B]"
          />
          <VitalCard
            icon={Activity}
            label="Heart Rate"
            value={visit.vitals.heartRate}
            tone="bg-[#FFE9EE] text-[#E5486B]"
          />
          <VitalCard
            icon={Thermometer}
            label="Temperature"
            value={visit.vitals.temperature}
            tone="bg-[#FFF6E5] text-[#C77A0A]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-[#E6EFEE] p-3 sm:flex-row sm:items-center">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E7FBF8] text-[#0A9189]">
          <CalendarClock size={15} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10.5px] font-semibold text-[#0F2D4A]">Follow-up Plan</h3>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#5B6B7C]">
            {visit.followUp.recommendation} {visit.followUp.note}
          </p>
        </div>
        <button
          type="button"
          onClick={onBookFollowUp}
          className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-[#BFE8E2] px-2.5 text-[9px] font-semibold text-[#0A9189] transition hover:bg-[#F0FCFA]"
        >
          Book Follow-up
        </button>
      </div>
    </div>
  );
}

function VitalCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#E6EFEE] bg-white p-1.5">
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md", tone)}>
        <Icon size={12} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[7.5px] leading-tight text-[#8A99A8]">{label}</p>
        <p className="truncate text-[9px] font-bold leading-tight text-[#0F2D4A]">
          {value}
        </p>
      </div>
    </div>
  );
}

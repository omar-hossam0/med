"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Download,
  FileText,
  Hospital,
  Pill,
  Repeat,
  Stethoscope,
  UserRound,
} from "lucide-react";
import {
  formatRecordDate,
  getMedicalDoctor,
  getVisit,
  type Prescription,
} from "@/lib/mock/medicalRecords";
import { RecordStatusBadge, RecordTypeIcon } from "./badges";
import { DetailField, MoreMenu, SectionCard, demoExport, downloadTextFile } from "./ui";
import { cn } from "@/lib/cn";

type PrescriptionTab = "Prescription Details" | "Instructions" | "Related Visit";

const TABS: PrescriptionTab[] = [
  "Prescription Details",
  "Instructions",
  "Related Visit",
];

export function PrescriptionView({
  prescription,
  compact = false,
  onOpenVisit,
  onOpenFull,
  onToast,
}: {
  prescription: Prescription;
  compact?: boolean;
  onOpenVisit: (id: string) => void;
  onOpenFull?: () => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<PrescriptionTab>("Prescription Details");
  const doctor = getMedicalDoctor(prescription.doctorId);
  const relatedVisit = getVisit(prescription.relatedVisitId);

  const download = () => {
    downloadTextFile(
      `${prescription.medication.replace(/\s+/g, "-").toLowerCase()}-prescription.txt`,
      demoExport(`${prescription.medication} — Prescription`, [
        `Doctor: ${doctor?.name ?? "Medora care team"}`,
        `Facility: ${prescription.facility}`,
        `Prescription date: ${formatRecordDate(prescription.date)}`,
        `Status: ${prescription.status}`,
        "",
        "Medication information",
        `Dosage: ${prescription.dosage}`,
        `Frequency: ${prescription.frequency}`,
        `Duration: ${prescription.duration}`,
        `Start date: ${formatRecordDate(prescription.startDate)}`,
        `End date: ${formatRecordDate(prescription.endDate)}`,
        `Refills: ${prescription.refills}`,
        "",
        "Doctor instructions",
        ...prescription.instructions.map((line) => `- ${line}`),
        "",
        "Important",
        prescription.warning,
      ]),
    );
    onToast("Prescription downloaded as a demo text file.");
  };

  return (
    <SectionCard className={cn(compact ? "p-3.5" : "p-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <RecordTypeIcon type="prescription" size={compact ? "md" : "lg"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "font-bold leading-tight tracking-[-0.015em] text-[#0F2D4A]",
                compact ? "text-[14px]" : "text-[19px]",
              )}
            >
              {prescription.medication}
            </h2>
            <RecordStatusBadge status={prescription.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[9.5px] text-[#5B6B7C]">
            <span className="inline-flex items-center gap-1">
              <UserRound size={11} className="text-[#9AA9B8]" aria-hidden />
              {doctor?.name ?? "Medora care team"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hospital size={11} className="text-[#9AA9B8]" aria-hidden />
              {prescription.facility}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={11} className="text-[#9AA9B8]" aria-hidden />
              {formatRecordDate(prescription.date)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={download}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-[#E6EFEE] bg-white font-semibold text-[#33475B] transition hover:border-[#BFE8E2] hover:text-[#0A9189]",
              compact ? "h-7 px-2 text-[9px]" : "h-8 px-2.5 text-[10px]",
            )}
          >
            <Download size={12} aria-hidden />
            Download
          </button>
          <MoreMenu
            actions={[
              { label: "Download prescription", icon: Download, onClick: download },
              {
                label: "Request a refill",
                icon: Repeat,
                onClick: () =>
                  onToast(
                    "Refill request noted in this demo. No request was sent to the clinic.",
                  ),
              },
            ]}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-3 flex gap-1 overflow-x-auto border-b border-[#EDF3F3]">
          {TABS.map((item) => {
            const selected = tab === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item)}
                className={cn(
                  "relative shrink-0 px-2 py-2 text-[10px] font-semibold transition-colors",
                  selected ? "text-[#0A9189]" : "text-[#7187A6] hover:text-[#0F2D4A]",
                )}
              >
                {item}
                {selected && (
                  <span className="absolute inset-x-1 -bottom-[1px] h-[2px] rounded-full bg-[#0A9189]" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-3">
        {compact ? (
          <div className="space-y-2.5">
            <MedicationInformation prescription={prescription} />
            <DoctorInstructions prescription={prescription} />
            {onOpenFull ? (
              <button
                type="button"
                onClick={onOpenFull}
                className="h-8 w-full rounded-lg bg-[#0A9189] text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
              >
                View Full Prescription
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {tab === "Prescription Details" && (
              <div className="grid gap-3 md:grid-cols-2">
                <MedicationInformation prescription={prescription} />
                <DoctorInstructions prescription={prescription} />
              </div>
            )}

            {tab === "Instructions" && (
              <div className="max-w-2xl">
                <DoctorInstructions prescription={prescription} />
              </div>
            )}

            {tab === "Related Visit" && (
              <div>
                {relatedVisit ? (
                  <RelatedVisitCard
                    title={relatedVisit.title}
                    date={relatedVisit.date}
                    doctor={getMedicalDoctor(relatedVisit.doctorId)?.name ?? ""}
                    facility={relatedVisit.facility}
                    onOpen={() => onOpenVisit(relatedVisit.id)}
                  />
                ) : (
                  <p className="rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-4 text-center text-[10.5px] text-[#7187A6]">
                    This prescription is not linked to a visit in your records.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}

function MedicationInformation({ prescription }: { prescription: Prescription }) {
  return (
    <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
      <div className="flex items-center gap-1.5">
        <Pill size={13} className="text-[#0A9189]" aria-hidden />
        <h3 className="text-[11px] font-semibold text-[#0F2D4A]">
          Medication Information
        </h3>
      </div>
      <div className="mt-1.5 divide-y divide-[#F0F5F5]">
        <DetailField label="Medication Name" value={prescription.medication} />
        <DetailField label="Dosage" value={prescription.dosage} />
        <DetailField label="Frequency" value={prescription.frequency} />
        <DetailField label="Duration" value={prescription.duration} />
        <DetailField label="Start Date" value={formatRecordDate(prescription.startDate)} />
        <DetailField label="End Date" value={formatRecordDate(prescription.endDate)} />
        <DetailField label="Refills" value={prescription.refills} />
      </div>
    </div>
  );
}

function DoctorInstructions({ prescription }: { prescription: Prescription }) {
  return (
    <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
      <div className="flex items-center gap-1.5">
        <Stethoscope size={13} className="text-[#0A9189]" aria-hidden />
        <h3 className="text-[11px] font-semibold text-[#0F2D4A]">
          Doctor Instructions
        </h3>
      </div>
      <ul className="mt-2 space-y-1.5">
        {prescription.instructions.map((instruction) => (
          <li key={instruction} className="flex items-start gap-1.5">
            <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
              <Check size={9} aria-hidden />
            </span>
            <span className="text-[10px] leading-relaxed text-[#5B6B7C]">
              {instruction}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 rounded-lg border border-[#FFD7DD] bg-[#FFF5F7] p-2.5">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-[#E5484D]" aria-hidden />
          <p className="text-[9.5px] font-bold text-[#C03546]">Important</p>
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-[#A83A4C]">
          {prescription.warning}
        </p>
      </div>

      <p className="mt-2 flex items-center gap-1 text-[8.5px] text-[#9AA9B8]">
        <FileText size={10} aria-hidden />
        Clinician-authored instructions. Patients cannot edit this prescription.
      </p>
    </div>
  );
}

function RelatedVisitCard({
  title,
  date,
  doctor,
  facility,
  onOpen,
}: {
  title: string;
  date: string;
  doctor: string;
  facility: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3 sm:flex-row sm:items-center">
      <RecordTypeIcon type="visit" size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold text-[#0F2D4A]">{title}</p>
        <p className="mt-0.5 text-[8.5px] text-[#8A99A8]">
          {formatRecordDate(date)} • {doctor} • {facility}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="h-7 shrink-0 rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[9px] font-semibold text-[#0A9189] transition hover:border-[#BFE8E2] hover:bg-[#F0FCFA]"
      >
        View Visit
      </button>
    </div>
  );
}

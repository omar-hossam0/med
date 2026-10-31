"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Download,
  FileText,
  Hospital,
  Info,
  Pill,
  Stethoscope,
  UserRound,
} from "lucide-react";
import {
  formatPrescriptionDate,
  getPrescriptionMedications,
  getPrescriptionMeta,
  getPrescriptionRecord,
  type Medication,
} from "@/lib/mock/prescriptions";
import { getVisit } from "@/lib/mock/medicalRecords";
import { EmptyState, MoreMenu, SectionCard, Toast, type ToastState, type ToastTone } from "@/components/patient/medical-records/ui";
import { PrescriptionsHeader, StatusBadge } from "./PrescriptionsChrome";
import { MedicationDrawer } from "./MedicationDrawer";
import { cn } from "@/lib/cn";

type DetailTab = "medications" | "instructions" | "visit" | "files";

export function PrescriptionDetail({ prescriptionId }: { prescriptionId: string }) {
  const router = useRouter();
  const prescription = getPrescriptionRecord(prescriptionId);

  const [tab, setTab] = useState<DetailTab>("medications");
  const [drawerMedicationId, setDrawerMedicationId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [returnTab, setReturnTab] = useState("all");

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("medora.prescriptions.tab");
      if (stored) setReturnTab(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string, tone: ToastTone = "info") =>
    setToast({ id: Date.now(), message, tone });

  if (!prescription) {
    return (
      <div className="space-y-3">
        <PrescriptionsHeader
          title="Prescription not found"
          subtitle="This prescription is not part of your Medora records."
          back={{ label: "Back to Prescriptions", onClick: () => router.push("/patient/prescriptions") }}
        />
        <SectionCard>
          <EmptyState
            icon={FileText}
            title="We couldn't open this prescription"
            description="The link may be out of date. Return to your prescriptions and choose a record from the list."
          />
        </SectionCard>
      </div>
    );
  }

  const medications = getPrescriptionMedications(prescription.id);
  const { doctor, facility, specialty } = getPrescriptionMeta(prescription);
  const visit = getVisit(prescription.relatedVisitId);
  const hasFiles = prescription.fileIds.length > 0;

  const backToPrescriptions = () =>
    router.push(`/patient/prescriptions?tab=${encodeURIComponent(returnTab)}`);

  const openVisit = () => {
    if (!prescription.relatedVisitId) return;
    router.push(`/patient/medical-records?visit=${prescription.relatedVisitId}`);
  };

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: "medications", label: "Medications", count: medications.length },
    { key: "instructions", label: "Instructions" },
    { key: "visit", label: "Related Visit" },
    { key: "files", label: "Files", count: prescription.fileIds.length },
  ];

  return (
    <div className="space-y-3">
      <PrescriptionsHeader
        title={prescription.title}
        subtitle={`${formatPrescriptionDate(prescription.date)} · ${doctor?.name ?? "Medora care team"} · ${facility} · ${specialty}`}
        back={{ label: "Back to Prescriptions", onClick: backToPrescriptions }}
        action={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                hasFiles
                  ? notify("Opening the attached document…")
                  : notify(
                      "No document is attached to this prescription yet. Ask your care team for a copy.",
                      "error",
                    )
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10.5px] font-semibold transition",
                hasFiles
                  ? "border-[#0A9189] bg-white text-[#0A9189] hover:bg-[#E7FBF8]"
                  : "cursor-not-allowed border-[#E6EFEE] bg-white text-[#A8B6C4]",
              )}
              aria-disabled={!hasFiles}
            >
              <Download size={13} aria-hidden />
              Download
            </button>
            <MoreMenu
              actions={[
                { label: "Open related visit", onClick: openVisit },
                {
                  label: "Copy prescription ID",
                  onClick: () => {
                    void navigator.clipboard?.writeText(prescription.id);
                    notify("Prescription ID copied.", "success");
                  },
                },
              ]}
            />
          </div>
        }
      />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_286px]">
        <SectionCard className="p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs.map((item) => {
              const selected = item.key === tab;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold transition",
                    selected
                      ? "bg-[#E7FBF8] text-[#0A9189]"
                      : "text-[#5B6B7C] hover:bg-[#F5FAFA] hover:text-[#0F2D4A]",
                  )}
                >
                  {item.label}
                  {typeof item.count === "number" ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-[1px] text-[8.5px] font-bold",
                        selected ? "bg-white text-[#0A9189]" : "bg-[#F1F6F6] text-[#5B6B7C]",
                      )}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5">
            {tab === "medications" ? (
              medications.length === 0 ? (
                <EmptyState
                  icon={Pill}
                  title="No medications on this prescription"
                  description="This prescription does not list any medications."
                />
              ) : (
                <ul className="space-y-2">
                  {medications.map((medication) => (
                    <li key={medication.id}>
                      <MedicationCard
                        medication={medication}
                        onViewDetails={() => setDrawerMedicationId(medication.id)}
                      />
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === "instructions" ? (
              prescription.instructions.length === 0 ? (
                <EmptyState
                  icon={Info}
                  title="No instructions recorded"
                  description="Your care team did not add written instructions to this prescription."
                />
              ) : (
                <div className="rounded-xl border border-[#D9EEF8] bg-[#F3FAFD] p-3">
                  <h3 className="text-[10.5px] font-semibold text-[#0F2D4A]">
                    Important Instructions
                  </h3>
                  <ul className="mt-1.5 space-y-1">
                    {prescription.instructions.map((instruction) => (
                      <li
                        key={instruction}
                        className="flex gap-1.5 text-[10px] leading-relaxed text-[#4A5C6E]"
                      >
                        <span
                          aria-hidden
                          className="mt-[5px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#0A9189]"
                        />
                        {instruction}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 border-t border-[#D9EEF8] pt-2 text-[9px] leading-relaxed text-[#7187A6]">
                    These instructions were written by your care team. Medora never generates or
                    changes medication instructions.
                  </p>
                </div>
              )
            ) : null}

            {tab === "visit" ? (
              visit ? (
                <div className="rounded-xl border border-[#EDF3F3] bg-white p-3">
                  <div className="flex items-start gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EFF4FF] text-[#2563EB]">
                      <Stethoscope size={14} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-[#0F2D4A]">
                        {visit.title}
                      </p>
                      <p className="truncate text-[9.5px] text-[#7187A6]">
                        {formatPrescriptionDate(visit.date)} · {visit.time} · {visit.specialty}
                      </p>
                      <p className="mt-1 text-[9.5px] leading-relaxed text-[#5B6B7C]">
                        {visit.summary}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openVisit}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#E6EFEE] bg-white px-2.5 py-1.5 text-[9.5px] font-semibold text-[#0A9189] transition hover:border-[#BFE8E2] hover:bg-[#F7FCFB]"
                  >
                    Open in Medical Records
                  </button>
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="No related visit recorded"
                  description="This prescription is not linked to a consultation in your medical records."
                />
              )
            ) : null}

            {tab === "files" ? (
              <EmptyState
                icon={FileText}
                title="No files attached"
                description="Your care team has not attached a document to this prescription yet."
              />
            ) : null}
          </div>
        </SectionCard>

        <aside className="space-y-3">
          <SectionCard className="p-3">
            <h2 className="text-[11px] font-semibold text-[#0F2D4A]">Prescription Information</h2>
            <dl className="mt-1.5 divide-y divide-[#F2F7F7]">
              <InfoRow label="Prescription ID" value={prescription.id} mono />
              <InfoRow label="Issue Date" value={formatPrescriptionDate(prescription.date)} />
              <InfoRow label="Status" value={<StatusBadge status={prescription.status} />} />
              <InfoRow
                label="Doctor"
                value={
                  <span className="inline-flex items-center gap-1">
                    <UserRound size={11} aria-hidden className="text-[#9AA9B8]" />
                    {doctor?.name ?? "Medora care team"}
                  </span>
                }
              />
              <InfoRow
                label="Medical Center"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Hospital size={11} aria-hidden className="text-[#9AA9B8]" />
                    {facility}
                  </span>
                }
              />
              <InfoRow
                label="Related Visit"
                value={
                  visit ? (
                    <button
                      type="button"
                      onClick={openVisit}
                      className="text-[10.5px] font-semibold text-[#0A9189] hover:underline"
                    >
                      {visit.title}
                    </button>
                  ) : (
                    "Not linked"
                  )
                }
              />
              <InfoRow label="Notes" value={prescription.notes ?? "—"} />
            </dl>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[#F7FCFB] p-2 text-[9px] leading-relaxed text-[#7187A6]">
              <Stethoscope size={11} aria-hidden className="mt-[1px] shrink-0 text-[#0A9189]" />
              Prescriptions are written by your care team and are read-only for patients.
            </p>
          </SectionCard>
        </aside>
      </div>

      <MedicationDrawer
        medicationId={drawerMedicationId}
        onClose={() => setDrawerMedicationId(null)}
        // The patient is already on this prescription, so "View Prescription"
        // simply returns them to it instead of pushing the same route again.
        onViewPrescription={() => setDrawerMedicationId(null)}
        onToast={notify}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function MedicationCard({
  medication,
  onViewDetails,
}: {
  medication: Medication;
  onViewDetails: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#EDF3F3] bg-white p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F3EEFF] text-[#8B5CF6]">
          <Pill size={14} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[11.5px] font-semibold text-[#0F2D4A]">{medication.name}</h3>
            <StatusBadge status={medication.status} />
          </div>
          <p className="mt-0.5 text-[9.5px] text-[#7187A6]">
            {medication.frequency} · {medication.duration}
          </p>
        </div>
        <button
          type="button"
          onClick={onViewDetails}
          className="shrink-0 rounded-lg border border-[#E6EFEE] bg-white px-2 py-1 text-[9.5px] font-semibold text-[#0A9189] transition hover:border-[#BFE8E2] hover:bg-[#F7FCFB]"
        >
          View Details
        </button>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[#F2F7F7] pt-2 sm:grid-cols-3 lg:grid-cols-5">
        <Cell label="Dosage" value={medication.dosage} />
        <Cell label="Frequency" value={medication.frequency} />
        <Cell label="Duration" value={medication.duration} />
        <Cell label="Start Date" value={formatPrescriptionDate(medication.startDate)} />
        <Cell label="End Date" value={formatPrescriptionDate(medication.endDate)} />
      </dl>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[8.5px] uppercase tracking-[0.08em] text-[#9AA9B8]">{label}</dt>
      <dd className="mt-[1px] text-[10px] font-semibold leading-snug text-[#0F2D4A]">{value}</dd>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="text-[9.5px] text-[#7187A6]">{label}</dt>
      <dd
        className={cn(
          "max-w-[62%] text-right text-[10px] font-semibold leading-snug text-[#0F2D4A]",
          mono && "font-mono text-[9.5px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

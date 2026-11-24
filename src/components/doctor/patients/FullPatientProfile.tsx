"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Download,
  Droplets,
  FileText,
  FlaskConical,
  Heart,
  HeartPulse,
  MapPin,
  MoreVertical,
  Phone,
  Pill,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/patient/ui";
import { DoctorCard } from "@/components/doctor/overview/OverviewSections";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { formatPortalDate } from "@/lib/mock/doctorPortal";
import {
  getPatientRecord,
  type PatientDocument,
  type PatientLab,
  type PatientRecord,
} from "@/lib/mock/doctorPatients";
import { StartConsultationDialog } from "./StartConsultationDialog";
import { cn } from "@/lib/cn";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Medical History" },
  { key: "visits", label: "Visits" },
  { key: "labs", label: "Lab Results" },
  { key: "medications", label: "Medications" },
  { key: "documents", label: "Documents" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const LAB_TONE: Record<PatientLab["status"], string> = {
  Normal: "bg-[#E7FBF8] text-[#0A9189]",
  High: "bg-[#FFF6E5] text-[#C77A0A]",
  Low: "bg-[#EFF4FF] text-[#3B6EF6]",
};

const DOC_ICON: Record<PatientDocument["type"], LucideIcon> = {
  "Lab report": FlaskConical,
  Imaging: HeartPulse,
  Referral: ChevronRight,
  Consent: FileText,
  "Visit summary": FileText,
};

export function FullPatientProfile({
  patientId,
  initialTab = "overview",
}: {
  patientId: string;
  initialTab?: TabKey;
}) {
  const router = useRouter();
  const record = getPatientRecord(patientId);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [consultOpen, setConsultOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!record) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => router.push("/doctor/patients")}
          className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:text-[#0A9189]"
        >
          <ArrowLeft size={13} aria-hidden />
          Back to Patients
        </button>
        <DoctorCard className="p-8 text-center">
          <p className="text-[12px] font-semibold text-[#0F2D4A]">Patient not found</p>
          <p className="mt-1 text-[10.5px] text-[#7A8CA0]">
            This record is not part of your accessible patient list.
          </p>
        </DoctorCard>
      </div>
    );
  }

  const { patient } = record;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => router.push("/doctor/patients")}
        className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:text-[#0A9189]"
      >
        <ArrowLeft size={13} aria-hidden />
        Back to Patients
      </button>

      {/* Identity header */}
      <RevealOnScroll y={12}>
        <DoctorCard className="overflow-visible p-3.5 sm:p-4">
          <div className="flex flex-wrap items-start gap-3">
            <Avatar name={patient.name} size={58} />
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-bold tracking-[-0.01em] text-[#0F2D4A] sm:text-[19px]">
                {patient.name}
              </h1>
              <p className="mt-0.5 text-[10.5px] text-[#7187A6]">
                MRN: {patient.mrn} · {patient.age} years · {patient.gender}
              </p>

              <ul className="mt-2 flex flex-wrap items-center gap-1.5">
                {record.primaryCondition ? (
                  <Badge tone="bg-[#FFF1F3] text-[#C0353B]" icon={Heart}>
                    {record.primaryCondition}
                  </Badge>
                ) : null}
                {record.medications[0] ? (
                  <Badge tone="bg-[#EFF4FF] text-[#3B6EF6]" icon={Pill}>
                    {`${record.medications[0].name} ${record.medications[0].dose} ${record.medications[0].frequency}`.trim()}
                  </Badge>
                ) : null}
                {patient.allergies.length > 0 ? (
                  <Badge tone="bg-[#FFF1F3] text-[#C0353B]" icon={AlertTriangle}>
                    {patient.allergies.join(", ")}
                  </Badge>
                ) : null}
              </ul>
            </div>

            <div className="flex w-full items-center gap-1.5 sm:w-auto">
              <button
                type="button"
                onClick={() => setConsultOpen(true)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-[#0A9189] px-4 text-[11px] font-semibold text-white shadow-[0_12px_24px_-16px_rgba(10,145,137,0.9)] transition hover:bg-[#087F78] sm:flex-none"
              >
                <Stethoscope size={13} aria-hidden />
                Start Consultation
              </button>
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  aria-label="More patient actions"
                  aria-expanded={menuOpen}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[#E6EFEE] text-[#5B6B7C] transition hover:bg-[#F8FCFB] hover:text-[#0F2D4A]"
                >
                  <MoreVertical size={15} />
                </button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+6px)] z-30 w-[180px] overflow-hidden rounded-xl border border-[#E6EFEE] bg-white p-1 shadow-[0_20px_44px_-24px_rgba(15,45,74,0.45)]"
                  >
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        setTab("labs");
                      }}
                      icon={FlaskConical}
                      label="Review lab results"
                    />
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        setTab("documents");
                      }}
                      icon={FileText}
                      label="Open documents"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Patient record sections"
            className="mt-3 flex gap-1 overflow-x-auto rounded-full bg-[#F5FAFA] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[10.5px] font-semibold transition-colors duration-150",
                  tab === item.key
                    ? "bg-[#0A9189] text-white shadow-[0_8px_18px_-12px_rgba(10,145,137,0.9)]"
                    : "text-[#5B6B7C] hover:bg-white hover:text-[#0F2D4A]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </DoctorCard>
      </RevealOnScroll>

      <div key={tab} className="page-enter">
        {tab === "overview" ? <OverviewTab record={record} onOpenTab={setTab} /> : null}
        {tab === "history" ? <HistoryTab record={record} /> : null}
        {tab === "visits" ? <VisitsTab record={record} /> : null}
        {tab === "labs" ? <LabsTab record={record} /> : null}
        {tab === "medications" ? <MedicationsTab record={record} /> : null}
        {tab === "documents" ? <DocumentsTab record={record} /> : null}
      </div>

      <p className="text-[9px] leading-relaxed text-[#9AA9B8]">
        Demo record: clinical data comes from typed fixtures shared with the Overview and My Schedule
        modules. Nothing here is read from or written to PostgreSQL.
      </p>

      <StartConsultationDialog
        record={consultOpen ? record : null}
        onClose={() => setConsultOpen(false)}
        onOpenSchedule={() => {
          setConsultOpen(false);
          router.push("/doctor/appointments");
        }}
        onConfirm={() => {
          setConsultOpen(false);
          router.push("/doctor/patients");
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function OverviewTab({
  record,
  onOpenTab,
}: {
  record: PatientRecord;
  onOpenTab: (tab: TabKey) => void;
}) {
  const { patient } = record;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <DoctorCard className="p-3.5">
        <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Patient Information</h2>
        <ul className="mt-2.5 space-y-2">
          <InfoRow icon={CalendarDays} label="Date of Birth" value={`${formatPortalDate(record.dateOfBirth)} (${patient.age} years)`} />
          <InfoRow icon={Users} label="Gender" value={patient.gender} />
          <InfoRow icon={Phone} label="Phone" value={patient.phone} />
          <InfoRow icon={MapPin} label="Address" value={record.address} />
          <InfoRow icon={UserRound} label="Email" value={patient.email} />
        </ul>
      </DoctorCard>

      <DoctorCard className="p-3.5">
        <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Clinical Summary</h2>
        <ul className="mt-2.5 space-y-2">
          <InfoRow icon={HeartPulse} label="Primary Condition" value={record.primaryCondition ?? "Not recorded"} />
          <InfoRow
            icon={Heart}
            label="Other Conditions"
            value={patient.conditions.slice(1).join(", ") || "—"}
          />
          <InfoRow
            icon={AlertTriangle}
            label="Allergies"
            value={patient.allergies.join(", ") || "None recorded"}
            tone={patient.allergies.length > 0 ? "text-[#C0353B]" : undefined}
          />
          <InfoRow
            icon={Pill}
            label="Current Medications"
            value={patient.medications.join(", ") || "None recorded"}
          />
        </ul>
      </DoctorCard>

      <DoctorCard className="p-3.5">
        <SectionHeader title="Recent Visits" action="View All" onAction={() => onOpenTab("visits")} />
        <ul className="mt-2.5 space-y-2.5">
          {record.visits.length === 0 ? (
            <li className="text-[10.5px] text-[#9AA9B8]">No visits recorded.</li>
          ) : (
            record.visits.slice(0, 2).map((visit) => (
              <li key={visit.id} className="flex items-start gap-2">
                <CalendarDays size={12} aria-hidden className="mt-[3px] shrink-0 text-[#9AA9B8]" />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-medium text-[#0F2D4A]">
                    {formatPortalDate(visit.date)} · {visit.title}
                  </p>
                  {visit.note ? (
                    <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-relaxed text-[#7A8CA0]">
                      {visit.note}
                    </p>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </DoctorCard>

      <DoctorCard className="p-3.5">
        <SectionHeader
          title="Recent Lab Results"
          action="View All"
          onAction={() => onOpenTab("labs")}
        />
        <ul className="mt-2.5 space-y-2">
          {record.labs.length === 0 ? (
            <li className="text-[10.5px] text-[#9AA9B8]">No lab results recorded.</li>
          ) : (
            record.labs.slice(0, 3).map((lab) => (
              <li key={lab.id} className="flex items-center gap-2">
                <FlaskConical size={12} aria-hidden className="shrink-0 text-[#9AA9B8]" />
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-[#0F2D4A]">
                  {lab.name} · {formatPortalDate(lab.date)}
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-[2px] text-[8.5px] font-semibold", LAB_TONE[lab.status])}>
                  {lab.status}
                </span>
              </li>
            ))
          )}
        </ul>
      </DoctorCard>
    </div>
  );
}

function HistoryTab({ record }: { record: PatientRecord }) {
  const { patient } = record;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <DoctorCard className="p-3.5">
        <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Known Allergies</h2>
        {patient.allergies.length === 0 ? (
          <NotRecorded text="No allergy information has been recorded for this patient." />
        ) : (
          <ul className="mt-2.5 space-y-1.5">
            {patient.allergies.map((allergy) => (
              <li
                key={allergy}
                className="flex items-center gap-2 rounded-xl bg-[#FFF1F3] px-2.5 py-2 text-[10.5px] font-medium text-[#C0353B]"
              >
                <AlertTriangle size={12} aria-hidden />
                {allergy}
              </li>
            ))}
          </ul>
        )}
      </DoctorCard>

      <DoctorCard className="p-3.5">
        <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Chronic Conditions</h2>
        {patient.conditions.length === 0 ? (
          <NotRecorded text="No chronic condition has been recorded for this patient." />
        ) : (
          <ul className="mt-2.5 space-y-1.5">
            {patient.conditions.map((condition) => (
              <li
                key={condition}
                className="flex items-center gap-2 rounded-xl bg-[#FFF8EC] px-2.5 py-2 text-[10.5px] font-medium text-[#A9740A]"
              >
                <HeartPulse size={12} aria-hidden />
                {condition}
              </li>
            ))}
          </ul>
        )}
      </DoctorCard>

      <DoctorCard className="p-3.5 lg:col-span-2">
        <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Past Diagnoses</h2>
        {record.visits.length === 0 ? (
          <NotRecorded text="No past diagnoses recorded in this portal." />
        ) : (
          <ul className="mt-2 divide-y divide-[#F2F7F7]">
            {record.visits.map((visit) => (
              <li key={visit.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-[92px] shrink-0 text-[10px] text-[#7A8CA0]">
                  {formatPortalDate(visit.date)}
                </span>
                <span className="min-w-0 flex-1 text-[10.5px] font-medium text-[#0F2D4A]">
                  {visit.title}
                </span>
                <span className="shrink-0 text-[9.5px] text-[#9AA9B8]">{visit.doctor}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[9px] leading-relaxed text-[#9AA9B8]">
          Medical history is read-only in this phase. Recording new history belongs to the
          Consultation Workspace.
        </p>
      </DoctorCard>
    </div>
  );
}

function VisitsTab({ record }: { record: PatientRecord }) {
  return (
    <DoctorCard className="p-3.5">
      <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Visit History</h2>
      {record.visits.length === 0 ? (
        <NotRecorded text="No visits recorded for this patient." />
      ) : (
        <ul className="mt-2.5 space-y-2">
          {record.visits.map((visit) => (
            <li key={visit.id} className="rounded-xl border border-[#EDF3F3] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10.5px] font-semibold text-[#0F2D4A]">
                  {formatPortalDate(visit.date)}
                </span>
                <span className="text-[10.5px] text-[#33475B]">· {visit.title}</span>
                <span className="ml-auto rounded-full bg-[#E7FBF8] px-2 py-[2px] text-[8.5px] font-semibold text-[#0A9189]">
                  {visit.status}
                </span>
              </div>
              <p className="mt-1 text-[9.5px] text-[#8A9AAA]">
                {visit.doctor} · {visit.location}
              </p>
              {visit.note ? (
                <p className="mt-1.5 text-[10px] leading-relaxed text-[#4A5C6E]">{visit.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DoctorCard>
  );
}

function LabsTab({ record }: { record: PatientRecord }) {
  return (
    <DoctorCard className="p-3.5">
      <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Lab Results</h2>
      {record.labs.length === 0 ? (
        <NotRecorded text="No laboratory results have been recorded for this patient." />
      ) : (
        <div className="mt-2.5 overflow-x-auto pr-1.5">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#EDF3F3] text-[9px] font-semibold uppercase tracking-[0.04em] text-[#5B6B7C]">
                <th className="py-2 pr-2 font-semibold">Test</th>
                <th className="py-2 pr-2 font-semibold">Date</th>
                <th className="py-2 pr-2 font-semibold">Result</th>
                <th className="py-2 pr-2 font-semibold">Reference</th>
                <th className="py-2 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {record.labs.map((lab) => (
                <tr key={lab.id} className="border-b border-[#F5F9F9] text-[10.5px] text-[#33475B]">
                  <td className="py-2.5 pr-2 font-medium text-[#0F2D4A]">{lab.name}</td>
                  <td className="py-2.5 pr-2">{formatPortalDate(lab.date)}</td>
                  <td className="py-2.5 pr-2">{lab.value ?? "—"}</td>
                  <td className="py-2.5 pr-2 text-[#8A9AAA]">{lab.reference ?? "—"}</td>
                  <td className="py-2.5 text-right">
                    <span className={cn("rounded-full px-2 py-[2px] text-[8.5px] font-semibold", LAB_TONE[lab.status])}>
                      {lab.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[9px] leading-relaxed text-[#9AA9B8]">
        Values are shown as recorded. Flagged results are not a diagnosis.
      </p>
    </DoctorCard>
  );
}

function MedicationsTab({ record }: { record: PatientRecord }) {
  return (
    <DoctorCard className="p-3.5">
      <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Medications</h2>
      {record.medications.length === 0 ? (
        <NotRecorded text="No medication has been recorded for this patient." />
      ) : (
        <ul className="mt-2.5 divide-y divide-[#F2F7F7]">
          {record.medications.map((medication) => (
            <li key={medication.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#E7FBF8] text-[#0A9189]">
                <Pill size={13} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-[#0F2D4A]">
                  {medication.name}
                </span>
                <span className="block text-[9.5px] text-[#8A9AAA]">
                  {medication.dose} · {medication.frequency} · since{" "}
                  {formatPortalDate(medication.started)}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-[#E7FBF8] px-2 py-[2px] text-[8.5px] font-semibold text-[#0A9189]">
                {medication.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[9px] leading-relaxed text-[#9AA9B8]">
        Read-only list. Prescribing belongs to the Consultation Workspace and the Prescriptions
        module.
      </p>
    </DoctorCard>
  );
}

function DocumentsTab({ record }: { record: PatientRecord }) {
  return (
    <DoctorCard className="p-3.5">
      <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Documents</h2>
      {record.documents.length === 0 ? (
        <NotRecorded text="No documents have been attached to this patient record." />
      ) : (
        <ul className="mt-2.5 divide-y divide-[#F2F7F7]">
          {record.documents.map((document) => {
            const Icon = DOC_ICON[document.type] ?? FileText;
            return (
              <li key={document.id} className="flex items-center gap-2.5 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F1F7F6] text-[#0A9189]">
                  <Icon size={14} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-[#0F2D4A]">
                    {document.title}
                  </span>
                  <span className="block text-[9.5px] text-[#8A9AAA]">
                    {document.type} · {formatPortalDate(document.date)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled
                  title="File storage is not connected in this phase"
                  className="inline-flex h-7 shrink-0 cursor-not-allowed items-center gap-1 rounded-full border border-[#E6EFEE] px-2.5 text-[9.5px] font-semibold text-[#A8B6C4]"
                >
                  <Download size={11} aria-hidden />
                  Download
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[9px] leading-relaxed text-[#9AA9B8]">
        Document storage is not connected in this phase, so downloads are disabled. No files are
        fabricated.
      </p>
    </DoctorCard>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Badge({
  children,
  tone,
  icon: Icon,
}: {
  children: React.ReactNode;
  tone: string;
  icon: LucideIcon;
}) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[9.5px] font-semibold",
        tone,
      )}
    >
      <Icon size={11} aria-hidden />
      {children}
    </li>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon size={12} aria-hidden className="mt-[2px] shrink-0 text-[#9AA9B8]" />
      <span className="w-[110px] shrink-0 text-[10px] text-[#7A8CA0]">{label}</span>
      <span className={cn("min-w-0 flex-1 text-[10.5px] font-medium text-[#0F2D4A]", tone)}>
        {value}
      </span>
    </li>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">{title}</h2>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="text-[9.5px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

function NotRecorded({ text }: { text: string }) {
  return (
    <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-[#F7FCFB] px-3 py-2.5">
      <Droplets size={12} aria-hidden className="mt-[1px] shrink-0 text-[#9AA9B8]" />
      <p className="text-[10px] leading-relaxed text-[#8A9AAA]">{text}</p>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10.5px] text-[#33475B] transition hover:bg-[#F5FAFA]"
    >
      <Icon size={12} aria-hidden className="text-[#0A9189]" />
      {label}
    </button>
  );
}

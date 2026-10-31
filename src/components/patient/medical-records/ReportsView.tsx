"use client";

import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Hospital,
  Stethoscope,
  UserRound,
} from "lucide-react";
import {
  formatRecordDate,
  getMedicalDoctor,
  getVisit,
  type MedicalReport,
} from "@/lib/mock/medicalRecords";
import { RecordStatusBadge } from "./badges";
import { InfoNote, SectionCard, demoExport, downloadTextFile } from "./ui";

export function ReportsList({
  reports,
  onView,
  onOpenVisit,
  onDownload,
}: {
  reports: MedicalReport[];
  onView: (id: string) => void;
  onOpenVisit: (id: string) => void;
  onDownload: (report: MedicalReport) => void;
}) {
  return (
    <SectionCard className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[#EEF4F4] px-3.5 py-3">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0F2D4A]">
            Report Library
          </h2>
          <p className="mt-0.5 text-[9.5px] text-[#8A99A8]">
            {reports.length} report(s) available to view and download.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#E7FBF8] px-2.5 py-1 text-[9px] font-semibold text-[#0A9189]">
          {reports.length} approved
        </span>
      </div>

      <ul className="divide-y divide-[#F0F5F5]">
        {reports.map((report) => {
          const doctor = getMedicalDoctor(report.doctorId);
          const visit = getVisit(report.relatedVisitId);
          return (
            <li key={report.id} className="px-3.5 py-3 transition hover:bg-[#FBFDFD]">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EFF4FF] text-[#2563EB]"
                >
                  <ClipboardList size={18} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-[12px] font-semibold text-[#0F2D4A]">
                      {report.title}
                    </h3>
                    <RecordStatusBadge status={report.status} />
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#5B6B7C]">
                    {report.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] text-[#8A99A8]">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={10} aria-hidden />
                      {formatRecordDate(report.date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound size={10} aria-hidden />
                      {doctor?.name ?? "Medora care team"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Stethoscope size={10} aria-hidden />
                      {report.specialty}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Hospital size={10} aria-hidden />
                      {report.facility}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onView(report.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#BFE8E2] bg-white px-2.5 text-[10px] font-semibold text-[#0A9189] transition hover:bg-[#F0FCFA]"
                  >
                    <Eye size={12} aria-hidden />
                    View Report
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownload(report)}
                    aria-label={`Download ${report.title}`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-[#E6EFEE] text-[#7187A6] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
                  >
                    <Download size={13} aria-hidden />
                  </button>
                  {visit ? (
                    <button
                      type="button"
                      onClick={() => onOpenVisit(visit.id)}
                      className="h-8 rounded-lg border border-[#E6EFEE] px-2.5 text-[9.5px] font-semibold text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
                    >
                      Related visit
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-[#EEF4F4] px-3.5 py-2 text-[8.5px] leading-relaxed text-[#9AA9B8]">
        Reports are clinician-authored and read-only. Patients can view and download
        approved reports but cannot edit them.
      </p>
    </SectionCard>
  );
}

export function ReportDetail({
  report,
  onBack,
  onOpenVisit,
  onToast,
  backLabel = "Back to Medical Reports",
}: {
  report: MedicalReport;
  onBack: () => void;
  onOpenVisit: (id: string) => void;
  onToast: (message: string) => void;
  backLabel?: string;
}) {
  const doctor = getMedicalDoctor(report.doctorId);
  const visit = getVisit(report.relatedVisitId);

  const download = () => {
    downloadTextFile(
      `${report.title.replace(/\s+/g, "-").toLowerCase()}-demo.txt`,
      demoExport(report.title, [
        `Date: ${formatRecordDate(report.date)}`,
        `Doctor: ${doctor?.name ?? "Medora care team"}`,
        `Specialty: ${report.specialty}`,
        `Facility: ${report.facility}`,
        `Status: ${report.status}`,
        "",
        ...report.sections.flatMap((section) => [
          section.heading.toUpperCase(),
          section.body,
          "",
        ]),
      ]),
    );
    onToast("Report downloaded as a demo text file.");
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:text-[#0A9189]"
      >
        <ArrowLeft size={13} aria-hidden />
        {backLabel}
      </button>

      <SectionCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#EFF4FF] text-[#2563EB]"
          >
            <ClipboardList size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[19px] font-bold leading-tight tracking-[-0.015em] text-[#0F2D4A]">
                {report.title}
              </h2>
              <RecordStatusBadge status={report.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[9.5px] text-[#5B6B7C]">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={11} className="text-[#9AA9B8]" aria-hidden />
                {formatRecordDate(report.date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <UserRound size={11} className="text-[#9AA9B8]" aria-hidden />
                {doctor?.name ?? "Medora care team"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Stethoscope size={11} className="text-[#9AA9B8]" aria-hidden />
                {report.specialty}
              </span>
              <span className="inline-flex items-center gap-1">
                <Hospital size={11} className="text-[#9AA9B8]" aria-hidden />
                {report.facility}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {visit ? (
              <button
                type="button"
                onClick={() => onOpenVisit(visit.id)}
                className="h-8 rounded-lg border border-[#E6EFEE] px-2.5 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
              >
                Related Visit
              </button>
            ) : null}
            <button
              type="button"
              onClick={download}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A9189] px-2.5 text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
            >
              <Download size={12} aria-hidden />
              Download
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] px-3.5 py-3">
          <p className="text-[10.5px] leading-relaxed text-[#5B6B7C]">
            {report.description}
          </p>
        </div>

        <article className="mt-3 space-y-3">
          {report.sections.map((section) => (
            <section key={section.heading}>
              <div className="flex items-center gap-1.5">
                <FileText size={12} className="text-[#0A9189]" aria-hidden />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#33475B]">
                  {section.heading}
                </h3>
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-[#5B6B7C]">
                {section.body}
              </p>
            </section>
          ))}
        </article>

        <div className="mt-3.5 flex flex-col gap-2 border-t border-[#EEF4F4] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[8.5px] text-[#9AA9B8]">
            Approved by {doctor?.name ?? "your care team"} · Read-only document
          </p>
          <button
            type="button"
            onClick={onBack}
            className="h-8 shrink-0 rounded-lg border border-[#E6EFEE] px-3 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#CFE9E5] hover:text-[#0F2D4A]"
          >
            {backLabel}
          </button>
        </div>
      </SectionCard>

      <InfoNote>
        This report was prepared and approved by your doctor. If something looks
        incorrect, contact your care team — patients cannot edit clinical reports.
      </InfoNote>
    </div>
  );
}

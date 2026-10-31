"use client";

import {
  CalendarDays,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Hospital,
  Image as ImageIcon,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  formatRecordDate,
  getImagingResult,
  getLabResult,
  getMedicalDoctor,
  getMedicalReport,
  getPrescription,
  getVisit,
  type MedicalDocument,
  type MedicalFile,
  type MedicalRecordEntry,
  type MedicalReport,
} from "@/lib/mock/medicalRecords";
import { RecordStatusBadge } from "./badges";
import { VisitView } from "./VisitView";
import { PrescriptionView } from "./PrescriptionView";
import { LabResultView } from "./LabResultView";
import { ImagingView } from "./ImagingView";
import { DetailField, EmptyState, SectionCard } from "./ui";

export type RecordPreviewHandlers = {
  onOpenFull: (entry: MedicalRecordEntry) => void;
  onOpenVisit: (id: string) => void;
  onOpenPrescription: (id: string) => void;
  onOpenLab: (id: string) => void;
  onOpenImaging: (id: string) => void;
  onViewReport: (id: string) => void;
  onPreviewDocument: (document: MedicalDocument) => void;
  onDownloadDocument: (document: MedicalDocument) => void;
  onDownloadReport: (report: MedicalReport) => void;
  onOpenFile: (file: MedicalFile) => void;
  onBookFollowUp: (doctorId: string) => void;
  onToast: (message: string) => void;
};

/**
 * Right-hand preview for the Medical Records overview.
 *
 * Each category reuses its full-screen detail component in a compact variant so
 * the same clinician-authored content is shown in both places.
 */
export function RecordPreview({
  entry,
  documents,
  handlers,
}: {
  entry: MedicalRecordEntry | null;
  documents: MedicalDocument[];
  handlers: RecordPreviewHandlers;
}) {
  if (!entry) {
    return (
      <SectionCard className="flex min-h-[300px] items-center justify-center">
        <EmptyState
          icon={FileText}
          title="Select a record"
          description="Choose a record from the list to preview its details here."
        />
      </SectionCard>
    );
  }

  const openFull = (
    <button
      type="button"
      onClick={() => handlers.onOpenFull(entry)}
      className="h-8 w-full rounded-lg bg-[#0A9189] text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
    >
      Open Full Record
    </button>
  );

  switch (entry.type) {
    case "visit": {
      const visit = getVisit(entry.id);
      if (!visit) return <MissingRecord onOpenFull={openFull} />;
      return (
        <div className="space-y-2">
          <VisitView
            visit={visit}
            compact
            onOpenPrescription={handlers.onOpenPrescription}
            onOpenLab={handlers.onOpenLab}
            onOpenFile={handlers.onOpenFile}
            onViewReport={handlers.onViewReport}
            onBookFollowUp={handlers.onBookFollowUp}
            onToast={handlers.onToast}
          />
          {openFull}
        </div>
      );
    }

    case "prescription": {
      const prescription = getPrescription(entry.id);
      if (!prescription) return <MissingRecord onOpenFull={openFull} />;
      return (
        <div className="space-y-2">
          <PrescriptionView
            prescription={prescription}
            compact
            onOpenVisit={handlers.onOpenVisit}
            onOpenFull={() => handlers.onOpenFull(entry)}
            onToast={handlers.onToast}
          />
        </div>
      );
    }

    case "lab": {
      const lab = getLabResult(entry.id);
      if (!lab) return <MissingRecord onOpenFull={openFull} />;
      return (
        <div className="space-y-2">
          <LabResultView
            lab={lab}
            compact
            onOpenVisit={handlers.onOpenVisit}
            onOpenFull={() => handlers.onOpenFull(entry)}
            onToast={handlers.onToast}
          />
        </div>
      );
    }

    case "imaging": {
      const imaging = getImagingResult(entry.id);
      if (!imaging) return <MissingRecord onOpenFull={openFull} />;
      return (
        <div className="space-y-2">
          <ImagingView
            imaging={imaging}
            compact
            onOpenVisit={handlers.onOpenVisit}
            onOpenFull={() => handlers.onOpenFull(entry)}
            onToast={handlers.onToast}
          />
        </div>
      );
    }

    case "document": {
      const document = documents.find((item) => item.id === entry.id);
      if (!document) return <MissingRecord onOpenFull={openFull} />;
      return (
        <DocumentPreview
          document={document}
          onPreview={() => handlers.onPreviewDocument(document)}
          onDownload={() => handlers.onDownloadDocument(document)}
          onOpenFull={openFull}
        />
      );
    }

    case "report": {
      const report = getMedicalReport(entry.id);
      if (!report) return <MissingRecord onOpenFull={openFull} />;
      return (
        <ReportPreview
          report={report}
          onView={() => handlers.onViewReport(report.id)}
          onDownload={() => handlers.onDownloadReport(report)}
          onOpenFull={openFull}
        />
      );
    }

    default:
      return <MissingRecord onOpenFull={openFull} />;
  }
}

/* ------------------------------------------------------------------ */
/* Document preview                                                    */
/* ------------------------------------------------------------------ */

function DocumentPreview({
  document,
  onPreview,
  onDownload,
  onOpenFull,
}: {
  document: MedicalDocument;
  onPreview: () => void;
  onDownload: () => void;
  onOpenFull: React.ReactNode;
}) {
  const isImage = ["JPG", "JPEG", "PNG", "WEBP"].includes(document.fileType);

  return (
    <SectionCard className="p-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span
          aria-hidden
          className={
            isImage
              ? "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#EFF4FF] text-[#2563EB]"
              : "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#FFE9EE] text-[#E5486B]"
          }
        >
          {isImage ? <ImageIcon size={22} /> : <FileText size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold leading-tight text-[#0F2D4A]">
              {document.name}
            </h2>
            <RecordStatusBadge status={document.status} />
          </div>
          <p className="mt-1 text-[9.5px] text-[#5B6B7C]">
            {document.category} · {document.fileType} · {document.size}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#8A99A8]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={10} aria-hidden />
              {formatRecordDate(document.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={10} aria-hidden />
              {document.source === "patient" ? "Uploaded by you" : "Shared by your care team"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 divide-y divide-[#F0F5F5] rounded-xl border border-[#E6EFEE] px-3">
        <DetailField label="Category" value={document.category} />
        <DetailField label="File type" value={document.fileType} />
        <DetailField label="Size" value={document.size} />
        <DetailField label="Date" value={formatRecordDate(document.date)} />
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E6EFEE] text-[10px] font-semibold text-[#33475B] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
        >
          <Eye size={12} aria-hidden />
          Preview
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E6EFEE] text-[10px] font-semibold text-[#33475B] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
        >
          <Download size={12} aria-hidden />
          Download
        </button>
      </div>
      <div className="mt-2">{onOpenFull}</div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Report preview                                                      */
/* ------------------------------------------------------------------ */

function ReportPreview({
  report,
  onView,
  onDownload,
  onOpenFull,
}: {
  report: MedicalReport;
  onView: () => void;
  onDownload: () => void;
  onOpenFull: React.ReactNode;
}) {
  const doctor = getMedicalDoctor(report.doctorId);
  const visit = getVisit(report.relatedVisitId);

  return (
    <SectionCard className="p-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#EFF4FF] text-[#2563EB]"
        >
          <ClipboardList size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold leading-tight text-[#0F2D4A]">
              {report.title}
            </h2>
            <RecordStatusBadge status={report.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#8A99A8]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={10} aria-hidden />
              {formatRecordDate(report.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound size={10} aria-hidden />
              {doctor?.name ?? "Medora care team"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hospital size={10} aria-hidden />
              {report.facility}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2.5 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3 text-[10px] leading-relaxed text-[#5B6B7C]">
        {report.description}
      </p>

      <div className="mt-2.5 space-y-2">
        {report.sections.slice(0, 2).map((section) => (
          <div key={section.heading}>
            <h3 className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#8A99A8]">
              {section.heading}
            </h3>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#5B6B7C]">
              {section.body}
            </p>
          </div>
        ))}
      </div>

      {visit ? (
        <p className="mt-2 text-[8.5px] text-[#9AA9B8]">
          Related visit: {visit.title} · {formatRecordDate(visit.date)}
        </p>
      ) : null}

      <div className="mt-2.5 flex gap-1.5">
        <button
          type="button"
          onClick={onView}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0A9189] text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
        >
          <Eye size={12} aria-hidden />
          View Report
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E6EFEE] text-[10px] font-semibold text-[#33475B] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
        >
          <Download size={12} aria-hidden />
          Download
        </button>
      </div>
      <div className="mt-2">{onOpenFull}</div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function MissingRecord({ onOpenFull }: { onOpenFull: React.ReactNode }) {
  return (
    <SectionCard className="p-3.5">
      <EmptyState
        icon={FileText}
        title="Record unavailable"
        description="This record could not be found. It may have been removed or you may not have access to it."
      />
      {onOpenFull}
    </SectionCard>
  );
}

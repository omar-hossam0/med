"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, FileText, X } from "lucide-react";
import { demoExport, downloadTextFile } from "@/components/patient/medical-records/ui";
import {
  formatLabDate,
  getLabDoctor,
  type LabResult,
  type MedicalFile,
} from "@/lib/mock/labResults";

/** Shared by the Report tab and the detail header button. */
export function downloadLabReport(lab: LabResult, file: MedicalFile) {
  downloadTextFile(`${file.name.replace(/\.pdf$/i, "")}-copy.txt`, buildReportText(lab, file));
}

/**
 * Report tab.
 *
 * The fixture set contains one clinician-uploaded lab report (CBC). Its file
 * metadata is real; the PDF bytes are not part of the repository. So the tab
 * shows the document card and offers two distinct, honest actions:
 *
 *   View Report      — renders the report content in-app
 *   Download Report  — downloads a plain-text rendering, clearly labelled
 *
 * Neither claims to deliver the original PDF, and a result with no attached
 * document shows the empty state instead.
 */
export function LabReportPanel({ lab, file }: { lab: LabResult; file?: MedicalFile }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
          <FileText size={22} aria-hidden />
        </span>
        <h3 className="mt-3 text-[13px] font-semibold text-[#0F2D4A]">
          No report file is available for this test yet
        </h3>
        <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-[#7187A6]">
          The laboratory has not attached a document to this result. Your values above are the
          recorded result.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center rounded-xl border border-[#EDF3F3] bg-white px-4 py-6 text-center">
        <span className="grid h-12 w-11 place-items-center rounded-lg border border-[#FFE0E6] bg-[#FFF4F6] text-[#E5486B]">
          <FileText size={20} aria-hidden />
        </span>

        <p className="mt-2.5 text-[11.5px] font-semibold text-[#0F2D4A]">{file.name}</p>
        <p className="mt-0.5 text-[9.5px] text-[#7187A6]">
          {file.size} · {formatLabDate(file.date)}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => downloadLabReport(lab, file)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A9189] px-3.5 py-2 text-[10.5px] font-semibold text-white shadow-[0_10px_24px_-16px_rgba(10,145,137,0.9)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#088078] active:translate-y-[1px]"
          >
            <Download size={13} aria-hidden />
            Download Report
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#0A9189] bg-white px-3.5 py-2 text-[10.5px] font-semibold text-[#0A9189] transition-[background-color,border-color] duration-150 hover:bg-[#E7FBF8]"
          >
            <Eye size={13} aria-hidden />
            View Report
          </button>
        </div>

        <p className="mt-3 max-w-sm text-[9px] leading-relaxed text-[#9AA9B8]">
          Download saves a text copy of this report. The original PDF is not attached to this demo
          dataset.
        </p>
      </div>

      {previewOpen ? <ReportPreview lab={lab} file={file} onClose={() => setPreviewOpen(false)} /> : null}
    </>
  );
}

function buildReportText(lab: LabResult, file: MedicalFile): string {
  const doctor = getLabDoctor(lab);
  return demoExport(`${lab.name} — Laboratory Report`, [
    `Document: ${file.name}`,
    `Report date: ${formatLabDate(lab.date)}`,
    `Laboratory: ${lab.facility}`,
    `Ordering doctor: ${doctor?.name ?? "Medora care team"}`,
    `Specimen: ${lab.specimen}`,
    `Method: ${lab.method}`,
    `Collected: ${lab.collectedAt}`,
    `Reported: ${lab.reportedAt}`,
    "",
    "Results",
    ...lab.results.map(
      (row) => `- ${row.name}: ${row.value} ${row.unit} (ref ${row.referenceRange}) — ${row.status}`,
    ),
    "",
    `Overall status: ${lab.status}`,
    lab.notes ? `Note: ${lab.notes}` : "",
  ]);
}

function ReportPreview({
  lab,
  file,
  onClose,
}: {
  lab: LabResult;
  file: MedicalFile;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close report preview"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#0F2D4A]/35"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-report-title"
        className="relative flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_80px_-40px_rgba(15,45,74,0.6)] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#EDF3F3] px-4 py-3">
          <div className="min-w-0">
            <h2 id="lab-report-title" className="text-[12.5px] font-semibold text-[#0F2D4A]">
              {file.name}
            </h2>
            <p className="mt-0.5 text-[9.5px] text-[#7187A6]">
              {lab.facility} · {formatLabDate(lab.date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#5B6B7C] transition-colors duration-150 hover:bg-[#F1F6F6] hover:text-[#0F2D4A]"
          >
            <X size={15} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#F7FAFA] px-4 py-4">
          <div className="mx-auto max-w-[440px] rounded-xl border border-[#E6EFEE] bg-white p-4 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#9AA9B8]">Medora Laboratory</p>
            <h3 className="mt-1 text-[13px] font-bold text-[#0F2D4A]">{lab.name}</h3>
            <p className="mt-0.5 text-[9.5px] text-[#7187A6]">
              {lab.specimen} · {lab.method}
            </p>

            <table className="mt-3 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EDF3F3]">
                  {["Test Item", "Result", "Reference", "Status"].map((heading) => (
                    <th
                      key={heading}
                      className="pb-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#9AA9B8]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lab.results.map((row) => (
                  <tr key={row.name} className="border-b border-[#F5F9F9] last:border-0">
                    <td className="py-1.5 pr-2 text-[9.5px] font-medium text-[#0F2D4A]">{row.name}</td>
                    <td className="py-1.5 pr-2 text-[9.5px] font-semibold text-[#0F2D4A]">
                      {row.value} <span className="font-normal text-[#7187A6]">{row.unit}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-[9.5px] text-[#7187A6]">{row.referenceRange}</td>
                    <td className="py-1.5 text-[9.5px] font-semibold text-[#0A9189]">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {lab.notes ? (
              <p className="mt-3 rounded-lg bg-[#F3FAFD] p-2 text-[9px] leading-relaxed text-[#4A5C6E]">
                {lab.notes}
              </p>
            ) : null}
          </div>

          <p className="mx-auto mt-3 max-w-[440px] text-center text-[9px] leading-relaxed text-[#9AA9B8]">
            Preview rendered from the recorded result. The original PDF file is not part of this
            demo dataset.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

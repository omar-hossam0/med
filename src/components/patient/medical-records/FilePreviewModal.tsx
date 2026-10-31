"use client";

import { Download, FileText, Image as ImageIcon, ShieldAlert } from "lucide-react";
import type { MedicalFile } from "@/lib/mock/medicalRecords";
import { formatRecordDate } from "@/lib/mock/medicalRecords";
import { ModalShell } from "../appointments/ModalShell";
import { DetailField } from "./ui";

/**
 * Read-only preview for a medical file.
 *
 * Demo fixtures have no real document bytes, so PDFs are rendered as a labelled
 * document preview. Patient-uploaded images use their local object URL.
 */
export function FilePreviewModal({
  file,
  onClose,
  onDownload,
}: {
  file: MedicalFile | null;
  onClose: () => void;
  onDownload: (file: MedicalFile) => void;
}) {
  const isImage = ["JPG", "JPEG", "PNG", "WEBP"].includes(file?.fileType ?? "");
  const hasPreview = Boolean(file?.previewUrl) && isImage;

  return (
    <ModalShell
      open={Boolean(file)}
      onClose={onClose}
      labelledBy="file-preview-title"
      maxWidth="max-w-[560px]"
      closeLabel="Close file preview"
    >
      {file ? (
        <div>
          <div className="flex items-start gap-2.5 pr-8">
            <span
              aria-hidden
              className={
                isImage
                  ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EFF4FF] text-[#2563EB]"
                  : "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFE9EE] text-[#E5486B]"
              }
            >
              {isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
            </span>
            <div className="min-w-0">
              <h2
                id="file-preview-title"
                className="truncate text-[14px] font-bold text-[#0F2D4A]"
              >
                {file.name}
              </h2>
              <p className="mt-0.5 text-[9.5px] text-[#8A99A8]">
                {file.category} • {file.fileType} • {file.size}
              </p>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-[#E6EFEE] bg-[#FBFDFD]">
            {hasPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.previewUrl}
                alt={`Preview of ${file.name}`}
                className="max-h-[320px] w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#9AA9B8] shadow-[0_8px_20px_-16px_rgba(15,45,74,0.4)]">
                  <FileText size={22} aria-hidden />
                </span>
                <p className="mt-2.5 text-[11px] font-semibold text-[#0F2D4A]">
                  Preview not available in this demo
                </p>
                <p className="mt-1 max-w-xs text-[9.5px] leading-relaxed text-[#7187A6]">
                  The original {file.fileType} file is stored by the clinic. Downloading
                  here produces a clearly labelled demo text export instead.
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 divide-y divide-[#F0F5F5] rounded-xl border border-[#E6EFEE] px-3">
            <DetailField label="Category" value={file.category} />
            <DetailField label="Date" value={formatRecordDate(file.date)} />
            <DetailField label="File type" value={file.fileType} />
            <DetailField label="Size" value={file.size} />
          </div>

          <p className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-[#F7E3BD] bg-[#FFFBF3] px-2.5 py-2 text-[9px] leading-relaxed text-[#8A5B12]">
            <ShieldAlert size={12} className="mt-[1px] shrink-0" aria-hidden />
            Demo preview only. No clinical document was retrieved from a server.
          </p>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-lg border border-[#E6EFEE] px-3 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#CFE9E5] hover:text-[#0F2D4A]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onDownload(file)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A9189] px-3 text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
            >
              <Download size={12} aria-hidden />
              Download
            </button>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

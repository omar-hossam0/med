"use client";

import { Download, Eye, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import type { MedicalFile } from "@/lib/mock/medicalRecords";
import { formatRecordDate } from "@/lib/mock/medicalRecords";
import { cn } from "@/lib/cn";

export function FilePreviewItem({
  file,
  onPreview,
  onDownload,
  onDelete,
  className,
}: {
  file: MedicalFile;
  onPreview: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  const isImage = ["JPG", "JPEG", "PNG", "WEBP"].includes(file.fileType);
  const isPdf = file.fileType === "PDF";
  const Icon = isImage ? ImageIcon : FileText;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-[#E6EFEE] bg-white p-2.5 transition hover:border-[#CFE9E5]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          isPdf
            ? "bg-[#FFE9EE] text-[#E5486B]"
            : isImage
              ? "bg-[#EFF4FF] text-[#2563EB]"
              : "bg-[#F1F5F9] text-[#5B6B7C]",
        )}
      >
        <Icon size={16} />
      </span>

      <button
        type="button"
        onClick={onPreview}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-[10.5px] font-semibold text-[#0F2D4A]">
          {file.name}
        </span>
        <span className="mt-0.5 block truncate text-[8.5px] text-[#8A99A8]">
          {file.size} • {formatRecordDate(file.date)} • {file.fileType}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview ${file.name}`}
          className="grid h-7 w-7 place-items-center rounded-lg text-[#7187A6] transition hover:bg-[#F1F7F7] hover:text-[#0A9189]"
        >
          <Eye size={13} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDownload}
          aria-label={`Download ${file.name}`}
          className="grid h-7 w-7 place-items-center rounded-lg text-[#7187A6] transition hover:bg-[#F1F7F7] hover:text-[#0A9189]"
        >
          <Download size={13} aria-hidden />
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${file.name}`}
            className="grid h-7 w-7 place-items-center rounded-lg text-[#A83A4C] transition hover:bg-[#FFF1F3] hover:text-[#E5484D]"
          >
            <Trash2 size={13} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";
import {
  formatRecordDate,
  type DocumentCategory,
  type MedicalDocument,
} from "@/lib/mock/medicalRecords";
import { RecordStatusBadge, SourceBadge } from "./badges";
import {
  RecordListControls,
  SortSelect,
  activeFilterCount,
  type RecordFilters,
  type SortOrder,
} from "./RecordListControls";
import { EmptyState } from "./ui";
import { ModalShell } from "../appointments/ModalShell";
import { cn } from "@/lib/cn";

const CATEGORY_OPTIONS: { value: DocumentCategory | "All"; label: string }[] = [
  { value: "All", label: "All categories" },
  { value: "Medical Report", label: "Medical Report" },
  { value: "Lab Result", label: "Lab Result" },
  { value: "Imaging", label: "Imaging" },
  { value: "Prescription", label: "Prescription" },
  { value: "Other", label: "Other" },
];

const STATUS_OPTIONS = ["Patient Uploaded", "Clinically Reviewed", "Awaiting Review"];

export function DocumentsView({
  documents,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  filterOpen,
  onFilterOpenChange,
  sort,
  onSortChange,
  category,
  onCategoryChange,
  onPreview,
  onDownload,
  onDelete,
  onUpload,
}: {
  documents: MedicalDocument[];
  query: string;
  onQueryChange: (value: string) => void;
  filters: RecordFilters;
  onFiltersChange: (next: RecordFilters) => void;
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  category: DocumentCategory | "All";
  onCategoryChange: (value: DocumentCategory | "All") => void;
  onPreview: (document: MedicalDocument) => void;
  onDownload: (document: MedicalDocument) => void;
  onDelete: (document: MedicalDocument) => void;
  onUpload: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<MedicalDocument | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents
      .filter((document) => category === "All" || document.category === category)
      .filter((document) => filters.status === "all" || document.status === filters.status)
      .filter(
        (document) =>
          !needle ||
          [document.name, document.category, document.fileType, document.status, document.date]
            .join(" ")
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => (sort === "newest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [documents, category, filters.status, query, sort]);

  const filtered = query.trim() !== "" || category !== "All" || activeFilterCount(filters) > 0;

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setBusy(true);
    // Local demo mutation only — no server request is made.
    window.setTimeout(() => {
      onDelete(pendingDelete);
      setBusy(false);
      setPendingDelete(null);
    }, 250);
  };

  return (
    <section className="rounded-2xl border border-[#E6EFEE] bg-white shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EEF4F4] px-3.5 py-3">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0F2D4A]">
            My Documents
          </h2>
          <p className="mt-0.5 text-[9.5px] text-[#8A99A8]">
            {visible.length} of {documents.length} document(s) • Only files shared with
            your account are listed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SortSelect value={sort} onChange={onSortChange} />
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A9189] px-2.5 text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
          >
            <Upload size={12} aria-hidden />
            Upload Document
          </button>
        </div>
      </div>

      <div className="space-y-2.5 px-3.5 pt-2.5">
        <RecordListControls
          query={query}
          onQueryChange={onQueryChange}
          filters={filters}
          onFiltersChange={onFiltersChange}
          panelOpen={filterOpen}
          onPanelOpenChange={onFilterOpenChange}
          statusOptions={STATUS_OPTIONS}
          placeholder="Search documents by name or category..."
        />

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {CATEGORY_OPTIONS.map((option) => {
            const selected = category === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onCategoryChange(option.value)}
                aria-pressed={selected}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[9.5px] font-semibold transition",
                  selected
                    ? "border-[#BFE8E2] bg-[#F0FCFA] text-[#0A9189]"
                    : "border-[#E6EFEE] bg-white text-[#5B6B7C] hover:border-[#CFE9E5] hover:text-[#0F2D4A]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-2.5">
        {visible.length === 0 ? (
          <EmptyState
            icon={filtered ? FolderOpen : Upload}
            title={filtered ? "No documents match" : "No documents yet"}
            description={
              filtered
                ? "Try a different search term, category, or clear the filters."
                : "Upload an external medical document to keep it with the rest of your records."
            }
            action={
              filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    onQueryChange("");
                    onCategoryChange("All");
                    onFiltersChange({ range: "any", status: "all" });
                  }}
                  className="h-8 rounded-lg border border-[#E6EFEE] px-3 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
                >
                  Clear search and filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onUpload}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A9189] px-3 text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
                >
                  <Upload size={12} aria-hidden />
                  Upload Document
                </button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-[#F0F5F5]">
            {visible.map((document) => {
              const isImage = ["JPG", "JPEG", "PNG", "WEBP"].includes(document.fileType);
              const Icon = isImage ? ImageIcon : FileText;
              return (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center gap-2.5 px-1 py-2.5 transition hover:bg-[#FBFDFD]"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      isImage
                        ? "bg-[#EFF4FF] text-[#2563EB]"
                        : "bg-[#FFE9EE] text-[#E5486B]",
                    )}
                  >
                    <Icon size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[11px] font-semibold text-[#0F2D4A]">
                        {document.name}
                      </p>
                      <RecordStatusBadge status={document.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[9px] text-[#8A99A8]">
                      {document.category} • {document.fileType} • {document.size} •{" "}
                      {formatRecordDate(document.date)}
                    </p>
                  </div>

                  <SourceBadge source={document.source} />

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onPreview(document)}
                      aria-label={`Preview ${document.name}`}
                      className="grid h-7 w-7 place-items-center rounded-lg text-[#7187A6] transition hover:bg-[#F1F7F7] hover:text-[#0A9189]"
                    >
                      <Eye size={13} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(document)}
                      aria-label={`Download ${document.name}`}
                      className="grid h-7 w-7 place-items-center rounded-lg text-[#7187A6] transition hover:bg-[#F1F7F7] hover:text-[#0A9189]"
                    >
                      <Download size={13} aria-hidden />
                    </button>
                    {document.deletable ? (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(document)}
                        aria-label={`Delete ${document.name}`}
                        className="grid h-7 w-7 place-items-center rounded-lg text-[#A83A4C] transition hover:bg-[#FFF1F3] hover:text-[#E5484D]"
                      >
                        <Trash2 size={13} aria-hidden />
                      </button>
                    ) : (
                      <span
                        title="Clinician-authored records cannot be deleted by patients"
                        className="grid h-7 w-7 place-items-center rounded-lg text-[#C9D4DE]"
                      >
                        <Trash2 size={13} aria-hidden />
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="border-t border-[#EEF4F4] px-3.5 py-2 text-[8.5px] leading-relaxed text-[#9AA9B8]">
        Patient-uploaded documents can be removed with confirmation. Clinician-authored
        records stay part of your medical history and cannot be deleted here.
      </p>

      <ModalShell
        open={Boolean(pendingDelete)}
        onClose={() => (busy ? null : setPendingDelete(null))}
        labelledBy="delete-document-title"
        maxWidth="max-w-[420px]"
        closeLabel="Close delete confirmation"
      >
        {pendingDelete ? (
          <div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF1F3] text-[#E5484D]">
              <Trash2 size={18} aria-hidden />
            </span>
            <h2
              id="delete-document-title"
              className="mt-2.5 text-[14px] font-bold text-[#0F2D4A]"
            >
              Delete this document?
            </h2>
            <p className="mt-1 text-[10.5px] leading-relaxed text-[#5B6B7C]">
              <span className="font-semibold text-[#0F2D4A]">{pendingDelete.name}</span>{" "}
              will be removed from this demo list. This action cannot be undone and no
              server copy is deleted because uploads are local-only in this prototype.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={busy}
                className="h-8 rounded-lg border border-[#E6EFEE] px-3 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#CFE9E5] hover:text-[#0F2D4A] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#E5484D] px-3 text-[10px] font-semibold text-white transition hover:bg-[#CC3B40] disabled:opacity-70"
              >
                <Trash2 size={12} aria-hidden />
                {busy ? "Deleting..." : "Delete document"}
              </button>
            </div>
          </div>
        ) : null}
      </ModalShell>
    </section>
  );
}

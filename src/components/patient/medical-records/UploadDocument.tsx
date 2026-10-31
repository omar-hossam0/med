"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  FileText,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  fileExtension,
  formatBytes,
  formatRecordDate,
  medicalDoctors,
  todayIso,
  type DocumentCategory,
  type MedicalDocument,
} from "@/lib/mock/medicalRecords";
import { SectionCard } from "./ui";
import { cn } from "@/lib/cn";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = ["PDF", "JPG", "JPEG", "PNG"];

const CATEGORIES: DocumentCategory[] = [
  "Medical Report",
  "Lab Result",
  "Imaging",
  "Prescription",
  "Other",
];

type Status = "idle" | "uploading" | "success" | "error";

type Errors = Partial<Record<"file" | "name" | "category" | "form", string>>;

export function UploadDocument({
  onBack,
  onUploaded,
}: {
  onBack: () => void;
  onUploaded: (document: MedicalDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [simulateFailure, setSimulateFailure] = useState(false);

  const isImage = useMemo(() => {
    if (!file) return false;
    return ["image/jpeg", "image/png"].includes(file.type) || ["JPG", "JPEG", "PNG"].includes(fileExtension(file.name));
  }, [file]);

  // Release the object URL when the file changes or the screen unmounts.
  // (Kept alive after a successful demo upload so the Documents list can
  // still show the image preview; deletion revokes it there.)

  const applyFile = (next: File) => {
    const ext = fileExtension(next.name);
    const typeOk =
      ALLOWED_TYPES.includes(next.type) || ALLOWED_EXTENSIONS.includes(ext);

    if (!typeOk) {
      setErrors((current) => ({
        ...current,
        file: "Unsupported format. Upload a PDF, JPG, or PNG file.",
      }));
      return;
    }
    if (next.size > MAX_BYTES) {
      setErrors((current) => ({
        ...current,
        file: `File is ${formatBytes(next.size)}. The maximum allowed size is 10 MB.`,
      }));
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(["JPG", "JPEG", "PNG"].includes(ext) ? URL.createObjectURL(next) : null);
    setName((current) => current || next.name.replace(/\.[^.]+$/, ""));
    setErrors((current) => ({ ...current, file: undefined }));
    setStatus("idle");
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setErrors((current) => ({ ...current, file: undefined }));
    if (inputRef.current) inputRef.current.value = "";
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!file) next.file = "Choose a PDF, JPG, or PNG file to upload.";
    if (!name.trim()) next.name = "Document name is required.";
    if (!category) next.category = "Choose a category for this document.";
    return next;
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "uploading") return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStatus("uploading");

    // Frontend-only phase: there is no upload endpoint yet, so the file is kept
    // in React state for this session and clearly labelled as a demo upload.
    window.setTimeout(() => {
      if (simulateFailure) {
        setStatus("error");
        setErrors({
          form: "The demo upload was interrupted. No file was stored. Please try again.",
        });
        return;
      }

      if (!file || !category) {
        setStatus("error");
        setErrors({ form: "Something went wrong while preparing the upload." });
        return;
      }

      setStatus("success");
      window.setTimeout(() => {
        onUploaded({
          id: `doc-upload-${Date.now()}`,
          name: name.trim(),
          category,
          date: date || todayIso(),
          size: formatBytes(file.size),
          fileType: fileExtension(file.name),
          source: "patient",
          status: "Awaiting Review",
          doctorId: doctorId || undefined,
          deletable: true,
          previewUrl: previewUrl ?? undefined,
        });
      }, 800);
    }, 900);
  };

  return (
    <SectionCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#5B6B7C] transition hover:text-[#0A9189]"
          >
            <ArrowLeft size={12} aria-hidden />
            Back to Medical Records
          </button>
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#0F2D4A]">
            Upload Document
          </h2>
          <p className="mt-1 text-[10.5px] leading-relaxed text-[#5B6B7C]">
            Add an external medical document to your records.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-[#FFF6E5] px-2.5 py-1 text-[9px] font-semibold text-[#C77A0A] sm:inline-flex">
          Demo — no server storage
        </span>
      </div>

      {status === "success" ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-[#D7EFEA] bg-[#F7FCFB] px-4 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#E7FBF8] text-[#0A9189]">
            <CheckCircle2 size={24} aria-hidden />
          </span>
          <h3 className="mt-3 text-[14px] font-bold text-[#0F2D4A]">
            Document added to this demo session
          </h3>
          <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-[#5B6B7C]">
            Taking you to your Documents list. This upload is kept in the browser for
            this session only — it is not saved to the Medora server.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-3.5">
          <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Upload zone */}
            <div>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const next = event.dataTransfer.files?.[0];
                  if (next) applyFile(next);
                }}
                className={cn(
                  "flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
                  dragging
                    ? "border-[#0A9189] bg-[#F0FCFA]"
                    : errors.file
                      ? "border-[#F3B7BF] bg-[#FFF9FA]"
                      : "border-[#D8E8E6] bg-[#FBFDFD]",
                )}
              >
                {file ? (
                  <div className="w-full">
                    <div className="mx-auto flex max-w-sm items-center gap-2.5 rounded-xl border border-[#E6EFEE] bg-white p-2.5 text-left">
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg",
                          isImage ? "bg-[#EFF4FF] text-[#2563EB]" : "bg-[#FFE9EE] text-[#E5486B]",
                        )}
                      >
                        {previewUrl && isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : isImage ? (
                          <ImageIcon size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10.5px] font-semibold text-[#0F2D4A]">
                          {file.name}
                        </span>
                        <span className="mt-0.5 block text-[8.5px] text-[#8A99A8]">
                          {fileExtension(file.name)} • {formatBytes(file.size)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={clearFile}
                        aria-label="Remove selected file"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#9AA9B8] transition hover:bg-[#FFF1F3] hover:text-[#E5484D]"
                      >
                        <X size={13} aria-hidden />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="mt-2 text-[9.5px] font-semibold text-[#0A9189] hover:underline"
                    >
                      Choose a different file
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className={cn(
                        "grid h-12 w-12 place-items-center rounded-full",
                        dragging
                          ? "bg-[#0A9189] text-white"
                          : "bg-[#E7FBF8] text-[#0A9189]",
                      )}
                    >
                      <CloudUpload size={22} aria-hidden />
                    </span>
                    <p className="mt-2.5 text-[11.5px] font-semibold text-[#0F2D4A]">
                      Drag and drop your file here
                    </p>
                    <p className="mt-0.5 text-[9.5px] text-[#7187A6]">or</p>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="mt-2 h-8 rounded-lg border border-[#BFE8E2] bg-white px-3 text-[10px] font-semibold text-[#0A9189] transition hover:bg-[#F0FCFA]"
                    >
                      Browse files
                    </button>
                    <p className="mt-2.5 text-[8.5px] leading-relaxed text-[#9AA9B8]">
                      PDF, JPG or PNG · Maximum 10 MB
                    </p>
                  </>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(event) => {
                    const next = event.target.files?.[0];
                    if (next) applyFile(next);
                  }}
                />
              </div>

              {errors.file ? (
                <p className="mt-1.5 flex items-start gap-1 text-[9px] font-medium text-[#D33A4A]">
                  <AlertTriangle size={11} className="mt-[1px] shrink-0" aria-hidden />
                  {errors.file}
                </p>
              ) : (
                <p className="mt-1.5 flex items-start gap-1 text-[8.5px] leading-relaxed text-[#9AA9B8]">
                  <ShieldCheck size={11} className="mt-[1px] shrink-0" aria-hidden />
                  Only upload documents you are authorised to share. Files are not sent
                  to a server in this prototype.
                </p>
              )}
            </div>

            {/* Form */}
            <div className="space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-[9.5px] font-semibold text-[#33475B]">
                  Document Name <span className="text-[#E5484D]">*</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setErrors((current) => ({ ...current, name: undefined }));
                  }}
                  placeholder="e.g. External MRI Report"
                  aria-invalid={Boolean(errors.name)}
                  className={cn(
                    "h-9 w-full rounded-lg border bg-white px-2.5 text-[10.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:ring-4",
                    errors.name
                      ? "border-[#F3B7BF] focus:border-[#E5484D]/50 focus:ring-[#E5484D]/10"
                      : "border-[#E6EFEE] focus:border-[#0A9189]/40 focus:ring-[#0A9189]/10",
                  )}
                />
                {errors.name ? (
                  <span className="mt-1 block text-[9px] font-medium text-[#D33A4A]">
                    {errors.name}
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-[9.5px] font-semibold text-[#33475B]">
                  Category <span className="text-[#E5484D]">*</span>
                </span>
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as DocumentCategory);
                    setErrors((current) => ({ ...current, category: undefined }));
                  }}
                  aria-invalid={Boolean(errors.category)}
                  className={cn(
                    "h-9 w-full rounded-lg border bg-white px-2.5 text-[10.5px] text-[#0F2D4A] outline-none transition focus:ring-4",
                    errors.category
                      ? "border-[#F3B7BF] focus:border-[#E5484D]/50 focus:ring-[#E5484D]/10"
                      : "border-[#E6EFEE] focus:border-[#0A9189]/40 focus:ring-[#0A9189]/10",
                  )}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                {errors.category ? (
                  <span className="mt-1 block text-[9px] font-medium text-[#D33A4A]">
                    {errors.category}
                  </span>
                ) : null}
              </label>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[9.5px] font-semibold text-[#33475B]">
                    Related Doctor <span className="font-normal text-[#9AA9B8]">(optional)</span>
                  </span>
                  <select
                    value={doctorId}
                    onChange={(event) => setDoctorId(event.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[10.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
                  >
                    <option value="">Not specified</option>
                    {medicalDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name} — {doctor.specialty}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[9.5px] font-semibold text-[#33475B]">
                    Date <span className="font-normal text-[#9AA9B8]">(optional)</span>
                  </span>
                  <input
                    type="date"
                    value={date}
                    max={todayIso()}
                    onChange={(event) => setDate(event.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[10.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
                  />
                </label>
              </div>

              <label className="flex items-start gap-1.5 rounded-lg border border-[#F7E3BD] bg-[#FFFBF3] px-2.5 py-2">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(event) => {
                    setSimulateFailure(event.target.checked);
                    setStatus("idle");
                    setErrors((current) => ({ ...current, form: undefined }));
                  }}
                  className="mt-[1px] h-3 w-3 accent-[#C77A0A]"
                />
                <span className="text-[8.5px] leading-relaxed text-[#8A5B12]">
                  Demo control: simulate an upload failure to preview the error state.
                </span>
              </label>

              {errors.form ? (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 rounded-lg border border-[#FFD7DD] bg-[#FFF5F7] px-2.5 py-2 text-[9px] leading-relaxed text-[#A83A4C]"
                >
                  <AlertTriangle size={12} className="mt-[1px] shrink-0" aria-hidden />
                  {errors.form}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3.5 flex flex-col-reverse gap-2 border-t border-[#EEF4F4] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[8.5px] leading-relaxed text-[#9AA9B8]">
              Uploads in this prototype stay in the browser session and are marked
              &ldquo;Awaiting Review&rdquo;. A backend upload endpoint is still required.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                disabled={status === "uploading"}
                className="h-9 rounded-lg border border-[#E6EFEE] px-3 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#CFE9E5] hover:text-[#0F2D4A] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "uploading"}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A9189] px-3.5 text-[10px] font-semibold text-white transition hover:bg-[#087F78] disabled:opacity-70"
              >
                {status === "uploading" ? (
                  <>
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={12} aria-hidden />
                    Upload Document
                  </>
                )}
              </button>
            </div>
          </div>

          {file ? (
            <p className="mt-2 text-[8.5px] text-[#9AA9B8]">
              Selected: {file.name} · {formatRecordDate(date || todayIso())}
            </p>
          ) : null}
        </form>
      )}
    </SectionCard>
  );
}

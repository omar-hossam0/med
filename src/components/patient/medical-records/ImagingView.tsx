"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Hospital,
  Image as ImageIcon,
  Info,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  ScanLine,
  UserRound,
} from "lucide-react";
import {
  formatRecordDate,
  getMedicalDoctor,
  getVisit,
  type ImagingResult,
} from "@/lib/mock/medicalRecords";
import { RecordStatusBadge, RecordTypeIcon } from "./badges";
import {
  DetailField,
  InfoNote,
  SectionCard,
  demoExport,
  downloadTextFile,
} from "./ui";
import { cn } from "@/lib/cn";

type ImagingTab = "Images" | "Report" | "Details" | "Related Visit";

const TABS: ImagingTab[] = ["Images", "Report", "Details", "Related Visit"];

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function ImagingView({
  imaging,
  compact = false,
  onOpenVisit,
  onOpenFull,
  onToast,
}: {
  imaging: ImagingResult;
  compact?: boolean;
  onOpenVisit: (id: string) => void;
  onOpenFull?: () => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<ImagingTab>("Images");
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const doctor = getMedicalDoctor(imaging.doctorId);
  const relatedVisit = getVisit(imaging.relatedVisitId);
  const activeImage = imaging.images[activeIndex];

  // Reset the viewer when the patient opens a different imaging record.
  useEffect(() => {
    setActiveIndex(0);
    setZoom(1);
  }, [imaging.id]);

  const select = (index: number) => {
    setActiveIndex(index);
    setZoom(1);
  };

  const prev = () =>
    select((activeIndex - 1 + imaging.images.length) % imaging.images.length);
  const next = () => select((activeIndex + 1) % imaging.images.length);

  const download = () => {
    downloadTextFile(
      `${imaging.name.replace(/\s+/g, "-").toLowerCase()}-report.txt`,
      demoExport(`${imaging.name} — Radiology Report`, [
        `Date: ${formatRecordDate(imaging.date)}`,
        `Radiology center: ${imaging.facility}`,
        `Modality: ${imaging.modality}`,
        `Body part: ${imaging.bodyPart}`,
        `Accession: ${imaging.accession}`,
        `Reporting clinician: ${doctor?.name ?? "Radiology team"}`,
        "",
        "Findings",
        imaging.findings,
        "",
        "Impression",
        imaging.impression,
        "",
        "Note: the imaging viewer in this demo shows a labelled placeholder,",
        "not a real radiograph.",
      ]),
    );
    onToast("Imaging report downloaded as a demo text file.");
  };

  return (
    <SectionCard className={cn(compact ? "p-3.5" : "p-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <RecordTypeIcon type="imaging" size={compact ? "md" : "lg"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "font-bold leading-tight tracking-[-0.015em] text-[#0F2D4A]",
                compact ? "text-[14px]" : "text-[19px]",
              )}
            >
              {imaging.name}
            </h2>
            <RecordStatusBadge status={imaging.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[9.5px] text-[#5B6B7C]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={11} className="text-[#9AA9B8]" aria-hidden />
              {formatRecordDate(imaging.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hospital size={11} className="text-[#9AA9B8]" aria-hidden />
              {imaging.facility}
            </span>
            <span className="inline-flex items-center gap-1">
              <ScanLine size={11} className="text-[#9AA9B8]" aria-hidden />
              {imaging.modality} · {imaging.bodyPart}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound size={11} className="text-[#9AA9B8]" aria-hidden />
              {doctor?.name ?? "Radiology team"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={download}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E6EFEE] bg-white font-semibold text-[#33475B] transition hover:border-[#BFE8E2] hover:text-[#0A9189]",
            compact ? "h-7 px-2 text-[9px]" : "h-8 px-2.5 text-[10px]",
          )}
        >
          <Download size={12} aria-hidden />
          Download
        </button>
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
        {(compact || tab === "Images") && (
          <div className="space-y-2.5">
            <div className="relative overflow-hidden rounded-xl bg-[#0B1118]">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2.5 py-1.5">
                <p className="truncate text-[9px] font-semibold text-white/70">
                  {imaging.name} · {activeImage?.label ?? "Image"}
                </p>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-semibold text-white/70">
                  Demo placeholder
                </span>
              </div>

              <div className="relative grid h-[240px] place-items-center overflow-hidden sm:h-[300px]">
                {activeImage ? (
                  <div className="relative h-full w-full">
                    <Image
                      key={activeImage.id}
                      src={activeImage.src}
                      alt={`${imaging.name} — ${activeImage.label} (labelled demo placeholder, not a clinical radiograph)`}
                      fill
                      sizes="(max-width: 768px) 100vw, 60vw"
                      unoptimized
                      className="object-contain transition-transform duration-200"
                      style={{ transform: `scale(${zoom})` }}
                    />
                  </div>
                ) : (
                  <p className="text-[10px] text-white/60">Image unavailable</p>
                )}

                {imaging.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Previous image"
                      className="absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white/80 transition hover:bg-black/70 hover:text-white"
                    >
                      <ChevronLeft size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Next image"
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white/80 transition hover:bg-black/70 hover:text-white"
                    >
                      <ChevronRight size={15} aria-hidden />
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-2.5 py-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.max(MIN_ZOOM, +(value - 0.25).toFixed(2)))}
                    disabled={zoom <= MIN_ZOOM}
                    aria-label="Zoom out"
                    className="grid h-6 w-6 place-items-center rounded-md bg-white/10 text-white/75 transition hover:bg-white/20 hover:text-white disabled:opacity-40"
                  >
                    <Minus size={12} aria-hidden />
                  </button>
                  <span className="w-9 text-center text-[8.5px] font-semibold text-white/70">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.min(MAX_ZOOM, +(value + 0.25).toFixed(2)))}
                    disabled={zoom >= MAX_ZOOM}
                    aria-label="Zoom in"
                    className="grid h-6 w-6 place-items-center rounded-md bg-white/10 text-white/75 transition hover:bg-white/20 hover:text-white disabled:opacity-40"
                  >
                    <Plus size={12} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    aria-label="Reset zoom and fit image"
                    className="ml-1 inline-flex h-6 items-center gap-1 rounded-md bg-white/10 px-1.5 text-[8.5px] font-semibold text-white/75 transition hover:bg-white/20 hover:text-white"
                  >
                    <RotateCcw size={11} aria-hidden />
                    Fit
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(MAX_ZOOM)}
                    aria-label="Maximise zoom"
                    className="inline-flex h-6 items-center gap-1 rounded-md bg-white/10 px-1.5 text-[8.5px] font-semibold text-white/75 transition hover:bg-white/20 hover:text-white"
                  >
                    <Maximize2 size={11} aria-hidden />
                    Zoom
                  </button>
                </div>
                <span className="text-[8.5px] text-white/50">
                  {activeIndex + 1} / {imaging.images.length}
                </span>
              </div>
            </div>

            {imaging.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {imaging.images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => select(index)}
                    aria-label={`View ${image.label}`}
                    aria-pressed={index === activeIndex}
                    className={cn(
                      "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition",
                      index === activeIndex
                        ? "border-[#0A9189]"
                        : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <Image
                      src={image.src}
                      alt=""
                      width={900}
                      height={900}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[7px] font-semibold text-white/85">
                      {image.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {compact && onOpenFull ? (
              <button
                type="button"
                onClick={onOpenFull}
                className="h-8 w-full rounded-lg bg-[#0A9189] text-[10px] font-semibold text-white transition hover:bg-[#087F78]"
              >
                View Full Imaging Result
              </button>
            ) : null}

            {!compact ? (
              <InfoNote tone="amber">
                Images shown in this demo are clearly labelled placeholders, not your
                clinical radiographs. Do not use them for medical decisions.
              </InfoNote>
            ) : null}
          </div>
        )}

        {!compact && tab === "Report" && (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-[#E1F1ED] bg-[#F7FCFB] p-3">
              <div className="flex items-center gap-1.5">
                <ImageIcon size={13} className="text-[#0A9189]" aria-hidden />
                <h3 className="text-[11px] font-semibold text-[#0F2D4A]">
                  Examination
                </h3>
              </div>
              <div className="mt-1.5 divide-y divide-[#E6F2EF]">
                <DetailField label="Examination type" value={imaging.name} />
                <DetailField label="Date" value={formatRecordDate(imaging.date)} />
                <DetailField label="Facility" value={imaging.facility} />
                <DetailField
                  label="Reporting clinician"
                  value={doctor?.name ?? "Radiology team"}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
              <h3 className="text-[11px] font-semibold text-[#0F2D4A]">Findings</h3>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#5B6B7C]">
                {imaging.findings}
              </p>
            </div>

            <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
              <h3 className="text-[11px] font-semibold text-[#0F2D4A]">Impression</h3>
              <p className="mt-1.5 text-[10.5px] font-medium leading-relaxed text-[#0F2D4A]">
                {imaging.impression}
              </p>
            </div>

            <InfoNote>
              Radiology report content is clinician-authored and read-only. Contact your
              care team if you have questions about these findings.
            </InfoNote>
          </div>
        )}

        {!compact && tab === "Details" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
              <div className="flex items-center gap-1.5">
                <ScanLine size={13} className="text-[#0A9189]" aria-hidden />
                <h3 className="text-[11px] font-semibold text-[#0F2D4A]">Study</h3>
              </div>
              <div className="mt-1.5 divide-y divide-[#F0F5F5]">
                <DetailField label="Modality" value={imaging.modality} />
                <DetailField label="Body part" value={imaging.bodyPart} />
                <DetailField label="Accession" value={imaging.accession} />
                <DetailField label="Images" value={`${imaging.images.length} image(s)`} />
              </div>
            </div>
            <div className="rounded-xl border border-[#E6EFEE] bg-white p-3">
              <div className="flex items-center gap-1.5">
                <Hospital size={13} className="text-[#0A9189]" aria-hidden />
                <h3 className="text-[11px] font-semibold text-[#0F2D4A]">
                  Facility
                </h3>
              </div>
              <div className="mt-1.5 divide-y divide-[#F0F5F5]">
                <DetailField label="Radiology center" value={imaging.facility} />
                <DetailField label="Date" value={formatRecordDate(imaging.date)} />
                <DetailField label="Status" value={<RecordStatusBadge status={imaging.status} />} />
                <DetailField label="Ordered by" value={doctor?.name ?? "Radiology team"} />
              </div>
            </div>
          </div>
        )}

        {!compact && tab === "Related Visit" && (
          <div>
            {relatedVisit ? (
              <div className="flex flex-col gap-2 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-3 sm:flex-row sm:items-center">
                <RecordTypeIcon type="visit" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-semibold text-[#0F2D4A]">
                    {relatedVisit.title}
                  </p>
                  <p className="mt-0.5 text-[8.5px] text-[#8A99A8]">
                    {formatRecordDate(relatedVisit.date)} •{" "}
                    {getMedicalDoctor(relatedVisit.doctorId)?.name ?? ""} •{" "}
                    {relatedVisit.facility}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenVisit(relatedVisit.id)}
                  className="h-7 shrink-0 rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[9px] font-semibold text-[#0A9189] transition hover:border-[#BFE8E2] hover:bg-[#F0FCFA]"
                >
                  View Visit
                </button>
              </div>
            ) : (
              <p className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-4 text-center text-[10.5px] text-[#7187A6]">
                <Info size={12} aria-hidden />
                This imaging study is not linked to a visit in your records.
              </p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Star,
  Stethoscope,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  CLINIC,
  PREPARATION_TIPS,
  dateParts,
  formatLongDate,
  formatTimeRange,
  getDoctor,
  type Appointment,
} from "@/lib/mock/appointments";
import { ASSETS } from "@/lib/constants";
import { DoctorPortrait } from "../DoctorPortrait";
import { StatusBadge } from "../ui";
import { tabMotion } from "@/components/transitions/tabs";
import { cn } from "@/lib/cn";

const DETAIL_TABS = ["Overview", "Location", "Preparation", "Policy"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

export function AppointmentDetailsView({
  appointment,
  onBack,
  onReschedule,
  onCancel,
  onBookAgain,
  onNotify,
}: {
  appointment: Appointment;
  onBack: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onBookAgain: (doctorId: string) => void;
  onNotify: (message: string) => void;
}) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<DetailTab>("Overview");

  const doctor = getDoctor(appointment.doctorId);
  const parts = dateParts(appointment.startsAt);
  const isUpcoming = appointment.status === "Upcoming";
  const isOnline = appointment.consultationType === "Online";
  const location = isOnline ? "Online consultation" : doctor?.clinic ?? CLINIC.name;
  const address = isOnline ? "A secure video link will be shared before your visit." : doctor?.address ?? CLINIC.address;

  const handleCalendarDownload = () => {
    const start = appointment.startsAt;
    const end = new Date(start.getTime() + appointment.durationMinutes * 60_000);
    const stamp = (date: Date) =>
      `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
        date.getUTCHours(),
      )}${pad(date.getUTCMinutes())}00Z`;

    const summary = `${appointment.consultationType} appointment with ${doctor?.name ?? "your doctor"}`;
    const description = [
      appointment.reason ? `Reason: ${appointment.reason}` : "",
      appointment.notes ? `Notes: ${appointment.notes}` : "",
      `Reference: ${appointment.reference}`,
    ]
      .filter(Boolean)
      .join("\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Medora Healthcare//Patient Appointments//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${appointment.id}@medora.demo`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `LOCATION:${escapeIcs(isOnline ? "Online consultation" : address)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `medora-${appointment.reference}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    onNotify("Calendar invite downloaded (demo).");
  };

  return (
    <section aria-labelledby="details-heading">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[11.5px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
      >
        <ArrowLeft size={14} /> Back to Appointments
      </button>

      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1
            id="details-heading"
            className="text-[23px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[25px]"
          >
            Appointment Details
          </h1>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B7C] sm:text-[12px]">
            Review your appointment information and manage this visit.
          </p>
        </div>
        <StatusBadge status={appointment.status} size="md" />
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {isUpcoming && (
          <>
            <button
              type="button"
              onClick={onReschedule}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#0A9189]/40 bg-white px-3 text-[11px] font-semibold text-[#0A9189] transition hover:bg-[#F1FBFA]"
            >
              <CalendarDays size={13} /> Reschedule
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#F3C9CE] bg-white px-3 text-[11px] font-semibold text-[#E5484D] transition hover:bg-[#FDECEF]"
            >
              <CalendarX2 size={13} /> Cancel Appointment
            </button>
            <button
              type="button"
              onClick={handleCalendarDownload}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#0A9189]/40 bg-white px-3 text-[11px] font-semibold text-[#0A9189] transition hover:bg-[#F1FBFA]"
            >
              <Download size={13} /> Add to Calendar
            </button>
          </>
        )}

        {!isUpcoming && (
          <button
            type="button"
            onClick={() => onBookAgain(appointment.doctorId)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A9189] px-3.5 text-[11px] font-semibold text-white shadow-[0_10px_20px_-14px_rgba(10,145,137,0.8)] transition hover:bg-[#087F78]"
          >
            <RotateCcw size={13} /> Book Again
          </button>
        )}
      </div>

      {/* Summary card */}
      <div className="mt-3 grid gap-4 rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_8px_26px_-22px_rgba(15,45,74,0.28)] md:grid-cols-[96px_minmax(0,1fr)_220px] md:items-center">
        <div className="grid w-[84px] place-items-center rounded-xl bg-[#F4FCFA] px-2 py-3">
          <span className="text-[28px] font-bold leading-none text-[#0A9189]">{parts.day}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#0A9189]">
            {parts.month}
          </span>
          <span className="text-[9px] text-[#8A99A8]">{parts.year}</span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <DoctorPortrait
              name={doctor?.name ?? "Doctor"}
              photoUrl={doctor?.photoUrl}
              size={52}
            />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#0F2D4A]">
                {doctor?.name ?? "Unknown doctor"}
              </p>
              <p className="truncate text-[10.5px] text-[#8A99A8]">{doctor?.specialty}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[9.5px] text-[#5B6B7C]">
                <Star size={10} className="fill-[#0A9189] text-[#0A9189]" />
                <span className="font-semibold text-[#0F2D4A]">{doctor?.rating}</span>
                <span className="text-[#9AA9B8]">({doctor?.reviews} reviews)</span>
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(doctor?.tags ?? []).slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#F4F9F9] px-2 py-0.5 text-[8.5px] font-medium text-[#5B6B7C]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {isOnline ? (
          <div className="grid h-[104px] place-items-center rounded-xl bg-gradient-to-br from-[#EFE9FF] via-[#E9F8F9] to-[#DDF7F1]">
            <div className="text-center">
              <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-[#3B6EF6]">
                <Video size={17} />
              </span>
              <p className="mt-1.5 text-[9.5px] font-semibold text-[#0F2D4A]">
                Online Consultation
              </p>
              <p className="text-[8.5px] text-[#5B6B7C]">Secure video visit</p>
            </div>
          </div>
        ) : (
          <div className="relative h-[104px] overflow-hidden rounded-xl">
            <Image
              src={ASSETS.clinic}
              alt="Medora Medical Center clinic exterior"
              fill
              sizes="(max-width: 768px) 100vw, 220px"
              className="object-cover"
            />
          </div>
        )}
      </div>

      {/* Key information */}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile icon={CalendarDays} label="Date" value={formatLongDate(appointment.startsAt)} />
        <InfoTile
          icon={Clock}
          label="Time"
          value={formatTimeRange(appointment.startsAt, appointment.durationMinutes)}
        />
        <InfoTile
          icon={isOnline ? Video : UserRound}
          label="Consultation Type"
          value={appointment.consultationType === "Online" ? "Online Consultation" : "In-Person Visit"}
        />
        <InfoTile icon={MapPin} label="Location" value={location} />
      </div>

      {/* Tabs */}
      <div className="mt-3 rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_8px_26px_-22px_rgba(15,45,74,0.28)]">
        <div
          role="tablist"
          aria-label="Appointment details"
          className="flex gap-1 overflow-x-auto border-b border-[#EEF4F4] hide-scrollbar"
        >
          {DETAIL_TABS.map((item) => {
            const active = tab === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item)}
                className={cn(
                  "relative shrink-0 px-3 pb-2.5 pt-1 text-[11.5px] font-medium transition-colors",
                  active ? "text-[#0A9189]" : "text-[#5B6B7C] hover:text-[#0F2D4A]",
                )}
              >
                {item}
                {active && (
                  <motion.span
                    layoutId="appointment-details-tab"
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#0A9189]"
                    transition={reduce ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <motion.div
          key={tab}
          {...tabMotion(Boolean(reduce))}
          className="pt-3"
          role="tabpanel"
          aria-label={tab}
        >
          {tab === "Overview" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-[12.5px] font-semibold text-[#0F2D4A]">About Your Doctor</h3>
                <p className="mt-1 max-w-3xl text-[10.5px] leading-relaxed text-[#5B6B7C]">
                  {doctor?.bio}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(doctor?.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-[#F4FCFA] px-2 py-0.5 text-[8.5px] font-medium text-[#0A9189]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] p-3">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#0F2D4A]">
                    <FileText size={12} className="text-[#8A99A8]" /> Appointment Notes
                  </p>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-[#5B6B7C]">
                    {appointment.reason || appointment.notes ? (
                      <>
                        {appointment.reason && (
                          <span className="block">
                            <strong className="font-semibold text-[#33475B]">Reason:</strong>{" "}
                            {appointment.reason}
                          </span>
                        )}
                        {appointment.notes && (
                          <span className="mt-0.5 block">
                            <strong className="font-semibold text-[#33475B]">Notes:</strong>{" "}
                            {appointment.notes}
                          </span>
                        )}
                      </>
                    ) : (
                      "No additional notes."
                    )}
                  </p>
                  <p className="mt-1.5 text-[8.5px] text-[#9AA9B8]">
                    Reference: {appointment.reference}
                  </p>
                </div>

                <div className="rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] p-3">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#0F2D4A]">
                    <ShieldCheck size={12} className="text-[#8A99A8]" /> Cancellation Policy
                  </p>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-[#5B6B7C]">
                    You can reschedule or cancel up to 12 hours before your appointment.
                    {appointment.status === "Cancelled" && appointment.cancellationReason && (
                      <span className="mt-1 block">
                        <strong className="font-semibold text-[#33475B]">Cancelled:</strong>{" "}
                        {appointment.cancellationReason}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "Location" && (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px] md:items-start">
              <div>
                <h3 className="text-[12.5px] font-semibold text-[#0F2D4A]">
                  {isOnline ? "Online consultation" : "Clinic location"}
                </h3>
                <p className="mt-1 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-[#5B6B7C]">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-[#0A9189]" />
                  {address}
                </p>
                {!isOnline && (
                  <>
                    <p className="mt-1.5 text-[9.5px] text-[#8A99A8]">Opening hours: {CLINIC.hours}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#0A9189]/40 bg-white px-2.5 text-[10px] font-semibold text-[#0A9189] transition hover:bg-[#F1FBFA]"
                    >
                      <MapPin size={12} /> View on Map
                    </a>
                  </>
                )}
                {isOnline && (
                  <p className="mt-2 rounded-lg bg-[#F3FAFD] px-2.5 py-2 text-[9.5px] leading-relaxed text-[#5B6B7C]">
                    No meeting link is generated in this demo. In production, Medora would
                    send a secure link after confirmation.
                  </p>
                )}
              </div>

              {!isOnline ? (
                <div className="relative h-[130px] overflow-hidden rounded-xl">
                  <Image
                    src={ASSETS.clinic}
                    alt="Medora Medical Center clinic exterior"
                    fill
                    sizes="240px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="grid h-[130px] place-items-center rounded-xl bg-gradient-to-br from-[#EFE9FF] via-[#E9F8F9] to-[#DDF7F1]">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#3B6EF6]">
                    <Video size={18} />
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === "Preparation" && (
            <div>
              <h3 className="text-[12.5px] font-semibold text-[#0F2D4A]">How to prepare</h3>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {PREPARATION_TIPS[appointment.consultationType].map((tip) => (
                  <li
                    key={tip}
                    className="flex items-start gap-2 rounded-lg border border-[#EEF4F4] bg-[#FBFDFD] px-2.5 py-2 text-[10px] leading-relaxed text-[#5B6B7C]"
                  >
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-[#0A9189]" />
                    {tip}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[9.5px] leading-relaxed text-[#8A99A8]">
                Bring a list of any medications, allergies, and recent test results. Do not
                share sensitive information you are not comfortable discussing.
              </p>
            </div>
          )}

          {tab === "Policy" && (
            <div className="space-y-2.5 text-[10px] leading-relaxed text-[#5B6B7C]">
              <div className="rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] p-3">
                <p className="text-[10.5px] font-semibold text-[#0F2D4A]">Rescheduling</p>
                <p className="mt-0.5">
                  You can reschedule up to 12 hours before your appointment from this page.
                  The new time is subject to availability.
                </p>
              </div>
              <div className="rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] p-3">
                <p className="text-[10.5px] font-semibold text-[#0F2D4A]">Cancellation</p>
                <p className="mt-0.5">
                  Cancellations made less than 12 hours before the visit may be recorded as
                  a missed appointment. No fee is charged in this demo.
                </p>
              </div>
              <div className="rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] p-3">
                <p className="text-[10.5px] font-semibold text-[#0F2D4A]">Late arrivals</p>
                <p className="mt-0.5">
                  Please arrive within 15 minutes of your scheduled time. Your doctor may
                  need to shorten the visit if you arrive later.
                </p>
              </div>
              <p className="text-[9px] text-[#9AA9B8]">
                Policy text is demo content for this frontend phase.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#E6EFEE] bg-white px-3 py-2">
        <p className="flex items-center gap-1.5 text-[9.5px] text-[#8A99A8]">
          <Stethoscope size={12} className="text-[#0A9189]" />
          Need to change something else? Contact the clinic and quote {appointment.reference}.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-lg border border-[#E6EFEE] px-2.5 py-1 text-[10px] font-semibold text-[#33475B] transition hover:bg-[#F7FAFA]"
        >
          Back to list
        </button>
      </div>
    </section>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#E6EFEE] bg-white p-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
        <Icon size={13} />
      </span>
      <div className="min-w-0">
        <p className="text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#9AA9B8]">
          {label}
        </p>
        <p className="mt-0.5 text-[10px] font-medium leading-snug text-[#33475B]">{value}</p>
      </div>
    </div>
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

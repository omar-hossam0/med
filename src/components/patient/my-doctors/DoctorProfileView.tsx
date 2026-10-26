"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseMedical,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Heart,
  Languages,
  LayoutGrid,
  MapPin,
  ShieldCheck,
  Star,
  Stethoscope,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  CLINIC,
  formatSlotTime,
  getWeeklyPreview,
  type Doctor,
  type TimeRange,
} from "@/lib/mock/doctors";
import { DoctorPortrait } from "../DoctorPortrait";
import { tabMotion } from "@/components/transitions/tabs";
import { cn } from "@/lib/cn";

type TabId = "overview" | "services" | "availability" | "reviews" | "location";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "services", label: "Services", icon: Stethoscope },
  { id: "availability", label: "Availability", icon: CalendarDays },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "location", label: "Location", icon: MapPin },
];

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatRange(item: TimeRange): string {
  return `${formatSlotTime(item.start)} – ${formatSlotTime(item.end)}`;
}

export function DoctorProfileView({
  doctor,
  favorite,
  onToggleFavorite,
  onBack,
  onSelectDepartment,
  onBook,
}: {
  doctor: Doctor;
  favorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
  onSelectDepartment: (id: Doctor["departmentId"]) => void;
  onBook: () => void;
}) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<TabId>("overview");
  const hasReviews = doctor.patientReviews.length > 0;
  const tabs = TABS.filter((item) => item.id !== "reviews" || hasReviews);

  const today = useMemo(() => new Date(), []);
  const upcomingDays = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const date = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + index,
        );
        return date;
      }),
    [today],
  );

  return (
    <section aria-labelledby="doctor-profile-heading">
      {/* Breadcrumb / back */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-[10.5px] text-[#8A99A8]"
      >
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[24px] items-center gap-1.5 rounded-lg px-1 py-1 font-semibold text-[#0A9189] transition hover:text-[#087F78]"
        >
          <ArrowLeft size={13} /> My Doctors
        </button>
        <ChevronRight size={12} aria-hidden />
        <button
          type="button"
          onClick={() => onSelectDepartment(doctor.departmentId)}
          className="min-h-[24px] rounded-lg px-1 py-1 font-medium text-[#5B6B7C] transition hover:text-[#0A9189]"
        >
          {doctor.department}
        </button>
        <ChevronRight size={12} aria-hidden />
        <span className="px-1 font-semibold text-[#0F2D4A]">{doctor.name}</span>
      </nav>

      {/* Profile header */}
      <div className="mt-2 rounded-2xl border border-[#E1F1EE] bg-gradient-to-br from-[#F0FBFA] via-white to-[#F8FCFB] p-4 shadow-[0_16px_40px_-38px_rgba(15,45,74,0.5)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative shrink-0 self-start sm:self-center">
            <DoctorPortrait
              name={doctor.name}
              photoUrl={doctor.photoUrl}
              size={112}
              priority
              className="bg-[#EAF2F2] ring-4 ring-white shadow-[0_10px_26px_-20px_rgba(15,45,74,0.55)]"
            />
            {doctor.verified && (
              <span
                title="Verification status is demo data"
                className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#0A9189] text-white ring-2 ring-white"
              >
                <ShieldCheck size={14} />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id="doctor-profile-heading"
                className="text-[20px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[23px]"
              >
                {doctor.name}
              </h1>
              {doctor.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#DEF7EE] px-2 py-0.5 text-[9px] font-semibold text-[#0F8A6C]">
                  <ShieldCheck size={11} /> Verified Doctor
                </span>
              )}
            </div>

            <p className="mt-0.5 text-[12px] font-medium text-[#5B6B7C]">
              {doctor.title}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-[#5B6B7C]">
              <span className="inline-flex items-center gap-1">
                <Star size={12} className="fill-[#F5A623] text-[#F5A623]" />
                <span className="font-semibold text-[#0F2D4A]">
                  {doctor.rating.toFixed(1)}
                </span>
                <span className="text-[#8A99A8]">({doctor.reviews} reviews)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <BriefcaseMedical size={12} className="text-[#9AA9B8]" />
                {doctor.years}+ years experience
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 size={12} className="text-[#9AA9B8]" />
                {doctor.clinic}
              </span>
              <span className="inline-flex items-center gap-1">
                <Languages size={12} className="text-[#9AA9B8]" />
                {doctor.languages.join(", ")}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleFavorite}
                aria-pressed={favorite}
                aria-label={
                  favorite
                    ? `Remove ${doctor.name} from saved doctors`
                    : `Save ${doctor.name} to your doctors`
                }
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full transition",
                  favorite
                    ? "bg-[#FFF0F2] text-[#E5486B]"
                    : "bg-white text-[#9AA9B8] ring-1 ring-[#E6EFEE] hover:text-[#E5486B]",
                )}
              >
                <Heart size={17} fill={favorite ? "currentColor" : "none"} />
              </button>

              <button
                type="button"
                onClick={onBook}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A9189] to-[#14B8A6] px-4 text-[11.5px] font-semibold text-white shadow-[0_14px_28px_-16px_rgba(10,145,137,0.9)] transition hover:from-[#087F78] hover:to-[#0FA79A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
              >
                <CalendarDays size={15} />
                Book Appointment
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-[#E6EFEE] bg-white px-1.5 hide-scrollbar">
        <div role="tablist" aria-label="Doctor profile sections" className="flex min-w-max gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold transition-colors",
                  active ? "text-[#0A9189]" : "text-[#5B6B7C] hover:text-[#0F2D4A]",
                )}
              >
                <Icon size={13} />
                {item.label}
                {active && (
                  <span className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-[#0A9189]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div key={tab} {...tabMotion(Boolean(reduce))} className="mt-3">
        {tab === "overview" && (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_10px_30px_-30px_rgba(15,45,74,0.4)]">
                <h2 className="text-[14px] font-bold text-[#0F2D4A]">
                  About {doctor.name}
                </h2>
                <p className="mt-2 text-[11px] leading-relaxed text-[#5B6B7C]">
                  {doctor.bio}
                </p>

                <div className="mt-3.5 grid gap-2 sm:grid-cols-3">
                  <FactTile
                    icon={BriefcaseMedical}
                    value={`${doctor.years}+`}
                    label="Years Experience"
                  />
                  <FactTile
                    icon={Building2}
                    value={doctor.clinic}
                    label={`${doctor.city}, Egypt`}
                  />
                  <FactTile
                    icon={Languages}
                    value={doctor.languages.join(", ")}
                    label="Consultation Languages"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_10px_30px_-30px_rgba(15,45,74,0.4)]">
                <h2 className="text-[14px] font-bold text-[#0F2D4A]">Areas of Expertise</h2>
                <ul className="mt-2.5 space-y-2">
                  {doctor.services.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[10.5px] leading-snug text-[#33475B]"
                    >
                      <span className="mt-[1px] grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
                        <Check size={10} strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <AvailableDaysCard doctor={doctor} days={upcomingDays} />

            {hasReviews && (
              <div className="mt-3 rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_10px_30px_-30px_rgba(15,45,74,0.4)]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-1.5 text-[14px] font-bold text-[#0F2D4A]">
                    <Star size={14} className="fill-[#F5A623] text-[#F5A623]" />
                    Patient Reviews
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab("reviews")}
                    className="inline-flex min-h-[24px] shrink-0 items-center px-1 text-[10.5px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
                  >
                    View All Reviews
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,190px)_minmax(0,1fr)]">
                  <div className="rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] p-3">
                    <div className="flex items-end gap-2">
                      <span className="text-[28px] font-bold leading-none text-[#0F2D4A]">
                        {doctor.rating.toFixed(1)}
                      </span>
                      <Stars rating={doctor.rating} />
                    </div>
                    <p className="mt-1.5 text-[9.5px] text-[#8A99A8]">
                      Based on {doctor.reviews} demo reviews
                    </p>
                  </div>

                  <ReviewEntry review={doctor.patientReviews[0]} />
                </div>

                <p className="mt-2.5 text-[9px] leading-relaxed text-[#9AA9B8]">
                  Demo patient feedback shown for layout purposes — not verified clinical
                  performance data.
                </p>
              </div>
            )}
          </>
        )}

        {tab === "services" && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
              <h2 className="text-[14px] font-bold text-[#0F2D4A]">Medical Services</h2>
              <p className="mt-1 text-[10px] text-[#8A99A8]">
                Services offered by {doctor.name} in this demo profile.
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {doctor.services.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] px-2.5 py-2 text-[10.5px] text-[#33475B]"
                  >
                    <Check size={12} className="mt-[1px] shrink-0 text-[#0A9189]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
              <h2 className="text-[14px] font-bold text-[#0F2D4A]">Specialty Categories</h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-[#EAFBF8] px-2.5 py-1 text-[10px] font-semibold text-[#0A9189]">
                  {doctor.specialty}
                </span>
                {doctor.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#E6EFEE] bg-white px-2.5 py-1 text-[10px] font-medium text-[#5B6B7C]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[9.5px] leading-relaxed text-[#9AA9B8]">
                Service information is demo data. Discuss your specific needs with the
                doctor during the consultation.
              </p>
            </div>
          </div>
        )}

        {tab === "availability" && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
              <h2 className="text-[14px] font-bold text-[#0F2D4A]">Weekly Availability</h2>
              <p className="mt-1 text-[10px] text-[#8A99A8]">
                Typical clinic hours — actual slots are confirmed during booking.
              </p>

              <ul className="mt-3 divide-y divide-[#EEF4F4]">
                {getWeeklyPreview(doctor).map((day) => (
                  <li
                    key={day.weekday}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="w-10 text-[10.5px] font-semibold text-[#0F2D4A]">
                      {day.day}
                    </span>
                    <span className="min-w-0 flex-1 text-[10px] text-[#5B6B7C]">
                      {day.ranges.length
                        ? day.ranges.map(formatRange).join(" · ")
                        : "Closed"}
                    </span>
                    <StatusPill status={day.status} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
                <h2 className="text-[14px] font-bold text-[#0F2D4A]">
                  Consultation Types
                </h2>
                <div className="mt-2.5 space-y-2">
                  <TypeRow
                    enabled={doctor.supportsInPerson}
                    icon={Building2}
                    label="In-Person Visit"
                    hint="At the clinic"
                  />
                  <TypeRow
                    enabled={doctor.supportsOnline}
                    icon={Video}
                    label="Online Consultation"
                    hint="Secure video call"
                  />
                </div>
                <p className="mt-3 text-[9.5px] leading-relaxed text-[#9AA9B8]">
                  Demo availability. Exact dates and times are selected in the Appointments
                  booking flow.
                </p>
              </div>

              <div className="rounded-2xl border border-[#D7F1EC] bg-[#F4FCFA] p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F2D4A]">
                  <Clock size={13} className="text-[#0A9189]" />
                  Ready to choose a time?
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#5B6B7C]">
                  Booking opens the Appointments module with {doctor.name} already selected.
                </p>
                <button
                  type="button"
                  onClick={onBook}
                  className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#0A9189] text-[11px] font-semibold text-white transition hover:bg-[#087F78]"
                >
                  <CalendarDays size={13} /> Book Appointment
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "reviews" && hasReviews && (
          <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-[#0F2D4A]">Patient Reviews</h2>
              <span className="rounded-full bg-[#FFF6E5] px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#A86A08]">
                Demo feedback
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] p-3">
              <span className="text-[32px] font-bold leading-none text-[#0F2D4A]">
                {doctor.rating.toFixed(1)}
              </span>
              <div>
                <Stars rating={doctor.rating} size={14} />
                <p className="mt-1 text-[9.5px] text-[#8A99A8]">
                  Based on {doctor.reviews} demo reviews
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {doctor.patientReviews.map((review) => (
                <ReviewEntry key={review.id} review={review} />
              ))}
            </div>

            <p className="mt-3 text-[9px] leading-relaxed text-[#9AA9B8]">
              Patient-facing demo reviews only. No confidential consultation details are
              shown, and this feedback is not a verified clinical quality measure.
            </p>
          </div>
        )}

        {tab === "location" && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
              <h2 className="text-[14px] font-bold text-[#0F2D4A]">Clinic Location</h2>
              <div className="mt-3 flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EAFBF8] text-[#0A9189]">
                  <Building2 size={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#0F2D4A]">{doctor.clinic}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-[#5B6B7C]">
                    {doctor.address}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-[#8A99A8]">
                    <MapPin size={11} /> {doctor.city}, Egypt
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${doctor.clinic}, ${doctor.address}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CFE9E5] bg-white px-2.5 text-[10px] font-semibold text-[#0A9189] transition hover:bg-[#F0FCFA]"
                  >
                    <MapPin size={11} /> Open in Maps
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
              <h2 className="text-[14px] font-bold text-[#0F2D4A]">Visit Information</h2>
              <dl className="mt-2.5 space-y-2 text-[10.5px]">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[#8A99A8]">Opening hours</dt>
                  <dd className="text-right font-medium text-[#33475B]">{CLINIC.hours}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[#8A99A8]">Consultation</dt>
                  <dd className="text-right font-medium text-[#33475B]">
                    {[doctor.supportsInPerson ? "In-Person" : null, doctor.supportsOnline ? "Online" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[#8A99A8]">Languages</dt>
                  <dd className="text-right font-medium text-[#33475B]">
                    {doctor.languages.join(", ")}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[9px] leading-relaxed text-[#9AA9B8]">
                Public clinic information for demo purposes. No private contact details are
                shown.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}

function AvailableDaysCard({ doctor, days }: { doctor: Doctor; days: Date[] }) {
  return (
    <div className="mt-3 rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_10px_30px_-30px_rgba(15,45,74,0.4)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[14px] font-bold text-[#0F2D4A]">
          <CalendarDays size={14} className="text-[#0A9189]" />
          Available Days
        </h2>
        <span className="text-[9px] text-[#9AA9B8]">In-person clinic hours (demo)</span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {days.map((date) => {
          const ranges = doctor.weekly[date.getDay()] ?? [];
          const minutes = ranges.reduce((total, item) => {
            const [sh, sm] = item.start.split(":").map(Number);
            const [eh, em] = item.end.split(":").map(Number);
            return total + (eh * 60 + em - (sh * 60 + sm));
          }, 0);
          const status = !ranges.length ? "Closed" : minutes < 180 ? "Limited" : "Available";

          return (
            <div
              key={date.toISOString()}
              className="rounded-xl border border-[#EEF4F4] bg-[#FBFDFD] px-2 py-2 text-center"
            >
              <p className="text-[10px] font-bold text-[#0F2D4A]">
                {WEEKDAY_SHORT[date.getDay()]}
              </p>
              <p className="text-[9.5px] text-[#8A99A8]">
                {MONTH_SHORT[date.getMonth()]} {date.getDate()}
              </p>
              <span className="mt-1.5 inline-block">
                <StatusPill status={status} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "Available" | "Limited" | "Closed" }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 text-[8.5px] font-semibold",
        status === "Available"
          ? "bg-[#DEF7EE] text-[#0F8A6C]"
          : status === "Limited"
            ? "bg-[#FFF1DE] text-[#B87511]"
            : "bg-[#F1F5F5] text-[#8A99A8]",
      )}
    >
      {status}
    </span>
  );
}

function FactTile({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-[#EEF4F4] bg-[#F8FCFB] p-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#0A9189] ring-1 ring-[#E6EFEE]">
        <Icon size={13} />
      </span>
      <p className="mt-1.5 text-[10.5px] font-semibold leading-snug text-[#0F2D4A]">{value}</p>
      <p className="mt-0.5 text-[9px] leading-snug text-[#8A99A8]">{label}</p>
    </div>
  );
}

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={size}
          className={
            value <= Math.round(rating)
              ? "fill-[#F5A623] text-[#F5A623]"
              : "text-[#DCE5E5]"
          }
        />
      ))}
    </span>
  );
}

function ReviewEntry({
  review,
}: {
  review: Doctor["patientReviews"][number];
}) {
  return (
    <div className="rounded-xl border border-[#EEF4F4] bg-white p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAF3FF] text-[10px] font-bold text-[#3B6EF6]">
          {review.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
            <p className="text-[10.5px] font-semibold text-[#0F2D4A]">{review.author}</p>
            <span className="text-[9px] text-[#9AA9B8]">{review.date}</span>
          </div>
          <Stars rating={review.rating} size={10} />
          <p className="mt-1 text-[10px] leading-relaxed text-[#5B6B7C]">{review.comment}</p>
        </div>
      </div>
    </div>
  );
}

function TypeRow({
  enabled,
  icon: Icon,
  label,
  hint,
}: {
  enabled: boolean;
  icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border p-2.5",
        enabled
          ? "border-[#E6EFEE] bg-[#FBFDFD]"
          : "border-[#EEF4F4] bg-[#F8FBFA]",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          enabled ? "bg-[#EAFBF8] text-[#0A9189]" : "bg-[#F1F5F5] text-[#B9C6CC]",
        )}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10.5px] font-semibold",
            enabled ? "text-[#0F2D4A]" : "text-[#9AA9B8]",
          )}
        >
          {label}
        </p>
        <p className="text-[9px] text-[#8A99A8]">{enabled ? hint : "Not offered by this doctor"}</p>
      </div>
      {enabled && <Check size={12} className="shrink-0 text-[#0A9189]" />}
    </div>
  );
}

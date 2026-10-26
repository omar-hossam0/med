"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Info,
  Lightbulb,
  MapPin,
  Search,
  Star,
  Stethoscope,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  PREPARATION_TIPS,
  REASONS_FOR_VISIT,
  dateFromKey,
  formatLongDate,
  formatSlotTime,
  getAvailableSlots,
  getDoctor,
  isSlotAvailable,
  startOfMonth,
  type Appointment,
  type BookingDraft,
  type ConsultationType,
} from "@/lib/mock/appointments";
import { doctorWorksOn } from "@/lib/mock/doctors";
import { DoctorPortrait } from "../DoctorPortrait";
import { Calendar } from "./Calendar";
import { STEP_TRANSITION } from "@/components/transitions/stepper";
import { cn } from "@/lib/cn";

type Step = 1 | 2 | 3;

const STEP_ITEMS: { number: Step; label: string }[] = [
  { number: 1, label: "Doctor & Time" },
  { number: 2, label: "Details" },
  { number: 3, label: "Review" },
];

/**
 * Existing Book New Appointment workflow, restyled to the approved third
 * reference panel. The doctor is always handed in from My Doctors; this view
 * never owns a second doctor directory.
 */
export function BookingView({
  appointments,
  today,
  initialDoctorId,
  onBack,
  onChangeDoctor,
  onConfirm,
}: {
  appointments: Appointment[];
  today: Date;
  initialDoctorId?: string;
  onBack: () => void;
  onChangeDoctor: () => void;
  onConfirm: (draft: BookingDraft) => void;
}) {
  const reduce = useReducedMotion();
  const requestedDoctorId = initialDoctorId?.trim() || undefined;
  const doctor = getDoctor(requestedDoctorId);
  const invalidDoctor = Boolean(requestedDoctorId) && !doctor;

  const [consultationType, setConsultationType] = useState<ConsultationType>(() =>
    doctor && !doctor.supportsInPerson && doctor.supportsOnline ? "Online" : "In-Person",
  );
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const slots = useMemo(() => {
    if (!doctor || !dateKey) return [];
    return getAvailableSlots({
      doctor,
      dateKey,
      consultationType,
      appointments,
      now: new Date(),
    });
  }, [doctor, dateKey, consultationType, appointments]);

  const selectedSlot = slots.find((slot) => slot.time === time);
  const canContinue = Boolean(
    doctor && dateKey && time && selectedSlot?.available,
  );

  const tips = PREPARATION_TIPS[consultationType];

  const typeSupported = (type: ConsultationType) =>
    Boolean(doctor && (type === "Online" ? doctor.supportsOnline : doctor.supportsInPerson));

  const chooseType = (nextType: ConsultationType) => {
    if (!typeSupported(nextType)) return;
    setConsultationType(nextType);
    setTime(null);
    setStep(1);
    setValidationMessage(null);
    if (doctor && dateKey && !doctorWorksOn(doctor, dateFromKey(dateKey), nextType)) {
      setDateKey(null);
    }
  };

  const chooseDate = (nextKey: string) => {
    setDateKey(nextKey);
    setTime(null);
    setValidationMessage(null);
  };

  const goToStep = (next: Step) => {
    if (next > 1 && !canContinue) {
      setValidationMessage(
        "Choose a consultation type, date and available time before continuing.",
      );
      return;
    }
    setValidationMessage(null);
    setStep(next);
  };

  const handleConfirm = () => {
    if (!doctor || !dateKey || !time) return;

    const stillAvailable = isSlotAvailable({
      doctor,
      dateKey,
      time,
      consultationType,
      appointments,
      now: new Date(),
    });

    if (!stillAvailable) {
      setTime(null);
      setStep(1);
      setValidationMessage(
        "That time is no longer available. Please choose another slot.",
      );
      return;
    }

    onConfirm({
      doctorId: doctor.id,
      consultationType,
      dateKey,
      time,
      reason,
      notes,
    });
  };

  return (
    <section aria-labelledby="book-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[11px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
        >
          <ArrowLeft size={14} /> Back to Appointments
        </button>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#CFE9E5] bg-white px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#0A9189]">
          Demo booking
        </span>
      </div>

      <div className="mt-1.5">
        <h1
          id="book-heading"
          className="text-[23px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[27px]"
        >
          Book New Appointment
        </h1>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B7C] sm:text-[12.5px]">
          {doctor
            ? `Schedule your visit with ${doctor.name} — all in one place.`
            : "Choose a doctor from My Doctors, then schedule your visit — all in one place."}
        </p>
      </div>

      {!doctor ? (
        <DoctorGate
          invalid={invalidDoctor}
          onBack={onBack}
          onFindDoctor={onChangeDoctor}
        />
      ) : (
        <>
          <StepIndicator
            step={step}
            canContinue={canContinue}
            onSelect={(next) => goToStep(next)}
          />

          {validationMessage && (
            <p
              role="alert"
              className="mx-auto mt-2 max-w-xl rounded-lg bg-[#FFF6E5] px-3 py-2 text-center text-[10.5px] font-medium text-[#A86A08]"
            >
              {validationMessage}
            </p>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              {/* Selected doctor */}
              <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_12px_32px_-30px_rgba(15,45,74,0.45)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[14.5px] font-bold text-[#0F2D4A]">
                    Selected Doctor
                  </h2>
                  <button
                    type="button"
                    onClick={onChangeDoctor}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-[#BFE8E2] bg-[#F0FCFA] px-2.5 text-[9.5px] font-semibold text-[#0A9189] transition hover:bg-[#E1F9F4]"
                  >
                    Change Doctor
                  </button>
                </div>

                <div className="mt-3 flex items-start gap-3.5">
                  <DoctorPortrait
                    name={doctor.name}
                    photoUrl={doctor.photoUrl}
                    size={92}
                    className="bg-[#EAF2F2]"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[16px] font-bold tracking-[-0.01em] text-[#0F2D4A]">
                      {doctor.name}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-[#5B6B7C]">
                      {doctor.specialty} Specialist
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#5B6B7C]">
                      <span className="inline-flex items-center gap-1">
                        <Star size={11} className="fill-[#F5A623] text-[#F5A623]" />
                        <span className="font-semibold text-[#0F2D4A]">
                          {doctor.rating.toFixed(1)}
                        </span>
                        <span className="text-[#8A99A8]">({doctor.reviews})</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} className="text-[#9AA9B8]" />
                        {doctor.years}+ years experience
                      </span>
                    </div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-[9.5px] leading-snug text-[#8A99A8]">
                      <MapPin size={11} className="mt-[1px] shrink-0" />
                      <span>
                        {doctor.clinic}
                        <span className="block">{doctor.city}, Egypt</span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {step === 1 && (
                <motion.div
                  key="step-doctor-time"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={STEP_TRANSITION}
                >
                  <div className="mt-4">
                    <h2 className="text-[14.5px] font-bold text-[#0F2D4A]">
                      1. Choose Consultation Type
                    </h2>
                    <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                      <ConsultationCard
                        active={consultationType === "In-Person"}
                        enabled={typeSupported("In-Person")}
                        icon={Building2}
                        title="In-Person Visit"
                        hint="At the clinic"
                        onSelect={() => chooseType("In-Person")}
                      />
                      <ConsultationCard
                        active={consultationType === "Online"}
                        enabled={typeSupported("Online")}
                        icon={Video}
                        title="Online Consultation"
                        hint="Video call"
                        onSelect={() => chooseType("Online")}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <h2 className="text-[14.5px] font-bold text-[#0F2D4A]">
                      2. Select Date &amp; Time
                    </h2>

                    <div className="mt-2 rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_12px_32px_-30px_rgba(15,45,74,0.45)] sm:p-4">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
                        <div className="rounded-xl border border-[#EEF4F4] p-2">
                          <Calendar
                            month={month}
                            onMonthChange={setMonth}
                            selected={dateKey}
                            onSelect={chooseDate}
                            minDate={today}
                            isDateDisabled={(date) =>
                              doctorWorksOn(doctor, date, consultationType)
                                ? false
                                : true
                            }
                            compact
                          />
                          <p className="mt-1.5 px-1 text-center text-[8.5px] leading-relaxed text-[#9AA9B8]">
                            {consultationType === "Online"
                              ? "Days with clinic or video hours are selectable."
                              : "Days this doctor works at the clinic are selectable."}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10.5px] font-semibold text-[#0F2D4A]">
                              Available Time Slots
                            </p>
                            {dateKey && (
                              <span className="text-[8.5px] text-[#8A99A8]">
                                {slots.filter((item) => item.available).length} available
                              </span>
                            )}
                          </div>

                          {dateKey && (
                            <p className="mt-0.5 truncate text-[9px] text-[#8A99A8]">
                              {formatLongDate(dateFromKey(dateKey))}
                            </p>
                          )}

                          {!dateKey ? (
                            <div className="mt-2 rounded-lg border border-dashed border-[#E1ECEB] bg-[#FBFDFD] px-2.5 py-6 text-center">
                              <CalendarDays
                                size={16}
                                className="mx-auto text-[#B9C6CC]"
                              />
                              <p className="mt-1 text-[9.5px] leading-relaxed text-[#8A99A8]">
                                Select a date to see available times.
                              </p>
                            </div>
                          ) : slots.length === 0 || slots.every((item) => !item.available) ? (
                            <div className="mt-2 rounded-lg bg-[#FFF8EC] px-2.5 py-5 text-center">
                              <p className="text-[9.5px] leading-relaxed text-[#A86A08]">
                                No available times on this date. Please choose another day.
                              </p>
                            </div>
                          ) : (
                            <div className="mt-2 grid max-h-[286px] grid-cols-3 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
                              {slots.map((slot) => {
                                const active = time === slot.time;
                                return (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    disabled={!slot.available}
                                    onClick={() => {
                                      setTime(slot.time);
                                      setValidationMessage(null);
                                    }}
                                    aria-pressed={active}
                                    className={cn(
                                      "h-9 rounded-lg border text-[9.5px] font-semibold transition",
                                      active
                                        ? "border-[#0A9189] bg-[#0A9189] text-white shadow-[0_6px_14px_-8px_rgba(10,145,137,0.9)]"
                                        : slot.available
                                          ? "border-[#E6EFEE] bg-white text-[#33475B] hover:border-[#BFE8E2] hover:bg-[#F1FBFA] hover:text-[#0A9189]"
                                          : "cursor-not-allowed border-[#EEF4F4] bg-[#F8FBFA] text-[#C4D0D6] line-through",
                                    )}
                                  >
                                    {formatSlotTime(slot.time)}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-[#E6EFEE] bg-white p-3.5">
                    <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#0F2D4A]">
                      <Lightbulb size={14} className="text-[#0A9189]" />
                      Preparation Tips
                    </p>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {tips.map((tip) => (
                        <li
                          key={tip}
                          className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[#5B6B7C]"
                        >
                          <Check size={10} className="mt-[2px] shrink-0 text-[#0A9189]" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[9px] leading-relaxed text-[#9AA9B8]">
                      Selecting a slot does not confirm it — continue to review first.
                    </p>
                    <PrimaryButton disabled={!canContinue} onClick={() => goToStep(2)}>
                      Continue to Details
                      <ArrowRight size={14} />
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step-details"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={STEP_TRANSITION}
                >
                  <div className="mt-4 rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_12px_32px_-30px_rgba(15,45,74,0.45)]">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
                        <Info size={15} />
                      </span>
                      <div>
                        <h2 className="text-[14px] font-bold text-[#0F2D4A]">
                          Appointment Details{" "}
                          <span className="text-[10px] font-normal text-[#9AA9B8]">
                            (Optional)
                          </span>
                        </h2>
                        <p className="text-[9.5px] text-[#8A99A8]">
                          Share anything that would help your doctor prepare.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#D7F1EC] bg-[#F4FCFA] px-2.5 py-2 text-[9.5px] text-[#33475B]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#0F2D4A]">
                        <Stethoscope size={11} className="text-[#0A9189]" />
                        {doctor.name}
                      </span>
                      <span>
                        {dateKey ? formatLongDate(dateFromKey(dateKey)) : "—"}
                      </span>
                      <span>{time ? formatSlotTime(time) : ""}</span>
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="ml-auto text-[9px] font-semibold text-[#0A9189] hover:underline"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-[#33475B]">
                          Reason for Visit
                        </span>
                        <div className="relative">
                          <select
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            className="h-10 w-full appearance-none rounded-xl border border-[#E6EFEE] bg-white px-3 pr-8 text-[11px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
                          >
                            <option value="">Select a reason</option>
                            {REASONS_FOR_VISIT.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={13}
                            aria-hidden
                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A99A8]"
                          />
                        </div>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-[#33475B]">
                          Additional Notes
                        </span>
                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value.slice(0, 500))}
                          rows={4}
                          maxLength={500}
                          placeholder="Share any specific details with the doctor..."
                          className="w-full resize-none rounded-xl border border-[#E6EFEE] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
                        />
                        <span className="mt-0.5 block text-right text-[9px] text-[#9AA9B8]">
                          {notes.length}/500
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <SecondaryButton onClick={() => goToStep(1)}>
                      <ArrowLeft size={13} /> Back to Doctor &amp; Time
                    </SecondaryButton>
                    <PrimaryButton onClick={() => goToStep(3)}>
                      Continue to Review
                      <ArrowRight size={14} />
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step-review"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={STEP_TRANSITION}
                >
                  <div className="mt-4 rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_12px_32px_-30px_rgba(15,45,74,0.45)]">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
                        <ClipboardCheck size={15} />
                      </span>
                      <div>
                        <h2 className="text-[14px] font-bold text-[#0F2D4A]">
                          Review Your Appointment
                        </h2>
                        <p className="text-[9.5px] text-[#8A99A8]">
                          Check the details below before confirming.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[#E6EFEE] bg-[#FBFDFD] p-2.5">
                      <DoctorPortrait
                        name={doctor.name}
                        photoUrl={doctor.photoUrl}
                        size={42}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[11.5px] font-semibold text-[#0F2D4A]">
                          {doctor.name}
                        </p>
                        <p className="truncate text-[9.5px] text-[#8A99A8]">
                          {doctor.title}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-2 divide-y divide-[#EEF4F4]">
                      <ReviewRow label="Specialty" value={doctor.specialty} />
                      <ReviewRow
                        label="Consultation Type"
                        value={
                          consultationType === "Online"
                            ? "Online Consultation"
                            : "In-Person Visit"
                        }
                      />
                      <ReviewRow
                        label="Date"
                        value={dateKey ? formatLongDate(dateFromKey(dateKey)) : "—"}
                      />
                      <ReviewRow
                        label="Time"
                        value={time ? formatSlotTime(time) : "—"}
                      />
                      <ReviewRow
                        label="Location"
                        value={
                          consultationType === "Online"
                            ? "Secure online consultation — a video link would be shared after confirmation."
                            : `${doctor.clinic}, ${doctor.address}`
                        }
                      />
                      <ReviewRow label="Reason for Visit" value={reason || "Not provided"} />
                      <ReviewRow label="Additional Notes" value={notes || "Not provided"} />
                    </dl>

                    <div className="mt-3 rounded-xl bg-[#F4FCFA] px-3 py-2 text-[9px] leading-relaxed text-[#5B6B7C]">
                      Demo confirmation only. No real clinic booking is created, and no
                      payment is taken. Upcoming appointments can be rescheduled or cancelled
                      from this module.
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <SecondaryButton onClick={() => goToStep(2)}>
                      <ArrowLeft size={13} /> Back to Details
                    </SecondaryButton>
                    <PrimaryButton onClick={handleConfirm}>
                      <CheckCircle2 size={14} />
                      Confirm Appointment
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Booking summary */}
            <aside className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
              <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_12px_32px_-30px_rgba(15,45,74,0.45)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-[#0F2D4A]">Booking Summary</h2>
                  <span className="rounded-full bg-[#EAFBF8] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#0A9189]">
                    Demo
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#F4FCFA] p-2.5">
                  <DoctorPortrait
                    name={doctor.name}
                    photoUrl={doctor.photoUrl}
                    size={42}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-[#0F2D4A]">
                      {doctor.name}
                    </p>
                    <p className="truncate text-[9px] text-[#8A99A8]">
                      {doctor.specialty} Specialist
                    </p>
                  </div>
                </div>

                <dl className="mt-3 space-y-2.5">
                  <SummaryRow
                    icon={consultationType === "Online" ? Video : Building2}
                    label="Consultation Type"
                    value={
                      consultationType === "Online"
                        ? "Online Consultation"
                        : "In-Person Visit"
                    }
                  />
                  <SummaryRow
                    icon={CalendarDays}
                    label="Date"
                    value={
                      dateKey ? formatLongDate(dateFromKey(dateKey)) : "Select a date"
                    }
                    muted={!dateKey}
                  />
                  <SummaryRow
                    icon={Clock}
                    label="Time"
                    value={time ? formatSlotTime(time) : "Select a time"}
                    muted={!time}
                  />
                  <SummaryRow
                    icon={MapPin}
                    label="Location"
                    value={
                      consultationType === "Online"
                        ? "Secure video consultation"
                        : doctor.clinic
                    }
                    hint={
                      consultationType === "Online"
                        ? "Link shared after confirmation"
                        : doctor.address
                    }
                  />
                </dl>

                <div className="mt-3 border-t border-[#EEF4F4] pt-2.5">
                  <p className="flex items-center gap-1.5 text-[9.5px] font-semibold text-[#0F2D4A]">
                    <Lightbulb size={11} className="text-[#0A9189]" />
                    Preparation
                  </p>
                  <p className="mt-1 text-[8.5px] leading-relaxed text-[#8A99A8]">
                    {tips.slice(0, 2).join(" · ")}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
                    <Info size={14} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-[#0F2D4A]">
                      Need to Reschedule?
                    </p>
                    <p className="mt-0.5 text-[9px] leading-relaxed text-[#5B6B7C]">
                      You can reschedule or cancel anytime from your appointments.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onBack}
                  className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E6EFEE] bg-white text-[10px] font-semibold text-[#33475B] transition hover:border-[#BFE8E2] hover:bg-[#F7FAFA] hover:text-[#0A9189]"
                >
                  View My Appointments
                </button>
              </div>

              <p className="px-1 text-center text-[8.5px] leading-relaxed text-[#9AA9B8]">
                Demo booking — no real appointment is created and no payment is taken.
              </p>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function StepIndicator({
  step,
  canContinue,
  onSelect,
}: {
  step: Step;
  canContinue: boolean;
  onSelect: (step: Step) => void;
}) {
  return (
    <div className="mt-4 flex justify-center">
      <ol className="flex w-full max-w-[560px] items-center">
        {STEP_ITEMS.map((item, index) => {
          const done = step > item.number;
          const active = step === item.number;
          const reachable = item.number === 1 || canContinue;
          return (
            <li key={item.number} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => onSelect(item.number)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5",
                  reachable ? "cursor-pointer" : "cursor-not-allowed",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-[10.5px] font-bold transition",
                    active
                      ? "bg-[#0A9189] text-white shadow-[0_4px_10px_-4px_rgba(10,145,137,0.8)]"
                      : done
                        ? "bg-[#D7F4EF] text-[#0A9189]"
                        : "bg-[#EDF3F3] text-[#9AA9B8]",
                  )}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : item.number}
                </span>
                <span
                  className={cn(
                    "text-[10.5px] font-semibold transition-colors sm:text-[11px]",
                    active
                      ? "text-[#0A9189]"
                      : done
                        ? "text-[#33475B]"
                        : "text-[#9AA9B8]",
                  )}
                >
                  {item.label}
                </span>
              </button>
              {index < STEP_ITEMS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 h-[2px] flex-1 rounded-full transition-colors sm:mx-3",
                    step > item.number ? "bg-[#9EE0D7]" : "bg-[#E6EFEE]",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ConsultationCard({
  active,
  enabled,
  icon: Icon,
  title,
  hint,
  onSelect,
}: {
  active: boolean;
  enabled: boolean;
  icon: LucideIcon;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onSelect}
      aria-pressed={active}
      title={enabled ? undefined : "This doctor does not offer this consultation type."}
      className={cn(
        "relative flex items-center gap-3 rounded-xl border p-3 text-left transition",
        active
          ? "border-[#0A9189] bg-[#F0FCFA] ring-1 ring-[#0A9189]/25"
          : enabled
            ? "border-[#E6EFEE] bg-white hover:border-[#BFE8E2] hover:bg-[#FBFDFD]"
            : "cursor-not-allowed border-[#EEF4F4] bg-[#F8FBFA] opacity-70",
      )}
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
          active
            ? "bg-white text-[#0A9189]"
            : enabled
              ? "bg-[#F1F7F7] text-[#5B6B7C]"
              : "bg-[#F1F5F5] text-[#B9C6CC]",
        )}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[11.5px] font-semibold",
            active ? "text-[#0A9189]" : enabled ? "text-[#0F2D4A]" : "text-[#9AA9B8]",
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[9px] text-[#8A99A8]">
          {enabled ? hint : "Not offered by this doctor"}
        </span>
      </span>
      {active && (
        <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-[#0A9189] text-white">
          <Check size={9} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0A9189] to-[#14B8A6] px-4 text-[11.5px] font-semibold text-white shadow-[0_14px_26px_-16px_rgba(10,145,137,0.85)] transition hover:from-[#087F78] hover:to-[#0FA79A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189] disabled:cursor-not-allowed disabled:from-[#DCEBE9] disabled:to-[#DCEBE9] disabled:text-[#8FAFAB] disabled:shadow-none sm:w-auto"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E6EFEE] bg-white px-3.5 text-[11px] font-semibold text-[#33475B] transition hover:bg-[#F7FAFA] sm:w-auto"
    >
      {children}
    </button>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  hint,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={13} className="mt-[1px] shrink-0 text-[#8A99A8]" />
      <div className="min-w-0 flex-1">
        <dt className="text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#9AA9B8]">
          {label}
        </dt>
        <dd
          className={cn(
            "mt-0.5 text-[10px] font-medium leading-snug",
            muted ? "text-[#9AA9B8]" : "text-[#33475B]",
          )}
        >
          {value}
        </dd>
        {hint && <p className="mt-0.5 text-[8.5px] leading-snug text-[#9AA9B8]">{hint}</p>}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[10.5px]">
      <dt className="shrink-0 text-[#8A99A8]">{label}</dt>
      <dd className="min-w-0 text-right font-medium leading-relaxed text-[#33475B]">
        {value}
      </dd>
    </div>
  );
}

function DoctorGate({
  invalid,
  onBack,
  onFindDoctor,
}: {
  invalid: boolean;
  onBack: () => void;
  onFindDoctor: () => void;
}) {
  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-[#E6EFEE] bg-white px-5 py-10 text-center shadow-[0_16px_40px_-38px_rgba(15,45,74,0.5)]">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
        {invalid ? <Info size={21} /> : <Search size={20} />}
      </span>
      <h2 className="mt-3 text-[16px] font-semibold text-[#0F2D4A]">
        {invalid ? "Doctor not available" : "Choose a doctor first"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-[10.5px] leading-relaxed text-[#5B6B7C]">
        {invalid
          ? "The selected doctor is not part of the current demo roster. Please choose an available doctor from My Doctors."
          : "New appointments start from My Doctors. Choose a department or search for a doctor, then press Book Appointment on the profile."}
      </p>
      <div className="mt-4 flex flex-col-reverse justify-center gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E6EFEE] bg-white px-3.5 text-[11px] font-semibold text-[#33475B] transition hover:bg-[#F7FAFA]"
        >
          <ArrowLeft size={13} /> Back to Appointments
        </button>
        <button
          type="button"
          onClick={onFindDoctor}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#0A9189] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#087F78]"
        >
          <Stethoscope size={13} /> Find a Doctor
        </button>
      </div>
    </div>
  );
}

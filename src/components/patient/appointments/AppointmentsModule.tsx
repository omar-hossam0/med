"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, CheckCircle2, X } from "lucide-react";
import {
  buildAppointments,
  combineDateAndTime,
  formatLongDate,
  formatTime,
  getDoctor,
  isSlotAvailable,
  nextReference,
  type Appointment,
  type BookingDraft,
} from "@/lib/mock/appointments";
import { AppointmentsList } from "./AppointmentsList";
import { AppointmentDetailsView } from "./AppointmentDetailsView";
import { BookingView } from "./BookingView";
import { BookingSuccessModal } from "./BookingSuccessModal";
import { CancelModal } from "./CancelModal";
import { RescheduleModal } from "./RescheduleModal";
import { STEP_TRANSITION } from "@/components/transitions/stepper";

type View = "list" | "book" | "details";

/**
 * Client orchestrator for the Patient Appointments module.
 *
 * All views and overlays live inside /patient/appointments; the sidebar/topbar
 * shell is never remounted. Bookings, reschedules and cancellations are kept in
 * React state only — nothing is sent to a backend.
 */
export function AppointmentsModule() {
  const reduce = useReducedMotion();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookDoctorId, setBookDoctorId] = useState<string | undefined>(undefined);
  const [bookingKey, setBookingKey] = useState(0);

  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const appointmentsRef = useRef<Appointment[]>(appointments);
  appointmentsRef.current = appointments;

  /* ---------------- Boot: client-only dates + history ---------------- */
  useEffect(() => {
    const nowDate = new Date();
    const initial = buildAppointments(nowDate);

    setNow(nowDate);
    setAppointments(initial);
    appointmentsRef.current = initial;

    const applyFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nextView = params.get("view");

      if (nextView === "book") {
        setBookDoctorId(
          params.get("doctor") ?? params.get("doctorId") ?? undefined,
        );
        setView("book");
      } else if (nextView === "details") {
        const id = params.get("id");
        if (id && appointmentsRef.current.some((item) => item.id === id)) {
          setSelectedId(id);
          setView("details");
        } else {
          setView("list");
        }
      } else {
        setView("list");
      }

      setRescheduleId(null);
      setCancelId(null);
      setSuccessId(null);
    };

    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    setReady(true);

    return () => window.removeEventListener("popstate", applyFromUrl);
  }, []);

  /* ---------------- Feedback toast ---------------- */
  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ---------------- Navigation ---------------- */
  const navigate = useCallback(
    (next: View, options: { id?: string; doctorId?: string } = {}) => {
      if (next === "book") {
        setBookDoctorId(options.doctorId);
        setBookingKey((key) => key + 1);
      }
      if (next === "details" && options.id) {
        setSelectedId(options.id);
      }

      setView(next);
      setRescheduleId(null);
      setCancelId(null);

      const params = new URLSearchParams();
      if (next === "book") {
        params.set("view", "book");
        if (options.doctorId) params.set("doctor", options.doctorId);
      } else if (next === "details" && options.id) {
        params.set("view", "details");
        params.set("id", options.id);
      }

      const query = params.toString();
      window.history.pushState(
        { view: next },
        "",
        query ? `?${query}` : window.location.pathname,
      );
    },
    [],
  );

  const backToList = useCallback(() => navigate("list"), [navigate]);

  // Internal views are long; start each one at the top of the page.
  useEffect(() => {
    if (!ready) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view, ready]);

  /* ---------------- Derived data ---------------- */
  const today = useMemo(() => now ?? new Date(), [now]);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === selectedId) ?? null,
    [appointments, selectedId],
  );

  const rescheduleTarget = useMemo(
    () => appointments.find((item) => item.id === rescheduleId) ?? null,
    [appointments, rescheduleId],
  );

  const cancelTarget = useMemo(
    () => appointments.find((item) => item.id === cancelId) ?? null,
    [appointments, cancelId],
  );

  const successTarget = useMemo(
    () => appointments.find((item) => item.id === successId) ?? null,
    [appointments, successId],
  );

  /* ---------------- Eligibility guards ---------------- */
  const openReschedule = (id: string) => {
    const target = appointments.find((item) => item.id === id);
    if (!target || target.status !== "Upcoming") {
      showToast("Only upcoming appointments can be rescheduled.");
      return;
    }
    setRescheduleId(id);
  };

  const openCancel = (id: string) => {
    const target = appointments.find((item) => item.id === id);
    if (!target || target.status !== "Upcoming") {
      showToast("Only upcoming appointments can be cancelled.");
      return;
    }
    setCancelId(id);
  };

  /* ---------------- Demo mutations ---------------- */
  const handleBook = (draft: BookingDraft) => {
    if (!now) return;

    const doctor = getDoctor(draft.doctorId);
    if (!doctor) {
      showToast("Select a doctor before confirming your booking.");
      return;
    }

    const available = isSlotAvailable({
      doctor,
      dateKey: draft.dateKey,
      time: draft.time,
      consultationType: draft.consultationType,
      appointments,
      now: new Date(),
    });

    if (!available) {
      showToast("That time is no longer available. Please choose another slot.");
      return;
    }

    const appointment: Appointment = {
      id: `apt-${Date.now().toString(36)}`,
      reference: nextReference(appointments, now),
      doctorId: draft.doctorId,
      startsAt: combineDateAndTime(draft.dateKey, draft.time),
      durationMinutes: 30,
      consultationType: draft.consultationType,
      status: "Upcoming",
      reason: draft.reason || undefined,
      notes: draft.notes || undefined,
    };

    setAppointments((current) => [appointment, ...current]);
    setSuccessId(appointment.id);
  };

  const handleReschedule = (dateKey: string, time: string) => {
    if (!rescheduleTarget) return;

    const doctor = getDoctor(rescheduleTarget.doctorId);
    if (!doctor) return;

    const available = isSlotAvailable({
      doctor,
      dateKey,
      time,
      consultationType: rescheduleTarget.consultationType,
      appointments,
      now: new Date(),
      ignoreAppointmentId: rescheduleTarget.id,
    });

    if (!available) {
      showToast("That time is no longer available. Please choose another slot.");
      return;
    }

    const startsAt = combineDateAndTime(dateKey, time);
    setAppointments((current) =>
      current.map((item) =>
        item.id === rescheduleTarget.id ? { ...item, startsAt } : item,
      ),
    );
    setRescheduleId(null);
    showToast(
      `Appointment rescheduled to ${formatLongDate(startsAt)} at ${formatTime(
        time,
      )} (demo).`,
    );
  };

  const handleCancel = (reason: string, notes: string) => {
    if (!cancelTarget) return;
    if (cancelTarget.status !== "Upcoming") {
      setCancelId(null);
      showToast("This appointment can no longer be cancelled.");
      return;
    }

    const detail = [reason, notes].filter(Boolean).join(" — ");
    setAppointments((current) =>
      current.map((item) =>
        item.id === cancelTarget.id
          ? {
              ...item,
              status: "Cancelled",
              cancellationReason: detail || "Cancelled by patient",
            }
          : item,
      ),
    );
    setCancelId(null);
    showToast("Appointment cancelled (demo). The clinic was not notified.");
  };

  const successViewAll = () => {
    setSuccessId(null);
    backToList();
  };

  const successBookAnother = () => {
    const doctorId = successTarget?.doctorId;
    setSuccessId(null);
    navigate("book", doctorId ? { doctorId } : {});
  };

  const changeDoctor = useCallback(() => {
    router.push("/patient/my-doctors");
  }, [router]);

  /* ---------------- Render ---------------- */
  if (!ready || !now) {
    return <AppointmentsSkeleton />;
  }

  const viewKey = view === "details" ? `details-${selectedId ?? "none"}` : view;

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={viewKey}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={reduce ? { duration: 0 } : STEP_TRANSITION}
        >
          {view === "list" && (
            <AppointmentsList
              appointments={appointments}
              today={today}
              onBook={() => navigate("book")}
              onView={(id) => navigate("details", { id })}
              onReschedule={openReschedule}
              onCancel={openCancel}
              onBookAgain={(doctorId) => navigate("book", { doctorId })}
            />
          )}

          {view === "book" && (
            <BookingView
              key={bookingKey}
              appointments={appointments}
              today={today}
              initialDoctorId={bookDoctorId}
              onBack={backToList}
              onChangeDoctor={changeDoctor}
              onConfirm={handleBook}
            />
          )}

          {view === "details" &&
            (selectedAppointment ? (
              <AppointmentDetailsView
                appointment={selectedAppointment}
                onBack={backToList}
                onReschedule={() => openReschedule(selectedAppointment.id)}
                onCancel={() => openCancel(selectedAppointment.id)}
                onBookAgain={(doctorId) => navigate("book", { doctorId })}
                onNotify={showToast}
              />
            ) : (
              <MissingAppointment onBack={backToList} />
            ))}
        </motion.div>
      </AnimatePresence>

      <RescheduleModal
        key={rescheduleId ?? "closed"}
        appointment={rescheduleTarget}
        appointments={appointments}
        today={today}
        onClose={() => setRescheduleId(null)}
        onConfirm={handleReschedule}
      />

      <CancelModal
        key={cancelId ?? "closed"}
        appointment={cancelTarget}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancel}
      />

      <BookingSuccessModal
        appointment={successTarget}
        onViewAll={successViewAll}
        onBookAnother={successBookAnother}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
            transition={reduce ? { duration: 0 } : STEP_TRANSITION}
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-[120] flex max-w-[330px] items-start gap-2.5 rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-pop"
          >
            <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
              <CheckCircle2 size={14} />
            </span>
            <p className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-[#33475B]">
              {toast}
            </p>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#9AA9B8] transition hover:bg-[#F1F7F7] hover:text-[#0F2D4A]"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MissingAppointment({ onBack }: { onBack: () => void }) {
  return (
    <section className="rounded-2xl border border-[#E6EFEE] bg-white px-5 py-14 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FFF6E5] text-[#C77A0A]">
        <ArrowLeft size={22} />
      </span>
      <h1 className="mt-3 text-[16px] font-semibold text-[#0F2D4A]">
        Appointment not found
      </h1>
      <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-[#5B6B7C]">
        This appointment may have been cancelled or is not available in the current demo
        session.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0A9189] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#087F78]"
      >
        <ArrowLeft size={13} /> Back to Appointments
      </button>
    </section>
  );
}

function AppointmentsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading appointments" className="animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-lg bg-[#E9F1F0]" />
          <div className="h-3 w-72 max-w-full rounded bg-[#EEF4F4]" />
        </div>
        <div className="h-10 w-40 rounded-xl bg-[#E3F3F0]" />
      </div>

      <div className="mt-4 flex gap-4 border-b border-[#E6EFEE] pb-2.5">
        {[40, 64, 72, 66].map((width) => (
          <div key={width} className="h-3 rounded bg-[#EEF4F4]" style={{ width }} />
        ))}
      </div>

      <div className="mt-3 h-10 rounded-xl bg-[#F1F7F7]" />

      <div className="mt-3 space-y-2.5">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex items-center gap-4 rounded-2xl border border-[#E6EFEE] bg-white p-4"
          >
            <div className="h-12 w-[52px] rounded-xl bg-[#F1F7F7]" />
            <div className="h-9 w-9 rounded-full bg-[#EEF4F4]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-36 rounded bg-[#EEF4F4]" />
              <div className="h-2.5 w-24 rounded bg-[#F4F8F8]" />
            </div>
            <div className="hidden h-8 w-28 rounded-lg bg-[#F4F8F8] sm:block" />
            <div className="h-8 w-24 rounded-lg bg-[#E3F3F0]" />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { useDoctorWorkspace } from "@/components/doctor/DoctorWorkspace";
import { DoctorCard } from "@/components/doctor/overview/OverviewSections";
import { PatientQuickProfile } from "@/components/doctor/overview/PatientQuickProfile";
import {
  getPortalPatient,
  isConsultationEligible,
  portalAppointments,
} from "@/lib/mock/doctorPortal";
import {
  STATUS_OPTIONS,
  VISIT_TYPE_OPTIONS,
  addDays,
  formatLongDate,
  formatShortDate,
  scheduleAppointments,
  todayISO,
  type ScheduleAppointment,
} from "@/lib/mock/doctorSchedule";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { ScheduleTable } from "./ScheduleTable";
import {
  ActiveFilterChips,
  EMPTY_FILTERS,
  FilterPanel,
  ScheduleToolbar,
  type ScheduleFilters,
} from "./ScheduleFilters";
import { AppointmentDetailsDialog } from "./AppointmentDetailsDialog";
import { RescheduleDialog } from "./RescheduleDialog";
import { RescheduleSuccessDialog } from "./RescheduleSuccessDialog";
import { cn } from "@/lib/cn";

type TabKey = "day" | "upcoming" | "completed" | "cancelled";

const TAB_LABELS: Record<TabKey, string> = {
  day: "Today",
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Ids the Consultation Workspace knows about (today's clinic list). */
const CONSULTATION_IDS = new Set(portalAppointments.map((appointment) => appointment.id));

export function DoctorSchedule() {
  const router = useRouter();
  const { startConsultation } = useDoctorWorkspace();

  const today = todayISO();
  const [appointments, setAppointments] = useState<ScheduleAppointment[]>(scheduleAppointments);
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTab] = useState<TabKey>("day");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleFrom, setRescheduleFrom] = useState<"details" | "row" | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; date: string; time: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const patientOf = useCallback((id: string) => getPortalPatient(id), []);

  /* ---------------------------------------------------------------- */
  /* Derived data                                                      */
  /* ---------------------------------------------------------------- */

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return appointments.filter((appointment) => {
      if (filters.visitTypes.length > 0 && !filters.visitTypes.includes(appointment.visitType)) {
        return false;
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(appointment.status)) {
        return false;
      }
      if (!query) return true;

      const patient = patientOf(appointment.patientId);
      return [patient?.name, patient?.mrn, appointment.visitType, appointment.reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [appointments, filters, search, patientOf]);

  const counts = useMemo(() => {
    const day = filtered.filter((appointment) => appointment.date === selectedDate).length;
    const upcoming = filtered.filter(
      (appointment) =>
        appointment.date > today &&
        appointment.status !== "Completed" &&
        appointment.status !== "Cancelled",
    ).length;
    const completed = filtered.filter((appointment) => appointment.status === "Completed").length;
    const cancelled = filtered.filter((appointment) => appointment.status === "Cancelled").length;
    return { day, upcoming, completed, cancelled } as Record<TabKey, number>;
  }, [filtered, selectedDate, today]);

  const visible = useMemo(() => {
    const rows = filtered.filter((appointment) => {
      if (tab === "day") return appointment.date === selectedDate;
      if (tab === "upcoming") {
        return (
          appointment.date > today &&
          appointment.status !== "Completed" &&
          appointment.status !== "Cancelled"
        );
      }
      if (tab === "completed") return appointment.status === "Completed";
      return appointment.status === "Cancelled";
    });

    return rows.sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
    );
  }, [filtered, tab, selectedDate, today]);

  const details = appointments.find((appointment) => appointment.id === detailsId) ?? null;
  const rescheduling = appointments.find((appointment) => appointment.id === rescheduleId) ?? null;
  const successAppointment = success
    ? appointments.find((appointment) => appointment.id === success.id)
    : undefined;

  const hasActiveFilters = filters.visitTypes.length > 0 || filters.statuses.length > 0 || Boolean(search);

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setSelectedDate(today);
  };

  const updateStatus = (id: string, status: ScheduleAppointment["status"], message: string) => {
    setAppointments((current) =>
      current.map((appointment) => (appointment.id === id ? { ...appointment, status } : appointment)),
    );
    setDetailsId(null);
    setToast(message);
  };

  const handleRescheduled = ({ date, time }: { date: string; time: string; reason: string }) => {
    if (!rescheduling) return;
    const id = rescheduling.id;
    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === id ? { ...appointment, date, time, status: "Upcoming" } : appointment,
      ),
    );
    setRescheduleId(null);
    setRescheduleFrom(null);
    setDetailsId(null);
    setSuccess({ id, date, time });
  };

  return (
    <div className="space-y-3">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[25px]">
            My Schedule
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#5B6B7C]">
            View and manage your appointments, check patient details, and take action.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E6EFEE] bg-white px-3 text-[11px] font-semibold text-[#0F2D4A]">
            <CalendarDays size={14} aria-hidden className="text-[#0A9189]" />
            {formatLongDate(selectedDate)}
          </span>
          <div className="flex items-center gap-0.5 rounded-full border border-[#E6EFEE] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setSelectedDate((current) => addDays(current, -1))}
              aria-label="Previous day"
              className="grid h-8 w-8 place-items-center rounded-full text-[#7A8CA0] transition hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((current) => addDays(current, 1))}
              aria-label="Next day"
              className="grid h-8 w-8 place-items-center rounded-full text-[#7A8CA0] transition hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="h-9 rounded-full bg-[#0A9189] px-4 text-[11px] font-semibold text-white transition hover:bg-[#087F78]"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[268px_minmax(0,1fr)]">
        <ScheduleCalendar value={selectedDate} onChange={setSelectedDate} />

        <DoctorCard className="min-w-0 p-3.5">
          <div className="relative">
            <ScheduleToolbar
              search={search}
              onSearch={setSearch}
              filters={filters}
              selectedDate={selectedDate}
              open={filtersOpen}
              onTogglePanel={() => setFiltersOpen((current) => !current)}
            />
            <FilterPanel
              open={filtersOpen}
              filters={filters}
              selectedDate={selectedDate}
              visitTypes={VISIT_TYPE_OPTIONS}
              statuses={STATUS_OPTIONS}
              onApply={setFilters}
              onClearAll={clearAll}
              onClose={() => setFiltersOpen(false)}
            />
          </div>

          {/* Tabs */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => {
              const active = tab === key;
              const label = key === "day" && selectedDate !== today ? formatShortDate(selectedDate) : TAB_LABELS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-pressed={active}
                  className={cn(
                    "relative inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[10.5px] font-semibold transition",
                    active
                      ? "border-[#0A9189] bg-white text-[#0A9189]"
                      : "border-[#E6EFEE] bg-white text-[#5B6B7C] hover:border-[#BFE8E2] hover:text-[#0F2D4A]",
                  )}
                >
                  {label} ({counts[key]})
                  {active ? (
                    <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#0A9189]" />
                  ) : null}
                </button>
              );
            })}

            {selected.length > 0 ? (
              <span className="ml-auto inline-flex items-center gap-2 text-[10px] font-medium text-[#5B6B7C]">
                {selected.length} selected
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="font-semibold text-[#0A9189] transition hover:underline"
                >
                  Clear
                </button>
              </span>
            ) : null}
          </div>

          {(filters.visitTypes.length > 0 ||
            filters.statuses.length > 0 ||
            selectedDate !== today) && (
            <div className="mt-2.5">
              <ActiveFilterChips
                filters={filters}
                selectedDate={selectedDate}
                onRemoveVisitType={(value) =>
                  setFilters((current) => ({
                    ...current,
                    visitTypes: current.visitTypes.filter((item) => item !== value),
                  }))
                }
                onRemoveStatus={(value) =>
                  setFilters((current) => ({
                    ...current,
                    statuses: current.statuses.filter((item) => item !== value),
                  }))
                }
                onResetDate={() => setSelectedDate(today)}
                onClearAll={clearAll}
              />
            </div>
          )}

          <div className="mt-3">
            {visible.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-[#E0ECEA] bg-[#FBFDFD] px-4 py-10 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#EFFAF7] text-[#0A9189]">
                  <SearchX size={18} aria-hidden />
                </span>
                <p className="mt-2.5 text-[12px] font-semibold text-[#0F2D4A]">
                  No appointments found
                </p>
                <p className="mt-1 max-w-[300px] text-[10.5px] leading-relaxed text-[#8A9AAA]">
                  {hasActiveFilters
                    ? "No appointments match the current search and filters."
                    : "There are no appointments for this date in the selected tab."}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="h-8 rounded-full border border-[#E6EFEE] bg-white px-3 text-[10.5px] font-semibold text-[#0F2D4A] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
                    >
                      Clear search &amp; filters
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(today);
                      setTab("day");
                    }}
                    className="h-8 rounded-full bg-[#0A9189] px-3 text-[10.5px] font-semibold text-white transition hover:bg-[#087F78]"
                  >
                    Go to today
                  </button>
                </div>
              </div>
            ) : (
              <ScheduleTable
                appointments={visible}
                selected={selected}
                onToggle={(id) =>
                  setSelected((current) =>
                    current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                  )
                }
                onToggleAll={() =>
                  setSelected((current) =>
                    current.length === visible.length ? [] : visible.map((item) => item.id),
                  )
                }
                onOpen={(appointment) => setDetailsId(appointment.id)}
                onReschedule={(appointment) => {
                  setRescheduleFrom("row");
                  setRescheduleId(appointment.id);
                }}
                menuId={menuId}
                onMenuChange={setMenuId}
                patientOf={patientOf}
                showDate={tab !== "day"}
              />
            )}
          </div>

          <p className="mt-3 text-[9px] text-[#9AA9B8]">
            Appointments, status changes and reschedules in this phase come from typed demo
            fixtures and stay in the browser session only.
          </p>
        </DoctorCard>
      </div>

      {/* Overlays */}
      <AppointmentDetailsDialog
        appointment={details}
        patient={details ? patientOf(details.patientId) : undefined}
        canStartConsultation={Boolean(
          details &&
            details.date === today &&
            CONSULTATION_IDS.has(details.id) &&
            isConsultationEligible(details),
        )}
        onClose={() => setDetailsId(null)}
        onStartConsultation={() => {
          if (!details) return;
          startConsultation(details.id);
          router.push(`/doctor/consultation/${details.id}`);
        }}
        onViewPatient={() => {
          if (!details) return;
          setPatientId(details.patientId);
          setDetailsId(null);
        }}
        onReschedule={() => {
          if (!details) return;
          setRescheduleFrom("details");
          setDetailsId(null);
          setRescheduleId(details.id);
        }}
        onMarkArrived={() => {
          if (!details) return;
          updateStatus(details.id, "Arrived", `${patientOf(details.patientId)?.name} marked as arrived (demo).`);
        }}
        onCancel={() => {
          if (!details) return;
          updateStatus(details.id, "Cancelled", "Appointment cancelled in this demo session.");
        }}
      />

      <RescheduleDialog
        appointment={rescheduling}
        patient={rescheduling ? patientOf(rescheduling.patientId) : undefined}
        onClose={() => {
          const id = rescheduleId;
          setRescheduleId(null);
          if (rescheduleFrom === "details" && id) setDetailsId(id);
          setRescheduleFrom(null);
        }}
        onConfirm={handleRescheduled}
      />

      <RescheduleSuccessDialog
        open={Boolean(success)}
        patientName={successAppointment ? patientOf(successAppointment.patientId)?.name ?? "" : ""}
        date={success?.date ?? today}
        time={success?.time ?? "09:00"}
        onBack={() => {
          if (success) {
            setSelectedDate(success.date);
            setTab("day");
          }
          setSuccess(null);
        }}
      />

      <PatientQuickProfile
        patientId={patientId}
        onClose={() => setPatientId(null)}
        onStartConsultation={(id) => {
          const appointment = appointments.find(
            (item) =>
              item.patientId === id &&
              item.date === today &&
              CONSULTATION_IDS.has(item.id) &&
              isConsultationEligible(item),
          );
          if (!appointment) {
            setPatientId(null);
            setToast("This patient has no eligible appointment today.");
            return;
          }
          setPatientId(null);
          startConsultation(appointment.id);
          router.push(`/doctor/consultation/${appointment.id}`);
        }}
        onOpenFullProfile={() => {
          setPatientId(null);
          setToast("The Patients module is coming in a later phase.");
        }}
        onReviewLabs={() => {
          setPatientId(null);
          setToast("The Doctor Lab Results module is coming in a later phase.");
        }}
      />

      {toast ? (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-[#0F2D4A] px-4 py-2 text-[11px] font-medium text-white shadow-[0_18px_40px_-20px_rgba(15,45,74,0.8)]"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

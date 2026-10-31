"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpDown,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MoreHorizontal,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  UserRound,
  Video,
  X,
} from "lucide-react";
import {
  addDays,
  dateParts,
  formatTimeRange,
  getDoctor,
  specialties,
  startOfDay,
  type Appointment,
  type AppointmentTab,
  type ConsultationType,
  type SortOption,
} from "@/lib/mock/appointments";
import { DoctorPortrait } from "../DoctorPortrait";
import { StatusBadge } from "../ui";
import { TAB_TRANSITION } from "@/components/transitions/tabs";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { cn } from "@/lib/cn";

type RangeFilter = "any" | "next30" | "last30" | "year";

type Filters = {
  specialty: string;
  type: "all" | ConsultationType;
  range: RangeFilter;
};

const EMPTY_FILTERS: Filters = { specialty: "all", type: "all", range: "any" };

const TABS: AppointmentTab[] = ["All", "Upcoming", "Completed", "Cancelled"];

const SORT_LABELS: Record<SortOption, string> = {
  nearest: "Nearest upcoming",
  newest: "Newest first",
  oldest: "Oldest first",
};

const RANGE_LABELS: Record<RangeFilter, string> = {
  any: "Any time",
  next30: "Next 30 days",
  last30: "Last 30 days",
  year: "This year",
};

export function AppointmentsList({
  appointments,
  today,
  onBook,
  onView,
  onReschedule,
  onCancel,
  onBookAgain,
}: {
  appointments: Appointment[];
  today: Date;
  onBook: () => void;
  onView: (id: string) => void;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  onBookAgain: (doctorId: string) => void;
}) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<AppointmentTab>("All");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOption>("nearest");
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState<"filters" | "sort" | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(
    () => ({
      All: appointments.length,
      Upcoming: appointments.filter((item) => item.status === "Upcoming").length,
      Completed: appointments.filter((item) => item.status === "Completed").length,
      Cancelled: appointments.filter((item) => item.status === "Cancelled").length,
    }),
    [appointments],
  );

  const activeFilterCount =
    (filters.specialty !== "all" ? 1 : 0) +
    (filters.type !== "all" ? 1 : 0) +
    (filters.range !== "any" ? 1 : 0);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const todayStart = startOfDay(today).getTime();

    const rows = appointments.filter((appointment) => {
      if (tab !== "All" && appointment.status !== tab) return false;

      const doctor = getDoctor(appointment.doctorId);
      if (filters.specialty !== "all" && doctor?.specialty !== filters.specialty) {
        return false;
      }
      if (filters.type !== "all" && appointment.consultationType !== filters.type) {
        return false;
      }

      const time = appointment.startsAt.getTime();
      if (filters.range === "next30" && (time < todayStart || time > addDays(today, 30).getTime())) {
        return false;
      }
      if (filters.range === "last30" && (time > todayStart || time < addDays(today, -30).getTime())) {
        return false;
      }
      if (
        filters.range === "year" &&
        appointment.startsAt.getFullYear() !== today.getFullYear()
      ) {
        return false;
      }

      if (query) {
        const haystack = [
          doctor?.name,
          doctor?.specialty,
          doctor?.clinic,
          doctor?.address,
          appointment.reference,
          appointment.reason,
          appointment.consultationType,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    return [...rows].sort((a, b) => {
      if (sort === "newest") return b.startsAt.getTime() - a.startsAt.getTime();
      if (sort === "oldest") return a.startsAt.getTime() - b.startsAt.getTime();

      const aUpcoming = a.startsAt.getTime() >= todayStart;
      const bUpcoming = b.startsAt.getTime() >= todayStart;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming
        ? a.startsAt.getTime() - b.startsAt.getTime()
        : b.startsAt.getTime() - a.startsAt.getTime();
    });
  }, [appointments, tab, search, filters, sort, today]);

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [tab, search, filters, sort]);

  useEffect(() => {
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panel]);

  useEffect(() => {
    if (!menuId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuId]);

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setSort("nearest");
  };

  const start = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, filtered.length);

  return (
    <section aria-labelledby="appointments-heading">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            id="appointments-heading"
            className="text-[23px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[25px]"
          >
            Appointments
          </h1>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-[#5B6B7C] sm:text-[12px]">
            Manage your appointments, book new ones, and stay on top of your healthcare
            journey.
          </p>
        </div>
        <button
          type="button"
          onClick={onBook}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#0A9189] px-4 text-[12px] font-semibold text-white shadow-[0_12px_24px_-14px_rgba(10,145,137,0.75)] transition hover:bg-[#087F78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
        >
          <CalendarPlus size={15} />
          Book New Appointment
        </button>
      </div>

      {/* Status tabs */}
      <div
        role="tablist"
        aria-label="Filter appointments by status"
        className="mt-4 flex gap-1 overflow-x-auto border-b border-[#E6EFEE] hide-scrollbar"
      >
        {TABS.map((item) => {
          const active = tab === item;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item)}
              className={cn(
                "relative shrink-0 px-3 pb-2.5 pt-2 text-[12px] font-medium transition-colors",
                active ? "text-[#0A9189]" : "text-[#5B6B7C] hover:text-[#0F2D4A]",
              )}
            >
              {item}{" "}
              <span className={cn("text-[10.5px]", active ? "text-[#0A9189]" : "text-[#9AA9B8]")}>
                ({counts[item]})
              </span>
              {active && (
                <motion.span
                  layoutId="appointments-tab-underline"
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#0A9189]"
                  transition={reduce ? { duration: 0 } : TAB_TRANSITION}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by doctor name, specialty, or location..."
            aria-label="Search appointments"
            className="h-10 w-full rounded-xl border border-[#E6EFEE] bg-white pl-10 pr-3 text-[12px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
          />
        </div>

        <div ref={panelRef} className="relative flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPanel((value) => (value === "filters" ? null : "filters"))}
            aria-expanded={panel === "filters"}
            aria-haspopup="dialog"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[11.5px] font-semibold transition",
              activeFilterCount > 0
                ? "border-[#0A9189]/40 bg-[#EAFBF8] text-[#0A9189]"
                : "border-[#E6EFEE] bg-white text-[#33475B] hover:bg-[#F7FAFA]",
            )}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#0A9189] px-1 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPanel((value) => (value === "sort" ? null : "sort"))}
            aria-expanded={panel === "sort"}
            aria-haspopup="menu"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E6EFEE] bg-white px-3.5 text-[11.5px] font-semibold text-[#33475B] transition hover:bg-[#F7FAFA]"
          >
            <ArrowUpDown size={14} />
            <span className="hidden sm:inline">Sort By</span>
            <ChevronDown
              size={13}
              className={cn("transition-transform", panel === "sort" && "rotate-180")}
            />
          </button>

          {panel && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setPanel(null)}
                aria-hidden
              />
              <div
                role={panel === "filters" ? "dialog" : "menu"}
                aria-label={panel === "filters" ? "Filter appointments" : "Sort appointments"}
                className="absolute left-0 right-auto top-full z-20 mt-2 w-[282px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#E6EFEE] bg-white p-3.5 shadow-pop sm:left-auto sm:right-0"
              >
                {panel === "filters" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-[#0F2D4A]">Filters</p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setFilters(EMPTY_FILTERS)}
                          className="text-[10.5px] font-semibold text-[#0A9189] hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A99A8]">
                        Specialty
                      </span>
                      <select
                        value={filters.specialty}
                        onChange={(event) =>
                          setFilters((current) => ({ ...current, specialty: event.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[11.5px] text-[#0F2D4A] outline-none focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
                      >
                        <option value="all">All specialties</option>
                        {specialties.map((specialty) => (
                          <option key={specialty} value={specialty}>
                            {specialty}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A99A8]">
                        Consultation type
                      </span>
                      <select
                        value={filters.type}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            type: event.target.value as Filters["type"],
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[11.5px] text-[#0F2D4A] outline-none focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
                      >
                        <option value="all">All types</option>
                        <option value="In-Person">In-Person Visit</option>
                        <option value="Online">Online Consultation</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A99A8]">
                        Date range
                      </span>
                      <select
                        value={filters.range}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            range: event.target.value as RangeFilter,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[11.5px] text-[#0F2D4A] outline-none focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
                      >
                        {(Object.keys(RANGE_LABELS) as RangeFilter[]).map((value) => (
                          <option key={value} value={value}>
                            {RANGE_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => setPanel(null)}
                      className="h-9 w-full rounded-lg bg-[#0A9189] text-[11.5px] font-semibold text-white transition hover:bg-[#087F78]"
                    >
                      Show results
                    </button>
                  </div>
                ) : (
                  <div role="none">
                    <p className="px-1 pb-1.5 text-[12px] font-semibold text-[#0F2D4A]">
                      Sort By
                    </p>
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={sort === value}
                        onClick={() => {
                          setSort(value);
                          setPanel(null);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[11.5px] transition",
                          sort === value
                            ? "bg-[#EAFBF8] font-semibold text-[#0A9189]"
                            : "text-[#33475B] hover:bg-[#F7FAFA]",
                        )}
                      >
                        {SORT_LABELS[value]}
                        {sort === value && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rows */}
      <RevealOnScroll y={14} className="mt-3 space-y-2.5">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-[#E6EFEE] bg-white px-5 py-12 text-center shadow-[0_8px_26px_-22px_rgba(15,45,74,0.28)]">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
              <CalendarX2 size={22} />
            </span>
            <p className="mt-3 text-[13.5px] font-semibold text-[#0F2D4A]">
              No appointments found
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-[#5B6B7C]">
              Try a different search term or clear the active filters to see all of your
              appointments.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E6EFEE] bg-white px-3.5 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-[#F7FAFA]"
            >
              <RotateCcw size={13} /> Clear filters
            </button>
          </div>
        ) : (
          visible.map((appointment) => {
            const doctor = getDoctor(appointment.doctorId);
            const parts = dateParts(appointment.startsAt);
            const isUpcoming = appointment.status === "Upcoming";
            const menuOpen = menuId === appointment.id;

            return (
              <article
                key={appointment.id}
                className="rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_8px_26px_-24px_rgba(15,45,74,0.3)] transition hover:border-[#CBE9E4] sm:p-4"
              >
                <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[54px_minmax(0,1.35fr)_150px_minmax(0,1fr)_auto_auto] xl:items-center xl:gap-4">
                  {/* Date + doctor */}
                  <div className="flex items-start gap-3 xl:contents">
                    <div className="grid w-[52px] shrink-0 place-items-center rounded-xl border border-[#E9F1F0] bg-[#FBFDFD] py-1.5">
                      <span className="text-[18px] font-bold leading-none text-[#0F2D4A]">
                        {parts.day}
                      </span>
                      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#0A9189]">
                        {parts.month}
                      </span>
                      <span className="text-[8px] text-[#9AA9B8]">{parts.year}</span>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <DoctorPortrait
                        name={doctor?.name ?? "Doctor"}
                        photoUrl={doctor?.photoUrl}
                        size={38}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-[#0F2D4A]">
                          {doctor?.name ?? "Unknown doctor"}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#5B6B7C]">
                          <Star size={10} className="fill-[#0A9189] text-[#0A9189]" />
                          <span className="font-semibold text-[#0F2D4A]">{doctor?.rating}</span>
                          <span className="text-[#9AA9B8]">({doctor?.reviews})</span>
                        </p>
                        <p className="truncate text-[9.5px] text-[#8A99A8]">
                          {doctor?.specialty}
                        </p>
                      </div>
                    </div>

                    <div className="xl:hidden">
                      <StatusBadge status={appointment.status} size="md" />
                    </div>
                  </div>

                  {/* Time + type/location */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:contents">
                    <div className="flex items-start gap-1.5">
                      <Clock size={13} className="mt-0.5 shrink-0 text-[#9AA9B8]" />
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-medium leading-snug text-[#33475B]">
                          {formatTimeRange(appointment.startsAt, appointment.durationMinutes)}
                        </p>
                        <p className="mt-0.5 text-[9px] text-[#9AA9B8]">Local clinic time</p>
                      </div>
                    </div>

                    <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAFBF8] px-2 py-0.5 text-[9.5px] font-semibold text-[#0A9189]">
                        {appointment.consultationType === "Online" ? (
                          <Video size={10} />
                        ) : (
                          <UserRound size={10} />
                        )}
                        {appointment.consultationType}
                      </span>
                      <p className="mt-1 flex items-center gap-1 truncate text-[9.5px] text-[#8A99A8]">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">
                          {appointment.consultationType === "Online"
                            ? "Online consultation"
                            : doctor?.clinic ?? "Medora Medical Center"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="hidden xl:block">
                    <StatusBadge status={appointment.status} size="md" />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                    {isUpcoming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onReschedule(appointment.id)}
                          className="hidden h-8 items-center rounded-lg border border-[#E6EFEE] bg-white px-2.5 text-[10.5px] font-semibold text-[#33475B] transition hover:border-[#BFE8E2] hover:bg-[#F7FCFB] min-[420px]:inline-flex"
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => onView(appointment.id)}
                          className="inline-flex h-8 items-center rounded-lg border border-[#0A9189]/35 bg-[#F2FBFA] px-2.5 text-[10.5px] font-semibold text-[#0A9189] transition hover:bg-[#E3F8F5]"
                        >
                          View Details
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onView(appointment.id)}
                        className="inline-flex h-8 items-center rounded-lg border border-[#0A9189]/35 bg-[#F2FBFA] px-2.5 text-[10.5px] font-semibold text-[#0A9189] transition hover:bg-[#E3F8F5]"
                      >
                        View Details
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuId(menuOpen ? null : appointment.id)}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-label={`More actions for ${doctor?.name ?? "appointment"}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#8A99A8] transition hover:bg-[#F1F7F7] hover:text-[#0F2D4A]"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {menuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuId(null)}
                            aria-hidden
                          />
                          <div
                            role="menu"
                            className="absolute bottom-full right-0 z-20 mb-1 w-48 overflow-hidden rounded-xl border border-[#E6EFEE] bg-white py-1 shadow-pop"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuId(null);
                                onView(appointment.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-[#33475B] transition hover:bg-[#F7FAFA]"
                            >
                              <CalendarDays size={13} className="text-[#8A99A8]" />
                              View Details
                            </button>

                            {!isUpcoming && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuId(null);
                                  onBookAgain(appointment.doctorId);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-[#33475B] transition hover:bg-[#F7FAFA]"
                              >
                                <RotateCcw size={13} className="text-[#8A99A8]" />
                                Book Again
                              </button>
                            )}

                            {isUpcoming && (
                              <>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuId(null);
                                    onReschedule(appointment.id);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-[#33475B] transition hover:bg-[#F7FAFA]"
                                >
                                  <RotateCcw size={13} className="text-[#8A99A8]" />
                                  Reschedule
                                </button>
                                <div className="my-1 border-t border-[#EEF4F4]" />
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMenuId(null);
                                    onCancel(appointment.id);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-medium text-[#E5484D] transition hover:bg-[#FDECEF]"
                                >
                                  <X size={13} />
                                  Cancel Appointment
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </RevealOnScroll>

      {/* Pagination */}
      <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[#E6EFEE] bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10.5px] text-[#8A99A8]">
          Showing {start} to {end} of {filtered.length} appointment
          {filtered.length === 1 ? "" : "s"}
        </p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="grid h-7 w-7 place-items-center rounded-lg border border-[#E6EFEE] text-[#5B6B7C] transition hover:bg-[#F7FAFA] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={13} />
          </button>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              aria-label={`Page ${pageNumber}`}
              aria-current={currentPage === pageNumber ? "page" : undefined}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-lg text-[10.5px] font-semibold transition",
                currentPage === pageNumber
                  ? "bg-[#0A9189] text-white"
                  : "border border-[#E6EFEE] text-[#5B6B7C] hover:bg-[#F7FAFA]",
              )}
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className="grid h-7 w-7 place-items-center rounded-lg border border-[#E6EFEE] text-[#5B6B7C] transition hover:bg-[#F7FAFA] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </section>
  );
}

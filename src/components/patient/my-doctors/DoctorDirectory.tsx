"use client";

import { useMemo } from "react";
import {
  Baby,
  Bone,
  Brain,
  ChevronDown,
  HeartPulse,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DEPARTMENTS,
  FEATURED_DEPARTMENT_IDS,
  LOCATIONS,
  departmentCount,
  doctors,
  worksOnDay,
  worksThisWeek,
  type Department,
  type DepartmentId,
  type DepartmentTone,
  type Doctor,
} from "@/lib/mock/doctors";
import { DoctorCard } from "./DoctorCard";
import { cn } from "@/lib/cn";

const DEPARTMENT_ICONS: Record<Department["icon"], LucideIcon> = {
  heart: HeartPulse,
  sparkles: Sparkles,
  baby: Baby,
  bone: Bone,
  plus: Plus,
  brain: Brain,
};

const TONES: Record<DepartmentTone, { bg: string; text: string }> = {
  rose: { bg: "bg-[#FFE9EE]", text: "text-[#E5486B]" },
  amber: { bg: "bg-[#FFF2DF]", text: "text-[#E29A2D]" },
  violet: { bg: "bg-[#F2EAFE]", text: "text-[#8B5CF6]" },
  blue: { bg: "bg-[#E8F0FF]", text: "text-[#3B6EF6]" },
  teal: { bg: "bg-[#E2F8F5]", text: "text-[#0A9189]" },
  indigo: { bg: "bg-[#EAEDFF]", text: "text-[#4C5BD4]" },
};

type AvailabilityFilter = "any" | "today" | "week";

export type DirectoryFilters = {
  location: string;
  consultation: "all" | "In-Person" | "Online";
  availability: AvailabilityFilter;
};

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = {
  location: "all",
  consultation: "all",
  availability: "any",
};

const CONSULTATION_OPTIONS = [
  { value: "all", label: "All consultation types" },
  { value: "In-Person", label: "In-Person Visit" },
  { value: "Online", label: "Online Consultation" },
] as const;

const AVAILABILITY_OPTIONS = [
  { value: "any", label: "Any availability" },
  { value: "today", label: "Works today" },
  { value: "week", label: "Works this week" },
] as const;

export function DoctorDirectory({
  department,
  showAllDepartments,
  favorites,
  query,
  filters,
  panelOpen,
  onQueryChange,
  onFiltersChange,
  onPanelOpenChange,
  onSelectDepartment,
  onToggleShowAllDepartments,
  onToggleFavorite,
  onViewDoctor,
}: {
  department: DepartmentId | null;
  showAllDepartments: boolean;
  favorites: Set<string>;
  query: string;
  filters: DirectoryFilters;
  panelOpen: boolean;
  onQueryChange: (value: string) => void;
  onFiltersChange: (next: DirectoryFilters) => void;
  onPanelOpenChange: (open: boolean) => void;
  onSelectDepartment: (id: DepartmentId | null) => void;
  onToggleShowAllDepartments: () => void;
  onToggleFavorite: (id: string) => void;
  onViewDoctor: (id: string) => void;
}) {
  const today = useMemo(() => new Date(), []);

  const activeDepartment = DEPARTMENTS.find((item) => item.id === department);
  const activeFilterCount =
    (filters.location !== "all" ? 1 : 0) +
    (filters.consultation !== "all" ? 1 : 0) +
    (filters.availability !== "any" ? 1 : 0);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleDoctors = useMemo(() => {
    return doctors.filter((doctor) => {
      if (department && doctor.departmentId !== department) return false;

      if (normalizedQuery) {
        const haystack = [
          doctor.name,
          doctor.title,
          doctor.specialty,
          doctor.department,
          doctor.clinic,
          doctor.city,
          ...doctor.services,
          ...doctor.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      if (filters.location !== "all" && doctor.city !== filters.location) return false;

      if (filters.consultation === "In-Person" && !doctor.supportsInPerson) return false;
      if (filters.consultation === "Online" && !doctor.supportsOnline) return false;

      if (filters.availability === "today" && !worksOnDay(doctor, today)) return false;
      if (filters.availability === "week" && !worksThisWeek(doctor, today)) return false;

      return true;
    });
  }, [department, normalizedQuery, filters, today]);

  const featuredDoctors = visibleDoctors.filter((doctor) => doctor.featured);
  const otherDoctors = visibleDoctors.filter((doctor) => !doctor.featured);

  const hasActiveSearch =
    normalizedQuery.length > 0 ||
    filters.location !== "all" ||
    filters.consultation !== "all" ||
    filters.availability !== "any";

  const resetFilters = () => {
    onQueryChange("");
    onFiltersChange(EMPTY_DIRECTORY_FILTERS);
  };

  const resetEverything = () => {
    resetFilters();
    onSelectDepartment(null);
  };

  const shownDepartments = showAllDepartments
    ? DEPARTMENTS
    : DEPARTMENTS.filter((item) => FEATURED_DEPARTMENT_IDS.includes(item.id));

  const resultTitle = department
    ? featuredDoctors.length
      ? `${activeDepartment?.name ?? "Department"} Specialists`
      : `${activeDepartment?.name ?? "Department"} Doctors`
    : normalizedQuery
      ? "Search Results"
      : "All Doctors";

  const otherTitle = department ? `Other ${activeDepartment?.name ?? ""} Doctors` : "";

  return (
    <section aria-labelledby="my-doctors-heading">
      <div>
        <h1
          id="my-doctors-heading"
          className="text-[23px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[25px]"
        >
          My Doctors
        </h1>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B7C] sm:text-[12px]">
          Find and connect with trusted doctors across all specialties.
        </p>
      </div>

      {/* Search + filters */}
      <div className="mt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search for doctors by name, specialty, or condition..."
              aria-label="Search for doctors by name, specialty, or condition"
              className="h-11 w-full rounded-xl border border-[#E6EFEE] bg-white pl-10 pr-9 text-[11.5px] text-[#0F2D4A] shadow-[0_10px_26px_-26px_rgba(15,45,74,0.4)] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear doctor search"
                className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[#9AA9B8] transition hover:bg-[#F1F7F7] hover:text-[#0F2D4A]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onPanelOpenChange(!panelOpen)}
            aria-expanded={panelOpen}
            aria-controls="doctor-filter-panel"
            className={cn(
              "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-[11.5px] font-semibold transition",
              panelOpen || activeFilterCount > 0
                ? "border-[#BFE8E2] bg-[#F0FCFA] text-[#0A9189]"
                : "border-[#E6EFEE] bg-white text-[#0F2D4A] hover:border-[#BFE8E2] hover:text-[#0A9189]",
            )}
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeFilterCount > 0 && (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#0A9189] px-1 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {panelOpen && (
          <div
            id="doctor-filter-panel"
            className="mt-2 rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_16px_36px_-32px_rgba(15,45,74,0.45)]"
          >
            <div className="grid gap-2.5 sm:grid-cols-3">
              <FilterSelect
                id="doctor-location"
                label="Location"
                value={filters.location}
                onChange={(value) =>
                  onFiltersChange({ ...filters, location: value })
                }
                options={[
                  { value: "all", label: "All locations" },
                  ...LOCATIONS.map((city) => ({ value: city, label: city })),
                ]}
              />
              <FilterSelect
                id="doctor-consultation"
                label="Consultation Type"
                value={filters.consultation}
                onChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    consultation: value as DirectoryFilters["consultation"],
                  })
                }
                options={[...CONSULTATION_OPTIONS]}
              />
              <FilterSelect
                id="doctor-availability"
                label="Availability"
                value={filters.availability}
                onChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    availability: value as AvailabilityFilter,
                  })
                }
                options={[...AVAILABILITY_OPTIONS]}
              />
            </div>

            <div className="mt-2.5 flex flex-col-reverse gap-2 border-t border-[#EDF3F3] pt-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[9.5px] leading-relaxed text-[#9AA9B8]">
                Availability filters use each doctor&rsquo;s demo weekly clinic hours.
              </p>
              <button
                type="button"
                onClick={resetEverything}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E6EFEE] px-3 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
              >
                <RotateCcw size={12} />
                Reset all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Departments */}
      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-[14px] font-bold tracking-[-0.01em] text-[#0F2D4A] sm:text-[15px]">
            Featured Departments
          </h2>
          <button
            type="button"
            onClick={onToggleShowAllDepartments}
            aria-expanded={showAllDepartments}
            className="shrink-0 text-[11px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
          >
            {showAllDepartments ? "Show Less" : "View All"}
          </button>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {shownDepartments.map((item) => {
            const Icon = DEPARTMENT_ICONS[item.icon];
            const tone = TONES[item.tone];
            const active = department === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectDepartment(active ? null : item.id)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-[100px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition",
                  active
                    ? "border-[#0A9189] bg-[#F0FCFA] ring-1 ring-[#0A9189]/25"
                    : "border-[#E6EFEE] bg-white hover:border-[#BFE8E2] hover:bg-[#FBFDFD]",
                )}
              >
                <span className={cn("grid h-10 w-10 place-items-center rounded-full", tone.bg, tone.text)}>
                  <Icon size={19} strokeWidth={2} />
                </span>
                <span
                  className={cn(
                    "text-[11.5px] font-bold tracking-[-0.01em]",
                    active ? "text-[#0A9189]" : "text-[#0F2D4A]",
                  )}
                >
                  {item.name}
                </span>
                <span className="text-[9.5px] text-[#8A99A8]">
                  {departmentCount(item.id)} Doctors
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {visibleDoctors.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#D9E7E5] bg-white px-5 py-12 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
            <Search size={20} />
          </span>
          <h2 className="mt-3 text-[14px] font-semibold text-[#0F2D4A]">
            No doctors match your search
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[10.5px] leading-relaxed text-[#5B6B7C]">
            Try a different name or specialty, or reset the department, search and
            filter selections.
          </p>
          <button
            type="button"
            onClick={resetEverything}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0A9189] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#087F78]"
          >
            <RotateCcw size={13} /> Reset filters
          </button>
        </div>
      ) : (
        <>
          <DoctorGroup
            title={resultTitle}
            doctors={featuredDoctors.length ? featuredDoctors : otherDoctors}
            department={department}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onViewDoctor={onViewDoctor}
            onViewAll={department ? () => onSelectDepartment(null) : undefined}
            onReset={!department && hasActiveSearch ? resetFilters : undefined}
            count={visibleDoctors.length}
          />

          {department && featuredDoctors.length > 0 && otherDoctors.length > 0 && (
            <DoctorGroup
              title={otherTitle}
              doctors={otherDoctors}
              department={department}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
              onViewDoctor={onViewDoctor}
              onViewAll={() => onSelectDepartment(null)}
            />
          )}
        </>
      )}
    </section>
  );
}

function DoctorGroup({
  title,
  doctors: groupDoctors,
  department,
  favorites,
  onToggleFavorite,
  onViewDoctor,
  onViewAll,
  onReset,
  count,
}: {
  title: string;
  doctors: Doctor[];
  department: DepartmentId | null;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onViewDoctor: (id: string) => void;
  onViewAll?: () => void;
  onReset?: () => void;
  count?: number;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-bold tracking-[-0.01em] text-[#0F2D4A] sm:text-[15px]">
            {title}
          </h2>
          <p className="mt-0.5 text-[9.5px] text-[#8A99A8]">
            {count ?? groupDoctors.length}{" "}
            {department ? "available in this department" : "doctors available"}
          </p>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 text-[11px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
          >
            View All
          </button>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 text-[11px] font-semibold text-[#0A9189] transition hover:text-[#087F78]"
          >
            Reset Filters
          </button>
        )}
      </div>

      <div className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groupDoctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            doctor={doctor}
            favorite={favorites.has(doctor.id)}
            onToggleFavorite={() => onToggleFavorite(doctor.id)}
            onView={() => onViewDoctor(doctor.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-[9.5px] font-semibold text-[#5B6B7C]">{label}</span>
      <span className="relative block">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full appearance-none rounded-lg border border-[#E6EFEE] bg-white pl-2.5 pr-8 text-[10.5px] font-medium text-[#0F2D4A] outline-none transition focus:border-[#0A9189]/40 focus:ring-4 focus:ring-[#0A9189]/10"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A99A8]"
        />
      </span>
    </label>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FEATURED_DEPARTMENT_IDS,
  getDoctor,
  type DepartmentId,
} from "@/lib/mock/doctors";
import {
  DoctorDirectory,
  EMPTY_DIRECTORY_FILTERS,
  type DirectoryFilters,
} from "./DoctorDirectory";
import { DoctorProfileView } from "./DoctorProfileView";

const DEFAULT_DEPARTMENT: DepartmentId = "cardiology";

/**
 * Client orchestrator for /patient/my-doctors.
 *
 * The directory and the public doctor profile share one mounted module, so
 * returning from a profile keeps the department, search and filter state.
 * The selected doctor is mirrored in the URL (`?doctor=<id>`) for deep links
 * and browser back/forward, matching the Appointments module's approach.
 */
export function MyDoctorsModule() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [department, setDepartment] = useState<DepartmentId | null>(DEFAULT_DEPARTMENT);
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_DIRECTORY_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  const applyFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("doctor");
    const doctor = getDoctor(id);

    if (doctor) {
      setDoctorId(doctor.id);
      setDepartment(doctor.departmentId);
      if (!FEATURED_DEPARTMENT_IDS.includes(doctor.departmentId)) {
        setShowAllDepartments(true);
      }
    } else {
      setDoctorId(null);
    }
  }, []);

  useEffect(() => {
    applyFromUrl();
    setReady(true);

    const onPopState = () => applyFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyFromUrl]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openDoctor = useCallback((id: string) => {
    const doctor = getDoctor(id);
    if (!doctor) return;

    setDoctorId(id);
    setDepartment(doctor.departmentId);
    window.history.pushState(
      { doctorId: id },
      "",
      `${window.location.pathname}?doctor=${encodeURIComponent(id)}`,
    );
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const backToDirectory = useCallback(() => {
    setDoctorId(null);
    window.history.pushState({}, "", window.location.pathname);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const bookDoctor = useCallback(
    (id: string) => {
      router.push(`/patient/appointments?view=book&doctor=${encodeURIComponent(id)}`);
    },
    [router],
  );

  const activeDoctor = useMemo(() => getDoctor(doctorId), [doctorId]);

  if (!ready) {
    return <MyDoctorsSkeleton />;
  }

  if (activeDoctor) {
    return (
      <DoctorProfileView
        key={activeDoctor.id}
        doctor={activeDoctor}
        favorite={favorites.has(activeDoctor.id)}
        onToggleFavorite={() => toggleFavorite(activeDoctor.id)}
        onBack={backToDirectory}
        onSelectDepartment={(id) => {
          setDepartment(id);
          setDoctorId(null);
          window.history.pushState({}, "", window.location.pathname);
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }}
        onBook={() => bookDoctor(activeDoctor.id)}
      />
    );
  }

  return (
    <DoctorDirectory
      department={department}
      showAllDepartments={showAllDepartments}
      favorites={favorites}
      query={query}
      filters={filters}
      panelOpen={panelOpen}
      onQueryChange={setQuery}
      onFiltersChange={setFilters}
      onPanelOpenChange={setPanelOpen}
      onSelectDepartment={(id) => setDepartment(id)}
      onToggleShowAllDepartments={() => setShowAllDepartments((current) => !current)}
      onToggleFavorite={toggleFavorite}
      onViewDoctor={openDoctor}
    />
  );
}

function MyDoctorsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading doctors" className="animate-pulse">
      <div className="h-7 w-44 rounded-lg bg-[#E9F1F0]" />
      <div className="mt-2 h-3 w-80 max-w-full rounded bg-[#EEF4F4]" />
      <div className="mt-5 h-11 rounded-2xl bg-white" />
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="h-[96px] rounded-2xl border border-[#E6EFEE] bg-white" />
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-[320px] rounded-2xl border border-[#E6EFEE] bg-white"
          />
        ))}
      </div>
    </div>
  );
}

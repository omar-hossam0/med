"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  adminApi,
  ApiError,
  type ReferenceDepartment,
  type ReferenceLocation,
  type ReferenceSpecialty,
} from "@/lib/api/admin";

/**
 * Database-backed vocabularies for the admin forms and filters.
 *
 * Specialties, departments and clinic locations live in PostgreSQL. Fetching
 * them once here means a select can never offer a value the API will reject,
 * and adding a department in the database makes it appear without a code change.
 *
 * Staff job titles are not a database entity (job_title is free text), so that
 * list stays in the form as a convenience.
 */
type ReferenceContextValue = {
  specialties: ReferenceSpecialty[];
  departments: ReferenceDepartment[];
  locations: ReferenceLocation[];
  clinicalDepartments: ReferenceDepartment[];
  supportDepartments: ReferenceDepartment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ReferenceContext = createContext<ReferenceContextValue | undefined>(undefined);

export function ReferenceDataProvider({ children }: { children: React.ReactNode }) {
  const [specialties, setSpecialties] = useState<ReferenceSpecialty[]>([]);
  const [departments, setDepartments] = useState<ReferenceDepartment[]>([]);
  const [locations, setLocations] = useState<ReferenceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getReferenceData();
      setSpecialties(data.specialties.filter((item) => item.is_active));
      setDepartments(data.departments.filter((item) => item.is_active));
      setLocations(data.locations);
      setError(null);
    } catch (err) {
      setSpecialties([]);
      setDepartments([]);
      setLocations([]);
      setError(
        err instanceof ApiError ? err.message : "Could not load reference data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ReferenceContextValue>(
    () => ({
      specialties,
      departments,
      locations,
      clinicalDepartments: departments.filter((item) => item.kind === "clinical"),
      supportDepartments: departments.filter((item) => item.kind === "support"),
      loading,
      error,
      refresh,
    }),
    [specialties, departments, locations, loading, error, refresh],
  );

  return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

export function useReferenceData() {
  const context = useContext(ReferenceContext);
  if (!context) {
    throw new Error("useReferenceData must be used within a ReferenceDataProvider");
  }
  return context;
}

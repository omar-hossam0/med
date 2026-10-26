"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type DirectoryTab = "all" | "doctor" | "staff";
export type DirectoryView = "grid" | "list";

export type DirectoryFilters = {
  search: string;
  department: string;
  role: string;
  verification: string;
  accountStatus: string;
  location: string;
};

export const DEFAULT_FILTERS: DirectoryFilters = {
  search: "",
  department: "All Departments",
  role: "All Roles",
  verification: "All Statuses",
  accountStatus: "All Statuses",
  location: "All Locations",
};

type DirectoryContextValue = {
  tab: DirectoryTab;
  setTab: (t: DirectoryTab) => void;
  view: DirectoryView;
  setView: (v: DirectoryView) => void;
  filters: DirectoryFilters;
  setFilter: (key: keyof DirectoryFilters, value: string) => void;
  clearFilters: () => void;
  page: number;
  setPage: (p: number) => void;
};

const DirectoryContext = createContext<DirectoryContextValue | null>(null);

/**
 * Holds directory UI state (tab, filters, view, page) in the route layout so
 * navigating to a member's detail page and back does not reset the directory.
 */
export function DirectoryProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTabState] = useState<DirectoryTab>("all");
  const [view, setView] = useState<DirectoryView>("grid");
  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const setTab = useCallback((t: DirectoryTab) => {
    setTabState(t);
    setPage(1);
  }, []);

  const setFilter = useCallback((key: keyof DirectoryFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const value = useMemo(
    () => ({ tab, setTab, view, setView, filters, setFilter, clearFilters, page, setPage }),
    [tab, setTab, view, filters, setFilter, clearFilters, page],
  );

  return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>;
}

export function useDirectory() {
  const ctx = useContext(DirectoryContext);
  if (!ctx) throw new Error("useDirectory must be used within a DirectoryProvider");
  return ctx;
}

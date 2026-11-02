"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/patient/medical-records/ui";
import {
  filterLabResults,
  getLabCounts,
  labResults,
  type LabStatusFilter,
} from "@/lib/mock/labResults";
import { LabResultsHeader, LabResultsSummary } from "./LabResultsChrome";
import {
  LabResultRow,
  LabResultsFilterBar,
  LabResultsListShell,
  LabRowSkeleton,
} from "./LabResultsList";

const RETURN_KEY = "medora.lab-results.return";
const SCROLL_KEY = "medora.lab-results.scroll";

export function LabResultsModule() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LabStatusFilter>("all");
  const [ready, setReady] = useState(false);

  const counts = useMemo(() => getLabCounts(), []);
  const visible = useMemo(
    () => filterLabResults(labResults, { search, status }),
    [search, status],
  );

  // Restore the list state so returning from a result lands where it left off.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearch = params.get("search");
    const urlStatus = params.get("status");

    if (urlSearch !== null || urlStatus !== null) {
      setSearch(urlSearch ?? "");
      if (urlStatus === "Normal" || urlStatus === "Abnormal") setStatus(urlStatus);
    } else {
      try {
        const stored = window.sessionStorage.getItem(RETURN_KEY);
        if (stored) {
          const saved = new URLSearchParams(stored);
          setSearch(saved.get("search") ?? "");
          const savedStatus = saved.get("status");
          if (savedStatus === "Normal" || savedStatus === "Abnormal") setStatus(savedStatus);
        }
      } catch {
        /* ignore */
      }
    }

    setReady(true);

    const scroll = Number(window.sessionStorage.getItem(SCROLL_KEY) ?? "0");
    if (Number.isFinite(scroll) && scroll > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: scroll }));
    }
    window.sessionStorage.removeItem(SCROLL_KEY);
  }, []);

  // Keep the URL and the saved return state in step with the filters.
  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search);
    if (status !== "all") params.set("status", status);
    const query = params.toString();

    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );

    try {
      window.sessionStorage.setItem(RETURN_KEY, query);
    } catch {
      /* ignore */
    }
  }, [search, status, ready]);

  const openResult = (id: string) => {
    try {
      window.sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      /* ignore */
    }
    router.push(`/patient/lab-results/${id}`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const filtered = search.trim() !== "" || status !== "all";

  return (
    <div className="space-y-3">
      <LabResultsHeader
        title="Lab Results"
        subtitle="View and track your lab test results in one place."
      />

      <LabResultsSummary counts={counts} />

      <section className="rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
        <LabResultsFilterBar
          search={search}
          onSearch={setSearch}
          status={status}
          onStatus={setStatus}
          resultCount={visible.length}
        />

        <div className="mt-2.5">
          {!ready ? (
            <LabRowSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={filtered ? "No tests match your filters" : "No lab results yet"}
              description={
                filtered
                  ? "Try a different search term, or clear the status filter to see every result."
                  : "Results appear here once your laboratory reports them."
              }
              action={
                filtered ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-lg border border-[#E6EFEE] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#0A9189] transition-[background-color,border-color] duration-150 hover:border-[#BFE8E2] hover:bg-[#F7FCFB]"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <LabResultsListShell>
              {visible.map((lab) => (
                <LabResultRow key={lab.id} lab={lab} onOpen={openResult} />
              ))}
            </LabResultsListShell>
          )}
        </div>

        <p className="mt-2 text-[9px] leading-relaxed text-[#9AA9B8]">
          Results are reported by the laboratory and cannot be edited. Status badges show the
          laboratory flag only, not a diagnosis.
        </p>
      </section>
    </div>
  );
}

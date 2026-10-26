"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileSearch,
  ListTree,
  MoreHorizontal,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Avatar } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import {
  AI_RANGE_OPTIONS,
  FAILURE_CATEGORIES,
  PROCESSING_LABEL,
  WORKFLOW_LABEL,
  formatDate,
  formatDateTime,
  formatTime,
  type AiRangeKey,
  type AiReport,
  type ProcessingStatus,
  type WorkflowStatus,
} from "@/lib/mock/aiMonitoring";
import { Panel, ProcessingBadge, WorkflowBadge } from "./ui";

type TableTab = "all" | "awaiting" | "approved" | "failed";
type WorkflowFilter = "all" | WorkflowStatus;
type ProcessingFilter = "all" | ProcessingStatus;

function FilterSelect({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[9px] text-[#7A8B9C]">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full appearance-none rounded-lg border border-line bg-white pl-2.5 pr-7 text-[10px] text-[#0F2D4A] outline-none transition hover:border-primary/30 focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
        >
          {children}
        </select>
        <ChevronDown
          size={12}
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
        />
      </span>
    </label>
  );
}

function pageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const items: (number | "ellipsis")[] = [1];
  let start = current - 1;
  let end = current + 1;
  if (current <= 4) {
    start = 2;
    end = 5;
  } else if (current >= total - 3) {
    start = total - 4;
    end = total - 1;
  }
  if (start > 2) items.push("ellipsis");
  for (let page = start; page <= end; page++) items.push(page);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

export function ReportsTable({
  periodReports,
  range,
  onRangeChange,
  onView,
  onNotify,
}: {
  periodReports: AiReport[];
  range: AiRangeKey;
  onRangeChange: (range: AiRangeKey) => void;
  onView: (report: AiReport, tab: "details" | "timeline") => void;
  onNotify: (message: string) => void;
}) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<TableTab>("all");
  const [search, setSearch] = useState("");
  const [doctorId, setDoctorId] = useState("all");
  const [workflow, setWorkflow] = useState<WorkflowFilter>("all");
  const [processing, setProcessing] = useState<ProcessingFilter>("all");
  const [department, setDepartment] = useState("all");
  const [failureCategory, setFailureCategory] = useState("all");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ report: AiReport; x: number; y: number } | null>(null);

  const departments = useMemo(
    () => Array.from(new Set(periodReports.map((report) => report.department))).sort(),
    [periodReports],
  );

  const baseFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodReports.filter((report) => {
      if (doctorId !== "all" && report.doctorId !== doctorId) return false;
      if (workflow !== "all" && report.workflowStatus !== workflow) return false;
      if (processing !== "all" && report.processingStatus !== processing) return false;
      if (department !== "all" && report.department !== department) return false;
      if (failureCategory !== "all" && report.failureCategory !== failureCategory) return false;
      if (!query) return true;
      return [
        report.id,
        report.caseRef,
        report.doctorName,
        report.department,
        WORKFLOW_LABEL[report.workflowStatus],
        PROCESSING_LABEL[report.processingStatus],
        report.failureCategory ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [periodReports, search, doctorId, workflow, processing, department, failureCategory]);

  const counts = useMemo(
    () => ({
      all: baseFiltered.length,
      awaiting: baseFiltered.filter((report) => report.workflowStatus === "awaiting_review").length,
      approved: baseFiltered.filter((report) => report.workflowStatus === "approved").length,
      failed: baseFiltered.filter((report) => report.processingStatus === "failed").length,
    }),
    [baseFiltered],
  );

  const filtered = useMemo(() => {
    if (tab === "awaiting") {
      return baseFiltered.filter((report) => report.workflowStatus === "awaiting_review");
    }
    if (tab === "approved") {
      return baseFiltered.filter((report) => report.workflowStatus === "approved");
    }
    if (tab === "failed") {
      return baseFiltered.filter((report) => report.processingStatus === "failed");
    }
    return baseFiltered;
  }, [baseFiltered, tab]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, doctorId, workflow, processing, department, failureCategory, range, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [range]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const pageIds = rows.map((report) => report.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const activeFilterCount = [doctorId, workflow, processing, department, failureCategory].filter(
    (value) => value !== "all",
  ).length;

  const resetFilters = () => {
    setSearch("");
    setDoctorId("all");
    setWorkflow("all");
    setProcessing("all");
    setDepartment("all");
    setFailureCategory("all");
    setTab("all");
  };

  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const copyReportId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      onNotify(`${id} copied to clipboard`);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = id;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        onNotify(`${id} copied to clipboard`);
      } catch {
        onNotify("Copy is unavailable in this browser");
      }
      textarea.remove();
    }
  };

  const exportSelected = () => {
    const selectedReports = periodReports.filter((report) => selected.has(report.id));
    if (selectedReports.length === 0) return;
    downloadCsv(`medora-ai-report-metadata-${selectedReports.length}.csv`, [
      [
        "Report ID",
        "Case Ref",
        "Doctor",
        "Department",
        "Generated At",
        "Workflow Status",
        "Processing Status",
        "Processing Time",
        "Error Category",
      ],
      ...selectedReports.map((report) => [
        report.id,
        report.caseRef,
        report.doctorName,
        report.department,
        formatDateTime(new Date(report.createdAt)),
        WORKFLOW_LABEL[report.workflowStatus],
        PROCESSING_LABEL[report.processingStatus],
        report.processingSeconds !== null ? `${report.processingSeconds}s` : "—",
        report.failureCategory ?? "—",
      ]),
    ]);
    onNotify(`Exported ${selectedReports.length} nonclinical report records`);
  };

  const tabs: { key: TableTab; label: string; count: number }[] = [
    { key: "all", label: "All Reports", count: counts.all },
    { key: "awaiting", label: "Awaiting Review", count: counts.awaiting },
    { key: "approved", label: "Approved", count: counts.approved },
    { key: "failed", label: "Failed", count: counts.failed },
  ];

  return (
    <Panel className="min-w-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-3.5 pt-3">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? "page" : undefined}
            className={cn(
              "relative pb-2 text-[10.5px] font-semibold transition",
              tab === item.key ? "text-[#0A9189]" : "text-[#7A8B9C] hover:text-[#0F2D4A]",
            )}
          >
            {item.label} ({item.count.toLocaleString("en-US")})
            {tab === item.key && (
              <motion.span
                layoutId="ai-report-tab-underline"
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#0A9189]"
                transition={reduce ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-2 px-3.5 pt-3">
        <label className="relative min-w-0 flex-1">
          <Search
            size={13}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search report ID, case reference, doctor, department, or status..."
            aria-label="Search nonclinical report fields"
            className="h-8 w-full rounded-lg border border-line bg-[#FAFDFD] pl-8 pr-3 text-[10.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:bg-white focus:ring-2 focus:ring-[#0A9189]/15"
          />
        </label>
        <span className="hidden items-center gap-1 rounded-full bg-[#F1FBF9] px-2 py-1 text-[8.5px] font-semibold text-[#0A9189] sm:inline-flex">
          <ShieldCheck size={10} />
          Restricted fields only
        </span>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 px-3.5 pt-2.5 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <FilterSelect
          label="Date Range"
          value={range}
          onChange={(value) => onRangeChange(value as AiRangeKey)}
        >
          {AI_RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId}>
          <option value="all">All Doctors</option>
          {Array.from(
            new Map(periodReports.map((report) => [report.doctorId, report.doctorName])),
          ).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Status"
          value={workflow}
          onChange={(value) => setWorkflow(value as WorkflowFilter)}
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="awaiting_review">Awaiting Review</option>
          <option value="draft">Draft</option>
        </FilterSelect>

        <FilterSelect
          label="Processing Status"
          value={processing}
          onChange={(value) => setProcessing(value as ProcessingFilter)}
        >
          <option value="all">All Processing</option>
          <option value="success">Success</option>
          <option value="processing">Processing</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
        </FilterSelect>

        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          aria-expanded={advancedOpen}
          className={cn(
            "mt-[19px] inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-lg border px-2.5 text-[10px] font-semibold transition sm:col-span-1",
            advancedOpen || activeFilterCount > 0
              ? "border-[#0A9189]/30 bg-[#E6FAF7] text-[#0A9189]"
              : "border-line bg-white text-[#5B6B7C] hover:bg-surface-subtle",
          )}
        >
          <SlidersHorizontal size={12} />
          Filters
          {activeFilterCount > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#0A9189] px-1 text-[8px] text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {advancedOpen && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="mx-3.5 mt-2 grid grid-cols-1 gap-2 rounded-xl border border-line bg-[#FAFDFD] p-2.5 sm:grid-cols-3"
        >
          <FilterSelect label="Department" value={department} onChange={setDepartment}>
            <option value="all">All Departments</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Error Category"
            value={failureCategory}
            onChange={setFailureCategory}
          >
            <option value="all">All Error Categories</option>
            {FAILURE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </FilterSelect>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-[19px] inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-lg border border-line bg-white px-2.5 text-[10px] font-semibold text-[#5B6B7C] transition hover:bg-surface-subtle"
          >
            <X size={12} />
            Clear all filters
          </button>
        </motion.div>
      )}

      {selected.size > 0 && (
        <div className="mx-3.5 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#CFE9E5] bg-[#F1FBF9] px-2.5 py-1.5">
          <p className="text-[9.5px] font-medium text-[#0A9189]">
            {selected.size} record{selected.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={exportSelected}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-[#0A9189] px-2 text-[9px] font-semibold text-white transition hover:bg-[#087F78]"
            >
              <Download size={10} />
              Export selected
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-[#CFE9E5] bg-white px-2 text-[9px] font-semibold text-[#5B6B7C] transition hover:bg-surface-subtle"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-y border-line bg-[#FAFDFD]">
              <th className="w-9 py-2 pl-3.5">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  aria-label="Select all reports on this page"
                  className="h-3.5 w-3.5 rounded border-line accent-[#0A9189]"
                />
              </th>
              {[
                "Report ID",
                "Case Ref",
                "Doctor",
                "Generated At",
                "Status",
                "Processing Status",
                "Processing Time",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-2 py-2 text-[8.5px] font-semibold uppercase tracking-[0.05em] text-[#9AA9B8]"
                >
                  {heading}
                </th>
              ))}
              <th className="sticky right-0 z-10 w-16 bg-[#FAFDFD] px-2 py-2 text-center text-[8.5px] font-semibold uppercase tracking-[0.05em] text-[#9AA9B8] shadow-[-8px_0_12px_-12px_rgba(15,45,74,0.45)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center">
                  <FileSearch size={24} className="mx-auto text-[#B7C2CE]" aria-hidden />
                  <p className="mt-2 text-[11.5px] font-semibold text-[#0F2D4A]">
                    No reports match your filters
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#7A8B9C]">
                    Try a different date range, doctor, or operational status.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-2 text-[10px] font-semibold text-[#0A9189] hover:underline"
                  >
                    Clear all filters
                  </button>
                </td>
              </tr>
            )}

            {rows.map((report) => (
              <tr key={report.id} className="group text-[10px] transition hover:bg-[#FAFDFD]">
                <td className="py-2 pl-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(report.id)}
                    onChange={() => toggleRow(report.id)}
                    aria-label={`Select ${report.id}`}
                    className="h-3.5 w-3.5 rounded border-line accent-[#0A9189]"
                  />
                </td>
                <td className="whitespace-nowrap px-2 py-2 font-semibold text-[#0F2D4A]">
                  {report.id}
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <span className="flex items-center gap-1 font-mono text-[9.5px] text-[#5B6B7C]">
                    <ShieldCheck size={10} className="text-[#9AA9B8]" aria-hidden />
                    {report.caseRef}
                  </span>
                  <span className="block text-[8px] text-[#9AA9B8]">Identity restricted</span>
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={report.doctorName} size={23} />
                    <span className="min-w-0">
                      <span className="block font-medium text-[#0F2D4A]">
                        {report.doctorName}
                      </span>
                      <span className="block text-[8.5px] text-[#9AA9B8]">
                        {report.specialty}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-[#5B6B7C]">
                  <span className="block">{formatDate(new Date(report.createdAt))}</span>
                  <span className="block text-[8.5px] text-[#9AA9B8]">
                    {formatTime(new Date(report.createdAt))}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <WorkflowBadge status={report.workflowStatus} />
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <ProcessingBadge status={report.processingStatus} />
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-[#5B6B7C]">
                  {report.processingSeconds !== null
                    ? `${report.processingSeconds} seconds`
                    : "—"}
                </td>
                <td className="sticky right-0 z-10 bg-white px-2 py-2 shadow-[-8px_0_12px_-12px_rgba(15,45,74,0.45)] transition group-hover:bg-[#FAFDFD]">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onView(report, "details")}
                      aria-label={`View operational details for ${report.id}`}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-line text-[#0A9189] transition hover:bg-[#E6FAF7]"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) =>
                        setMenu({ report, x: event.clientX, y: event.clientY })
                      }
                      aria-label={`More actions for ${report.id}`}
                      aria-haspopup="menu"
                      className="grid h-7 w-6 place-items-center rounded-lg text-[#9AA9B8] transition hover:bg-surface-subtle hover:text-[#0F2D4A]"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3.5 py-2.5">
        <p className="text-[9.5px] text-[#7A8B9C]">
          Showing{" "}
          <span className="font-semibold text-[#0F2D4A]">
            {filtered.length === 0 ? 0 : start + 1}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-[#0F2D4A]">
            {Math.min(start + pageSize, filtered.length)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-[#0F2D4A]">
            {filtered.length.toLocaleString("en-US")}
          </span>{" "}
          results
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[9px] text-[#7A8B9C]">
            Rows per page
            <span className="relative block">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                aria-label="Rows per page"
                className="h-7 appearance-none rounded-md border border-line bg-white pl-2 pr-6 text-[9.5px] text-[#0F2D4A] outline-none focus:border-[#0A9189]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <ChevronDown
                size={10}
                aria-hidden
                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
              />
            </span>
          </label>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
              className="grid h-7 w-7 place-items-center rounded-md border border-line text-[#5B6B7C] transition hover:bg-surface-subtle disabled:opacity-40"
            >
              <ChevronLeft size={13} />
            </button>

            {pageItems(safePage, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="grid h-7 w-5 place-items-center text-[10px] text-[#9AA9B8]"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  aria-current={item === safePage ? "page" : undefined}
                  className={cn(
                    "grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[10px] font-medium transition",
                    item === safePage
                      ? "bg-[#0A9189] text-white"
                      : "border border-line text-[#5B6B7C] hover:bg-surface-subtle",
                  )}
                >
                  {item}
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
              className="grid h-7 w-7 place-items-center rounded-md border border-line text-[#5B6B7C] transition hover:bg-surface-subtle disabled:opacity-40"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Fixed row actions menu */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} aria-hidden />
          <div
            role="menu"
            aria-label={`Actions for ${menu.report.id}`}
            className="fixed z-50 w-52 rounded-xl border border-line bg-white py-1 shadow-pop"
            style={{
              left: Math.min(
                menu.x,
                (typeof window !== "undefined" ? window.innerWidth : 1200) - 220,
              ),
              top: Math.min(
                menu.y,
                (typeof window !== "undefined" ? window.innerHeight : 800) - 170,
              ),
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onView(menu.report, "details");
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
            >
              <FileSearch size={12} />
              View Processing Details
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onView(menu.report, "timeline");
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
            >
              <ListTree size={12} />
              View Event Timeline
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void copyReportId(menu.report.id);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
            >
              <Copy size={12} />
              Copy Report ID
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={menu.report.processingStatus !== "failed"}
              title={
                menu.report.processingStatus === "failed"
                  ? "View sanitized technical error"
                  : "Only available for failed jobs"
              }
              onClick={() => {
                onView(menu.report, "details");
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10.5px] text-[#5B6B7C] transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShieldCheck size={12} />
              View Sanitized Error Information
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

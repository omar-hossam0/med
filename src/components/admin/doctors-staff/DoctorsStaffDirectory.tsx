"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Stethoscope,
  Users,
  ShieldCheck,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
} from "lucide-react";
import {
  directoryStats,
  VERIFICATION_LABEL,
  ACCOUNT_STATUS_LABEL,
  DUTY_LABEL,
  type DirectoryMember,
} from "@/lib/mock/doctorsStaff";
import type { DirectoryTab } from "./DirectoryProvider";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { Avatar } from "@/components/admin/ui";
import { SelectField } from "@/components/ui/SelectField";
import { useComingSoon } from "@/components/admin/ComingSoon";
import { useReferenceData } from "@/components/admin/ReferenceDataProvider";
import { adminApi, ApiError } from "@/lib/api/admin";
import { useDirectory } from "./DirectoryProvider";
import { MemberCard, memberDetailHref } from "./MemberCard";
import { FiltersPanel } from "./FiltersPanel";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 8;

const TABS: { key: DirectoryTab; label: string }[] = [
  { key: "all", label: "All Members" },
  { key: "doctor", label: "Doctors" },
  { key: "staff", label: "Staff" },
];

export function DoctorsStaffDirectory() {
  const comingSoon = useComingSoon();
  const { departments } = useReferenceData();
  const { tab, setTab, view, setView, filters, setFilter, page, setPage } = useDirectory();

  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Source of truth is the database. There is no seeded fallback: an empty
  // directory means the clinic has not provisioned anyone yet.
  useEffect(() => {
    let active = true;

    adminApi
      .listDirectory()
      .then((data) => {
        if (!active) return;
        setMembers(data.members);
        setLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        setMembers([]);
        setLoadError(
          err instanceof ApiError ? err.message : "Could not load the directory.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => directoryStats(members), [members]);

  const tabCount = (key: DirectoryTab) =>
    key === "all" ? members.length : members.filter((m) => m.kind === key).length;

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return members.filter((m) => {
      if (tab !== "all" && m.kind !== tab) return false;
      if (filters.department !== "All Departments" && m.department !== filters.department) {
        // Also match specialty or area
        const matchesArea =
          (m.kind === "doctor" && m.specialty === filters.department) ||
          (m.kind === "staff" && m.area === filters.department);
        if (!matchesArea && !m.department.includes(filters.department)) return false;
      }
      if (filters.role !== "All Roles") {
        if ((filters.role === "Doctor") !== (m.kind === "doctor")) return false;
      }
      if (filters.verification !== "All Statuses") {
        if (m.kind !== "doctor") return false;
        if (VERIFICATION_LABEL[m.verification] !== filters.verification) return false;
      }
      if (
        filters.accountStatus !== "All Statuses" &&
        ACCOUNT_STATUS_LABEL[m.accountStatus] !== filters.accountStatus
      )
        return false;
      if (filters.location !== "All Locations" && m.location !== filters.location) return false;
      if (!q) return true;
      const haystack = [
        m.name,
        m.email,
        m.kind === "doctor" ? m.specialty : m.jobTitle,
        m.department,
        m.location,
        m.phone,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [members, tab, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const pageNumbers = useMemo<(number | "gap")[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 4) return [1, 2, 3, 4, 5, "gap", totalPages];
    if (safePage >= totalPages - 3)
      return [1, "gap", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "gap", safePage - 1, safePage, safePage + 1, "gap", totalPages];
  }, [safePage, totalPages]);

  return (
    <div className="space-y-4">
      {/* Page Header (Reference Image 1: title + subtitle on left, clean spacing) */}
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.01em] text-[#0F2D4A]">
          Doctors &amp; Staff
        </h1>
        <p className="mt-0.5 text-[12.5px] text-[#5B6B7C]">
          Manage medical professionals and staff members.
        </p>
      </div>

      {/* 4 Horizontally Aligned Statistics Cards (Reference Image 1) */}
      <RevealOnScroll
        as="section"
        stagger={50}
        y={14}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Total Doctors"
          caption="Medical professionals"
          value={stats.doctors}
          icon={Stethoscope}
          tone="teal"
        />
        <StatCard
          label="Total Staff"
          caption="Reception & administration"
          value={stats.staff}
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Pending Verification"
          caption="Awaiting review"
          value={stats.pendingVerification}
          icon={ShieldCheck}
          tone="amber"
        />
        <StatCard
          label="On Duty Today"
          caption="Scheduled team members"
          value={stats.onDuty}
          icon={CalendarCheck}
          tone="mint"
        />
      </RevealOnScroll>

      {/* Main Directory & Right Filters Column */}
      <RevealOnScroll
        y={16}
        className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_224px]"
      >
        {/* Large White Directory Container */}
        <section className="min-w-0 rounded-2xl border border-[#E5ECEC] bg-white shadow-soft">
          {/* Tabs + Add Doctor / Staff Button Header Bar (Reference Image 1) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pt-1">
            <div className="flex items-center gap-6">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative -mb-px flex items-center gap-1.5 pb-3 pt-3 text-[12.5px] transition",
                      active
                        ? "border-b-2 border-[#0A9189] font-bold text-[#0A9189]"
                        : "border-b-2 border-transparent font-medium text-[#5B6B7C] hover:text-[#0F2D4A]",
                    )}
                  >
                    <span>{t.label}</span>
                    <span
                      className={cn(
                        "text-[11px]",
                        active ? "font-semibold text-[#0A9189]" : "text-[#7A8B9C]",
                      )}
                    >
                      ({tabCount(t.key)})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Primary Action Button (Right of Tabs, Reference Image 1) */}
            <Link
              href="/admin/users/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0A9189] px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#087F78]"
            >
              <Plus size={15} strokeWidth={2.5} />
              Add Doctor / Staff
            </Link>
          </div>

          {/* Search & Filter Toolbar (Reference Image 1: Labels above dropdowns, Grid/List switch) */}
          <div className="flex flex-wrap items-end gap-2.5 p-4">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8B9C]"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                placeholder="Search by name, email, specialty, or department..."
                aria-label="Search members"
                className="h-9 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[11.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
              />
            </div>

            {/* Department Dropdown */}
            <div className="w-[145px]">
              <label className="mb-1 block text-[10px] font-medium text-[#7A8B9C]">
                Department
              </label>
              <SelectField
                id="ds-department"
                label="Department"
                placeholder="All Departments"
                value={filters.department}
                onChange={(v) => setFilter("department", v)}
                options={["All Departments", ...departments.map((d) => d.name)].map((o) => ({
                  value: o,
                  label: o,
                }))}
                height={36}
              />
            </div>

            {/* Role Dropdown */}
            <div className="w-[120px]">
              <label className="mb-1 block text-[10px] font-medium text-[#7A8B9C]">Role</label>
              <SelectField
                id="ds-role"
                label="Role"
                placeholder="All Roles"
                value={filters.role}
                onChange={(v) => setFilter("role", v)}
                options={["All Roles", "Doctor", "Staff"].map((o) => ({ value: o, label: o }))}
                height={36}
              />
            </div>

            {/* Verification Status Dropdown */}
            <div className="w-[148px]">
              <label className="mb-1 block text-[10px] font-medium text-[#7A8B9C]">
                Verification Status
              </label>
              <SelectField
                id="ds-verification"
                label="Verification Status"
                placeholder="All Statuses"
                value={filters.verification}
                onChange={(v) => setFilter("verification", v)}
                options={["All Statuses", ...Object.values(VERIFICATION_LABEL)].map((o) => ({
                  value: o,
                  label: o,
                }))}
                height={36}
              />
            </div>

            {/* Grid / List View Toggle */}
            <div className="flex items-center gap-1 rounded-xl border border-line p-0.5">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition",
                  view === "grid"
                    ? "bg-[#0A9189] text-white shadow-sm"
                    : "text-[#7A8B9C] hover:bg-surface-subtle",
                )}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition",
                  view === "list"
                    ? "bg-[#0A9189] text-white shadow-sm"
                    : "text-[#7A8B9C] hover:bg-surface-subtle",
                )}
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Member Content: Grid Mode (Reference Image 1: 4 columns x 2 rows = 8 cards) */}
          {loading ? (
            <div className="mx-4 mb-4 rounded-xl border border-dashed border-line bg-[#FAFDFD] px-4 py-12 text-center">
              <p className="text-[12.5px] font-medium text-[#0F2D4A]">Loading members…</p>
              <p className="mt-1 text-[11px] text-[#7A8B9C]">
                Reading the clinic directory from the database.
              </p>
            </div>
          ) : loadError ? (
            <div className="mx-4 mb-4 rounded-xl border border-[#E5484D]/30 bg-[#FDECEF] px-4 py-10 text-center">
              <p className="text-[12.5px] font-semibold text-[#B42318]">
                Could not load the directory
              </p>
              <p className="mt-1 text-[11px] text-[#B42318]/80">{loadError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mx-4 mb-4 rounded-xl border border-dashed border-line bg-[#FAFDFD] px-4 py-12 text-center">
              <p className="text-[12.5px] font-medium text-[#0F2D4A]">No members match your filters</p>
              <p className="mt-1 text-[11px] text-[#7A8B9C]">
                {members.length === 0
                  ? "No doctors or staff have been added yet."
                  : "Try adjusting your search query or clearing the selected filters."}
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-3.5 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {paged.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          ) : (
            /* List Mode */
            <div className="overflow-x-auto px-4 pb-4">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-wider text-[#7A8B9C]">
                    <th className="pb-2.5 pl-2">Member</th>
                    <th className="pb-2.5">Department</th>
                    <th className="pb-2.5">Location</th>
                    <th className="pb-2.5">Contact</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {paged.map((m) => (
                    <tr key={m.id} className="text-[11.5px] transition hover:bg-[#F8FCFC]">
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center gap-2.5">
                          {m.photoUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={m.photoUrl}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
                            />
                          ) : (
                            <Avatar name={m.name} size={32} />
                          )}
                          <div>
                            <p className="font-bold text-[#0F2D4A]">{m.name}</p>
                            <p className="text-[10px] text-[#7A8B9C]">
                              {m.kind === "doctor" ? m.title : m.jobTitle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-[#5B6B7C]">
                        {m.kind === "doctor" ? m.specialty : m.area || m.department}
                      </td>
                      <td className="py-2.5 text-[#5B6B7C]">{m.location}</td>
                      <td className="py-2.5">
                        <p className="text-[#5B6B7C]">{m.phone}</p>
                        <p className="text-[10px] text-[#9AA9B8]">{m.email}</p>
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E6FAF7] px-2 py-0.5 text-[10px] font-semibold text-[#0A9189]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                          {m.kind === "doctor"
                            ? VERIFICATION_LABEL[m.verification]
                            : ACCOUNT_STATUS_LABEL[m.accountStatus]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={memberDetailHref(m)}
                            className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#E6FAF7] px-2 text-[10.5px] font-semibold text-[#0A9189] transition hover:bg-[#D5F5EF]"
                          >
                            <Eye size={12} />
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={() => comingSoon(`Edit ${m.name}`)}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:bg-surface-subtle"
                          >
                            <Pencil size={11} />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination (Reference Image 1: Showing 1-8 of 241 members, numbered buttons) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <p className="text-[11.5px] text-[#7A8B9C]">
              Showing <span className="font-semibold text-[#0F2D4A]">{filtered.length === 0 ? 0 : start + 1}</span>
              –
              <span className="font-semibold text-[#0F2D4A]">
                {Math.min(start + PAGE_SIZE, filtered.length)}
              </span>{" "}
              of <span className="font-semibold text-[#0F2D4A]">{filtered.length}</span> members
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
                className="grid h-7 w-7 place-items-center rounded-lg border border-line text-[#5B6B7C] transition hover:bg-surface-subtle disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              {pageNumbers.map((p, i) =>
                p === "gap" ? (
                  <span key={`gap-${i}`} className="px-1 text-[11px] text-[#9AA9B8]">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={p === safePage ? "page" : undefined}
                    className={cn(
                      "grid h-7 min-w-7 place-items-center rounded-lg px-2 text-[11px] font-semibold transition",
                      p === safePage
                        ? "bg-[#0A9189] text-white shadow-sm"
                        : "border border-line text-[#5B6B7C] hover:bg-surface-subtle",
                    )}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                className="grid h-7 w-7 place-items-center rounded-lg border border-line text-[#5B6B7C] transition hover:bg-surface-subtle disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* Right-Side Filters Panel (Reference Image 1) */}
        <FiltersPanel />
      </RevealOnScroll>
    </div>
  );
}

/* ---------------- Stat card matching Reference Image 1 ---------------- */
const TONES = {
  teal: {
    bg: "bg-[#E6FAF7]",
    fg: "text-[#0A9189]",
  },
  blue: {
    bg: "bg-[#EFF4FF]",
    fg: "text-[#3B6EF6]",
  },
  amber: {
    bg: "bg-[#FFF6E5]",
    fg: "text-[#E09A1B]",
  },
  mint: {
    bg: "bg-[#E9F9EF]",
    fg: "text-[#1E9E56]",
  },
} as const;

function StatCard({
  label,
  caption,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  caption: string;
  value: number;
  icon: typeof Stethoscope;
  tone: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[#E5ECEC] bg-white p-4 shadow-soft">
      {/* Circular Icon Container on Left */}
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", t.bg, t.fg)}>
        <Icon size={20} />
      </span>
      {/* Text Stack on Right */}
      <div className="min-w-0">
        <p className="text-[11.5px] font-medium text-[#5B6B7C] leading-none">{label}</p>
        <p className="my-1 text-[24px] font-bold text-[#0F2D4A] leading-tight">{value}</p>
        <p className="text-[11px] text-[#9AA9B8] leading-none">{caption}</p>
      </div>
    </div>
  );
}

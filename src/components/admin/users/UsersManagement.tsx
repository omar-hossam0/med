"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Filter,
  Download,
  Search,
  MoreVertical,
  Users,
  UserRound,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Check,
} from "lucide-react";
import {
  ROLE_LABEL,
  STATUS_LABEL,
  formatJoined,
  type UserRole,
  type UserStatus,
} from "@/lib/mock/users";
import { Avatar, Sparkline } from "@/components/admin/ui";
import { useComingSoon } from "@/components/admin/ComingSoon";
import { useUsers } from "./UsersProvider";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 8;

const ROLE_BADGE: Record<UserRole, string> = {
  patient: "bg-[#E6FAF7] text-[#0A9189]",
  doctor: "bg-[#EFF4FF] text-[#3B6EF6]",
  staff: "bg-[#F3EEFF] text-[#8B5CF6]",
};

const STATUS_DOT: Record<UserStatus, string> = {
  active: "bg-[#1E9E56]",
  inactive: "bg-[#E5484D]",
  pending: "bg-[#C77A0A]",
  suspended: "bg-[#94A3B8]",
};

const STATUS_TEXT: Record<UserStatus, string> = {
  active: "text-[#1E9E56]",
  inactive: "text-[#E5484D]",
  pending: "text-[#C77A0A]",
  suspended: "text-[#64748B]",
};

type Tab = "all" | UserRole;

export function UsersManagement() {
  const { users, stats } = useUsers();
  const comingSoon = useComingSoon();

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | UserStatus>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (tab !== "all" && u.role !== tab) return false;
      if (status !== "all" && u.status !== status) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_LABEL[u.role].toLowerCase().includes(q)
      );
    });
  }, [users, tab, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const resetPage = () => setPage(1);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const pageIds = paged.map((u) => u.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const exportCsv = () => {
    const header = ["Name", "Role", "Email", "Phone", "Status", "Joined Date"];
    const rows = filtered.map((u) => [
      u.name,
      ROLE_LABEL[u.role],
      u.email,
      u.phone,
      STATUS_LABEL[u.status],
      formatJoined(u.joinedAt),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medora-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All Users", count: stats.total },
    { key: "patient", label: "Patients", count: stats.patients },
    { key: "doctor", label: "Doctors", count: stats.doctors },
    { key: "staff", label: "Staff", count: stats.staff },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-[-0.01em] text-[#0F2D4A]">Users Management</h1>
          <p className="mt-0.5 text-[12px] text-[#5B6B7C]">
            Manage all patients, doctors, and staff accounts.
            <span className="ml-2 rounded-full bg-[#E6FAF7] px-2 py-0.5 text-[9.5px] font-semibold text-[#0A9189]">Demo data</span>
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#0A9189_0%,#16B8AA_100%)] px-4 text-[12px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(10,145,137,0.7)] transition hover:brightness-110"
        >
          <Plus size={15} />
          Add User
        </Link>
      </div>

      {/* Stat cards */}
      <RevealOnScroll
        as="section"
        stagger={50}
        y={14}
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard label="Total Users" value={stats.total} icon={Users} tone="teal" trend="+12%" spark={[6, 8, 7, 9, 8, 10, 9, 11]} />
        <StatCard label="Patients" value={stats.patients} icon={UserRound} tone="blue" trend="+14%" spark={[5, 7, 6, 8, 9, 8, 10, 11]} />
        <StatCard label="Doctors" value={stats.doctors} icon={Stethoscope} tone="violet" trend="+8%" spark={[4, 5, 5, 6, 5, 7, 6, 7]} />
        <StatCard label="Staff" value={stats.staff} icon={Users} tone="amber" trend="+6%" spark={[3, 4, 4, 5, 4, 6, 5, 6]} />
      </RevealOnScroll>

      {/* Toolbar */}
      <RevealOnScroll as="section" y={14} className="rounded-2xl border border-line bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  resetPage();
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition",
                  tab === t.key
                    ? "bg-[#E6FAF7] font-semibold text-[#0A9189]"
                    : "text-[#5B6B7C] hover:bg-surface-subtle hover:text-navy",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[9.5px] font-semibold",
                    tab === t.key ? "bg-[#0A9189] text-white" : "bg-surface-subtle text-[#7A8B9C]",
                  )}
                >
                  {t.count.toLocaleString()}
                </span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Filter */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition",
                  status !== "all"
                    ? "border-[#0A9189]/40 bg-[#E6FAF7] text-[#0A9189]"
                    : "border-line text-[#5B6B7C] hover:bg-surface-subtle",
                )}
              >
                <Filter size={13} />
                Filter
                {status !== "all" && <span className="h-1.5 w-1.5 rounded-full bg-[#0A9189]" />}
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} aria-hidden />
                  <div className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-line bg-white p-2 shadow-pop">
                    <p className="px-1 pb-1 text-[9.5px] font-semibold uppercase tracking-wide text-[#9AA9B8]">Account status</p>
                    {(["all", "active", "inactive", "pending"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setStatus(s);
                          setFilterOpen(false);
                          resetPage();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
                      >
                        <span className={cn("grid h-3.5 w-3.5 place-items-center rounded border", status === s ? "border-[#0A9189] bg-[#0A9189] text-white" : "border-line")}>
                          {status === s && <Check size={9} />}
                        </span>
                        {s === "all" ? "All statuses" : STATUS_LABEL[s]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("all");
                        setFilterOpen(false);
                        resetPage();
                      }}
                      className="mt-1 w-full rounded-lg border-t border-line pt-1.5 text-left text-[10.5px] font-medium text-[#0A9189]"
                    >
                      Reset filters
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Export */}
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[11.5px] font-medium text-[#5B6B7C] transition hover:bg-surface-subtle"
            >
              <Download size={13} />
              Export
            </button>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                placeholder="Search users..."
                aria-label="Search users"
                className="h-8 w-[180px] rounded-lg border border-line bg-surface-subtle/60 pl-8 pr-2.5 text-[11.5px] text-navy outline-none transition placeholder:text-ink-muted focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>
        </div>
      </RevealOnScroll>

      {/* Table */}
      <RevealOnScroll as="section" y={14} className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="w-9 py-2.5 pl-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all users on this page"
                    className="h-3.5 w-3.5 rounded border-line accent-[#0A9189]"
                  />
                </th>
                {["#", "User", "Role", "Email", "Phone", "Status", "Joined Date"].map((h) => (
                  <th key={h} className="px-2 py-2.5 text-[9.5px] font-semibold uppercase tracking-wide text-[#9AA9B8]">
                    {h}
                  </th>
                ))}
                <th className="w-10 px-2 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {paged.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[12px] text-[#7A8B9C]">
                    No users match your search or filters.
                  </td>
                </tr>
              )}
              {paged.map((u, i) => (
                <tr key={u.id} className="text-[11.5px] transition hover:bg-[#FAFDFD]">
                  <td className="py-2.5 pl-3">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleRow(u.id)}
                      aria-label={`Select ${u.name}`}
                      className="h-3.5 w-3.5 rounded border-line accent-[#0A9189]"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-[#9AA9B8]">{start + i + 1}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} size={26} />
                      <span className="whitespace-nowrap font-medium text-[#0F2D4A]">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", ROLE_BADGE[u.role])}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[#5B6B7C]">{u.email}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[#5B6B7C]">{u.phone || "—"}</td>
                  <td className="px-2 py-2.5">
                    <span className={cn("inline-flex items-center gap-1.5 text-[10.5px] font-medium", STATUS_TEXT[u.status])}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[u.status])} />
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[#5B6B7C]">{formatJoined(u.joinedAt)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => setMenu({ id: u.id, x: e.clientX, y: e.clientY })}
                      aria-label={`Actions for ${u.name}`}
                      className="grid h-7 w-7 place-items-center rounded-md text-ink-muted transition hover:bg-surface-subtle hover:text-navy"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5">
          <p className="text-[10.5px] text-[#7A8B9C]">
            Showing <span className="font-semibold text-[#0F2D4A]">{filtered.length === 0 ? 0 : start + 1}</span> to{" "}
            <span className="font-semibold text-[#0F2D4A]">{Math.min(start + PAGE_SIZE, filtered.length)}</span> of{" "}
            <span className="font-semibold text-[#0F2D4A]">{filtered.length}</span> users
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
              className="grid h-7 w-7 place-items-center rounded-md border border-line text-[#5B6B7C] transition hover:bg-surface-subtle disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }).slice(0, 5).map((_, idx) => {
              const p = idx + 1;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === safePage ? "page" : undefined}
                  className={cn(
                    "grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[11px] font-medium transition",
                    p === safePage ? "bg-[#0A9189] text-white" : "border border-line text-[#5B6B7C] hover:bg-surface-subtle",
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
              className="grid h-7 w-7 place-items-center rounded-md border border-line text-[#5B6B7C] transition hover:bg-surface-subtle disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </RevealOnScroll>

      {/* Row actions menu (fixed so it is never clipped by the table scroll) */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} aria-hidden />
          <div
            role="menu"
            className="fixed z-50 w-40 rounded-xl border border-line bg-white py-1 shadow-pop"
            style={{
              left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 176),
              top: Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 130),
            }}
          >
            {["View Details", "Edit Account", "Change Status"].map((label) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  comingSoon(label);
                }}
                className="block w-full px-3 py-1.5 text-left text-[11.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Stat card ---------------- */
const TONES = {
  teal: { bg: "bg-[#E6FAF7]", fg: "text-[#0A9189]", line: "#0A9189" },
  blue: { bg: "bg-[#EFF4FF]", fg: "text-[#3B6EF6]", line: "#3B6EF6" },
  violet: { bg: "bg-[#F3EEFF]", fg: "text-[#8B5CF6]", line: "#8B5CF6" },
  amber: { bg: "bg-[#FFF6E5]", fg: "text-[#E09A1B]", line: "#E09A1B" },
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  trend,
  spark,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone: keyof typeof TONES;
  trend: string;
  spark: number[];
}) {
  const t = TONES[tone];
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", t.bg, t.fg)}>
          <Icon size={14} />
        </span>
        <span className="text-[10.5px] text-[#5B6B7C]">{label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-[21px] font-bold leading-none text-[#0F2D4A]">{value.toLocaleString()}</p>
          <p className="mt-1.5 flex items-center gap-1 text-[9.5px]">
            <span className="inline-flex items-center gap-0.5 font-semibold text-[#1E9E56]">
              <ArrowUpRight size={10} />
              {trend}
            </span>
            <span className="text-[#9AA9B8]">vs last month</span>
          </p>
        </div>
        <Sparkline points={spark} color={t.line} width={58} height={22} />
      </div>
    </div>
  );
}

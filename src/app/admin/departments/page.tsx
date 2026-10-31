"use client";

import {
  Grid2X2,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  Building2,
  CalendarDays,
} from "lucide-react";
import { DepartmentsProvider, useDepartments } from "@/components/admin/departments/DepartmentsProvider";
import { AddDepartmentModal } from "@/components/admin/departments/AddDepartmentModal";
import { DepartmentCard } from "@/components/admin/departments/DepartmentCard";
import { DeactivateConfirmDialog } from "@/components/admin/departments/DeactivateConfirmDialog";
import { DepartmentsToast } from "@/components/admin/departments/DepartmentsToast";
import { EditDepartmentModal } from "@/components/admin/departments/EditDepartmentModal";
import { ManageDoctorsModal } from "@/components/admin/departments/ManageDoctorsModal";
import { ManageServicesModal } from "@/components/admin/departments/ManageServicesModal";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { cn } from "@/lib/cn";

export default function DepartmentsPage() {
  return (
    <DepartmentsProvider>
      <DepartmentsContent />
    </DepartmentsProvider>
  );
}

function DepartmentsContent() {
  const {
    departments,
    filteredDepartments,
    stats,
    tab,
    setTab,
    view,
    setView,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    clearFilters,
    isAddModalOpen,
    openAddModal,
    closeAddModal,
    editingDept,
    closeEditModal,
    managingDoctorsDept,
    closeManageDoctorsModal,
    managingServicesDept,
    closeManageServicesModal,
    deactivatingDept,
    closeDeactivateDialog,
  } = useDepartments();

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A9189]">
            Administration
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#0F2D4A]">Departments</h1>
          <p className="mt-1 text-xs text-[#7A8B9C]">
            Manage departments, doctors, services, and availability.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#0A9189] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#087F78]"
        >
          <Plus size={15} />
          Add Department
        </button>
      </div>

      <RevealOnScroll stagger={50} y={14} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Total Departments" value={stats.totalDepartments} icon={Building2} tone="teal" />
        <SummaryCard label="Active Departments" value={stats.activeDepartments} icon={SlidersHorizontal} tone="green" />
        <SummaryCard label="Assigned Doctors" value={stats.assignedDoctors} icon={Users} tone="blue" />
        <SummaryCard label="Appointments" value={stats.totalAppointments} icon={CalendarDays} tone="violet" />
      </RevealOnScroll>

      <RevealOnScroll as="section" y={14} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-1 rounded-xl bg-[#F3F8F8] p-1">
            {[
              ["all", `All (${departments.length})`],
              ["active", `Active (${stats.activeDepartments})`],
              ["inactive", `Inactive (${stats.inactiveDepartments})`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value as typeof tab)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                  tab === value
                    ? "bg-white text-[#0A9189] shadow-sm"
                    : "text-[#7A8B9C] hover:text-[#0F2D4A]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-56">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA9B8]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search departments..."
                className="h-9 w-full rounded-xl border border-line bg-[#FAFDFD] pl-9 pr-3 text-[11.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:bg-white focus:ring-2 focus:ring-[#0A9189]/15"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="h-9 rounded-xl border border-line bg-white px-3 text-[11.5px] text-[#0F2D4A] outline-none focus:border-[#0A9189]"
            >
              <option>All Statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort departments"
              className="h-9 rounded-xl border border-line bg-white px-3 text-[11.5px] text-[#0F2D4A] outline-none focus:border-[#0A9189]"
            >
              <option>Name (A-Z)</option>
              <option>Name (Z-A)</option>
              <option>Newest First</option>
              <option>Oldest First</option>
              <option>Display Order</option>
            </select>
            <div className="flex h-9 items-center rounded-xl border border-line p-1">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Grid view"
                className={cn("grid h-7 w-7 place-items-center rounded-lg", view === "grid" && "bg-[#E6FAF7] text-[#0A9189]")}
              >
                <Grid2X2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label="List view"
                className={cn("grid h-7 w-7 place-items-center rounded-lg", view === "list" && "bg-[#E6FAF7] text-[#0A9189]")}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {filteredDepartments.length > 0 ? (
          view === "grid" ? (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredDepartments.map((department) => (
                <DepartmentCard key={department.id} department={department} />
              ))}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[620px] text-left text-[11.5px]">
                <thead className="bg-[#FAFDFD] text-[#7A8B9C]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Doctors</th>
                    <th className="px-4 py-3 font-semibold">Appointments</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepartments.map((department) => (
                    <tr key={department.id} className="border-t border-line text-[#0F2D4A]">
                      <td className="px-4 py-3 font-semibold">{department.name}</td>
                      <td className="px-4 py-3 capitalize">{department.status}</td>
                      <td className="px-4 py-3">{department.assignedDoctorIds.length}</td>
                      <td className="px-4 py-3">{department.stats.totalAppointments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-line px-4 py-12 text-center">
            <p className="text-sm font-semibold text-[#0F2D4A]">No departments found</p>
            <p className="mt-1 text-xs text-[#7A8B9C]">Try changing the search or filters.</p>
            <button type="button" onClick={clearFilters} className="mt-3 text-xs font-semibold text-[#0A9189] hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </RevealOnScroll>

      <AddDepartmentModal open={isAddModalOpen} onClose={closeAddModal} />
      <EditDepartmentModal department={editingDept} onClose={closeEditModal} />
      <ManageDoctorsModal department={managingDoctorsDept} onClose={closeManageDoctorsModal} />
      <ManageServicesModal department={managingServicesDept} onClose={closeManageServicesModal} />
      <DeactivateConfirmDialog department={deactivatingDept} onClose={closeDeactivateDialog} />
      <DepartmentsToast />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
  tone: "teal" | "green" | "blue" | "violet";
}) {
  const styles = {
    teal: "bg-[#E6FAF7] text-[#0A9189]",
    green: "bg-[#E9F9EF] text-[#1E9E56]",
    blue: "bg-[#EFF4FF] text-[#3B6EF6]",
    violet: "bg-[#F4F0FF] text-[#7C3AED]",
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <div className={cn("grid h-9 w-9 place-items-center rounded-xl", styles[tone])}>
        <Icon size={17} />
      </div>
      <p className="mt-3 text-[11px] text-[#7A8B9C]">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-[#0F2D4A]">{value}</p>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Users, CalendarDays, MoreHorizontal } from "lucide-react";
import { DepartmentIcon } from "./DepartmentIcon";
import { DepartmentActionsMenu } from "./DepartmentActionsMenu";
import { useDepartments } from "./DepartmentsProvider";
import type { Department } from "@/lib/mock/departments";
import { cn } from "@/lib/cn";

export function DepartmentCard({ department }: { department: Department }) {
  const { openEditModal } = useDepartments();
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-[#E9F0F0] bg-white p-4 shadow-[0_2px_8px_-2px_rgba(15,45,74,0.06)] transition hover:border-[#0A9189]/40 hover:shadow-[0_8px_20px_-6px_rgba(10,145,137,0.12)]">
      <div>
        {/* Top row: Icon + Status badge + Three-dot menu */}
        <div className="flex items-start justify-between">
          <DepartmentIcon
            iconKey={department.icon}
            size={46}
            iconSize={22}
          />

          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
                department.status === "active"
                  ? "bg-[#E6FAF7] text-[#0A9189]"
                  : "bg-[#FDECEF] text-[#E5484D]",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  department.status === "active" ? "bg-[#0A9189]" : "bg-[#E5484D]",
                )}
              />
              {department.status === "active" ? "Active" : "Inactive"}
            </span>

            <button
              ref={menuRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`More actions for ${department.name}`}
              aria-expanded={menuOpen}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#7A8B9C] transition hover:bg-surface-subtle hover:text-[#0F2D4A]"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Name and Description */}
        <div className="mt-3">
          <h3 className="truncate text-[14px] font-bold text-[#0F2D4A]">
            {department.name}
          </h3>
          <p
            className="mt-1 line-clamp-2 min-h-[34px] text-[11.5px] leading-relaxed text-[#7A8B9C]"
            title={department.description}
          >
            {department.description}
          </p>
        </div>

        {/* Stats Row */}
        <div className="mt-3.5 flex items-center justify-between border-t border-line/50 pt-3 text-[11px] text-[#5B6B7C]">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-[#0A9189]" />
            <span className="font-semibold text-[#0F2D4A]">
              {department.assignedDoctorIds.length}
            </span>
            <span>Doctors</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays size={13} className="text-[#3B82F6]" />
            <span className="font-semibold text-[#0F2D4A]">
              {department.stats.totalAppointments}
            </span>
            <span>Appointments</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={`/admin/departments/${department.id}`}
          className="inline-flex h-8 items-center justify-center rounded-xl bg-[#E6FAF7] text-[11.5px] font-semibold text-[#0A9189] transition hover:bg-[#D5F5EF]"
        >
          View Details
        </Link>
        <button
          type="button"
          onClick={() => openEditModal(department)}
          className="inline-flex h-8 items-center justify-center rounded-xl bg-[#E6FAF7] text-[11.5px] font-semibold text-[#0A9189] transition hover:bg-[#D5F5EF]"
        >
          Edit
        </button>
      </div>

      {/* Dropdown Menu */}
      <DepartmentActionsMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuRef}
        department={department}
      />
    </div>
  );
}

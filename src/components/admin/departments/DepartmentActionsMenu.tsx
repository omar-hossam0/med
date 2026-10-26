"use client";

import Link from "next/link";
import {
  Eye,
  Pencil,
  Users,
  Layers,
  Copy,
  Power,
  CheckCircle,
} from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { useDepartments } from "./DepartmentsProvider";
import type { Department } from "@/lib/mock/departments";

export function DepartmentActionsMenu({
  open,
  onClose,
  anchorRef,
  department,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  department: Department;
}) {
  const {
    openEditModal,
    openManageDoctorsModal,
    openManageServicesModal,
    openDeactivateDialog,
    duplicateDepartment,
  } = useDepartments();

  const handleEdit = () => {
    onClose();
    openEditModal(department);
  };

  const handleManageDoctors = () => {
    onClose();
    openManageDoctorsModal(department);
  };

  const handleManageServices = () => {
    onClose();
    openManageServicesModal(department);
  };

  const handleDuplicate = () => {
    onClose();
    duplicateDepartment(department.id);
  };

  const handleToggleStatus = () => {
    onClose();
    openDeactivateDialog(department);
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      width={190}
      className="py-1.5 shadow-[0_10px_25px_-5px_rgba(15,45,74,0.15)]"
    >
      <div className="flex flex-col">
        {/* View Details */}
        <Link
          href={`/admin/departments/${department.id}`}
          onClick={onClose}
          className="flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#0F2D4A] transition hover:bg-surface-subtle"
        >
          <Eye size={14} className="text-[#7A8B9C]" />
          <span>View Details</span>
        </Link>

        {/* Edit Department */}
        <button
          type="button"
          onClick={handleEdit}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] font-medium text-[#0F2D4A] transition hover:bg-surface-subtle"
        >
          <Pencil size={14} className="text-[#7A8B9C]" />
          <span>Edit Department</span>
        </button>

        {/* Manage Doctors */}
        <button
          type="button"
          onClick={handleManageDoctors}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] font-medium text-[#0F2D4A] transition hover:bg-surface-subtle"
        >
          <Users size={14} className="text-[#7A8B9C]" />
          <span>Manage Doctors</span>
        </button>

        {/* Manage Services */}
        <button
          type="button"
          onClick={handleManageServices}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] font-medium text-[#0F2D4A] transition hover:bg-surface-subtle"
        >
          <Layers size={14} className="text-[#7A8B9C]" />
          <span>Manage Services</span>
        </button>

        {/* Duplicate Department */}
        <button
          type="button"
          onClick={handleDuplicate}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] font-medium text-[#0F2D4A] transition hover:bg-surface-subtle"
        >
          <Copy size={14} className="text-[#7A8B9C]" />
          <span>Duplicate Department</span>
        </button>

        <div className="my-1 border-t border-line/60" />

        {/* Deactivate / Activate Department */}
        <button
          type="button"
          onClick={handleToggleStatus}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] font-medium text-[#E5484D] transition hover:bg-[#FDECEF]"
        >
          {department.status === "active" ? (
            <>
              <Power size={14} className="text-[#E5484D]" />
              <span>Deactivate Department</span>
            </>
          ) : (
            <>
              <CheckCircle size={14} className="text-[#0A9189]" />
              <span className="text-[#0A9189]">Activate Department</span>
            </>
          )}
        </button>
      </div>
    </Popover>
  );
}

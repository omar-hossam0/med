"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { modalMotion } from "@/components/transitions/stepper";
import { useDepartments } from "./DepartmentsProvider";
import type { Department } from "@/lib/mock/departments";
import { cn } from "@/lib/cn";

export function DeactivateConfirmDialog({
  department,
  onClose,
}: {
  department: Department | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { toggleDepartmentStatus } = useDepartments();

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (department) {
      previousFocus.current = document.activeElement as HTMLElement | null;

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };

      document.addEventListener("keydown", onKeyDown);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prevOverflow;
        previousFocus.current?.focus?.();
      };
    }
  }, [department, onClose]);

  if (!department) return null;

  const isDeactivating = department.status === "active";

  const handleConfirm = () => {
    toggleDepartmentStatus(department.id);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] grid place-items-center p-4">
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 bg-[#0F2D4A]/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          aria-hidden
        />

        {/* Dialog Box */}
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-dialog-title"
          className="relative z-10 w-full max-w-[430px] rounded-2xl bg-white p-5 shadow-pop"
          {...(reduce ? {} : modalMotion)}
        >
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                isDeactivating
                  ? "bg-[#FDECEF] text-[#EF4444]"
                  : "bg-[#E6FAF7] text-[#0A9189]",
              )}
            >
              {isDeactivating ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <div className="min-w-0">
              <h2
                id="status-dialog-title"
                className="text-[15px] font-bold text-[#0F2D4A]"
              >
                {isDeactivating
                  ? `Deactivate ${department.name}?`
                  : `Activate ${department.name}?`}
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B7C]">
                {isDeactivating
                  ? `Inactive departments are excluded from patient booking and doctor searches. Associated doctors, past appointments, and department settings remain preserved.`
                  : `Activating ${department.name} will make it immediately visible to patients for bookings and doctor searches.`}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-[#FAFDFD] p-3 text-[11px] text-[#5B6B7C]">
            <p>
              <strong className="font-semibold text-[#0F2D4A]">Department:</strong>{" "}
              {department.name}
            </p>
            <p className="mt-1">
              <strong className="font-semibold text-[#0F2D4A]">
                Assigned Doctors:
              </strong>{" "}
              {department.assignedDoctorIds.length} doctors
            </p>
            <p className="mt-1">
              <strong className="font-semibold text-[#0F2D4A]">
                Total Appointments:
              </strong>{" "}
              {department.stats.totalAppointments} records
            </p>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl border border-line px-3.5 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={cn(
                "h-9 rounded-xl px-4 text-[11.5px] font-semibold text-white shadow-sm transition",
                isDeactivating
                  ? "bg-[#EF4444] hover:bg-[#DC2626]"
                  : "bg-[#0A9189] hover:bg-[#087F78]",
              )}
            >
              {isDeactivating ? "Deactivate Department" : "Activate Department"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

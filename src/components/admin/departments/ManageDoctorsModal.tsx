"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, Search, Check } from "lucide-react";
import { modalMotion } from "@/components/transitions/stepper";
import { useDepartments } from "./DepartmentsProvider";
import { useUsers } from "@/components/admin/users/UsersProvider";
import {
  mergeMembers,
  type DoctorMember,
  VERIFICATION_LABEL,
} from "@/lib/mock/doctorsStaff";
import { Avatar } from "@/components/admin/ui";
import type { Department } from "@/lib/mock/departments";
import { cn } from "@/lib/cn";

const VERIFICATION_BADGE_STYLE: Record<string, string> = {
  verified: "bg-[#E6FAF7] text-[#0A9189]",
  pending: "bg-[#FFF6E5] text-[#C77A0A]",
  rejected: "bg-[#FDECEF] text-[#E5484D]",
};

export function ManageDoctorsModal({
  department,
  onClose,
}: {
  department: Department | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { updateDepartmentDoctors } = useDepartments();
  const { users } = useUsers();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // All doctors in Medora (strictly kind === "doctor", no staff or patients)
  const allDoctors = useMemo(() => {
    const members = mergeMembers(users);
    return members.filter((m): m is DoctorMember => m.kind === "doctor");
  }, [users]);

  // Sync initial assignments
  useEffect(() => {
    if (department) {
      setSelectedIds([...department.assignedDoctorIds]);
      setSearch("");
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

  const toggleDoctor = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id],
    );
  };

  const handleSave = () => {
    updateDepartmentDoctors(department.id, selectedIds);
    onClose();
  };

  // Filtered doctors list
  const filteredDoctors = allDoctors.filter((doc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      doc.name.toLowerCase().includes(q) ||
      doc.title.toLowerCase().includes(q) ||
      doc.specialty.toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4 sm:p-6">
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

        {/* Modal Card */}
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-docs-title"
          className="relative z-10 flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-2xl border border-line bg-white shadow-pop"
          {...(reduce ? {} : modalMotion)}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line p-5">
            <div>
              <h2
                id="manage-docs-title"
                className="text-[16px] font-bold text-[#0F2D4A]"
              >
                Manage Doctors — {department.name}
              </h2>
              <p className="mt-0.5 text-[11px] text-[#7A8B9C]">
                Assign or remove doctors from this department.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="grid h-8 w-8 place-items-center rounded-full text-[#7A8B9C] transition hover:bg-surface-subtle hover:text-[#0F2D4A]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search Toolbar */}
          <div className="border-b border-line p-4">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8B9C]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search doctors by name or specialty..."
                className="h-9 w-full rounded-xl border border-line bg-[#FAFDFD] pl-9 pr-3 text-[12px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:bg-white focus:ring-2 focus:ring-[#0A9189]/15"
              />
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-[#7A8B9C]">
              <span>
                {selectedIds.length} of {allDoctors.length} doctors assigned
              </span>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="font-medium text-[#EF4444] hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Doctors List */}
          <div className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {filteredDoctors.map((doc) => {
                const isAssigned = selectedIds.includes(doc.id);
                return (
                  <li
                    key={doc.id}
                    onClick={() => toggleDoctor(doc.id)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition",
                      isAssigned
                        ? "border-[#0A9189]/40 bg-[#FAFDFD] shadow-sm"
                        : "border-line bg-white hover:border-[#0A9189]/20 hover:bg-[#FAFDFD]",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {doc.photoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={doc.photoUrl}
                            alt={doc.name}
                            className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
                          />
                        ) : (
                          <Avatar name={doc.name} size={40} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[12.5px] font-bold text-[#0F2D4A]">
                            {doc.name}
                          </p>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold",
                              VERIFICATION_BADGE_STYLE[doc.verification] ||
                                "bg-surface-subtle text-ink-secondary",
                            )}
                          >
                            • {VERIFICATION_LABEL[doc.verification]}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-[#7A8B9C]">
                          {doc.title || doc.specialty}
                        </p>
                      </div>
                    </div>

                    {/* Checkbox */}
                    <div
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
                        isAssigned
                          ? "border-[#0A9189] bg-[#0A9189] text-white"
                          : "border-line bg-white",
                      )}
                    >
                      {isAssigned && <Check size={13} strokeWidth={3} />}
                    </div>
                  </li>
                );
              })}
            </ul>

            {filteredDoctors.length === 0 && (
              <div className="py-8 text-center text-[12px] text-[#7A8B9C]">
                No doctors found matching &ldquo;{search}&rdquo;.
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-line p-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl border border-line px-4 text-[12px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 rounded-xl bg-[#0A9189] px-5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(10,145,137,0.25)] transition hover:bg-[#087F78]"
            >
              Update Doctors
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

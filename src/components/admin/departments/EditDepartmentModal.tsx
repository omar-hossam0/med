"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { modalMotion } from "@/components/transitions/stepper";
import {
  DepartmentIcon,
  SELECTABLE_ICONS,
} from "./DepartmentIcon";
import { useDepartments } from "./DepartmentsProvider";
import type { Department, DepartmentIconKey, DepartmentStatus } from "@/lib/mock/departments";
import { cn } from "@/lib/cn";

export function EditDepartmentModal({
  department,
  onClose,
}: {
  department: Department | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { departments, updateDepartment } = useDepartments();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<DepartmentIconKey>("heart");
  const [status, setStatus] = useState<DepartmentStatus>("active");
  const [displayOrder, setDisplayOrder] = useState(1);
  const [showAllIcons, setShowAllIcons] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Pre-populate with department data
  useEffect(() => {
    if (department) {
      setName(department.name);
      setDescription(department.description);
      setSelectedIcon(department.icon);
      setStatus(department.status);
      setDisplayOrder(department.displayOrder);
      setShowAllIcons(false);
      setErrors({});
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; description?: string } = {};

    const cleanName = name.trim();
    if (!cleanName) {
      newErrors.name = "Department name is required.";
    } else {
      // Check duplicate name for OTHER departments
      const isDuplicate = departments.some(
        (d) =>
          d.id !== department.id &&
          d.name.trim().toLowerCase() === cleanName.toLowerCase(),
      );
      if (isDuplicate) {
        newErrors.name = `Another department is already named "${cleanName}".`;
      }
    }

    const cleanDesc = description.trim();
    if (!cleanDesc) {
      newErrors.description = "Description is required.";
    } else if (cleanDesc.length > 200) {
      newErrors.description = "Description must be 200 characters or fewer.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateDepartment(department.id, {
      name: cleanName,
      description: cleanDesc,
      icon: selectedIcon,
      status,
      displayOrder: Number(displayOrder) || 1,
    });

    onClose();
  };

  const visibleIcons = showAllIcons
    ? SELECTABLE_ICONS
    : SELECTABLE_ICONS.slice(0, 5);

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
          aria-labelledby="edit-dept-title"
          className="relative z-10 w-full max-w-[500px] rounded-2xl border border-line bg-white p-6 shadow-pop"
          {...(reduce ? {} : modalMotion)}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2
                id="edit-dept-title"
                className="text-[16px] font-bold text-[#0F2D4A]"
              >
                Edit Department
              </h2>
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Top row: Icon preview + Department Name */}
            <div>
              <label
                htmlFor="edit-dept-name"
                className="mb-1 block text-[11.5px] font-semibold text-[#0F2D4A]"
              >
                Department Name <span className="text-[#EF4444]">*</span>
              </label>
              <div className="flex items-center gap-2.5">
                <div className="shrink-0">
                  <DepartmentIcon
                    iconKey={selectedIcon}
                    size={40}
                    iconSize={20}
                  />
                </div>
                <input
                  id="edit-dept-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name)
                      setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  className={cn(
                    "h-10 flex-1 rounded-xl border bg-white px-3.5 text-[12.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:ring-2",
                    errors.name
                      ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/15"
                      : "border-line focus:border-[#0A9189] focus:ring-[#0A9189]/15",
                  )}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-[11px] font-medium text-[#EF4444]">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="edit-dept-desc"
                  className="block text-[11.5px] font-semibold text-[#0F2D4A]"
                >
                  Description <span className="text-[#EF4444]">*</span>
                </label>
                <span
                  className={cn(
                    "text-[10.5px]",
                    description.length > 200
                      ? "font-bold text-[#EF4444]"
                      : "text-[#7A8B9C]",
                  )}
                >
                  {description.length}/200
                </span>
              </div>
              <textarea
                id="edit-dept-desc"
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description)
                    setErrors((prev) => ({ ...prev, description: undefined }));
                }}
                className={cn(
                  "w-full resize-none rounded-xl border bg-white p-3 text-[12px] leading-relaxed text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:ring-2",
                  errors.description
                    ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/15"
                    : "border-line focus:border-[#0A9189] focus:ring-[#0A9189]/15",
                )}
              />
              {errors.description && (
                <p className="mt-1 text-[11px] font-medium text-[#EF4444]">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Icon Selector */}
            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold text-[#0F2D4A]">
                Icon
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {visibleIcons.map((ic) => {
                  const isSelected = selectedIcon === ic.key;
                  return (
                    <button
                      key={ic.key}
                      type="button"
                      onClick={() => setSelectedIcon(ic.key)}
                      title={ic.label}
                      aria-label={ic.label}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative grid h-11 w-11 place-items-center rounded-xl border transition",
                        isSelected
                          ? "border-2 border-[#0A9189] bg-[#E6FAF7] shadow-sm"
                          : "border-line bg-white hover:border-[#0A9189]/40 hover:bg-[#FAFDFD]",
                      )}
                    >
                      <DepartmentIcon
                        iconKey={ic.key}
                        size={32}
                        iconSize={17}
                        className="bg-transparent"
                      />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowAllIcons((v) => !v)}
                className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#0A9189] hover:underline"
              >
                {showAllIcons ? (
                  <>
                    Fewer Icons <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    More Icons <ChevronDown size={13} />
                  </>
                )}
              </button>
            </div>

            {/* Status Toggle (Reference Image 2 Panel 04) */}
            <div className="rounded-xl border border-line bg-[#FAFDFD] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-semibold text-[#0F2D4A]">
                    Status
                  </span>
                  <p className="text-[10.5px] text-[#7A8B9C]">
                    {status === "active"
                      ? "Active (Visible to patients)"
                      : "Inactive (Hidden from patient booking)"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={status === "active"}
                  onClick={() =>
                    setStatus((prev) => (prev === "active" ? "inactive" : "active"))
                  }
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A9189]/20",
                    status === "active" ? "bg-[#0A9189]" : "bg-[#CBD5E1]",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                      status === "active" ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-[#7A8B9C]">
                Inactive departments will be hidden from patient booking.
              </p>
            </div>

            {/* Display Order */}
            <div>
              <label
                htmlFor="edit-display-order"
                className="mb-1 block text-[11.5px] font-semibold text-[#0F2D4A]"
              >
                Display Order
              </label>
              <input
                id="edit-display-order"
                type="number"
                min={1}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                className="h-10 w-full rounded-xl border border-line bg-white px-3.5 text-[12.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
              />
              <p className="mt-1 text-[10px] text-[#7A8B9C]">
                Lower numbers appear first in patient booking.
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-line pt-4">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-xl border border-line px-4 text-[12px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-xl bg-[#0A9189] px-5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(10,145,137,0.25)] transition hover:bg-[#087F78]"
              >
                Save Changes
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

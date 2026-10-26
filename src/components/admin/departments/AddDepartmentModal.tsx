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
import type { DepartmentIconKey } from "@/lib/mock/departments";
import { cn } from "@/lib/cn";

export function AddDepartmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { departments, createDepartment } = useDepartments();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<DepartmentIconKey>("heart");
  const [showAllIcons, setShowAllIcons] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setSelectedIcon("heart");
      setShowAllIcons(false);
      setErrors({});
      previousFocus.current = document.activeElement as HTMLElement | null;

      const t = window.setTimeout(() => {
        panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
      }, 50);

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
        window.clearTimeout(t);
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prevOverflow;
        previousFocus.current?.focus?.();
      };
    }
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; description?: string } = {};

    const cleanName = name.trim();
    if (!cleanName) {
      newErrors.name = "Department name is required.";
    } else {
      // Check duplicates (ignoring case & whitespace)
      const isDuplicate = departments.some(
        (d) => d.name.trim().toLowerCase() === cleanName.toLowerCase(),
      );
      if (isDuplicate) {
        newErrors.name = `A department named "${cleanName}" already exists.`;
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

    createDepartment({
      name: cleanName,
      description: cleanDesc,
      icon: selectedIcon,
      status: "active",
    });

    onClose();
  };

  const visibleIcons = showAllIcons
    ? SELECTABLE_ICONS
    : SELECTABLE_ICONS.slice(0, 5);

  return (
    <AnimatePresence>
      {open && (
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
            aria-labelledby="add-dept-title"
            className="relative z-10 w-full max-w-[480px] rounded-2xl border border-line bg-white p-6 shadow-pop"
            {...(reduce ? {} : modalMotion)}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2
                id="add-dept-title"
                className="text-[16px] font-bold text-[#0F2D4A]"
              >
                Add New Department
              </h2>
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
              {/* Department Name */}
              <div>
                <label
                  htmlFor="new-dept-name"
                  className="mb-1 block text-[11.5px] font-semibold text-[#0F2D4A]"
                >
                  Department Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="new-dept-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="e.g. Cardiology"
                  className={cn(
                    "h-10 w-full rounded-xl border bg-white px-3.5 text-[12.5px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:ring-2",
                    errors.name
                      ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/15"
                      : "border-line focus:border-[#0A9189] focus:ring-[#0A9189]/15",
                  )}
                />
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
                    htmlFor="new-dept-desc"
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
                  id="new-dept-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description)
                      setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  placeholder="Brief description of the department and its services..."
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
                  Create Department
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

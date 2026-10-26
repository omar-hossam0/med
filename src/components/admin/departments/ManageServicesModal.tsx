"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, Plus, GripVertical, Pencil, Trash2, Check } from "lucide-react";
import { modalMotion } from "@/components/transitions/stepper";
import { useDepartments } from "./DepartmentsProvider";
import type { Department } from "@/lib/mock/departments";

export function ManageServicesModal({
  department,
  onClose,
}: {
  department: Department | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { updateDepartmentServices } = useDepartments();

  const [services, setServices] = useState<string[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (department) {
      setServices([...department.services]);
      setNewServiceName("");
      setEditingIndex(null);
      setEditingText("");
      setError(null);
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

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newServiceName.trim();
    if (!clean) {
      setError("Please enter a service name.");
      return;
    }
    if (services.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setError(`"${clean}" is already in the list.`);
      return;
    }

    setServices((prev) => [...prev, clean]);
    setNewServiceName("");
    setError(null);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingText(services[index]);
    setError(null);
  };

  const handleSaveEdit = (index: number) => {
    const clean = editingText.trim();
    if (!clean) {
      setError("Service name cannot be empty.");
      return;
    }
    const isDuplicate = services.some(
      (s, i) => i !== index && s.toLowerCase() === clean.toLowerCase(),
    );
    if (isDuplicate) {
      setError(`"${clean}" already exists.`);
      return;
    }

    setServices((prev) => prev.map((s, i) => (i === index ? clean : s)));
    setEditingIndex(null);
    setEditingText("");
    setError(null);
  };

  const handleRemove = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingText("");
    }
  };

  const handleSaveAll = () => {
    updateDepartmentServices(department.id, services);
    onClose();
  };

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
          aria-labelledby="manage-services-title"
          className="relative z-10 flex max-h-[85vh] w-full max-w-[500px] flex-col rounded-2xl border border-line bg-white shadow-pop"
          {...(reduce ? {} : modalMotion)}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line p-5">
            <div>
              <h2
                id="manage-services-title"
                className="text-[16px] font-bold text-[#0F2D4A]"
              >
                Manage Services — {department.name}
              </h2>
              <p className="mt-0.5 text-[11px] text-[#7A8B9C]">
                Manage department services and specialties.
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

          {/* Add Service Bar */}
          <div className="border-b border-line p-4">
            <form onSubmit={handleAdd} className="flex items-center gap-2">
              <input
                type="text"
                value={newServiceName}
                onChange={(e) => {
                  setNewServiceName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Add a new service or specialty..."
                className="h-9 flex-1 rounded-xl border border-line bg-[#FAFDFD] px-3.5 text-[12px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:bg-white focus:ring-2 focus:ring-[#0A9189]/15"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#E6FAF7] px-3.5 text-[12px] font-semibold text-[#0A9189] transition hover:bg-[#D5F5EF]"
              >
                <Plus size={14} />
                Add
              </button>
            </form>
            {error && (
              <p className="mt-2 text-[11px] font-medium text-[#EF4444]">{error}</p>
            )}
          </div>

          {/* Services List */}
          <div className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {services.map((svc, index) => {
                const isEditing = editingIndex === index;
                return (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-line bg-[#FAFDFD] px-3 py-2 text-[12px] transition hover:border-[#0A9189]/30"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                      <span className="text-[#9AA9B8] cursor-grab">
                        <GripVertical size={14} />
                      </span>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(index);
                              if (e.key === "Escape") setEditingIndex(null);
                            }}
                            autoFocus
                            className="h-7 flex-1 rounded-lg border border-[#0A9189] bg-white px-2 text-[11.5px] text-[#0F2D4A] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(index)}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-[#0A9189] text-white hover:bg-[#087F78]"
                            title="Save"
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="truncate font-medium text-[#0F2D4A]">
                          {svc}
                        </span>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(index)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-[#7A8B9C] transition hover:bg-white hover:text-[#0A9189]"
                          title="Edit service"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(index)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-[#7A8B9C] transition hover:bg-[#FDECEF] hover:text-[#EF4444]"
                          title="Remove service"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {services.length === 0 && (
              <div className="py-8 text-center text-[12px] text-[#7A8B9C]">
                No services added yet. Type a service above and click Add.
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
              onClick={handleSaveAll}
              className="h-9 rounded-xl bg-[#0A9189] px-5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(10,145,137,0.25)] transition hover:bg-[#087F78]"
            >
              Save Services
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

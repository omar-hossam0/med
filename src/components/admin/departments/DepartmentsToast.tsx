"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { useDepartments } from "./DepartmentsProvider";
import { cn } from "@/lib/cn";

export function DepartmentsToast() {
  const { toast, hideToast } = useDepartments();

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        hideToast();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible, hideToast]);

  return (
    <AnimatePresence>
      {toast.visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-[120] flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-pop"
          role="status"
          aria-live="polite"
        >
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full text-white",
              toast.type === "success" && "bg-[#0A9189]",
              toast.type === "info" && "bg-[#3B82F6]",
              toast.type === "error" && "bg-[#EF4444]",
            )}
          >
            {toast.type === "success" && <CheckCircle2 size={16} />}
            {toast.type === "info" && <Info size={16} />}
            {toast.type === "error" && <AlertTriangle size={16} />}
          </span>

          <p className="min-w-0 flex-1 text-[12px] font-medium text-[#0F2D4A]">
            {toast.message}
          </p>

          <button
            type="button"
            onClick={hideToast}
            aria-label="Dismiss notification"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#7A8B9C] hover:bg-surface-subtle"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

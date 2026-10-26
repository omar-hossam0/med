"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { modalMotion } from "@/components/transitions/stepper";
import { cn } from "@/lib/cn";

/**
 * Shared accessible dialog shell for the Patient Appointments module.
 * Handles Escape, backdrop dismissal, body scroll lock, focus restore and a
 * simple focus trap; motion values come from the existing transitions folder.
 */
export function ModalShell({
  open,
  onClose,
  labelledBy,
  children,
  maxWidth = "max-w-[520px]",
  closeLabel = "Close dialog",
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  maxWidth?: string;
  closeLabel?: string;
  panelClassName?: string;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;

      const focusable = Array.from(nodes).filter((node) => node.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus?.();
    };
    // `onClose` is read from a ref on purpose: parent re-renders (toast
    // auto-dismiss, state updates) must not re-run this effect and steal focus.
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] grid place-items-center p-3 sm:p-4">
          <motion.div
            className="fixed inset-0 bg-[#0F2D4A]/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className={cn(
              "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-pop outline-none",
              maxWidth,
              panelClassName,
            )}
            {...(reduce ? {} : modalMotion)}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full text-[#7A8B9C] transition hover:bg-[#F1F7F7] hover:text-[#0F2D4A]"
            >
              <X size={16} />
            </button>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

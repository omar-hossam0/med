"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { modalMotion } from "@/components/transitions/stepper";
import { cn } from "@/lib/cn";

/**
 * Shared dialog for administrative actions.
 *
 * Mirrors ConfirmDialog's behaviour (focus trap, Escape, scroll lock, focus
 * restoration) but accepts arbitrary content, so status changes and one-time
 * links do not each reimplement the mechanics.
 */
export function ActionDialog({
  open,
  title,
  description,
  onClose,
  children,
  confirmLabel,
  onConfirm,
  submitting = false,
  error = null,
  tone = "default",
  confirmDisabled = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  submitting?: boolean;
  error?: string | null;
  tone?: "default" | "danger";
  confirmDisabled?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  // Keep the latest callback without re-running the focus/scroll effect when a
  // parent re-renders (for example after "Copy link" sets local state).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("[data-autofocus]")
        ?.focus();
    }, 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab" && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (nodes.length === 0) return;

        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-[#0F2D4A]/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-dialog-title"
            className="relative w-full max-w-[440px] rounded-2xl bg-white p-5 shadow-pop"
            {...modalMotion}
          >
            <h2 id="action-dialog-title" className="text-[15px] font-bold text-[#0F2D4A]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B7C]">
                {description}
              </p>
            )}

            {children && <div className="mt-4">{children}</div>}

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-[#E5484D]/30 bg-[#FDECEF] px-3 py-2 text-[10.5px] leading-relaxed text-[#B42318]"
              >
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="h-9 rounded-xl border border-line px-3.5 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                data-autofocus
                onClick={onConfirm}
                disabled={submitting || confirmDisabled}
                className={cn(
                  "h-9 rounded-xl px-3.5 text-[11.5px] font-semibold text-white transition disabled:opacity-60",
                  tone === "danger"
                    ? "bg-[#E5484D] hover:bg-[#CC3B40]"
                    : "bg-[linear-gradient(90deg,#0A9189_0%,#16B8AA_100%)] shadow-[0_8px_18px_-8px_rgba(10,145,137,0.7)] hover:brightness-110",
                )}
              >
                {submitting ? "Working…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

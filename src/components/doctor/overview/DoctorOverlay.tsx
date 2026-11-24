"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Overlay primitives for the Doctor Overview.
 *
 * `variant="sheet"` is the right-side appointment drawer; `variant="dialog"`
 * is the centred patient quick profile. Both share Escape handling, backdrop
 * dismissal, body scroll lock, focus containment and focus restoration.
 */

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: "sheet" | "dialog";
  /** Dialog only: `xl` is the wide two-column appointment panel. */
  size?: "md" | "xl";
  children: ReactNode;
  footer?: ReactNode;
};

export function DoctorOverlay({
  open,
  onClose,
  title,
  description,
  variant = "sheet",
  size = "md",
  children,
  footer,
}: OverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  // Callers pass inline arrows; keep the handler stable so the effect below
  // does not re-run (and steal focus) on every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
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
      const restore = restoreFocusRef.current;
      if (restore instanceof HTMLElement) restore.focus();
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute inset-0 cursor-default bg-[#0F2D4A]/35 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="doctor-overlay-title"
        className={cn(
          "absolute bg-white shadow-[-20px_0_60px_-30px_rgba(15,45,74,0.5)] transition-all duration-200 ease-out",
          variant === "sheet"
            ? "right-0 top-0 flex h-full w-full max-w-[400px] flex-col"
            : cn(
                "left-1/2 top-1/2 flex max-h-[86vh] w-[calc(100%-24px)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl shadow-[0_30px_80px_-40px_rgba(15,45,74,0.6)]",
                size === "xl" ? "max-w-[1000px]" : "max-w-[680px]",
              ),
          visible
            ? variant === "sheet"
              ? "translate-x-0 opacity-100"
              : "-translate-y-1/2 opacity-100"
            : variant === "sheet"
              ? "translate-x-full opacity-100"
              : "-translate-y-1/2 scale-[0.98] opacity-0",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#EDF3F3] px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="doctor-overlay-title" className="text-[13px] font-semibold text-[#0F2D4A]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-[54ch] text-[10px] leading-relaxed text-[#7187A6]">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#5B6B7C] transition-colors duration-150 hover:bg-[#F1F6F6] hover:text-[#0F2D4A]"
          >
            <X size={15} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer className="border-t border-[#EDF3F3] px-5 py-3.5">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

export function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="flex items-center gap-1.5 text-[10px] text-[#7187A6]">
        {Icon ? <Icon size={11} aria-hidden className="text-[#9AA9B8]" /> : null}
        {label}
      </dt>
      <dd className="max-w-[60%] text-right text-[10.5px] font-semibold leading-snug text-[#0F2D4A]">
        {value}
      </dd>
    </div>
  );
}

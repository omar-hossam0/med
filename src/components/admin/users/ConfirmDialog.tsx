"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShieldCheck } from "lucide-react";
import { modalMotion } from "@/components/transitions/stepper";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  name,
  email,
  roleLabel,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  name: string;
  email: string;
  roleLabel: string;
  submitting?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;

    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLButtonElement>("[data-autofocus]")
        ?.focus();
    }, 20);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
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
  }, [open, onClose]);

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
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            className="relative w-full max-w-[430px] rounded-2xl bg-white p-5 shadow-pop"
            {...modalMotion}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E6FAF7] text-[#0A9189]">
                <ShieldCheck size={20} />
              </span>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-[15px] font-bold text-[#0F2D4A]">
                  Confirm User Creation
                </h2>
                <p id="confirm-desc" className="mt-0.5 text-[11.5px] leading-relaxed text-[#5B6B7C]">
                  Are you sure you want to add this {roleLabel.toLowerCase()} account to Medora?
                </p>
              </div>
            </div>

            <dl className="mt-4 space-y-2 rounded-xl border border-line bg-[#FAFDFD] p-3">
              <Row label="Name" value={name || "—"} />
              <Row label="Email" value={email || "—"} />
              <Row label="Role" value={roleLabel} />
              <Row label="Initial status" value="Pending Invitation" />
            </dl>

            <p className="mt-3 rounded-lg bg-[#FFF9EC] px-3 py-2 text-[10px] leading-relaxed text-[#8A6420]">
              Demo only — this adds the account to the local list. No database record or invitation email is created.
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="h-9 rounded-xl border border-line px-3.5 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle disabled:opacity-50"
              >
                Back to Review
              </button>
              <button
                type="button"
                data-autofocus
                onClick={onConfirm}
                disabled={submitting}
                className="h-9 rounded-xl bg-[linear-gradient(90deg,#0A9189_0%,#16B8AA_100%)] px-3.5 text-[11.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(10,145,137,0.7)] transition hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Confirm & Create"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <dt className="text-[#7A8B9C]">{label}</dt>
      <dd className="truncate font-medium text-[#0F2D4A]">{value}</dd>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
  MoreHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

export function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#E6EFEE] bg-white shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function BackLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5B6B7C] transition hover:text-[#0A9189]"
    >
      <ArrowLeft size={13} aria-hidden />
      {label}
    </button>
  );
}

export function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2", className)}>
      <span className="text-[10.5px] text-[#7187A6]">{label}</span>
      <span className="text-right text-[11.5px] font-semibold leading-snug text-[#0F2D4A]">
        {value}
      </span>
    </div>
  );
}

export function InfoNote({
  children,
  tone = "mint",
}: {
  children: ReactNode;
  tone?: "mint" | "amber" | "rose";
}) {
  const styles = {
    mint: "border-[#D7EFEA] bg-[#F7FCFB] text-[#4F6472]",
    amber: "border-[#F7E3BD] bg-[#FFFBF3] text-[#8A5B12]",
    rose: "border-[#FFD7DD] bg-[#FFF5F7] text-[#A83A4C]",
  } as const;

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[9.5px] leading-relaxed",
        styles[tone],
      )}
    >
      <Info size={12} className="mt-[1px] shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#EAFBF8] text-[#0A9189]">
        <Icon size={22} aria-hidden />
      </span>
      <h3 className="mt-3 text-[13.5px] font-semibold text-[#0F2D4A]">{title}</h3>
      <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-[#7187A6]">
        {description}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* More actions menu                                                   */
/* ------------------------------------------------------------------ */

export type MenuAction = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
};

export function MoreMenu({
  actions,
  label = "More actions",
  className,
}: {
  actions: MenuAction[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="grid h-8 w-8 place-items-center rounded-lg border border-[#E6EFEE] bg-white text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
      >
        <MoreHorizontal size={16} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-[#E6EFEE] bg-white py-1 shadow-[0_18px_44px_-24px_rgba(15,45,74,0.45)]"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[10.5px] font-medium transition",
                  action.danger
                    ? "text-[#E5484D] hover:bg-[#FFF5F6]"
                    : "text-[#33475B] hover:bg-[#F6FAFA] hover:text-[#0A9189]",
                )}
              >
                {Icon ? <Icon size={13} aria-hidden /> : null}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

export type ToastTone = "success" | "error" | "info";

export type ToastState = {
  id: number;
  message: string;
  tone: ToastTone;
};

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | null;
  onClose: () => void;
}) {
  if (!toast) return null;

  const Icon =
    toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertTriangle : Info;
  const tone =
    toast.tone === "success"
      ? "bg-[#EAFBF8] text-[#0A9189]"
      : toast.tone === "error"
        ? "bg-[#FFF1F3] text-[#E5484D]"
        : "bg-[#EFF4FF] text-[#2563EB]";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[120] flex max-w-[340px] items-start gap-2.5 rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_20px_50px_-24px_rgba(15,45,74,0.45)]"
    >
      <span className={cn("mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-full", tone)}>
        <Icon size={14} aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-[#33475B]">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#9AA9B8] transition hover:bg-[#F1F7F7] hover:text-[#0F2D4A]"
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Download helpers                                                    */
/* ------------------------------------------------------------------ */

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function demoExport(title: string, lines: string[]): string {
  return [
    "MEDORA HEALTHCARE — DEMO EXPORT",
    "This file was generated locally by the patient dashboard demo.",
    "It is not an official medical document.",
    "",
    title,
    "".padEnd(title.length, "="),
    ...lines,
    "",
    "End of demo export.",
  ].join("\n");
}

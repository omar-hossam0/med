"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Info, Sparkles, type LucideIcon } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import {
  PROCESSING_LABEL,
  WORKFLOW_LABEL,
  type ProcessingStatus,
  type WorkflowStatus,
} from "@/lib/mock/aiMonitoring";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white shadow-soft", className)}>
      {children}
    </section>
  );
}

const WORKFLOW_STYLES: Record<WorkflowStatus, string> = {
  approved: "bg-[#E9F9EF] text-[#1E9E56]",
  awaiting_review: "bg-[#FFF6E5] text-[#C77A0A]",
  draft: "bg-[#F1F5F9] text-[#64748B]",
};

const PROCESSING_STYLES: Record<ProcessingStatus, { badge: string; dot: string }> = {
  success: { badge: "bg-[#E9F9EF] text-[#1E9E56]", dot: "bg-[#1E9E56]" },
  failed: { badge: "bg-[#FDECEF] text-[#E5484D]", dot: "bg-[#E5484D]" },
  queued: { badge: "bg-[#F1F5F9] text-[#64748B]", dot: "bg-[#94A3B8]" },
  processing: { badge: "bg-[#EFF4FF] text-[#3B6EF6]", dot: "bg-[#3B6EF6]" },
};

export function WorkflowBadge({ status }: { status: WorkflowStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
        WORKFLOW_STYLES[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {WORKFLOW_LABEL[status]}
    </span>
  );
}

export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  const style = PROCESSING_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
        style.badge,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {PROCESSING_LABEL[status]}
    </span>
  );
}

export function DemoChip({ label = "Demo data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#CFE9E5] bg-[#F1FBF9] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#0A9189]">
      <Sparkles size={9} />
      {label}
    </span>
  );
}

export function SimulatedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 border-t border-line/70 px-3.5 py-2 text-[9px] leading-relaxed text-[#9AA9B8]">
      <Info size={11} className="mt-px shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

type RangeOption<T extends string> = { value: T; label: string; days?: number };

export function RangeSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  display,
  icon: Icon,
  compact = false,
  className,
}: {
  value: T;
  options: RangeOption<T>[];
  onChange: (value: T) => void;
  label: string;
  display?: string;
  icon?: LucideIcon;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    const raf = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, selectedIndex]);

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
    anchorRef.current?.focus();
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(options.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option.value);
    }
  };

  const selected = options[selectedIndex];

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white font-medium text-[#5B6B7C] transition hover:bg-surface-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
          compact ? "h-8 px-2.5 text-[10.5px]" : "h-9 px-3 text-[11px]",
          className,
        )}
      >
        {Icon && <Icon size={12} className="shrink-0 text-[#0A9189]" aria-hidden />}
        <span className="whitespace-nowrap">{display ?? selected?.label ?? label}</span>
        <ChevronDown
          size={12}
          aria-hidden
          className={cn("shrink-0 text-[#9AA9B8] transition-transform", open && "rotate-180")}
        />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        matchWidth
        estimatedHeight={options.length * 34 + 14}
        className="p-1.5"
      >
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={onListKeyDown}
          className="outline-none"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition",
                  index === active ? "bg-primary-50 text-primary-dark" : "text-[#0F2D4A]",
                  isSelected && "font-semibold",
                )}
              >
                {option.label}
                {isSelected && <Check size={12} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}

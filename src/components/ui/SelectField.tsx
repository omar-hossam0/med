"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

type Props = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  options: SelectOption[];
  icon?: LucideIcon;
  iconClassName?: string;
  /** Trigger height in px (defaults to 50 to match the auth fields). */
  height?: number;
};

/**
 * Accessible animated select that reuses the Sign Up page's selection
 * component styling and motion (same Popover, listbox, hover and check states).
 */
export function SelectField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  options,
  icon: Icon,
  iconClassName = "text-ink-muted",
  height = 50,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : "";

  useEffect(() => {
    if (open) {
      setActive(selectedIndex >= 0 ? selectedIndex : 0);
      requestAnimationFrame(() => listRef.current?.focus());
    }
  }, [open, selectedIndex]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    anchorRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) choose(options[active].value);
    }
  };

  return (
    <div>
      <button
        id={id}
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        style={{ height }}
        className={cn(
          "relative flex w-full items-center rounded-xl border bg-white pl-9 pr-9 text-left text-[12.5px] outline-none transition-all",
          error
            ? "border-[#E5484D]/50 focus-visible:border-[#E5484D] focus-visible:ring-4 focus-visible:ring-[#E5484D]/10"
            : "border-line hover:border-primary/40 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10",
        )}
      >
        {Icon && (
          <Icon
            size={14}
            aria-hidden
            className={cn("pointer-events-none absolute left-3 top-1/2 -translate-y-1/2", iconClassName)}
          />
        )}
        <span className={cn("truncate", value ? "text-navy" : "text-ink-muted/80")}>
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[10px] font-medium text-[#E5484D]">
          {error}
        </p>
      )}

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        matchWidth
        estimatedHeight={options.length * 40 + 16}
        className="p-1.5"
      >
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={onListKey}
          className="max-h-[260px] overflow-y-auto outline-none"
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] transition",
                  i === active ? "bg-primary-50 text-primary-dark" : "text-navy",
                  isSel && "font-semibold",
                )}
              >
                {o.label}
                {isSel && <Check size={14} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}

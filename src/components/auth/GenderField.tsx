"use client";

import { useEffect, useRef, useState } from "react";
import { User, ChevronDown, Check } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];

type Props = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
};

export function GenderField({ id, label, placeholder, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIndex = OPTIONS.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? OPTIONS[selectedIndex].label : "";

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
      setActive((a) => Math.min(a + 1, OPTIONS.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(OPTIONS.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(OPTIONS[active].value);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
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
        className={cn(
          "relative flex h-[50px] w-full items-center rounded-[14px] border bg-white pl-10 pr-9 text-left text-[13.5px] outline-none transition-all",
          error
            ? "border-red-300 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-100"
            : "border-line hover:border-primary/40 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10",
        )}
      >
        <User
          size={17}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <span className={cn("truncate", value ? "text-navy" : "text-ink-muted/80")}>
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {error && (
        <p id={`${id}-error`} className="mt-1 pl-1 text-[11.5px] font-medium text-red-500">
          {error}
        </p>
      )}

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        matchWidth
        estimatedHeight={OPTIONS.length * 40 + 16}
        className="p-1.5"
      >
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={onListKey}
          className="outline-none"
        >
          {OPTIONS.map((o, i) => {
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
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] transition",
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

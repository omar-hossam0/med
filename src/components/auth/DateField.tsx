"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const formatDisplay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type Props = {
  id: string;
  label: string;
  placeholder: string;
  value: string; // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  error?: string;
  /** Optional field height in px (defaults to 50 to preserve auth pages). */
  height?: number;
  /** Optional icon colour class (defaults to the muted auth style). */
  iconClassName?: string;
};

export function DateField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  height = 50,
  iconClassName = "text-ink-muted",
}: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [cursor, setCursor] = useState<Date>(() => selected ?? new Date());
  const [view, setView] = useState<"days" | "months" | "years">("days");

  const today = startOfDay(new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const years: number[] = [];
  for (let y = today.getFullYear(); y >= 1900; y--) years.push(y);

  const isFuture = (d: number) => new Date(year, month, d) > today;
  const isSelected = (d: number) =>
    !!selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === d;
  const isToday = (d: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === d;

  const pickDay = (d: number) => {
    if (isFuture(d)) return;
    onChange(toISO(year, month, d));
    setOpen(false);
  };

  const openPicker = () => {
    setCursor(selected ?? new Date());
    setView("days");
    setOpen(true);
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
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ height }}
        className={cn(
          "relative flex w-full items-center rounded-[14px] border bg-white pl-10 pr-3 text-left text-[13.5px] outline-none transition-all",
          error
            ? "border-red-300 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-100"
            : "border-line hover:border-primary/40 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10",
        )}
      >
        <Calendar
          size={17}
          aria-hidden
          className={cn("pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2", iconClassName)}
        />
        <span className={cn("truncate", value ? "text-navy" : "text-ink-muted/80")}>
          {value ? formatDisplay(value) : placeholder}
        </span>
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
        width={300}
        estimatedHeight={352}
        className="p-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-1 px-1 pb-2">
          {view === "days" && (
            <>
              <NavBtn label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
                <ChevronLeft size={16} />
              </NavBtn>
              <button
                type="button"
                onClick={() => setView("months")}
                className="rounded-lg px-2 py-1 text-[13px] font-semibold text-navy transition hover:bg-primary-50"
              >
                {MONTHS[month]} {year}
              </button>
              <NavBtn label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}>
                <ChevronRight size={16} />
              </NavBtn>
            </>
          )}
          {view === "months" && (
            <>
              <NavBtn label="Previous year" onClick={() => setCursor(new Date(year - 1, month, 1))}>
                <ChevronLeft size={16} />
              </NavBtn>
              <button
                type="button"
                onClick={() => setView("years")}
                className="rounded-lg px-2 py-1 text-[13px] font-semibold text-navy transition hover:bg-primary-50"
              >
                {year}
              </button>
              <NavBtn label="Next year" onClick={() => setCursor(new Date(year + 1, month, 1))}>
                <ChevronRight size={16} />
              </NavBtn>
            </>
          )}
          {view === "years" && (
            <span className="px-2 py-1 text-[13px] font-semibold text-navy">
              Select year
            </span>
          )}
        </div>

        {/* Days view */}
        {view === "days" && (
          <div>
            <div className="grid grid-cols-7 pb-1">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="grid h-7 place-items-center text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted"
                >
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((d, i) => {
                if (d === null)
                  return <span key={`e${i}`} className="h-8" aria-hidden />;
                const disabled = isFuture(d);
                const sel = isSelected(d);
                const tod = isToday(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDay(d)}
                    aria-label={new Date(year, month, d).toDateString()}
                    aria-current={sel ? "date" : undefined}
                    className={cn(
                      "grid h-8 w-full place-items-center rounded-lg text-[12.5px] transition",
                      disabled && "cursor-not-allowed text-ink-muted/40",
                      !disabled && !sel && "text-navy hover:bg-primary-50",
                      tod && !sel && "font-semibold text-primary-dark",
                      sel && "bg-primary font-semibold text-white",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Months view */}
        {view === "months" && (
          <div className="grid grid-cols-3 gap-1.5 py-1">
            {MONTHS_SHORT.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setCursor(new Date(year, i, 1));
                  setView("days");
                }}
                className={cn(
                  "rounded-lg py-2 text-[12.5px] font-medium transition",
                  i === month
                    ? "bg-primary text-white"
                    : "text-navy hover:bg-primary-50",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Years view */}
        {view === "years" && (
          <div className="max-h-[220px] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-1.5">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setCursor(new Date(y, month, 1));
                    setView("months");
                  }}
                  className={cn(
                    "rounded-lg py-2 text-[12.5px] font-medium transition",
                    y === year
                      ? "bg-primary text-white"
                      : "text-navy hover:bg-primary-50",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="rounded-lg px-2 py-1 text-[12px] font-medium text-ink-secondary transition hover:text-primary-dark"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor(today);
              onChange(toISO(today.getFullYear(), today.getMonth(), today.getDate()));
              setOpen(false);
            }}
            className="rounded-lg px-2 py-1 text-[12px] font-semibold text-primary-dark transition hover:text-primary"
          >
            Today
          </button>
        </div>
      </Popover>
    </div>
  );
}

function NavBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-lg text-ink-secondary transition hover:bg-primary-50 hover:text-primary-dark"
    >
      {children}
    </button>
  );
}

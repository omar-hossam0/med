"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  dateFromKey,
  isClosedDay,
  isPastDay,
  startOfMonth,
  toDateKey,
} from "@/lib/mock/appointments";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Compact month calendar used by the booking view and the reschedule dialog.
 * Sundays and past dates are disabled; the caller can add further rules.
 */
export function Calendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  minDate,
  markedDateKey,
  isDateDisabled,
  compact = false,
}: {
  month: Date;
  onMonthChange: (next: Date) => void;
  selected: string | null;
  onSelect: (dateKey: string) => void;
  minDate: Date;
  markedDateKey?: string;
  isDateDisabled?: (date: Date) => boolean;
  compact?: boolean;
}) {
  const firstOfMonth = startOfMonth(month);
  const canGoBack = firstOfMonth.getTime() > startOfMonth(minDate).getTime();

  const cells = useMemo(() => {
    const year = firstOfMonth.getFullYear();
    const monthIndex = firstOfMonth.getMonth();
    const firstWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const total = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: total }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      const date = new Date(year, monthIndex, dayNumber);
      return {
        date,
        inMonth: dayNumber >= 1 && dayNumber <= daysInMonth,
      };
    });
  }, [firstOfMonth]);

  const todayKey = toDateKey(new Date());

  return (
    <div>
      <div className="flex items-center justify-between gap-2 pb-2">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="grid h-7 w-7 place-items-center rounded-full border border-[#E6EFEE] text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:bg-[#F1FBFA] hover:text-[#0A9189] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeft size={14} />
        </button>
        <p aria-live="polite" className="text-[12px] font-semibold text-[#0F2D4A]">
          {month.toLocaleString("en-US", { month: "long" })} {month.getFullYear()}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="Next month"
          className="grid h-7 w-7 place-items-center rounded-full border border-[#E6EFEE] text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:bg-[#F1FBFA] hover:text-[#0A9189]"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div
        role="grid"
        aria-label={`${month.toLocaleString("en-US", { month: "long" })} ${month.getFullYear()}`}
        className="grid grid-cols-7 gap-y-1"
      >
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            role="columnheader"
            className="pb-1 text-center text-[9px] font-semibold uppercase tracking-[0.06em] text-[#9AA9B8]"
          >
            {weekday.slice(0, 3)}
          </div>
        ))}

        {cells.map(({ date, inMonth }) => {
          const key = toDateKey(date);
          const disabled =
            !inMonth ||
            isPastDay(date, minDate) ||
            (isDateDisabled ? isDateDisabled(date) : isClosedDay(date));
          const isSelected = selected === key;
          const isToday = todayKey === key;
          const isMarked = markedDateKey === key;

          return (
            <div key={key} role="gridcell" className="flex justify-center">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(key)}
                aria-label={dateFromKey(key).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "relative grid place-items-center rounded-full font-medium transition",
                  compact ? "h-8 w-8 text-[11px]" : "h-8 w-8 text-[11px] sm:h-9 sm:w-9 sm:text-[11.5px]",
                  disabled
                    ? "cursor-not-allowed text-[#C4D0D6]"
                    : isSelected
                      ? "bg-[#0A9189] font-semibold text-white shadow-[0_6px_14px_-6px_rgba(10,145,137,0.7)]"
                      : "text-[#33475B] hover:bg-[#EAFBF8] hover:text-[#0A9189]",
                  !isSelected && isToday && !disabled && "ring-1 ring-inset ring-[#0A9189]/45",
                )}
              >
                {date.getDate()}
                {isMarked && !isSelected && (
                  <span className="absolute bottom-[3px] h-1 w-1 rounded-full bg-[#F5A623]" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

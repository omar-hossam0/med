"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMonthTitle, fromISO, monthGrid, todayISO } from "@/lib/mock/doctorSchedule";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Compact month calendar for My Schedule.
 *
 * Local state only: the visible month follows the selected day, and the month
 * arrows move the view without changing the selection until a day is clicked.
 */
export function ScheduleCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const today = todayISO();
  const [month, setMonth] = useState(() => `${value.slice(0, 7)}-01`);

  useEffect(() => {
    setMonth(`${value.slice(0, 7)}-01`);
  }, [value]);

  const cells = useMemo(() => monthGrid(month), [month]);

  const shiftMonth = (delta: number) => {
    const base = fromISO(month);
    const next = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  };

  return (
    <section className="w-full max-w-[360px] rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-[#0F2D4A]">{formatMonthTitle(month)}</h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="grid h-7 w-7 place-items-center rounded-lg text-[#7A8CA0] transition-colors hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="grid h-7 w-7 place-items-center rounded-lg text-[#7A8CA0] transition-colors hover:bg-[#F1F7F6] hover:text-[#0F2D4A]"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="text-center text-[9px] font-semibold uppercase tracking-[0.04em] text-[#9AA9B8]"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-0.5">
        {cells.map((cell) => {
          if (!cell.inMonth) {
            return <span key={cell.iso} aria-hidden className="h-8 w-8" />;
          }
          const isSelected = cell.iso === value;
          const isToday = cell.iso === today;
          const isWeekend = [0, 6].includes(fromISO(cell.iso).getDay());

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onChange(cell.iso)}
              aria-pressed={isSelected}
              aria-label={cell.iso}
              className={cn(
                "mx-auto grid h-8 w-8 place-items-center rounded-full text-[11.5px] transition-colors duration-150",
                !isSelected && "text-[#33475B] hover:bg-[#F1F7F6]",
                isWeekend && !isSelected && "text-[#8A9AAA]",
                isToday &&
                  !isSelected &&
                  "font-bold text-[#0A9189] ring-1 ring-inset ring-[#BFE8E2]",
                isSelected &&
                  "bg-[#0A9189] font-semibold text-white shadow-[0_8px_16px_-10px_rgba(10,145,137,0.9)]",
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </section>
  );
}

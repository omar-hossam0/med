"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** Visible button label / content */
  children: React.ReactNode;
  /** Message revealed on click (demo-only feedback) */
  message: string;
  className?: string;
};

/**
 * Small client-side control used where a real destination does not exist yet
 * (e.g. "Create Account"). Reveals a short, clearly-labelled demo note instead
 * of navigating to a non-existent page or faking authentication.
 */
export function DemoAction({ children, message, className }: Props) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClick = () => {
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 3400);
  };

  return (
    <span className="relative inline-flex">
      <button type="button" onClick={handleClick} className={className}>
        {children}
      </button>
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-[240px] -translate-x-1/2 rounded-xl bg-navy px-3 py-2 text-center text-[12px] font-medium leading-snug text-white shadow-pop transition-all duration-200",
          show
            ? "translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0",
        )}
      >
        {message}
      </span>
    </span>
  );
}

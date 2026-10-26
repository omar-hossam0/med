"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const ComingSoonCtx = createContext<(label?: string) => void>(() => {});

/** Returns a function that shows a lightweight "coming soon" toast. */
export function useComingSoon() {
  return useContext(ComingSoonCtx);
}

/**
 * Frontend-only phase: actions that depend on future pages/backend show a
 * neutral, non-destructive "coming soon" message instead of navigating to
 * broken routes or faking success.
 */
export function ComingSoonProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const notify = useCallback((label?: string) => {
    setMessage(label ? `${label} is coming soon.` : "This feature is coming soon.");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2400);
  }, []);

  return (
    <ComingSoonCtx.Provider value={notify}>
      {children}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-navy px-4 py-2 text-[12.5px] font-medium text-white shadow-pop"
        >
          {message}
        </div>
      )}
    </ComingSoonCtx.Provider>
  );
}

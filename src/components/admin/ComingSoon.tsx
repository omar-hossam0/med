"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const ComingSoonCtx = createContext<(label?: string) => void>(() => {});

export function useComingSoon() {
  return useContext(ComingSoonCtx);
}

/**
 * Admin UI-only phase: future destinations show a neutral "coming soon"
 * toast instead of navigating to missing routes or faking actions.
 */
export function AdminComingSoonProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

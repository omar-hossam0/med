"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Match the anchor width (used by the select). */
  matchWidth?: boolean;
  /** Fixed popover width in px (used by the calendar). */
  width?: number;
  estimatedHeight?: number;
  className?: string;
};

/**
 * Portal-based popover: renders to <body> so it is never clipped by the auth
 * card's `overflow-hidden`, positions itself under the anchor (flipping above
 * when there is no room), and animates open/close with Motion.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  matchWidth = false,
  width,
  estimatedHeight = 300,
  className,
}: Props) {
  const reduce = useReducedMotion();
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width?: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Position relative to the anchor, clamped to the viewport.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const popH = popRef.current?.offsetHeight ?? estimatedHeight;
      const popW = width ?? (matchWidth ? r.width : (popRef.current?.offsetWidth ?? 280));

      let left = r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));

      let top = r.bottom + 8;
      if (top + popH > window.innerHeight - 8) {
        top = Math.max(8, r.top - popH - 8);
      }
      setPos({ top, left, width: width ?? (matchWidth ? r.width : undefined) });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef, matchWidth, width, estimatedHeight]);

  // Outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose, anchorRef]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popRef}
          role="dialog"
          initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed",
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            width: pos?.width,
            visibility: pos ? "visible" : "hidden",
          }}
          className={cn(
            "z-[120] rounded-2xl border border-line bg-white shadow-pop",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

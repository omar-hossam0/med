"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Progressive-enhancement scroll reveal.
 *
 * Content is fully visible in the server-rendered HTML. Only after hydration,
 * and only when the element starts below the viewport, do we opt it into the
 * hidden state and observe it once. This guarantees:
 *
 * - no hydration mismatch and no flash of hidden content;
 * - no permanently hidden content if JavaScript or IntersectionObserver fails;
 * - reduced-motion users never see the hidden state at all;
 * - elements already on screen (including a restored scroll position) are
 *   left untouched, so readability is never delayed.
 *
 * Animates only `opacity` and the independent `translate` property, so it can
 * never clobber a child's existing `transform` (hover elevation etc.).
 *
 * `stagger` animates the direct children of the group (used for small rows of
 * dashboard cards). The reveal attributes are removed after the transition so
 * components return to their own hover transitions.
 */

type RevealTag = "div" | "section" | "article" | "ul" | "ol" | "span" | "li";

export function RevealOnScroll({
  as = "div",
  className,
  children,
  delay = 0,
  y = 16,
  stagger = 0,
  // The huge top margin is a safety net for fast jumps: elements the user
  // scrolled past without a rendered frame still count as intersecting and
  // reveal immediately instead of staying hidden above the viewport. The
  // bottom margin is the real trigger, so normal scrolling is unchanged.
  rootMargin = "100000px 0px -8% 0px",
  ariaLabel,
}: {
  as?: RevealTag;
  className?: string;
  children: ReactNode;
  /** Extra delay before the reveal starts, in ms. */
  delay?: number;
  /** Upward travel distance, in px (12–20 is the intended range). */
  y?: number;
  /** Per-child delay for the direct children of the group, in ms. */
  stagger?: number;
  rootMargin?: string;
  /** Optional accessible name, forwarded as `aria-label` on the wrapper. */
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Already on screen (or scrolled past, e.g. a restored scroll position):
    // the page-entrance transition covers it. Hiding it now would flash or
    // make previously seen content disappear, so leave it as rendered.
    const rect = el.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    if (!viewport || rect.top < viewport * 0.92) return;

    el.style.setProperty("--reveal-y", `${y}px`);
    if (delay) el.style.setProperty("--reveal-delay", `${delay}ms`);
    if (stagger) el.style.setProperty("--reveal-stagger", `${stagger}ms`);
    el.dataset.reveal = stagger ? "stagger" : "fade";

    let cleanupTimer: number | undefined;
    let observer: IntersectionObserver;

    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          el.dataset.revealState = "in";

          // Remove the animation hooks once the group has finished so the
          // children's own hover transitions take over again.
          const count = stagger ? Math.min(el.children.length, 8) : 1;
          const total = 460 + delay + Math.max(0, count - 1) * stagger + 80;
          cleanupTimer = window.setTimeout(() => {
            delete el.dataset.reveal;
            delete el.dataset.revealState;
            el.style.removeProperty("--reveal-y");
            el.style.removeProperty("--reveal-delay");
            el.style.removeProperty("--reveal-stagger");
          }, total);
        },
        { rootMargin, threshold: 0.01 },
      );

      observer.observe(el);
    } catch {
      // Never leave content hidden if the observer cannot be created.
      delete el.dataset.reveal;
      delete el.dataset.revealState;
      el.style.removeProperty("--reveal-y");
      el.style.removeProperty("--reveal-delay");
      el.style.removeProperty("--reveal-stagger");
      return;
    }

    return () => {
      observer.disconnect();
      if (cleanupTimer) window.clearTimeout(cleanupTimer);
    };
  }, [delay, rootMargin, stagger, y]);

  const Tag = as as "div";

  return (
    <Tag ref={ref} className={className} aria-label={ariaLabel}>
      {children}
    </Tag>
  );
}

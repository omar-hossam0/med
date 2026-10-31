"use client";

import { useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { RevealOnScroll } from "./RevealOnScroll";
import { cn } from "@/lib/cn";

/**
 * Premium, accessible scroll-reveal and motion primitives for Medora.
 *
 * - Content is 100% visible in the server-rendered HTML for progressive enhancement.
 * - Animates only transform/translate + opacity (GPU-friendly).
 * - Reveals smoothly when entering the viewport, once only.
 * - Fully disabled under `prefers-reduced-motion` (content renders statically).
 * - Avoids flash of hidden content and guarantees zero hydration mismatch.
 */

type Tag = "div" | "span" | "li" | "ul" | "ol" | "article" | "section";

type BaseProps = {
  as?: Tag;
  className?: string;
  children: ReactNode;
};

/* ---------- Fade-up on scroll ---------- */
type RevealProps = BaseProps & {
  delay?: number;
  y?: number;
  x?: number;
  amount?: number;
  duration?: number;
};

export function Reveal({
  as = "div",
  className,
  children,
  delay = 0,
  y = 16,
}: RevealProps) {
  const delayMs = delay ? Math.round(delay * 1000) : 0;
  return (
    <RevealOnScroll as={as} className={className} delay={delayMs} y={y}>
      {children}
    </RevealOnScroll>
  );
}

/* ---------- Staggered children ---------- */
type StaggerProps = BaseProps & {
  stagger?: number;
  delayChildren?: number;
  amount?: number;
};

export function Stagger({
  as = "div",
  className,
  children,
  stagger = 0.06,
  delayChildren = 0,
}: StaggerProps) {
  const staggerMs = Math.round(stagger * 1000);
  const delayMs = delayChildren ? Math.round(delayChildren * 1000) : 0;
  return (
    <RevealOnScroll
      as={as}
      className={className}
      stagger={staggerMs || 50}
      delay={delayMs}
    >
      {children}
    </RevealOnScroll>
  );
}

type StaggerItemProps = BaseProps & { y?: number; x?: number };

export function StaggerItem({
  as = "div",
  className,
  children,
  y,
}: StaggerItemProps) {
  const Tag = as as "div";
  return (
    <Tag
      className={className}
      style={
        y !== undefined && y !== 16
          ? ({ "--reveal-y": `${y}px` } as CSSProperties)
          : undefined
      }
    >
      {children}
    </Tag>
  );
}

/* ---------- Image reveal (fade + drift) ---------- */
type ImageRevealProps = BaseProps & {
  delay?: number;
  x?: number;
  amount?: number;
};

export function ImageReveal({
  as = "div",
  className,
  children,
  delay = 0.08,
}: ImageRevealProps) {
  const delayMs = delay ? Math.round(delay * 1000) : 0;
  return (
    <RevealOnScroll as={as} className={className} delay={delayMs} y={16}>
      {children}
    </RevealOnScroll>
  );
}

/* ---------- Hero load-in (plays on mount, not on scroll) ---------- */
type HeroRevealProps = BaseProps & { delay?: number; y?: number };

export function HeroReveal({
  as = "div",
  className,
  children,
  delay = 0,
  y = 14,
}: HeroRevealProps) {
  const reduce = useReducedMotion();
  const Tag = as as "div";
  if (reduce) return <Tag className={className}>{children}</Tag>;

  const delayMs = delay ? Math.round(delay * 1000) : 0;
  return (
    <Tag
      className={cn(className, "hero-enter")}
      style={
        {
          animationDelay: `${delayMs}ms`,
          ...(y !== 14 ? { "--hero-y": `${y}px` } : {}),
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Premium, accessible scroll-reveal primitives for Medora.
 *
 * - Animate only transform + opacity (GPU-friendly).
 * - `whileInView` with `once: true` so content reveals a single time.
 * - Fully disabled under `prefers-reduced-motion` (content renders statically).
 * - Used as small client wrappers around server-rendered content, so sections
 *   stay server components.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Tag = "div" | "span" | "li" | "ul" | "ol" | "article" | "section";

function tag(t: Tag) {
  switch (t) {
    case "span":
      return motion.span;
    case "li":
      return motion.li;
    case "ul":
      return motion.ul;
    case "ol":
      return motion.ol;
    case "article":
      return motion.article;
    case "section":
      return motion.section;
    default:
      return motion.div;
  }
}

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
  y = 32,
  x = 0,
  amount = 0.3,
  duration = 0.65,
}: RevealProps) {
  const reduce = useReducedMotion();
  const Tag = tag(as);
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </Tag>
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
  stagger = 0.1,
  delayChildren = 0.05,
  amount = 0.2,
}: StaggerProps) {
  const reduce = useReducedMotion();
  const Tag = tag(as);
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren } },
      }}
    >
      {children}
    </Tag>
  );
}

type StaggerItemProps = BaseProps & { y?: number; x?: number };

export function StaggerItem({
  as = "div",
  className,
  children,
  y = 24,
  x = 0,
}: StaggerItemProps) {
  const reduce = useReducedMotion();
  const Tag = tag(as);
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      variants={{
        hidden: { opacity: 0, y, x },
        show: { opacity: 1, y: 0, x: 0, transition: { duration: 0.55, ease: EASE } },
      }}
    >
      {children}
    </Tag>
  );
}

/* ---------- Image reveal (fade + drift + subtle scale) ---------- */
type ImageRevealProps = BaseProps & {
  delay?: number;
  x?: number;
  amount?: number;
};

export function ImageReveal({
  as = "div",
  className,
  children,
  delay = 0.1,
  x = 0,
  amount = 0.25,
}: ImageRevealProps) {
  const reduce = useReducedMotion();
  const Tag = tag(as);
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, x, scale: 0.98 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

/* ---------- Hero load-in (plays on mount, not on scroll) ---------- */
type HeroRevealProps = BaseProps & { delay?: number; y?: number };

export function HeroReveal({
  as = "div",
  className,
  children,
  delay = 0,
  y = 24,
}: HeroRevealProps) {
  const reduce = useReducedMotion();
  const Tag = tag(as);
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

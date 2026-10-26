"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * Internal navigation link. Navigation happens immediately through Next.js
 * client-side routing (with prefetch) — no overlay, no artificial delay.
 * The destination page plays the shared `.page-enter` fade + subtle slide
 * (see app/template.tsx). Modified clicks (new tab, etc.) are left to the
 * browser by the native <Link>.
 */
export function TransitionLink({ href, children, className, onClick, ...rest }: Props) {
  return (
    <Link href={href} prefetch className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

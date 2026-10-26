"use client";

import { ArrowRight } from "lucide-react";
import { TransitionLink } from "@/components/transitions/TransitionLink";
import { cn } from "@/lib/cn";

type Props = {
  label?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * The single shared "Get Started" CTA. Every Get Started button on the landing
 * page uses this so they all navigate to /signup with the same route
 * transition (no duplicated navigation logic, no full reloads).
 */
export function GetStartedLink({
  label = "Get Started",
  size = "md",
  fullWidth,
  className,
  onClick,
}: Props) {
  const sizeCls =
    size === "lg"
      ? "h-12 px-6 text-[15px]"
      : size === "sm"
        ? "h-10 px-4 text-sm"
        : "h-11 px-5 text-[15px]";

  return (
    <TransitionLink
      href="/signup"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full bg-teal-grad font-semibold tracking-tight text-white shadow-tealGlow transition-all duration-200 hover:-translate-y-px hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        sizeCls,
        fullWidth && "w-full",
        className,
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5">
        <ArrowRight size={12} />
      </span>
    </TransitionLink>
  );
}

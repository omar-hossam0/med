"use client";

import { ArrowRight, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function StepCard({
  children,
  className,
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-[#E6EFEE] bg-white shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function StepHeading({
  title,
  description,
  badge,
  action,
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[#0F2D4A] sm:text-[16px]">
            {title}
          </h2>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 max-w-[640px] text-[11.5px] leading-relaxed text-[#5B6B7C]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189] disabled:cursor-not-allowed active:translate-y-px disabled:active:translate-y-0";

const SIZES = {
  sm: "h-8 px-3 text-[10.5px]",
  md: "h-9 px-4 text-[11px]",
  lg: "h-10 px-5 text-[11.5px]",
} as const;

export function PrimaryButton({
  children,
  arrow = false,
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  arrow?: boolean;
  size?: keyof typeof SIZES;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        BASE,
        SIZES[size],
        "bg-[#0A9189] text-white shadow-[0_12px_24px_-16px_rgba(10,145,137,0.9)] hover:bg-[#087F78] disabled:bg-[#C3CFDA] disabled:text-white disabled:shadow-none",
        className,
      )}
    >
      {children}
      {arrow ? <ArrowRight size={13} aria-hidden /> : null}
    </button>
  );
}

export function SecondaryButton({
  children,
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: keyof typeof SIZES }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        BASE,
        SIZES[size],
        "bg-[#EAFBF7] text-[#0A9189] hover:bg-[#DDF7F2] disabled:bg-[#F1F6F6] disabled:text-[#A8B6C4]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: keyof typeof SIZES }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        BASE,
        SIZES[size],
        "border border-[#E6EFEE] bg-white text-[#0F2D4A] hover:border-[#BFE8E2] hover:bg-[#F8FCFB] hover:text-[#0A9189] disabled:text-[#A8B6C4]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: keyof typeof SIZES }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        BASE,
        SIZES[size],
        "bg-[#FDEEF1] text-[#C0353B] hover:bg-[#FBDDE2] disabled:bg-[#F7F9FB] disabled:text-[#C3CFDA]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

export type Tone = "teal" | "green" | "amber" | "red" | "blue" | "purple" | "gray";

const TONES: Record<Tone, string> = {
  teal: "bg-[#EAFBF7] text-[#0A9189]",
  green: "bg-[#E7FBF8] text-[#0A9189]",
  amber: "bg-[#FFF6E5] text-[#C77A0A]",
  red: "bg-[#FDEEF1] text-[#C0353B]",
  blue: "bg-[#EAF1FF] text-[#3B6EF6]",
  purple: "bg-[#F3ECFF] text-[#8B5CF6]",
  gray: "bg-[#F1F6F6] text-[#5B6B7C]",
};

const DOTS: Record<Tone, string> = {
  teal: "bg-[#0A9189]",
  green: "bg-[#0A9189]",
  amber: "bg-[#E0A106]",
  red: "bg-[#C0353B]",
  blue: "bg-[#3B6EF6]",
  purple: "bg-[#8B5CF6]",
  gray: "bg-[#9AA9B8]",
};

export function Chip({
  children,
  tone = "gray",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] font-semibold",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function ActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-[#F2F7F7] px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[#9AA9B8]">
      <Info size={10} aria-hidden className="mt-[1px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function IconTile({
  icon: Icon,
  tone = "teal",
  size = 34,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: number;
}) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full", TONES[tone])}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.45)} aria-hidden />
    </span>
  );
}

export function ConsentCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0A9189]",
          checked ? "border-[#0A9189] bg-[#0A9189]" : "border-[#C3CFDA] bg-white",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 10 8" className="h-[8px] w-[10px]" fill="none" aria-hidden>
            <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="text-[11.5px] font-medium leading-relaxed text-[#0F2D4A]">{children}</span>
    </label>
  );
}

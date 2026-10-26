import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "tertiary" | "white";
type Size = "sm" | "md" | "lg";

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  withArrow?: boolean;
  fullWidth?: boolean;
};

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    as?: "button";
  };

type AnchorProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
    as: "a";
    href: string;
  };

type Props = ButtonProps | AnchorProps;

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-teal-grad text-white shadow-tealGlow hover:brightness-110 hover:translate-y-[-1px] active:translate-y-0",
  secondary:
    "bg-white text-primary-dark border border-primary/20 ring-1 ring-primary/5 hover:border-primary/40 hover:bg-primary-50",
  tertiary:
    "bg-transparent text-primary-dark hover:text-primary",
  white:
    "bg-white text-primary-dark hover:bg-primary-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-[15px]",
};

export function Button(props: Props) {
  const {
    children,
    variant = "primary",
    size = "md",
    withArrow = false,
    fullWidth = false,
    className,
    ...rest
  } = props as Props & { className?: string };

  const classes = cn(
    "group inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );

  const inner = (
    <>
      <span className="whitespace-nowrap">{children}</span>
      {withArrow && (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 12h14M13 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </>
  );

  if ((props as AnchorProps).as === "a") {
    const { as, children: _c, variant: _v, size: _s, withArrow: _w, fullWidth: _f, className: _cn, ...anchorRest } =
      props as AnchorProps & { className?: string };
    return (
      <a className={classes} {...anchorRest}>
        {inner}
      </a>
    );
  }

  const { as: _a, children: _c, variant: _v, size: _s, withArrow: _w, fullWidth: _f, className: _cn, ...buttonRest } =
    props as ButtonProps & { className?: string };
  return (
    <button className={classes} {...buttonRest}>
      {inner}
    </button>
  );
}

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Stagger, StaggerItem } from "@/components/motion";

type Props = {
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

/**
 * Section heading with a premium badge → heading → paragraph reveal sequence.
 * Uses client motion wrappers while remaining a server component itself.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
  titleClassName,
  subtitleClassName,
}: Props) {
  const isCenter = align === "center";
  return (
    <Stagger
      className={cn(
        "flex flex-col gap-4",
        isCenter ? "items-center text-center" : "items-start text-left",
        className,
      )}
      stagger={0.12}
      delayChildren={0.05}
      amount={0.5}
    >
      {eyebrow && (
        <StaggerItem y={14}>
          <span className={cn("eyebrow", !isCenter && "self-start")}>
            <span className="eyebrow-dot" />
            {eyebrow}
          </span>
        </StaggerItem>
      )}
      {title && (
        <StaggerItem y={26}>
          <h2 className={cn("h-section font-bold text-navy", titleClassName)}>
            {title}
          </h2>
        </StaggerItem>
      )}
      {subtitle && (
        <StaggerItem y={20}>
          <p
            className={cn(
              "p-lead max-w-prose",
              isCenter && "mx-auto",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        </StaggerItem>
      )}
    </Stagger>
  );
}

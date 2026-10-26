import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Approved Medora brand logo (transparent PNG assets).
 *
 * - `variant="primary"` — full horizontal logo (symbol + "Medora Healthcare").
 * - `variant="mark"`    — standalone symbol for compact placements.
 *
 * Renders with its natural aspect ratio; `height` sets the display height and
 * the width is derived from the asset ratio (never stretched). No background
 * is added — the logo sits directly on the page surface.
 */
const ASSETS = {
  primary: {
    src: "/images/branding/medora-primary-logo.png",
    width: 1400,
    height: 424,
  },
  mark: {
    src: "/images/branding/medora-logo-mark.png",
    width: 575,
    height: 537,
  },
} as const;

type Props = {
  variant?: "primary" | "mark";
  /** Display height in px (width follows the asset ratio). */
  height?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

export function MedoraLogo({
  variant = "primary",
  height = 32,
  className,
  priority,
  alt,
}: Props) {
  const asset = ASSETS[variant];
  const width = Math.round((height * asset.width) / asset.height);

  return (
    <Image
      src={asset.src}
      alt={alt ?? (variant === "primary" ? "Medora Healthcare" : "Medora")}
      width={asset.width}
      height={asset.height}
      sizes={`${width}px`}
      priority={priority}
      draggable={false}
      className={cn("block select-none", className)}
      style={{ height, width }}
    />
  );
}

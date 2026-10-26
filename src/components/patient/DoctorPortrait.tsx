import Image from "next/image";
import { Avatar } from "./ui";
import { cn } from "@/lib/cn";

/**
 * Approved doctor portrait with the project's initials-avatar fallback.
 * The fallback shape follows the card shape so doctor cards stay aligned
 * whether or not a photo asset exists.
 */
export function DoctorPortrait({
  name,
  photoUrl,
  size,
  shape = "circle",
  className,
  priority = false,
}: {
  name: string;
  photoUrl?: string | null;
  size: number;
  shape?: "circle" | "rounded";
  className?: string;
  priority?: boolean;
}) {
  const radius = shape === "circle" ? "rounded-full" : "rounded-2xl";

  if (!photoUrl) {
    return (
      <Avatar
        name={name}
        size={size}
        roundedClassName={radius}
        className={className}
      />
    );
  }

  return (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden bg-[#EAF2F2] ring-2 ring-white",
        radius,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={photoUrl}
        alt={`${name} portrait`}
        fill
        sizes={`${size}px`}
        priority={priority}
        className="object-cover object-top"
      />
    </span>
  );
}

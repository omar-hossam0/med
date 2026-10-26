import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

export function Container({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("container-x", className)} {...rest}>
      {children}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  id: string;
  label: string;
  placeholder: string;
  Icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: "text" | "email" | "tel";
  multiline?: boolean;
  rows?: number;
  autoComplete?: string;
};

/**
 * Accessible contact form field with a leading icon. Renders an <input> or
 * <textarea>, a visually-hidden <label> for screen readers, and an inline
 * error message tied via aria-describedby.
 */
export function ContactFormField({
  id,
  label,
  placeholder,
  Icon,
  value,
  onChange,
  error,
  required,
  type = "text",
  multiline = false,
  rows = 5,
  autoComplete,
}: Props) {
  const fieldClasses = cn(
    "w-full rounded-2xl border bg-white pl-10 pr-3.5 text-[14px] text-navy outline-none transition-all placeholder:text-[13px] placeholder:text-ink-muted/80",
    error
      ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
      : "border-line focus:border-primary focus:ring-4 focus:ring-primary/10",
  );

  return (
    <div className="w-full">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3 text-ink-muted",
            multiline ? "top-4" : "top-1/2 -translate-y-1/2",
          )}
        >
          <Icon size={17} />
        </span>

        {multiline ? (
          <textarea
            id={id}
            name={id}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(fieldClasses, "min-h-[124px] resize-none py-3.5")}
          />
        ) : (
          <input
            id={id}
            name={id}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            autoComplete={autoComplete}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(fieldClasses, "h-[50px]")}
          />
        )}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 pl-1 text-[12px] font-medium text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}

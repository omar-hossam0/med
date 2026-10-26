import { cn } from "@/lib/cn";

/* ---------------- Avatar (initials placeholder) ---------------- */
const GRADIENTS = [
  "linear-gradient(135deg,#0A9189,#16B8AA)",
  "linear-gradient(135deg,#2563EB,#38BDF8)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#0F2D4A,#1E4E6E)",
  "linear-gradient(135deg,#DB2777,#F472B6)",
];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  size = 40,
  className,
  roundedClassName = "rounded-full",
}: {
  name: string;
  size?: number;
  className?: string;
  /** Corner treatment for non-circular fallbacks (e.g. doctor card portraits). */
  roundedClassName?: string;
}) {
  const initials = name
    .replace(/^Dr\.\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const bg = GRADIENTS[hash(name) % GRADIENTS.length];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center font-semibold text-white ring-2 ring-white",
        roundedClassName,
        className,
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials}
    </span>
  );
}

/* ---------------- Status badge ---------------- */
const STATUS_STYLES: Record<string, string> = {
  Upcoming: "bg-[#E6FAF7] text-[#0A9189]",
  Completed: "bg-[#EFF4FF] text-[#3B6EF6]",
  Cancelled: "bg-[#FDECEF] text-[#E5484D]",
  Pending: "bg-[#FFF6E5] text-[#C77A0A]",
  Normal: "bg-[#E9F9EF] text-[#1E9E56]",
  "Slightly High": "bg-[#FFF6E5] text-[#C77A0A]",
  High: "bg-[#FDECEF] text-[#E5484D]",
};

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold",
        size === "md" ? "px-2.5 py-1 text-[10.5px]" : "px-2 py-0.5 text-[9.5px]",
        STATUS_STYLES[status] ?? "bg-surface-subtle text-ink-secondary",
      )}
    >
      {status}
    </span>
  );
}

/* ---------------- Sparkline ---------------- */
export function Sparkline({
  points,
  color,
  width = 96,
  height = 26,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!points.length) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - 3 - ((p - min) / span) * (height - 6);
    return [x, y] as const;
  });
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
      <path d={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { cn } from "@/lib/cn";

/**
 * Organic, layered vertical wave divider between the login form and the clinic
 * image. Built entirely from SVG (no raster separator, no straight border).
 *
 * Layers:
 *  1. White primary boundary (fills the form side of the curve)
 *  2. Wide pale-mint translucent ribbon following the curve
 *  3. Thin teal accent stroke on the boundary
 *  4. Subtle dotted accents on the form side
 *  5. Soft teal shadow near the lower curve
 *
 * Decorative only — `pointer-events-none`, `aria-hidden`, never blocks input.
 */
export function LoginWave({ className }: { className?: string }) {
  // A soft vertical S-curve running the full height.
  const curve =
    "M176,0 C104,150 96,330 146,492 C196,654 112,824 160,1000";

  return (
    <div aria-hidden className={cn("pointer-events-none", className)}>
      <svg
        className="h-full w-full"
        viewBox="0 0 300 1000"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id="loginWaveBlur"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="28" />
          </filter>
          <linearGradient id="loginWaveMint" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e6faf6" />
            <stop offset="1" stopColor="#c7efe9" />
          </linearGradient>
        </defs>

        {/* Layer 5 — soft teal glow near the lower boundary */}
        <ellipse
          cx="235"
          cy="860"
          rx="140"
          ry="210"
          fill="#0bb2a2"
          opacity="0.16"
          filter="url(#loginWaveBlur)"
        />

        {/* Layer 2 — wide pale-mint ribbon (right half stays over the image) */}
        <path
          d={curve}
          stroke="url(#loginWaveMint)"
          strokeWidth="96"
          strokeOpacity="0.55"
          strokeLinecap="round"
        />
        <path
          d={curve}
          stroke="#e0f7f4"
          strokeWidth="44"
          strokeOpacity="0.7"
          strokeLinecap="round"
        />

        {/* Layer 1 — white primary boundary (fills the form side) */}
        <path d={`${curve} L0,1000 L0,0 Z`} fill="#ffffff" />

        {/* Layer 3 — thin teal accent stroke */}
        <path
          d={curve}
          stroke="#12b7aa"
          strokeWidth="2"
          strokeOpacity="0.55"
        />

        {/* Layer 4 — dotted accents on the form side */}
        <g fill="#12b7aa" opacity="0.32">
          <circle cx="62" cy="520" r="2.4" />
          <circle cx="86" cy="520" r="2.4" />
          <circle cx="110" cy="520" r="2.4" />
          <circle cx="74" cy="544" r="2.4" />
          <circle cx="98" cy="544" r="2.4" />
          <circle cx="122" cy="544" r="2.4" />
          <circle cx="86" cy="568" r="2.4" />
          <circle cx="110" cy="568" r="2.4" />
          <circle cx="62" cy="592" r="2.4" />
          <circle cx="86" cy="592" r="2.4" />
          <circle cx="110" cy="592" r="2.4" />
        </g>
      </svg>
    </div>
  );
}

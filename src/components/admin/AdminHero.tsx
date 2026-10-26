"use client";

import Image from "next/image";
import { LayoutGrid, BarChart3, Users } from "lucide-react";
import { ASSETS } from "@/lib/constants";
import { useComingSoon } from "./ComingSoon";

export function AdminHero() {
  const comingSoon = useComingSoon();

  return (
    <div className="relative min-h-[176px] overflow-hidden rounded-2xl border border-line bg-[#EAF9F7]">
      {/* Clinic/admin image — right side, kept clear and unwashed */}
      <div className="absolute inset-y-0 right-0 hidden w-[58%] sm:block">
        <Image
          src={ASSETS.adminHero}
          alt="Medora administrator reviewing healthcare analytics at monitors"
          fill
          priority
          sizes="(max-width: 1280px) 60vw, 560px"
          className="object-cover object-center"
        />
      </div>

      {/* Organic S-curved divider between text and image */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="adminHeroMint" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ECFBF9" />
            <stop offset="0.6" stopColor="#E2F7F3" />
            <stop offset="1" stopColor="#D8F2EC" />
          </linearGradient>
        </defs>

        {/* soft translucent mint layers following the curve */}
        <path
          d="M430,0 C495,55 500,145 450,200"
          stroke="#EAF9F7"
          strokeWidth="54"
          strokeOpacity="0.28"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M430,0 C495,55 500,145 450,200"
          stroke="#ECFBF9"
          strokeWidth="24"
          strokeOpacity="0.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* main mint panel with the curved right edge */}
        <path
          d="M0,0 H430 C495,55 500,145 450,200 H0 Z"
          fill="url(#adminHeroMint)"
        />

        {/* subtle teal accent line on the boundary */}
        <path
          d="M430,0 C495,55 500,145 450,200"
          stroke="#0A9189"
          strokeWidth="1.5"
          strokeOpacity="0.35"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Content */}
      <div className="relative z-10 max-w-full p-5 sm:max-w-[41%] sm:p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#0A9189]">
          <LayoutGrid size={10} />
          Administration
        </span>
        <h1 className="mt-2.5 text-[21px] font-bold leading-tight tracking-[-0.01em] text-[#0F2D4A] sm:text-[25px]">
          Good morning, Admin <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 max-w-[300px] text-[11.5px] leading-relaxed text-[#4E6172]">
          Manage, monitor, and grow your healthcare platform.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => comingSoon("Analytics")}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[linear-gradient(90deg,#0A9189_0%,#16B8AA_100%)] px-3.5 text-[11px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(10,145,137,0.7)] transition hover:brightness-110"
          >
            <BarChart3 size={12} />
            View Analytics
          </button>
          <button
            type="button"
            onClick={() => comingSoon("Doctors & Staff")}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#0A9189]/25 bg-white/85 px-3.5 text-[11px] font-semibold text-[#0A9189] transition hover:bg-white"
          >
            <Users size={12} />
            Manage Doctors &amp; Staff
          </button>
        </div>
      </div>
    </div>
  );
}

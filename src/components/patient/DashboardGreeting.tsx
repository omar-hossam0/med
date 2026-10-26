"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { ASSETS } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";
import { formatFirstName } from "@/lib/format";
import { patient, nextAppointment, today } from "@/lib/mock/patient";
import { Avatar } from "./ui";
import { useComingSoon } from "./ComingSoon";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardGreeting() {
  const comingSoon = useComingSoon();
  const { user } = useAuth();
  const firstName = formatFirstName(user?.full_name) || patient.firstName;

  // Client-only clock so the greeting and date stay current without a
  // server/client hydration mismatch.
  const [greeting, setGreeting] = useState("Good morning");
  const [dateLabel, setDateLabel] = useState(today);

  useEffect(() => {
    const now = new Date();
    setGreeting(greetingForHour(now.getHours()));
    setDateLabel(
      now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    );
  }, []);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[25px]">
            {greeting}, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#5B6B7C] sm:text-[12.5px]">
            Take charge of your health journey with Medora. Book appointments, view your
            records, and stay connected with your healthcare team — all in one place.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pb-0.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#CFE9E5] bg-white px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#0A9189]">
            Demo data
          </span>
          <span className="text-[11.5px] text-ink-muted">{dateLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-[#F2FCF9] shadow-[0_12px_34px_-26px_rgba(10,145,137,0.42)] md:min-h-[264px]">
          {/* Doctor / patient photograph (desktop) */}
          <div className="absolute inset-y-0 right-0 hidden w-[52%] md:block">
            <Image
              src={ASSETS.patientHero}
              alt="A Medora doctor consulting with a patient in a bright clinic"
              fill
              priority
              sizes="(max-width: 1280px) 50vw, 430px"
              className="object-cover object-[center_38%]"
            />
          </div>

          {/* Layered organic mint wave between copy and photograph */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
            viewBox="0 0 1000 320"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="patientHeroMint" x1="0" y1="0" x2="0.95" y2="0.45">
                <stop offset="0" stopColor="#FBFEFD" />
                <stop offset="0.5" stopColor="#F1FCF9" />
                <stop offset="1" stopColor="#DDF8F1" />
              </linearGradient>
              <linearGradient id="patientHeroRibbon" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#C9F1E8" stopOpacity="0.58" />
                <stop offset="1" stopColor="#8FDCCF" stopOpacity="0.1" />
              </linearGradient>
              <radialGradient id="patientHeroGlow" cx="0.32" cy="0.16" r="0.78">
                <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.92" />
                <stop offset="1" stopColor="#D8F6EF" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx="300" cy="12" rx="430" ry="210" fill="url(#patientHeroGlow)" />

            {/* Wide translucent mint ribbon sweeping over the photograph */}
            <path
              d="M604,-30 C700,24 736,104 694,170 C654,234 578,280 512,340"
              stroke="url(#patientHeroRibbon)"
              strokeWidth="70"
              strokeLinecap="round"
              fill="none"
            />
            {/* Slim aqua accent line */}
            <path
              d="M622,-30 C718,24 754,104 712,172 C672,236 598,282 532,342"
              stroke="#8FDCD0"
              strokeOpacity="0.34"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Main mint panel with the flowing S-shaped right edge */}
            <path
              d="M0,0 H560 C642,30 690,92 662,152 C636,212 562,258 496,320 H0 Z"
              fill="url(#patientHeroMint)"
            />

            {/* Soft inner highlight along the boundary */}
            <path
              d="M560,0 C642,30 690,92 662,152 C636,212 562,258 496,320"
              stroke="#FFFFFF"
              strokeOpacity="0.85"
              strokeWidth="5"
              fill="none"
            />
            <path
              d="M560,0 C642,30 690,92 662,152 C636,212 562,258 496,320"
              stroke="#A7E6DB"
              strokeOpacity="0.5"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>

          {/* Copy */}
          <div className="relative z-10 p-5 sm:p-6 md:max-w-[60%] md:p-7">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#0A9189]">
              Your Health Matters
            </p>
            <h2 className="mt-2 text-[clamp(28px,2.3vw,32px)] font-bold leading-[1.08] tracking-[-0.025em] text-[#0F2D4A]">
              Expert Care
              <br />
              for a Healthier Tomorrow
            </h2>
            <p className="mt-2.5 max-w-[350px] text-[11.5px] leading-[1.55] text-[#56697C] sm:text-[12px]">
              Access trusted doctors, book appointments, manage your health records, and
              more — all in one place.
            </p>
            <button
              type="button"
              onClick={() => comingSoon("Appointment booking")}
              className="mt-4 inline-flex h-[40px] items-center gap-2 rounded-full bg-[#0A9189] px-5 text-[12px] font-semibold text-white shadow-[0_12px_24px_-14px_rgba(10,145,137,0.75)] transition hover:bg-[#087F78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
            >
              Book New Appointment
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Photograph (mobile) with a mint wave transition from the copy */}
          <div className="relative h-[176px] w-full md:hidden">
            <Image
              src={ASSETS.patientHero}
              alt="A Medora doctor consulting with a patient in a bright clinic"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-9 w-full"
              viewBox="0 0 400 40"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M0,0 H400 V10 C336,34 276,4 208,16 C142,28 74,30 0,14 Z"
                fill="#F7FEFC"
              />
              <path
                d="M0,10 C74,26 142,24 208,12 C276,0 336,30 400,6"
                stroke="#CFF1E9"
                strokeOpacity="0.75"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Next appointment */}
        <div className="flex flex-col rounded-2xl border border-[#E6EFEE] bg-white p-4 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.28)]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-[#0F2D4A]">
              Your Next Appointment
            </h3>
            <button
              type="button"
              onClick={() => comingSoon("All appointments")}
              className="text-[11px] font-semibold text-[#0A9189] transition hover:underline"
            >
              View All
            </button>
          </div>

          <div className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E9FBF8] px-2.5 py-1 text-[10px] font-medium text-[#0F2D4A]">
            <CalendarDays size={12} className="text-[#0A9189]" />
            {nextAppointment.date} <span className="text-[#8A99A8]">·</span>{" "}
            {nextAppointment.time}
          </div>

          <button
            type="button"
            onClick={() => comingSoon("Appointment details")}
            className="mt-3 flex w-full items-center gap-2.5 rounded-lg text-left transition hover:bg-[#FAFDFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
          >
            <Avatar name={nextAppointment.doctor} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-[#0F2D4A]">
                {nextAppointment.doctor}
              </span>
              <span className="block text-[10.5px] text-ink-muted">
                {nextAppointment.specialty}
              </span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-ink-muted" />
          </button>

          <div className="mt-2.5 flex items-start gap-2 border-t border-[#EEF4F4] pt-2.5 text-[10.5px] leading-snug text-[#5B6B7C]">
            <MapPin size={13} className="mt-0.5 shrink-0 text-[#0A9189]" />
            <span>
              <span className="block font-medium text-[#0F2D4A]">
                {nextAppointment.location}
              </span>
              {nextAppointment.address}
            </span>
          </div>

          <div className="mt-auto flex gap-2 pt-3">
            <button
              type="button"
              onClick={() => comingSoon("Reschedule")}
              className="h-[34px] flex-1 rounded-full border border-[#DCE8E6] text-[10.5px] font-semibold text-[#0F2D4A] transition hover:bg-[#F6FAFA]"
            >
              Reschedule
            </button>
            <button
              type="button"
              onClick={() => comingSoon("Appointment details")}
              className="h-[34px] flex-1 rounded-full bg-[#0A9189] text-[10.5px] font-semibold text-white transition hover:bg-[#087F78]"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { GetStartedLink } from "@/components/ui/GetStartedLink";
import { HeroReveal } from "@/components/motion";
import { Play } from "lucide-react";
import { ASSETS } from "@/lib/constants";
import { HERO_BENEFITS } from "@/data/landing-content";

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden bg-hero-fade pt-24 pb-16 lg:pt-32 lg:pb-20"
    >
      {/* decorative shapes */}
      <DecorBackdrop />

      <Container className="relative grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
        {/* Left: content */}
        <div>
          <HeroReveal y={14} delay={0}>
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              AI-Powered Healthcare Platform
            </span>
          </HeroReveal>

          <HeroReveal y={26} delay={0.08} className="mt-6">
            <h1 className="h-hero">
              <span className="block">Smarter Healthcare</span>
              <span className="block">
                for <span className="teal-grad-text">Healthier Lives</span>
              </span>
            </h1>
          </HeroReveal>

          <HeroReveal y={20} delay={0.16} className="mt-5 max-w-xl">
            <p className="p-lead">
              Medora combines intelligent AI with seamless clinical workflows to
              support doctors, patients, and healthcare teams — all in one secure
              platform.
            </p>
          </HeroReveal>

          <HeroReveal y={18} delay={0.24} className="mt-8">
            <div className="flex flex-wrap items-center gap-3">
              <GetStartedLink size="lg" />
              <Button
                as="a"
                href="#how-it-works"
                variant="secondary"
                size="lg"
                title="Jump to the How It Works section (demo video coming soon)"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                  <Play
                    size={11}
                    className="translate-x-[1px]"
                    fill="currentColor"
                  />
                </span>
                Watch Video
              </Button>
            </div>
          </HeroReveal>

          <HeroReveal y={14} delay={0.32} className="mt-9">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-ink-secondary sm:grid-cols-4">
              {HERO_BENEFITS.map(({ label, Icon }) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-50 text-primary-dark">
                    <Icon size={14} />
                  </span>
                  <span className="leading-tight">{label}</span>
                </li>
              ))}
            </ul>
          </HeroReveal>
        </div>

        {/* Right: hero visual (doctor + floating UI, composited source) */}
        <HeroReveal y={24} delay={0.2} className="relative">
          <div className="relative">
            <div className="relative overflow-hidden rounded-[28px] shadow-pop ring-1 ring-line">
              <Image
                src={ASSETS.hero}
                alt="Doctor reviewing patient information on a tablet, surrounded by Medora appointment, AI analysis, medical report and follow-up cards"
                priority
                sizes="(max-width: 1024px) 100vw, 560px"
                className="h-auto w-full"
              />
            </div>
            {/* soft halo behind */}
            <div className="absolute inset-0 -z-10 translate-y-6 rounded-[42%] bg-teal-grad opacity-15 blur-3xl" />
          </div>
        </HeroReveal>
      </Container>
    </section>
  );
}

function DecorBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute -left-32 top-10 -z-10 h-72 w-72 rounded-full bg-primary-100 opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 -z-10 h-80 w-80 rounded-full bg-primary-light/30 blur-3xl" />
      <svg
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[420px] w-[420px] text-primary-light/30"
        viewBox="0 0 200 200"
      >
        <circle
          cx="100"
          cy="100"
          r="98"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 4"
        />
      </svg>
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-6 left-6 -z-10 h-40 w-40 text-primary-light/40"
        viewBox="0 0 200 200"
      >
        <circle
          cx="100"
          cy="100"
          r="98"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 6"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 [background-image:radial-gradient(rgba(0,127,116,0.08)_1px,transparent_1px)] [background-size:18px_18px]" />
    </>
  );
}

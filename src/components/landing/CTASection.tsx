import { Container } from "@/components/ui/Container";
import { TransitionLink } from "@/components/transitions/TransitionLink";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section id="cta" className="relative scroll-mt-24 overflow-hidden py-20 lg:py-28">
      <Container>
        <Reveal amount={0.3}>
          <div className="relative overflow-hidden rounded-3xl bg-teal-grad p-10 text-white shadow-pop sm:p-14 lg:p-20">
            {/* decorations */}
            <Decor />

            <div className="relative grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
              <Stagger stagger={0.12} amount={0.4} className="flex flex-col items-start gap-4">
                <StaggerItem y={26}>
                  <h2 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-[44px]">
                    Join Medora Today
                  </h2>
                </StaggerItem>
                <StaggerItem y={20}>
                  <p className="max-w-xl text-white/85 lg:text-lg">
                    Be part of a smarter, more connected healthcare experience.
                  </p>
                </StaggerItem>
              </Stagger>

              <Reveal delay={0.15} amount={0.4} className="flex flex-wrap items-center gap-3 lg:justify-end">
                <TransitionLink
                  href="/signup"
                  className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-primary-dark shadow-tealGlow transition hover:-translate-y-px hover:bg-primary-50"
                >
                  Create Account
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </TransitionLink>
                <a
                  href="#contact"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 bg-transparent px-6 text-[15px] font-semibold text-white transition hover:bg-white/10"
                >
                  Contact Us
                </a>
              </Reveal>
            </div>

            <p className="relative mt-8 text-[12px] text-white/65">
              Create your patient account to manage appointments and access
              approved medical reports.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function Decor() {
  return (
    <>
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary-light/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
      <svg
        aria-hidden
        className="pointer-events-none absolute right-10 top-10 h-32 w-32 text-white/15"
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
    </>
  );
}

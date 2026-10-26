import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stagger, StaggerItem } from "@/components/motion";
import { HOW_IT_WORKS } from "@/data/landing-content";
import { ArrowRight, ArrowDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 bg-surface-subtle py-20 lg:py-28"
    >
      {/* faint blob */}
      <div className="pointer-events-none absolute inset-x-0 top-10 -z-0 mx-auto h-72 w-[80%] rounded-full bg-primary-light/15 blur-3xl" />

      <Container className="relative">
        <SectionHeading
          eyebrow="How It Works"
          title={<>From Appointment to Follow-up — All in One Place</>}
          subtitle={
            <>
              Medora connects patients, doctors, and healthcare teams through an
              intelligent, streamlined process.
            </>
          }
        />

        <Stagger
          as="ol"
          stagger={0.12}
          amount={0.15}
          className="mt-14 grid grid-cols-1 gap-12 sm:gap-14 lg:grid-cols-5 lg:gap-6"
        >
          {HOW_IT_WORKS.map((step, i) => (
            <StaggerItem as="li" key={step.step} y={26} className="relative">
              <StepCard {...step} />
              {i < HOW_IT_WORKS.length - 1 && (
                <>
                  {/* horizontal connector (desktop) */}
                  <span
                    aria-hidden
                    className="absolute -right-5 top-1/2 hidden -translate-y-1/2 text-primary-light lg:inline-flex"
                  >
                    <ArrowRight size={20} />
                  </span>
                  {/* vertical connector (mobile/tablet) */}
                  <span
                    aria-hidden
                    className="absolute -bottom-10 left-1/2 inline-flex -translate-x-1/2 text-primary-light lg:hidden"
                  >
                    <ArrowDown size={20} />
                  </span>
                </>
              )}
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}

function StepCard({
  step,
  title,
  description,
  Icon,
}: {
  step: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <article className="group flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-cardHover">
      <div className="flex items-center justify-between">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-50 text-primary-dark transition group-hover:bg-primary group-hover:text-white">
          <Icon size={20} />
        </span>
        <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-primary-light">
          Step {step}
        </span>
      </div>
      <h3 className="text-base font-semibold text-navy">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-secondary">{description}</p>
    </article>
  );
}

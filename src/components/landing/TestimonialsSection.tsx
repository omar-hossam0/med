import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { TESTIMONIALS } from "@/data/landing-content";
import { Quote, Sparkles } from "lucide-react";

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="relative scroll-mt-24 overflow-hidden bg-surface-subtle py-20 lg:py-28"
    >
      <Container>
        <SectionHeading
          eyebrow="Testimonials"
          title={<>Designed Around Patients and Healthcare Teams</>}
          subtitle={
            <>
              Illustrative use cases showing how Medora can simplify the
              healthcare journey for patients, doctors, and clinic teams.
            </>
          }
        />

        {/* illustrative-only tag */}
        <Reveal delay={0.1} amount={0.6} className="mt-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-primary-dark">
            <Sparkles size={12} />
            Illustrative Use Cases
          </span>
        </Reveal>

        <Stagger
          stagger={0.12}
          amount={0.2}
          className="mt-12 grid gap-5 lg:grid-cols-3"
        >
          {TESTIMONIALS.map((t, i) => (
            <StaggerItem key={t.title} y={28} className="h-full">
              <article className="flex h-full flex-col gap-5 rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-cardHover">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary-dark">
                  <Quote size={18} />
                </span>
                <h3 className="text-lg font-semibold text-navy">{t.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-ink-secondary">
                  {t.description}
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #007F74 0%, #16B8AA 100%)",
                      }}
                    >
                      {t.accent
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-navy">
                        {t.accent}
                      </p>
                      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
                        Example workflow
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-surface-cyan px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-dark">
                    Use Case {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1} amount={0.6}>
          <p className="mx-auto mt-10 max-w-3xl text-center text-[12.5px] text-ink-muted">
            The content above describes illustrative workflows only and is not a
            real customer endorsement. Detailed user reviews will be added once
            the platform is deployed.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

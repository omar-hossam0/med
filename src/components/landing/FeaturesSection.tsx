import { Container } from "@/components/ui/Container";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { FEATURES } from "@/data/landing-content";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 py-20 lg:py-28">
      <Container>
        {/* Header row: heading left, note + action right */}
        <div className="grid items-end gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-7" amount={0.5}>
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              Key Features
            </span>
            <h2 className="h-section mt-4">
              Everything You Need
              <br className="hidden sm:block" /> for Better Healthcare
            </h2>
          </Reveal>

          <Reveal className="lg:col-span-5" delay={0.12} amount={0.5}>
            <p className="max-w-md text-[15px] leading-relaxed text-ink-secondary">
              Powerful tools designed to support every step of the healthcare
              journey with the help of artificial intelligence.
            </p>
            <a
              href="#features"
              className="group mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-dark transition hover:text-primary"
            >
              View All Features
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </a>
          </Reveal>
        </div>

        {/* Cards */}
        <Stagger
          stagger={0.1}
          amount={0.15}
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((f, i) => (
            <StaggerItem key={f.title} y={28} className="h-full">
              <article className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-cardHover">
                <span className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary-50 opacity-0 transition group-hover:opacity-100" />

                <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-50 text-primary-dark transition group-hover:bg-primary group-hover:text-white">
                  <f.Icon size={22} />
                </span>

                <h3 className="text-lg font-semibold text-navy">{f.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-ink-secondary">
                  {f.description}
                </p>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    Feature {String(i + 1).padStart(2, "0")}
                  </span>
                  <a
                    href={f.href}
                    className="grid h-9 w-9 place-items-center rounded-full bg-primary-50 text-primary-dark transition group-hover:rotate-[20deg] group-hover:bg-primary group-hover:text-white"
                    aria-label={`Learn more about ${f.title}`}
                  >
                    <ArrowUpRight size={16} />
                  </a>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}

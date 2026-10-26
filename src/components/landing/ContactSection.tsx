import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ContactInfoCard } from "@/components/ui/ContactInfoCard";
import { ContactForm } from "./ContactForm";
import { ASSETS } from "@/lib/constants";
import { Phone, Mail, MapPin, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const CARDS: { Icon: LucideIcon; title: string; value: string }[] = [
  { Icon: Phone, title: "Call Us", value: "+1 (555) 123-4567" },
  { Icon: Mail, title: "Email Us", value: "hello@medora.com" },
  { Icon: MapPin, title: "Our Location", value: "Cairo, Egypt" },
];

export function ContactSection() {
  return (
    <section
      id="contact"
      className="relative scroll-mt-24 overflow-hidden bg-white py-16 lg:py-24"
    >
      {/* soft teal glow behind the image */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-primary-light/10 blur-3xl"
      />

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* ---------- LEFT: reception image + floating cards ---------- */}
          <Reveal x={-25} y={0} amount={0.3} className="relative">
            <div className="relative aspect-[6/5] w-full overflow-hidden rounded-[28px] shadow-pop ring-1 ring-line">
              <Image
                src={ASSETS.reception}
                alt="Medora healthcare reception with branded wall logo, reception desk and teal seating"
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-cover object-center"
              />
            </div>

            {/* dotted circular decorative outline */}
            <svg
              aria-hidden
              className="pointer-events-none absolute -right-12 top-2 hidden h-64 w-64 text-primary-light/50 lg:block"
              viewBox="0 0 200 200"
            >
              <circle
                cx="100"
                cy="100"
                r="98"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2 7"
              />
            </svg>

            {/* floating contact cards */}
            <Stagger
              stagger={0.12}
              amount={0.25}
              className="mt-5 grid gap-3 sm:grid-cols-3 lg:absolute lg:inset-0 lg:mt-0 lg:block"
            >
              {CARDS.map((c, i) => (
                <StaggerItem
                  key={c.title}
                  y={16}
                  className={cn(
                    "lg:absolute lg:right-[-26px] lg:w-[238px]",
                    i === 0 && "lg:top-[7%]",
                    i === 1 && "lg:top-[39%]",
                    i === 2 && "lg:top-[71%]",
                  )}
                >
                  <ContactInfoCard {...c} />
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>

          {/* ---------- RIGHT: contact form ---------- */}
          <Reveal x={25} y={0} delay={0.1} amount={0.3}>
            <div className="rounded-[30px] bg-white p-6 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.26)] ring-1 ring-line/40 sm:p-7">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Contact Us
              </span>

              <h2 className="mt-4 text-[26px] font-bold leading-[1.15] text-navy sm:text-[28px] lg:text-[30px]">
                Let&apos;s Build a Smarter Healthcare Experience Together
              </h2>

              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-secondary">
                Have questions, feedback, or want to learn more about Medora?
                We&apos;d love to hear from you.
              </p>

              <ContactForm />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

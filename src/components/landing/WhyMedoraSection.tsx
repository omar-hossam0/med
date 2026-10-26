import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { ImageReveal, Stagger, StaggerItem } from "@/components/motion";
import { ASSETS } from "@/lib/constants";
import {
  LineChart,
  ClipboardList,
  MessagesSquare,
  FileCheck2,
  type LucideIcon,
} from "lucide-react";

const BENEFITS: { Icon: LucideIcon; title: string; text: string }[] = [
  {
    Icon: LineChart,
    title: "Unified patient overview",
    text: "Patient history, approved reports, and medications in one place.",
  },
  {
    Icon: ClipboardList,
    title: "AI-assisted reports",
    text: "Draft transcripts and structured medical reports, ready for review.",
  },
  {
    Icon: MessagesSquare,
    title: "Connected consultations",
    text: "Doctors and patients stay aligned across every appointment.",
  },
  {
    Icon: FileCheck2,
    title: "Approved medical records",
    text: "Every document is approved by the doctor before delivery.",
  },
];

export function WhyMedoraSection() {
  return (
    <section
      id="why-medora"
      className="relative scroll-mt-24 overflow-hidden bg-surface-cyan py-20 lg:py-28"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left text */}
          <div>
            <SectionHeading
              eyebrow="Why Choose Medora"
              align="left"
              title={<>A Complete Healthcare Platform</>}
              subtitle={
                <>
                  Medora brings clinical workflows, appointment coordination,
                  patient information, and AI-assisted documentation together in
                  one connected experience.
                </>
              }
            />

            <Stagger as="ul" stagger={0.1} amount={0.2} className="mt-7 grid gap-3">
              {BENEFITS.map(({ Icon, title, text }) => (
                <StaggerItem
                  as="li"
                  key={title}
                  y={20}
                  className="flex items-start gap-3 rounded-xl border border-line bg-white/70 p-3.5 backdrop-blur-sm"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-dark">
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy">{title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">
                      {text}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>

            <div className="mt-7">
              <Button as="a" href="#features" variant="primary" size="md" withArrow>
                Learn More
              </Button>
            </div>
          </div>

          {/* Right dashboard preview (self-framed high-res source) */}
          <ImageReveal className="relative" amount={0.3}>
            <div className="relative mx-auto w-full max-w-[600px]">
              <div className="relative overflow-hidden rounded-3xl shadow-pop ring-1 ring-line">
                <Image
                  src={ASSETS.dashboard}
                  alt="Medora dashboard preview showing today's overview, appointments and recent reports (decorative)"
                  sizes="(max-width: 1024px) 90vw, 600px"
                  className="h-auto w-full"
                />
              </div>
              {/* decorative blobs */}
              <div className="absolute -right-10 -top-10 -z-10 h-44 w-44 rounded-full bg-primary-light/30 blur-3xl" />
              <div className="absolute -bottom-12 -left-12 -z-10 h-52 w-52 rounded-full bg-primary-50 blur-3xl" />
            </div>
          </ImageReveal>
        </div>
      </Container>
    </section>
  );
}

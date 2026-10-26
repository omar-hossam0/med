import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { ImageReveal, Stagger, StaggerItem } from "@/components/motion";
import { ASSETS } from "@/lib/constants";
import { Building2, MapPin, Sparkles, FolderKanban } from "lucide-react";

const PILLS = [
  { Icon: Building2, label: "Modern clinic experience" },
  { Icon: MapPin, label: "Connected care across teams" },
  { Icon: Sparkles, label: "Reduced manual work" },
  { Icon: FolderKanban, label: "Organized medical info" },
];

export function AboutSection() {
  return (
    <section
      id="about"
      className="relative scroll-mt-24 overflow-hidden py-20 lg:py-28"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Text */}
          <div className="order-2 lg:order-1">
            <SectionHeading
              eyebrow="About Medora"
              align="left"
              title={<>A Smarter Way to Manage Healthcare</>}
              subtitle={
                <>
                  Medora is an AI-driven healthcare platform designed to simplify
                  clinical workflows, enhance patient experiences, and deliver
                  organized medical information across the entire care journey.
                </>
              }
            />
            <Stagger
              as="ul"
              stagger={0.08}
              amount={0.3}
              className="mt-7 grid gap-3 sm:grid-cols-2"
            >
              {PILLS.map(({ Icon, label }) => (
                <StaggerItem
                  as="li"
                  key={label}
                  y={16}
                  className="flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-navy shadow-soft"
                >
                  <span className="text-primary-dark">
                    <Icon size={16} />
                  </span>
                  {label}
                </StaggerItem>
              ))}
            </Stagger>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button as="a" href="#how-it-works" variant="primary" size="md" withArrow>
                Learn More
              </Button>
              <Button as="a" href="#features" variant="tertiary" size="md">
                View Features →
              </Button>
            </div>
          </div>

          {/* Image */}
          <div className="relative order-1 lg:order-2">
            <ImageReveal amount={0.3}>
              <div className="relative mx-auto w-full max-w-[560px]">
                <div className="relative overflow-hidden rounded-3xl shadow-pop ring-1 ring-line">
                  <Image
                    src={ASSETS.clinic}
                    alt="Modern Medora clinic building"
                    sizes="(max-width: 1024px) 90vw, 560px"
                    className="h-auto w-full"
                  />
                </div>

                {/* floating caption card */}
                <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-line sm:-left-6">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary-dark">
                    <Building2 size={18} />
                  </span>
                  <div className="leading-tight">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                      Medora Clinic
                    </p>
                    <p className="text-sm font-semibold text-navy">
                      Connected Care Environment
                    </p>
                  </div>
                  <span className="ml-2 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
                    Live
                  </span>
                </div>

                {/* soft halo */}
                <div className="absolute -inset-8 -z-10 rounded-[40%] bg-primary-light/15 blur-3xl" />
              </div>
            </ImageReveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

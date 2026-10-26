import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { GetStartedLink } from "@/components/ui/GetStartedLink";
import { ImageReveal, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ASSETS } from "@/lib/constants";
import {
  CalendarCheck2,
  FolderHeart,
  FileCheck2,
  Bell,
  Smartphone,
  Globe,
  type LucideIcon,
} from "lucide-react";

const BENEFITS: { Icon: LucideIcon; label: string }[] = [
  { Icon: CalendarCheck2, label: "View Appointments" },
  { Icon: FolderHeart, label: "Access Medical Records" },
  { Icon: FileCheck2, label: "View Approved Reports" },
  { Icon: Bell, label: "Get Follow-up Notifications" },
];

export function HealthAccessSection() {
  return (
    <section
      id="health"
      className="relative scroll-mt-24 overflow-hidden py-20 lg:py-28"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: devices mockup */}
          <ImageReveal amount={0.3} className="relative order-1">
            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="relative overflow-hidden rounded-3xl shadow-pop ring-1 ring-line">
                <Image
                  src={ASSETS.devices}
                  alt="Medora responsive web preview shown on a laptop and a phone"
                  sizes="(max-width: 1024px) 90vw, 560px"
                  className="h-auto w-full"
                />
                {/* small floating chips */}
                <div className="absolute left-5 top-5 inline-flex items-center rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-primary-dark shadow-soft ring-1 ring-line">
                  <Smartphone size={12} className="mr-1.5" />
                  Web App
                </div>
                <div className="absolute bottom-5 right-5 inline-flex items-center rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-primary-dark shadow-soft ring-1 ring-line">
                  <Globe size={12} className="mr-1.5" />
                  Responsive
                </div>
              </div>

              <div className="pointer-events-none absolute -right-10 -top-10 -z-10 h-48 w-48 rounded-full bg-primary-light/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-8 -z-10 h-44 w-44 rounded-full bg-primary-50 blur-3xl" />
            </div>
          </ImageReveal>

          {/* Right: copy + benefits */}
          <div className="order-2">
            <Stagger stagger={0.12} amount={0.4} className="flex flex-col items-start">
              <StaggerItem y={14}>
                <span className="eyebrow">
                  <span className="eyebrow-dot" />
                  Access Anytime, Anywhere
                </span>
              </StaggerItem>
              <StaggerItem y={26} className="mt-5">
                <h2 className="text-3xl font-bold leading-tight text-navy sm:text-4xl lg:text-[40px]">
                  Your Health in Your Hands
                </h2>
              </StaggerItem>
              <StaggerItem y={20} className="mt-4 max-w-xl">
                <p className="p-lead">
                  Stay connected to your healthcare journey. View your
                  appointments, medical records, approved reports, and follow-up
                  information from your web browser — on any device.
                </p>
              </StaggerItem>
            </Stagger>

            <Stagger
              as="ul"
              stagger={0.09}
              amount={0.3}
              className="mt-7 grid gap-3 sm:grid-cols-2"
            >
              {BENEFITS.map(({ Icon, label }) => (
                <StaggerItem
                  as="li"
                  key={label}
                  y={16}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white p-3.5 shadow-soft"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-dark">
                    <Icon size={16} />
                  </span>
                  <span className="text-sm font-medium text-navy">{label}</span>
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal delay={0.1} amount={0.4} className="mt-7">
              <div className="flex flex-wrap items-center gap-3">
                <GetStartedLink />
                <span className="text-[12px] text-ink-muted">
                  Browser-based · No install required
                </span>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

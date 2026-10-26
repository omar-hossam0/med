import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { MedoraLogo } from "@/components/ui/MedoraLogo";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import {
  FOOTER_PLATFORM,
  FOOTER_COMPANY,
  FOOTER_RESOURCES,
} from "@/data/landing-content";
import { Facebook, Instagram, Linkedin } from "lucide-react";

type Column = {
  title: string;
  items: { label: string; href: string; unavailable?: boolean }[];
};

const COLUMNS: Column[] = [
  { title: "Platform", items: FOOTER_PLATFORM },
  { title: "Company", items: FOOTER_COMPANY },
  { title: "Resources", items: FOOTER_RESOURCES },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      id="footer"
      className="relative isolate overflow-hidden text-white"
    >
      {/* Base gradient */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(140deg,#0a434a_0%,#08323c_32%,#071f2d_68%,#061826_100%)]"
      />

      {/* Flowing wave layers */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1440 700"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="fw-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#12706e" stopOpacity="0.55" />
            <stop offset="1" stopColor="#0a3b47" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="fw-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#14c4b4" stopOpacity="0.24" />
            <stop offset="1" stopColor="#0a4d55" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fw-c" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#05161f" stopOpacity="0.55" />
            <stop offset="1" stopColor="#071c2c" stopOpacity="0.92" />
          </linearGradient>
        </defs>

        <path
          fill="url(#fw-a)"
          d="M0,130 C320,50 640,210 960,150 C1180,110 1320,190 1440,160 L1440,700 L0,700 Z"
        />
        <path
          fill="url(#fw-b)"
          d="M0,240 C300,180 600,310 900,250 C1140,200 1320,290 1440,240 L1440,700 L0,700 Z"
        />
        <path
          fill="url(#fw-c)"
          d="M0,380 C360,320 720,450 1080,380 C1260,345 1380,400 1440,380 L1440,700 L0,700 Z"
        />
        {/* bright accent ribbon edge */}
        <path
          fill="none"
          stroke="#2fd9c6"
          strokeOpacity="0.28"
          strokeWidth="1.5"
          d="M0,130 C320,50 640,210 960,150 C1180,110 1320,190 1440,160"
        />
        <path
          fill="none"
          stroke="#2fd9c6"
          strokeOpacity="0.18"
          strokeWidth="1.5"
          d="M0,240 C300,180 600,310 900,250 C1140,200 1320,290 1440,240"
        />
      </svg>

      {/* Dotted pattern (right side) */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-8 top-28 h-44 w-44 opacity-40 [background-image:radial-gradient(rgba(19,196,180,0.55)_1.5px,transparent_1.5px)] [background-size:16px_16px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-24 left-6 h-32 w-32 opacity-25 [background-image:radial-gradient(rgba(19,196,180,0.5)_1.5px,transparent_1.5px)] [background-size:18px_18px]"
      />

      {/* White top wave transition (paints over the wave tops) */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[64px] w-full"
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
      >
        <path
          fill="#ffffff"
          d="M0,0 L1440,0 L1440,14 C1180,58 900,6 700,30 C500,54 240,4 0,36 Z"
        />
      </svg>

      <Container className="relative z-10 pb-8 pt-28 lg:pt-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Brand column */}
          <Reveal className="lg:col-span-4">
            <MedoraLogo variant="primary" height={40} />
            <p className="mt-5 max-w-[360px] text-[15px] leading-relaxed text-white/70">
              Smarter Healthcare for Healthier Lives. An AI-driven healthcare
              platform built for connected clinical workflows.
            </p>

            <div className="mt-6 flex items-center gap-2.5">
              <SocialIcon label="Facebook">
                <Facebook size={16} />
              </SocialIcon>
              <SocialIcon label="Instagram">
                <Instagram size={16} />
              </SocialIcon>
              <SocialIcon label="LinkedIn">
                <Linkedin size={16} />
              </SocialIcon>
            </div>
          </Reveal>

          {/* Link columns */}
          <div className="grid gap-10 sm:grid-cols-3 lg:col-span-8 lg:gap-8">
            {COLUMNS.map((col, ci) => (
              <Stagger
                key={col.title}
                stagger={0.06}
                delayChildren={ci * 0.05}
                amount={0.2}
              >
                <StaggerItem y={14}>
                  <h4 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-primary-light">
                    {col.title}
                  </h4>
                </StaggerItem>
                <ul className="mt-5 space-y-3">
                  {col.items.map((it) => (
                    <StaggerItem as="li" key={it.label} y={12}>
                      {it.unavailable ? (
                        <span
                          className="inline-flex cursor-default items-center gap-1.5 text-[15px] text-white/45"
                          title="Not available yet"
                        >
                          {it.label}
                        </span>
                      ) : (
                        <Link
                          href={it.href}
                          className="text-[15px] text-white/75 transition hover:text-white"
                        >
                          {it.label}
                        </Link>
                      )}
                    </StaggerItem>
                  ))}
                </ul>
              </Stagger>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-[13px] text-white/55 sm:flex-row">
          <p>© {year} Medora. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="cursor-default" title="Not available yet">
              Privacy Policy
            </span>
            <span aria-hidden className="h-3 w-px bg-white/20" />
            <span className="cursor-default" title="Not available yet">
              Terms of Service
            </span>
          </div>
        </div>
      </Container>
    </footer>
  );
}

/** Social placeholders — non-navigating until real profiles are provided. */
function SocialIcon({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="img"
      aria-label={`${label} — profile not yet available`}
      title={`${label} profile not yet available`}
      className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 transition hover:bg-primary-light/15 hover:text-white"
    >
      {children}
    </span>
  );
}

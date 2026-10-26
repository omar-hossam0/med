"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowUpRight, ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GetStartedLink } from "@/components/ui/GetStartedLink";
import { MedoraLogo } from "@/components/ui/MedoraLogo";
import { NAV_ITEMS } from "@/data/landing-content";
import { TransitionLink } from "@/components/transitions/TransitionLink";
import { cn } from "@/lib/cn";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Body lock when mobile menu open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (href === "#login" || href === "#signup") {
      e.preventDefault();
      showToast(
        "Account access will be available in a future phase of Medora.",
      );
      setOpen(false);
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-white/85 backdrop-blur-md shadow-[0_1px_0_0_rgba(15,23,42,0.05)]"
            : "bg-transparent",
        )}
      >
        <Container className="flex h-16 items-center justify-between gap-6 lg:h-[72px]">
          {/* Logo */}
          <Link
            href="#top"
            aria-label="Medora — go to top"
            className="-m-1 rounded p-1 transition hover:opacity-90"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
              setOpen(false);
            }}
          >
            <MedoraLogo variant="primary" height={32} priority />
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label="Primary"
            className="hidden flex-1 items-center justify-center lg:flex"
          >
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className="rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-secondary transition hover:bg-primary-50 hover:text-primary-dark"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right CTAs */}
          <div className="hidden items-center gap-2 lg:flex">
            <TransitionLink
              href="/login"
              className="rounded-full px-4 py-2 text-[14px] font-medium text-ink-secondary transition hover:bg-primary-50 hover:text-primary-dark"
            >
              Login
            </TransitionLink>
            <GetStartedLink />
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-navy transition hover:border-primary/40 lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </Container>

        {/* Mobile dropdown */}
        <div
          id="mobile-menu"
          className={cn(
            "lg:hidden",
            "overflow-hidden bg-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.18)] transition-[max-height,opacity] duration-300 ease-out",
            open ? "max-h-[640px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <Container className="flex flex-col gap-1 py-4">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="rounded-xl px-4 py-3 text-[15px] font-medium text-navy transition hover:bg-primary-50 hover:text-primary-dark"
              >
                {item.label}
              </a>
            ))}
            <div className="my-2 h-px bg-line" />
            <TransitionLink
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-[15px] font-medium text-navy transition hover:bg-primary-50"
            >
              Login
            </TransitionLink>
            <GetStartedLink fullWidth onClick={() => setOpen(false)} />
          </Container>
        </div>
      </header>

      {/* Toast */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4"
      >
        <div
          className={cn(
            "pointer-events-auto max-w-md rounded-2xl border border-primary-100 bg-white px-5 py-3 text-sm font-medium text-navy shadow-pop transition-all",
            toast
              ? "translate-y-0 opacity-100"
              : "-translate-y-3 opacity-0",
          )}
          role="status"
        >
          <span className="inline-flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-50 text-primary-dark">
              <ArrowUpRight size={14} />
            </span>
            {toast ?? "Placeholder"}
          </span>
        </div>
      </div>
    </>
  );
}

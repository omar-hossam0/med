"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Check,
  type LucideIcon,
} from "lucide-react";
import { MedoraLogo } from "@/components/ui/MedoraLogo";
import { TransitionLink } from "@/components/transitions/TransitionLink";
import { LoginWave } from "./LoginWave";
import { ASSETS } from "@/lib/constants";
import { homeForRoles } from "@/lib/role-home";
import { cn } from "@/lib/cn";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Staggered CSS reveal. Runs on first paint (no JS/hydration gate), so the
 * form is never invisible during the route transition — this is what fixes the
 * blank white flash. Disabled under prefers-reduced-motion (see globals.css).
 */
const delay = (i: number) => ({ animationDelay: `${i * 45}ms` });

export function LoginPage() {
  const router = useRouter();
  const { setUser, setCsrfToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setNotice(null), 3500);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Please enter your email address.";
    else if (!EMAIL_RE.test(email.trim()))
      next.email = "Please enter a valid email address.";
    if (!password.trim()) next.password = "Please enter your password.";
    setErrors(next);
    setServerError(null);

    if (Object.keys(next).length > 0) {
      setNotice(null);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.message || "Failed to sign in. Please verify your credentials.";
        setServerError(errorMsg);
        showNotice(errorMsg);
        return;
      }

      if (data.user) {
        setUser(data.user);
      }
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
      }

      showNotice("Signed in successfully. Redirecting...");

      const roles = data.user?.roles || [];
      // Every authenticated role needs a real destination. Sending a doctor to
      // /patient/dashboard made the patient guard bounce them back to /login,
      // which looked exactly like a failed sign-in.
      router.push(homeForRoles(roles) ?? "/workspace");
    } catch {
      const fallbackErr = "Unable to connect to authentication server. Please ensure the backend is running.";
      setServerError(fallbackErr);
      showNotice(fallbackErr);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-surface-subtle xl:h-screen xl:overflow-hidden xl:p-4">
      <div className="relative mx-auto min-h-screen w-full max-w-[1440px] overflow-hidden bg-white shadow-soft xl:h-full xl:min-h-0 xl:rounded-[28px] xl:shadow-pop">
      {/* ---------- Right: clinic image (wider panel = less zoom) ---------- */}
      <div className="absolute inset-y-0 right-0 z-0 hidden w-[56%] bg-[linear-gradient(135deg,#eafaf7_0%,#d6f2ee_100%)] xl:block">
        <Image
          src={ASSETS.loginBg}
          alt="Modern Medora healthcare clinic interior with daylight, teal seating, plants and reception"
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 56vw"
          quality={100}
          placeholder="blur"
          className="object-cover object-right"
        />
      </div>

      {/* ---------- Wave divider ---------- */}
      <LoginWave className="absolute inset-y-0 left-[36%] z-[1] hidden w-[24%] xl:block" />

      {/* ---------- Left: form ---------- */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1648px] xl:h-full xl:min-h-0">
        <div className="flex w-full xl:h-full xl:w-[44%]">
          <div className="w-full px-5 py-8 sm:px-8 sm:py-10 xl:my-auto xl:py-4">
            <div className="mx-auto w-full max-w-[500px]">
              {/* Back to Home */}
              <div className="login-reveal mb-4" style={delay(0)}>
                <TransitionLink
                  href="/"
                  className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-primary-dark transition hover:border-primary/60 hover:bg-primary-50"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-50 text-primary-dark transition group-hover:bg-primary group-hover:text-white">
                    <ArrowLeft size={12} />
                  </span>
                  Back to Home
                </TransitionLink>
              </div>

              {/* Header: logo + sign up */}
              <div
                className="login-reveal flex items-center justify-between gap-4"
                style={delay(1)}
              >
                <TransitionLink
                  href="/"
                  aria-label="Medora — back to home"
                  className="-m-1 rounded p-1 transition hover:opacity-90"
                >
                  <MedoraLogo variant="primary" height={30} />
                </TransitionLink>

                <div className="flex items-center gap-2.5">
                  <span className="hidden text-[13px] text-ink-muted sm:inline">
                    Don&apos;t have an account?
                  </span>
                  <TransitionLink
                    href="/signup"
                    className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-white px-4 py-2 text-[13px] font-semibold text-primary-dark transition hover:border-primary/60 hover:bg-primary-50"
                  >
                    Sign Up
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-50 text-primary-dark transition group-hover:bg-primary group-hover:text-white">
                      <ArrowRight size={12} />
                    </span>
                  </TransitionLink>
                </div>
              </div>

              {/* Welcome badge */}
              <div className="login-reveal mt-9" style={delay(2)}>
                <span className="eyebrow">
                  <span className="eyebrow-dot" />
                  Welcome Back
                </span>
              </div>

              {/* Heading */}
              <h1
                className="login-reveal mt-5 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-navy sm:text-[36px] xl:text-[40px]"
                style={delay(3)}
              >
                Sign in to your account
              </h1>

              {/* Paragraph */}
              <p
                className="login-reveal mt-3 max-w-[460px] text-[16px] leading-relaxed text-ink-secondary sm:text-[18px]"
                style={delay(4)}
              >
                Access your Medora account to continue your healthcare journey.
              </p>

              {/* Form */}
              <form
                onSubmit={onSubmit}
                noValidate
                className="login-reveal mt-8 space-y-3.5"
                style={delay(5)}
              >
                <AuthField
                  id="login-email"
                  label="Email Address"
                  placeholder="Email Address"
                  Icon={Mail}
                  type="email"
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  error={errors.email}
                  autoComplete="email"
                />

                <AuthField
                  id="login-password"
                  label="Password"
                  placeholder="Password"
                  Icon={Lock}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    setErrors((p) => ({ ...p, password: undefined }));
                  }}
                  error={errors.password}
                  autoComplete="current-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-primary-50 hover:text-primary-dark"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                {/* Remember + forgot */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-secondary">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-[18px] w-[18px] place-items-center rounded-[5px] border transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30",
                        remember
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-white",
                      )}
                    >
                      {remember && <Check size={12} strokeWidth={3} />}
                    </span>
                    Keep me signed in
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      showNotice("Password reset is coming in a future phase.")
                    }
                    className="text-[13.5px] font-medium text-primary-dark transition hover:text-primary"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Server Error Alert */}
                {serverError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-[13.5px] font-medium text-red-700">
                    {serverError}
                  </div>
                )}

                {/* Sign In */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group mt-2 inline-flex h-[58px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#005e59_0%,#008d81_65%,#0bb2a2_100%)] px-6 text-[17px] font-semibold text-white shadow-tealGlow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Signing In..." : "Sign In"}
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight size={15} />
                  </span>
                </button>

                {/* OR */}
                <div className="flex items-center gap-3 py-1.5">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                    OR
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                {/* Google */}
                <button
                  type="button"
                  onClick={() =>
                    showNotice("Google sign-in is coming in a future phase.")
                  }
                  className="inline-flex h-[56px] w-full items-center justify-center gap-3 rounded-full border border-line bg-white text-[16px] font-semibold text-navy transition hover:border-primary/30 hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </form>

              {/* Bottom */}
              <p
                className="login-reveal mt-7 text-center text-[13px] text-ink-muted"
                style={delay(6)}
              >
                Don&apos;t have an account?{" "}
                <Link
                  href="/#contact"
                  className="font-medium text-primary-dark transition hover:text-primary"
                >
                  Contact your administrator
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* spacer over the image on desktop */}
        <div className="hidden xl:block xl:w-[56%]" aria-hidden />
      </div>

      {/* Toast for unavailable actions */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-5 z-[60] flex justify-center px-4"
      >
        <div
          className={cn(
            "max-w-md rounded-xl bg-navy px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-pop transition-all duration-300",
            notice ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
          )}
          role="status"
        >
          {notice ?? ""}
        </div>
      </div>
      </div>
    </div>
  );
}

/* ---------- Field ---------- */
function AuthField({
  id,
  label,
  placeholder,
  Icon,
  type,
  value,
  onChange,
  error,
  autoComplete,
  trailing,
}: {
  id: string;
  label: string;
  placeholder: string;
  Icon: LucideIcon;
  type: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
        >
          <Icon size={18} />
        </span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-[56px] w-full rounded-[18px] border bg-white pl-12 text-[15px] text-navy outline-none transition-all placeholder:text-ink-muted/80",
            trailing ? "pr-12" : "pr-4",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
              : "border-line focus:border-primary focus:ring-4 focus:ring-primary/10",
          )}
        />
        {trailing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 pl-1 text-[12px] font-medium text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Google G ---------- */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

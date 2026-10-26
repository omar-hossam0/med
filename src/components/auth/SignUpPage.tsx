"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  Check,
  type LucideIcon,
} from "lucide-react";
import { MedoraLogo } from "@/components/ui/MedoraLogo";
import { TransitionLink } from "@/components/transitions/TransitionLink";
import { LoginWave } from "./LoginWave";
import { DateField } from "./DateField";
import { GenderField } from "./GenderField";
import { ASSETS } from "@/lib/constants";
import { cn } from "@/lib/cn";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Staggered CSS reveal — runs on first paint (no hydration gate → no blank). */
const reveal = (i: number) => ({ animationDelay: `${i * 30}ms` });

import { useRouter } from "next/navigation";

type Errors = Partial<
  Record<
    "firstName" | "lastName" | "email" | "phone" | "password" | "confirm" | "agree",
    string
  >
>;

export function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setNotice(null), 3500);
  };

  const reqs = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
  ];
  const passwordValid = reqs.every((r) => r.met);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = "Please enter your first name.";
    if (!lastName.trim()) next.lastName = "Please enter your last name.";
    if (!email.trim()) next.email = "Please enter your email address.";
    else if (!EMAIL_RE.test(email.trim()))
      next.email = "Please enter a valid email address.";
    if (phone.trim() && !/^[+\d][\d\s()-]{5,}$/.test(phone.trim()))
      next.phone = "Please enter a valid phone number.";
    if (!password) next.password = "Please create a password.";
    else if (!passwordValid)
      next.password = "Password does not meet all the requirements.";
    if (!confirm) next.confirm = "Please confirm your password.";
    else if (confirm !== password) next.confirm = "Passwords do not match.";
    if (!agree)
      next.agree = "Please agree to the Terms of Service and Privacy Policy.";

    setErrors(next);
    setServerError(null);

    if (Object.keys(next).length > 0) {
      setNotice(null);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setErrors((p) => ({
            ...p,
            email: "An account with this email address already exists.",
          }));
        }
        const errorMsg =
          data.message || "Failed to create account. Please verify your information.";
        setServerError(errorMsg);
        showNotice(errorMsg);
        return;
      }

      showNotice("Account created successfully! Redirecting to sign in...");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch {
      const fallbackMsg =
        "Unable to connect to authentication server. Please ensure the backend is running.";
      setServerError(fallbackMsg);
      showNotice(fallbackMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clear = (k: keyof Errors) =>
    setErrors((p) => ({ ...p, [k]: undefined }));

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-surface-subtle xl:h-screen xl:overflow-hidden xl:p-4">
      <div className="relative mx-auto min-h-screen w-full max-w-[1440px] overflow-hidden bg-white shadow-soft xl:h-full xl:min-h-0 xl:rounded-[28px] xl:shadow-pop">
        {/* ---------- Right: clinic image (identical to Login) ---------- */}
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

        {/* ---------- Wave divider (shared with Login) ---------- */}
        <LoginWave className="absolute inset-y-0 left-[36%] z-[1] hidden w-[24%] xl:block" />

        {/* ---------- Left: form ---------- */}
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1648px] xl:h-full xl:min-h-0">
          <div className="flex w-full xl:h-full xl:w-[44%]">
            <div className="w-full px-5 py-8 sm:px-8 sm:py-10 xl:my-auto xl:py-4">
              <div className="signup-content mx-auto w-full max-w-[500px]">
                {/* Back to Home */}
                <div className="login-reveal" style={reveal(0)}>
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

                {/* Logo + Sign In */}
                <div
                  className="login-reveal mt-4 flex items-center justify-between gap-4"
                  style={reveal(1)}
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
                      Already have an account?
                    </span>
                    <TransitionLink
                      href="/login"
                      className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-white px-4 py-2 text-[13px] font-semibold text-primary-dark transition hover:border-primary/60 hover:bg-primary-50"
                    >
                      Sign In
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-50 text-primary-dark transition group-hover:bg-primary group-hover:text-white">
                        <ArrowRight size={12} />
                      </span>
                    </TransitionLink>
                  </div>
                </div>

                {/* Badge */}
                <div className="login-reveal mt-4" style={reveal(2)}>
                  <span className="eyebrow">
                    <span className="eyebrow-dot" />
                    Join Medora
                  </span>
                </div>

                {/* Heading */}
                <h1
                  className="login-reveal mt-3 text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-navy sm:text-[30px] xl:text-[32px]"
                  style={reveal(3)}
                >
                  Create your patient account
                </h1>

                {/* Description */}
                <p
                  className="login-reveal mt-1.5 max-w-[480px] text-[13.5px] leading-relaxed text-ink-secondary sm:text-[14px]"
                  style={reveal(4)}
                >
                  Join Medora to manage your appointments, access approved
                  medical reports, and stay connected to your healthcare journey.
                </p>

                {/* Form */}
                <form
                  onSubmit={onSubmit}
                  noValidate
                  className="login-reveal mt-4"
                  style={reveal(5)}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <AuthField
                      id="su-first"
                      label="First Name"
                      placeholder="First Name"
                      Icon={User}
                      value={firstName}
                      onChange={(v) => {
                        setFirstName(v);
                        clear("firstName");
                      }}
                      error={errors.firstName}
                      autoComplete="given-name"
                    />
                    <AuthField
                      id="su-last"
                      label="Last Name"
                      placeholder="Last Name"
                      Icon={User}
                      value={lastName}
                      onChange={(v) => {
                        setLastName(v);
                        clear("lastName");
                      }}
                      error={errors.lastName}
                      autoComplete="family-name"
                    />
                    <AuthField
                      id="su-email"
                      label="Email Address"
                      placeholder="Email Address"
                      Icon={Mail}
                      type="email"
                      value={email}
                      onChange={(v) => {
                        setEmail(v);
                        clear("email");
                      }}
                      error={errors.email}
                      autoComplete="email"
                    />
                    <AuthField
                      id="su-phone"
                      label="Phone Number (Optional)"
                      placeholder="Phone Number (Optional)"
                      Icon={Phone}
                      type="tel"
                      value={phone}
                      onChange={(v) => {
                        setPhone(v);
                        clear("phone");
                      }}
                      error={errors.phone}
                      autoComplete="tel"
                    />

                    <DateField
                      id="su-dob"
                      label="Date of Birth (Optional)"
                      placeholder="Date of Birth (Optional)"
                      value={dob}
                      onChange={setDob}
                    />
                    <GenderField
                      id="su-gender"
                      label="Gender (Optional)"
                      placeholder="Select gender"
                      value={gender}
                      onChange={setGender}
                    />

                    <AuthField
                      id="su-password"
                      label="Create Password"
                      placeholder="Create Password"
                      Icon={Lock}
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(v) => {
                        setPassword(v);
                        clear("password");
                      }}
                      error={errors.password}
                      autoComplete="new-password"
                      trailing={
                        <TogglePw shown={showPw} onToggle={() => setShowPw((v) => !v)} />
                      }
                    />
                    <AuthField
                      id="su-confirm"
                      label="Confirm Password"
                      placeholder="Confirm Password"
                      Icon={Lock}
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(v) => {
                        setConfirm(v);
                        clear("confirm");
                      }}
                      error={errors.confirm}
                      autoComplete="new-password"
                      trailing={
                        <TogglePw
                          shown={showConfirm}
                          onToggle={() => setShowConfirm((v) => !v)}
                        />
                      }
                    />
                  </div>

                  {/* Password requirements */}
                  <div className="mt-2 rounded-xl bg-primary-50/70 p-3 ring-1 ring-primary-100/60">
                    <p className="text-[11.5px] font-semibold text-navy">
                      Password must contain:
                    </p>
                    <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                      {reqs.map((r) => (
                        <li
                          key={r.label}
                          className="flex items-center gap-2 text-[11.5px]"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "grid h-4 w-4 shrink-0 place-items-center rounded-full transition",
                              r.met
                                ? "bg-primary text-white"
                                : "bg-white text-ink-muted ring-1 ring-line",
                            )}
                          >
                            <Check size={10} strokeWidth={3} />
                          </span>
                          <span
                            className={cn(
                              r.met ? "text-ink-secondary" : "text-ink-muted",
                            )}
                          >
                            {r.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Terms */}
                  <div className="mt-2.5">
                    <label className="flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-ink-secondary">
                      <input
                        type="checkbox"
                        checked={agree}
                        onChange={(e) => {
                          setAgree(e.target.checked);
                          clear("agree");
                        }}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30",
                          agree
                            ? "border-primary bg-primary text-white"
                            : "border-line bg-white",
                        )}
                      >
                        {agree && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span>
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={() =>
                            showNotice("Terms of Service are coming soon.")
                          }
                          className="font-medium text-primary-dark underline underline-offset-2 transition hover:text-primary"
                        >
                          Terms of Service
                        </button>{" "}
                        and{" "}
                        <button
                          type="button"
                          onClick={() =>
                            showNotice("Privacy Policy is coming soon.")
                          }
                          className="font-medium text-primary-dark underline underline-offset-2 transition hover:text-primary"
                        >
                          Privacy Policy
                        </button>
                        .
                      </span>
                    </label>
                    {errors.agree && (
                      <p className="mt-1 pl-7 text-[11.5px] font-medium text-red-500">
                        {errors.agree}
                      </p>
                    )}
                  </div>

                  {/* Server Error Alert */}
                  {serverError && (
                    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-[13px] font-medium text-red-700">
                      {serverError}
                    </div>
                  )}

                  {/* Create Account */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group mt-3 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#005e59_0%,#008d81_65%,#0bb2a2_100%)] px-6 text-[15px] font-semibold text-white shadow-tealGlow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Creating Account..." : "Create Account"}
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
                      <ArrowRight size={15} />
                    </span>
                  </button>

                  {/* OR */}
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                      Or
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  {/* Google */}
                  <button
                    type="button"
                    onClick={() =>
                      showNotice("Google sign-up is coming in a future phase.")
                    }
                    className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-full border border-line bg-white text-[14px] font-semibold text-navy transition hover:border-primary/30 hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* spacer over the image on desktop */}
          <div className="hidden xl:block xl:w-[56%]" aria-hidden />
        </div>
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
  );
}

/* ---------- Toggle password visibility ---------- */
function TogglePw({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-primary-50 hover:text-primary-dark"
    >
      {shown ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

/* ---------- Standard input ---------- */
function AuthField({
  id,
  label,
  placeholder,
  Icon,
  type = "text",
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
  type?: string;
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
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
        >
          <Icon size={17} />
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
            "h-[50px] w-full rounded-[14px] border bg-white pl-10 text-[13.5px] text-navy outline-none transition-all placeholder:text-ink-muted/80",
            trailing ? "pr-11" : "pr-3.5",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
              : "border-line hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10",
          )}
        />
        {trailing && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 pl-1 text-[11.5px] font-medium text-red-500"
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

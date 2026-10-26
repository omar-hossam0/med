"use client";

import { useState } from "react";
import {
  User,
  Mail,
  Building2,
  Phone,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";
import { ContactFormField } from "@/components/ui/ContactFormField";

type Values = {
  name: string;
  email: string;
  organization: string;
  phone: string;
  message: string;
};

const EMPTY: Values = {
  name: "",
  email: "",
  organization: "",
  phone: "",
  message: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s()-]{5,}$/;

export function ContactForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [notice, setNotice] = useState<{ type: "ok" | "info"; text: string } | null>(
    null,
  );

  const set = (key: keyof Values) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): Partial<Record<keyof Values, string>> => {
    const next: Partial<Record<keyof Values, string>> = {};
    if (!values.name.trim()) next.name = "Please enter your name.";
    if (!values.email.trim()) next.email = "Please enter your email address.";
    else if (!EMAIL_RE.test(values.email.trim()))
      next.email = "Please enter a valid email address.";
    if (values.phone.trim() && !PHONE_RE.test(values.phone.trim()))
      next.phone = "Please enter a valid phone number.";
    if (!values.message.trim()) next.message = "Please enter a message.";
    return next;
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      setNotice(null);
      return;
    }

    // Frontend-only: no delivery service is configured in this build.
    setNotice({
      type: "info",
      text:
        "Thanks for the details. Message delivery is not connected in this frontend build yet, so no message has been sent.",
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <ContactFormField
          id="contact-name"
          label="Your Name"
          placeholder="Your Name"
          Icon={User}
          value={values.name}
          onChange={set("name")}
          error={errors.name}
          required
          autoComplete="name"
        />
        <ContactFormField
          id="contact-email"
          label="Your Email"
          placeholder="Your Email"
          Icon={Mail}
          type="email"
          value={values.email}
          onChange={set("email")}
          error={errors.email}
          required
          autoComplete="email"
        />
        <ContactFormField
          id="contact-organization"
          label="Your Organization (Optional)"
          placeholder="Your Organization (Optional)"
          Icon={Building2}
          value={values.organization}
          onChange={set("organization")}
          autoComplete="organization"
        />
        <ContactFormField
          id="contact-phone"
          label="Your Phone (Optional)"
          placeholder="Your Phone (Optional)"
          Icon={Phone}
          type="tel"
          value={values.phone}
          onChange={set("phone")}
          error={errors.phone}
          autoComplete="tel"
        />
        <div className="sm:col-span-2">
          <ContactFormField
            id="contact-message"
            label="Your Message"
            placeholder="Your Message"
            Icon={MessageSquare}
            value={values.message}
            onChange={set("message")}
            error={errors.message}
            required
            multiline
            rows={5}
          />
        </div>
      </div>

      <button
        type="submit"
        className="group mt-5 inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#005f5b_0%,#008e82_65%,#00a895_100%)] px-6 text-[15px] font-semibold text-white shadow-tealGlow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Send Message
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
          <ArrowRight size={15} />
        </span>
      </button>

      {notice && (
        <p
          role="status"
          aria-live="polite"
          className={
            notice.type === "ok"
              ? "mt-4 flex items-start gap-2 rounded-xl bg-success/10 px-3.5 py-2.5 text-[12.5px] font-medium text-success"
              : "mt-4 flex items-start gap-2 rounded-xl bg-primary-50 px-3.5 py-2.5 text-[12.5px] font-medium text-primary-dark"
          }
        >
          {notice.type === "ok" ? (
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          ) : (
            <Info size={15} className="mt-0.5 shrink-0" />
          )}
          <span>{notice.text}</span>
        </p>
      )}
    </form>
  );
}

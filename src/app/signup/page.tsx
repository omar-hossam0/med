import type { Metadata } from "next";
import { SignUpPage } from "@/components/auth/SignUpPage";

export const metadata: Metadata = {
  title: "Create your patient account — Medora",
  description:
    "Join Medora to manage your appointments, access approved medical reports, and stay connected to your healthcare journey.",
};

export default function SignUpRoute() {
  return <SignUpPage />;
}

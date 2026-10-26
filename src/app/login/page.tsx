import type { Metadata } from "next";
import { LoginPage } from "@/components/auth/LoginPage";

export const metadata: Metadata = {
  title: "Sign In — Medora",
  description:
    "Sign in to your Medora account to continue your healthcare journey.",
};

export default function LoginRoute() {
  return <LoginPage />;
}

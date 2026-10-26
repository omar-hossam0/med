import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

/**
 * Inter is bundled locally via @fontsource-variable/inter so the build
 * never depends on reaching fonts.googleapis.com (offline-safe).
 * This still uses next/font for self-hosting + automatic fallback metrics.
 */
const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  title: "Medora — Smarter Healthcare for Healthier Lives",
  description:
    "Medora is an AI-powered healthcare platform that connects patients, doctors, and healthcare teams through intelligent, streamlined clinical workflows.",
  openGraph: {
    title: "Medora — Smarter Healthcare for Healthier Lives",
    description:
      "An AI-driven healthcare platform for clinical workflows, patient records, and connected care.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white text-navy antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

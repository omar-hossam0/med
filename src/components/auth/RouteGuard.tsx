"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Client-side route guard backed by the real backend session (`/api/auth/me`).
 *
 * - While the session is being resolved, nothing protected is rendered.
 * - Unauthenticated visitors are redirected to /login.
 * - Authenticated users without an allowed role are safely redirected to their
 *   own dashboard (patient <-> admin) instead of seeing protected data.
 *
 * Backend APIs are independently protected by requireAuth/requireRole; this
 * guard is defence-in-depth for navigation, not a replacement for API authz.
 */
export function RouteGuard({
  allow,
  children,
}: {
  allow: string[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const allowed = !!user && allow.some((role) => user.roles?.includes(role));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      const target = user.roles?.includes("admin")
        ? "/admin/dashboard"
        : user.roles?.includes("patient")
          ? "/patient/dashboard"
          : "/login";
      router.replace(target);
    }
  }, [loading, user, allowed, router]);

  if (loading || !allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F7FBFB]">
        <div className="flex flex-col items-center gap-3 text-[#5B6B7C]">
          <div
            role="status"
            aria-label="Checking session"
            className="h-8 w-8 animate-spin rounded-full border-2 border-[#0A9189]/25 border-t-[#0A9189]"
          />
          <span className="text-[12.5px]">
            {loading ? "Checking session…" : "Redirecting…"}
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

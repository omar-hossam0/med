"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { homeForRoles } from "@/lib/role-home";

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
  const pathname = usePathname();

  const allowed = !!user && allow.some((role) => user.roles?.includes(role));
  const home = user ? homeForRoles(user.roles) : null;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed && home && home !== pathname) {
      router.replace(home);
    }
  }, [loading, user, allowed, home, pathname, router]);

  if (loading) {
    return <SessionSpinner label="Checking session…" />;
  }

  if (!allowed) {
    if (home && home !== pathname) {
      return <SessionSpinner label="Redirecting…" />;
    }

    return (
      <div className="grid min-h-screen place-items-center bg-[#F7FBFB] px-4">
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-white p-6 text-center shadow-soft">
          <p className="text-[13px] font-semibold text-[#0F2D4A]">
            No workspace for this account
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B7C]">
            This account has no role with an assigned workspace. Ask an administrator to
            review its role assignment.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function SessionSpinner({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F7FBFB]">
      <div className="flex flex-col items-center gap-3 text-[#5B6B7C]">
        <div
          role="status"
          aria-label="Checking session"
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#0A9189]/25 border-t-[#0A9189]"
        />
        <span className="text-[12.5px]">{label}</span>
      </div>
    </div>
  );
}

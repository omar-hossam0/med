"use client";

import { usePathname } from "next/navigation";

/**
 * Root route transition. Admin pages are excluded here because the Admin
 * shell animates only its main content (see app/admin/layout.tsx). Patient
 * pages do the same in app/patient/layout.tsx so the sidebar/topbar remain
 * stable between routes. Other pages keep the existing `.page-enter` fade.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasShellTransition =
    pathname?.startsWith("/admin") || pathname?.startsWith("/patient");
  return <div className={hasShellTransition ? undefined : "page-enter"}>{children}</div>;
}

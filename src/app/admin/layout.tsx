"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AdminComingSoonProvider } from "@/components/admin/ComingSoon";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { useAuth } from "@/lib/auth-context";
import { UsersProvider } from "@/components/admin/users/UsersProvider";
import { ReferenceDataProvider } from "@/components/admin/ReferenceDataProvider";
import {
  sidebarLayoutVars,
  sidebarContentStyle,
} from "@/components/transitions/sidebar";
import { ADMIN_PAGE_TRANSITION, ADMIN_PAGE_OFFSET } from "@/components/transitions/page";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const { user, loading } = useAuth();

  // Replay the entrance transition on every navigation. This replaces the
  // previous `key={pathname}` remount, which destroyed nested layout state —
  // e.g. the Doctors & Staff directory (tab/filters/view/page) reset whenever
  // a member detail page was opened and the user navigated back.
  //
  // Wait for the guarded content to mount before starting. On a hard reload the
  // route guard renders its session spinner first; starting the controls for a
  // page that is not mounted yet leaves the animated wrapper at opacity 0.
  useEffect(() => {
    if (loading || !user) return;
    if (reduce) {
      controls.set({ opacity: 1, y: 0 });
      return;
    }
    controls.set({ opacity: 0, y: ADMIN_PAGE_OFFSET });
    controls.start({ opacity: 1, y: 0, transition: ADMIN_PAGE_TRANSITION });
  }, [pathname, controls, reduce, loading, user]);

  return (
    <RouteGuard allow={["admin"]}>
      <AdminComingSoonProvider>
        <UsersProvider>
          <ReferenceDataProvider>
            <div
              style={sidebarLayoutVars(collapsed)}
              className="min-h-screen bg-[#F3F8F8] text-[#0F2D4A]"
            >
              <AdminSidebar
                open={open}
                onClose={() => setOpen(false)}
                collapsed={collapsed}
              />
              <div
                className="lg:pl-[var(--admin-sidebar-w)]"
                style={sidebarContentStyle()}
              >
                <div className="p-3">
                  <AdminTopbar
                    onMenu={() => setOpen(true)}
                    collapsed={collapsed}
                    onToggleCollapse={() => setCollapsed((v) => !v)}
                  />
                  <main className="mt-3">
                    {/* Only the page content animates; the shell above stays fixed.
                        Deliberately no `key` — remounting children on navigation
                        would wipe nested layout state (Doctors & Staff directory). */}
                    <motion.div
                      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: ADMIN_PAGE_OFFSET }}
                      animate={controls}
                    >
                      {children}
                    </motion.div>
                  </main>
                </div>
              </div>
            </div>
          </ReferenceDataProvider>
        </UsersProvider>
      </AdminComingSoonProvider>
    </RouteGuard>
  );
}

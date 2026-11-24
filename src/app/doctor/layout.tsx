"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { DoctorSidebar } from "@/components/doctor/DoctorSidebar";
import { DoctorTopbar } from "@/components/doctor/DoctorTopbar";
import { DoctorWorkspaceProvider } from "@/components/doctor/DoctorWorkspace";
import { ComingSoonProvider } from "@/components/patient/ComingSoon";

/**
 * Doctor Portal shell.
 *
 * Sidebar and topbar stay mounted across navigation; only the page content
 * animates, using the same `.page-enter` convention as the Patient shell.
 */
export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    // Temporary visual preview: authentication is intentionally bypassed for
    // the doctor portal until its backend session is wired.
    <ComingSoonProvider>
      <DoctorWorkspaceProvider>
        <div className="min-h-screen bg-[#F4F9F8] text-[#0F2D4A]">
          <DoctorSidebar open={open} onClose={() => setOpen(false)} />
          <div className="lg:pl-[228px]">
            <DoctorTopbar onMenu={() => setOpen(true)} />
            <main className="px-3 pb-7 pt-4 sm:px-4 lg:pb-8">
              <div key={pathname} className="page-enter">
                {children}
              </div>
            </main>
          </div>
        </div>
      </DoctorWorkspaceProvider>
    </ComingSoonProvider>
  );
}

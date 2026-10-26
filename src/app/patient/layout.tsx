"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { PatientSidebar } from "@/components/patient/PatientSidebar";
import { PatientTopbar } from "@/components/patient/PatientTopbar";
import { ComingSoonProvider } from "@/components/patient/ComingSoon";
import { RouteGuard } from "@/components/auth/RouteGuard";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <RouteGuard allow={["patient"]}>
      <ComingSoonProvider>
        <div className="min-h-screen bg-[#F6FAFA] text-[#0F2D4A]">
          <PatientSidebar open={open} onClose={() => setOpen(false)} />
          <div className="lg:pl-[228px]">
            <PatientTopbar onMenu={() => setOpen(true)} />
            <main className="px-3 pb-7 pt-4 sm:px-4 lg:pb-8">
              {/* Only the page content animates; the Patient shell stays fixed. */}
              <div key={pathname} className="page-enter">
                {children}
              </div>
            </main>
          </div>
        </div>
      </ComingSoonProvider>
    </RouteGuard>
  );
}

"use client";

import { DirectoryProvider } from "@/components/admin/doctors-staff/DirectoryProvider";

export default function DoctorsStaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DirectoryProvider>{children}</DirectoryProvider>;
}

import type { Metadata } from "next";
import { UsersManagement } from "@/components/admin/users/UsersManagement";

export const metadata: Metadata = {
  title: "Users Management — Medora",
  description: "Manage and monitor patient, doctor, and staff accounts (demo data).",
};

export default function UsersPage() {
  return <UsersManagement />;
}

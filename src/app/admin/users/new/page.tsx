import type { Metadata } from "next";
import { AddUserForm } from "@/components/admin/users/AddUserForm";

export const metadata: Metadata = {
  title: "Add New User — Medora",
  description: "Create a new doctor or staff account (demo, frontend only).",
};

export default function NewUserPage() {
  return <AddUserForm />;
}

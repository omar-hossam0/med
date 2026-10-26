"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { findMember } from "@/lib/mock/doctorsStaff";
import { useUsers } from "@/components/admin/users/UsersProvider";
import { MemberDetails } from "@/components/admin/doctors-staff/MemberDetails";

export default function StaffDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { users } = useUsers();
  const member = findMember(users, String(id));

  if (!member || member.kind !== "staff") {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
        <p className="text-[13px] font-semibold text-[#0F2D4A]">Staff member not found</p>
        <p className="mt-1 text-[11.5px] text-[#7A8B9C]">
          This demo record does not exist in the local dataset.
        </p>
        <Link
          href="/admin/doctors-staff"
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0A9189] hover:underline"
        >
          <ArrowLeft size={14} />
          Back to Doctors &amp; Staff
        </Link>
      </div>
    );
  }

  return <MemberDetails member={member} />;
}

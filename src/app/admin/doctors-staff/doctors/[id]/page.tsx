"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { DirectoryMember } from "@/lib/mock/doctorsStaff";
import { adminApi, ApiError } from "@/lib/api/admin";
import { MemberDetails } from "@/components/admin/doctors-staff/MemberDetails";

export default function DoctorDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<DirectoryMember | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");

    adminApi
      .getMember(String(id))
      .then((data) => {
        if (!active) return;
        setMember(data.member);
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setMember(null);
        setMessage(
          err instanceof ApiError && err.status === 404
            ? "This doctor does not exist in the database."
            : err instanceof ApiError
              ? err.message
              : "Could not load this doctor.",
        );
        setStatus("missing");
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
        <p className="text-[12.5px] text-[#7A8B9C]">Loading doctor…</p>
      </div>
    );
  }

  if (status === "missing" || !member || member.kind !== "doctor") {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
        <p className="text-[13px] font-semibold text-[#0F2D4A]">Doctor not found</p>
        <p className="mt-1 text-[11.5px] text-[#7A8B9C]">
          {message ?? "This doctor does not exist in the database."}
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

  return <MemberDetails member={member} onUpdated={setMember} />;
}

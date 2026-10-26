"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  MoreVertical,
  Building2,
  Phone,
  Mail,
  Stethoscope,
  Briefcase,
} from "lucide-react";
import {
  ACCOUNT_STATUS_LABEL,
  DUTY_LABEL,
  VERIFICATION_LABEL,
  type DirectoryMember,
  type DutyStatus,
  type VerificationStatus,
  type AccountStatus,
} from "@/lib/mock/doctorsStaff";
import { Avatar } from "@/components/admin/ui";
import { Popover } from "@/components/ui/Popover";
import { useComingSoon } from "@/components/admin/ComingSoon";
import { cn } from "@/lib/cn";

const VERIFICATION_BADGE: Record<VerificationStatus, string> = {
  verified: "bg-[#E6FAF7] text-[#0A9189]",
  pending: "bg-[#FFF6E5] text-[#C77A0A]",
  rejected: "bg-[#FDECEF] text-[#E5484D]",
};

const ACCOUNT_BADGE: Record<AccountStatus, string> = {
  active: "bg-[#E6FAF7] text-[#0A9189]",
  inactive: "bg-[#FDECEF] text-[#E5484D]",
  pending: "bg-[#FFF6E5] text-[#C77A0A]",
  suspended: "bg-[#F1F5F9] text-[#64748B]",
};

const DUTY_BADGE: Record<DutyStatus, string> = {
  "on-duty": "bg-[#E6FAF7] text-[#0A9189]",
  "on-leave": "bg-[#F1F5F9] text-[#64748B]",
  off: "bg-[#F1F5F9] text-[#64748B]",
};

export function memberDetailHref(m: DirectoryMember) {
  return m.kind === "doctor"
    ? `/admin/doctors-staff/doctors/${m.id}`
    : `/admin/doctors-staff/staff/${m.id}`;
}

export function MemberCard({ member }: { member: DirectoryMember }) {
  const comingSoon = useComingSoon();
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryLine =
    member.kind === "doctor" ? member.specialty : member.area || member.jobTitle;

  // Status indicator dot at bottom right of avatar
  const statusDotClass =
    member.kind === "doctor"
      ? member.duty === "on-duty"
        ? "bg-[#10B981]"
        : member.duty === "on-leave"
          ? "bg-[#94A3B8]"
          : "bg-[#CBD5E1]"
      : member.accountStatus === "active"
        ? "bg-[#10B981]"
        : member.accountStatus === "inactive"
          ? "bg-[#EF4444]"
          : "bg-[#F59E0B]";

  const badges =
    member.kind === "doctor"
      ? [
          {
            key: "verification",
            label: VERIFICATION_LABEL[member.verification],
            cls: VERIFICATION_BADGE[member.verification],
          },
          {
            key: "duty",
            label: DUTY_LABEL[member.duty],
            cls: DUTY_BADGE[member.duty],
          },
        ]
      : [
          {
            key: "account",
            label: `• ${ACCOUNT_STATUS_LABEL[member.accountStatus]}`,
            cls: ACCOUNT_BADGE[member.accountStatus],
          },
        ];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E9F0F0] bg-white p-3.5 shadow-[0_2px_8px_-2px_rgba(15,45,74,0.06)] transition hover:border-[#0A9189]/40 hover:shadow-[0_8px_20px_-6px_rgba(10,145,137,0.15)]">
      <div>
        {/* Header: avatar with status dot + identity + actions menu */}
        <div className="flex items-start gap-2.5">
          <div className="relative shrink-0">
            {member.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={member.photoUrl}
                alt={member.name}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <Avatar name={member.name} size={44} />
            )}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                statusDotClass,
              )}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#0F2D4A]">{member.name}</p>
            <p className="truncate text-[10.5px] text-[#7A8B9C]">
              {member.kind === "doctor" ? member.title : member.jobTitle}
            </p>
            {/* Badges row */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {badges.map((b) => (
                <span
                  key={b.key}
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold",
                    b.cls,
                  )}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          <button
            ref={menuRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={`Actions for ${member.name}`}
            aria-expanded={menuOpen}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-[#7A8B9C] transition hover:bg-surface-subtle hover:text-[#0F2D4A]"
          >
            <MoreVertical size={14} />
          </button>
        </div>

        {/* Detail rows */}
        <dl className="mt-3.5 space-y-1.5 border-t border-line/50 pt-3">
          <Row
            icon={member.kind === "doctor" ? Stethoscope : Briefcase}
            iconColor="#0A9189"
            value={primaryLine}
          />
          <Row icon={Building2} iconColor="#3B6EF6" value={member.location} />
          <Row icon={Phone} iconColor="#0A9189" value={member.phone} />
          <Row icon={Mail} iconColor="#3B6EF6" value={member.email} />
        </dl>
      </div>

      {/* Actions */}
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <Link
          href={memberDetailHref(member)}
          className="inline-flex h-7.5 items-center justify-center rounded-lg bg-[#E6FAF7] px-2 text-[11px] font-semibold text-[#0A9189] transition hover:bg-[#D5F5EF]"
        >
          View Details
        </Link>
        <button
          type="button"
          onClick={() => comingSoon(`Edit ${member.name}`)}
          className="inline-flex h-7.5 items-center justify-center rounded-lg bg-[#E6FAF7] px-2 text-[11px] font-semibold text-[#0A9189] transition hover:bg-[#D5F5EF]"
        >
          Edit
        </button>
      </div>

      {/* Row actions menu */}
      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuRef}
        width={180}
        className="py-1"
      >
        <Link
          href={memberDetailHref(member)}
          onClick={() => setMenuOpen(false)}
          className="block px-3 py-1.5 text-left text-[11.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
        >
          View Details
        </Link>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            comingSoon(`Edit ${member.name}`);
          }}
          className="block w-full px-3 py-1.5 text-left text-[11.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            comingSoon("Change Status");
          }}
          className="block w-full px-3 py-1.5 text-left text-[11.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
        >
          Change Status
        </button>
      </Popover>
    </div>
  );
}

function Row({
  icon: Icon,
  iconColor,
  value,
}: {
  icon: typeof Stethoscope;
  iconColor: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={12.5} className="shrink-0" style={{ color: iconColor }} aria-hidden />
      <dd className="truncate text-[10.5px] text-[#5B6B7C]">{value}</dd>
    </div>
  );
}

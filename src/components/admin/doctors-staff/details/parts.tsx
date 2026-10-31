"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  X,
  Pencil,
  MoreVertical,
  CalendarClock,
  KeyRound,
  Mail,
  MapPin,
  Briefcase,
  Stethoscope,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import {
  ACCOUNT_STATUS_LABEL,
  DUTY_LABEL,
  VERIFICATION_LABEL,
  type AccountStatus,
  type DirectoryMember,
  type DoctorMember,
  type StaffMember,
  type VerificationStatus,
} from "@/lib/mock/doctorsStaff";
import { Avatar } from "@/components/admin/ui";
import { Popover } from "@/components/ui/Popover";
import { useComingSoon } from "@/components/admin/ComingSoon";
import { cn } from "@/lib/cn";

/* ---------------- shared card shells ---------------- */

export function DetailCard({
  title,
  onEdit,
  children,
  className,
}: {
  title?: string;
  onEdit?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-3.5 shadow-soft", className)}>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[12.5px] font-semibold text-[#0F2D4A]">{title}</h3>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#0A9189] transition hover:underline"
            >
              <Pencil size={11} />
              Edit
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

const ROW_TONES = {
  teal: { bg: "bg-[#E6FAF7]", fg: "text-[#0A9189]" },
  blue: { bg: "bg-[#EFF4FF]", fg: "text-[#3B6EF6]" },
  violet: { bg: "bg-[#F3EEFF]", fg: "text-[#8B5CF6]" },
  amber: { bg: "bg-[#FFF6E5]", fg: "text-[#E09A1B]" },
  mint: { bg: "bg-[#E9F9EF]", fg: "text-[#1E9E56]" },
} as const;

export function InfoRow({
  icon: Icon,
  label,
  value,
  tone = "teal",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: keyof typeof ROW_TONES;
}) {
  const t = ROW_TONES[tone];
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", t.bg, t.fg)}>
        <Icon size={13} />
      </span>
      <div className="min-w-0">
        <p className="text-[9.5px] text-[#9AA9B8]">{label}</p>
        <p className="truncate text-[11.5px] font-medium text-[#0F2D4A]">{value || "—"}</p>
      </div>
    </div>
  );
}

export function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

/* ---------------- status pills ---------------- */

const VERIFICATION_PILL: Record<VerificationStatus, string> = {
  verified: "bg-[#E6FAF7] text-[#0A9189]",
  pending: "bg-[#FFF6E5] text-[#C77A0A]",
  rejected: "bg-[#FDECEF] text-[#E5484D]",
};

const ACCOUNT_PILL: Record<AccountStatus, string> = {
  active: "bg-[#E9F9EF] text-[#1E9E56]",
  inactive: "bg-[#FDECEF] text-[#E5484D]",
  pending: "bg-[#FFF6E5] text-[#C77A0A]",
  suspended: "bg-[#F1F5F9] text-[#64748B]",
};

export function VerificationPill({ status }: { status: VerificationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
        VERIFICATION_PILL[status],
      )}
    >
      {status === "verified" ? <Check size={11} strokeWidth={3} /> : status === "pending" ? <Clock size={11} /> : <X size={11} strokeWidth={3} />}
      {VERIFICATION_LABEL[status]}
    </span>
  );
}

export function AccountPill({ status }: { status: AccountStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
        ACCOUNT_PILL[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ACCOUNT_STATUS_LABEL[status]}
    </span>
  );
}

const VERIFICATION_NOTE: Record<VerificationStatus, string> = {
  verified: "The doctor's credentials have been verified and approved.",
  pending: "Credential review is in progress. Clinical access stays limited until verification completes.",
  rejected: "Credentials were not approved. Clinical access remains disabled.",
};

const ACCOUNT_NOTE: Record<AccountStatus, string> = {
  active: "The account is active and can access the system.",
  inactive: "The account is inactive and cannot sign in.",
  pending: "The invitation is pending. The user has not set a password yet.",
  suspended: "The account is suspended pending administrative review.",
};

export function StatusCard({
  title,
  pill,
  note,
  icon: Icon,
  tone = "teal",
  actions,
}: {
  title: string;
  pill: React.ReactNode;
  note: string;
  icon: LucideIcon;
  tone?: keyof typeof ROW_TONES;
  actions?: React.ReactNode;
}) {
  const t = ROW_TONES[tone];
  return (
    <section className="rounded-2xl border border-line bg-white p-3.5 shadow-soft">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", t.bg, t.fg)}>
          <Icon size={14} />
        </span>
        <h3 className="text-[12px] font-semibold text-[#0F2D4A]">{title}</h3>
      </div>
      <div className="mt-2.5">{pill}</div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#7A8B9C]">{note}</p>
      {actions && <div className="mt-2.5">{actions}</div>}
    </section>
  );
}

/* ---------------- right panel cards ---------------- */

export function QuickActionsCard({
  onAction,
}: {
  onAction?: (label: string) => void;
}) {
  const comingSoon = useComingSoon();
  const actions = [
    { label: "View Schedule", icon: CalendarClock },
    { label: "Reset Password", icon: KeyRound },
    { label: "Resend Invitation Email", icon: Mail },
  ];
  return (
    <section className="rounded-2xl border border-line bg-white p-3.5 shadow-soft">
      <h3 className="text-[12px] font-semibold text-[#0F2D4A]">Quick Actions</h3>
      <div className="mt-2.5 space-y-2">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => (onAction ? onAction(a.label) : comingSoon(a.label))}
            className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-[11px] font-medium text-[#5B6B7C] transition hover:border-[#0A9189]/30 hover:bg-[#F4FCFA] hover:text-[#0F2D4A]"
          >
            <a.icon size={13} className="text-[#0A9189]" />
            {a.label}
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-[9.5px] leading-relaxed text-[#9AA9B8]">
        Password resets and invitations are recorded in the audit log.
      </p>
    </section>
  );
}

export function WorkLocationCard({ member }: { member: DirectoryMember }) {
  const hasLocation = member.location && member.location !== "—";
  return (
    <section className="rounded-2xl border border-line bg-white p-3.5 shadow-soft">
      <h3 className="text-[12px] font-semibold text-[#0F2D4A]">Work Location</h3>
      {hasLocation ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <MapPin size={14} className="text-[#3B6EF6]" />
            <p className="text-[12px] font-semibold text-[#0F2D4A]">{member.location}</p>
            {member.locationBadge && (
              <span className="rounded-full bg-[#E6FAF7] px-2 py-0.5 text-[9.5px] font-semibold text-[#0A9189]">
                {member.locationBadge}
              </span>
            )}
          </div>
          {"address" in member && member.address && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#7A8B9C]">{member.address}</p>
          )}
        </>
      ) : (
        <p className="mt-2 text-[10px] text-[#9AA9B8]">No work location assigned yet.</p>
      )}
    </section>
  );
}

export function NextShiftCard({ member }: { member: DirectoryMember }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-3.5 shadow-soft">
      <h3 className="text-[12px] font-semibold text-[#0F2D4A]">Next Shift</h3>
      {member.nextShift ? (
        <div className="mt-2 flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E6FAF7] text-[#0A9189]">
            <Clock size={14} />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-[#0F2D4A]">{member.nextShift.day}</p>
            <p className="text-[11px] text-[#5B6B7C]">{member.nextShift.time}</p>
            <p className="mt-0.5 text-[10px] text-[#9AA9B8]">{member.nextShift.location}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-[#9AA9B8]">No upcoming shift scheduled.</p>
      )}
    </section>
  );
}

/* ---------------- chips + availability ---------------- */

export function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "teal" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium",
        tone === "teal"
          ? "border border-[#0A9189]/25 bg-[#E6FAF7] text-[#0A9189]"
          : "border border-line text-[#5B6B7C]",
      )}
    >
      {children}
    </span>
  );
}

export function AvailabilityGrid({ availability }: { availability: DoctorMember["availability"] }) {
  if (availability.length === 0) {
    return <p className="text-[10.5px] text-[#9AA9B8]">No availability set for this member yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {availability.map((d) => (
        <div
          key={d.day}
          className={cn(
            "rounded-xl border px-2 py-1.5 text-center",
            d.time ? "border-[#0A9189]/20 bg-[#E6FAF7]" : "border-line bg-[#F6F8F9]",
          )}
        >
          <p className={cn("text-[9.5px] font-semibold", d.time ? "text-[#0A9189]" : "text-[#9AA9B8]")}>{d.day}</p>
          <p className={cn("mt-0.5 text-[9.5px]", d.time ? "text-[#0F2D4A]" : "text-[#9AA9B8]")}>
            {d.time ?? "Unavailable"}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- profile header ---------------- */

export function ProfileAvatar({ member, size = 72 }: { member: DirectoryMember; size?: number }) {
  if (member.photoUrl) {
    return (
      /* local blob preview — next/image cannot optimize object URLs */
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={member.photoUrl}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover ring-2 ring-white"
      />
    );
  }
  return <Avatar name={member.name} size={size} />;
}

export function HeaderBadge({
  icon: Icon,
  children,
  tone = "plain",
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  tone?: "plain" | "teal";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
        tone === "teal" ? "bg-[#E6FAF7] text-[#0A9189]" : "border border-line text-[#5B6B7C]",
      )}
    >
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}

export function HeaderMenu({
  member,
  onAction,
}: {
  member: DirectoryMember;
  onAction?: (label: string) => void;
}) {
  const comingSoon = useComingSoon();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions for ${member.name}`}
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-xl border border-line text-[#5B6B7C] transition hover:bg-surface-subtle"
      >
        <MoreVertical size={16} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={190} className="py-1">
        {["View Schedule", "Reset Password", "Resend Invitation Email", "Change Status"].map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setOpen(false);
              if (onAction) onAction(label);
              else comingSoon(label);
            }}
            className="block w-full px-3 py-1.5 text-left text-[11.5px] text-[#5B6B7C] transition hover:bg-surface-subtle"
          >
            {label}
          </button>
        ))}
      </Popover>
    </>
  );
}

/* ---------------- helpers ---------------- */

export function dutyTone(duty: DirectoryMember["duty"]) {
  return duty === "on-duty" ? "text-[#1E9E56]" : duty === "on-leave" ? "text-[#C77A0A]" : "text-[#94A3B8]";
}

export function memberTitle(member: DirectoryMember) {
  return member.kind === "doctor" ? member.title : member.jobTitle;
}

export function isDoctor(member: DirectoryMember): member is DoctorMember {
  return member.kind === "doctor";
}

export function isStaff(member: DirectoryMember): member is StaffMember {
  return member.kind === "staff";
}

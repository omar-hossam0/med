"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Pencil, Briefcase, Stethoscope, BadgeCheck, User, Mail, Phone, CalendarDays, Building2, MapPin, Clock } from "lucide-react";
import {
  ACCOUNT_STATUS_LABEL,
  DUTY_LABEL,
  type DirectoryMember,
} from "@/lib/mock/doctorsStaff";
import { DOCTOR_PERMISSIONS, STAFF_PERMISSIONS } from "@/lib/mock/users";
import { useComingSoon } from "@/components/admin/ComingSoon";
import { tabMotion } from "@/components/transitions/tabs";
import {
  AccountPill,
  AvailabilityGrid,
  Chip,
  DetailCard,
  HeaderBadge,
  HeaderMenu,
  InfoGrid,
  InfoRow,
  NextShiftCard,
  ProfileAvatar,
  QuickActionsCard,
  StatusCard,
  VerificationPill,
  WorkLocationCard,
  dutyTone,
  isDoctor,
  isStaff,
  memberTitle,
} from "./details/parts";
import { cn } from "@/lib/cn";

type TabKey = "overview" | "details" | "schedule" | "account" | "activity";

export function MemberDetails({ member }: { member: DirectoryMember }) {
  const comingSoon = useComingSoon();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string }[] = isDoctor(member)
    ? [
        { key: "overview", label: "Overview" },
        { key: "details", label: "Professional Details" },
        { key: "schedule", label: "Work & Schedule" },
        { key: "account", label: "Account & Access" },
        { key: "activity", label: "Activity Log" },
      ]
    : [
        { key: "overview", label: "Overview" },
        { key: "details", label: "Employment Details" },
        { key: "schedule", label: "Work & Schedule" },
        { key: "account", label: "Account & Access" },
      ];

  return (
    <div className="space-y-3">
      {/* Back link */}
      <Link
        href="/admin/doctors-staff"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0A9189] transition hover:underline"
      >
        <ArrowLeft size={14} />
        Back to Doctors &amp; Staff
      </Link>

      {/* Profile header */}
      <section className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex flex-wrap items-start gap-4 p-4">
          <ProfileAvatar member={member} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold tracking-[-0.01em] text-[#0F2D4A]">{member.name}</h1>
            <p className="mt-0.5 text-[12px] text-[#5B6B7C]">{memberTitle(member)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {isDoctor(member) && <VerificationPill status={member.verification} />}
              {!isDoctor(member) && <AccountPill status={member.accountStatus} />}
              {isDoctor(member) && (
                <HeaderBadge icon={Stethoscope}>{member.specialty}</HeaderBadge>
              )}
              {isStaff(member) && <HeaderBadge icon={Briefcase}>{member.jobTitle}</HeaderBadge>}
              {isDoctor(member) && member.years > 0 && (
                <HeaderBadge icon={BadgeCheck}>{member.years} yrs exp.</HeaderBadge>
              )}
              <HeaderBadge icon={MapPin}>{member.location}</HeaderBadge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => comingSoon("Edit Details")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
            >
              <Pencil size={13} />
              Edit Details
            </button>
            <HeaderMenu member={member} />
          </div>
        </div>

        {/* Tabs */}
        <nav aria-label="Member details sections" className="flex gap-4 overflow-x-auto border-t border-line px-4">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 py-2.5 text-[11.5px] transition",
                  active
                    ? "border-[#0A9189] font-semibold text-[#0A9189]"
                    : "border-transparent font-medium text-[#5B6B7C] hover:text-navy",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </section>

      {/* Body */}
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_312px]">
        <motion.div key={tab} {...tabMotion(!!reduce)} className="min-w-0 space-y-3">
          {tab === "overview" && <OverviewTab member={member} />}
          {tab === "details" && <DetailsTab member={member} />}
          {tab === "schedule" && <ScheduleTab member={member} />}
          {tab === "account" && <AccountTab member={member} />}
          {tab === "activity" && <ActivityTab member={member} />}
        </motion.div>

        <div className="space-y-3">
          {isDoctor(member) && (
            <StatusCard
              title="Verification Status"
              icon={BadgeCheck}
              pill={<VerificationPill status={member.verification} />}
              note={
                member.verification === "verified"
                  ? "The doctor's credentials have been verified and approved."
                  : member.verification === "pending"
                    ? "Credential review is in progress. Clinical access stays limited until verification completes."
                    : "Credentials were not approved. Clinical access remains disabled."
              }
            />
          )}
          <StatusCard
            title="Account Status"
            icon={User}
            tone="mint"
            pill={<AccountPill status={member.accountStatus} />}
            note={
              member.accountStatus === "active"
                ? "The account is active and can access the system."
                : member.accountStatus === "inactive"
                  ? "The account is inactive and cannot sign in."
                  : member.accountStatus === "pending"
                    ? "The invitation is pending. The user has not set a password yet."
                    : "The account is suspended pending administrative review."
            }
          />
          <QuickActionsCard />
          <WorkLocationCard member={member} />
          <NextShiftCard member={member} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- tabs ---------------- */

function OverviewTab({ member }: { member: DirectoryMember }) {
  const comingSoon = useComingSoon();
  return (
    <>
      <InfoGrid>
        <DetailCard title="Personal Information" onEdit={() => comingSoon("Edit personal information")}>
          <div className="space-y-3">
            <InfoRow icon={User} label="Full Name" value={member.name} />
            <InfoRow icon={Mail} label="Email Address" value={member.email} tone="blue" />
            <InfoRow icon={Phone} label="Phone Number" value={member.phone} tone="teal" />
            <InfoRow icon={CalendarDays} label="Date of Birth" value={member.dob} tone="blue" />
          </div>
        </DetailCard>

        {isDoctor(member) ? (
          <DetailCard title="Professional Information" onEdit={() => comingSoon("Edit professional information")}>
            <div className="space-y-3">
              <InfoRow icon={Stethoscope} label="Specialty" value={member.specialty} />
              <InfoRow icon={Building2} label="Department" value={member.department} tone="violet" />
              <InfoRow icon={BadgeCheck} label="License Number" value={member.license} tone="blue" />
              <InfoRow icon={Briefcase} label="Years of Experience" value={member.years > 0 ? `${member.years} years` : "—"} tone="amber" />
            </div>
          </DetailCard>
        ) : (
          <DetailCard title="Employment Information" onEdit={() => comingSoon("Edit employment information")}>
            <div className="space-y-3">
              <InfoRow icon={Briefcase} label="Job Title" value={member.jobTitle} tone="amber" />
              <InfoRow icon={Building2} label="Assigned Department" value={member.department} tone="violet" />
              <InfoRow icon={Clock} label="Work Shift" value={member.shift} tone="blue" />
              <InfoRow icon={MapPin} label="Work Location" value={member.location} tone="blue" />
            </div>
          </DetailCard>
        )}
      </InfoGrid>

      <DetailCard title="About">
        {member.about ? (
          <p className="text-[11.5px] leading-relaxed text-[#5B6B7C]">{member.about}</p>
        ) : (
          <p className="text-[10.5px] text-[#9AA9B8]">No description provided yet.</p>
        )}
      </DetailCard>

      {isDoctor(member) && (
        <DetailCard title="Departments & Services">
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="teal">{member.department}</Chip>
            {member.services.length > 0 ? (
              member.services.map((s) => <Chip key={s}>{s}</Chip>)
            ) : (
              <p className="text-[10.5px] text-[#9AA9B8]">No services assigned yet.</p>
            )}
          </div>
        </DetailCard>
      )}

      <DetailCard title="Availability">
        <AvailabilityGrid availability={isDoctor(member) ? member.availability : []} />
        {isStaff(member) && (
          <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-[#5B6B7C]">
            <Clock size={12} className="text-[#0A9189]" />
            Standard shift: {member.shift}
          </p>
        )}
      </DetailCard>
    </>
  );
}

function DetailsTab({ member }: { member: DirectoryMember }) {
  const comingSoon = useComingSoon();
  if (isDoctor(member)) {
    return (
      <>
        <DetailCard title="Professional Information" onEdit={() => comingSoon("Edit professional information")}>
          <InfoGrid>
            <InfoRow icon={Stethoscope} label="Specialty" value={member.specialty} />
            <InfoRow icon={Building2} label="Department" value={member.department} tone="violet" />
            <InfoRow icon={BadgeCheck} label="License Number" value={member.license} tone="blue" />
            <InfoRow icon={Briefcase} label="Years of Experience" value={member.years > 0 ? `${member.years} years` : "—"} tone="amber" />
          </InfoGrid>
        </DetailCard>
        <DetailCard title="Departments & Services">
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="teal">{member.department}</Chip>
            {member.services.length > 0 ? (
              member.services.map((s) => <Chip key={s}>{s}</Chip>)
            ) : (
              <p className="text-[10.5px] text-[#9AA9B8]">No services assigned yet.</p>
            )}
          </div>
        </DetailCard>
        <DetailCard title="Credential Verification">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationPill status={member.verification} />
            <p className="text-[10.5px] text-[#7A8B9C]">
              {member.license && member.license !== "—"
                ? `License on file: ${member.license}. A license number alone does not confirm verification.`
                : "No license number on file yet."}
            </p>
          </div>
        </DetailCard>
      </>
    );
  }
  return (
    <DetailCard title="Employment Information" onEdit={() => comingSoon("Edit employment information")}>
      <InfoGrid>
        <InfoRow icon={Briefcase} label="Job Title" value={member.jobTitle} tone="amber" />
        <InfoRow icon={Building2} label="Assigned Department" value={member.department} tone="violet" />
        <InfoRow icon={Clock} label="Work Shift" value={member.shift} tone="blue" />
        <InfoRow icon={MapPin} label="Work Location" value={member.location} tone="blue" />
      </InfoGrid>
    </DetailCard>
  );
}

function ScheduleTab({ member }: { member: DirectoryMember }) {
  return (
    <>
      <DetailCard title="Weekly Availability">
        <AvailabilityGrid availability={isDoctor(member) ? member.availability : []} />
        {isStaff(member) && (
          <p className="mt-2.5 text-[10.5px] text-[#5B6B7C]">Standard shift: {member.shift}</p>
        )}
      </DetailCard>
      <InfoGrid>
        <WorkLocationCard member={member} />
        <NextShiftCard member={member} />
      </InfoGrid>
      <DetailCard title="Duty Status">
        <p className={cn("text-[12px] font-semibold", dutyTone(member.duty))}>{DUTY_LABEL[member.duty]}</p>
        <p className="mt-1 text-[10.5px] text-[#7A8B9C]">
          Mock duty state for the demo dataset — not a live schedule.
        </p>
      </DetailCard>
    </>
  );
}

function AccountTab({ member }: { member: DirectoryMember }) {
  const perms = isDoctor(member) ? DOCTOR_PERMISSIONS : STAFF_PERMISSIONS;
  return (
    <>
      <DetailCard title="Account Status">
        <div className="flex flex-wrap items-center gap-2">
          <AccountPill status={member.accountStatus} />
          <p className="text-[10.5px] text-[#7A8B9C]">{ACCOUNT_STATUS_LABEL[member.accountStatus]}</p>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-[#7A8B9C]">
          {isDoctor(member)
            ? "Doctors are invited by an admin and require credential verification before clinical privileges are enabled."
            : "Staff accounts are invited by an admin and receive front-desk and scheduling permissions only."}
        </p>
      </DetailCard>
      <DetailCard title="Proposed Permissions">
        <ul className="space-y-2">
          {perms.map((p) => (
            <li key={p.id} className="flex items-start gap-2 text-[11px] text-[#5B6B7C]">
              <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[#E9F9EF] text-[#1E9E56]">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
                  <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                <span className="block font-medium text-[#0F2D4A]">{p.label}</span>
                <span className="block text-[10px] text-[#7A8B9C]">{p.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-[#F6FAFB] px-3 py-2 text-[10px] text-[#7A8B9C]">
          Frontend-only preview. Permissions are not enforced until the backend RBAC is implemented.
        </p>
      </DetailCard>
    </>
  );
}

function ActivityTab({ member }: { member: DirectoryMember }) {
  const entries = [
    { label: "Account created (demo)", when: "—" },
    { label: "Profile details saved (demo)", when: "—" },
    { label: "Directory listing updated (demo)", when: "—" },
  ];
  return (
    <DetailCard title="Activity Log">
      <ul className="space-y-2.5">
        {entries.map((e) => (
          <li key={e.label} className="flex items-center justify-between gap-2 border-b border-line/60 pb-2.5 last:border-0 last:pb-0">
            <span className="flex items-center gap-2 text-[11px] text-[#5B6B7C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0A9189]" />
              {e.label}
            </span>
            <span className="text-[10px] text-[#9AA9B8]">{e.when}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-[#F6FAFB] px-3 py-2 text-[10px] leading-relaxed text-[#7A8B9C]">
        Demo entries only for {member.name}. Real administrative and access events will be recorded in the
        audit log once the backend is implemented.
      </p>
    </DetailCard>
  );
}

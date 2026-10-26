"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Stethoscope,
  Users,
  Check,
  ChevronLeft,
  ChevronDown,
  Info,
  Sparkles,
  Pencil,
  User,
  Mail,
  Phone,
  Briefcase,
  BadgeCheck,
  AlignLeft,
  Building2,
  MapPin,
  Clock,
} from "lucide-react";
import {
  SPECIALTIES,
  DEPARTMENTS,
  STAFF_TITLES,
  DOCTOR_PERMISSIONS,
  STAFF_PERMISSIONS,
  ROLE_LABEL,
} from "@/lib/mock/users";
import { DateField } from "@/components/auth/DateField";
import { SelectField } from "@/components/ui/SelectField";
import { PhotoUpload } from "./PhotoUpload";
import { stepMotion } from "@/components/transitions/stepper";
import { ConfirmDialog } from "./ConfirmDialog";
import { useUsers } from "./UsersProvider";
import { cn } from "@/lib/cn";

const STEPS = ["Basic Information", "Role & Details", "Permissions", "Review & Create"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AccountType = "doctor" | "staff";

/* icon accent colours from the approved design */
const TEAL = "text-[#0A9189]";
const BLUE = "text-[#3B6EF6]";
const VIOLET = "text-[#8B5CF6]";
const AMBER = "text-[#E09A1B]";

const inputCls = (error?: string) =>
  cn(
    "h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-[12.5px] text-navy outline-none transition placeholder:text-ink-muted",
    error
      ? "border-[#E5484D]/50 focus:border-[#E5484D] focus:ring-4 focus:ring-[#E5484D]/10"
      : "border-line focus:border-primary focus:ring-4 focus:ring-primary/10",
  );

const areaCls =
  "min-h-[56px] w-full resize-none rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-[12.5px] text-navy outline-none transition placeholder:text-ink-muted focus:border-primary focus:ring-4 focus:ring-primary/10";

export function AddUserForm() {
  const router = useRouter();
  const { users, addUser } = useUsers();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const [type, setType] = useState<AccountType>("doctor");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");

  const [specialty, setSpecialty] = useState("");
  const [license, setLicense] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentId, setEmploymentId] = useState("");
  const [notes, setNotes] = useState("");

  const [department, setDepartment] = useState("");
  const [years, setYears] = useState("");
  const [location, setLocation] = useState("");
  const [schedule, setSchedule] = useState("");

  /* profile photo (doctor only) — local preview URL, never uploaded */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  /** Once the URL is handed to the shared user record, this form must not revoke it. */
  const photoHandedOffRef = useRef(false);

  const handlePhotoChange = (url: string | null) => {
    if (photoUrlRef.current && photoUrlRef.current !== url) {
      URL.revokeObjectURL(photoUrlRef.current);
    }
    photoUrlRef.current = url;
    setPhotoUrl(url);
  };

  /* release the object URL when the form unmounts (no leaks) */
  useEffect(
    () => () => {
      if (photoUrlRef.current && !photoHandedOffRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
      }
    },
    [],
  );

  const [permissions, setPermissions] = useState<Set<string>>(
    () => new Set(DOCTOR_PERMISSIONS.map((p) => p.id)),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const roleLabel = ROLE_LABEL[type];
  const rolePerms = type === "doctor" ? DOCTOR_PERMISSIONS : STAFF_PERMISSIONS;
  const roleDesc =
    type === "doctor"
      ? "Medical professional with access to patient data and clinical tools."
      : "Receptionist or administrative staff with access to front-desk workflows.";

  const switchType = (next: AccountType) => {
    setType(next);
    setErrors({});
    setPermissions(new Set((next === "doctor" ? DOCTOR_PERMISSIONS : STAFF_PERMISSIONS).map((p) => p.id)));
  };

  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (fullName.trim().length < 2) e.fullName = "Enter the full name.";
      if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address.";
      else if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
        e.email = "This email is already used by another account.";
      if (phone.trim() && !/^[+()\d][\d\s()-]{6,}$/.test(phone.trim()))
        e.phone = "Enter a valid phone number.";
      if (type === "staff" && !jobTitle) {
        e.jobTitle = "Select a job title.";
      }
    }
    if (s === 1) {
      if (!department) e.department = "Select a department.";
      if (type === "doctor") {
        if (!license.trim()) e.license = "Enter the license number.";
        if (!specialty) e.specialty = "Select a specialty.";
      }
    }
    if (s === 2 && permissions.size === 0) e.permissions = "Select at least one permission.";
    return e;
  };

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setDir(1);
    setStep((s) => Math.min(3, s + 1));
  };

  const prev = () => {
    setErrors({});
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const goTo = (target: number) => {
    if (target >= step) return;
    setErrors({});
    setDir(-1);
    setStep(target);
  };

  const startCreate = () => {
    for (let s = 0; s <= 2; s++) {
      const e = validateStep(s);
      if (Object.keys(e).length > 0) {
        setErrors(e);
        setDir(s > step ? 1 : -1);
        setStep(s);
        return;
      }
    }
    setErrors({});
    setConfirmOpen(true);
  };

  const confirmCreate = () => {
    if (submitting) return;
    setSubmitting(true);
    if (photoUrlRef.current) photoHandedOffRef.current = true; // transfer URL ownership
    addUser({
      name: fullName,
      email,
      phone,
      role: type,
      profile:
        type === "doctor"
          ? {
              dob,
              specialty,
              department,
              license,
              years,
              location,
              photoUrl: photoUrl ?? undefined,
            }
          : {
              dob,
              jobTitle,
              employmentId,
              department,
              location,
              schedule,
              about: notes || undefined,
            },
    });
    setConfirmOpen(false);
    setSuccess(true);
    window.setTimeout(() => router.push("/admin/users"), 1100);
  };

  const permissionLabels = rolePerms.filter((p) => permissions.has(p.id)).map((p) => p.label);

  return (
    <div className="space-y-3">
      {/* Header + stepper */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2.5">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[21px] font-bold tracking-[-0.01em] text-[#0F2D4A]">
            <Link
              href="/admin/users"
              aria-label="Back to Users"
              className="grid h-7 w-7 place-items-center rounded-lg text-[#0A9189] transition hover:bg-[#E6FAF7]"
            >
              <ArrowLeft size={18} />
            </Link>
            Add New User
          </h1>
          <p className="mt-1 pl-9 text-[12px] text-[#5B6B7C]">Create a new doctor or staff account.</p>
        </div>

        <ol className="flex w-full items-center gap-1 pt-1 lg:w-auto">
          {STEPS.map((label, i) => {
            const completed = i < step;
            const current = i === step;
            return (
              <li key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1 lg:flex-none")}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={i >= step}
                  aria-current={current ? "step" : undefined}
                  className={cn("flex items-center gap-1.5", i < step ? "cursor-pointer" : "cursor-default")}
                >
                  <span
                    className={cn(
                      "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[10px] font-semibold transition",
                      completed && "bg-[#0A9189] text-white",
                      current && "bg-[#0A9189] text-white ring-4 ring-[#0A9189]/12",
                      !completed && !current && "border border-[#DCE6EA] bg-white text-[#9AA9B8]",
                    )}
                  >
                    {completed ? <Check size={11} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "hidden whitespace-nowrap text-[10.5px] md:inline",
                      current ? "font-semibold text-[#0F2D4A]" : completed ? "text-[#0A9189]" : "text-[#9AA9B8]",
                    )}
                  >
                    {label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className={cn("mx-2 h-px flex-1 lg:w-6 lg:flex-none", completed ? "bg-[#0A9189]/45" : "bg-[#E4ECEF]")} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_288px]">
        {/* Main form card */}
        <div className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-soft">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...stepMotion(dir)}>
              {step === 0 && (
                <div className="space-y-4">
                  {/* User Type */}
                  <div>
                    <h3 className="mb-1.5 text-[12px] font-semibold text-[#0F2D4A]">User Type</h3>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <TypeCard
                        active={type === "doctor"}
                        onClick={() => switchType("doctor")}
                        icon={Stethoscope}
                        tone="teal"
                        title="Doctor"
                        desc="Create a doctor account with medical professional access."
                      />
                      <TypeCard
                        active={type === "staff"}
                        onClick={() => switchType("staff")}
                        icon={Users}
                        tone="violet"
                        title="Staff"
                        desc="Create a staff account with administrative access."
                      />
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div>
                    <h3 className="mb-1.5 text-[12px] font-semibold text-[#0F2D4A]">Personal Information</h3>
                    <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
                      <Field id="nu-name" label="Full Name" required error={errors.fullName}>
                        <IconInput icon={User} iconClassName={TEAL}>
                          <input id="nu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter full name" className={inputCls(errors.fullName)} />
                        </IconInput>
                      </Field>
                      <Field id="nu-email" label="Email Address" required error={errors.email}>
                        <IconInput icon={Mail} iconClassName={BLUE}>
                          <input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@medora.com" className={inputCls(errors.email)} />
                        </IconInput>
                      </Field>
                      <Field id="nu-phone" label="Phone Number" error={errors.phone}>
                        <div
                          className={cn(
                            "flex h-10 items-center rounded-xl border bg-white transition",
                            errors.phone
                              ? "border-[#E5484D]/50"
                              : "border-line focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10",
                          )}
                        >
                          <span className="flex h-full shrink-0 items-center gap-1.5 border-r border-line pl-3 pr-2 text-[11.5px] font-medium text-[#5B6B7C]">
                            <span aria-hidden className="relative inline-block h-3 w-[18px] overflow-hidden rounded-[2px] ring-1 ring-black/5">
                              <span className="absolute inset-x-0 top-0 h-1/3 bg-[#CE1126]" />
                              <span className="absolute inset-x-0 top-1/3 h-1/3 bg-white" />
                              <span className="absolute inset-x-0 bottom-0 h-1/3 bg-black" />
                            </span>
                            +20
                            <ChevronDown size={12} className="text-[#9AA9B8]" />
                          </span>
                          <Phone size={14} className={cn("ml-2.5 shrink-0", TEAL)} />
                          <input
                            id="nu-phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Enter phone number"
                            className="h-full w-full min-w-0 bg-transparent pl-2 pr-3 text-[12.5px] text-navy outline-none placeholder:text-ink-muted"
                          />
                        </div>
                        {errors.phone && <p className="mt-1 text-[10px] font-medium text-[#E5484D]">{errors.phone}</p>}
                      </Field>
                      <Field id="nu-dob" label="Date of Birth">
                        <DateField id="nu-dob" label="Date of Birth" placeholder="Select date" value={dob} onChange={setDob} height={40} iconClassName={BLUE} />
                      </Field>
                    </div>
                  </div>

                  {/* Employment Information (staff only — the doctor's professional
                      fields live in Step 2 "Role & Details") */}
                  {type === "staff" && (
                    <div>
                      <h3 className="mb-1.5 text-[12px] font-semibold text-[#0F2D4A]">Employment Information</h3>
                      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
                        <Field id="nu-title" label="Job Title" required>
                          <SelectField
                            id="nu-title"
                            label="Job Title"
                            placeholder="Select job title"
                            value={jobTitle}
                            onChange={setJobTitle}
                            error={errors.jobTitle}
                            options={STAFF_TITLES.map((t) => ({ value: t, label: t }))}
                            icon={Briefcase}
                            iconClassName={VIOLET}
                            height={40}
                          />
                        </Field>
                        <Field id="nu-emp" label="Employment ID">
                          <IconInput icon={BadgeCheck} iconClassName={BLUE}>
                            <input id="nu-emp" value={employmentId} onChange={(e) => setEmploymentId(e.target.value)} placeholder="Optional" className={inputCls()} />
                          </IconInput>
                        </Field>
                        <div className="sm:col-span-2">
                          <Field id="nu-notes" label="Notes (Optional)">
                            <IconArea icon={AlignLeft} iconClassName={TEAL}>
                              <textarea id="nu-notes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Short note about this staff member..." className={areaCls} />
                            </IconArea>
                            <p className="mt-1 text-right text-[9.5px] text-[#9AA9B8]">{notes.length}/300</p>
                          </Field>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-1.5 text-[12px] font-semibold text-[#0F2D4A]">Role &amp; Details</h3>
                    {type === "doctor" ? (
                      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
                        <Field id="nu-photo" label="Profile Photo (Optional)">
                          <PhotoUpload id="nu-photo" value={photoUrl} onChange={handlePhotoChange} />
                        </Field>
                        <Field id="nu-dept" label="Department" required>
                          <SelectField
                            id="nu-dept"
                            label="Department"
                            placeholder="Select department"
                            value={department}
                            onChange={setDepartment}
                            error={errors.department}
                            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                            icon={Building2}
                            iconClassName={VIOLET}
                            height={40}
                          />
                        </Field>
                        <Field id="nu-license" label="License Number" required error={errors.license}>
                          <IconInput icon={BadgeCheck} iconClassName={BLUE}>
                            <input id="nu-license" value={license} onChange={(e) => setLicense(e.target.value)} placeholder="Enter medical license number" className={inputCls(errors.license)} />
                          </IconInput>
                        </Field>
                        <Field id="nu-specialty" label="Specialty" required>
                          <SelectField
                            id="nu-specialty"
                            label="Specialty"
                            placeholder="Select specialty"
                            value={specialty}
                            onChange={setSpecialty}
                            error={errors.specialty}
                            options={SPECIALTIES.map((s) => ({ value: s, label: s }))}
                            icon={Stethoscope}
                            iconClassName={TEAL}
                            height={40}
                          />
                        </Field>
                        <Field id="nu-loc" label="Work Location / Clinic">
                          <IconInput icon={MapPin} iconClassName={BLUE}>
                            <input id="nu-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Select work location" className={inputCls()} />
                          </IconInput>
                        </Field>
                        <Field id="nu-years" label="Years of Experience">
                          <IconInput icon={Briefcase} iconClassName={TEAL}>
                            <input id="nu-years" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} placeholder="e.g. 8" className={inputCls()} />
                          </IconInput>
                        </Field>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
                        <Field id="nu-dept" label="Department" required>
                          <SelectField
                            id="nu-dept"
                            label="Department"
                            placeholder="Select department"
                            value={department}
                            onChange={setDepartment}
                            error={errors.department}
                            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                            icon={Building2}
                            iconClassName={VIOLET}
                            height={40}
                          />
                        </Field>
                        <Field id="nu-loc" label="Work Location">
                          <IconInput icon={MapPin} iconClassName={BLUE}>
                            <input id="nu-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Front Desk" className={inputCls()} />
                          </IconInput>
                        </Field>
                        <div className="sm:col-span-2">
                          <Field id="nu-schedule" label="Work Schedule">
                            <IconInput icon={Clock} iconClassName={AMBER}>
                              <input id="nu-schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="e.g. Mon–Fri, 9:00 AM – 5:00 PM" className={inputCls()} />
                            </IconInput>
                          </Field>
                        </div>
                      </div>
                    )}
                  </div>
                  {type === "doctor" && (
                    <div className="flex items-start gap-2 rounded-xl bg-[#FFF9EC] px-3 py-2 text-[10.5px] leading-relaxed text-[#8A6420]">
                      <Info size={14} className="mt-0.5 shrink-0" />
                      Clinical access requires credential verification before activation.
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-[12px] font-semibold text-[#0F2D4A]">Permissions</h3>
                    <p className="mt-0.5 text-[10.5px] text-[#7A8B9C]">
                      Proposed access for this {roleLabel.toLowerCase()} account. Minimum necessary by default.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {rolePerms.map((p) => {
                      const checked = permissions.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition",
                            checked ? "border-[#0A9189]/40 bg-[#F4FCFA]" : "border-line hover:bg-surface-subtle",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setPermissions((prev) => {
                                const nextSet = new Set(prev);
                                if (nextSet.has(p.id)) nextSet.delete(p.id);
                                else nextSet.add(p.id);
                                return nextSet;
                              })
                            }
                            className="mt-0.5 h-3.5 w-3.5 rounded border-line accent-[#0A9189]"
                          />
                          <span className="min-w-0">
                            <span className="block text-[11.5px] font-medium text-[#0F2D4A]">{p.label}</span>
                            <span className="block text-[10px] text-[#7A8B9C]">{p.desc}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.permissions && <p className="text-[10.5px] font-medium text-[#E5484D]">{errors.permissions}</p>}
                  <p className="rounded-lg bg-[#F6FAFB] px-3 py-2 text-[10px] text-[#7A8B9C]">
                    Frontend-only preview. These permissions are not enforced until the backend RBAC is implemented.
                  </p>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <h3 className="text-[12px] font-semibold text-[#0F2D4A]">Review &amp; Create</h3>
                  <ReviewSection title="Account Type" onEdit={() => goTo(0)}>
                    <p className="text-[11.5px] font-medium text-[#0F2D4A]">{roleLabel}</p>
                  </ReviewSection>
                  <ReviewSection title="Personal Information" onEdit={() => goTo(0)}>
                    <Grid rows={[["Full name", fullName], ["Email", email], ["Phone", phone || "—"], ["Date of birth", dob || "—"]]} />
                  </ReviewSection>
                  {type === "doctor" ? (
                    <ReviewSection title="Professional Details" onEdit={() => goTo(1)}>
                      <Grid rows={[["Specialty", specialty || "—"], ["License", license || "—"]]} />
                    </ReviewSection>
                  ) : (
                    <ReviewSection title="Employment Details" onEdit={() => goTo(0)}>
                      <Grid rows={[["Job title", jobTitle], ["Employment ID", employmentId || "—"], ["Notes", notes || "—"]]} />
                    </ReviewSection>
                  )}
                  <ReviewSection title="Role & Details" onEdit={() => goTo(1)}>
                    <Grid
                      rows={[
                        ["Department", department],
                        ["Experience", years ? `${years} years` : "—"],
                        ["Location", location || "—"],
                        ...(type === "staff" ? [["Schedule", schedule || "—"]] : []),
                      ]}
                    />
                    {type === "doctor" && (
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px]">
                        <span className="text-[#7A8B9C]">Profile photo</span>
                        {photoUrl ? (
                          <span className="flex items-center gap-1.5 font-medium text-[#0F2D4A]">
                            {/* blob preview — next/image cannot optimize object URLs */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoUrl} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-line" />
                            Selected
                          </span>
                        ) : (
                          <span className="font-medium text-[#0F2D4A]">Not provided</span>
                        )}
                      </div>
                    )}
                  </ReviewSection>
                  <ReviewSection title="Permissions" onEdit={() => goTo(2)}>
                    <ul className="space-y-1">
                      {permissionLabels.map((l) => (
                        <li key={l} className="flex items-center gap-1.5 text-[11px] text-[#5B6B7C]">
                          <Check size={11} className="text-[#0A9189]" /> {l}
                        </li>
                      ))}
                    </ul>
                  </ReviewSection>
                  <div className="flex items-start gap-2 rounded-xl bg-[#EEF4FF] px-3 py-2 text-[10.5px] leading-relaxed text-[#3D4A63]">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    The new user will receive an invitation to set their password when email invitations are connected.
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer actions */}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
            <Link
              href="/admin/users"
              className="inline-flex h-9 items-center rounded-xl border border-line bg-white px-4 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
            >
              Cancel
            </Link>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-line px-3 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#0A9189_0%,#16B8AA_100%)] px-4 text-[11.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(10,145,137,0.7)] transition hover:brightness-110"
                >
                  Next Step <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#0A9189_0%,#16B8AA_100%)] px-4 text-[11.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(10,145,137,0.7)] transition hover:brightness-110"
                >
                  <Sparkles size={13} /> Create User
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right info card */}
        <aside className="relative min-w-0 self-start overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,#FFFFFF_0%,#F4FCFA_55%,#E7F9F4_100%)] p-4 pb-14 shadow-soft">
          <div className="relative z-10">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#E6FAF7] text-[#0A9189]">
              <Users size={18} />
            </span>
            <h3 className="mt-2.5 text-[14px] font-bold text-[#0F2D4A]">{roleLabel} Account</h3>
            <p className="mt-1 text-[10.5px] leading-relaxed text-[#5B6B7C]">{roleDesc}</p>

            <p className="mt-4 text-[11.5px] font-semibold text-[#0F2D4A]">{roleLabel} Permissions</p>
            <ul className="mt-2 space-y-2">
              {rolePerms.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-[10px] leading-snug text-[#5B6B7C]">
                  <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[#E9F9EF] text-[#1E9E56]">
                    <Check size={9} strokeWidth={3} />
                  </span>
                  {p.label}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#EEF4FF] px-2.5 py-2 text-[9.5px] leading-relaxed text-[#3D4A63]">
              <Info size={13} className="mt-0.5 shrink-0 text-[#3B6EF6]" />
              An invitation email will be sent to the user with a link to set their password.
            </div>
          </div>

          {/* decorative aqua wave */}
          <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full" viewBox="0 0 288 96" preserveAspectRatio="none">
            <path d="M0,44 C52,16 104,74 156,44 C204,16 250,44 288,28 L288,96 L0,96 Z" fill="#D6F3EC" />
            <path d="M0,62 C60,38 120,86 180,60 C228,40 262,54 288,46 L288,96 L0,96 Z" fill="#C2EBE1" fillOpacity="0.9" />
            <path d="M0,80 C66,60 132,96 198,78 C236,68 266,76 288,70 L288,96 L0,96 Z" fill="#B3E5D9" fillOpacity="0.8" />
          </svg>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmCreate}
        name={fullName}
        email={email}
        roleLabel={roleLabel}
        submitting={submitting}
      />

      {success && (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl border border-[#0A9189]/30 bg-white px-4 py-3 shadow-pop">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E6FAF7] text-[#0A9189]">
              <Check size={16} />
            </span>
            <div>
              <p className="text-[11.5px] font-semibold text-[#0F2D4A]">Demo user added successfully</p>
              <p className="text-[9.5px] text-[#5B6B7C]">Added to the local demo list. No database record or email was created.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- small pieces ---------------- */
function IconInput({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: typeof User;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon size={14} className={cn("pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2", iconClassName ?? "text-[#9AA9B8]")} />
      {children}
    </div>
  );
}

function IconArea({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: typeof AlignLeft;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon size={14} className={cn("pointer-events-none absolute left-3 top-3 z-[1]", iconClassName ?? "text-[#9AA9B8]")} />
      {children}
    </div>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10.5px] font-medium text-[#0F2D4A]">
        {label} {required && <span className="text-[#E5484D]">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[10px] font-medium text-[#E5484D]">{error}</p>}
    </div>
  );
}

const TYPE_TONE = {
  teal: { box: "bg-white border border-[#0A9189]/45 text-[#0A9189]", active: "bg-[#0A9189] text-white border-transparent" },
  violet: { box: "bg-[#F3EEFF] text-[#8B5CF6] border-transparent", active: "bg-[#8B5CF6] text-white border-transparent" },
} as const;

function TypeCard({
  active,
  onClick,
  icon: Icon,
  tone,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Stethoscope;
  tone: keyof typeof TYPE_TONE;
  title: string;
  desc: string;
}) {
  const t = TYPE_TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition",
        active
          ? "border-[#0A9189]/60 bg-[#F4FCFA] ring-2 ring-[#0A9189]/10"
          : "border-line hover:border-[#0A9189]/30 hover:bg-surface-subtle",
      )}
    >
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", t.box)}>
        <Icon size={15} />
      </span>
      <span className="min-w-0 pr-4">
        <span className="block text-[12px] font-semibold text-[#0F2D4A]">{title}</span>
        <span className="block text-[10px] leading-snug text-[#7A8B9C]">{desc}</span>
      </span>
      <span
        className={cn(
          "absolute right-2.5 top-2.5 grid h-4 w-4 place-items-center rounded-full border",
          active ? "border-[#1E9E56] bg-[#1E9E56] text-white" : "border-line",
        )}
      >
        {active && <Check size={10} strokeWidth={3} />}
      </span>
    </button>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9AA9B8]">{title}</p>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0A9189] hover:underline">
          <Pencil size={10} /> Edit
        </button>
      </div>
      {children}
    </div>
  );
}

function Grid({ rows }: { rows: string[][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-2 text-[10.5px]">
          <dt className="text-[#7A8B9C]">{k}</dt>
          <dd className="truncate font-medium text-[#0F2D4A]">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

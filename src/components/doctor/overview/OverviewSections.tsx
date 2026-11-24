"use client";

import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FlaskConical,
  Pill,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ASSETS } from "@/lib/constants";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { Avatar } from "@/components/patient/ui";
import {
  FOLLOW_UPS_DUE,
  PENDING_REPORTS,
  formatClock,
  formatPortalDate,
  getPortalPatient,
  getStatusBreakdown,
  recentPatientIds,
  recentPatientLastVisit,
  type DoctorAppointmentStatus,
  type DoctorOverviewCounts,
  type PendingTask,
  type PortalAppointment,
} from "@/lib/mock/doctorPortal";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Shared card                                                         */
/* ------------------------------------------------------------------ */

export function DoctorCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#E6EFEE] bg-white shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */

const STATUS_TONE: Record<DoctorAppointmentStatus, string> = {
  Upcoming: "bg-[#F1F5F9] text-[#64748B]",
  Waiting: "bg-[#FFF6E5] text-[#C77A0A]",
  Arrived: "bg-[#F3EEFF] text-[#7C4DD6]",
  "In Progress": "bg-[#EFF4FF] text-[#3B6EF6]",
  Completed: "bg-[#E7FBF8] text-[#0A9189]",
  Cancelled: "bg-[#FDECEF] text-[#E5484D]",
};

export function DoctorStatusBadge({ status }: { status: DoctorAppointmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-[9.5px] font-semibold",
        STATUS_TONE[status],
      )}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Greeting + hero                                                     */
/* ------------------------------------------------------------------ */

export function DoctorGreeting({
  greeting,
  name,
  dateLabel,
}: {
  greeting: string;
  name: string;
  dateLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[#0F2D4A] sm:text-[25px]">
          {greeting}, {name}
        </h1>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B7C]">
          Here&apos;s your clinical overview for today — manage your appointments, patients, reports,
          and follow-ups.
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-[#E6EFEE] bg-white px-2.5 py-1.5 text-[10.5px] font-medium text-[#5B6B7C]">
        <CalendarDays size={12} aria-hidden className="text-[#0A9189]" />
        {dateLabel}
      </span>
    </div>
  );
}

/**
 * Doctor hero.
 *
 * The approved target (assets/Medora Healthcare Doctor Dashboard.png) shows the
 * dark-haired physician consulting the hijab patient, with the copy on the left
 * and the clinical scene on the right, blended by a soft mint scrim.
 *
 * `doctor-hero-plate.png` is that exact scene, lifted from the approved mockup
 * and cropped to the photo area only (no copy, no mint scrim, no rounded card
 * edge). The supplied "Modern Digital Healthcare Consultation.png" cannot be
 * used directly: it is the same shoot but a different frame with three UI cards
 * baked in — "Today's Schedule", a patient card and "Consultation notes" — and
 * those cards sit in the only gap between the patient and the doctor, so any
 * crop that shows both people also shows a fake schedule card directly above
 * the real schedule panel.
 */
export function DoctorHero({ onStartConsultation }: { onStartConsultation: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[18px] border border-[#D6EDE8] bg-[linear-gradient(100deg,#FBFFFE_0%,#F7FEFC_38%,#EDFAF6_70%,#E0F6F0_100%)] shadow-[0_18px_44px_-34px_rgba(15,45,74,0.5)]">
      {/* Consultation photograph.
          The left edge is dissolved with a mask rather than clipped by a box, so
          the mint panel and the scene flow into each other with no vertical seam —
          the same soft transition the approved reference uses. */}
      <div
        className="absolute inset-y-0 right-0 hidden w-[58%] md:block"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 3%, rgba(0,0,0,0.9) 6.5%, #000 10%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 3%, rgba(0,0,0,0.9) 6.5%, #000 10%)",
        }}
      >
        <Image
          src={ASSETS.doctorHeroPlate}
          alt="A Medora doctor consulting with a patient in the clinic"
          fill
          priority
          sizes="(max-width: 1024px) 56vw, (max-width: 1280px) 57vw, 690px"
          className="object-cover object-[26%_50%]"
        />
      </div>

      {/* Organic mint layering: one broad soft arc so the mint reads as a shape
          rather than a flat panel, plus a light wash along the photo's edge. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="doctorHeroArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#CFF0E8" stopOpacity="0.38" />
            <stop offset="1" stopColor="#CFF0E8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="doctorHeroEdge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#F4FDFA" stopOpacity="0.6" />
            <stop offset="1" stopColor="#F4FDFA" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* broad arc sweeping behind the scene */}
        <path
          d="M470,-40 C560,10 606,86 578,150 C556,202 500,224 452,260 L470,-40 Z"
          fill="url(#doctorHeroArc)"
        />
        {/* soft wash that carries the mint into the photograph */}
        <path
          d="M430,-10 C500,26 536,92 516,152 C500,200 452,220 414,240 L430,-10 Z"
          fill="url(#doctorHeroEdge)"
        />
      </svg>

      {/* Copy */}
      <div className="relative z-10 flex flex-col justify-center px-5 py-5 md:min-h-[200px] md:max-w-[46%] lg:min-h-[220px] xl:min-h-[232px] md:py-6 lg:px-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#0A9189]">
          Doctor Workspace
        </p>
        <h2 className="mt-2 text-[23px] font-bold leading-[1.1] tracking-[-0.025em] text-[#0F2D4A] sm:text-[26px] lg:text-[29px] xl:text-[31px]">
          Manage Today&apos;s Care with Efficiency
        </h2>
        <p className="mt-2.5 max-w-[430px] text-[12px] leading-[1.55] text-[#4E6875] xl:text-[12.5px]">
          Review your schedule, consult with patients, access clinical records, create
          prescriptions, and complete follow-ups — all in one place.
        </p>
        <button
          type="button"
          onClick={onStartConsultation}
          className="mt-4 inline-flex h-[38px] w-fit items-center gap-2 self-start rounded-full bg-[#0A9189] pl-3.5 pr-4 text-[11.5px] font-semibold text-white shadow-[0_12px_22px_-14px_rgba(10,145,137,0.85)] transition hover:bg-[#087F78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189] active:translate-y-px"
        >
          <Stethoscope size={13} aria-hidden />
          Start Consultation
          <ArrowRight size={13} aria-hidden className="opacity-80" />
        </button>
      </div>

      {/* Scene band (mobile) */}
      <div className="relative h-[176px] w-full md:hidden">
        <Image
          src={ASSETS.doctorHeroPlate}
          alt="A Medora doctor consulting with a patient in the clinic"
          fill
          sizes="100vw"
          className="object-cover object-[46%_50%]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-10 bg-[linear-gradient(to_bottom,#F9FEFC_0%,rgba(249,254,252,0)_100%)]"
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

type StatKey = keyof DoctorOverviewCounts;

const STAT_ITEMS: {
  key: StatKey;
  label: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  { key: "todaysAppointments", label: "Today's Appointments", icon: CalendarDays, tone: "bg-[#E7FBF8] text-[#0A9189]" },
  { key: "waitingPatients", label: "Waiting Patients", icon: Users, tone: "bg-[#EFF4FF] text-[#3B6EF6]" },
  { key: "pendingReports", label: "Pending Reports", icon: ClipboardList, tone: "bg-[#F3EEFF] text-[#8B5CF6]" },
  { key: "followUps", label: "Follow-ups", icon: ClipboardCheck, tone: "bg-[#FFF6E5] text-[#D98A0B]" },
];

export function DoctorStats({
  counts,
  onSelect,
}: {
  counts: DoctorOverviewCounts;
  onSelect: (key: StatKey) => void;
}) {
  return (
    <RevealOnScroll as="section" stagger={55} y={14} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className="group flex items-center gap-3 rounded-2xl border border-[#E6EFEE] bg-white px-4 py-3.5 text-left shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-[1px] hover:border-[#CFE8E3] hover:shadow-[0_16px_34px_-26px_rgba(15,45,74,0.45)]"
          >
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", item.tone)}>
              <Icon size={18} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[21px] font-bold leading-none text-[#0F2D4A]">
                {counts[item.key]}
              </span>
              <span className="mt-1.5 block text-[10px] font-medium leading-[1.25] text-[#5B6B7C] xl:text-[10.5px]">
                {item.label}
              </span>
            </span>
            <ChevronRight
              size={13}
              aria-hidden
              className="shrink-0 text-[#C3CFDA] transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
            />
          </button>
        );
      })}
    </RevealOnScroll>
  );
}

/* ------------------------------------------------------------------ */
/* Today's schedule                                                    */
/* ------------------------------------------------------------------ */

export function TodaySchedule({
  appointments,
  onOpen,
  onViewFull,
}: {
  appointments: PortalAppointment[];
  onOpen: (appointment: PortalAppointment) => void;
  onViewFull: () => void;
}) {
  return (
    <DoctorCard className="flex h-full min-w-0 flex-col p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Today&apos;s Schedule</h2>
        <button
          type="button"
          onClick={onViewFull}
          className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-[#0A9189] transition-colors duration-150 hover:text-[#088078]"
        >
          View Full Schedule
          <ArrowRight size={11} aria-hidden />
        </button>
      </div>

      <ul className="mt-2.5 flex-1 space-y-1">
        {appointments.map((appointment) => {
          const patient = getPortalPatient(appointment.patientId);
          if (!patient) return null;

          return (
            <li key={appointment.id}>
              <button
                type="button"
                onClick={() => onOpen(appointment)}
                className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-3 text-left transition-[background-color,border-color] duration-150 hover:border-[#E6EFEE] hover:bg-[#F8FCFB] focus-visible:border-[#BFE8E2] focus-visible:bg-[#F8FCFB] focus-visible:outline-none"
              >
                <span className="w-[56px] shrink-0 text-[10.5px] font-semibold text-[#0F2D4A]">
                  {formatClock(appointment.time)}
                </span>
                <Avatar name={patient.name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-semibold text-[#0F2D4A]">
                    {patient.name}
                  </span>
                  <span className="line-clamp-2 text-[9.5px] leading-[1.35] text-[#8A9AAA]">
                    {patient.age} y · {appointment.reason}
                  </span>
                </span>
                <DoctorStatusBadge status={appointment.status} />
                <ChevronRight
                  size={13}
                  aria-hidden
                  className="shrink-0 text-[#C3CFDA] transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </DoctorCard>
  );
}

/* ------------------------------------------------------------------ */
/* Appointment status donut                                            */
/* ------------------------------------------------------------------ */

export function AppointmentStatusCard({
  appointments,
}: {
  appointments: PortalAppointment[];
}) {
  const slices = getStatusBreakdown(appointments);
  const total = appointments.length;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <DoctorCard className="p-3">
      <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Appointment Status (Today)</h2>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="relative shrink-0">
          <svg
            viewBox="0 0 110 110"
            role="img"
            aria-label={`${total} appointments: ${slices
              .map((slice) => `${slice.status} ${slice.count}`)
              .join(", ")}`}
            className="h-[92px] w-[92px] -rotate-90"
          >
            <circle cx="55" cy="55" r={radius} fill="none" stroke="#F1F6F6" strokeWidth="12" />
            {slices.map((slice) => {
              const length = (slice.count / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const circle = (
                <circle
                  key={slice.status}
                  cx="55"
                  cy="55"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="12"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += length;
              return circle;
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-[16px] font-bold leading-none text-[#0F2D4A]">{total}</p>
              <p className="mt-[2px] text-[7.5px] font-medium text-[#8A9AAA]">Appointments</p>
            </div>
          </div>
        </div>

        <ul className="min-w-[118px] flex-1 space-y-[3px]">
          {slices.map((slice) => (
            <li key={slice.status} className="flex items-center gap-1.5 text-[9.5px]">
              <span className={cn("h-[6px] w-[6px] shrink-0 rounded-full", slice.dot)} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[#5B6B7C]">{slice.status}</span>
              <span className="shrink-0 font-semibold text-[#0F2D4A]">{slice.count}</span>
              <span className="w-[30px] shrink-0 text-right text-[#9AA9B8]">{slice.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </DoctorCard>
  );
}

/* ------------------------------------------------------------------ */
/* Recent patients                                                     */
/* ------------------------------------------------------------------ */

export function RecentPatientsCard({
  onOpen,
  onViewAll,
}: {
  onOpen: (patientId: string) => void;
  onViewAll: () => void;
}) {
  return (
    <DoctorCard className="p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11.5px] font-semibold text-[#0F2D4A]">Recent Patients</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-[#0A9189] transition-colors duration-150 hover:text-[#088078]"
        >
          View All
          <ArrowRight size={11} aria-hidden />
        </button>
      </div>

      <ul className="mt-1.5 space-y-0.5">
        {recentPatientIds.map((id) => {
          const patient = getPortalPatient(id);
          if (!patient) return null;

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onOpen(patient.id)}
                className="group flex w-full items-center gap-3 rounded-xl px-1.5 py-[7px] text-left transition-colors duration-150 hover:bg-[#F8FCFB]"
              >
                <Avatar name={patient.name} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-semibold text-[#0F2D4A]">
                    {patient.name}
                  </span>
                  <span className="block truncate text-[8.5px] text-[#9AA9B8]">
                    Last visit: {formatPortalDate(recentPatientLastVisit[id] ?? "")}
                  </span>
                </span>
                <ChevronRight
                  size={12}
                  aria-hidden
                  className="shrink-0 text-[#C3CFDA] transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </DoctorCard>
  );
}

/* ------------------------------------------------------------------ */
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */

export type QuickActionKey = "start" | "record" | "prescription" | "labs" | "report";

const QUICK_ACTIONS: { key: QuickActionKey; label: string; icon: LucideIcon; tone: string }[] = [
  { key: "start", label: "Start Consultation", icon: Stethoscope, tone: "bg-[#E7FBF8] text-[#0A9189]" },
  { key: "record", label: "View Patient Record", icon: UserRound, tone: "bg-[#EFF4FF] text-[#3B6EF6]" },
  { key: "prescription", label: "Add Prescription", icon: Pill, tone: "bg-[#F3EEFF] text-[#8B5CF6]" },
  { key: "labs", label: "Review Lab Results", icon: FlaskConical, tone: "bg-[#FFF6E5] text-[#D98A0B]" },
  { key: "report", label: "Write Report", icon: ClipboardList, tone: "bg-[#FDECEF] text-[#E5486B]" },
];

export function QuickActionsCard({ onAction }: { onAction: (key: QuickActionKey) => void }) {
  return (
    <DoctorCard className="p-3">
      <h2 className="text-[12.5px] font-semibold text-[#0F2D4A]">Quick Actions</h2>
      <ul className="mt-1.5 space-y-0.5">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.key}>
              <button
                type="button"
                onClick={() => onAction(action.key)}
                className="group flex w-full items-center gap-3 rounded-xl px-1.5 py-[7px] text-left transition-colors duration-150 hover:bg-[#F8FCFB]"
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", action.tone)}>
                  <Icon size={14} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[#0F2D4A]">
                  {action.label}
                </span>
                <ChevronRight
                  size={12}
                  aria-hidden
                  className="shrink-0 text-[#C3CFDA] transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </DoctorCard>
  );
}

/* ------------------------------------------------------------------ */
/* Alerts & pending tasks                                              */
/* ------------------------------------------------------------------ */

const TASK_TONE: Record<PendingTask["tone"], string> = {
  mint: "bg-[#E7FBF8] text-[#0A9189]",
  amber: "bg-[#FFF6E5] text-[#C77A0A]",
  blue: "bg-[#EFF4FF] text-[#3B6EF6]",
};

const TASK_ICON: Record<string, LucideIcon> = {
  "task-labs": FlaskConical,
  "task-reports": ClipboardList,
  "task-followups": Clock,
};

export function PendingTasksCard({
  tasks,
  onSelect,
}: {
  tasks: PendingTask[];
  onSelect: (task: PendingTask) => void;
}) {
  return (
    <DoctorCard className="p-3">
      <h2 className="text-[11.5px] font-semibold text-[#0F2D4A]">Alerts &amp; Pending Tasks</h2>
      <ul className="mt-1.5 space-y-0.5">
        {tasks.map((task) => {
          const Icon = TASK_ICON[task.id] ?? ClipboardList;
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onSelect(task)}
                className="group flex w-full items-center gap-3 rounded-xl px-1.5 py-[7px] text-left transition-colors duration-150 hover:bg-[#F8FCFB]"
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", TASK_TONE[task.tone])}>
                  <Icon size={14} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-[11.5px] leading-[1.3] text-[#33475B]">{task.label}</span>
                <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-[#F1F6F6] px-1 text-[9px] font-bold text-[#0F2D4A]">
                  {task.count}
                </span>
                <ChevronRight
                  size={12}
                  aria-hidden
                  className="shrink-0 text-[#C3CFDA] transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-[#0A9189]"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </DoctorCard>
  );
}

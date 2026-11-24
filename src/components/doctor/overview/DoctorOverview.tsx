"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatPersonName } from "@/lib/format";
import { Avatar } from "@/components/patient/ui";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import {
  formatClock,
  getDoctorOverviewCounts,
  getPortalPatient,
  getSchedulePreview,
  isConsultationEligible,
  pendingTasks,
  type PortalAppointment,
  type PendingTask,
} from "@/lib/mock/doctorPortal";
import { useDoctorWorkspace } from "@/components/doctor/DoctorWorkspace";
import {
  AppointmentStatusCard,
  DoctorGreeting,
  DoctorHero,
  DoctorStats,
  PendingTasksCard,
  QuickActionsCard,
  RecentPatientsCard,
  TodaySchedule,
  type QuickActionKey,
} from "./OverviewSections";
import { AppointmentQuickView } from "./AppointmentQuickView";
import { PatientQuickProfile } from "./PatientQuickProfile";
import { DoctorOverlay } from "./DoctorOverlay";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DoctorOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const { appointments, startConsultation } = useDoctorWorkspace();

  const [greeting, setGreeting] = useState("Good morning");
  const [dateLabel, setDateLabel] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const displayName = formatPersonName(user?.full_name) || "Dr. Sarah Ahmed";

  // Client-only clock keeps the greeting and date current without a
  // server/client hydration mismatch.
  useEffect(() => {
    const now = new Date();
    setGreeting(greetingForHour(now.getHours()));
    setDateLabel(
      now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    );
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast(message);
  const comingSoon = (label: string) => notify(`${label} is coming in a later phase.`);

  const counts = useMemo(() => getDoctorOverviewCounts(appointments), [appointments]);
  const schedule = useMemo(() => {
    const preview = getSchedulePreview(4);
    return preview.map((item) => appointments.find((a) => a.id === item.id) ?? item);
  }, [appointments]);

  const selectedAppointment = appointmentId
    ? appointments.find((appointment) => appointment.id === appointmentId) ?? null
    : null;

  /* -------------------------------------------------------------- */
  /* Consultation entry points                                       */
  /* -------------------------------------------------------------- */

  const launchConsultation = (appointment: PortalAppointment) => {
    startConsultation(appointment.id);
    setAppointmentId(null);
    setPatientId(null);
    router.push(`/doctor/consultation/${appointment.id}`);
  };

  const startForPatient = (id: string) => {
    const eligible = appointments.find(
      (appointment) => appointment.patientId === id && isConsultationEligible(appointment),
    );

    if (!eligible) {
      notify("This patient has no eligible appointment today. Start a consultation from today's schedule.");
      return;
    }

    launchConsultation(eligible);
  };

  const handleStat = (key: keyof typeof counts) => {
    const labels: Record<keyof typeof counts, string> = {
      todaysAppointments: "My Schedule",
      waitingPatients: "The patient queue",
      pendingReports: "Reports review",
      followUps: "Follow-up tracking",
    };
    comingSoon(labels[key]);
  };

  const handleQuickAction = (key: QuickActionKey) => {
    switch (key) {
      case "start":
        // No patient/appointment context yet — ask for one instead of starting
        // an unassociated consultation.
        setPickerOpen(true);
        break;
      case "record":
        setPickerOpen(true);
        break;
      case "prescription":
        comingSoon("Prescription writing");
        break;
      case "labs":
        comingSoon("The Doctor Lab Results module");
        break;
      case "report":
        comingSoon("Report writing");
        break;
    }
  };

  const handleTask = (task: PendingTask) => {
    const labels: Record<string, string> = {
      "task-labs": "The Doctor Lab Results module",
      "task-reports": "Reports review",
      "task-followups": "Follow-up tracking",
    };
    comingSoon(labels[task.id] ?? "This section");
  };

  return (
    <div className="space-y-3">
      <DoctorGreeting greeting={greeting} name={displayName} dateLabel={dateLabel} />

      <RevealOnScroll y={14}>
        <DoctorHero onStartConsultation={() => handleQuickAction("start")} />
      </RevealOnScroll>

      <DoctorStats counts={counts} onSelect={handleStat} />

      <RevealOnScroll
        stagger={55}
        y={16}
        className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]"
      >
        <TodaySchedule
          appointments={schedule}
          onOpen={(appointment) => setAppointmentId(appointment.id)}
          onViewFull={() => router.push("/doctor/appointments")}
        />

        <div className="min-w-0 space-y-3">
          <AppointmentStatusCard appointments={appointments} />
          <RecentPatientsCard
            onOpen={(id) => setPatientId(id)}
            onViewAll={() => router.push("/doctor/patients")}
          />
        </div>

        <div className="min-w-0 space-y-3">
          <QuickActionsCard onAction={handleQuickAction} />
          <PendingTasksCard tasks={pendingTasks} onSelect={handleTask} />
        </div>
      </RevealOnScroll>

      <p className="text-[9px] text-[#9AA9B8]">
        Counts and patient records in this phase come from typed demo fixtures. Status changes are
        kept in the browser session only and are not saved to the database.
      </p>

      <AppointmentQuickView
        appointment={selectedAppointment}
        dateLabel={dateLabel}
        onClose={() => setAppointmentId(null)}
        onViewPatient={(id) => {
          setAppointmentId(null);
          setPatientId(id);
        }}
        onStartConsultation={launchConsultation}
        onReschedule={() => comingSoon("Rescheduling")}
        onMarkArrived={() =>
          notify("Patient check-in is handled by the reception desk.")
        }
      />

      <PatientQuickProfile
        patientId={patientId}
        onClose={() => setPatientId(null)}
        onStartConsultation={startForPatient}
        onOpenFullProfile={() => {
          if (patientId) router.push(`/doctor/patients/${patientId}`);
        }}
        onReviewLabs={() => {
          if (patientId) router.push(`/doctor/patients/${patientId}?tab=labs`);
        }}
      />

      <ConsultationPicker
        open={pickerOpen}
        appointments={appointments}
        onClose={() => setPickerOpen(false)}
        onPick={(appointment) => {
          setPickerOpen(false);
          launchConsultation(appointment);
        }}
      />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-navy px-4 py-2 text-[12.5px] font-medium text-white shadow-pop"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Consultation picker                                                 */
/* ------------------------------------------------------------------ */

function ConsultationPicker({
  open,
  appointments,
  onClose,
  onPick,
}: {
  open: boolean;
  appointments: PortalAppointment[];
  onClose: () => void;
  onPick: (appointment: PortalAppointment) => void;
}) {
  const eligible = appointments.filter(isConsultationEligible);

  return (
    <DoctorOverlay
      open={open}
      onClose={onClose}
      variant="dialog"
      title="Select a patient to consult"
      description="A consultation must be linked to a specific appointment. Choose who you are seeing now."
    >
      {eligible.length === 0 ? (
        <p className="py-6 text-center text-[10.5px] text-[#7187A6]">
          No eligible appointments are waiting right now.
        </p>
      ) : (
        <ul className="divide-y divide-[#F2F7F7] overflow-hidden rounded-xl border border-[#EDF3F3]">
          {eligible.map((appointment) => {
            const patient = getPortalPatient(appointment.patientId);
            if (!patient) return null;
            return (
              <li key={appointment.id}>
                <button
                  type="button"
                  onClick={() => onPick(appointment)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-[#F8FCFB]"
                >
                  <Avatar name={patient.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-semibold text-[#0F2D4A]">
                      {patient.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9.5px] text-[#8A9AAA]">
                      {formatClock(appointment.time)} · {appointment.reason}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#F1F6F6] px-2 py-[3px] text-[9.5px] font-semibold text-[#5B6B7C]">
                    {appointment.status}
                  </span>
                  <Stethoscope size={13} aria-hidden className="shrink-0 text-[#0A9189]" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DoctorOverlay>
  );
}

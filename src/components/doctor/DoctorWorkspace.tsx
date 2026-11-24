"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  portalAppointments,
  type DoctorAppointmentStatus,
  type PortalAppointment,
} from "@/lib/mock/doctorPortal";

/**
 * Session-scoped doctor workspace state.
 *
 * Frontend-only phase: starting or completing a consultation updates React
 * state here so the Overview reflects it when the doctor returns. Nothing is
 * sent to a backend and nothing is written to PostgreSQL — a full page reload
 * resets it, which is the honest behaviour for a demo state.
 *
 * The provider sits in the doctor layout, so the state survives navigation
 * between the Overview and the Consultation Workspace handoff.
 */

type DoctorWorkspaceValue = {
  appointments: PortalAppointment[];
  statusFor: (appointment: PortalAppointment) => DoctorAppointmentStatus;
  activeAppointmentId: string | null;
  startConsultation: (appointmentId: string) => void;
  completeConsultation: (appointmentId: string) => void;
  isDemoState: boolean;
};

const DoctorWorkspaceContext = createContext<DoctorWorkspaceValue | null>(null);

export function useDoctorWorkspace(): DoctorWorkspaceValue {
  const value = useContext(DoctorWorkspaceContext);
  if (!value) {
    throw new Error("useDoctorWorkspace must be used inside <DoctorWorkspaceProvider>");
  }
  return value;
}

export function DoctorWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, DoctorAppointmentStatus>>({});
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);

  const statusFor = useCallback(
    (appointment: PortalAppointment) => overrides[appointment.id] ?? appointment.status,
    [overrides],
  );

  const appointments = useMemo(
    () =>
      portalAppointments.map((appointment) => ({
        ...appointment,
        status: overrides[appointment.id] ?? appointment.status,
      })),
    [overrides],
  );

  const startConsultation = useCallback((appointmentId: string) => {
    setOverrides((current) => ({ ...current, [appointmentId]: "In Progress" }));
    setActiveAppointmentId(appointmentId);
  }, []);

  const completeConsultation = useCallback((appointmentId: string) => {
    setOverrides((current) => ({ ...current, [appointmentId]: "Completed" }));
    setActiveAppointmentId((current) => (current === appointmentId ? null : current));
  }, []);

  const value = useMemo<DoctorWorkspaceValue>(
    () => ({
      appointments,
      statusFor,
      activeAppointmentId,
      startConsultation,
      completeConsultation,
      isDemoState: Object.keys(overrides).length > 0,
    }),
    [appointments, statusFor, activeAppointmentId, startConsultation, completeConsultation, overrides],
  );

  return (
    <DoctorWorkspaceContext.Provider value={value}>{children}</DoctorWorkspaceContext.Provider>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getPortalPatient } from "@/lib/mock/doctorPortal";
import {
  buildProposals,
  buildReports,
  buildSlots,
  buildTranscript,
  initialState,
  type ConsultationState,
  type ReportKey,
  type ReportStatus,
} from "@/lib/consultation/model";

/**
 * Consultation workflow state.
 *
 * Lives in the doctor layout so a consultation survives navigation between the
 * workspace list and a step. Keyed by appointment id, so every entry point
 * (Overview, My Schedule, Patients, sidebar) resolves the same record.
 *
 * Nothing leaves the browser: no audio is captured, no transcript is stored
 * outside React memory, and the timers below are demo pacing, not real jobs.
 */

type Store = Record<string, ConsultationState>;

type Context = {
  stateFor: (appointmentId: string) => ConsultationState;
  hasStarted: (appointmentId: string) => boolean;
  ensure: (appointmentId: string, patientId: string, reason: string) => void;
  setConsent: (id: string, patch: Partial<ConsultationState["consent"]>) => void;
  recordConsent: (id: string) => void;
  declineRecording: (id: string) => void;
  startRecording: (id: string) => void;
  pauseRecording: (id: string) => void;
  resumeRecording: (id: string) => void;
  stopRecording: (id: string) => void;
  setRecordingSeconds: (id: string, seconds: number) => void;
  seedDemoTranscript: (id: string) => void;
  setTranscriptEntry: (id: string, entryId: string, text: string) => void;
  saveTranscriptDraft: (id: string) => void;
  approveTranscript: (id: string) => void;
  startGeneration: (id: string) => void;
  retryGeneration: (id: string) => void;
  setReportBody: (id: string, key: ReportKey, body: string) => void;
  setReportStatus: (id: string, key: ReportKey, status: ReportStatus) => void;
  publishReport1: (id: string) => void;
  toggleProposal: (id: string, proposalId: string) => void;
  applyProposals: (id: string) => void;
  rejectAllProposals: (id: string) => void;
  deferUpdates: (id: string) => void;
  setFollowUp: (id: string, patch: Partial<ConsultationState["followUp"]>) => void;
  proposeSlots: (id: string) => void;
  sendSlots: (id: string) => void;
  setNotes: (id: string, notes: string) => void;
  complete: (id: string) => void;
};

const WorkflowContext = createContext<Context | null>(null);

export function useConsultationWorkflow(): Context {
  const value = useContext(WorkflowContext);
  if (!value) {
    throw new Error("useConsultationWorkflow must be used inside <ConsultationWorkflowProvider>");
  }
  return value;
}

export function ConsultationWorkflowProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>({});

  const patch = useCallback((id: string, update: (state: ConsultationState) => ConsultationState) => {
    setStore((current) => {
      const existing = current[id];
      if (!existing) return current;
      return { ...current, [id]: update(existing) };
    });
  }, []);

  const ensure = useCallback((appointmentId: string, patientId: string, reason: string) => {
    setStore((current) => {
      if (current[appointmentId]) return current;
      return {
        ...current,
        [appointmentId]: { ...initialState(appointmentId, patientId, reason), startedAt: new Date().toISOString() },
      };
    });
  }, []);

  /* -------------------------------------------------------------- */
  /* Demo timers: recording clock, transcription, Agent 1 progress   */
  /* -------------------------------------------------------------- */

  const generatingIds = useMemo(
    () => Object.values(store).filter((s) => s.generation.status === "running").map((s) => s.appointmentId),
    [store],
  );

  useEffect(() => {
    if (generatingIds.length === 0) return;
    const timer = window.setInterval(() => {
      setStore((current) => {
        const next: Store = { ...current };
        for (const id of generatingIds) {
          const state = next[id];
          if (!state || state.generation.status !== "running") continue;
          const progress = Math.min(100, state.generation.progress + 4);
          const stage = Math.min(5, Math.floor(progress / 20));
          if (progress >= 100) {
            const patient = getPortalPatient(state.patientId);
            next[id] = {
              ...state,
              generation: { status: "done", progress: 100, stage: 5 },
              reports: patient
                ? buildReports(patient, state.reason)
                : state.reports,
            };
          } else {
            next[id] = { ...state, generation: { ...state.generation, progress, stage } };
          }
        }
        return next;
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [generatingIds]);

  const startGeneration = useCallback(
    (id: string) => {
      // Drafts are only materialised when generation finishes; a failed run
      // must never leave "completed" reports behind.
      patch(id, (state) => ({
        ...state,
        generation: { status: "running", progress: 0, stage: 0 },
      }));
    },
    [patch],
  );

  const value = useMemo<Context>(() => {
    const stateFor = (appointmentId: string) =>
      store[appointmentId] ?? {
        ...initialState(appointmentId, "", ""),
      };

    return {
      stateFor,
      hasStarted: (appointmentId) => Boolean(store[appointmentId]),
      ensure,
      setConsent: (id, next) =>
        patch(id, (state) => ({ ...state, consent: { ...state.consent, ...next } })),
      recordConsent: (id) =>
        patch(id, (state) => ({
          ...state,
          consent: { ...state.consent, recordedAt: new Date().toISOString(), declined: false },
        })),
      declineRecording: (id) =>
        patch(id, (state) => ({
          ...state,
          consent: { audio: false, transcription: false, ai: false, declined: true, recordedAt: new Date().toISOString() },
        })),
      startRecording: (id) =>
        patch(id, (state) =>
          state.consent.audio
            ? { ...state, recording: { status: "recording", seconds: 0 } }
            : state,
        ),
      pauseRecording: (id) =>
        patch(id, (state) =>
          state.recording.status === "recording"
            ? { ...state, recording: { ...state.recording, status: "paused" } }
            : state,
        ),
      resumeRecording: (id) =>
        patch(id, (state) =>
          state.recording.status === "paused"
            ? { ...state, recording: { ...state.recording, status: "recording" } }
            : state,
        ),
      stopRecording: (id) =>
        patch(id, (state) =>
          ["recording", "paused"].includes(state.recording.status)
            ? { ...state, recording: { ...state.recording, status: "stopped" } }
            : state,
        ),
      setRecordingSeconds: (id, seconds) =>
        patch(id, (state) =>
          state.recording.seconds === seconds
            ? state
            : { ...state, recording: { ...state.recording, seconds } },
        ),
      /**
       * Speech-to-text is not connected in this phase. The workflow demo needs
       * transcript text, so it is inserted on an explicit doctor action and is
       * labelled as placeholder content — never generated automatically.
       */
      seedDemoTranscript: (id) =>
        patch(id, (state) => {
          const patient = getPortalPatient(state.patientId);
          if (!patient) return state;
          return {
            ...state,
            transcript: {
              ...state.transcript,
              entries: buildTranscript(patient, state.reason),
            },
          };
        }),
      setTranscriptEntry: (id, entryId, text) =>
        patch(id, (state) => ({
          ...state,
          transcript: {
            ...state.transcript,
            dirty: true,
            entries: state.transcript.entries.map((entry) =>
              entry.id === entryId ? { ...entry, text } : entry,
            ),
          },
        })),
      saveTranscriptDraft: (id) =>
        patch(id, (state) => ({
          ...state,
          transcript: { ...state.transcript, dirty: false, version: state.transcript.version + 1 },
        })),
      approveTranscript: (id) =>
        patch(id, (state) =>
          state.transcript.entries.length === 0 || state.transcript.dirty
            ? state
            : { ...state, transcript: { ...state.transcript, status: "approved" } },
        ),
      startGeneration,
      retryGeneration: (id) => startGeneration(id),
      setReportBody: (id, key, body) =>
        patch(id, (state) => ({
          ...state,
          reports: {
            ...state.reports,
            [key]: { ...state.reports[key], body, edited: true },
          },
        })),
      setReportStatus: (id, key, status) =>
        patch(id, (state) => {
          const report = state.reports[key];
          if (!report) return state;
          return {
            ...state,
            reports: {
              ...state.reports,
              [key]: { ...report, status },
            },
            recordUpdates:
              key === "report2" && status === "approved"
                ? {
                    ...state.recordUpdates,
                    proposals: state.recordUpdates.proposals.length
                      ? state.recordUpdates.proposals
                      : (() => {
                          const patient = getPortalPatient(state.patientId);
                          return patient ? buildProposals(patient) : [];
                        })(),
                  }
                : state.recordUpdates,
          };
        }),
      publishReport1: (id) =>
        patch(id, (state) =>
          state.reports.report1?.status === "approved"
            ? { ...state, reports: { ...state.reports, report1: { ...state.reports.report1, status: "published" } } }
            : state,
        ),
      toggleProposal: (id, proposalId) =>
        patch(id, (state) => ({
          ...state,
          recordUpdates: {
            ...state.recordUpdates,
            proposals: state.recordUpdates.proposals.map((proposal) =>
              proposal.id === proposalId ? { ...proposal, selected: !proposal.selected } : proposal,
            ),
          },
        })),
      applyProposals: (id) =>
        patch(id, (state) => {
          const patient = getPortalPatient(state.patientId);
          const canApply =
            state.reports.report2?.status === "approved" &&
            state.recordUpdates.proposals.some((p) => p.selected && !p.applied);
          if (!canApply) return state;
          return {
            ...state,
            recordUpdates: {
              status: "applied",
              appliedAt: new Date().toISOString(),
              proposals: state.recordUpdates.proposals.map((proposal) =>
                proposal.selected ? { ...proposal, applied: true } : proposal,
              ),
            },
            // Record proposals are demo text: nothing is written to a record.
            patientId: patient?.id ?? state.patientId,
          };
        }),
      rejectAllProposals: (id) =>
        patch(id, (state) => ({
          ...state,
          recordUpdates: {
            ...state.recordUpdates,
            status: "deferred",
            proposals: state.recordUpdates.proposals.map((proposal) => ({
              ...proposal,
              selected: false,
            })),
          },
        })),
      deferUpdates: (id) =>
        patch(id, (state) => ({
          ...state,
          recordUpdates: { ...state.recordUpdates, status: "deferred" },
        })),
      setFollowUp: (id, next) =>
        patch(id, (state) => ({ ...state, followUp: { ...state.followUp, ...next } })),
      proposeSlots: (id) =>
        patch(id, (state) => ({
          ...state,
          followUp: {
            ...state.followUp,
            status: "proposed",
            slots: state.followUp.slots.length ? state.followUp.slots : buildSlots(),
          },
        })),
      sendSlots: (id) =>
        patch(id, (state) =>
          state.followUp.selectedSlotId
            ? {
                ...state,
                followUp: { ...state.followUp, status: "proposed", sentAt: new Date().toISOString() },
              }
            : state,
        ),
      setNotes: (id, notes) => patch(id, (state) => ({ ...state, notes })),
      complete: (id) => patch(id, (state) => ({ ...state, completed: true })),
    };
  }, [store, ensure, patch, startGeneration]);

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

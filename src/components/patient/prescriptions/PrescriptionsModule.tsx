"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, SearchX } from "lucide-react";
import { EmptyState, Toast, type ToastState, type ToastTone } from "@/components/patient/medical-records/ui";
import {
  getActiveMedications,
  getPrescriptionCounts,
  getPrescriptionMedications,
  getPrescriptionMeta,
  getPrescriptionRecord,
  getTodaySchedule,
  matchesDateRange,
  medications as seedMedications,
  prescriptionRecords,
  type Medication,
  type PrescriptionRecord,
} from "@/lib/mock/prescriptions";
import {
  PRESCRIPTION_TABS,
  PrescriptionStats,
  PrescriptionTabs,
  PrescriptionsHeader,
  type PrescriptionTab,
} from "./PrescriptionsChrome";
import {
  EMPTY_PRESCRIPTION_FILTERS,
  MedicationRow,
  PrescriptionFilterBar,
  PrescriptionListShell,
  PrescriptionRow,
  type PrescriptionFilters,
} from "./PrescriptionsList";
import { QuickActionsPanel, TodaysMedicationsPanel } from "./PrescriptionsPanels";
import {
  AddMedicationDialog,
  PrescriptionPickerDialog,
  ScheduleDialog,
} from "./PrescriptionsDialogs";
import { MedicationDrawer } from "./MedicationDrawer";

const FILTER_STORE_KEY = "medora.prescriptions.filters";
const SCROLL_STORE_KEY = "medora.prescriptions.scroll";

type DialogState =
  | { type: "download" }
  | { type: "related-visit" }
  | { type: "schedule" }
  | { type: "reminders" }
  | { type: "add-medication" }
  | null;

function isTab(value: string | null): value is PrescriptionTab {
  return Boolean(value) && PRESCRIPTION_TABS.some((tab) => tab.key === value);
}

function defaultFilters(): Record<PrescriptionTab, PrescriptionFilters> {
  return {
    all: { ...EMPTY_PRESCRIPTION_FILTERS },
    medications: { ...EMPTY_PRESCRIPTION_FILTERS },
    history: { ...EMPTY_PRESCRIPTION_FILTERS },
  };
}

export function PrescriptionsModule() {
  const router = useRouter();

  const [tab, setTab] = useState<PrescriptionTab>("all");
  const [filters, setFilters] = useState<Record<PrescriptionTab, PrescriptionFilters>>(defaultFilters);
  const [ready, setReady] = useState(false);

  const [extraMedications, setExtraMedications] = useState<Medication[]>([]);
  const [drawerMedicationId, setDrawerMedicationId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reminderIds, setReminderIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  // Restore tab, filters and scroll so returning from a prescription detail
  // lands exactly where the patient left off.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (isTab(tabParam)) setTab(tabParam);

    try {
      const stored = window.sessionStorage.getItem(FILTER_STORE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<PrescriptionTab, PrescriptionFilters>>;
        setFilters((current) => ({
          all: { ...current.all, ...(parsed.all ?? {}) },
          medications: { ...current.medications, ...(parsed.medications ?? {}) },
          history: { ...current.history, ...(parsed.history ?? {}) },
        }));
      }
    } catch {
      /* storage unavailable — defaults are fine */
    }

    setReady(true);

    const scroll = Number(window.sessionStorage.getItem(SCROLL_STORE_KEY) ?? "0");
    if (Number.isFinite(scroll) && scroll > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: scroll }));
    }
    window.sessionStorage.removeItem(SCROLL_STORE_KEY);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem(FILTER_STORE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters, ready]);

  // Remembered so "Back to Prescriptions" on the detail page can restore the tab.
  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem("medora.prescriptions.tab", tab);
    } catch {
      /* ignore */
    }
  }, [tab, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const allMedications = useMemo(
    () => [...seedMedications, ...extraMedications],
    [extraMedications],
  );

  const counts = useMemo(
    () => getPrescriptionCounts(prescriptionRecords, allMedications),
    [allMedications],
  );

  const schedule = useMemo(() => getTodaySchedule(allMedications), [allMedications]);

  const activeFilters = filters[tab];
  const updateFilters = (next: PrescriptionFilters) =>
    setFilters((current) => ({ ...current, [tab]: next }));

  const changeTab = (next: PrescriptionTab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  const openPrescription = (id: string) => {
    window.sessionStorage.setItem(SCROLL_STORE_KEY, String(window.scrollY));
    router.push(`/patient/prescriptions/${id}`);
  };

  /* -------------------------------------------------------------- */
  /* Derived lists                                                   */
  /* -------------------------------------------------------------- */

  const filteredPrescriptions = useMemo(() => {
    const term = activeFilters.search.trim().toLowerCase();

    return prescriptionRecords.filter((prescription) => {
      if (tab === "history" && prescription.status === "Active") return false;
      if (activeFilters.status !== "all" && prescription.status !== activeFilters.status) return false;
      if (activeFilters.doctorId !== "all" && prescription.doctorId !== activeFilters.doctorId) return false;
      if (!matchesDateRange(prescription.date, activeFilters.dateRange)) return false;
      if (!term) return true;

      const { doctor, facility, specialty } = getPrescriptionMeta(prescription);
      const haystack = [
        prescription.title,
        doctor?.name,
        facility,
        specialty,
        ...getPrescriptionMedications(prescription.id).map((medication) => medication.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [tab, activeFilters]);

  const filteredMedications = useMemo(() => {
    const term = activeFilters.search.trim().toLowerCase();

    return allMedications.filter((medication) => {
      if (activeFilters.status !== "all" && medication.status !== activeFilters.status) return false;
      if (
        activeFilters.prescriptionId !== "all" &&
        medication.prescriptionId !== activeFilters.prescriptionId
      ) {
        return false;
      }
      if (!term) return true;

      const prescription = getPrescriptionRecord(medication.prescriptionId);
      const { doctor } = prescription ? getPrescriptionMeta(prescription) : { doctor: undefined };
      const haystack = [medication.name, medication.frequency, prescription?.title, doctor?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [allMedications, activeFilters]);

  const downloadablePrescriptions = useMemo(
    () => prescriptionRecords.filter((prescription) => prescription.fileIds.length > 0),
    [],
  );

  const visitPrescriptions = useMemo(
    () => prescriptionRecords.filter((prescription) => Boolean(prescription.relatedVisitId)),
    [],
  );

  /* -------------------------------------------------------------- */
  /* Actions                                                         */
  /* -------------------------------------------------------------- */

  const handleAddMedication = (draft: {
    name: string;
    strength: string;
    dosage: string;
    frequency: string;
    startDate: string;
  }) => {
    const medication: Medication = {
      id: `med-self-${Date.now()}`,
      prescriptionId: "self-reported",
      name: draft.name,
      dosage: draft.dosage,
      strength: draft.strength,
      frequency: draft.frequency,
      times: [],
      duration: "Ongoing",
      startDate: draft.startDate,
      endDate: draft.startDate,
      status: "Active",
      instructions: [],
      refillsRemaining: 0,
      selfReported: true,
    };

    setExtraMedications((current) => [medication, ...current]);
    setDialog(null);
    changeTab("medications");
    notify(
      "Added as a self-reported medication for this session only. It is not saved to your medical record.",
      "success",
    );
  };

  const toggleReminder = (medicationId: string) => {
    setReminderIds((current) =>
      current.includes(medicationId)
        ? current.filter((id) => id !== medicationId)
        : [...current, medicationId],
    );
  };

  const activeTabLabel = PRESCRIPTION_TABS.find((item) => item.key === tab)?.label ?? "";

  /* -------------------------------------------------------------- */
  /* Render                                                          */
  /* -------------------------------------------------------------- */

  return (
    <div className="space-y-3">
      <PrescriptionsHeader
        title="Prescriptions"
        subtitle="Manage your prescriptions and medications all in one place."
        action={
          <button
            type="button"
            onClick={() => setDialog({ type: "add-medication" })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A9189] px-3 py-2 text-[10.5px] font-semibold text-white shadow-[0_10px_24px_-16px_rgba(10,145,137,0.9)] transition hover:bg-[#088078]"
          >
            <Plus size={13} aria-hidden />
            Add Medication
          </button>
        }
      />

      <PrescriptionStats counts={counts} />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_286px]">
        <section className="rounded-2xl border border-[#E6EFEE] bg-white p-3 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)]">
          <PrescriptionTabs active={tab} counts={counts} onChange={changeTab} />

          <div
            role="tabpanel"
            id={`prescription-panel-${tab}`}
            aria-labelledby={`prescription-tab-${tab}`}
            className="mt-2.5"
          >
            <PrescriptionFilterBar
              mode={tab === "medications" ? "medications" : tab === "history" ? "history" : "prescriptions"}
              filters={activeFilters}
              onChange={updateFilters}
              prescriptions={prescriptionRecords}
              resultCount={tab === "medications" ? filteredMedications.length : filteredPrescriptions.length}
            />

            <div className="mt-2">
              {!ready ? (
                <ListSkeleton />
              ) : tab === "medications" ? (
                filteredMedications.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No medications match your filters"
                    description="Try clearing the search or choosing a different status."
                  />
                ) : (
                  <PrescriptionListShell>
                    {filteredMedications.map((medication) => (
                      <MedicationRow
                        key={medication.id}
                        medication={medication}
                        prescription={
                          medication.selfReported
                            ? undefined
                            : getPrescriptionRecord(medication.prescriptionId)
                        }
                        onOpen={setDrawerMedicationId}
                      />
                    ))}
                  </PrescriptionListShell>
                )
              ) : filteredPrescriptions.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title={
                    tab === "history"
                      ? "No previous prescriptions match your filters"
                      : "No prescriptions match your filters"
                  }
                  description="Try clearing the search or choosing a different doctor, status or date."
                />
              ) : (
                <PrescriptionListShell>
                  {filteredPrescriptions.map((prescription) => (
                    <PrescriptionRow
                      key={prescription.id}
                      prescription={prescription}
                      onOpen={openPrescription}
                    />
                  ))}
                </PrescriptionListShell>
              )}
            </div>

            {tab === "history" && filteredPrescriptions.length > 0 ? (
              <p className="mt-2 text-[9px] leading-relaxed text-[#9AA9B8]">
                Completed and expired prescriptions are kept for your records. They are not current
                treatment instructions — talk to your doctor before restarting any medication.
              </p>
            ) : null}
          </div>
        </section>

        <div className="space-y-3">
          <QuickActionsPanel
            onDownload={() => setDialog({ type: "download" })}
            onSchedule={() => setDialog({ type: "schedule" })}
            onReminders={() => setDialog({ type: "reminders" })}
            onRelatedVisit={() => setDialog({ type: "related-visit" })}
          />
          <TodaysMedicationsPanel
            slots={schedule}
            onOpenMedication={setDrawerMedicationId}
            onViewAll={() => changeTab("medications")}
          />
        </div>
      </div>

      <p className="text-[9px] text-[#9AA9B8]">
        Showing {activeTabLabel.toLowerCase()} from your Medora records. Prescriptions are written by
        your care team and cannot be edited here.
      </p>

      <MedicationDrawer
        medicationId={drawerMedicationId}
        onClose={() => setDrawerMedicationId(null)}
        onViewPrescription={(prescriptionId) => {
          setDrawerMedicationId(null);
          openPrescription(prescriptionId);
        }}
        onToast={notify}
      />

      {dialog?.type === "download" ? (
        <PrescriptionPickerDialog
          title="Download Prescription"
          description="Choose which prescription document to download."
          prescriptions={downloadablePrescriptions}
          emptyMessage="No prescription documents are attached to your records yet. Ask your care team for a copy."
          onSelect={(prescription) => {
            setDialog(null);
            notify(
              `A document is attached to ${prescription.title}, but document preview is not available in this demo.`,
              "info",
            );
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.type === "related-visit" ? (
        <PrescriptionPickerDialog
          title="View Related Visit"
          description="Choose a prescription to open the consultation it came from."
          prescriptions={visitPrescriptions}
          emptyMessage="None of your prescriptions are linked to a recorded visit."
          onSelect={(prescription) => {
            setDialog(null);
            if (!prescription.relatedVisitId) return;
            router.push(`/patient/medical-records?visit=${prescription.relatedVisitId}`);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.type === "schedule" || dialog?.type === "reminders" ? (
        <ScheduleDialog
          mode={dialog.type}
          slots={schedule}
          reminderIds={reminderIds}
          onToggleReminder={toggleReminder}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.type === "add-medication" ? (
        <AddMedicationDialog onClose={() => setDialog(null)} onAdd={handleAddMedication} />
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center gap-2.5 rounded-xl border border-[#F0F5F5] bg-white px-3 py-3"
        >
          <span className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-[#F1F6F6]" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-2.5 w-1/3 animate-pulse rounded bg-[#F1F6F6]" />
            <span className="block h-2 w-1/2 animate-pulse rounded bg-[#F6FAFA]" />
          </span>
          <span className="h-4 w-12 animate-pulse rounded-full bg-[#F1F6F6]" />
        </div>
      ))}
    </div>
  );
}

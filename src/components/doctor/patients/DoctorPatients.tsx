"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDoctorWorkspace } from "@/components/doctor/DoctorWorkspace";
import { DoctorCard } from "@/components/doctor/overview/OverviewSections";
import { PatientQuickProfile } from "@/components/doctor/overview/PatientQuickProfile";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import {
  EMPTY_PATIENT_FILTERS,
  getPatientStats,
  matchesFilters,
  matchesSearch,
  patientRecords,
  type ConditionGroup,
  type PatientFilters,
} from "@/lib/mock/doctorPatients";
import { PatientSummaryCards } from "./PatientSummaryCards";
import { PatientFilterChips, PatientFilterPanel, PatientsToolbar } from "./PatientFilters";
import { PatientsEmptyState, PatientsTable } from "./PatientsTable";
import { StartConsultationDialog } from "./StartConsultationDialog";

export function DoctorPatients() {
  const router = useRouter();
  const { startConsultation } = useDoctorWorkspace();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<PatientFilters>(EMPTY_PATIENT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [quickProfileId, setQuickProfileId] = useState<string | null>(null);
  const [consultId, setConsultId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => getPatientStats(patientRecords), []);

  const visible = useMemo(
    () =>
      patientRecords
        .filter((record) => matchesSearch(record, search) && matchesFilters(record, filters))
        .sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "")),
    [search, filters],
  );

  const consultRecord = consultId
    ? patientRecords.find((record) => record.patient.id === consultId) ?? null
    : null;

  const resetAll = () => {
    setSearch("");
    setFilters(EMPTY_PATIENT_FILTERS);
  };

  const openFull = (id: string, tab?: string) =>
    router.push(tab ? `/doctor/patients/${id}?tab=${tab}` : `/doctor/patients/${id}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[21px] font-bold tracking-[-0.02em] text-[#0F2D4A] sm:text-[23px]">
            Patients
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#5B6B7C]">
            Search, find, and manage your patients, view their clinical information, and start
            consultations.
          </p>
        </div>
      </div>

      <RevealOnScroll y={12}>
        <div className="relative">
          <PatientsToolbar
            search={search}
            onSearch={setSearch}
            filters={filters}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((current) => !current)}
            onAddPatient={() =>
              setToast("Patient registration is handled by the reception desk, not the doctor portal.")
            }
          />
          <PatientFilterPanel
            open={panelOpen}
            filters={filters}
            onApply={setFilters}
            onClearAll={() => setFilters(EMPTY_PATIENT_FILTERS)}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      </RevealOnScroll>

      <PatientFilterChips
        filters={filters}
        onRemoveCondition={(value: ConditionGroup) =>
          setFilters((current) => ({
            ...current,
            conditions: current.conditions.filter((item) => item !== value),
          }))
        }
        onRemoveAge={() =>
          setFilters((current) => ({ ...current, ageMin: 18, ageMax: 80 }))
        }
        onRemoveGender={() => setFilters((current) => ({ ...current, gender: "All" }))}
        onClearAll={() => setFilters(EMPTY_PATIENT_FILTERS)}
      />

      <RevealOnScroll y={14}>
        <PatientSummaryCards stats={stats} />
      </RevealOnScroll>

      <RevealOnScroll y={16}>
        <DoctorCard className="overflow-visible">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-2 pt-3">
            <p className="text-[11px] font-semibold text-[#0F2D4A]">
              {visible.length} {visible.length === 1 ? "patient" : "patients"}
              {search || patientFilterActive(filters) ? " matching" : " under your care"}
            </p>
            {selected.length > 0 ? (
              <p className="text-[9.5px] text-[#8A9AAA]">
                {selected.length} selected · selection is local to this view, no bulk actions
              </p>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <PatientsEmptyState
              onReset={resetAll}
              message={
                patientRecords.length === 0
                  ? "No patients are currently shared with you."
                  : "No patient matches the current search and filters. Try a different name, MRN, or widen the age range."
              }
            />
          ) : (
            <PatientsTable
              records={visible}
              selected={selected}
              onToggle={(id) =>
                setSelected((current) =>
                  current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                )
              }
              onToggleAll={() =>
                setSelected((current) =>
                  current.length === visible.length ? [] : visible.map((record) => record.patient.id),
                )
              }
              onOpen={(id) => setQuickProfileId(id)}
              onOpenFull={(id) => openFull(id)}
              onReviewLabs={(id) => openFull(id, "labs")}
              menuId={menuId}
              onMenuChange={setMenuId}
            />
          )}
        </DoctorCard>
      </RevealOnScroll>

      <p className="text-[9px] leading-relaxed text-[#9AA9B8]">
        Demo data: these patient records are typed fixtures shared with the Overview and My Schedule
        modules. Nothing on this page is read from or written to PostgreSQL.
      </p>

      <PatientQuickProfile
        patientId={quickProfileId}
        onClose={() => setQuickProfileId(null)}
        onStartConsultation={(id) => {
          setQuickProfileId(null);
          setConsultId(id);
        }}
        onOpenFullProfile={() => {
          if (quickProfileId) openFull(quickProfileId);
        }}
        onReviewLabs={() => {
          if (quickProfileId) openFull(quickProfileId, "labs");
        }}
      />

      <StartConsultationDialog
        record={consultRecord}
        onClose={() => setConsultId(null)}
        onOpenSchedule={() => {
          setConsultId(null);
          router.push("/doctor/appointments");
        }}
        onConfirm={(appointmentId) => {
          startConsultation(appointmentId);
          setConsultId(null);
          router.push(`/doctor/consultation/${appointmentId}`);
        }}
      />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[90] w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 rounded-xl bg-navy px-4 py-2.5 text-center text-[11.5px] font-medium text-white shadow-pop"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function patientFilterActive(filters: PatientFilters): boolean {
  return (
    filters.conditions.length > 0 ||
    filters.gender !== "All" ||
    filters.ageMin !== EMPTY_PATIENT_FILTERS.ageMin ||
    filters.ageMax !== EMPTY_PATIENT_FILTERS.ageMax
  );
}

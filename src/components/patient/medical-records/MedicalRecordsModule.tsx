"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Upload } from "lucide-react";
import {
  buildRecordEntries,
  documents as seedDocuments,
  getImagingResult,
  getLabResult,
  getMedicalReport,
  getPrescription,
  getVisit,
  isWithinRange,
  imagingResults,
  labResults,
  medicalReports,
  prescriptions,
  visits,
  type DocumentCategory,
  type MedicalDocument,
  type MedicalFile,
  type MedicalRecordEntry,
  type MedicalReport,
} from "@/lib/mock/medicalRecords";
import {
  MedicalRecordsHeader,
  MedicalRecordsStats,
  MedicalRecordsTabs,
  type MedicalCounts,
  type MedicalTab,
} from "./MedicalRecordsChrome";
import {
  EMPTY_RECORD_FILTERS,
  type RecordFilters,
  type SortOrder,
} from "./RecordListControls";
import { RecordListCard } from "./RecordList";
import { RecordPreview, type RecordPreviewHandlers } from "./RecordPreview";
import { VisitView } from "./VisitView";
import { PrescriptionView } from "./PrescriptionView";
import { LabResultView } from "./LabResultView";
import { ImagingView } from "./ImagingView";
import { DocumentsView } from "./DocumentsView";
import { UploadDocument } from "./UploadDocument";
import { ReportsList, ReportDetail } from "./ReportsView";
import { FilePreviewModal } from "./FilePreviewModal";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import {
  BackLink,
  EmptyState,
  Toast,
  demoExport,
  downloadTextFile,
  type ToastState,
  type ToastTone,
} from "./ui";

/* ------------------------------------------------------------------ */
/* URL state                                                           */
/* ------------------------------------------------------------------ */

type PageKey = MedicalTab | "upload";

type DetailType = "visit" | "prescription" | "lab" | "imaging" | "report";

type DetailState = { type: DetailType; id: string };

const TAB_KEYS: PageKey[] = [
  "overview",
  "visits",
  "prescriptions",
  "lab-results",
  "imaging",
  "documents",
  "reports",
  "upload",
];

const DETAIL_PARAM: Record<DetailType, string> = {
  visit: "visit",
  prescription: "prescription",
  lab: "lab",
  imaging: "imaging",
  report: "report",
};

const DETAIL_PARENT: Record<DetailType, MedicalTab> = {
  visit: "visits",
  prescription: "prescriptions",
  lab: "lab-results",
  imaging: "imaging",
  report: "reports",
};

function isTabKey(value: string | null): value is PageKey {
  return Boolean(value) && TAB_KEYS.includes(value as PageKey);
}

function parseUrl(): { tab: PageKey; detail: DetailState | null } {
  const params = new URLSearchParams(window.location.search);

  const detailChecks: { type: DetailType; found: boolean; id: string }[] = [
    { type: "visit", found: Boolean(getVisit(params.get("visit"))), id: params.get("visit") ?? "" },
    {
      type: "prescription",
      found: Boolean(getPrescription(params.get("prescription"))),
      id: params.get("prescription") ?? "",
    },
    { type: "lab", found: Boolean(getLabResult(params.get("lab"))), id: params.get("lab") ?? "" },
    {
      type: "imaging",
      found: Boolean(getImagingResult(params.get("imaging"))),
      id: params.get("imaging") ?? "",
    },
    {
      type: "report",
      found: Boolean(getMedicalReport(params.get("report"))),
      id: params.get("report") ?? "",
    },
  ];

  const detail = detailChecks.find((check) => check.found);
  if (detail) {
    return { tab: DETAIL_PARENT[detail.type], detail: { type: detail.type, id: detail.id } };
  }

  const tabParam = params.get("tab");
  return { tab: isTabKey(tabParam) ? tabParam : "overview", detail: null };
}

/* ------------------------------------------------------------------ */
/* List state                                                          */
/* ------------------------------------------------------------------ */

type ListState = {
  query: string;
  filters: RecordFilters;
  sort: SortOrder;
  filterOpen: boolean;
  category: DocumentCategory | "All";
};

const DEFAULT_LIST_STATE: ListState = {
  query: "",
  filters: EMPTY_RECORD_FILTERS,
  sort: "newest",
  filterOpen: false,
  category: "All",
};

const OVERVIEW_STATUSES = [
  "Completed",
  "Active",
  "Normal",
  "Abnormal",
  "Patient Uploaded",
  "Clinically Reviewed",
  "Awaiting Review",
];

const VISIT_STATUSES = ["Completed", "Cancelled", "Scheduled"];
const PRESCRIPTION_STATUSES = ["Active", "Completed"];
const LAB_STATUSES = ["Normal", "Abnormal"];
const IMAGING_STATUSES = ["Completed"];

const TAB_BACK_LABEL: Record<MedicalTab, string> = {
  overview: "Back to Medical Records",
  visits: "Back to Visits",
  prescriptions: "Back to Prescriptions",
  "lab-results": "Back to Lab Results",
  imaging: "Back to Imaging",
  documents: "Back to Documents",
  reports: "Back to Medical Reports",
};

const DETAIL_BACK_LABEL: Record<DetailType, string> = {
  visit: "Back to Visit",
  prescription: "Back to Prescription",
  lab: "Back to Lab Result",
  imaging: "Back to Imaging Result",
  report: "Back to Medical Report",
};

type BackTarget = {
  tab: PageKey;
  detail: DetailState | null;
  label: string;
};

/* ------------------------------------------------------------------ */
/* Module                                                              */
/* ------------------------------------------------------------------ */

export function MedicalRecordsModule() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<PageKey>("overview");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [originTab, setOriginTab] = useState<MedicalTab>("overview");
  const [backStack, setBackStack] = useState<BackTarget[]>([]);

  const [documents, setDocuments] = useState<MedicalDocument[]>(seedDocuments);
  const [selectedKey, setSelectedKey] = useState("visit:v-general");
  const [lists, setLists] = useState<Record<string, ListState>>({});
  const [previewFile, setPreviewFile] = useState<MedicalFile | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | null>(null);

  /* ------------------------------ toast ------------------------------ */

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  /* ------------------------------ URL sync --------------------------- */

  const applyFromUrl = useCallback(() => {
    const next = parseUrl();
    setTab(next.tab);
    setDetail(next.detail);
    setBackStack([]);
    if (next.detail) setOriginTab(DETAIL_PARENT[next.detail.type]);
  }, []);

  useEffect(() => {
    applyFromUrl();
    setReady(true);

    const onPopState = () => applyFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyFromUrl]);

  const pushUrl = useCallback(
    (next: { tab: PageKey; detail?: DetailState | null }) => {
      const params = new URLSearchParams();
      if (next.tab !== "overview") params.set("tab", next.tab);
      if (next.detail) params.set(DETAIL_PARAM[next.detail.type], next.detail.id);
      const query = params.toString();
      window.history.pushState(
        {},
        "",
        query ? `${window.location.pathname}?${query}` : window.location.pathname,
      );
    },
    [],
  );

  const goToTab = useCallback(
    (nextTab: MedicalTab) => {
      setTab(nextTab);
      setDetail(null);
      setBackStack([]);
      pushUrl({ tab: nextTab });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
    [pushUrl],
  );

  const openDetail = useCallback(
    (type: DetailType, id: string, origin: MedicalTab) => {
      // Only reset the origin when entering a detail screen from a list.
      if (!detail) setOriginTab(origin);
      if (detail) {
        setBackStack((stack) => [
          ...stack,
          {
            tab: DETAIL_PARENT[detail.type],
            detail,
            label: DETAIL_BACK_LABEL[detail.type],
          },
        ]);
      }
      setTab(DETAIL_PARENT[type]);
      setDetail({ type, id });
      pushUrl({ tab: DETAIL_PARENT[type], detail: { type, id } });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
    [detail, pushUrl],
  );

  const closeDetail = useCallback(() => {
    const target = backStack[backStack.length - 1];
    if (target) {
      setBackStack(backStack.slice(0, -1));
      setTab(target.tab);
      setDetail(target.detail);
      pushUrl({ tab: target.tab, detail: target.detail });
    } else {
      setDetail(null);
      setTab(originTab);
      pushUrl({ tab: originTab });
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [backStack, originTab, pushUrl]);

  const goToUpload = useCallback(() => {
    setTab("upload");
    setDetail(null);
    setBackStack([]);
    pushUrl({ tab: "upload" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pushUrl]);

  /* ------------------------------ lists ------------------------------ */

  const listState = useCallback(
    (key: string): ListState => lists[key] ?? DEFAULT_LIST_STATE,
    [lists],
  );

  const updateList = useCallback((key: string, patch: Partial<ListState>) => {
    setLists((current) => ({
      ...current,
      [key]: { ...(current[key] ?? DEFAULT_LIST_STATE), ...patch },
    }));
  }, []);

  /* ------------------------------ data ------------------------------- */

  const entries = useMemo(() => buildRecordEntries(documents), [documents]);

  const counts: MedicalCounts = useMemo(
    () => ({
      overview: entries.length,
      // Approved reference shows Total Records as visits + prescriptions + labs.
      total: visits.length + prescriptions.length + labResults.length,
      visits: visits.length,
      prescriptions: prescriptions.length,
      "lab-results": labResults.length,
      imaging: imagingResults.length,
      documents: documents.length,
      reports: medicalReports.length,
    }),
    [documents.length, entries.length],
  );

  const filtered = useCallback(
    (source: MedicalRecordEntry[], key: string): MedicalRecordEntry[] => {
      const state = listState(key);
      const needle = state.query.trim().toLowerCase();

      return source
        .filter(
          (entry) =>
            !needle ||
            entry.searchText.includes(needle) ||
            entry.type.includes(needle),
        )
        .filter((entry) => state.filters.status === "all" || entry.status === state.filters.status)
        .filter((entry) => isWithinRange(entry.date, state.filters.range))
        .sort((a, b) => {
          const compare = a.date.localeCompare(b.date);
          if (compare !== 0) return state.sort === "newest" ? -compare : compare;
          return state.sort === "newest" ? (b.time ?? "").localeCompare(a.time ?? "") : 0;
        });
    },
    [listState],
  );

  const overviewEntries = useMemo(() => filtered(entries, "overview"), [entries, filtered]);
  const visitEntries = useMemo(
    () => filtered(entries.filter((entry) => entry.type === "visit"), "visits"),
    [entries, filtered],
  );
  const prescriptionEntries = useMemo(
    () => filtered(entries.filter((entry) => entry.type === "prescription"), "prescriptions"),
    [entries, filtered],
  );
  const labEntries = useMemo(
    () => filtered(entries.filter((entry) => entry.type === "lab"), "lab-results"),
    [entries, filtered],
  );
  const imagingEntries = useMemo(
    () => filtered(entries.filter((entry) => entry.type === "imaging"), "imaging"),
    [entries, filtered],
  );

  /* ------------------------------ actions ---------------------------- */

  const openEntry = useCallback(
    (entry: MedicalRecordEntry) => {
      const origin: MedicalTab = tab === "upload" ? "overview" : tab;
      if (entry.type === "document") {
        const document = documents.find((item) => item.id === entry.id);
        if (document) setPreviewFile(document);
        return;
      }
      if (entry.type === "report") {
        openDetail("report", entry.id, origin === "overview" ? "overview" : "reports");
        return;
      }
      openDetail(entry.type as DetailType, entry.id, origin);
    },
    [documents, openDetail, tab],
  );

  const downloadFile = useCallback(
    (file: MedicalFile) => {
      downloadTextFile(
        `${file.name.replace(/\.[^.]+$/, "")}-demo.txt`,
        demoExport(file.name, [
          `Category: ${file.category}`,
          `Date: ${file.date}`,
          `File type: ${file.fileType}`,
          `Size: ${file.size}`,
          "Source: patient dashboard demo",
          "",
          "This is a demo export. The original clinical file was not retrieved.",
        ]),
      );
      notify("Demo file downloaded. No clinical file was transferred.", "info");
    },
    [notify],
  );

  const downloadDocument = useCallback(
    (document: MedicalDocument) => {
      downloadTextFile(
        `${document.name.replace(/\.[^.]+$/, "")}-demo.txt`,
        demoExport(document.name, [
          `Category: ${document.category}`,
          `Date: ${document.date}`,
          `File type: ${document.fileType}`,
          `Size: ${document.size}`,
          `Status: ${document.status}`,
          document.source === "patient" ? "Uploaded by you" : "Shared by your care team",
          "",
          "This is a demo export. The original document was not retrieved from a server.",
        ]),
      );
      notify("Demo document downloaded. No clinical file was transferred.", "info");
    },
    [notify],
  );

  const downloadReport = useCallback(
    (report: MedicalReport) => {
      downloadTextFile(
        `${report.title.replace(/\s+/g, "-").toLowerCase()}-demo.txt`,
        demoExport(report.title, [
          `Date: ${report.date}`,
          `Specialty: ${report.specialty}`,
          `Facility: ${report.facility}`,
          `Status: ${report.status}`,
          "",
          ...report.sections.flatMap((section) => [
            section.heading.toUpperCase(),
            section.body,
            "",
          ]),
        ]),
      );
      notify("Report downloaded as a demo text file.", "info");
    },
    [notify],
  );

  const removeDocument = useCallback(
    (document: MedicalDocument) => {
      if (document.previewUrl) URL.revokeObjectURL(document.previewUrl);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      if (previewFile?.id === document.id) setPreviewFile(null);
      if (selectedKey === `document:${document.id}`) setSelectedKey("visit:v-general");
      notify("Document removed from this demo session.", "success");
    },
    [notify, previewFile?.id, selectedKey],
  );

  const handleUploaded = useCallback(
    (document: MedicalDocument) => {
      setDocuments((current) => [document, ...current]);
      updateList("documents", { query: "", filters: EMPTY_RECORD_FILTERS, category: "All" });
      setSelectedKey(`document:${document.id}`);
      setTab("documents");
      setDetail(null);
      setBackStack([]);
      pushUrl({ tab: "documents" });
      notify(
        "Document added to this demo session. It is not stored on the Medora server.",
        "success",
      );
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
    [notify, pushUrl, updateList],
  );

  const bookFollowUp = useCallback(() => {
    notify("Opening appointment booking. No follow-up appointment is confirmed yet.", "info");
    router.push("/patient/appointments?view=book");
  }, [notify, router]);

  /* ------------------------------ preview handlers ------------------- */

  const handlers: RecordPreviewHandlers = useMemo(
    () => ({
      onOpenFull: (entry) => openEntry(entry),
      onOpenVisit: (id) => openDetail("visit", id, tab === "overview" ? "overview" : "visits"),
      onOpenPrescription: (id) =>
        openDetail("prescription", id, tab === "overview" ? "overview" : "prescriptions"),
      onOpenLab: (id) => openDetail("lab", id, tab === "overview" ? "overview" : "lab-results"),
      onOpenImaging: (id) =>
        openDetail("imaging", id, tab === "overview" ? "overview" : "imaging"),
      onViewReport: (id) => openDetail("report", id, tab === "overview" ? "overview" : "reports"),
      onPreviewDocument: (document) => setPreviewFile(document),
      onDownloadDocument: downloadDocument,
      onDownloadReport: downloadReport,
      onOpenFile: (file) => setPreviewFile(file),
      onBookFollowUp: bookFollowUp,
      onToast: (message) => notify(message, "info"),
    }),
    [bookFollowUp, downloadDocument, downloadReport, notify, openDetail, openEntry, tab],
  );

  /* ------------------------------ render ----------------------------- */

  if (!ready) return <MedicalRecordsSkeleton />;

  const uploadButton = (
    <button
      type="button"
      onClick={goToUpload}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A9189] px-3 text-[10.5px] font-semibold text-white shadow-[0_10px_24px_-16px_rgba(10,145,137,0.9)] transition hover:bg-[#087F78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
    >
      <Upload size={13} aria-hidden />
      Upload Document
    </button>
  );

  const detailBack = () => (
    <BackLink
      label={
        backStack.length > 0
          ? backStack[backStack.length - 1].label
          : TAB_BACK_LABEL[originTab]
      }
      onClick={closeDetail}
    />
  );

  /* Detail screens ---------------------------------------------------- */

  if (detail) {
    if (detail.type === "visit") {
      const visit = getVisit(detail.id);
      if (!visit) {
        return (
          <MissingRecord
            onBack={closeDetail}
            message="This visit could not be found in your records."
          />
        );
      }
      return (
        <div className="space-y-2.5">
          {detailBack()}
          <VisitView
            visit={visit}
            onOpenPrescription={(id) => openDetail("prescription", id, "visits")}
            onOpenLab={(id) => openDetail("lab", id, "visits")}
            onOpenFile={(file) => setPreviewFile(file)}
            onViewReport={(id) => openDetail("report", id, "visits")}
            onBookFollowUp={bookFollowUp}
            onToast={(message) => notify(message, "info")}
          />
          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
      );
    }

    if (detail.type === "prescription") {
      const prescription = getPrescription(detail.id);
      if (!prescription) {
        return (
          <MissingRecord
            onBack={closeDetail}
            message="This prescription could not be found in your records."
          />
        );
      }
      return (
        <div className="space-y-2.5">
          {detailBack()}
          <PrescriptionView
            prescription={prescription}
            onOpenVisit={(id) => openDetail("visit", id, "prescriptions")}
            onToast={(message) => notify(message, "info")}
          />
          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
      );
    }

    if (detail.type === "lab") {
      const lab = getLabResult(detail.id);
      if (!lab) {
        return (
          <MissingRecord
            onBack={closeDetail}
            message="This lab result could not be found in your records."
          />
        );
      }
      return (
        <div className="space-y-2.5">
          {detailBack()}
          <LabResultView
            lab={lab}
            onOpenVisit={(id) => openDetail("visit", id, "lab-results")}
            onToast={(message) => notify(message, "info")}
          />
          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
      );
    }

    if (detail.type === "imaging") {
      const imaging = getImagingResult(detail.id);
      if (!imaging) {
        return (
          <MissingRecord
            onBack={closeDetail}
            message="This imaging result could not be found in your records."
          />
        );
      }
      return (
        <div className="space-y-2.5">
          {detailBack()}
          <ImagingView
            imaging={imaging}
            onOpenVisit={(id) => openDetail("visit", id, "imaging")}
            onToast={(message) => notify(message, "info")}
          />
          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
      );
    }

    const report = getMedicalReport(detail.id);
    if (!report) {
      return (
        <MissingRecord
          onBack={closeDetail}
          message="This medical report could not be found in your records."
        />
      );
    }
    return (
      <div>
        <ReportDetail
          report={report}
          onBack={closeDetail}
          backLabel={
            backStack.length > 0
              ? backStack[backStack.length - 1].label
              : TAB_BACK_LABEL[originTab]
          }
          onOpenVisit={(id) => openDetail("visit", id, "reports")}
          onToast={(message) => notify(message, "info")}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  /* Upload screen ----------------------------------------------------- */

  if (tab === "upload") {
    return (
      <div>
        <UploadDocument onBack={() => goToTab("overview")} onUploaded={handleUploaded} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  /* Category + overview screens --------------------------------------- */

  const pageTitle =
    tab === "reports"
      ? "My Medical Reports"
      : tab === "documents"
        ? "Medical Documents"
        : "Medical Records";

  const pageSubtitle =
    tab === "reports"
      ? "Reports prepared and approved by your doctor."
      : tab === "documents"
        ? "Files you uploaded and documents shared by your care team."
        : "Your complete medical history in one place.";

  return (
    <div className="space-y-3.5">
      <MedicalRecordsHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        action={tab === "reports" || tab === "documents" ? undefined : uploadButton}
      />

      {tab === "overview" && (
        <MedicalRecordsStats counts={counts} onNavigate={goToTab} />
      )}

      <MedicalRecordsTabs
        active={tab}
        counts={counts}
        onSelect={(nextTab) => goToTab(nextTab)}
      />

      {tab === "overview" && (
        <RevealOnScroll
          y={16}
          className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
        >
          <RecordListCard
            title="Medical Records"
            entries={overviewEntries}
            mode="preview"
            selectedKey={selectedKey}
            onSelect={(entry) => setSelectedKey(entry.key)}
            onOpen={openEntry}
            sort={listState("overview").sort}
            onSortChange={(sort) => updateList("overview", { sort })}
            query={listState("overview").query}
            onQueryChange={(query) => updateList("overview", { query })}
            filters={listState("overview").filters}
            onFiltersChange={(filters) => updateList("overview", { filters })}
            filterOpen={listState("overview").filterOpen}
            onFilterOpenChange={(filterOpen) => updateList("overview", { filterOpen })}
            statusOptions={OVERVIEW_STATUSES}
            emptyTitle="No records match your search"
            emptyDescription="Try a different search term, date range or status."
            listMaxHeight="600px"
          />

          <div className="min-w-0">
            <RecordPreview
              entry={entries.find((entry) => entry.key === selectedKey) ?? null}
              documents={documents}
              handlers={handlers}
            />
          </div>
        </RevealOnScroll>
      )}

      {tab === "visits" && (
        <RecordListCard
          title="Medical Visits"
          entries={visitEntries}
          mode="navigate"
          onOpen={openEntry}
          sort={listState("visits").sort}
          onSortChange={(sort) => updateList("visits", { sort })}
          query={listState("visits").query}
          onQueryChange={(query) => updateList("visits", { query })}
          filters={listState("visits").filters}
          onFiltersChange={(filters) => updateList("visits", { filters })}
          filterOpen={listState("visits").filterOpen}
          onFilterOpenChange={(filterOpen) => updateList("visits", { filterOpen })}
          statusOptions={VISIT_STATUSES}
          emptyTitle="No visits found"
          emptyDescription="Try adjusting your search, date range or status filter."
        />
      )}

      {tab === "prescriptions" && (
        <RecordListCard
          title="Prescriptions"
          entries={prescriptionEntries}
          mode="navigate"
          onOpen={openEntry}
          sort={listState("prescriptions").sort}
          onSortChange={(sort) => updateList("prescriptions", { sort })}
          query={listState("prescriptions").query}
          onQueryChange={(query) => updateList("prescriptions", { query })}
          filters={listState("prescriptions").filters}
          onFiltersChange={(filters) => updateList("prescriptions", { filters })}
          filterOpen={listState("prescriptions").filterOpen}
          onFilterOpenChange={(filterOpen) => updateList("prescriptions", { filterOpen })}
          statusOptions={PRESCRIPTION_STATUSES}
          emptyTitle="No prescriptions found"
          emptyDescription="Try adjusting your search, date range or status filter."
        />
      )}

      {tab === "lab-results" && (
        <RecordListCard
          title="Lab Results"
          entries={labEntries}
          mode="navigate"
          onOpen={openEntry}
          sort={listState("lab-results").sort}
          onSortChange={(sort) => updateList("lab-results", { sort })}
          query={listState("lab-results").query}
          onQueryChange={(query) => updateList("lab-results", { query })}
          filters={listState("lab-results").filters}
          onFiltersChange={(filters) => updateList("lab-results", { filters })}
          filterOpen={listState("lab-results").filterOpen}
          onFilterOpenChange={(filterOpen) => updateList("lab-results", { filterOpen })}
          statusOptions={LAB_STATUSES}
          emptyTitle="No lab results found"
          emptyDescription="Try adjusting your search, date range or status filter."
        />
      )}

      {tab === "imaging" && (
        <RecordListCard
          title="Imaging"
          entries={imagingEntries}
          mode="navigate"
          onOpen={openEntry}
          sort={listState("imaging").sort}
          onSortChange={(sort) => updateList("imaging", { sort })}
          query={listState("imaging").query}
          onQueryChange={(query) => updateList("imaging", { query })}
          filters={listState("imaging").filters}
          onFiltersChange={(filters) => updateList("imaging", { filters })}
          filterOpen={listState("imaging").filterOpen}
          onFilterOpenChange={(filterOpen) => updateList("imaging", { filterOpen })}
          statusOptions={IMAGING_STATUSES}
          emptyTitle="No imaging records found"
          emptyDescription="Try adjusting your search or date range."
        />
      )}

      {tab === "documents" && (
        <DocumentsView
          documents={documents}
          query={listState("documents").query}
          onQueryChange={(query) => updateList("documents", { query })}
          filters={listState("documents").filters}
          onFiltersChange={(filters) => updateList("documents", { filters })}
          filterOpen={listState("documents").filterOpen}
          onFilterOpenChange={(filterOpen) => updateList("documents", { filterOpen })}
          sort={listState("documents").sort}
          onSortChange={(sort) => updateList("documents", { sort })}
          category={listState("documents").category}
          onCategoryChange={(category) => updateList("documents", { category })}
          onPreview={(document) => setPreviewFile(document)}
          onDownload={downloadDocument}
          onDelete={removeDocument}
          onUpload={goToUpload}
        />
      )}

      {tab === "reports" && (
        <ReportsList
          reports={medicalReports}
          onView={(id) => openDetail("report", id, "reports")}
          onOpenVisit={(id) => openDetail("visit", id, "reports")}
          onDownload={downloadReport}
        />
      )}

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={(file) => downloadFile(file)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Supporting states                                                   */
/* ------------------------------------------------------------------ */

function MissingRecord({
  onBack,
  message,
}: {
  onBack: () => void;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E6EFEE] bg-white p-4">
      <EmptyState
        icon={FileQuestion}
        title="Record unavailable"
        description={`${message} It may have been removed, or you may not have access to it.`}
        action={
          <button
            type="button"
            onClick={onBack}
            className="h-8 rounded-lg border border-[#E6EFEE] px-3 text-[10px] font-semibold text-[#5B6B7C] transition hover:border-[#BFE8E2] hover:text-[#0A9189]"
          >
            Back to Medical Records
          </button>
        }
      />
    </div>
  );
}

function MedicalRecordsSkeleton() {
  return (
    <div className="space-y-3.5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading medical records</span>
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-[#E8F1F0]" />
        <div className="h-3 w-72 animate-pulse rounded bg-[#EEF5F4]" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-[68px] animate-pulse rounded-2xl border border-[#E6EFEE] bg-white"
          />
        ))}
      </div>
      <div className="h-11 animate-pulse rounded-xl border border-[#E6EFEE] bg-white" />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="h-[420px] animate-pulse rounded-2xl border border-[#E6EFEE] bg-white" />
        <div className="h-[420px] animate-pulse rounded-2xl border border-[#E6EFEE] bg-white" />
      </div>
    </div>
  );
}

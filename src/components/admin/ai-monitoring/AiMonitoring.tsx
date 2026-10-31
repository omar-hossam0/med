"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import {
  AI_RANGE_OPTIONS,
  aiReports,
  filterReportsByRange,
  formatRangeLabel,
  getDailySeries,
  getDoctorRanking,
  getOperationalActivities,
  getRangeBounds,
  getServiceHealth,
  inRange,
  summarizeReports,
  type AiRangeKey,
  type AiReport,
} from "@/lib/mock/aiMonitoring";
import { AiMonitoringKpis } from "./AiMonitoringKpis";
import { ReportsOverviewChart } from "./ReportsOverviewChart";
import {
  ProcessingHealthPanel,
  RecentActivityPanel,
  TopDoctorsPanel,
} from "./MonitoringPanels";
import { ReportsTable } from "./ReportsTable";
import { ReportDetailsDrawer } from "./ReportDetailsDrawer";
import { ActivityDrawer } from "./ActivityDrawer";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { DemoChip, RangeSelect } from "./ui";

type DrawerTab = "details" | "timeline";

export function AiMonitoring() {
  const [range, setRange] = useState<AiRangeKey>("30d");
  const [chartRange, setChartRange] = useState<AiRangeKey>("30d");
  const [doctorRange, setDoctorRange] = useState<AiRangeKey>("30d");
  const [toast, setToast] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("details");
  const [selectedReport, setSelectedReport] = useState<AiReport | null>(null);

  const periodReports = useMemo(() => filterReportsByRange(aiReports, range), [range]);
  const chartReports = useMemo(
    () => filterReportsByRange(aiReports, chartRange),
    [chartRange],
  );
  const doctorReports = useMemo(
    () => filterReportsByRange(aiReports, doctorRange),
    [doctorRange],
  );

  const previousReports = useMemo(() => {
    const { prevStart, prevEnd } = getRangeBounds(range);
    return aiReports.filter((report) => inRange(report, prevStart, prevEnd));
  }, [range]);

  const summary = useMemo(() => summarizeReports(periodReports), [periodReports]);
  const previousSummary = useMemo(
    () => summarizeReports(previousReports),
    [previousReports],
  );
  const health = useMemo(
    () => getServiceHealth(aiReports, periodReports),
    [periodReports],
  );
  const activities = useMemo(() => getOperationalActivities(aiReports), []);
  const doctorRanking = useMemo(() => getDoctorRanking(doctorReports), [doctorReports]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleRangeChange = (next: AiRangeKey) => {
    setRange(next);
    setChartRange(next);
    setDetailsOpen(false);
  };

  const openReport = (report: AiReport, tab: DrawerTab) => {
    setSelectedReport(report);
    setDrawerTab(tab);
    setDetailsOpen(true);
  };

  const exportReport = () => {
    const daily = getDailySeries(periodReports, range);
    const ranking = getDoctorRanking(periodReports);
    const rows: (string | number)[][] = [
      ["Medora AI Reports Monitoring — Demo Export"],
      ["Reporting period", formatRangeLabel(range)],
      ["Data source", "Frontend demo dataset (not live telemetry)"],
      [],
      ["Summary"],
      ["Generated report records", summary.total],
      ["Awaiting doctor review", summary.awaiting],
      ["Approved by doctors", summary.approved],
      ["Processing failures", summary.failures],
      ["Draft / other workflow records", summary.drafts],
      ["Successful jobs", summary.successes],
      ["Average processing time (seconds)", health.averageSeconds],
      ["Success rate", `${health.successRate.toFixed(1)}%`],
      ["Queue length", health.queueLength],
      [],
      ["Daily metrics"],
      ["Date", "Generated", "Approved", "Awaiting Review", "Failed"],
      ...daily.map((point) => [
        point.fullLabel,
        point.generated,
        point.approved,
        point.awaiting,
        point.failed,
      ]),
      [],
      ["Doctor activity (AI-assisted report volume)"],
      ["Doctor", "Department", "Reports"],
      ...ranking.map((entry) => [entry.doctor.name, entry.doctor.department, entry.count]),
    ];

    downloadCsv(`medora-ai-monitoring-${range}.csv`, rows);
    setToast("Demo export downloaded — nonclinical metrics only");
  };

  return (
    <div className="min-w-0 space-y-3">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#0F2D4A]">
              AI Reports Monitoring
            </h1>
            <DemoChip />
          </div>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#7A8B9C]">
            Monitor AI-generated medical reports, track processing status, and ensure smooth
            operation of the AI system.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RangeSelect
            value={range}
            options={AI_RANGE_OPTIONS}
            onChange={handleRangeChange}
            label="Reporting period"
            display={formatRangeLabel(range)}
            icon={CalendarDays}
          />
          <button
            type="button"
            onClick={exportReport}
            title="Download nonclinical operational metrics as a demo CSV"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#0A9189] px-3.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#087F78] focus-visible:ring-2 focus-visible:ring-[#0A9189]/30"
          >
            <Download size={14} />
            Export Report
          </button>
        </div>
      </div>

      <RevealOnScroll y={14}>
        <AiMonitoringKpis
          summary={summary}
          previous={previousSummary}
          serviceState={health.state}
        />
      </RevealOnScroll>

      <RevealOnScroll
        y={16}
        className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_268px]"
      >
        <div className="min-w-0 space-y-3">
          <ReportsOverviewChart
            periodReports={chartReports}
            range={chartRange}
            onRangeChange={setChartRange}
          />
          <ReportsTable
            periodReports={periodReports}
            range={range}
            onRangeChange={handleRangeChange}
            onView={openReport}
            onNotify={setToast}
          />
        </div>

        <div className="min-w-0 space-y-3">
          <ProcessingHealthPanel health={health} />
          <RecentActivityPanel
            activities={activities}
            onSeeAll={() => setActivityOpen(true)}
          />
          <TopDoctorsPanel
            ranking={doctorRanking}
            range={doctorRange}
            onRangeChange={setDoctorRange}
          />
        </div>
      </RevealOnScroll>

      <ReportDetailsDrawer
        report={selectedReport}
        open={detailsOpen}
        initialTab={drawerTab}
        onClose={() => setDetailsOpen(false)}
      />
      <ActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        activities={activities}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-[#0F2D4A] px-4 py-2 text-[11.5px] font-medium text-white shadow-pop"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

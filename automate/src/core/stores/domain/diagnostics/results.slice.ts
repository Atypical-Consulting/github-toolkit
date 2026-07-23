import type { StateCreator } from "zustand";
import { log } from "@/core/stores/log";
import type { DiagnosticsStore } from "./index";

export interface RepoHealthReport {
  repoFullName: string;
  owner: string;
  repoName: string;
  healthScore: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  results: DiagnosticResult[];
  scannedAt: string;
}

export interface DiagnosticResult {
  ruleId: string;
  ruleName: string;
  severity: "critical" | "warning" | "info";
  passed: boolean;
  message: string;
}

export interface ResultsSlice {
  reports: Record<string, RepoHealthReport>;
  diagnosticsCacheLoaded: boolean;
  setReports: (reports: RepoHealthReport[]) => void;
  updateReport: (report: RepoHealthReport) => void;
  loadCachedDiagnostics: () => Promise<void>;
  loadReportForRepo: (repoFullName: string) => Promise<void>;
  getReportForRepo: (fullName: string) => RepoHealthReport | undefined;
  getHealthDistribution: () => {
    healthy: number;
    warning: number;
    critical: number;
  };
}

export const createResultsSlice: StateCreator<
  DiagnosticsStore,
  [["zustand/devtools", never]],
  [],
  ResultsSlice
> = (set, get) => ({
  reports: {},
  diagnosticsCacheLoaded: false,

  setReports: (reports) => {
    const record: Record<string, RepoHealthReport> = {};
    for (const report of reports) {
      record[report.repoFullName] = report;
    }
    set({ reports: record }, undefined, "results/set");
  },

  updateReport: (report) => {
    set(
      (state) => ({
        reports: { ...state.reports, [report.repoFullName]: report },
      }),
      undefined,
      "results/updateOne",
    );
  },

  loadCachedDiagnostics: async () => {
    try {
      const { commands } = await import("@/bindings");
      const result = await commands.loadAllDiagnostics();
      if (result.status === "ok" && result.data.length > 0) {
        const record: Record<string, RepoHealthReport> = {};
        for (const report of result.data) {
          record[report.repoFullName] = report;
        }
        set(
          { reports: record, diagnosticsCacheLoaded: true },
          undefined,
          "results/loadCache",
        );
        log.info("diagnostics", `Loaded ${result.data.length} cached reports`);
      } else {
        set(
          { diagnosticsCacheLoaded: true },
          undefined,
          "results/loadCache/empty",
        );
      }
    } catch (e) {
      set(
        { diagnosticsCacheLoaded: true },
        undefined,
        "results/loadCache/error",
      );
      log.warn("diagnostics", `Cache load failed: ${String(e)}`);
    }
  },

  loadReportForRepo: async (repoFullName) => {
    if (get().reports[repoFullName]) return;
    try {
      const { commands } = await import("@/bindings");
      const result = await commands.getRepoDiagnostics(repoFullName);
      if (result.status === "ok" && result.data) {
        const report = result.data;
        set(
          (state) => ({
            reports: { ...state.reports, [repoFullName]: report },
          }),
          undefined,
          "results/loadForRepo",
        );
      }
    } catch (e) {
      log.warn(
        "diagnostics",
        `Failed to load report for ${repoFullName}: ${String(e)}`,
      );
    }
  },

  getReportForRepo: (fullName) => {
    return get().reports[fullName];
  },

  getHealthDistribution: () => {
    const reports = Object.values(get().reports);
    return {
      healthy: reports.filter((r) => r.healthScore >= 80).length,
      warning: reports.filter((r) => r.healthScore >= 40 && r.healthScore < 80)
        .length,
      critical: reports.filter((r) => r.healthScore < 40).length,
    };
  },
});

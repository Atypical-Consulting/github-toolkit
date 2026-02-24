import type { StateCreator } from "zustand";
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
  reports: Map<string, RepoHealthReport>;
  diagnosticsCacheLoaded: boolean;
  setReports: (reports: RepoHealthReport[]) => void;
  updateReport: (report: RepoHealthReport) => void;
  loadCachedDiagnostics: () => Promise<void>;
  getReportForRepo: (fullName: string) => RepoHealthReport | undefined;
  getHealthDistribution: () => { healthy: number; warning: number; critical: number };
}

export const createResultsSlice: StateCreator<
  DiagnosticsStore,
  [["zustand/devtools", never]],
  [],
  ResultsSlice
> = (set, get) => ({
  reports: new Map(),
  diagnosticsCacheLoaded: false,

  setReports: (reports) => {
    const map = new Map<string, RepoHealthReport>();
    for (const report of reports) {
      map.set(report.repoFullName, report);
    }
    set({ reports: map }, undefined, "results/set");
  },

  updateReport: (report) => {
    const current = new Map(get().reports);
    current.set(report.repoFullName, report);
    set({ reports: current }, undefined, "results/updateOne");
  },

  loadCachedDiagnostics: async () => {
    try {
      const { commands } = await import("@/bindings");
      const result = await commands.loadAllDiagnostics();
      if (result.status === "ok" && result.data.length > 0) {
        const map = new Map<string, RepoHealthReport>();
        for (const report of result.data) {
          map.set(report.repoFullName, report);
        }
        set({ reports: map, diagnosticsCacheLoaded: true }, undefined, "results/loadCache");
      } else {
        set({ diagnosticsCacheLoaded: true }, undefined, "results/loadCache/empty");
      }
    } catch {
      set({ diagnosticsCacheLoaded: true }, undefined, "results/loadCache/error");
    }
  },

  getReportForRepo: (fullName) => {
    return get().reports.get(fullName);
  },

  getHealthDistribution: () => {
    const reports = Array.from(get().reports.values());
    return {
      healthy: reports.filter((r) => r.healthScore >= 80).length,
      warning: reports.filter((r) => r.healthScore >= 40 && r.healthScore < 80).length,
      critical: reports.filter((r) => r.healthScore < 40).length,
    };
  },
});

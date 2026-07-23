import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { log } from "@/core/stores/log";

export interface BacklogItem {
  id: string;
  repoFullName: string;
  source: string;
  sourceRef: string | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  priorityScore: number;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BacklogFilters {
  owner: string | null;
  repo: string | null;
  severity: string | null;
  status: string | null;
  source: string | null;
}

interface BacklogStore {
  items: BacklogItem[];
  isLoading: boolean;
  isGenerating: boolean;
  isCreatingIssue: boolean;
  error: string | null;
  filters: BacklogFilters;
  loadItems: () => Promise<void>;
  generateFromScan: (reports: any[]) => Promise<void>;
  createFromDiagnostic: (baseReport: any, failedResult: any) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
  createGitHubIssue: (itemId: string) => Promise<void>;
  setFilter: (key: keyof BacklogFilters, value: string | null) => void;
  clearFilters: () => void;
}

const defaultFilters: BacklogFilters = {
  owner: null,
  repo: null,
  severity: null,
  status: null,
  source: null,
};

export const useBacklogStore = create<BacklogStore>()(
  devtools(
    (set, get) => ({
      items: [],
      isLoading: false,
      isGenerating: false,
      isCreatingIssue: false,
      error: null,
      filters: { ...defaultFilters },

      loadItems: async () => {
        set({ isLoading: true, error: null }, undefined, "backlog/load");
        try {
          const { commands } = await import("@/bindings");
          const result = await commands.listBacklog(get().filters);
          if (result.status === "ok") {
            set(
              { items: result.data as BacklogItem[], isLoading: false },
              undefined,
              "backlog/load/ok",
            );
          } else {
            set(
              { error: "Failed to load backlog", isLoading: false },
              undefined,
              "backlog/load/error",
            );
            log.error("backlog", "Failed to load backlog items");
          }
        } catch (e) {
          set(
            { error: String(e), isLoading: false },
            undefined,
            "backlog/load/error",
          );
          log.error("backlog", `Load error: ${String(e)}`);
        }
      },

      generateFromScan: async (reports) => {
        if (get().isGenerating) {
          log.warn("backlog", "Generation already in progress");
          return;
        }
        set({ isGenerating: true, error: null }, undefined, "backlog/generate");
        log.info(
          "backlog",
          `Generating backlog from ${reports.length} reports...`,
        );
        try {
          const { commands } = await import("@/bindings");
          const result = await commands.generateBacklogFromScan(reports);
          if (result.status === "ok") {
            const newItems = result.data as BacklogItem[];
            set({ isGenerating: false }, undefined, "backlog/generate/ok");
            await get().loadItems();
            log.success(
              "backlog",
              `Generated ${newItems.length} new backlog items`,
            );
          } else {
            set({ isGenerating: false }, undefined, "backlog/generate/error");
            log.error("backlog", "Failed to generate backlog");
          }
        } catch (e) {
          set(
            { error: String(e), isGenerating: false },
            undefined,
            "backlog/generate/error",
          );
          log.error("backlog", `Generate error: ${String(e)}`);
        }
      },

      createFromDiagnostic: async (baseReport, failedResult) => {
        try {
          const { commands } = await import("@/bindings");
          const miniReport = {
            repoFullName: baseReport.repoFullName,
            owner: baseReport.owner,
            repoName: baseReport.repoName,
            healthScore: baseReport.healthScore,
            criticalCount: baseReport.criticalCount,
            warningCount: baseReport.warningCount,
            infoCount: baseReport.infoCount,
            results: [failedResult],
            scannedAt: baseReport.scannedAt,
          };
          const res = await commands.generateBacklogFromScan([miniReport]);
          if (res.status === "ok") {
            await get().loadItems();
            log.success(
              "backlog",
              `Created backlog item for "${failedResult.ruleName}"`,
            );
          }
        } catch (e) {
          log.error("backlog", `Failed to create item: ${String(e)}`);
        }
      },

      updateStatus: async (id, status) => {
        try {
          const { commands } = await import("@/bindings");
          await commands.updateBacklogItemStatus(id, status);
          await get().loadItems();
          log.info("backlog", `Status updated to "${status}"`);
        } catch (e) {
          set({ error: String(e) }, undefined, "backlog/updateStatus/error");
          log.error("backlog", `Status update error: ${String(e)}`);
        }
      },

      createGitHubIssue: async (itemId) => {
        if (get().isCreatingIssue) {
          log.warn("backlog", "Issue creation already in progress");
          return;
        }
        set({ isCreatingIssue: true }, undefined, "backlog/createIssue");
        try {
          const { commands } = await import("@/bindings");
          await commands.createGithubIssueFromBacklog(itemId);
          await get().loadItems();
          set({ isCreatingIssue: false }, undefined, "backlog/createIssue/ok");
          log.success("backlog", "GitHub issue created");
        } catch (e) {
          set(
            { error: String(e), isCreatingIssue: false },
            undefined,
            "backlog/createIssue/error",
          );
          log.error("backlog", `Issue creation error: ${String(e)}`);
        }
      },

      setFilter: (key, value) => {
        set(
          (state) => ({ filters: { ...state.filters, [key]: value } }),
          undefined,
          "backlog/setFilter",
        );
      },

      clearFilters: () => {
        set(
          { filters: { ...defaultFilters } },
          undefined,
          "backlog/clearFilters",
        );
      },
    }),
    { name: "backlog", enabled: import.meta.env.DEV },
  ),
);

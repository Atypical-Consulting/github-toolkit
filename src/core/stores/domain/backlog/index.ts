import { create } from "zustand";
import { devtools } from "zustand/middleware";

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
  error: string | null;
  filters: BacklogFilters;
  loadItems: () => Promise<void>;
  generateFromScan: (reports: any[]) => Promise<void>;
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
      error: null,
      filters: { ...defaultFilters },

      loadItems: async () => {
        set({ isLoading: true, error: null }, undefined, "backlog/load");
        try {
          const { commands } = await import("@/bindings");
          const result = await commands.listBacklog(get().filters);
          if (result.status === "ok") {
            set({ items: result.data as BacklogItem[], isLoading: false }, undefined, "backlog/load/ok");
          } else {
            set({ error: "Failed to load backlog", isLoading: false });
          }
        } catch (e) {
          set({ error: String(e), isLoading: false });
        }
      },

      generateFromScan: async (reports) => {
        try {
          const { commands } = await import("@/bindings");
          const result = await commands.generateBacklogFromScan(reports);
          if (result.status === "ok") {
            set({ items: result.data as BacklogItem[] }, undefined, "backlog/generate/ok");
          }
        } catch (e) {
          set({ error: String(e) });
        }
      },

      updateStatus: async (id, status) => {
        try {
          const { commands } = await import("@/bindings");
          await commands.updateBacklogItemStatus(id, status);
          await get().loadItems();
        } catch (e) {
          set({ error: String(e) });
        }
      },

      createGitHubIssue: async (itemId) => {
        try {
          const { commands } = await import("@/bindings");
          await commands.createGithubIssueFromBacklog(itemId);
          await get().loadItems();
        } catch (e) {
          set({ error: String(e) });
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
        set({ filters: { ...defaultFilters } }, undefined, "backlog/clearFilters");
      },
    }),
    { name: "backlog", enabled: import.meta.env.DEV },
  ),
);

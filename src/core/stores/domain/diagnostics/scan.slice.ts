import type { StateCreator } from "zustand";
import type { DiagnosticsStore } from "./index";
import { listen } from "@tauri-apps/api/event";

interface ScanProgress {
  total: number;
  completed: number;
  currentRepo: string;
  fromCache: boolean;
}

export interface ScanSlice {
  isScanRunning: boolean;
  scanProgress: ScanProgress | null;
  scanError: string | null;
  startScan: (repos: any[]) => Promise<void>;
}

export const createScanSlice: StateCreator<
  DiagnosticsStore,
  [["zustand/devtools", never]],
  [],
  ScanSlice
> = (set, get) => ({
  isScanRunning: false,
  scanProgress: null,
  scanError: null,

  startScan: async (repos) => {
    set({ isScanRunning: true, scanError: null, scanProgress: { total: repos.length, completed: 0, currentRepo: "", fromCache: false } }, undefined, "scan/start");

    // Listen to progress events
    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      set({ scanProgress: event.payload }, undefined, "scan/progress");
    });

    try {
      const { commands } = await import("@/bindings");
      const result = await commands.scanAllRepositories(repos);
      if (result.status === "ok") {
        // Extract reports from cached wrappers
        const { setReports } = get();
        setReports(result.data.map((c) => c.report));
      } else {
        set({ scanError: "Scan failed" }, undefined, "scan/error");
      }
    } catch (e) {
      set({ scanError: String(e) }, undefined, "scan/error");
    } finally {
      unlisten();
      set({ isScanRunning: false }, undefined, "scan/done");
    }
  },
});

import { listen } from "@tauri-apps/api/event";
import type { StateCreator } from "zustand";
import { log } from "@/core/stores/log";
import type { DiagnosticsStore } from "./index";
import type { RepoHealthReport } from "./results.slice";

interface ScanProgress {
  total: number;
  completed: number;
  currentRepo: string;
  fromCache: boolean;
  report: RepoHealthReport | null;
}

export interface ScanSlice {
  isScanRunning: boolean;
  scanProgress: ScanProgress | null;
  scanError: string | null;
  scanningRepos: Set<string>;
  startScan: (repos: any[]) => Promise<void>;
  cancelScan: () => Promise<void>;
}

// Module-level unlisten reference prevents duplicate listener registrations
// after HMR or rapid restarts (SCAN-05).
let currentUnlisten: (() => void) | null = null;

export const createScanSlice: StateCreator<
  DiagnosticsStore,
  [["zustand/devtools", never]],
  [],
  ScanSlice
> = (set, get) => ({
  isScanRunning: false,
  scanProgress: null,
  scanError: null,
  scanningRepos: new Set<string>(),

  startScan: async (repos) => {
    // Guard against concurrent scans
    if (get().isScanRunning) {
      log.warn("scan", "Scan already in progress, skipping");
      return;
    }

    // Clean up any previous listener before registering a new one (SCAN-05)
    currentUnlisten?.();
    currentUnlisten = null;

    set(
      {
        isScanRunning: true,
        scanError: null,
        scanProgress: {
          total: repos.length,
          completed: 0,
          currentRepo: "",
          fromCache: false,
          report: null,
        },
        scanningRepos: new Set<string>(),
      },
      undefined,
      "scan/start",
    );
    log.info("scan", `Starting scan of ${repos.length} repositories...`);

    // Listen to progress events
    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      const { currentRepo, report } = event.payload;

      // Track in-flight repos via scanningRepos Set
      set(
        (state) => {
          const updated = new Set(state.scanningRepos);
          if (currentRepo && report === null) {
            // Pre-repo event: repo scan is starting
            updated.add(currentRepo);
          } else if (report !== null) {
            // Post-repo event: repo scan completed, remove from in-flight
            updated.delete(report.repoFullName);
          }
          return { scanProgress: event.payload, scanningRepos: updated };
        },
        undefined,
        "scan/progress",
      );

      // Incrementally update the reports store as each repo completes (SCAN-01, SCAN-02)
      if (report !== null) {
        get().updateReport(report);
      }
    });

    // Store unlisten so it can be cleaned up on future startScan calls
    currentUnlisten = unlisten;

    try {
      const { commands } = await import("@/bindings");
      const result = await commands.scanAllRepositories(repos);
      if (result.status === "ok") {
        // Safety-net reconciliation: ensure final state matches even if an event was missed
        const { setReports } = get();
        setReports(result.data.map((c) => c.report));
        log.success(
          "scan",
          `Scan complete — ${result.data.length} repos analyzed`,
        );
      } else {
        // Don't show error for cancellation
        const err = result.error as any;
        if (err?.type === "Cancelled") {
          set({ scanError: null }, undefined, "scan/cancelled");
          log.info("scan", "Scan cancelled by user");
        } else {
          set({ scanError: "Scan failed" }, undefined, "scan/error");
          log.error("scan", "Scan failed");
        }
      }
    } catch (e) {
      set({ scanError: String(e) }, undefined, "scan/error");
      log.error("scan", `Scan error: ${String(e)}`);
    } finally {
      currentUnlisten?.();
      currentUnlisten = null;
      // Clear progress and mark done
      set(
        { isScanRunning: false, scanProgress: null, scanningRepos: new Set() },
        undefined,
        "scan/done",
      );
    }
  },

  cancelScan: async () => {
    try {
      const { commands } = await import("@/bindings");
      await commands.cancelScan();
      log.info("scan", "Cancel requested");
    } catch (e) {
      log.error("scan", `Failed to cancel: ${String(e)}`);
    }
  },
});

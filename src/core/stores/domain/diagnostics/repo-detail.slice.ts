import type { StateCreator } from "zustand";
import { log } from "@/core/stores/log";
import type { DiagnosticsStore } from "./index";
import type { DiagnosticResult } from "./results.slice";

export interface ScanMeta {
  commitSha: string;
  fromCache: boolean;
}

export interface RepoDetailSlice {
  /** Repo full names currently being rescanned */
  rescanningRepos: string[];
  /** Per-repo scan errors */
  repoScanErrors: Record<string, string>;
  /** Per-repo: which rule is currently being scanned */
  scanningRuleByRepo: Record<string, string>;
  /** Per-repo per-rule overrides from individual re-scans */
  ruleOverridesByRepo: Record<string, Record<string, DiagnosticResult>>;
  /** Per-repo scan metadata (commit sha, cache status) */
  scanMetaByRepo: Record<string, ScanMeta>;
  rescanRepo: (
    repoFullName: string,
    owner: string,
    repo: string,
    defaultBranch: string,
  ) => Promise<void>;
  scanRule: (
    repoFullName: string,
    owner: string,
    repo: string,
    ruleId: string,
  ) => Promise<void>;
  clearRepoOverrides: (repoFullName: string) => void;
  isRepoRescanning: (repoFullName: string) => boolean;
  getRepoScanError: (repoFullName: string) => string | null;
  getScanningRuleId: (repoFullName: string) => string | null;
  getRuleOverrides: (repoFullName: string) => Record<string, DiagnosticResult>;
  getRepoScanMeta: (repoFullName: string) => ScanMeta | null;
}

export const createRepoDetailSlice: StateCreator<
  DiagnosticsStore,
  [["zustand/devtools", never]],
  [],
  RepoDetailSlice
> = (set, get) => ({
  rescanningRepos: [],
  repoScanErrors: {},
  scanningRuleByRepo: {},
  ruleOverridesByRepo: {},
  scanMetaByRepo: {},

  rescanRepo: async (repoFullName, owner, repo, defaultBranch) => {
    // Guard against concurrent rescan of same repo
    if (get().rescanningRepos.includes(repoFullName)) {
      log.warn("repoDetail", `Already rescanning ${repoFullName}`);
      return;
    }

    // Mark as rescanning + clear error
    set(
      (state) => ({
        rescanningRepos: [...state.rescanningRepos, repoFullName],
        repoScanErrors: omitKey(state.repoScanErrors, repoFullName),
      }),
      undefined,
      "repoDetail/rescan/start",
    );
    log.info("repoDetail", `Rescanning ${repoFullName}...`);

    try {
      const { commands } = await import("@/bindings");
      const result = await commands.scanRepositoryCached(
        owner,
        repo,
        defaultBranch,
      );
      if (result.status === "ok") {
        const { report, commitSha, fromCache } = result.data;
        set(
          (state) => ({
            ruleOverridesByRepo: omitKey(
              state.ruleOverridesByRepo,
              repoFullName,
            ),
            scanMetaByRepo: {
              ...state.scanMetaByRepo,
              [repoFullName]: { commitSha, fromCache },
            },
          }),
          undefined,
          "repoDetail/rescan/ok",
        );
        get().updateReport(report);
        log.success(
          "repoDetail",
          `${repoFullName} scanned — ${Math.round(report.healthScore)}% health${fromCache ? " (cached)" : ""}`,
        );
      } else {
        const msg =
          typeof result.error === "object" && result.error !== null
            ? JSON.stringify(result.error)
            : String(result.error);
        set(
          (state) => ({
            repoScanErrors: { ...state.repoScanErrors, [repoFullName]: msg },
          }),
          undefined,
          "repoDetail/rescan/error",
        );
        log.error("repoDetail", `Scan failed for ${repoFullName}: ${msg}`);
      }
    } catch (e) {
      set(
        (state) => ({
          repoScanErrors: {
            ...state.repoScanErrors,
            [repoFullName]: String(e),
          },
        }),
        undefined,
        "repoDetail/rescan/error",
      );
      log.error("repoDetail", `Scan error for ${repoFullName}: ${String(e)}`);
    } finally {
      set(
        (state) => ({
          rescanningRepos: state.rescanningRepos.filter(
            (r) => r !== repoFullName,
          ),
        }),
        undefined,
        "repoDetail/rescan/done",
      );
    }
  },

  scanRule: async (repoFullName, owner, repo, ruleId) => {
    set(
      (state) => ({
        scanningRuleByRepo: {
          ...state.scanningRuleByRepo,
          [repoFullName]: ruleId,
        },
      }),
      undefined,
      "repoDetail/scanRule/start",
    );

    try {
      const { commands } = await import("@/bindings");
      const result = await commands.scanSingleDiagnostic(owner, repo, ruleId);
      if (result.status === "ok") {
        set(
          (state) => {
            const repoOverrides = state.ruleOverridesByRepo[repoFullName] ?? {};
            return {
              ruleOverridesByRepo: {
                ...state.ruleOverridesByRepo,
                [repoFullName]: { ...repoOverrides, [ruleId]: result.data },
              },
            };
          },
          undefined,
          "repoDetail/scanRule/ok",
        );
        const status = result.data.passed ? "passed" : "failed";
        log.info(
          "repoDetail",
          `Rule "${ruleId}" ${status} for ${repoFullName}`,
        );
      } else {
        log.error(
          "repoDetail",
          `Rule "${ruleId}" scan failed: ${JSON.stringify(result.error)}`,
        );
      }
    } catch (e) {
      log.error("repoDetail", `Rule "${ruleId}" error: ${String(e)}`);
    } finally {
      set(
        (state) => {
          const { [repoFullName]: _, ...rest } = state.scanningRuleByRepo;
          return { scanningRuleByRepo: rest };
        },
        undefined,
        "repoDetail/scanRule/done",
      );
    }
  },

  clearRepoOverrides: (repoFullName) => {
    set(
      (state) => ({
        ruleOverridesByRepo: omitKey(state.ruleOverridesByRepo, repoFullName),
      }),
      undefined,
      "repoDetail/clearOverrides",
    );
  },

  isRepoRescanning: (repoFullName) =>
    get().rescanningRepos.includes(repoFullName),
  getRepoScanError: (repoFullName) =>
    get().repoScanErrors[repoFullName] ?? null,
  getScanningRuleId: (repoFullName) =>
    get().scanningRuleByRepo[repoFullName] ?? null,
  getRuleOverrides: (repoFullName) =>
    get().ruleOverridesByRepo[repoFullName] ?? {},
  getRepoScanMeta: (repoFullName) => get().scanMetaByRepo[repoFullName] ?? null,
});

/** Return a shallow copy of obj without the given key */
function omitKey<T extends Record<string, any>>(obj: T, key: string): T {
  const { [key]: _, ...rest } = obj;
  return rest as T;
}

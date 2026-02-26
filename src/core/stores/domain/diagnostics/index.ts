import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  createRepoDetailSlice,
  type RepoDetailSlice,
} from "./repo-detail.slice";
import { createResultsSlice, type ResultsSlice } from "./results.slice";
import { createRulesSlice, type RulesSlice } from "./rules.slice";
import { createScanSlice, type ScanSlice } from "./scan.slice";

export type DiagnosticsStore = ScanSlice &
  ResultsSlice &
  RulesSlice &
  RepoDetailSlice;

export const useDiagnosticsStore = create<DiagnosticsStore>()(
  devtools(
    (...args) => ({
      ...createScanSlice(...args),
      ...createResultsSlice(...args),
      ...createRulesSlice(...args),
      ...createRepoDetailSlice(...args),
    }),
    { name: "diagnostics", enabled: import.meta.env.DEV },
  ),
);

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createScanSlice, type ScanSlice } from "./scan.slice";
import { createResultsSlice, type ResultsSlice } from "./results.slice";

export type DiagnosticsStore = ScanSlice & ResultsSlice;

export const useDiagnosticsStore = create<DiagnosticsStore>()(
  devtools(
    (...args) => ({
      ...createScanSlice(...args),
      ...createResultsSlice(...args),
    }),
    { name: "diagnostics", enabled: import.meta.env.DEV },
  ),
);

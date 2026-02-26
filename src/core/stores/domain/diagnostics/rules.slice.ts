import type { StateCreator } from "zustand";
import type { DiagnosticsStore } from "./index";
import type { RuleInfo } from "@/bindings";
import { log } from "@/core/stores/log";

export interface RulesSlice {
  rules: RuleInfo[];
  rulesLoaded: boolean;
  loadRules: () => Promise<void>;
}

export const createRulesSlice: StateCreator<
  DiagnosticsStore,
  [["zustand/devtools", never]],
  [],
  RulesSlice
> = (set, get) => ({
  rules: [],
  rulesLoaded: false,

  loadRules: async () => {
    if (get().rulesLoaded) return;
    try {
      const { commands } = await import("@/bindings");
      const rules = await commands.listDiagnosticRules();
      set({ rules, rulesLoaded: true }, undefined, "rules/load");
      log.info("diagnostics", `Loaded ${rules.length} diagnostic rules`);
    } catch (e) {
      set({ rulesLoaded: true }, undefined, "rules/load/error");
      log.error("diagnostics", `Failed to load rules: ${String(e)}`);
    }
  },
});

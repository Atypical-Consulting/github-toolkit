import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type View =
  | { name: "dashboard" }
  | { name: "repo-details"; repoFullName: string };

interface NavigationStore {
  currentView: View;
  navigateTo: (view: View) => void;
  goBack: () => void;
}

export const useNavigationStore = create<NavigationStore>()(
  devtools(
    (set) => ({
      currentView: { name: "dashboard" } as View,
      navigateTo: (view) => set({ currentView: view }, undefined, "nav/to"),
      goBack: () =>
        set({ currentView: { name: "dashboard" } }, undefined, "nav/back"),
    }),
    { name: "navigation", enabled: import.meta.env.DEV },
  ),
);

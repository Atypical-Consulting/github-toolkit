import type { StateCreator } from "zustand";
import type { GitHubStore } from "./index";

export interface AuthSlice {
  isAuthenticated: boolean;
  isLoading: boolean;
  username: string | null;
  avatarUrl: string | null;
  deviceCode: string | null;
  userCode: string | null;
  verificationUri: string | null;
  authError: string | null;
  pollInterval: number;
  checkAuth: () => Promise<void>;
  startDeviceFlow: () => Promise<void>;
  pollAuth: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const createAuthSlice: StateCreator<
  GitHubStore,
  [["zustand/devtools", never]],
  [],
  AuthSlice
> = (set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  username: null,
  avatarUrl: null,
  deviceCode: null,
  userCode: null,
  verificationUri: null,
  authError: null,
  pollInterval: 5,

  checkAuth: async () => {
    set({ isLoading: true }, undefined, "auth/checkAuth");
    try {
      const { commands } = await import("@/bindings");
      const result = await commands.githubGetAuthStatus();
      if (result.status === "ok") {
        set({
          isAuthenticated: result.data.authenticated,
          username: result.data.username ?? null,
          avatarUrl: result.data.avatarUrl ?? null,
          isLoading: false,
        }, undefined, "auth/checkAuth/ok");
      } else {
        set({ isAuthenticated: false, isLoading: false }, undefined, "auth/checkAuth/err");
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false }, undefined, "auth/checkAuth/error");
    }
  },

  startDeviceFlow: async () => {
    set({ authError: null, pollInterval: 5 }, undefined, "auth/startFlow");
    try {
      const { commands } = await import("@/bindings");
      const result = await commands.githubStartDeviceFlow(["repo", "read:org"]);
      if (result.status === "ok") {
        set({
          deviceCode: result.data.deviceCode,
          userCode: result.data.userCode,
          verificationUri: result.data.verificationUri,
          pollInterval: result.data.interval,
        }, undefined, "auth/startFlow/ok");
      } else {
        set({ authError: "Failed to start device flow" }, undefined, "auth/startFlow/err");
      }
    } catch (e) {
      set({ authError: String(e) }, undefined, "auth/startFlow/error");
    }
  },

  pollAuth: async () => {
    const { deviceCode } = get();
    if (!deviceCode) return false;
    try {
      const { commands } = await import("@/bindings");
      const result = await commands.githubPollAuth(deviceCode, get().pollInterval);
      if (result.status === "ok" && result.data.authenticated) {
        set({
          isAuthenticated: true,
          isLoading: false,
          username: result.data.username ?? null,
          avatarUrl: result.data.avatarUrl ?? null,
          deviceCode: null,
          userCode: null,
          verificationUri: null,
          authError: null,
        }, undefined, "auth/poll/ok");
        return true;
      }
      if (result.status === "error") {
        const err = result.error;
        if (err.type === "SlowDown") {
          // GitHub spec: add 5 seconds to interval on slow_down
          set(
            { pollInterval: get().pollInterval + 5 },
            undefined,
            "auth/poll/slowDown",
          );
          return false;
        }
        if (err.type === "AuthorizationPending") {
          return false;
        }
        // Real error — surface it
        set({ authError: `Auth failed: ${err.type}${"message" in err ? ` - ${err.message}` : ""}` }, undefined, "auth/poll/error");
        return false;
      }
      return false;
    } catch (e) {
      set({ authError: `Unexpected error: ${String(e)}` }, undefined, "auth/poll/exception");
      return false;
    }
  },

  signOut: async () => {
    try {
      const { commands } = await import("@/bindings");
      await commands.githubSignOut();
    } catch {
      // ignore
    }
    set({
      isAuthenticated: false,
      username: null,
      avatarUrl: null,
    }, undefined, "auth/signOut");
  },
});

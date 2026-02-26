import type { StateCreator } from "zustand";
import type { GitHubStore } from "./index";
import { log } from "@/core/stores/log";

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
        if (result.data.authenticated) {
          log.success("auth", `Signed in as ${result.data.username}`);
        }
      } else {
        set({ isAuthenticated: false, isLoading: false }, undefined, "auth/checkAuth/err");
      }
    } catch (e) {
      set({ isAuthenticated: false, isLoading: false }, undefined, "auth/checkAuth/error");
      log.error("auth", `Auth check failed: ${String(e)}`);
    }
  },

  startDeviceFlow: async () => {
    set({ authError: null, pollInterval: 5 }, undefined, "auth/startFlow");
    log.info("auth", "Starting device flow...");
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
        log.info("auth", `Enter code: ${result.data.userCode}`);
      } else {
        set({ authError: "Failed to start device flow" }, undefined, "auth/startFlow/err");
        log.error("auth", "Failed to start device flow");
      }
    } catch (e) {
      set({ authError: String(e) }, undefined, "auth/startFlow/error");
      log.error("auth", `Device flow error: ${String(e)}`);
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
        log.success("auth", `Authenticated as ${result.data.username}`);
        return true;
      }
      if (result.status === "error") {
        const err = result.error;
        if (err.type === "SlowDown") {
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
        const msg = `Auth failed: ${err.type}${"message" in err ? ` - ${err.message}` : ""}`;
        set({ authError: msg }, undefined, "auth/poll/error");
        log.error("auth", msg);
        return false;
      }
      return false;
    } catch (e) {
      const msg = `Unexpected error: ${String(e)}`;
      set({ authError: msg }, undefined, "auth/poll/exception");
      log.error("auth", msg);
      return false;
    }
  },

  signOut: async () => {
    log.info("auth", "Signing out...");
    try {
      const { commands } = await import("@/bindings");
      await commands.githubSignOut();
      log.success("auth", "Signed out");
    } catch (e) {
      log.error("auth", `Sign out error: ${String(e)}`);
    }
    set({
      isAuthenticated: false,
      username: null,
      avatarUrl: null,
    }, undefined, "auth/signOut");
  },
});

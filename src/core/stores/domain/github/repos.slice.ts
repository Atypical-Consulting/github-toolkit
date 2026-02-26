import type { StateCreator } from "zustand";
import type { GitHubStore } from "./index";
import { log } from "@/core/stores/log";

export interface RepoSummary {
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  topics: string[];
  isArchived: boolean;
  isPrivate: boolean;
  hasIssues: boolean;
  openIssuesCount: number;
  pushedAt: string | null;
  htmlUrl: string;
  licenseName: string | null;
}

export interface ReposSlice {
  repos: RepoSummary[];
  reposLoading: boolean;
  reposError: string | null;
  reposCacheLoaded: boolean;
  loadCachedRepos: () => Promise<void>;
  fetchAllRepos: (orgs?: string[]) => Promise<void>;
}

export const createReposSlice: StateCreator<
  GitHubStore,
  [["zustand/devtools", never]],
  [],
  ReposSlice
> = (set, get) => ({
  repos: [],
  reposLoading: false,
  reposError: null,
  reposCacheLoaded: false,

  loadCachedRepos: async () => {
    try {
      const { commands } = await import("@/bindings");
      const result = await commands.loadCachedRepos();
      if (result.status === "ok" && result.data.length > 0) {
        set({ repos: result.data as RepoSummary[], reposCacheLoaded: true }, undefined, "repos/loadCache");
        log.info("repos", `Loaded ${result.data.length} repos from cache`);
      } else {
        set({ reposCacheLoaded: true }, undefined, "repos/loadCache/empty");
        log.info("repos", "No cached repos found");
      }
    } catch (e) {
      set({ reposCacheLoaded: true }, undefined, "repos/loadCache/error");
      log.warn("repos", `Cache load failed: ${String(e)}`);
    }
  },

  fetchAllRepos: async (orgs = []) => {
    // Guard against concurrent calls
    if (get().reposLoading) {
      log.warn("repos", "Fetch already in progress, skipping");
      return;
    }

    set({ reposLoading: true, reposError: null }, undefined, "repos/fetchAll");
    log.info("repos", "Fetching repositories from GitHub...");

    try {
      const { commands } = await import("@/bindings");
      const allRepos: RepoSummary[] = [];

      // Fetch user repos with pagination
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const result = await commands.githubListUserRepos(page, 100);
        if (result.status === "ok") {
          allRepos.push(...(result.data.items as RepoSummary[]));
          hasNext = result.data.hasNextPage;
          page = result.data.nextPage ?? page + 1;
        } else {
          hasNext = false;
        }
      }

      // Fetch org repos
      for (const org of orgs) {
        let orgPage = 1;
        let orgHasNext = true;
        while (orgHasNext) {
          const result = await commands.githubListOrgRepos(org, orgPage, 100);
          if (result.status === "ok") {
            allRepos.push(...(result.data.items as RepoSummary[]));
            orgHasNext = result.data.hasNextPage;
            orgPage = result.data.nextPage ?? orgPage + 1;
          } else {
            orgHasNext = false;
          }
        }
      }

      // Deduplicate by fullName
      const seen = new Set<string>();
      const unique = allRepos.filter((r) => {
        if (seen.has(r.fullName)) return false;
        seen.add(r.fullName);
        return true;
      });

      set({ repos: unique, reposLoading: false, reposCacheLoaded: true }, undefined, "repos/fetchAll/ok");
      log.success("repos", `Fetched ${unique.length} repositories`);

      // Persist to DB in background (best-effort)
      commands.persistRepos(unique).catch(() => {});
    } catch (e) {
      set({ reposError: String(e), reposLoading: false }, undefined, "repos/fetchAll/error");
      log.error("repos", `Fetch failed: ${String(e)}`);
    }
  },
});

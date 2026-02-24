import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createAuthSlice, type AuthSlice } from "./auth.slice";
import { createReposSlice, type ReposSlice } from "./repos.slice";

export type GitHubStore = AuthSlice & ReposSlice;

export const useGitHubStore = create<GitHubStore>()(
  devtools(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createReposSlice(...args),
    }),
    { name: "github", enabled: import.meta.env.DEV },
  ),
);

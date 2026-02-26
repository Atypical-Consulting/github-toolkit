# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
GitHubAutomate/
├── src-tauri/                    # Rust backend (Tauri 2 window+commands)
│   ├── src/
│   │   ├── lib.rs               # Entry point: command registration, setup
│   │   ├── main.rs              # Tauri app bootstrap (auto-generated)
│   │   ├── github/              # GitHub OAuth, API client, repos, issues
│   │   ├── diagnostics/         # Health check engine, rules, context
│   │   ├── storage/             # SQLite DB, persistence layer
│   │   └── backlog/             # Backlog generation, GitHub issue creation
│   ├── Cargo.toml               # Rust dependencies (reqwest, rusqlite, keyring, etc.)
│   └── tauri.conf.json          # Tauri configuration
├── src/                          # TypeScript React frontend
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component: auth gate, router
│   ├── index.css                # Tailwind v4 + custom theme variables
│   ├── vite-env.d.ts            # Vite type definitions
│   ├── bindings.ts              # Auto-generated Tauri command bindings
│   ├── core/                    # Shared state, components, utilities
│   │   ├── stores/
│   │   │   ├── domain/          # Zustand stores (GitHub, Diagnostics, Backlog)
│   │   │   ├── navigation.ts    # View routing store
│   │   │   └── log.ts           # Client-side logging
│   │   ├── components/          # Shared UI components (Header, ToastOverlay)
│   │   └── lib/                 # Utilities (cn for classNames)
│   └── extensions/              # Feature pages/modules (extensions pattern)
│       ├── dashboard/           # Dashboard.tsx (overview + scan UI)
│       ├── repo-details/        # RepoDetailsPage.tsx (per-repo diagnostics)
│       └── settings/            # AuthScreen.tsx (login screen)
├── public/                       # Static assets
├── dist/                         # Production build output (Vite)
├── .planning/codebase/          # GSD codebase analysis docs (this repo)
├── package.json                 # npm dependencies (React, Zustand, TailwindCSS, etc.)
├── tsconfig.json                # TypeScript config (strict mode, path alias @/*)
├── vite.config.ts               # Vite bundler config
├── tailwind.config.ts           # Tailwind CSS v4 config
├── biome.json                   # Biome linter/formatter config
└── .gitignore                   # Excludes node_modules, dist, target, etc.
```

## Directory Purposes

**`src-tauri/src/github/`:**
- Purpose: GitHub OAuth authentication, HTTP client, repository queries, issue creation
- Contains: `auth.rs`, `client.rs`, `error.rs`, `issues.rs`, `rate_limit.rs`, `repos.rs`, `token.rs`, `types.rs`, `mod.rs`
- Key files:
  - `auth.rs` - Device Flow OAuth implementation
  - `token.rs` - Keychain integration, auth status check, sign-out
  - `client.rs` - Authenticated HTTP client wrapper (reqwest)
  - `repos.rs` - List user/org repos with pagination
  - `issues.rs` - Create GitHub issues (called from backlog)
  - `types.rs` - GitHub API response types (internal structs)

**`src-tauri/src/diagnostics/`:**
- Purpose: Health check rules engine, context gathering, diagnostic computation
- Contains: `commands.rs`, `context.rs`, `engine.rs`, `rules.rs`, `types.rs`, `mod.rs`
- Key files:
  - `engine.rs` - DiagnosticsEngine orchestrates rule checks, computes health_score
  - `rules.rs` - DiagnosticRule trait + 5 built-in rules (HasReadme, HasLicense, HasDescription, HasTopics, HasCiCd)
  - `context.rs` - RepoContext builder (fetches repo metadata via GitHub API)
  - `types.rs` - DiagnosticResult, RepoHealthReport, Severity, RuleInfo
  - `commands.rs` - Tauri commands: `scan_repository`, `scan_all_repositories`, `scan_repository_cached`, `get_repo_diagnostics`, `scan_single_diagnostic`, `list_diagnostic_rules`, `cancel_scan`

**`src-tauri/src/storage/`:**
- Purpose: SQLite persistence, caching, data retrieval
- Contains: `db.rs`, `repos.rs`, `diagnostics.rs`, `backlog.rs`, `scan_sessions.rs`, `commands.rs`, `mod.rs`
- Key files:
  - `db.rs` - Database initialization (4 tables: scan_sessions, repositories, diagnostic_results, backlog_items + diagnostic_rule_results)
  - `repos.rs` - Save/load repos from `repositories` table
  - `diagnostics.rs` - Save/load diagnostic results
  - `backlog.rs` - Save/load backlog items
  - `scan_sessions.rs` - Track scan metadata
  - `commands.rs` - Tauri commands: `persist_repos`, `load_cached_repos`, `load_all_diagnostics`

**`src-tauri/src/backlog/`:**
- Purpose: Backlog item generation, status management, GitHub issue creation
- Contains: `commands.rs`, `mod.rs`
- Key files:
  - `commands.rs` - Tauri commands: `generate_backlog_from_scan`, `list_backlog`, `update_backlog_item_status`, `delete_backlog`, `create_github_issue_from_backlog`

**`src/core/stores/domain/github/`:**
- Purpose: GitHub authentication state, repo listing state
- Contains: `index.ts`, `auth.slice.ts`, `repos.slice.ts`
- Key files:
  - `auth.slice.ts` - AuthSlice: `isAuthenticated`, `username`, `avatarUrl`, `checkAuth()`, `startDeviceFlow()`, `pollAuth()`, `signOut()`
  - `repos.slice.ts` - ReposSlice: `repos[]`, `reposLoading`, `fetchAllRepos()`, `loadCachedRepos()`
  - `index.ts` - Combines both slices into `GitHubStore`

**`src/core/stores/domain/diagnostics/`:**
- Purpose: Diagnostic scan state, results caching, rules management
- Contains: `index.ts`, `scan.slice.ts`, `results.slice.ts`, `rules.slice.ts`, `repo-detail.slice.ts`
- Key files:
  - `scan.slice.ts` - ScanSlice: `isScanRunning`, `scanProgress`, `startScan()`, `cancelScan()`, event listener for `scan-progress`
  - `results.slice.ts` - ResultsSlice: `reports` (Map<repoFullName, RepoHealthReport>), `setReports()`, health distribution calculations
  - `rules.slice.ts` - RulesSlice: `rules[]`, `loadRules()`
  - `repo-detail.slice.ts` - RepoDetailSlice: Per-repo metadata (rescanning, errors, rule overrides)
  - `index.ts` - Combines all slices into `DiagnosticsStore`

**`src/core/stores/domain/backlog/`:**
- Purpose: Backlog items state, filtering, GitHub issue creation
- Contains: `index.ts`
- Key files:
  - `index.ts` - BacklogStore: `items[]`, `filters`, `loadItems()`, `generateFromScan()`, `createFromDiagnostic()`, `createGitHubIssue()`, `updateStatus()`

**`src/core/components/`:**
- Purpose: Shared UI components used across pages
- Contains: `Header.tsx`, `ToastOverlay.tsx`
- Key files:
  - `Header.tsx` - App header with GitHub user profile, logout button
  - `ToastOverlay.tsx` - Renders log messages as toast notifications

**`src/extensions/dashboard/`:**
- Purpose: Main app page (overview, scan UI, backlog generation)
- Contains: `Dashboard.tsx`
- Key files:
  - `Dashboard.tsx` - Tabs: Overview (health distribution), Repositories (full list, scan button), Backlog (filtered list of items)

**`src/extensions/repo-details/`:**
- Purpose: Per-repository diagnostic details
- Contains: `RepoDetailsPage.tsx`
- Key files:
  - `RepoDetailsPage.tsx` - Health report, per-rule results, rescan buttons, backlog creation per rule

**`src/extensions/settings/`:**
- Purpose: Authentication flow
- Contains: `AuthScreen.tsx`
- Key files:
  - `AuthScreen.tsx` - Device flow UI (display user code, polling indicator)

## Key File Locations

**Entry Points:**
- `src-tauri/src/lib.rs` - Rust entry point: command registration, DB initialization
- `src/main.tsx` - Frontend entry point: React root, QueryClient setup
- `src/App.tsx` - App root: auth gate, view router

**Configuration:**
- `tsconfig.json` - TypeScript config (strict mode, path alias `@/*` → `src/*`)
- `vite.config.ts` - Vite bundler config (defines `@` alias, Tauri plugin)
- `tailwind.config.ts` - Tailwind v4 theme customization
- `biome.json` - Linter rules and formatter settings
- `src-tauri/tauri.conf.json` - Tauri window, dev server, build settings

**Core Logic:**
- `src-tauri/src/diagnostics/engine.rs` - DiagnosticsEngine (health score computation)
- `src-tauri/src/diagnostics/rules.rs` - Rule implementations
- `src-tauri/src/storage/db.rs` - Database schema + initialization
- `src/core/stores/domain/github/auth.slice.ts` - Authentication state machine
- `src/core/stores/domain/diagnostics/scan.slice.ts` - Scan orchestration + event listening

**Testing:**
- No test files currently committed (TODO: add test suite)

## Naming Conventions

**Files:**
- Rust: `snake_case.rs` (e.g., `auth.rs`, `scan_sessions.rs`)
- TypeScript: `camelCase.ts` (slices), `PascalCase.tsx` (components, e.g., `Dashboard.tsx`, `AuthScreen.tsx`)
- Directories: `kebab-case` (e.g., `repo-details`, `src-tauri`)

**Functions & Methods:**
- Rust: `snake_case` (e.g., `github_start_device_flow`, `scan_all_repositories`)
- TypeScript: `camelCase` for functions (e.g., `startDeviceFlow()`, `loadCachedRepos()`)
- TypeScript: `PascalCase` for React components and types (e.g., `Dashboard`, `AuthScreen`, `DiagnosticsStore`)

**Variables:**
- Rust: `snake_case` (e.g., `device_code`, `health_score`)
- TypeScript: `camelCase` (e.g., `deviceCode`, `healthScore`)
- Serialization: Rust uses `#[serde(rename_all = "camelCase")]` to convert automatically

**Types:**
- Rust: `PascalCase` (e.g., `GitHubError`, `DiagnosticResult`, `RepoContext`)
- TypeScript: `PascalCase` for interfaces/types (e.g., `GitHubStore`, `AuthSlice`, `BacklogItem`)

**Store Slices:**
- Pattern: `{Domain}Slice` interface + `create{Domain}Slice` function
- Examples: `AuthSlice + createAuthSlice`, `ReposSlice + createReposSlice`
- Combined in store: `useGitHubStore`, `useDiagnosticsStore`, `useBacklogStore`

## Where to Add New Code

**New Tauri Command:**
1. Implement function with `#[tauri::command] #[specta::specta]` in appropriate module (`github/`, `diagnostics/`, `storage/`, or `backlog/`)
2. Re-export from module `mod.rs`
3. Add to `collect_commands![]` in `src-tauri/src/lib.rs`
4. Run `npm run tauri dev` to regenerate `src/bindings.ts`

**New Frontend Page/Extension:**
1. Create directory in `src/extensions/{feature-name}/`
2. Implement `{FeatureName}.tsx` component
3. Add to router logic in `App.tsx` based on `useNavigationStore().currentView`
4. Update `navigationStore` to define new view type

**New Diagnostic Rule:**
1. Create struct implementing `DiagnosticRule` trait in `src-tauri/src/diagnostics/rules.rs`
2. Implement `id()`, `name()`, `default_severity()`, `check(&RepoContext) -> DiagnosticResult`
3. Add to `default_rules()` vector
4. `DiagnosticsEngine` and scoring automatically use it

**New Frontend Store Slice:**
1. Create `{feature}.slice.ts` in appropriate domain folder (`src/core/stores/domain/{domain}/`)
2. Define interface `{Feature}Slice` with methods
3. Define `create{Feature}Slice: StateCreator<...>` function
4. Combine in domain store `index.ts` via spread operator

**New Database Table:**
1. Add `CREATE TABLE IF NOT EXISTS` to `src-tauri/src/storage/db.rs` `init_db()` function
2. Create module in `src-tauri/src/storage/{table_name}.rs` with CRUD functions
3. Export functions from `src-tauri/src/storage/mod.rs`
4. Create Tauri commands in `src-tauri/src/storage/commands.rs` if frontend needs access

**New Shared Component:**
1. Create `.tsx` file in `src/core/components/`
2. Use Tailwind utility classes for styling
3. Export from component
4. Import and use in pages/components

**New Utility Function:**
1. Add to `src/core/lib/` (e.g., `src/core/lib/formatting.ts` for formatters)
2. Or add to `src-tauri/src/` module if Rust-side (e.g., `src-tauri/src/util.rs`)

## Special Directories

**`src-tauri/target/`:**
- Purpose: Rust build artifacts (compiled binaries, dependencies)
- Generated: Yes (by `cargo build`)
- Committed: No (in .gitignore)

**`src-tauri/gen/`:**
- Purpose: Tauri-generated capabilities and schemas
- Generated: Yes (by Tauri build system)
- Committed: Partially (schemas may be checked in for reference)

**`dist/`:**
- Purpose: Production JavaScript bundle output
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by GSD mapping agent)
- Committed: Yes (provides context for future Claude instances)

---

*Structure analysis: 2026-02-26*

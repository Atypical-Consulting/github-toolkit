# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Layered IPC architecture with Tauri 2 as the boundary between Rust backend and React frontend. Command-response pattern with event streaming for long-running operations.

**Key Characteristics:**
- **IPC Boundary:** Tauri commands auto-generated via tauri-specta (`#[tauri::command] #[specta::specta]` → `src/bindings.ts`)
- **Type Safety:** Rust serialization with `#[serde(rename_all = "camelCase")]` ensures TypeScript bindings match backend types exactly
- **Error Handling:** Tagged enum `GitHubError` serialized as discriminated union, frontend handles both `Result.status` and `error.type`
- **Event Streaming:** Long-running scans emit `scan-progress` events via Tauri event system, listened to by `scan.slice.ts`
- **State Management:** Zustand v5 composable slices pattern (from FlowForge), each domain has independent store combining multiple slices

## Layers

**Backend (Rust `src-tauri/src/`):**
- Purpose: Secure operations (auth token management), external API calls, database, diagnostics computation
- Location: `src-tauri/src/{github,diagnostics,storage,backlog}/`
- Contains: Command handlers, domain logic, persistence, API clients
- Depends on: reqwest (HTTP), keyring (OS keychain), rusqlite (SQLite), serde (serialization)
- Used by: Frontend via Tauri IPC

**IPC Boundary (`src/bindings.ts`):**
- Purpose: Auto-generated TypeScript interface to Rust commands
- Location: `src/bindings.ts`
- Contains: Command definitions, type signatures, Result wrapper pattern
- Depends on: tauri-specta (code generation, runs on `tauri dev`)
- Used by: All frontend stores via `import("@/bindings")`

**Frontend State Layer (`src/core/stores/`):**
- Purpose: Client-side state management, local caching, async orchestration
- Location: `src/core/stores/domain/{github,diagnostics,backlog}/` and `src/core/stores/navigation.ts`
- Contains: Zustand stores, slices, event listeners, command invocation
- Depends on: Bindings, @tauri-apps/api/event (for listening)
- Used by: UI components

**Frontend UI Layer (`src/extensions/`):**
- Purpose: Pages and components, user interaction, rendering
- Location: `src/extensions/{dashboard,repo-details,settings}/`
- Contains: React components, form handlers, navigation logic
- Depends on: Stores, lucide-react (icons), Tailwind CSS
- Used by: `App.tsx` (router)

## Data Flow

**Authentication Flow:**
1. User clicks "Authorize" → `AuthScreen` (extension)
2. `startDeviceFlow()` (auth.slice) → `github_start_device_flow` (Rust command)
3. Rust: OAuth device flow via reqwest → returns `DeviceFlowResponse` (user_code, device_code, verification_uri)
4. Frontend displays user_code, starts polling
5. `pollAuth()` repeatedly calls `github_poll_auth` with device_code
6. Rust: Polls GitHub OAuth endpoint, on success stores token in OS keychain via `keyring` crate
7. `checkAuth()` called on app startup → reads keychain, sets `isAuthenticated: true`
8. Token never sent to frontend; only metadata (username, avatarUrl) returned

**Repo Listing + Caching Flow:**
1. Dashboard mounts → `loadCachedRepos()` (repos.slice)
2. Loads from SQLite `repositories` table, displays instantly
3. Then `fetchAllRepos(["Atypical-Consulting"])` in background
4. Rust: Paginated GitHub API calls → `github_list_org_repos` + `github_list_user_repos`
5. Updates `repositories` table
6. Frontend updates state, re-renders with fresh data

**Diagnostic Scan Flow:**
1. User clicks "Scan" on Dashboard → `startScan(repos)` (scan.slice)
2. Sets `isScanRunning: true`, starts listening to `scan-progress` event
3. Calls `scanAllRepositories(repos)` command
4. Rust backend:
   - Creates scan session in `scan_sessions` table
   - For each repo: fetches context (`github_get_repo_contents`, readme, workflows, etc.)
   - Runs engine: `DiagnosticsEngine::run(context)` → computes health_score and results
   - Saves to `diagnostic_results` + `diagnostic_rule_results` tables
   - Emits `scan-progress` event after each repo
5. Rust returns `CachedRepoHealthReport[]` with `commit_sha` (for incremental checks)
6. Frontend receives results, saves to `reports` store (keyed by repoFullName)
7. `isScanRunning: false`, progress cleared

**Backlog Generation Flow:**
1. User clicks "Generate Backlog" → `generateFromScan(reports)` (backlog store)
2. Calls `generateBacklogFromScan(reports)` command
3. Rust backend:
   - For each failed diagnostic result: creates BacklogItem
   - Assigns priority score: Critical=100, Warning=50, Info=10
   - Inserts into `backlog_items` table
   - Returns `BacklogItem[]`
4. Frontend updates `items` in backlog store
5. User can filter by owner/repo/severity/status/source, create GitHub issues from items

**Individual Repo Rescan Flow:**
1. User on RepoDetailsPage clicks "Rescan" → `rescanRepo(repoFullName)` (results.slice)
2. Calls `scanRepositoryCached(owner, repo, defaultBranch)` command
3. Rust: Computes current HEAD commit SHA, checks `diagnostic_rule_results` for match
4. If cached (same SHA): returns cached results with `from_cache: true`
5. If not cached: runs engine again, stores new results
6. Frontend updates report + metadata for that repo

**Single Rule Rescan Flow:**
1. User on RepoDetailsPage clicks refresh icon on a rule → `scanRule(repoFullName, ruleId)` (repo-detail.slice)
2. Calls `scanSingleDiagnostic(owner, repo, ruleId)` command
3. Rust: Finds rule in engine, fetches fresh context, runs that rule only
4. Returns `DiagnosticResult`
5. Frontend merges into `ruleOverrides[repoFullName][ruleId]`, renders updated state

## Key Abstractions

**DiagnosticRule Trait:**
- Purpose: Pluggable health check implementation
- Location: `src-tauri/src/diagnostics/rules.rs`
- Examples: `HasReadme`, `HasLicense`, `HasDescription`, `HasTopics`, `HasCiCd`
- Pattern: Trait with `id()`, `name()`, `default_severity()`, `check(ctx: &RepoContext) -> DiagnosticResult`

**DiagnosticsEngine:**
- Purpose: Orchestrate rule execution and health score computation
- Location: `src-tauri/src/diagnostics/engine.rs`
- Pattern: Holds Vec of rules, `run(context)` returns `RepoHealthReport` with computed health_score (weighted average of rule results)

**Zustand Slice Pattern:**
- Purpose: Modular composable state without prop drilling
- Location: `src/core/stores/domain/{github,diagnostics,backlog}/`
- Pattern: Each slice is a `StateCreator` combining interface + implementation, final store combines via spread operator
- Example: `GitHubStore = AuthSlice & ReposSlice`, both combined in `create<GitHubStore>()`

**DbState:**
- Purpose: Thread-safe SQLite connection managed by Tauri
- Location: `src-tauri/src/storage/db.rs`
- Pattern: `DbState(pub Mutex<Connection>)` registered in `setup()`, accessed via `app.state::<DbState>()`

**RepoContext:**
- Purpose: Snapshot of repo metadata for diagnostic execution (immutable during rule checks)
- Location: `src-tauri/src/diagnostics/types.rs`
- Contains: owner, repo_name, description, topics, license, root_files, workflow_files, readme_content, readme_line_count, pushed_at

## Entry Points

**Rust Entry Point:**
- Location: `src-tauri/src/lib.rs`
- Triggers: `npm run tauri dev` or app launch
- Responsibilities: Initialize tauri-specta bindings, register all commands via `collect_commands![]`, setup SQLite connection, mount event system

**Frontend Entry Point:**
- Location: `src/main.tsx`
- Triggers: Vite dev server or production build
- Responsibilities: Create React root, wrap with `QueryClientProvider`, render `App` component

**App Router:**
- Location: `src/App.tsx`
- Triggers: Page load
- Responsibilities: Check auth status, gate routes (AuthScreen if not authenticated), render Header + current view based on `navigationStore.currentView`

**Dashboard:**
- Location: `src/extensions/dashboard/Dashboard.tsx`
- Triggers: Authenticated user navigates or on startup
- Responsibilities: Load cached repos + diagnostics, display summary, trigger full scan, generate backlog, navigate to repo details

**RepoDetailsPage:**
- Location: `src/extensions/repo-details/RepoDetailsPage.tsx`
- Triggers: User clicks repo in Dashboard
- Responsibilities: Display detailed health report, show per-rule results, allow rule-by-rule rescans, create backlog items from failed rules

## Error Handling

**Strategy:** Tagged enum with discriminated union pattern for runtime type safety.

**Patterns:**

**Rust Backend Errors (`GitHubError` enum):**
- Variants: `OAuthFailed`, `AuthorizationPending`, `AccessDenied`, `ExpiredToken`, `SlowDown`, `KeychainError`, `NetworkError`, `NotAuthenticated`, `RateLimitExceeded`, `Internal`, `Cancelled`, `ApiError`, `NotFound`, `Forbidden`, `ValidationFailed`, `MergeNotAllowed`, `HeadChanged`
- Serialization: `#[serde(tag = "type", content = "message")]` → JSON: `{ "type": "NotAuthenticated" }` or `{ "type": "RateLimitExceeded", "message": "60 requests/hour" }`
- Location: `src-tauri/src/github/error.rs`

**Frontend Error Handling Pattern:**
```typescript
const result = await commands.someCommand();
if (result.status === "ok") {
  // Handle success: result.data
} else {
  // Handle error: result.error.type + result.error.message
  const err = result.error as GitHubError;
  if (err.type === "SlowDown") { /* rate limit backoff */ }
  if (err.type === "AuthorizationPending") { /* retry later */ }
  // etc.
}
```

**Event-based Progress & Cancellation:**
- Scan can be cancelled via `ScanCancellationFlag` (AtomicBool set by frontend, polled by backend)
- Long operations emit events instead of blocking
- Frontend listens via `@tauri-apps/api/event` and updates progress UI

## Cross-Cutting Concerns

**Logging:**
- Rust: `println!` / `eprintln!` (TODO: structured logging via tracing)
- Frontend: `log` store (`src/core/stores/log.ts`) with `log.info()`, `log.success()`, `log.error()`, `log.warn()`
- Rendered in `ToastOverlay` component on screen

**Validation:**
- Rust: OAuth token existence checked on app startup via `github_get_auth_status`
- Frontend: Form validation on AuthScreen (required fields)
- API responses validated by tauri-specta type system

**Authentication:**
- Rust: GitHub OAuth Device Flow via reqwest
- Token storage: OS keychain via `keyring` crate (macOS Keychain, Linux Secret Service, Windows Credential Manager)
- Token refresh: Not needed (device flow is time-limited, user re-authenticates if token expires)
- Token revocation: Cleared from keychain on sign-out

**Caching:**
- SQLite tables: `repositories`, `diagnostic_results`, `diagnostic_rule_results`, `scan_sessions`, `backlog_items`
- Incremental: `commit_sha` compared before rescanning individual repos
- Invalidation: Manual (user must click "Scan" again, no TTL)

**Database Transactions:**
- Rust: No explicit transactions; individual inserts/updates via rusqlite
- Scan session: Created before scan, marked complete after

---

*Architecture analysis: 2026-02-26*

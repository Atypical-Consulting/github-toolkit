# Architecture Research

**Domain:** Tauri 2 desktop app — MCP server integration + realtime diagnostics UI
**Researched:** 2026-02-26
**Confidence:** HIGH (codebase verified, MCP spec verified via official docs)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MCP Clients (external)                       │
│         Claude Code  |  Cursor  |  Windsurf  |  Any MCP client      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  stdio (subprocess launch)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Rust Backend (src-tauri/src/)                  │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │
│  │  github/   │  │diagnostics/│  │  storage/  │  │   backlog/   │   │
│  │  (auth,    │  │  (engine,  │  │  (SQLite,  │  │  (backlog,   │   │
│  │  client,   │  │  rules,    │  │  DB state) │  │  issue CRUD) │   │
│  │  repos,    │  │  context)  │  └──────┬─────┘  └──────┬───────┘   │
│  │  issues)   │  └─────┬──────┘         │               │           │
│  └──────┬─────┘        │                └───────┬───────┘           │
│         │              │                        │                   │
│  ┌──────┴──────────────┴────────────────────────┴────────────────┐  │
│  │                    mcp/ (NEW MODULE)                          │  │
│  │  McpServer — rmcp ServerHandler implementing tools:           │  │
│  │    scan_repositories | fix_repo | query_health | ...          │  │
│  │  Shares AppHandle + DbState via Arc<AppHandle>                │  │
│  │  Transport: stdio (launched as subprocess by MCP clients)     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│         │                                                           │
│  ┌──────┴────────────────────────────────────────────────────────┐  │
│  │           Tauri IPC Boundary (tauri-specta auto-gen)          │  │
│  │  collect_commands![] — all commands including mcp_toggle      │  │
│  └──────┬────────────────────────────────────────────────────────┘  │
│         │  Tauri events (scan-progress + scan-result per repo)      │
└─────────┼───────────────────────────────────────────────────────────┘
          │  Tauri IPC commands + events
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 Frontend State Layer (src/core/stores/)             │
│                                                                     │
│  useGitHubStore          useDiagnosticsStore       useBacklogStore  │
│  ┌────────────────┐     ┌───────────────────────┐  ┌──────────────┐ │
│  │ AuthSlice      │     │ ScanSlice (MODIFIED)  │  │ BacklogStore │ │
│  │ ReposSlice     │     │   listen scan-progress│  └──────────────┘ │
│  └────────────────┘     │   → updateReport()    │                   │
│                         │   per repo, not batch │                   │
│                         │ ResultsSlice          │                   │
│                         │   reports: Record<>   │                   │
│                         │ RulesSlice            │                   │
│                         │ RepoDetailSlice       │                   │
│                         └───────────────────────┘                   │
│                               │ subscriptions                       │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Frontend UI Layer (src/extensions/)               │
│  Dashboard.tsx — health rings update per-repo as scan-result fires  │
│  RepoDetailsPage.tsx — per-rule breakdown                           │
│  settings/ — MCP on/off toggle + port display                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `github/` | OAuth auth, GitHub API client, token in keychain, repos, issues | Tauri IPC, `diagnostics/`, `backlog/` |
| `diagnostics/` | Rule engine, health scoring, scan orchestration | GitHub API via `github/client.rs`, `storage/`, Tauri events |
| `storage/` | SQLite persistence (repos, results, sessions, backlog) | All Rust modules via `DbState` |
| `backlog/` | Generate backlog from failed rules, create GitHub issues | `storage/`, `github/issues.rs` |
| `mcp/` (NEW) | MCP server — tools for scan, fix, query, settings | Shares `AppHandle` + `DbState`; calls existing module functions |
| `useGitHubStore` | Auth state, repo list | `github/` via bindings |
| `useDiagnosticsStore` | Scan orchestration, per-repo results, rules | `diagnostics/` via bindings + Tauri events |
| `useBacklogStore` | Backlog items, filtering, issue creation | `backlog/` via bindings |
| Dashboard | Overview, repo grid with health rings, scan button | `useDiagnosticsStore` (realtime) |
| RepoDetailsPage | Per-repo diagnostic breakdown, rescan | `useDiagnosticsStore` |
| Settings extension | MCP toggle, settings persistence | `mcp_toggle` command |

## Recommended Project Structure

The new `mcp/` module slots into the existing Rust structure without disrupting existing modules:

```
src-tauri/src/
├── lib.rs                      # Add: mcp module, mcp commands to collect_commands![]
├── github/                     # Unchanged
├── diagnostics/
│   └── commands.rs             # MODIFY: scan-progress event must include report payload
├── storage/                    # Unchanged
├── backlog/                    # Unchanged
└── mcp/                        # NEW MODULE
    ├── mod.rs                  # pub use; expose toggle command
    ├── server.rs               # McpServer struct (rmcp ServerHandler impl)
    ├── tools/
    │   ├── mod.rs
    │   ├── scan.rs             # tool: scan_repositories
    │   ├── fix.rs              # tool: fix_repo (issue → branch → commit → PR)
    │   ├── query.rs            # tool: query_health, query_backlog
    │   └── settings.rs         # tool: toggle_rules, set_scan_targets
    └── state.rs                # McpState: Arc<AppHandle>, enabled flag

src/
├── core/
│   └── stores/domain/diagnostics/
│       └── scan.slice.ts       # MODIFY: consume report in scan-progress, call updateReport()
└── extensions/
    └── settings/               # ADD: McpSettings.tsx (toggle + status)
```

### Structure Rationale

- **`mcp/` as a first-class Rust module:** Mirrors the pattern of `github/`, `diagnostics/`, etc. Clean boundary — MCP tools call into existing modules, not the reverse.
- **`tools/` subdirectory:** Each MCP tool category is its own file. Keeps `server.rs` small; each tool file contains the business logic.
- **Modify `scan.slice.ts` in place:** The realtime fix is a surgical change to the existing slice — no new slice needed.

## Architectural Patterns

### Pattern 1: Incremental Scan Event with Report Payload

**What:** Extend `scan-progress` Tauri event to carry the completed `RepoHealthReport` alongside the progress counters. The frontend's `scan.slice.ts` calls `updateReport()` on every event, not just at scan completion.

**When to use:** Any time a long-running Rust operation produces results incrementally (one item at a time) that the UI should display without waiting for the full operation to complete.

**Why this is the right fix:** The infrastructure already exists — `app_handle.emit("scan-progress", ...)` fires after each repo. The only change is adding the report to the payload. The `updateReport()` method already exists in `ResultsSlice`. The gap is a 2-line Rust change + a 3-line TypeScript change in `startScan`.

**Current state (broken):**
```rust
// diagnostics/commands.rs — only emits progress metadata
app_handle.emit("scan-progress", ScanProgress {
    total, completed: i as u32, current_repo: repo.full_name.clone(), from_cache,
});
// report is only returned in the final Vec<CachedRepoHealthReport>
```

```typescript
// scan.slice.ts — only updates progress bar, ignores per-repo report
listen<ScanProgress>("scan-progress", (event) => {
    set({ scanProgress: event.payload });  // no report update
});
// setReports() called only when scanAllRepositories() resolves (all repos done)
setReports(result.data.map((c) => c.report));
```

**Fixed state (correct):**
```rust
// diagnostics/commands.rs — extend ScanProgress to carry the completed report
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub total: u32,
    pub completed: u32,
    pub current_repo: String,
    pub from_cache: bool,
    pub report: Option<RepoHealthReport>,  // ADD: Some when a repo finishes
}

// After each repo completes:
app_handle.emit("scan-progress", ScanProgress {
    total,
    completed: (i + 1) as u32,
    current_repo: repo.full_name.clone(),
    from_cache,
    report: Some(report.clone()),  // ADD
});
```

```typescript
// scan.slice.ts — merge report into store on each event
listen<ScanProgress>("scan-progress", (event) => {
    set({ scanProgress: event.payload });
    if (event.payload.report) {
        get().updateReport(event.payload.report);  // ADD: realtime update
    }
});
```

**Trade-offs:** The event payload grows (RepoHealthReport is ~1KB per repo). For 50-100 repos this is negligible. The `setReports()` call at scan end becomes redundant but can remain as a no-op safety net.

### Pattern 2: MCP Server as Rust Subprocess (stdio Transport)

**What:** The MCP server runs as a separate process launched by the MCP client (Claude Code, Cursor, etc.) via stdio. It shares application data by reading from the same SQLite database that the Tauri app writes to.

**When to use:** Any Tauri app that needs to expose capabilities to external AI tools via MCP.

**Why stdio over Streamable HTTP:** The MCP specification (2025-06-18) states "Clients SHOULD support stdio whenever possible." For a desktop app where MCP clients launch the server locally, stdio is the simplest, most universally supported transport. HTTP+SSE is deprecated as of spec 2025-03-26. Streamable HTTP adds complexity (port management, security, session management) without benefit for a local desktop integration.

**Architecture decision:** The MCP server is a separate binary target in `src-tauri/` (or a separate crate in the workspace). It is NOT embedded in the Tauri webview process — this avoids Tauri's Tokio runtime conflicts and the complexity of sharing `AppHandle` state across process boundaries.

**Implementation approach:**

```
MCP Client (Claude Code)
    │  launches subprocess:
    │  path/to/github-automate-mcp
    │  stdin/stdout JSON-RPC
    ▼
github-automate-mcp (separate binary)
    │  reads from: ~/.local/share/github-automate/github-automate.db (same SQLite)
    │  reads token from: OS keychain (same keychain service)
    │  calls GitHub API directly using same HTTP client patterns
    ▼
SQLite DB (shared with Tauri app)
OS Keychain (shared with Tauri app)
GitHub API
```

**Why a separate binary, not embedded in Tauri:**
- No Tauri runtime dependency — MCP server can run without the Tauri window being open
- No Tokio runtime conflict (Tauri v2 issue documented: `tokio::spawn` panics when called outside Tauri's runtime context in some code paths)
- Cleaner: MCP clients expect a simple process they can launch, inspect, and kill
- SQLite WAL mode supports concurrent readers, so both processes can read simultaneously
- On/off toggle in app settings simply means: inform user of the binary path for MCP config

**Cargo workspace addition:**
```toml
# src-tauri/Cargo.toml — add binary target
[[bin]]
name = "github-automate-mcp"
path = "src/mcp/main.rs"

# Or as a separate workspace member
[workspace]
members = [".", "mcp-server"]
```

**Example tool definition using rmcp:**
```rust
use rmcp::{ServerHandler, tool, tool_router, model::ServerInfo};

pub struct GitHubAutomateMcp {
    db_path: PathBuf,
    // Connects to same SQLite + keychain
}

#[tool_router]
impl GitHubAutomateMcp {
    #[tool(description = "Trigger a diagnostic scan of all GitHub repositories")]
    async fn scan_repositories(&self) -> Result<Json<ScanResult>, String> {
        // Reads token from keychain, calls GitHub API, writes to SQLite
        todo!()
    }

    #[tool(description = "Query health scores and diagnostics for repositories")]
    async fn query_health(
        &self,
        #[tool(param)] repo: Option<String>,
    ) -> Result<Json<Vec<RepoHealthReport>>, String> {
        // Reads from SQLite
        todo!()
    }

    #[tool(description = "Fix a repository: create issue, branch, commit, and PR")]
    async fn fix_repo(
        &self,
        #[tool(param)] repo_full_name: String,
        #[tool(param)] rule_id: String,
    ) -> Result<Json<FixResult>, String> {
        // Full pipeline: create issue → create branch from issue →
        // commit fix → create PR
        todo!()
    }
}

#[tool_handler]
impl ServerHandler for GitHubAutomateMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some("GitHubAutomate MCP server — scan, fix, and query GitHub repo health".into()),
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .build(),
            ..Default::default()
        }
    }
}
```

**Trade-offs:** Database reads from two processes require SQLite WAL mode (write-ahead logging), which must be enabled at DB init. WAL is safe for multiple concurrent readers + one writer. The Tauri app remains the sole writer; the MCP server is read-mostly (queries) with occasional writes (backlog items, scan results from MCP-triggered scans).

### Pattern 3: MCP Toggle via Settings Store

**What:** An in-app settings toggle stores the MCP enabled/disabled preference in SQLite. When enabled, the UI displays the MCP binary path and instructions for adding it to Claude Code / Cursor config. The MCP server process is NOT started by Tauri — it is always started by the MCP client. The toggle simply controls whether the feature is surfaced to the user.

**When to use:** Any optional feature that requires external configuration (the MCP client must add the server to its config file manually or via UI).

**Why:** MCP clients (Claude Code, Cursor) require explicit configuration to add servers — Tauri cannot auto-register. The toggle communicates intent ("I want MCP enabled") and shows the user the path they need to configure. This avoids scope creep (auto-registration is Out of Scope per PROJECT.md).

**Implementation:**
```typescript
// settings slice
interface McpSettings {
  enabled: boolean;
  binaryPath: string;  // resolved at runtime: app binary dir + "github-automate-mcp"
}

// Settings UI shows:
// - Toggle switch (enabled/disabled)
// - When enabled: binary path to copy, example JSON config for Claude Code
// - Copy-to-clipboard button for the config snippet
```

## Data Flow

### MCP Request Flow (stdio)

```
MCP Client sends tool call
    │  JSON-RPC via stdin
    ▼
McpServer.call_tool("fix_repo", { repo: "phmatray/foo", rule_id: "has-readme" })
    │
    ├─► query_health from SQLite → confirm rule is failing
    │
    ├─► github/issues.rs → create GitHub issue
    │         returns: issue_number
    │
    ├─► github client → create branch from issue (POST /repos/:owner/:repo/git/refs)
    │         branch name: "fix/issue-{number}-has-readme"
    │
    ├─► github client → create commit with fix (PUT /repos/:owner/:repo/contents/README.md)
    │         commit message: "docs: add README [closes #issue_number]" (conventional)
    │
    └─► github client → create PR (POST /repos/:owner/:repo/pulls)
              title: "fix: add README for phmatray/foo"
              body: references issue

JSON-RPC response → MCP Client via stdout
```

### Realtime Scan Event Flow (Tauri events)

```
User clicks "Scan All" in Dashboard
    │
    ▼
scan.slice.ts: startScan(repos)
    │  set isScanRunning = true
    │  listen("scan-progress", handler)
    │
    ▼
commands.scanAllRepositories(repos)  [Tauri IPC call, awaiting]
    │
    │  For each repo (Rust side):
    │  ├─ Check SHA cache
    │  ├─ Run DiagnosticsEngine (or load from cache)
    │  ├─ Build RepoHealthReport
    │  └─ emit("scan-progress", { total, completed, current_repo, from_cache, report })
    │                │
    │                ▼  [Tauri event, fires immediately, not waiting for all repos]
    │         Frontend handler:
    │         ├─ set({ scanProgress: event.payload })   → progress bar updates
    │         └─ updateReport(event.payload.report)      → health ring updates NOW
    │
    ▼  [after ALL repos done]
commands.scanAllRepositories resolves → Vec<CachedRepoHealthReport>
    │
    ▼
setReports(result.data.map(c => c.report))  [redundant but safe — already updated]
    │  set isScanRunning = false
    ▼
Dashboard re-renders with final state (no visible change — already up to date)
```

### State Subscription Flow (Zustand to React)

```
Zustand store: reports: Record<string, RepoHealthReport>
    │  updateReport("owner/repo") called on each scan-progress event
    │
    ▼
Dashboard component subscribes:
    const reports = useDiagnosticsStore(state => state.reports)
    │  React reconciler detects reports object reference changed
    │
    ▼
RepoCard for "owner/repo" re-renders with new healthScore
    │  health ring SVG animation triggers (CSS transition on stroke-dashoffset)
    ▼
User sees ring fill in realtime as each repo completes
```

### Key Data Flows

1. **Scan progress → realtime UI:** Rust emits enriched `scan-progress` event with completed `RepoHealthReport`. Frontend handler merges into Zustand store immediately. React components subscribed to that specific repo's report re-render.

2. **MCP tool call → GitHub fix pipeline:** MCP server reads GitHub token from keychain, calls GitHub API for issue creation, branch creation, file commit, PR creation. Writes backlog item update to SQLite. Returns structured result to MCP client.

3. **Settings toggle → user config:** In-app toggle stores preference in SQLite. Settings UI displays the MCP binary path and copy-paste config for Claude Code/Cursor. No auto-registration.

4. **MCP scan trigger → Tauri app state:** MCP-triggered scan writes results to SQLite. Tauri app discovers updated data on next `loadCachedDiagnostics()` call or when user manually refreshes. There is NO realtime bridge from MCP process → Tauri window (by design — separate processes). This is acceptable.

## Suggested Build Order

Dependencies between components determine the correct build order:

1. **Realtime scan events (frontend only, no new Rust module)**
   - Modify `ScanProgress` struct in `diagnostics/commands.rs` to add `report: Option<RepoHealthReport>`
   - Modify `scan.slice.ts` to call `updateReport()` in the event handler
   - Update `bindings.ts` placeholder to match new type
   - **Why first:** No new dependencies. Quick win. Validates the event payload extension pattern before MCP work starts.

2. **SQLite WAL mode enablement**
   - Enable WAL mode in `storage/db.rs` `init_db()`: `conn.execute_batch("PRAGMA journal_mode=WAL;")`
   - **Why second:** Required before MCP server can safely read from the same database that Tauri writes. Blocking dependency for MCP.

3. **MCP binary scaffold (`mcp/` module + Cargo target)**
   - Add `rmcp` dependency to `Cargo.toml`
   - Create `src-tauri/src/mcp/` with stub `ServerHandler`
   - Add `[[bin]]` target for `github-automate-mcp`
   - Verify it compiles and launches via stdio
   - **Why third:** Establishes the structure. Query tools (read-only) can be built before fix tools.

4. **MCP query tools (read-only)**
   - `query_health` — reads from SQLite
   - `query_backlog` — reads from SQLite
   - `list_rules` — static data
   - **Why fourth:** Read-only tools have no side effects. Safe to ship and test independently.

5. **MCP scan tool**
   - `scan_repositories` — triggers a fresh scan (reads keychain token, calls GitHub API, writes to SQLite)
   - **Why fifth:** Requires GitHub API access from MCP binary (shared keychain reading).

6. **MCP settings tools**
   - `toggle_rules`, `set_scan_targets` — writes settings to SQLite
   - **Why sixth:** Depends on the settings schema being established.

7. **MCP fix pipeline**
   - `fix_repo` — full issue → branch → commit → PR pipeline
   - **Why last:** Most complex. Depends on all GitHub API patterns being established. Highest risk of GitHub API edge cases.

8. **Settings extension (in-app MCP toggle UI)**
   - `McpSettings.tsx` extension
   - Toggle command (`mcp_enable`, `mcp_disable`) if persisting preference
   - **Why last:** Aesthetic, non-blocking. Can be shipped independently of MCP functionality.

## Anti-Patterns

### Anti-Pattern 1: Embedding the MCP Server in the Tauri Process

**What people do:** Spin up a Tokio HTTP server inside `tauri::Builder::setup()` using `tauri::async_runtime::spawn()` and share `AppHandle` state with MCP handlers.

**Why it's wrong:**
- Tauri v2 has documented issues with `tokio::spawn` called outside Tauri's runtime context in certain code paths
- SSE transport (HTTP+SSE) is deprecated as of MCP spec 2025-03-26
- Streamable HTTP requires port management, security headers, origin validation, session management — significant complexity overhead
- Couples MCP server lifetime to Tauri window lifetime (MCP dies when window closes)
- AppHandle is not `Send + Sync` in all contexts required by axum handlers

**Do this instead:** Run MCP as a separate binary using stdio transport. Share data via SQLite (WAL mode) and OS keychain. MCP clients expect to launch processes themselves — this is the intended deployment model.

### Anti-Pattern 2: Batch-Updating Reports at Scan Completion

**What people do:** Call `setReports(allResults)` only when `scanAllRepositories` resolves. This is the current behavior.

**Why it's wrong:** The scan of 50+ repos takes 2-5 minutes. Users see a progress bar counting up but health rings don't update until the very end. The illusion of realtime is broken.

**Do this instead:** Extend the `scan-progress` event payload to include the completed `RepoHealthReport` and call `updateReport()` in the event handler. Each repo's health ring fills in immediately when that repo's scan finishes.

### Anti-Pattern 3: Rebuilding Existing Module Logic in MCP Tools

**What people do:** Copy-paste the `DiagnosticsEngine` logic, GitHub API calls, and backlog generation into MCP tool handlers.

**Why it's wrong:** Dual maintenance burden. Logic drifts. Bugs get fixed in one place and not the other.

**Do this instead:** Move shared business logic (diagnostics engine, GitHub client, storage functions) into the shared library crate (`github_automate_lib`). Both the Tauri binary and the MCP binary link against it. The Tauri-specific code (commands, `AppHandle`, Tauri events) stays in the Tauri binary. The MCP-specific code (stdio server, tool routing) stays in the MCP binary. Shared domain logic lives in `lib`.

### Anti-Pattern 4: Using HTTP+SSE Transport for MCP

**What people do:** Implement an HTTP server with `/sse` and `/messages` endpoints following the deprecated 2024-11-05 MCP spec.

**Why it's wrong:** HTTP+SSE transport is explicitly deprecated in MCP spec 2025-03-26. New MCP clients will not support it. The only supported transports are stdio and Streamable HTTP.

**Do this instead:** Use stdio for local desktop MCP integration. If remote/multi-client access is ever needed, implement Streamable HTTP (single `/mcp` endpoint, POST + GET, optional SSE).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub API | Shared: both Tauri app and MCP binary use the same HTTP client patterns | Token read from OS keychain by both processes |
| OS Keychain | Both processes read the same keychain entry | Keychain service: `com.githubautomate.desktop.github` — must be identical in both |
| SQLite | Shared file, WAL mode for concurrent access | WAL must be enabled; MCP binary should open read-write but treat itself as a secondary writer |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Rust diagnostic engine ↔ MCP tools | Shared library (link against `github_automate_lib`) | Move engine out of Tauri-specific code |
| MCP binary ↔ Tauri window | None (by design) | MCP writes to SQLite; Tauri reads on next load |
| scan.slice.ts ↔ Rust scan command | Tauri events (enriched `scan-progress`) + IPC command return | Events for incremental updates; return value as safety net |
| Settings extension ↔ MCP feature | SQLite preference table | No direct coupling; settings writes, MCP reads |

## Scaling Considerations

This is a desktop app used by 1-5 engineers at a time, not a multi-tenant SaaS. Scaling is not a concern. The relevant capacity consideration is:

| Concern | Reality | Approach |
|---------|---------|----------|
| Number of repos | 50-200 repos per scan | Per-repo events work fine; event payload ~1KB per repo |
| Concurrent MCP clients | 1-2 (user's own AI tools) | stdio is single-client by design; acceptable |
| SQLite concurrent access | 1 writer (Tauri), 1-2 readers (MCP, queries) | WAL mode handles this natively |
| Scan duration | 2-5 minutes for 50+ repos (GitHub API rate limits) | Cancellation already implemented; incremental UI is the UX fix |

## Sources

- MCP Transports specification (2025-06-18): https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
  — Confidence: HIGH (official spec, read directly)
- Official Rust SDK for MCP (rmcp): https://github.com/modelcontextprotocol/rust-sdk
  — Confidence: HIGH (official repository)
- rmcp API docs: https://docs.rs/rmcp/latest/rmcp/
  — Confidence: HIGH (official docs)
- "Why MCP Deprecated SSE and Went with Streamable HTTP" (2025-06-06): https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-went-with-streamable-http/
  — Confidence: MEDIUM (verified against official spec)
- Tauri state management: https://v2.tauri.app/develop/state-management/
  — Confidence: HIGH (official docs)
- Loosely synchronize Zustand stores in Tauri: https://www.gethopp.app/blog/tauri-window-state-sync
  — Confidence: MEDIUM (community, matches official event patterns)
- Tauri local server patterns: https://blog.huakunshen.com/Full-Stack/Framework/Tauri/server
  — Confidence: MEDIUM (community article, verified against Tauri docs)
- mcp-server-tauri (hypothesi, WebSocket-based reference): https://github.com/hypothesi/mcp-server-tauri
  — Confidence: MEDIUM (community project, used as pattern reference only)
- Codebase analysis (ARCHITECTURE.md, STRUCTURE.md, scan.slice.ts, diagnostics/commands.rs)
  — Confidence: HIGH (direct code review)

---
*Architecture research for: GitHubAutomate — MCP server + realtime diagnostics*
*Researched: 2026-02-26*

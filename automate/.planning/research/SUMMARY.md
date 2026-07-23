# Project Research Summary

**Project:** GitHubAutomate
**Domain:** Tauri 2 desktop app — MCP server integration + realtime diagnostics UI + GitHub workflow automation
**Researched:** 2026-02-26
**Confidence:** HIGH

## Executive Summary

GitHubAutomate is a local-first GitHub repository health tool with a working scan pipeline, SQLite persistence, and Zustand state management. The two new capabilities being added are: (1) a Model Context Protocol server so AI coding assistants (Claude Code, Cursor, Windsurf) can invoke scans, queries, and fix pipelines programmatically; and (2) realtime per-repo health ring updates during a scan rather than a batch reveal at the end. Research across four domains — stack, features, architecture, and pitfalls — converges on a clear, low-risk implementation path because the existing Tauri codebase already provides most of the infrastructure: the scan events fire per-repo, the Zustand store already has `updateReport()`, and the GitHub API client handles authentication.

The recommended approach is a **stdio MCP server as a separate Cargo binary** that shares the app's SQLite database (via WAL mode) and OS keychain. This is simpler, more compatible with all MCP clients, and avoids the Tauri runtime conflicts that arise when embedding an HTTP server inside the Tauri process. The realtime UI fix is a surgical 5-line change: extend the `ScanProgress` Rust struct with `report: Option<RepoHealthReport>` and call `updateReport()` in the TypeScript event handler. Both changes are additive and do not break existing functionality.

The key risks are operational rather than architectural: stdout logging in the MCP binary silently corrupts the JSON-RPC protocol stream; event listeners in React can accumulate without cleanup causing duplicate state updates; and the GitHub fix pipeline (issue → branch → commit → PR) must be designed with retry logic because GitHub's API is eventually consistent for newly-created refs. All three risks have well-documented prevention strategies and are addressed by building in the correct order — foundations before tools, query tools before write tools, write tools before the full fix pipeline.

---

## Key Findings

### Recommended Stack

The existing stack (Tauri 2, Rust, React 19, Zustand v5, SQLite via rusqlite) requires only three new Cargo dependencies: `rmcp` (0.8, the official Rust MCP SDK from the `modelcontextprotocol` org), `axum` (0.8, only needed if HTTP transport is chosen), and `schemars` (1.0, for JSON Schema generation from Rust types). No new npm packages are needed for the realtime UI milestone — the fix is entirely in how `scan.slice.ts` consumes events that already arrive.

**Core technologies:**
- `rmcp` 0.8 (crates.io stable): MCP server handler with `#[tool]` and `#[tool_box]` macros — eliminates boilerplate; official SDK tracks the canonical spec
- `tauri::async_runtime::spawn()`: correct way to launch async background tasks in Tauri 2 — avoids "no reactor running" panics from raw `tokio::spawn`
- `@tauri-apps/api/event` `listen()`: already installed; the realtime fix requires only changing the callback body to call `updateReport()` per event
- SQLite WAL mode (`PRAGMA journal_mode=WAL`): must be enabled before the MCP binary can safely read from the same database that the Tauri app writes to

**Transport decision:** Use **stdio** (not HTTP+SSE, not Streamable HTTP) for the MCP server. The MCP spec (2025-06-18) states "Clients SHOULD support stdio whenever possible." All major clients (Claude Code, Cursor, Windsurf) support stdio. HTTP+SSE transport is deprecated as of MCP spec 2025-03-26. Streamable HTTP adds port management, security headers, and session complexity without benefit for a local desktop integration where a single user's AI tool launches the process.

### Expected Features

Research identified a clear P1 / P2 / P3 split based on user value and implementation cost.

**Must have (table stakes — v1 launch):**
- HTTP/SSE transport on `127.0.0.1:3742` (or stdio) — without this, no MCP client connects
- `scan_repositories` tool — primary trigger for AI agents
- `get_health_scores` tool — agents must read state before acting
- `get_backlog_items` tool — agents must know what exists to avoid duplicate actions
- `create_github_issue` tool — primary write action for AI agents
- `scan_single_repository` tool — focused fix workflows without full scan cost
- `get_diagnostic_rules` tool — agents need to discover rule definitions
- MCP on/off toggle in settings — users must control whether MCP is active
- Per-repo incremental health ring updates during scan (the most visible UX gap)
- Per-repo "scanning" skeleton/spinner state tracking
- MCP progress notifications during scan — prevents agents from seeing frozen tool calls
- Well-formed JSON Schema on every tool; names matching `^[a-zA-Z0-9_-]{1,64}$`; structured `isError: true` errors

**Should have (competitive differentiators — v1.x):**
- `fix_repository` full pipeline tool (issue → branch → conventional commit → PR) — no other tool automates the full remediation loop; high value, high complexity; validate agent usage patterns first
- `toggle_diagnostic_rule` tool — agents can adjust scan configuration without switching to the app
- MCP progress notifications during scan (`notifications/progress` with `progressToken`)
- Skeleton loading per repo card + animated health ring fill transitions
- Resources for scan history (`github-automate://scan-sessions`) — lower priority than tools for most MCP clients

**Defer (v2+):**
- MCP Tasks primitive for async scan jobs — experimental in 2025-11-25 spec; stabilize before adopting
- `resources/subscribe` for live scan updates — complex SSE multiplexing; defer until resource usage is validated
- Multi-account GitHub support — architectural change, out of scope
- Rule authoring UI — separate product surface

**Anti-features to avoid:**
- MCP auto-registration into client configs — security-hostile; show copy-paste snippet in Settings instead
- MCP tool for every individual Tauri command — tool overload degrades LLM selection; keep to ~10 tools max
- Streaming scan results from MCP tool call — not standard per spec; use `notifications/progress` instead
- Push code fixes via desktop UI (non-MCP) — fix pipeline belongs to the agent path only

### Architecture Approach

The MCP server is a separate Cargo binary (`github-automate-mcp`) that runs as a subprocess launched by MCP clients via stdio. It shares data with the Tauri app through the same SQLite database (WAL mode for concurrent read safety) and reads the GitHub OAuth token from the same OS keychain service (`com.githubautomate.desktop.github`). Business logic (diagnostics engine, GitHub client, storage functions) moves into a shared library crate (`github_automate_lib`) so both binaries link against it without code duplication. The realtime UI is a targeted modification to `scan.slice.ts` and `diagnostics/commands.rs` — no new architectural components needed.

**Major components:**
1. `mcp/` (new Rust module/binary) — stdio MCP server using rmcp; tools call shared lib functions; never embeds in Tauri process
2. `github_automate_lib` (new shared crate) — diagnostics engine, GitHub client, storage functions extracted from Tauri binary
3. `ScanProgress` struct extension (Rust) — adds `report: Option<RepoHealthReport>` field; enables incremental frontend updates
4. `scan.slice.ts` modification (TypeScript) — calls `updateReport()` in the `scan-progress` event handler; the existing `setReports()` at scan end becomes a redundant safety net
5. `settings/` extension (new React component) — MCP toggle UI with binary path display and config copy-paste snippet

**Key patterns:**
- Results stored as `Record<repoId, RepoHealthReport>` (not array) — enables surgical per-repo Zustand updates without triggering full list re-renders
- `subscribeWithSelector` per repo card — O(1) renders per scan event instead of O(n)
- `unlisten()` cleanup stored and called before every re-registration — prevents memory leak from HMR and navigation cycles
- WAL mode enabled at DB init before any MCP binary can connect

### Critical Pitfalls

1. **stdout logging corrupts MCP stdio protocol** — Any `println!` in the MCP binary silently corrupts the JSON-RPC stream; configure all logging to stderr/file (`tracing_subscriber::with_writer(std::io::stderr)`) before writing any tool code. Validate with MCP Inspector.

2. **Event listener memory leak on re-subscription** — `listen("scan-progress", callback)` returns an `unlisten` fn that must be stored and called before re-registering; React strict mode double-mounting surfaces this; the known race condition in `scan.slice.ts:42,68` must be fixed as part of the realtime update work.

3. **Per-repo Zustand update triggers full list re-render** — Storing results as a flat array with reference equality means 100 repos = 100 full re-renders during scan; fix is `Record<repoId, Report>` shape + `subscribeWithSelector` per card; verify with React DevTools Profiler.

4. **GitHub API sequential operations fail under eventual consistency** — Branch creation returns 201 before the branch is available for commits; implement retry-with-backoff (max 3s) between pipeline steps; make the fix pipeline idempotent (check before creating).

5. **MCP tool descriptions are the API contract** — Vague descriptions cause the LLM to invoke the wrong tool, potentially triggering destructive write operations; prefix descriptions with READ-ONLY or WRITE; keep each tool to single responsibility; test with MCP Inspector before connecting to live GitHub API.

6. **MCP error responses must not contain GitHub token or HTTP headers** — Raw `reqwest::Error` can include request context including auth headers; define a sanitized `McpError` type that strips all HTTP metadata; audit every `Err(e)` return path.

7. **OAuth Client ID is borrowed from FlowForge** — If FlowForge rotates their OAuth app, all GitHubAutomate users silently lose auth; register a dedicated GitHub OAuth App before any distribution.

---

## Implications for Roadmap

Based on the dependency graph from architecture research and the pitfall-to-phase mapping, the correct build order is: fix the UI first (no new dependencies, immediate value), then lay the MCP foundation (logging, error types, WAL mode), then read-only tools, then the scan tool, then write tools, and finally the full fix pipeline.

### Phase 1: Realtime Scan UI

**Rationale:** Zero new dependencies. The `scan-progress` Tauri event already fires per-repo with full diagnostic data. The only gap is how the frontend consumes it. Fixing this first validates the event payload extension pattern, delivers the most visible UX improvement immediately, and forces a correct resolution of the known `scan.slice.ts` listener lifecycle bug before any new event consumers are added.

**Delivers:** Health rings update live per-repo during scan; determinate progress bar; per-repo skeleton state; cancellation state reset fixed; event listener memory leak fixed.

**Addresses features:** Per-repo incremental health ring updates, per-repo scanning skeleton state, scan completion toast.

**Avoids pitfalls:** Batch-at-end UI trap; event listener memory leak; full list re-render on per-repo update.

**Stack used:** No new packages — `@tauri-apps/api/event`, Zustand `subscribeWithSelector`, Rust `ScanProgress` struct extension.

**Research flag:** Standard patterns — skip research-phase. The fix is well-understood and documented in both the ARCHITECTURE.md code samples and PITFALLS.md.

---

### Phase 2: MCP Foundation (Binary Scaffold + Safety Infrastructure)

**Rationale:** Must establish logging discipline, error sanitization, and WAL mode before any tool code is written. These are "fix-once" decisions that cannot be retrofitted cheaply. WAL mode is a blocking dependency for all MCP work. The sanitized error type must exist before any GitHub API call is made from MCP context.

**Delivers:** Compilable `github-automate-mcp` binary with stub `ServerHandler`; WAL mode enabled in `storage/mod.rs`; `tracing_subscriber` logging to stderr only; sanitized `McpError` type; MCP Inspector connects and receives `tools/list` response.

**Addresses features:** HTTP/SSE transport foundation (or stdio), MCP on/off toggle infrastructure.

**Avoids pitfalls:** stdout logging corruption; token exposure via MCP error response; SQLite concurrent access deadlock.

**Stack used:** `rmcp` 0.8 with `server` + `macros` features; `schemars` 1.0; `tracing_subscriber`; new `[[bin]]` target in `Cargo.toml`.

**Research flag:** Standard patterns for rmcp scaffold — skip research-phase. WAL mode is a one-liner. Error type design is straightforward.

---

### Phase 3: MCP Read-Only Query Tools

**Rationale:** Read-only tools have no side effects and can be safely shipped and tested independently. They establish the pattern for tool definition, JSON Schema generation, and response serialization before any write operations are introduced. Testing these tools validates that the MCP binary correctly reads from the shared SQLite database.

**Delivers:** `get_health_scores` tool; `get_backlog_items` tool; `get_diagnostic_rules` tool; pagination on result sets (default 20 repos); human-readable field names in responses.

**Addresses features:** `get_health_scores`, `get_backlog_items`, `get_diagnostic_rules` (all P1).

**Avoids pitfalls:** Tool overload (keep to minimal focused set); MCP tool descriptions as API contract (explicit READ-ONLY prefix).

**Stack used:** rmcp `#[tool]` macros; rusqlite read queries against shared DB; `schemars` for input schemas.

**Research flag:** Standard patterns — skip research-phase.

---

### Phase 4: MCP Scan Tool + Settings Integration

**Rationale:** The scan tool requires GitHub API access from the MCP binary (keychain read + HTTP calls), which is a new integration point that must be validated before the more complex write pipeline. The settings UI (MCP toggle + binary path display) can ship in this phase since the binary now exists and has a meaningful capability.

**Delivers:** `scan_repositories` tool (triggers full scan, writes to SQLite); `scan_single_repository` tool; MCP progress notifications during scan (`notifications/progress`); Settings extension with toggle and copy-paste config snippet.

**Addresses features:** `scan_repositories` (P1), `scan_single_repository` (P1), MCP progress notifications (P1), MCP on/off toggle (P1).

**Avoids pitfalls:** Incremental scan cache respect for MCP-triggered scans (use SHA cache to avoid rate limit exhaustion); zombie process on toggle-off (settings toggle informs user of binary path, not lifecycle management).

**Stack used:** rmcp scan tool; OS keychain read from MCP binary; rate limit pre-flight check; `tauri-plugin-store` for settings persistence.

**Research flag:** Needs research-phase during planning — keychain access from a subprocess (not Tauri context) needs verification of the `security-framework` crate pattern on macOS vs Linux.

---

### Phase 5: MCP Write Tools (Issue Creation)

**Rationale:** `create_github_issue` is the primary write action and relatively low risk compared to the full fix pipeline — it is a single API call with no sequential dependencies and no branch protection concerns. Adding `toggle_diagnostic_rule` in this phase establishes the settings mutation pattern.

**Delivers:** `create_github_issue` tool with `confirmed: true` parameter requirement; `toggle_diagnostic_rule` tool; input validation against `^[a-zA-Z0-9_.-]+$` for owner/repo params; idempotency check (does issue already exist for this rule + repo?).

**Addresses features:** `create_github_issue` (P1), `toggle_diagnostic_rule` (P2).

**Avoids pitfalls:** Unexpected commits without user confirmation; prompt injection via freeform owner/repo strings; duplicate issue creation on retry.

**Stack used:** `github/issues.rs` called from MCP binary via shared lib; input validation in Rust before any API call.

**Research flag:** Standard patterns — skip research-phase.

---

### Phase 6: GitHub Automation Pipeline (fix_repository)

**Rationale:** The full fix pipeline (issue → branch → conventional commit → PR) is the highest-value differentiator and also the highest-risk implementation. It must come last because it depends on all GitHub API patterns being established, requires branch protection pre-flight checks, and needs idempotency + retry logic for eventual consistency. Validate that agents actually use the query and scan tools before investing in this phase.

**Delivers:** `fix_repository` tool with full pipeline; branch protection pre-flight check; retry-with-backoff on branch availability; pipeline transaction log in SQLite; orphaned artifact cleanup tool; PR body auto-generated from diagnostic rule description.

**Addresses features:** `fix_repository` full pipeline (P2), optimistic UI on backlog creation (P3).

**Avoids pitfalls:** GitHub API sequential operation race (retry-with-backoff); branch protection blocking PR (pre-flight check); orphaned pipeline artifacts on failure (transaction log + cleanup tool); fix pipeline idempotency (check before create).

**Stack used:** New `github/` commands: `create_branch_from_issue`, `commit_conventional_fix`, `create_pull_request`; SQLite pipeline log table; exponential backoff in Rust.

**Research flag:** Needs research-phase during planning — GitHub API endpoints for branch creation from issue number, conventional commit file content creation via API (not git CLI), and PR auto-linking to issues need verification. Edge cases (empty repos, forks, archived repos) need explicit handling.

---

### Phase Ordering Rationale

- **Realtime UI first** because it has zero new dependencies and delivers the highest UX impact immediately; the event listener fix is also a prerequisite for correctness of all future event work.
- **MCP foundation before tools** because logging discipline and the sanitized error type cannot be retrofitted — every tool written before these are in place will need auditing.
- **Read-only tools before write tools** because they validate the shared-DB pattern, tool schema generation, and MCP client connectivity with zero side-effect risk.
- **Scan tool before issue tool** because it validates keychain access from the MCP subprocess — the hardest new integration point.
- **Fix pipeline last** because it has the most GitHub API edge cases, requires all prior patterns to be established, and is the phase most likely to need mid-implementation course corrections.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (MCP Scan Tool):** Keychain access from a non-Tauri subprocess on macOS (`security-framework` crate) vs Linux (`keyring` crate) — verify the token read path works correctly before implementing the scan tool's GitHub API calls.
- **Phase 6 (Fix Pipeline):** GitHub API endpoints for branch creation from issue number, file content creation via API (vs git CLI), conventional commit message format enforcement in the API layer, and edge case handling (archived repos, forks, empty repos without default branch).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Realtime UI):** The fix is documented line-by-line in ARCHITECTURE.md with code samples.
- **Phase 2 (MCP Foundation):** rmcp scaffold, WAL mode pragma, and tracing stderr config are all well-documented.
- **Phase 3 (Read-only Tools):** rmcp `#[tool]` macro pattern is established; SQLite read queries mirror existing storage patterns.
- **Phase 5 (Write Tools — Issue Creation):** Single GitHub API call; existing `github/issues.rs` provides the pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | rmcp official SDK from `modelcontextprotocol` org; Tauri event patterns from official docs; no new frontend packages needed |
| Features | HIGH | MCP spec 2025-11-25 is official and stable; feature table verified against MCP Inspector and client documentation |
| Architecture | HIGH | Separate binary + stdio pattern is documented in official MCP spec and verified against real-world reference apps (MCP Bouncer); codebase was directly analyzed |
| Pitfalls | MEDIUM-HIGH | Transport and MCP pitfalls HIGH from official sources; Tauri-specific pitfalls MEDIUM (confirmed GitHub issues on Tauri repo); GitHub API eventual consistency HIGH from official GitHub community |

**Overall confidence:** HIGH

### Gaps to Address

- **Keychain access from MCP subprocess:** The Tauri app uses the OS keychain via Tauri's managed state. The MCP binary must read the same keychain entry using `security-framework` (macOS) or `keyring` (cross-platform) directly, without Tauri's managed state. This integration needs a small spike during Phase 4 planning to confirm the crate and service name alignment.

- **Shared library crate extraction:** Moving business logic from the Tauri binary into a shared `github_automate_lib` crate is architecturally correct but is a refactoring step that must be carefully sequenced. During Phase 2 planning, decide whether to do this upfront (cleaner, more work) or start with copy-paste-and-later-consolidate (faster, tech debt). The PITFALLS.md explicitly flags dual-maintenance as an anti-pattern.

- **OAuth Client ID:** The current Client ID (`Ov23lih0tEvsx8CNhNgv`) belongs to FlowForge. A dedicated GitHub OAuth App must be registered before any distribution. This is flagged in MEMORY.md as a TODO. It is not blocking for development but is blocking for any public release.

- **MCP tool count vs LLM selection degradation:** Research recommends maximum ~10 tools for v1. The current P1 tool list is 7 tools (scan, get_health, get_backlog, create_issue, scan_single, get_rules, settings toggle). This is within the safe range. Monitor tool invocation accuracy before adding P2 tools.

---

## Sources

### Primary (HIGH confidence)
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — tools, resources, progress, transport specs
- [MCP Transports specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) — stdio vs Streamable HTTP decision
- [modelcontextprotocol/rust-sdk (GitHub)](https://github.com/modelcontextprotocol/rust-sdk) — rmcp official SDK, `#[tool]` macros, feature flags
- [rmcp API docs (docs.rs)](https://docs.rs/rmcp/latest/rmcp/) — feature flags and `ServerHandler` trait
- [Tauri v2: Calling the Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) — `AppHandle.emit()`, `Channel`, `listen()` patterns
- [Tauri GitHub Issue #12724](https://github.com/tauri-apps/tauri/issues/12724) — confirmed memory leak from continuous event emission
- [Tauri GitHub Issue #13133](https://github.com/tauri-apps/tauri/issues/13133) — confirmed Channel-based memory leak
- [Tauri GitHub Issue #8916](https://github.com/tauri-apps/tauri/issues/8916) — confirmed unlisten bug
- [GitHub Community Discussion #26333](https://github.com/orgs/community/discussions/26333) — API race condition on ref creation
- [MCP Security Risks and Controls — Red Hat](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls) — security-focused analysis
- Codebase analysis — `diagnostics/commands.rs`, `scan.slice.ts`, `storage/mod.rs`, `.planning/codebase/CONCERNS.md`

### Secondary (MEDIUM confidence)
- [MCP Bouncer (Tauri + rmcp reference app)](https://github.com/catkins/mcp-bouncer) — real-world pattern of Tauri 2 + MCP server at `127.0.0.1:8091/mcp`
- [Shuttle.dev: Build a Streamable HTTP MCP Server in Rust](https://www.shuttle.dev/blog/2025/10/29/stream-http-mcp) — rmcp 0.8 + axum 0.8 setup verified
- [GitHub MCP Server (official)](https://github.com/github/github-mcp-server) — reference implementation for tool categories
- [MCP Server Best Practices 2026 — CData](https://www.cdata.com/blog/mcp-server-best-practices-2026) — practitioner guidance on tool count and descriptions
- [Implementing MCP: Tips, Tricks and Pitfalls — Nearform](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) — practitioner experience
- [MCP Transport Protocols — MCPcat](https://mcpcat.io/guides/comparing-stdio-sse-streamablehttp/) — protocol comparison with failure modes
- [Why MCP Deprecated SSE — blog.fka.dev](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-went-with-streamable-http/) — verified against official spec

### Tertiary (LOW-MEDIUM confidence)
- [HackMD: Coder's Guide to rmcp](https://hackmd.io/@Hamze/S1tlKZP0kx) — `#[tool]`, `#[tool_box]` macros cross-referenced with official SDK
- [UI/UX Trends AI Apps 2026 — GroovyWeb](https://www.groovyweb.co/blog/ui-ux-design-trends-ai-apps-2026) — trend analysis for realtime UI patterns
- [Tauri local server patterns — blog.huakunshen.com](https://blog.huakunshen.com/Full-Stack/Framework/Tauri/server) — community article verified against Tauri docs

---

*Research completed: 2026-02-26*
*Ready for roadmap: yes*

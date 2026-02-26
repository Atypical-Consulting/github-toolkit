# Feature Research

**Domain:** GitHub repository diagnostics desktop app — MCP server integration + realtime scan UI
**Researched:** 2026-02-26
**Confidence:** HIGH (MCP spec from official docs, realtime UI patterns from multiple verified sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `tools/list` endpoint returns all exposed tools | MCP clients (Claude Code, Cursor, Windsurf) call `tools/list` on connect — no tools = server appears broken | LOW | Must declare `tools` capability in server init; `listChanged: true` if tools can be toggled |
| Well-formed JSON Schema for every tool input | MCP clients use `inputSchema` to generate UI and validate args before calling; missing/null schema breaks all clients | LOW | Use `{ "type": "object", "additionalProperties": false }` for no-arg tools; JSON Schema 2020-12 by default |
| Human-readable `description` on every tool | LLMs use tool descriptions as primary selection signal — vague or missing descriptions = tools never invoked correctly | LOW | 1–2 sentences, include what the tool does, when to use it, and any constraints (e.g. "requires completed scan") |
| Tool names in `snake_case`, max 64 chars, no spaces | Specification requirement; violating causes client parse failures. GPT-4o tokenizer optimizes for snake_case | LOW | Pattern: `^[a-zA-Z0-9_-]{1,64}$`. Use prefix like `github_automate_` to namespace tools |
| Structured error responses with `isError: true` | MCP clients surface errors to LLMs for self-correction; bare exceptions break the retry loop | LOW | Return `{ content: [{ type: "text", text: "..." }], isError: true }` for business logic failures; JSON-RPC errors for protocol failures |
| `scan_repositories` tool (trigger a scan) | Core user value: AI agents must be able to initiate scans on demand | MEDIUM | Calls existing `scan_all_repositories` Rust command; must bridge Tauri IPC into HTTP/SSE transport |
| `get_health_scores` tool (query repo health) | Agents need to read current state to reason about what to fix | LOW | Reads from SQLite `diagnostic_results` table; returns array of repos with health scores |
| `get_backlog_items` tool (query backlog) | Agents must know what exists before creating duplicate issues or PRs | LOW | Filters by owner, severity, status; maps to existing `backlog_items` table |
| `create_github_issue` tool (act on backlog) | Primary write action; agents need to escalate items to GitHub | LOW | Wraps existing `create_github_issue_from_backlog` Rust command |
| HTTP/SSE transport on localhost | All major MCP clients (Claude Code, Cursor, Windsurf) support HTTP+SSE as of 2025; stdio is dev-only | MEDIUM | Tauri 2 can spawn a local Axum/warp HTTP server in Rust; default port e.g. `127.0.0.1:3742` |
| Health rings update per-repo during scan (not after) | Users expect to see repos updating live as each finishes — "scan done" batch reveal feels broken/frozen | MEDIUM | Tauri `scan-progress` events already fire per-repo; gap is `scan.slice.ts` not applying results incrementally |
| Per-repo progress indicator during scan | Users need to know which repos are actively scanning vs. queued vs. done | LOW | Already have `scan-progress` event with `repo_full_name` field; frontend needs to track `scanning` state per repo |
| Scan completion toast/notification | Users need confirmation that a potentially-long scan finished | LOW | `log` store + `ToastOverlay` already exists in codebase |
| MCP on/off toggle in settings | Not all users want AI tool access; server should be optional | LOW | `mcp_server_enabled` setting in SQLite `app_settings` table; Tauri app starts/stops server on toggle |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `fix_repository` tool — full pipeline (issue → branch → conventional commit → PR) | No other GitHub diagnostics tool automates the full remediation loop from an AI agent; agents can close issues end-to-end without leaving their IDE | HIGH | Chains: `create_issue` → `create_branch_from_issue` → `commit_fix` (conventional format) → `create_pr`. Needs new Rust commands in `github/` module |
| MCP progress notifications during scan | Long scans (50+ repos) would appear frozen in AI clients; progress lets agents report status to users in real-time | MEDIUM | Use `notifications/progress` with `progressToken`; emit after each repo with `progress: N, total: M, message: "Scanning owner/repo"` |
| `scan_single_repository` tool | Agents can target a specific repo for diagnosis without triggering a full scan — useful for focused fix workflows | LOW | Wraps existing `scan_repository_cached` command; add `owner` + `repo` + `default_branch` params |
| Resources for scan history (`github-automate://scan-sessions`) | MCP resources let agents attach historical scan data as context without calling a tool — cleaner for analysis workflows | MEDIUM | Expose `scan_sessions` table rows as resources; `resources/list` returns sessions, `resources/read` returns full session report |
| `get_diagnostic_rules` tool | Agents can discover what rules exist before deciding which to toggle — necessary for settings automation | LOW | Returns rule definitions (id, name, default_severity, enabled); reads from Rust's `default_rules()` |
| `toggle_diagnostic_rule` tool | Agents can adjust scan configuration without the user switching to the app — enables context-aware rule management | LOW | Upserts `rule_config` in SQLite; restarts engine with updated rule set |
| Skeleton loading per repo card during scan | Maintains layout stability; prevents jarring card resize when health data arrives incrementally | LOW | CSS skeleton animation on health ring and stats fields while repo scan is in-progress; disappears when data arrives |
| Animated health ring fill (smooth transition) | Rings that snap from empty to value feel broken; smooth animation conveys "live update" | LOW | CSS transition on SVG stroke-dashoffset; ~300ms ease-in-out when score updates |
| Optimistic UI on backlog item creation | Creating an issue feels instant — no spinner required for a confident AI-driven action | LOW | Add item to Zustand store immediately; reconcile with server response; roll back on error |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| MCP auto-registration into client configs (`~/.cursor/mcp.json`, etc.) | Reduces onboarding friction — users won't have to copy/paste config | Modifying config files in other apps without explicit user action is security-hostile; breaks trust model; brittle to client version changes | Show the config snippet in Settings UI with a one-click Copy button; user pastes it themselves |
| Configurable MCP port/transport in UI | Power users want to choose the port | Adds a config surface that must be persisted, validated, and communicated to users; most users never change it | Hardcode a high, unlikely-to-conflict port (`3742`); expose it in the Settings info panel so users can see it |
| "Scan on MCP tool call" without app running | Seamless agent experience if app isn't open | Requires a background daemon separate from Tauri; out-of-scope desktop architecture; security surface for always-on network listener | Document that MCP server requires the app to be running; add tray icon so app can stay running minimized |
| MCP tool for every individual Tauri command | Comprehensive coverage / future-proofing | Tool overload degrades LLM tool selection — too many tools = model picks wrong one; MCP spec recommends minimal, focused tool sets | Group related operations; expose toolsets (~10 tools max for v1); add more after validating which agents actually use |
| Push code fixes via desktop UI (non-MCP) | Users want a one-click "Fix All" button | Fix automation requires git operations (branch, commit, PR) on behalf of the user — doing this from a UI button without agent context produces arbitrary commits; agent has the context, UI doesn't | Fix pipeline lives only in MCP; UI shows backlog items + "Create Issue" only; agents drive the automated fix path |
| Streaming scan results from MCP tool call | Agents get incremental updates inside their conversation | MCP tools are request-response; streaming inside a `tools/call` response is not standard as of 2025-11-25 spec; progress notifications are the correct mechanism | Use `notifications/progress` with `progressToken` for per-repo updates; return final result array when scan completes |
| Global rate-limit sharing between MCP and Tauri UI | Prevents double-counting API calls | Overly complex to coordinate; Tauri commands already check rate limits before operations | MCP tool implementations go through the same Rust `github/rate_limit.rs` check — same protection, no extra coordination needed |

---

## Feature Dependencies

```
[MCP server on/off toggle]
    └──requires──> [HTTP/SSE transport (Axum server in Rust)]
                       └──requires──> [MCP tool implementations]
                                          └──requires──> [Existing Tauri commands (scan, backlog, etc.)]

[fix_repository tool]
    └──requires──> [create_github_issue tool]
    └──requires──> [New: create_branch_from_issue command (Rust)]
    └──requires──> [New: commit_fix command (Rust)]
    └──requires──> [New: create_pr command (Rust)]

[MCP progress notifications]
    └──requires──> [HTTP/SSE transport]
    └──enhances──> [scan_repositories tool]

[Resources: scan history]
    └──requires──> [HTTP/SSE transport]
    └──requires──> [Existing scan_sessions SQLite table]

[Realtime health ring updates]
    └──requires──> [scan-progress Tauri event (already exists)]
    └──requires──> [scan.slice.ts applying results incrementally (gap to fix)]

[Skeleton loading per repo]
    └──enhances──> [Realtime health ring updates]
    └──requires──> [Per-repo "is scanning" state tracked in Zustand]

[toggle_diagnostic_rule tool]
    └──enhances──> [get_diagnostic_rules tool]
    └──requires──> [Rule config persistence in SQLite (new table)]

[get_backlog_items tool]
    └──enhances──> [create_github_issue tool]
    └──requires──> [get_health_scores tool] (backlog only exists after a scan)

[Optimistic UI on backlog item creation]
    └──requires──> [Zustand backlog store] (already exists)
    └──conflicts──> [Spinner/loading state on issue creation] (pick one pattern)
```

### Dependency Notes

- **HTTP/SSE transport requires Axum/warp in Rust:** The Tauri 2 Rust backend can spawn an `axum` HTTP server in a `tokio::task::spawn` alongside the Tauri webview. This server handles MCP JSON-RPC over HTTP with SSE for progress. The server must share state (`DbState`, `GitHubClient`) via `Arc<Mutex<>>` with the Tauri command handlers.
- **MCP tools require existing Tauri commands:** All scan/backlog/query tools are thin wrappers over already-tested Rust functions. The HTTP layer calls those functions directly, bypassing the Tauri IPC. This means tool implementations don't need to go through `invoke()` — they call the Rust business logic directly.
- **fix_repository requires 3 new Rust commands:** `create_branch_from_issue`, `commit_conventional_fix`, `create_pull_request` — these are GitHub API operations that don't exist yet. Highest implementation cost in this milestone.
- **Realtime health rings require scan.slice.ts change:** The Tauri `scan-progress` event already fires per-repo with full diagnostic data. The only gap is that `scan.slice.ts` currently waits for the full `CachedRepoHealthReport[]` return value. Fix: apply each `scan-progress` payload into the reports store immediately as it arrives.
- **Toggle diagnostic rule conflicts with cached scan results:** If a rule is toggled off after a scan, existing diagnostic results in SQLite become stale. Either: (1) mark session as "dirty" requiring rescan, or (2) filter disabled rules from results display. Option 2 is lower cost.

---

## MVP Definition

### Launch With (v1) — MCP server + Realtime UI milestone

- [x] HTTP/SSE transport on `127.0.0.1:3742` — without this, no MCP client can connect
- [x] `scan_repositories` tool — primary trigger action for AI agents
- [x] `get_health_scores` tool — agents need to read state
- [x] `get_backlog_items` tool — agents need to see what exists before acting
- [x] `create_github_issue` tool — primary write action
- [x] `scan_single_repository` tool — enables focused fix workflows without full scan cost
- [x] `get_diagnostic_rules` tool — agents must know what rules exist
- [x] MCP on/off toggle in settings — users must control whether MCP is active
- [x] Per-repo incremental update in health rings during scan — closes the most visible UX gap
- [x] Per-repo "scanning" skeleton/spinner state — users know which repos are in-flight
- [x] MCP progress notifications during scan — prevents agents seeing frozen tool call

### Add After Validation (v1.x)

- [ ] `fix_repository` full pipeline tool — high value but high complexity; validate that agents actually use scan/query tools first before building the write pipeline
- [ ] `toggle_diagnostic_rule` tool — add once agents demonstrate they need to adjust scan config
- [ ] Resources for scan history — add once tool-based query patterns are established; resources are lower-priority than tools for most MCP clients
- [ ] Optimistic UI on backlog item creation — polish feature; add when core flows are stable

### Future Consideration (v2+)

- [ ] MCP Tasks primitive for async scan jobs — experimental in 2025-11-25 spec; stabilize before adopting
- [ ] `resources/subscribe` for live scan updates — complex; requires SSE multiplexing per subscriber; defer until resource primitive usage is validated
- [ ] Rule authoring UI — visual rule builder is a separate product surface; defer until rule ecosystem matures
- [ ] Multi-account GitHub support — architectural change; out of scope for this milestone

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| HTTP/SSE MCP transport | HIGH | MEDIUM | P1 |
| `scan_repositories` tool | HIGH | LOW | P1 |
| `get_health_scores` tool | HIGH | LOW | P1 |
| `get_backlog_items` tool | HIGH | LOW | P1 |
| `create_github_issue` tool | HIGH | LOW | P1 |
| Per-repo realtime health ring update | HIGH | LOW | P1 |
| MCP progress notifications | MEDIUM | LOW | P1 |
| MCP on/off settings toggle | MEDIUM | LOW | P1 |
| `scan_single_repository` tool | MEDIUM | LOW | P1 |
| `get_diagnostic_rules` tool | MEDIUM | LOW | P2 |
| Skeleton loading per repo | MEDIUM | LOW | P2 |
| Animated health ring fill | MEDIUM | LOW | P2 |
| `toggle_diagnostic_rule` tool | MEDIUM | LOW | P2 |
| `fix_repository` full pipeline | HIGH | HIGH | P2 |
| Resources for scan history | LOW | MEDIUM | P3 |
| Optimistic UI on backlog creation | LOW | LOW | P3 |
| MCP Tasks (async) | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (milestone cannot ship without)
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## MCP Protocol Requirements (What "Table Stakes" Actually Means in Spec Terms)

These are the non-negotiable behaviors derived directly from the 2025-11-25 specification:

| Requirement | Spec Reference | Consequence of Violation |
|-------------|----------------|--------------------------|
| Server MUST declare `tools` capability in `initialize` response | tools spec §Capabilities | Clients won't invoke any tools |
| Tool `inputSchema` MUST be a valid JSON Schema object (not null) | tools spec §Tool | Client crashes or shows schema parse error |
| Tool names MUST match `^[a-zA-Z0-9_-]{1,64}$` | tools spec §Tool Names | Some clients fail to register tool; LLM cannot invoke it |
| Tool execution errors MUST use `isError: true` in result content | tools spec §Error Handling | LLM cannot self-correct; errors appear as successful calls |
| Protocol errors MUST use JSON-RPC error format | base protocol | Client cannot distinguish error types |
| `notifications/progress` MUST only use tokens from active requests | progress spec §Behavior | Client discards notifications; may close connection |
| `progress` value MUST increase monotonically | progress spec §Behavior | Clients may ignore out-of-order notifications |

---

## Realtime UI Patterns — What Users Expect

Based on 2025–2026 research on scan progress UIs, desktop apps with long-running operations, and Zustand state management patterns:

### Per-Repo State Machine

Each repo card transitions through: `idle → queued → scanning → complete | error`

- **idle**: Default; health ring shows cached score (or empty if no scan yet)
- **queued**: Small indicator showing repo is waiting in scan queue (subtle, not alarming)
- **scanning**: Skeleton shimmer on health ring + stats fields; spinner icon on repo row
- **complete**: Health ring animates to new score (300ms ease-in-out); stats update
- **error**: Error icon + toast; ring shows last known score

### Progress Bar — Determinate, Not Indeterminate

A determinate progress bar (e.g. "14 / 47 repos scanned") is strongly preferred over a spinner for scans — users can estimate time remaining. The existing `scan-progress` event includes enough data (`current_index`, `total`) to support this.

### Non-Blocking State Updates

Zustand store updates from `scan-progress` events must not block the render thread. Pattern: batch updates with `requestAnimationFrame` or React's `startTransition` if 50+ repos update rapidly.

### Skeleton Dimensions Must Match Content

Skeleton placeholders must match the eventual health ring and stats area dimensions exactly. A layout shift when content arrives is perceived as a bug.

### Cancellable with Clear Feedback

The existing cancel button should show a "Cancelling..." intermediate state after click (the Rust cancellation flag is async — there's a brief gap between click and actual stop).

---

## Competitor Feature Analysis

| Feature | GitHub Actions (native) | Dependabot | gitstream.ai | Our Approach |
|---------|------------------------|------------|--------------|--------------|
| Repo health scoring | No unified score | Dependency-only | No | Weighted multi-rule score (3x/2x/1x) per repo |
| AI agent integration | No MCP server | No | No | Full MCP server with scan/fix/query tools |
| Backlog generation | No | Creates PRs | No | Priority-scored backlog from failed rules |
| Automated fix pipeline | Workflows (manual trigger) | Auto-PRs for deps | PR automation | MCP tool: issue → branch → conventional commit → PR |
| Realtime scan UI | No (async logs) | No | No | Per-repo live health ring updates via Tauri events |
| Rule customization | Workflow YAML | Fixed rules | Conditional rules | Pluggable `DiagnosticRule` trait, toggleable per rule |
| Local/offline first | Cloud-only | Cloud-only | Cloud-only | SQLite cache, works on last scan data offline |

---

## Sources

- [MCP Specification 2025-11-25 — Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — HIGH confidence; official spec
- [MCP Specification 2025-11-25 — Resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) — HIGH confidence; official spec
- [MCP Specification 2025-11-25 — Progress](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress) — HIGH confidence; official spec
- [MCP Specification 2025-11-25 — Overview](https://modelcontextprotocol.io/specification/2025-11-25) — HIGH confidence; official spec
- [GitHub MCP Server (official)](https://github.com/github/github-mcp-server) — MEDIUM confidence; reference implementation for tool categories
- [MCP Server Best Practices 2026 — CData](https://www.cdata.com/blog/mcp-server-best-practices-2026) — MEDIUM confidence; practitioner guidance
- [MCP Best Practice Guide](https://mcp-best-practice.github.io/mcp-best-practice/best-practice/) — MEDIUM confidence; community best practices
- [MCP Tool Naming Conventions — ZazenCodes](https://zazencodes.com/blog/mcp-server-naming-conventions) — MEDIUM confidence; practitioner convention
- [MCP Async Tasks — WorkOS](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows) — MEDIUM confidence; long-running operations pattern
- [Progress Indicators Ultimate Guide — NumberAnalytics](https://www.numberanalytics.com/blog/progress-indicators-ultimate-guide-ui-ux) — MEDIUM confidence; UX patterns
- [UI/UX Trends AI Apps 2026 — GroovyWeb](https://www.groovyweb.co/blog/ui-ux-design-trends-ai-apps-2026) — LOW confidence; trend analysis only
- [Tauri MCP (dirvine)](https://github.com/dirvine/tauri-mcp) — MEDIUM confidence; evidence that Tauri + MCP HTTP transport is viable
- [MCP Bouncer (catkins)](https://github.com/catkins/mcp-bouncer) — MEDIUM confidence; reference for Tauri 2 + SSE MCP server at `127.0.0.1:8091`

---

*Feature research for: GitHub diagnostics desktop app — MCP server + realtime scan UI*
*Researched: 2026-02-26*

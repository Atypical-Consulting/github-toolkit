# Roadmap: GitHubAutomate

## Overview

The existing app has a working scan pipeline and SQLite persistence. This milestone adds two capabilities: (1) realtime per-repo health ring updates in the UI as each diagnostic completes during a scan, and (2) a Model Context Protocol server so AI coding assistants can scan, query, and fix repositories programmatically. Phases progress from zero-dependency UI work, through MCP foundation and read-only tools, up to scan execution, simple writes, and finally the full automated fix pipeline.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Realtime Scan UI** - Health rings and diagnostic breakdowns update live per-repo during a scan
- [ ] **Phase 2: MCP Foundation** - Compilable MCP binary with correct logging, error types, WAL mode, and tool list endpoint
- [ ] **Phase 3: MCP Query Tools** - Read-only tools for health scores, backlog items, and diagnostic rules
- [ ] **Phase 4: MCP Scan Tools + Settings** - Scan tools with progress notifications and in-app MCP toggle UI
- [ ] **Phase 5: MCP Write Tools** - Issue creation and rule toggle tools with idempotency checks
- [ ] **Phase 6: Fix Pipeline** - Full automated fix pipeline (issue -> branch -> conventional commit -> PR)

## Phase Details

### Phase 1: Realtime Scan UI
**Goal**: Users see each repo's health ring fill and diagnostic breakdown appear as its scan completes, not after the entire scan finishes
**Depends on**: Nothing (uses existing Tauri scan-progress events)
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05
**Success Criteria** (what must be TRUE):
  1. Health ring for each repo animates to its final score within 300ms of that repo's diagnostics completing, while other repos are still scanning
  2. Diagnostic breakdown (rules passed/failed) appears in the repo card immediately after that repo's scan result arrives
  3. Repos show a skeleton/shimmer state while their diagnostics are in-flight and revert to normal card once complete
  4. Health ring score transition uses a smooth 300ms ease-in-out animation (not a jump)
  5. After scan completes and Dashboard is navigated away from and back, no duplicate event callbacks fire and no memory leak accumulates
**Plans**: TBD

Plans:
- [x] 01-01-PLAN.md — Extend ScanProgress Rust struct with per-repo report payload and rewrite scan.slice.ts event handler with listener lifecycle fix
- [x] 01-02-PLAN.md — Add shimmer CSS, update health ring animation timing, extract RepoRow component with per-repo selectors
- [x] 01-03-PLAN.md — Integration smoke test and visual verification of all SCAN requirements

### Phase 2: MCP Foundation
**Goal**: A compilable `github-automate-mcp` binary exists, connects via stdio, responds to `tools/list`, and has correct logging, error sanitization, and WAL-mode SQLite
**Depends on**: Phase 1
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07
**Success Criteria** (what must be TRUE):
  1. MCP Inspector (or any MCP client) can connect to the binary via stdio and receive a valid `tools/list` response listing stub tools
  2. All logging from the MCP binary goes exclusively to stderr — no output appears on stdout except JSON-RPC messages
  3. Tool execution errors return structured responses with `isError: true` and a sanitized message that contains no GitHub tokens or HTTP headers
  4. The Tauri app and MCP binary can both access the SQLite database concurrently without locking errors (WAL mode enabled)
  5. Business logic for diagnostics, GitHub client, and storage is accessible from both binaries via a shared library crate
**Plans**: TBD

Plans:
- [ ] 02-01: Create shared library crate (github_automate_lib) and new MCP binary target in Cargo.toml
- [ ] 02-02: Implement ServerHandler stub with tools/list, configure tracing to stderr, define McpError sanitized type
- [ ] 02-03: Enable WAL mode in storage/mod.rs and verify concurrent access from both processes

### Phase 3: MCP Query Tools
**Goal**: AI tools can read all health and backlog data from the local SQLite database via three read-only MCP tools
**Depends on**: Phase 2
**Requirements**: QUERY-01, QUERY-02, QUERY-03
**Success Criteria** (what must be TRUE):
  1. `get_health_scores` returns correct health scores for all repos (or a single specified repo) from SQLite, with human-readable field names
  2. `get_backlog_items` returns backlog items filterable by owner, severity, and status without modifying any data
  3. `get_diagnostic_rules` returns all rule definitions including id, name, severity, and enabled status
  4. Every tool has a JSON Schema `inputSchema` that validates in MCP Inspector and a description prefixed with READ-ONLY
**Plans**: TBD

Plans:
- [ ] 03-01: Implement get_health_scores and get_backlog_items tools with JSON Schema input schemas
- [ ] 03-02: Implement get_diagnostic_rules tool and validate all three tools in MCP Inspector

### Phase 4: MCP Scan Tools + Settings
**Goal**: AI tools can trigger diagnostic scans from outside the app, receive per-repo progress notifications, and users can toggle MCP on/off and copy their config snippet from Settings
**Depends on**: Phase 3
**Requirements**: MSCAN-01, MSCAN-02, MSCAN-03, SET-01, SET-02
**Success Criteria** (what must be TRUE):
  1. `scan_repositories` triggers a full diagnostic scan that writes results to SQLite; subsequent `get_health_scores` calls return updated data
  2. `scan_single_repository` scans one specific repo by owner/name and updates only that repo's data in SQLite
  3. An MCP client that provides a `progressToken` receives `notifications/progress` events per repo during a scan, showing incremental progress
  4. The app Settings page has a toggle that enables or disables the MCP feature
  5. Settings page displays the MCP binary path and a copy-paste config snippet that works for Claude Code and Cursor
**Plans**: TBD

Plans:
- [ ] 04-01: Implement scan_repositories and scan_single_repository tools with keychain token access from MCP binary
- [ ] 04-02: Add notifications/progress emission per-repo during MCP-triggered scan
- [ ] 04-03: Create Settings extension with MCP toggle, binary path display, and copy-paste config snippet

### Phase 5: MCP Write Tools
**Goal**: AI tools can create GitHub issues from backlog items and toggle diagnostic rules on or off, with idempotency and input validation
**Depends on**: Phase 4
**Requirements**: WRITE-01, WRITE-02
**Success Criteria** (what must be TRUE):
  1. `create_github_issue` creates a GitHub issue and links it to the backlog item; calling it again for the same repo/rule returns the existing issue rather than creating a duplicate
  2. `toggle_diagnostic_rule` enables or disables a rule by id and the change is reflected in subsequent `get_diagnostic_rules` responses and in future scans
  3. Both tools reject invalid owner/repo strings that contain characters outside `[a-zA-Z0-9_.-]` with a structured error before any API call is made
**Plans**: TBD

Plans:
- [ ] 05-01: Implement create_github_issue tool with idempotency check and input validation
- [ ] 05-02: Implement toggle_diagnostic_rule tool and wire rule enabled state into diagnostics engine

### Phase 6: Fix Pipeline
**Goal**: AI tools can run a full automated remediation for a failed diagnostic rule — creating the issue, branch, conventional commit, and PR in one tool call
**Depends on**: Phase 5
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06
**Success Criteria** (what must be TRUE):
  1. Calling `fix_repository` for a repo and rule creates a GitHub issue, a branch named after that issue (e.g. `fix/issue-42-has-readme`), a conventional commit (e.g. `docs: add README`), and a PR referencing the issue — all in one tool call
  2. Calling `fix_repository` twice for the same repo and rule does not create duplicate issues, branches, or PRs — the second call returns the existing artifacts
  3. `fix_repository` returns a structured error before making any API calls if the target repo has branch protection rules that would block the PR
  4. If any step in the pipeline fails, the tool returns a structured error that identifies which step failed and what artifacts were already created
**Plans**: TBD

Plans:
- [ ] 06-01: Add GitHub API commands for branch creation, conventional commit file write, and PR creation with retry-with-backoff
- [ ] 06-02: Implement fix_repository tool orchestrating the full pipeline with idempotency checks at each step
- [ ] 06-03: Add branch protection pre-flight check and pipeline transaction log in SQLite for failure recovery

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Realtime Scan UI | 3/3 | Complete | 2026-02-26 |
| 2. MCP Foundation | 0/3 | Not started | - |
| 3. MCP Query Tools | 0/2 | Not started | - |
| 4. MCP Scan Tools + Settings | 0/3 | Not started | - |
| 5. MCP Write Tools | 0/2 | Not started | - |
| 6. Fix Pipeline | 0/3 | Not started | - |

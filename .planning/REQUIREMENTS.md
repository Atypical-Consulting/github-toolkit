# Requirements: GitHubAutomate v2

**Defined:** 2026-02-26
**Core Value:** Users see repo health updating live during scans, and AI tools can scan, query, and fix repos via MCP.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Realtime Scan UI

- [x] **SCAN-01**: Health ring fills to its score as each repo's diagnostics complete during a scan
- [x] **SCAN-02**: Diagnostic breakdown (rules passed/failed) appears immediately per repo during scan
- [x] **SCAN-03**: Repo cards show a skeleton/shimmer state while their diagnostics are in-flight
- [x] **SCAN-04**: Health ring animates smoothly (300ms ease-in-out) when score updates
- [x] **SCAN-05**: Tauri event listener cleanup (unlisten) is properly handled to prevent memory leaks

### MCP Server Foundation

- [x] **MCP-01**: MCP server runs as a separate Rust binary using stdio transport
- [x] **MCP-02**: SQLite database uses WAL mode for concurrent access by Tauri app and MCP binary
- [ ] **MCP-03**: MCP server declares `tools` capability and returns all tools via `tools/list`
- [ ] **MCP-04**: Every tool has a well-formed JSON Schema `inputSchema` and human-readable description
- [ ] **MCP-05**: Tool execution errors return structured responses with `isError: true`
- [x] **MCP-06**: MCP binary uses stderr-only logging (stdout reserved for JSON-RPC)
- [x] **MCP-07**: Shared business logic (diagnostics engine, GitHub client, storage) extracted to library crate used by both binaries

### MCP Query Tools

- [ ] **QUERY-01**: `get_health_scores` tool returns health scores for all or a specific repo from SQLite
- [ ] **QUERY-02**: `get_backlog_items` tool returns backlog items filterable by owner, severity, status
- [ ] **QUERY-03**: `get_diagnostic_rules` tool returns all rule definitions with id, name, severity, enabled status

### MCP Scan Tools

- [ ] **MSCAN-01**: `scan_repositories` tool triggers a full diagnostic scan of all repos
- [ ] **MSCAN-02**: `scan_single_repository` tool scans a specific repo by owner/name
- [ ] **MSCAN-03**: MCP server emits `notifications/progress` per-repo during scan with progressToken

### MCP Write Tools

- [ ] **WRITE-01**: `create_github_issue` tool creates a GitHub issue from a backlog item or rule failure
- [ ] **WRITE-02**: `toggle_diagnostic_rule` tool enables or disables a specific rule by id

### MCP Fix Pipeline

- [ ] **FIX-01**: `fix_repository` tool creates a GitHub issue for the failed rule
- [ ] **FIX-02**: `fix_repository` tool creates a branch named after the issue (e.g. `fix/issue-42-has-readme`)
- [ ] **FIX-03**: `fix_repository` tool commits the fix using conventional commit format (e.g. `docs: add README`)
- [ ] **FIX-04**: `fix_repository` tool creates a PR referencing the issue
- [ ] **FIX-05**: Fix pipeline checks branch protection rules before attempting fixes
- [ ] **FIX-06**: Fix pipeline is idempotent — re-running for the same repo/rule does not create duplicate issues

### MCP Settings

- [ ] **SET-01**: In-app settings toggle to enable/disable MCP feature
- [ ] **SET-02**: Settings UI displays MCP binary path and copy-paste config snippet for Claude Code/Cursor

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### MCP Resources

- **RES-01**: Expose scan sessions as MCP resources (`github-automate://scan-sessions`)
- **RES-02**: `resources/subscribe` for live scan updates via SSE

### Enhanced UI

- **UI-01**: Optimistic UI on backlog item creation (instant feedback, reconcile with server)
- **UI-02**: Per-repo state machine (idle → queued → scanning → complete | error) with visual indicators

### MCP Advanced

- **ADV-01**: MCP Tasks primitive for async long-running scan jobs
- **ADV-02**: Multi-account GitHub support

## Out of Scope

| Feature | Reason |
|---------|--------|
| MCP auto-registration into client configs | Security-hostile: modifying other apps' config files without explicit user action |
| Configurable MCP port/transport in UI | Unnecessary complexity; hardcode sensible default |
| MCP server without app running (daemon) | Requires background daemon architecture; out of scope for desktop app |
| Push code fixes via desktop UI (non-MCP) | Fix automation requires agent context; UI doesn't have it |
| Streaming inside MCP tool call responses | Non-standard in current MCP spec; use progress notifications instead |
| Mobile app | Desktop-first via Tauri |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAN-01 | Phase 1 | Complete |
| SCAN-02 | Phase 1 | Complete |
| SCAN-03 | Phase 1 | Complete |
| SCAN-04 | Phase 1 | Complete |
| SCAN-05 | Phase 1 | Complete |
| MCP-01 | Phase 2 | Complete |
| MCP-02 | Phase 2 | Complete |
| MCP-03 | Phase 2 | Pending |
| MCP-04 | Phase 2 | Pending |
| MCP-05 | Phase 2 | Pending |
| MCP-06 | Phase 2 | Complete |
| MCP-07 | Phase 2 | Complete |
| QUERY-01 | Phase 3 | Pending |
| QUERY-02 | Phase 3 | Pending |
| QUERY-03 | Phase 3 | Pending |
| MSCAN-01 | Phase 4 | Pending |
| MSCAN-02 | Phase 4 | Pending |
| MSCAN-03 | Phase 4 | Pending |
| SET-01 | Phase 4 | Pending |
| SET-02 | Phase 4 | Pending |
| WRITE-01 | Phase 5 | Pending |
| WRITE-02 | Phase 5 | Pending |
| FIX-01 | Phase 6 | Pending |
| FIX-02 | Phase 6 | Pending |
| FIX-03 | Phase 6 | Pending |
| FIX-04 | Phase 6 | Pending |
| FIX-05 | Phase 6 | Pending |
| FIX-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after roadmap creation*

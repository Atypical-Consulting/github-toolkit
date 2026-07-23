---
phase: 02-mcp-foundation
plan: 01
subsystem: mcp
tags: [rmcp, mcp, rust, binary, tracing, error-sanitization]

requires:
  - phase: 01-realtime-scan-ui
    provides: Working Tauri app with scan pipeline and SQLite persistence
provides:
  - Compilable github-automate-mcp binary target
  - MCP module skeleton (server.rs, error.rs) accessible via shared library
  - Error sanitization helper stripping GitHub tokens from messages
  - Stderr-only tracing entry point for MCP binary
affects: [02-mcp-foundation, 03-mcp-query-tools]

tech-stack:
  added: [rmcp 0.16, schemars 1.0, tracing 0.1, tracing-subscriber 0.3, anyhow 1.0, dirs 6]
  patterns: [multi-binary Cargo layout with default-run, stderr-only logging for stdio MCP]

key-files:
  created:
    - src-tauri/src/bin/mcp.rs
    - src-tauri/src/mcp/mod.rs
    - src-tauri/src/mcp/server.rs
    - src-tauri/src/mcp/error.rs
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs

key-decisions:
  - "CallToolResult::error(vec![Content::text(msg)]) is the correct rmcp 0.16 API for error results — not Default::default()"
  - "tracing crate added as direct dependency for binary-level logging macros"

patterns-established:
  - "MCP binary logs exclusively to stderr via tracing_subscriber::fmt().with_writer(std::io::stderr)"
  - "Error sanitization strips ghp_, gho_, github_pat_ tokens plus Bearer and Authorization headers"

requirements-completed: [MCP-01, MCP-06, MCP-07]

duration: 8 min
completed: 2026-02-26
---

# Phase 2 Plan 01: MCP Binary Target and Shared Library Wiring Summary

**Compilable github-automate-mcp binary with rmcp dependencies, stderr tracing, error sanitization, and shared library access to all business logic modules**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-26T10:45:00Z
- **Completed:** 2026-02-26T10:53:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- MCP binary target compiles alongside existing Tauri app via [[bin]] + default-run pattern
- Error sanitization helper strips GitHub tokens (ghp_, gho_, github_pat_), Bearer tokens, and Authorization headers
- MCP binary entry point initializes tracing to stderr before any output, keeping stdout clean for future JSON-RPC
- All business logic modules (github, diagnostics, storage, backlog) accessible from MCP binary via pub mod mcp in lib.rs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add MCP dependencies and binary target to Cargo.toml** - `cea87bb` (chore)
2. **Task 2: Create MCP module skeleton and binary entry point** - `5497fe4` (feat)

## Files Created/Modified
- `src-tauri/Cargo.toml` - Added rmcp, schemars, tracing, tracing-subscriber, anyhow, dirs deps + [[bin]] + default-run
- `src-tauri/src/bin/mcp.rs` - MCP binary entry point with stderr-only tracing
- `src-tauri/src/mcp/mod.rs` - MCP module re-exports (server, error)
- `src-tauri/src/mcp/server.rs` - GitHubAutomateMcpServer struct skeleton
- `src-tauri/src/mcp/error.rs` - sanitize_error_message() and error_result() helpers
- `src-tauri/src/lib.rs` - Added pub mod mcp for shared library access

## Decisions Made
- Used `CallToolResult::error(vec![Content::text(msg)])` instead of plan's `..Default::default()` pattern — CallToolResult does not impl Default in rmcp 0.16
- Added `tracing = "0.1"` as direct dependency — rmcp re-exports tracing internally but binary needs it directly for `tracing::info!` macros

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CallToolResult API mismatch**
- **Found during:** Task 2 (Create MCP module skeleton)
- **Issue:** Plan used `..Default::default()` for CallToolResult, but rmcp 0.16 does not implement Default for this type
- **Fix:** Used `CallToolResult::error(vec![Content::text(msg)])` which is the actual rmcp 0.16 API
- **Files modified:** src-tauri/src/mcp/error.rs
- **Verification:** cargo build succeeds
- **Committed in:** 5497fe4

**2. [Rule 3 - Blocking] Missing tracing dependency**
- **Found during:** Task 2 (Create MCP module skeleton)
- **Issue:** `tracing::info!` and `tracing::Level::INFO` not found — tracing not a direct dependency
- **Fix:** Added `tracing = "0.1"` to Cargo.toml
- **Files modified:** src-tauri/Cargo.toml
- **Verification:** cargo build succeeds
- **Committed in:** 5497fe4

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MCP binary target ready for Plan 02 to add ServerHandler with tool_router/tool_handler macros
- server.rs skeleton ready for full impl ServerHandler replacement
- error.rs ready for use in stub tool error paths

---
*Phase: 02-mcp-foundation*
*Completed: 2026-02-26*

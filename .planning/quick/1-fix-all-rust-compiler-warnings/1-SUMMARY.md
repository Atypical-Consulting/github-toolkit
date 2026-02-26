---
phase: quick-fix-warnings
plan: 01
subsystem: rust-backend
tags: [warnings, dead-code, maintenance, zero-behavior-change]
dependency_graph:
  requires: []
  provides: [warning-free-build]
  affects: [src-tauri/src/github/types.rs, src-tauri/src/github/auth.rs, src-tauri/src/github/client.rs, src-tauri/src/diagnostics/types.rs, src-tauri/src/storage/db.rs, src-tauri/src/storage/diagnostics.rs, src-tauri/src/storage/mod.rs]
tech_stack:
  added: []
  patterns: ["#[allow(dead_code)] on intentionally-kept future-phase code"]
key_files:
  created: []
  modified:
    - src-tauri/src/github/types.rs
    - src-tauri/src/github/auth.rs
    - src-tauri/src/github/client.rs
    - src-tauri/src/diagnostics/types.rs
    - src-tauri/src/storage/db.rs
    - src-tauri/src/storage/diagnostics.rs
    - src-tauri/src/storage/mod.rs
decisions:
  - "Use #[allow(dead_code)] on future-phase items rather than deleting them — preserves code for MCP tools, issue management, and rate limiting phases"
  - "Remove resolve_db_path from storage mod.rs re-export since nothing uses it at the storage:: path level; function remains accessible via crate::storage::db::resolve_db_path"
metrics:
  duration: "2 min"
  completed_date: "2026-02-26"
---

# Quick Task 1: Fix All Rust Compiler Warnings Summary

**One-liner:** Eliminated all 16 Rust compiler warnings via targeted `#[allow(dead_code)]` annotations and removal of unused `resolve_db_path` re-export, with zero behavior changes.

## Objective

Eliminate all 16 Rust compiler warnings (unused imports, dead code, unused fields/structs/functions) across 7 files in the src-tauri crate so real warnings are visible immediately.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Suppress dead-code warnings on intentionally-kept types/fields/functions | 6af5d68 | types.rs, auth.rs, client.rs, diagnostics/types.rs, storage/db.rs, storage/diagnostics.rs |
| 2 | Remove unused import from storage/mod.rs | 6af5d68 | storage/mod.rs |

## Changes Made

### src-tauri/src/github/types.rs
- `GitHubUserRef.avatar_url` — `#[allow(dead_code)]` (used in future auth display)
- `GitHubLabel` struct — `#[allow(dead_code)]` (future issue management)
- `GitHubIssue` struct — `#[allow(dead_code)]` (future issue management)
- `GitHubComment` struct — `#[allow(dead_code)]` (future issue management)
- `GitHubBranch.name` — `#[allow(dead_code)]` (future branch operations)
- `GitHubLicense.spdx_id` — `#[allow(dead_code)]` (future license display)
- `GitHubFileContent.encoding` — `#[allow(dead_code)]` (future file content decoding)
- `LabelInfo` struct — `#[allow(dead_code)]` (future issue labels)
- `GitHubUser.name` — `#[allow(dead_code)]` (future user profile display)

### src-tauri/src/github/auth.rs
- `GitHubTokenResponse.token_type` — `#[allow(dead_code)]` (OAuth response field, kept for completeness)

### src-tauri/src/github/client.rs
- `github_put` function — `#[allow(dead_code)]` (future file creation/update via API)
- `extract_rate_limit` function — `#[allow(dead_code)]` (future rate limit monitoring)

### src-tauri/src/diagnostics/types.rs
- `RepoContext.readme_content` — `#[allow(dead_code)]` (future readme quality rules)
- `RepoContext.pushed_at` — `#[allow(dead_code)]` (future staleness rules)

### src-tauri/src/storage/db.rs
- `resolve_db_path` function — `#[allow(dead_code)]` (used by MCP binary in Phase 2+)

### src-tauri/src/storage/diagnostics.rs
- `get_cached_diagnostic` function — `#[allow(dead_code)]` (future incremental scan caching)

### src-tauri/src/storage/mod.rs
- Removed `resolve_db_path` from `pub use db::{...}` re-export (nothing uses it at `storage::` path level)

## Verification

```
cargo build --manifest-path src-tauri/Cargo.toml
# Result: zero warnings (confirmed)

cargo test --manifest-path src-tauri/Cargo.toml
# Result: 0 passed, 0 failed, 0 ignored (confirmed)
```

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Use `#[allow(dead_code)]` rather than delete code** — All suppressed items exist for future phases (MCP tools, issue management, rate limiting). Deleting them would require re-implementing in future phases.
2. **Remove `resolve_db_path` re-export from `mod.rs`** — The function is accessible directly via `crate::storage::db::resolve_db_path` when needed by the MCP binary; removing the top-level re-export eliminates the unused-import warning cleanly.

## Self-Check: PASSED

- All 7 modified files exist and were committed: 6af5d68
- `cargo build` produces zero warnings (verified)
- `cargo test` passes with 0 failures (verified)

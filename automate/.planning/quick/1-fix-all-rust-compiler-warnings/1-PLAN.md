---
phase: quick-fix-warnings
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/storage/mod.rs
  - src-tauri/src/github/auth.rs
  - src-tauri/src/github/client.rs
  - src-tauri/src/github/types.rs
  - src-tauri/src/diagnostics/types.rs
  - src-tauri/src/storage/db.rs
  - src-tauri/src/storage/diagnostics.rs
autonomous: true
requirements: [WARN-01]

must_haves:
  truths:
    - "cargo build produces zero warnings for the src-tauri crate"
    - "No functional behavior changes — all existing code paths unchanged"
  artifacts:
    - path: "src-tauri/src/github/types.rs"
      provides: "Warning-free GitHub API types"
      contains: "allow(dead_code)"
    - path: "src-tauri/src/github/client.rs"
      provides: "Warning-free HTTP client helpers"
      contains: "allow(dead_code)"
    - path: "src-tauri/src/storage/mod.rs"
      provides: "Clean re-exports without unused imports"
  key_links:
    - from: "src-tauri/src/storage/mod.rs"
      to: "src-tauri/src/storage/db.rs"
      via: "pub use re-export"
      pattern: "pub use db::"
---

<objective>
Eliminate all 16 Rust compiler warnings (unused imports, dead code, unused fields/structs/functions) across 7 files in the src-tauri crate.

Purpose: Clean compiler output so real warnings are visible immediately. Zero behavior changes.
Output: Warning-free `cargo build` output.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src-tauri/src/storage/mod.rs
@src-tauri/src/github/auth.rs
@src-tauri/src/github/client.rs
@src-tauri/src/github/types.rs
@src-tauri/src/diagnostics/types.rs
@src-tauri/src/storage/db.rs
@src-tauri/src/storage/diagnostics.rs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Suppress dead-code warnings on intentionally-kept types, fields, and functions</name>
  <files>
    src-tauri/src/github/types.rs
    src-tauri/src/github/auth.rs
    src-tauri/src/github/client.rs
    src-tauri/src/diagnostics/types.rs
    src-tauri/src/storage/db.rs
    src-tauri/src/storage/diagnostics.rs
  </files>
  <action>
These items are unused NOW but exist for future phases (MCP tools, issue management, rate limiting). Add targeted `#[allow(dead_code)]` annotations rather than deleting code.

**src-tauri/src/github/types.rs:**
- Line 8: Add `#[allow(dead_code)]` above `avatar_url` field in `GitHubUserRef`
- Lines 11-17: Add `#[allow(dead_code)]` above `struct GitHubLabel`
- Lines 19-34: Add `#[allow(dead_code)]` above `struct GitHubIssue`
- Lines 36-44: Add `#[allow(dead_code)]` above `struct GitHubComment`
- Line 54: Add `#[allow(dead_code)]` above `name` field in `GitHubBranch`
- Line 78: Add `#[allow(dead_code)]` above `spdx_id` field in `GitHubLicense`
- Line 98: Add `#[allow(dead_code)]` above `encoding` field in `GitHubFileContent`
- Lines 158-162: Add `#[allow(dead_code)]` above `struct LabelInfo`
- Line 187: Add `#[allow(dead_code)]` above `name` field in `GitHubUser`

**src-tauri/src/github/auth.rs:**
- Line 24: Add `#[allow(dead_code)]` above `token_type` field in `GitHubTokenResponse`

**src-tauri/src/github/client.rs:**
- Line 70: Add `#[allow(dead_code)]` above `github_put` function
- Line 141: Add `#[allow(dead_code)]` above `extract_rate_limit` function

**src-tauri/src/diagnostics/types.rs:**
- Line 70: Add `#[allow(dead_code)]` above `readme_content` field in `RepoContext`
- Line 72: Add `#[allow(dead_code)]` above `pushed_at` field in `RepoContext`

**src-tauri/src/storage/db.rs:**
- Line 113: Add `#[allow(dead_code)]` above `resolve_db_path` function

**src-tauri/src/storage/diagnostics.rs:**
- Line 31: Add `#[allow(dead_code)]` above `get_cached_diagnostic` function
  </action>
  <verify>cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep -c "warning\[" | xargs test 0 -eq</verify>
  <done>All 16 warnings eliminated. `cargo build` shows zero warnings.</done>
</task>

<task type="auto">
  <name>Task 2: Remove unused import from storage/mod.rs</name>
  <files>src-tauri/src/storage/mod.rs</files>
  <action>
In `src-tauri/src/storage/mod.rs` line 8, remove `resolve_db_path` from the pub use statement since `resolve_db_path` in `db.rs` will have `#[allow(dead_code)]` but the re-export itself is an unused import warning.

Change:
```rust
pub use db::{DbState, init_db, resolve_db_path};
```
To:
```rust
pub use db::{DbState, init_db};
```

The function remains accessible directly via `crate::storage::db::resolve_db_path` if needed later, but the top-level re-export is removed since nothing currently uses it at the `storage::` path level.
  </action>
  <verify>cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "warning" | grep -v "Compiling\|Finished\|Generated" | wc -l | xargs test 0 -eq</verify>
  <done>No unused import warning for `resolve_db_path` in mod.rs. Clean build with zero warnings.</done>
</task>

</tasks>

<verification>
```bash
# Full build with no warnings
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "warning"
# Expected: only "Compiling" and "Finished" lines, no actual warnings

# Rust tests still pass
cargo test --manifest-path src-tauri/Cargo.toml
```
</verification>

<success_criteria>
- `cargo build --manifest-path src-tauri/Cargo.toml` produces zero warnings
- `cargo test --manifest-path src-tauri/Cargo.toml` passes (no regressions)
- No functional changes to any code paths
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-all-rust-compiler-warnings/1-SUMMARY.md`
</output>

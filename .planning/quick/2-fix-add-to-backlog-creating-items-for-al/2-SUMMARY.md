---
phase: quick
plan: 2
subsystem: backlog
tags: [bug-fix, dedup, rust, typescript, storage]
dependency_graph:
  requires: []
  provides: [BUG-BACKLOG-DEDUP]
  affects: [backlog-generation, backlog-store]
tech_stack:
  added: []
  patterns: [dedup-before-insert, reload-from-db-after-mutation]
key_files:
  created: []
  modified:
    - src-tauri/src/storage/backlog.rs
    - src-tauri/src/backlog/commands.rs
    - src/core/stores/domain/backlog/index.ts
decisions:
  - "backlog_item_exists checks repo_full_name + source_ref (rule_id) — these together uniquely identify a diagnostic backlog entry"
  - "generateFromScan continues silently when a duplicate is found (no error) — idempotent by design"
  - "Frontend store calls loadItems() after generation to always show full DB state, matching the pattern already used in createFromDiagnostic"
metrics:
  duration: "5 min"
  completed: "2026-02-26T11:24:58Z"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 2: Fix Add to Backlog Creating Duplicate Items Summary

**One-liner:** Dedup backlog inserts by repo+rule pair in Rust and reload full DB state in TypeScript store after bulk generation.

## Objective

Two bugs caused confusing backlog behavior:
1. Rust backend inserted duplicate rows on repeated `generate_backlog_from_scan` calls (no uniqueness check on repo_full_name + source_ref)
2. Frontend store replaced the entire item list with only newly generated items instead of the full DB contents

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add dedup check to Rust backend | e8da487 | `storage/backlog.rs`, `backlog/commands.rs` |
| 2 | Fix frontend store to reload from DB after generation | 4b3d55b | `core/stores/domain/backlog/index.ts` |

## Changes Made

### Task 1 — Rust backend dedup (e8da487)

**`src-tauri/src/storage/backlog.rs`** — Added new public function:

```rust
pub fn backlog_item_exists(db: &DbState, repo_full_name: &str, source_ref: &str) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM backlog_items WHERE repo_full_name = ?1 AND source_ref = ?2",
        params![repo_full_name, source_ref],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(count > 0)
}
```

**`src-tauri/src/backlog/commands.rs`** — Added dedup guard inside `generate_backlog_from_scan` before the insert:

```rust
// Skip if backlog item already exists for this repo+rule
if crate::storage::backlog::backlog_item_exists(
    &db,
    &report.repo_full_name,
    &result.rule_id,
)
.unwrap_or(false)
{
    continue;
}
```

### Task 2 — Frontend store reload (4b3d55b)

**`src/core/stores/domain/backlog/index.ts`** — Changed `generateFromScan` success branch from replacing store items to reloading from DB:

Before:
```typescript
const items = result.data as BacklogItem[];
set({ items, isGenerating: false }, undefined, "backlog/generate/ok");
log.success("backlog", `Generated ${items.length} backlog items`);
```

After:
```typescript
const newItems = result.data as BacklogItem[];
set({ isGenerating: false }, undefined, "backlog/generate/ok");
await get().loadItems();
log.success("backlog", `Generated ${newItems.length} new backlog items`);
```

## Verification

- `cargo build --manifest-path src-tauri/Cargo.toml` — Finished dev profile in 8.31s, no errors
- `npx tsc --noEmit` — Passed with no output (clean)
- `npm run check` — Biome auto-formatted the file; 3 pre-existing `noExplicitAny` warnings in `index.ts` (not caused by this fix)

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Dedup key is repo_full_name + source_ref**: These two fields together uniquely identify any diagnostic backlog entry. The `source_ref` column stores the `rule_id` from the diagnostic engine.
2. **Silent skip on duplicate**: When an item already exists, `generate_backlog_from_scan` silently continues to the next result — no error returned, making the function fully idempotent.
3. **loadItems() pattern**: Adopted the same reload-from-DB pattern already used by `createFromDiagnostic` and `updateStatus` — consistent store behavior across all mutations.

## Self-Check: PASSED

- FOUND: `src-tauri/src/storage/backlog.rs`
- FOUND: `src-tauri/src/backlog/commands.rs`
- FOUND: `src/core/stores/domain/backlog/index.ts`
- FOUND commit e8da487: fix(quick-2): add dedup guard in generate_backlog_from_scan
- FOUND commit 4b3d55b: fix(quick-2): reload full backlog from DB after generateFromScan

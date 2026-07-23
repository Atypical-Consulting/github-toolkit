---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/storage/backlog.rs
  - src-tauri/src/backlog/commands.rs
  - src/core/stores/domain/backlog/index.ts
autonomous: true
requirements: [BUG-BACKLOG-DEDUP]

must_haves:
  truths:
    - "Calling generate_backlog_from_scan with the same reports twice does NOT create duplicate backlog items"
    - "generateFromScan in the frontend store reloads full item list from DB after generation"
    - "createFromDiagnostic also does not create duplicates when item already exists from bulk generation"
  artifacts:
    - path: "src-tauri/src/storage/backlog.rs"
      provides: "backlog_item_exists dedup query function"
      contains: "backlog_item_exists"
    - path: "src-tauri/src/backlog/commands.rs"
      provides: "Dedup guard in generate_backlog_from_scan"
      contains: "backlog_item_exists"
    - path: "src/core/stores/domain/backlog/index.ts"
      provides: "Fixed generateFromScan that reloads from DB"
      contains: "loadItems"
  key_links:
    - from: "src-tauri/src/backlog/commands.rs"
      to: "src-tauri/src/storage/backlog.rs"
      via: "backlog_item_exists call before insert"
      pattern: "backlog_item_exists"
    - from: "src/core/stores/domain/backlog/index.ts"
      to: "loadItems"
      via: "generateFromScan calls loadItems after backend returns"
      pattern: "loadItems"
---

<objective>
Fix "Add to Backlog" creating duplicate items and showing only newly generated items instead of the full backlog.

Purpose: Two bugs cause confusing backlog behavior — (1) Rust backend inserts duplicates on repeated calls because there is no dedup check on repo_full_name + source_ref, (2) Frontend store replaces all items with only the newly generated subset instead of reloading the full list from DB.

Output: Dedup-safe backlog generation on both backend and frontend.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src-tauri/src/storage/backlog.rs
@src-tauri/src/backlog/commands.rs
@src/core/stores/domain/backlog/index.ts
</context>

<interfaces>
<!-- Key types the executor needs -->

From src-tauri/src/storage/backlog.rs:
```rust
pub struct BacklogItem {
    pub id: String,
    pub repo_full_name: String,
    pub source: String,
    pub source_ref: Option<String>,  // rule_id — dedup key with repo_full_name
    // ...other fields
}

pub fn insert_backlog_item(db: &DbState, item: &BacklogItem) -> Result<(), String>;
pub fn list_backlog_items(db: &DbState, filters: &BacklogFilters) -> Result<Vec<BacklogItem>, String>;
```

From src-tauri/src/backlog/commands.rs:
```rust
pub fn generate_backlog_from_scan(
    reports: Vec<RepoHealthReport>,
    db: State<DbState>,
) -> Result<Vec<BacklogItem>, String>;
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add dedup check to Rust backend</name>
  <files>src-tauri/src/storage/backlog.rs, src-tauri/src/backlog/commands.rs</files>
  <action>
1. In `src-tauri/src/storage/backlog.rs`, add a new public function `backlog_item_exists`:
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

2. In `src-tauri/src/backlog/commands.rs`, inside the `generate_backlog_from_scan` function, add a dedup guard BEFORE the insert on line 39. Inside the inner `for result in &report.results` loop, after the `if !result.passed` check, add:
   ```rust
   // Skip if backlog item already exists for this repo+rule
   if let Some(ref rule_id) = Some(result.rule_id.clone()) {
       if crate::storage::backlog::backlog_item_exists(&db, &report.repo_full_name, rule_id)
           .unwrap_or(false)
       {
           continue;
       }
   }
   ```
   Place this right before the `let priority = match ...` line. This way, existing items are silently skipped and only new failures get inserted.
  </action>
  <verify>cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5</verify>
  <done>Rust compiles cleanly. generate_backlog_from_scan skips inserting items that already exist for the same repo_full_name + source_ref (rule_id).</done>
</task>

<task type="auto">
  <name>Task 2: Fix frontend store to reload from DB after generation</name>
  <files>src/core/stores/domain/backlog/index.ts</files>
  <action>
In `src/core/stores/domain/backlog/index.ts`, fix the `generateFromScan` method (lines 91-124). Replace the success branch (lines 104-111) so that instead of `set({ items, isGenerating: false })` it calls `loadItems()` to get the full list from DB — exactly like `createFromDiagnostic` does on line 142.

Change lines 104-111 from:
```typescript
if (result.status === "ok") {
  const items = result.data as BacklogItem[];
  set(
    { items, isGenerating: false },
    undefined,
    "backlog/generate/ok",
  );
  log.success("backlog", `Generated ${items.length} backlog items`);
}
```

To:
```typescript
if (result.status === "ok") {
  const newItems = result.data as BacklogItem[];
  set({ isGenerating: false }, undefined, "backlog/generate/ok");
  await get().loadItems();
  log.success("backlog", `Generated ${newItems.length} new backlog items`);
}
```

This ensures the store always reflects the full DB state, not just the newly created subset.
  </action>
  <verify>npx tsc --noEmit 2>&1 | tail -5</verify>
  <done>generateFromScan calls loadItems() after backend returns, showing the complete backlog (existing + new items) instead of replacing with only new items.</done>
</task>

</tasks>

<verification>
1. `cargo build --manifest-path src-tauri/Cargo.toml` compiles without errors
2. `npx tsc --noEmit` passes without type errors
3. `npm run check` passes (Biome lint/format)
</verification>

<success_criteria>
- Rust backend skips inserting backlog items when repo_full_name + source_ref already exists in DB
- Frontend store reloads full item list from DB after bulk generation
- Both `generateFromScan` and `createFromDiagnostic` are idempotent — calling them multiple times does not create duplicates
- All compile checks pass (cargo build, tsc, biome)
</success_criteria>

<output>
After completion, create `.planning/quick/2-fix-add-to-backlog-creating-items-for-al/2-SUMMARY.md`
</output>

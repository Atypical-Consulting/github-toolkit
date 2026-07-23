---
phase: quick-2
verified: 2026-02-26T11:35:00Z
status: passed
score: 3/3 must-haves verified
gaps: []
human_verification:
  - test: "Trigger Add to Backlog twice for the same scan"
    expected: "Second invocation creates zero new items; full list still shows all existing items"
    why_human: "Idempotency requires runtime DB state; cannot verify programmatically without running the app"
---

# Quick Task 2: Fix Add to Backlog Duplicate Items — Verification Report

**Task Goal:** Fix "Add to Backlog" creating items for ALL scan results instead of only the selected one. Two root causes: (1) Rust backend dedup guard, (2) Frontend store reload.
**Verified:** 2026-02-26T11:35:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Calling `generate_backlog_from_scan` with the same reports twice does NOT create duplicate backlog items | VERIFIED | `backlog_item_exists` guard at lines 21-29 of `commands.rs` — skips insert when `repo_full_name + source_ref` already exists in DB |
| 2 | `generateFromScan` in the frontend store reloads full item list from DB after generation | VERIFIED | Lines 106-107 of `index.ts`: `set({ isGenerating: false })` then `await get().loadItems()` — replaces old "set items directly" pattern |
| 3 | `createFromDiagnostic` also does not create duplicates when item already exists from bulk generation | VERIFIED | `createFromDiagnostic` calls `commands.generateBacklogFromScan([miniReport])` which goes through the same dedup guard; backend is the single dedup point |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/storage/backlog.rs` | `backlog_item_exists` dedup query function | VERIFIED | Function present at lines 122-130; queries `COUNT(*)` by `repo_full_name + source_ref` |
| `src-tauri/src/backlog/commands.rs` | Dedup guard in `generate_backlog_from_scan` | VERIFIED | Guard at lines 20-29; calls `backlog_item_exists` before inserting, uses `continue` to skip |
| `src/core/stores/domain/backlog/index.ts` | Fixed `generateFromScan` that reloads from DB | VERIFIED | Lines 106-107 call `get().loadItems()` after backend returns |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src-tauri/src/backlog/commands.rs` | `src-tauri/src/storage/backlog.rs` | `backlog_item_exists` call before insert | WIRED | `crate::storage::backlog::backlog_item_exists(&db, &report.repo_full_name, &result.rule_id)` called on line 21-26 of `commands.rs` |
| `src/core/stores/domain/backlog/index.ts` | `loadItems` | `generateFromScan` calls `loadItems` after backend returns | WIRED | `await get().loadItems()` on line 107, inside the `result.status === "ok"` branch |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUG-BACKLOG-DEDUP | 2-PLAN.md | Dedup-safe backlog generation on backend and frontend | SATISFIED | `backlog_item_exists` in storage layer + dedup guard in command + `loadItems()` reload in store |

---

### Anti-Patterns Found

No anti-patterns detected in modified files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

Note: The string `"todo"` at line 43 of `commands.rs` is a legitimate status value (`status: "todo".to_string()`), not a placeholder comment.

---

### Commits Verified

Both commits documented in SUMMARY.md exist in the repository and have the correct diffs:

- `e8da487` — `fix(quick-2): add dedup guard in generate_backlog_from_scan` — added `backlog_item_exists` to `storage/backlog.rs` and wired the guard in `commands.rs` (+20 lines across 2 files)
- `4b3d55b` — `fix(quick-2): reload full backlog from DB after generateFromScan` — replaced `set({ items })` with `set({ isGenerating: false })` + `loadItems()` in `index.ts` (6 changed lines)

---

### Human Verification Required

#### 1. Idempotency at runtime

**Test:** Open the app, run a full scan, click "Add to Backlog" for a single repository diagnostic, then click the same button again.
**Expected:** Second click produces zero new rows; the backlog list shows identical item count as after the first click.
**Why human:** Requires a live DB with actual scan data; the dedup guard depends on DB state that cannot be asserted through static analysis alone.

#### 2. Full list shown after bulk generation

**Test:** Run "Generate from Scan" on the backlog page (which calls `generateFromScan` with all reports), then verify the backlog list shows ALL previously stored items plus any new ones — not just the newly generated subset.
**Expected:** Item count equals pre-existing items + net-new items from this scan.
**Why human:** State reconciliation between prior DB rows and new scan output requires a live running app and pre-existing DB state.

---

### Gaps Summary

No gaps. All three must-have truths are verified at all three artifact levels (exists, substantive, wired). Both root causes called out in the task goal have concrete, wired fixes in the actual codebase matching the plan exactly.

The two human-verification items above are runtime behaviour checks, not blockers — the static code evidence is conclusive for the dedup and reload logic.

---

_Verified: 2026-02-26T11:35:00Z_
_Verifier: Claude (gsd-verifier)_

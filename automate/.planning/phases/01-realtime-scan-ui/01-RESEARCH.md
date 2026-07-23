# Phase 1: Realtime Scan UI - Research

**Researched:** 2026-02-26
**Domain:** Tauri 2 event system + Zustand v5 slice state + SVG animation + React skeleton patterns
**Confidence:** HIGH — all findings verified against the live codebase

---

## Summary

Phase 1 is a surgical frontend + Rust fix. The complete infrastructure already exists: the Rust backend already emits `scan-progress` Tauri events after each individual repo scan completes, the `updateReport()` method already exists in `ResultsSlice`, and the `HealthRing` SVG component already has a CSS transition on `stroke-dashoffset`. The gap is purely in how `scan.slice.ts` consumes the `scan-progress` event — it currently only updates the progress counter, discarding the per-repo diagnostic data that arrives with each event. The fix requires three coordinated changes: (1) extend the `ScanProgress` Rust struct to carry an `Option<RepoHealthReport>` payload, (2) emit that payload in the post-repo event emission in `scan_all_repositories`, and (3) call `get().updateReport()` in the frontend event handler.

The skeleton/shimmer state (SCAN-03) requires tracking which repos are "in-flight" in Zustand state. This is a new state field — a `Set<string>` of repo full names currently scanning. The scan listener sets a repo as in-flight when its name appears in `currentRepo` of a progress event, and removes it when the same repo's `report` payload arrives. The health ring animation (SCAN-04) already works via the CSS `transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)` defined in `index.css` — the fix is simply ensuring `stroke-dashoffset` changes when new score data arrives per-repo, which happens automatically once `updateReport()` is wired in.

The memory leak / duplicate listener concern (SCAN-05) is the most nuanced part. The current `scan.slice.ts` correctly stores `unlisten` in a local `const` within `startScan` and calls it in the `finally` block. However, the Tauri `listen()` is called fresh on every `startScan()` invocation, which means if a component re-renders mid-scan and causes `startScan` to be called twice, a duplicate listener exists. The fix is to move the `unlisten` reference to a module-level or store-level variable so it can be cleaned up before a new registration.

**Primary recommendation:** Extend `ScanProgress` Rust struct with `report: Option<RepoHealthReport>`, emit it post-scan per repo, update `scan.slice.ts` to call `updateReport()` in the handler, add `scanningRepos: Set<string>` state for skeleton display, and fix the listener lifecycle to prevent duplicates.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCAN-01 | Health ring fills to its score as each repo's diagnostics complete during a scan | Rust: add `report: Option<RepoHealthReport>` to `ScanProgress`; TS: call `updateReport()` in event handler |
| SCAN-02 | Diagnostic breakdown (rules passed/failed) appears immediately per repo during scan | Same fix as SCAN-01 — `RepoHealthReport.results` contains the per-rule breakdown; it arrives in the same event payload |
| SCAN-03 | Repo cards show a skeleton/shimmer state while their diagnostics are in-flight | New Zustand state: `scanningRepos: Set<string>` managed in `scan.slice.ts`; CSS shimmer keyframe animation added to `index.css` |
| SCAN-04 | Health ring animates smoothly (300ms ease-in-out) when score updates | CSS transition already exists: `transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)` in `index.css`; requirement says 300ms — update transition to 300ms ease-in-out; no JS changes needed |
| SCAN-05 | Tauri event listener cleanup (unlisten) is properly handled to prevent memory leaks | Move `unlisten` to store-level ref; call unlisten before re-registering; verify in React devtools with HMR cycling |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new packages needed for Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/api/event` `listen()` | 2.x | Subscribe to Rust-emitted `scan-progress` events | Official Tauri event API; already used in `scan.slice.ts` |
| Zustand v5 | ^5 | Per-repo incremental state updates via `updateReport()` | Already the store framework; `reports: Record<string, RepoHealthReport>` stores per-repo state |
| Tailwind CSS v4 | ^4 | Skeleton shimmer via CSS `@keyframes` | Already the CSS framework; custom utility classes defined in `index.css` |
| `framer-motion` | ^12 | Optional: enhanced enter/exit animations for repo cards | Already installed; use for skeleton-to-content transition if desired |

### Supporting (existing Rust crates — no new crates needed)

| Crate | Purpose |
|-------|---------|
| `serde` + `specta` | Serialize the extended `ScanProgress` struct; `specta::Type` derive auto-updates `bindings.ts` |
| `tauri::Emitter` | Already imported in `diagnostics/commands.rs`; `app_handle.emit()` is the mechanism |

### Alternatives Considered

| Standard | Alternative | Tradeoff |
|----------|-------------|----------|
| CSS `transition` on `stroke-dashoffset` | JS animation via `framer-motion` `useSpring` | CSS transition already defined and working; JS animation adds bundle weight and React render coupling; use CSS |
| `Record<string, RepoHealthReport>` as the store shape | Flat `RepoHealthReport[]` array | `Record` allows surgical per-key updates; array requires replace-or-slice which triggers full re-render of every subscriber |
| `Set<string>` for `scanningRepos` | Array `string[]` for in-flight tracking | `Set` has O(1) `has()` check — each repo card calls `scanningRepos.has(repoFullName)` per render; array is O(n) |

**Installation:**
```bash
# No new packages required for Phase 1
```

---

## Architecture Patterns

### Recommended Project Structure

No new files needed for the core fix. The skeleton component may be inlined into `Dashboard.tsx` or extracted as `RepoCardSkeleton.tsx` if it grows beyond ~20 lines.

```
src-tauri/src/diagnostics/
├── commands.rs     # MODIFY: extend ScanProgress struct + add report field to post-repo emit
└── types.rs        # No change — RepoHealthReport already defined

src/
├── index.css                              # MODIFY: add @keyframes shimmer + .animate-shimmer class; update health-ring-fill transition to 300ms
├── core/stores/domain/diagnostics/
│   ├── scan.slice.ts                      # MODIFY: add scanningRepos Set, update listener lifecycle, call updateReport()
│   └── index.ts                           # No change
└── extensions/dashboard/
    └── Dashboard.tsx                      # MODIFY: pass scanningRepos to repo cards; add skeleton/shimmer rendering
```

### Pattern 1: Extend ScanProgress Event Payload

**What:** Add `report: Option<RepoHealthReport>` to the `ScanProgress` Rust struct. Emit `Some(report)` after each repo scan completes (the post-repo emit at line 184 of `commands.rs`). Keep `report: None` for the pre-repo emit (line 98) and the completion emit (line 198).

**When to use:** Any time a Rust struct drives a Tauri event and the frontend needs the completed work unit alongside the progress metadata.

**Current state (gap):**
```rust
// src-tauri/src/diagnostics/commands.rs line 21-28
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub total: u32,
    pub completed: u32,
    pub current_repo: String,
    pub from_cache: bool,
    // MISSING: pub report: Option<RepoHealthReport>,
}
```

**Fixed state:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub total: u32,
    pub completed: u32,
    pub current_repo: String,
    pub from_cache: bool,
    pub report: Option<RepoHealthReport>,  // ADD: Some when repo scan completes
}

// At line 184, after building the report:
let _ = app_handle.emit("scan-progress", ScanProgress {
    total,
    completed: (i + 1) as u32,
    current_repo: repo.full_name.clone(),
    from_cache,
    report: Some(report.clone()),  // ADD
});

// At line 98 (pre-repo emit) and line 198 (final emit): keep report: None
```

**Note on bindings.ts:** `tauri dev` auto-regenerates `src/bindings.ts` from the `specta::Type` derive. If testing offline without running Tauri, manually update the `ScanProgress` type in `bindings.ts` to add `report: RepoHealthReport | null`.

### Pattern 2: Incremental Zustand State Updates via Event Handler

**What:** In `scan.slice.ts`, add two behaviors to the `scan-progress` event handler: (1) call `get().updateReport(event.payload.report)` when `report` is present, and (2) maintain `scanningRepos` state — add `currentRepo` to the set on the pre-repo event, remove it when `report` arrives for that repo.

**Current state (gap):**
```typescript
// scan.slice.ts line 42-44
const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
    set({ scanProgress: event.payload }, undefined, "scan/progress");
    // MISSING: updateReport() call
    // MISSING: scanningRepos tracking
});
```

**Fixed state:**
```typescript
// Updated ScanProgress interface
interface ScanProgress {
  total: number;
  completed: number;
  currentRepo: string;
  fromCache: boolean;
  report: RepoHealthReport | null;  // ADD
}

// Updated ScanSlice interface
export interface ScanSlice {
  isScanRunning: boolean;
  scanProgress: ScanProgress | null;
  scanningRepos: Set<string>;   // ADD: repos currently in-flight
  scanError: string | null;
  startScan: (repos: any[]) => Promise<void>;
  cancelScan: () => Promise<void>;
}

// Updated createScanSlice
export const createScanSlice: StateCreator<...> = (set, get) => ({
  isScanRunning: false,
  scanProgress: null,
  scanningRepos: new Set<string>(),  // ADD
  scanError: null,

  startScan: async (repos) => {
    if (get().isScanRunning) return;

    set({
      isScanRunning: true,
      scanError: null,
      scanProgress: { total: repos.length, completed: 0, currentRepo: "", fromCache: false, report: null },
      scanningRepos: new Set<string>(),  // Reset on new scan
    }, undefined, "scan/start");

    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      const { currentRepo, report } = event.payload;

      set((state) => {
        const next = new Set(state.scanningRepos);
        if (currentRepo && !report) {
          // Pre-repo event: mark as in-flight
          next.add(currentRepo);
        }
        if (report) {
          // Post-repo event: remove from in-flight
          next.delete(report.repoFullName);
        }
        return { scanProgress: event.payload, scanningRepos: next };
      }, undefined, "scan/progress");

      // Apply per-repo result immediately
      if (event.payload.report) {
        get().updateReport(event.payload.report);
      }
    });

    try {
      // ... existing scan logic
    } finally {
      unlisten();
      set({ isScanRunning: false, scanProgress: null, scanningRepos: new Set() }, undefined, "scan/done");
    }
  },
});
```

**Important:** Zustand v5 does not support `Set` as a top-level state value with the default shallow equality check — the `Set` reference changes on every update even if the contents are the same from React's perspective, triggering re-renders. The correct pattern is to store `scanningRepos` as a `Set` but pass it via a selector that extracts a boolean per repo: `useDiagnosticsStore(state => state.scanningRepos.has(repoFullName))`. This ensures each repo card only re-renders when its own in-flight status changes.

### Pattern 3: Per-Repo Skeleton State in the Repository Card

**What:** Each repo card in the `RepositoriesTab` checks whether its `fullName` is in `scanningRepos`. If it is, render a shimmer skeleton in place of the health ring and stats. When the scan data arrives, the skeleton disappears and the health ring animates to the new score.

**Example (inside the RepositoriesTab repo card loop):**
```typescript
// Dashboard.tsx — RepositoriesTab
const { scanningRepos } = useDiagnosticsStore();

// Inside the ownerRepos.map():
const isScanning = scanningRepos.has(repo.fullName);

{isScanning ? (
  // Skeleton: same dimensions as HealthRing size={36}
  <div className="h-9 w-9 shrink-0 rounded-full animate-shimmer" />
) : report ? (
  <HealthRing score={report.healthScore} size={36} />
) : (
  <div className="flex h-9 w-9 shrink-0 items-center justify-center">
    <div className="h-2 w-2 rounded-full bg-surface-hover" />
  </div>
)}
```

**CSS to add to `index.css`:**
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    var(--color-surface-raised) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-raised) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
```

### Pattern 4: Fix Health Ring Animation Timing

**What:** The requirement says 300ms ease-in-out. The current CSS has `0.8s cubic-bezier(0.4, 0, 0.2, 1)`. Change the `health-ring-fill` transition timing in `index.css`.

**Current:**
```css
/* index.css line 149 */
.health-ring-fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Fixed (matches SCAN-04 requirement exactly):**
```css
.health-ring-fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 300ms ease-in-out;
}
```

**Note:** The `HealthRing` component in `Dashboard.tsx` computes `offset` from `score` and sets `strokeDashoffset={offset}` as a prop. When the score prop changes (because `updateReport()` was called), React updates the DOM attribute, and the CSS transition fires automatically. No JS animation library needed.

### Pattern 5: Listener Lifecycle — Prevent Memory Leaks (SCAN-05)

**What:** Move the `unlisten` reference out of `startScan`'s closure so it can be called defensively before a new `listen()` is registered.

**Problem with current code:**
The current implementation stores `unlisten` as a `const` inside the `startScan` async function. If `startScan` is called while a scan is already in progress (the `isScanRunning` guard prevents this, but HMR or strict mode can cause the guard to be bypassed), a new listener is registered without the old one being cleaned up.

**Robust fix:**
```typescript
// scan.slice.ts — module-level variable
let currentUnlisten: (() => void) | null = null;

export const createScanSlice: StateCreator<...> = (set, get) => ({
  startScan: async (repos) => {
    if (get().isScanRunning) return;

    // Clean up any stale listener before registering a new one
    currentUnlisten?.();
    currentUnlisten = null;

    set({ isScanRunning: true, ... });

    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      // handler
    });
    currentUnlisten = unlisten;

    try {
      // scan
    } finally {
      currentUnlisten?.();
      currentUnlisten = null;
      set({ isScanRunning: false, scanProgress: null, scanningRepos: new Set() });
    }
  },
});
```

**Alternative approach (store-level ref instead of module-level):** Add `_unlistenScan: (() => void) | null` as a non-reactive field in the store state (prefixed with `_` to indicate it's internal). Set it via `set()` after `listen()` resolves. This keeps the reference co-located with the store without module-level mutable state. Both approaches are valid; the module-level variable is simpler.

**Why this matters for navigation (SCAN-05 success criterion 5):**
The Dashboard component mounts once and stays mounted (the app uses a tab-based navigation pattern, not route-based unmount/remount). The primary risk is HMR in development, which hot-reloads the module and creates a new `createScanSlice` factory — the module-level `currentUnlisten` variable gets reset. This is acceptable for development; in production (no HMR), the risk is negligible. The bigger risk is a future refactor that uses React Router with full unmount/remount — if that happens, the React `useEffect` cleanup pattern must be added to the Dashboard component's event consumer as well.

### Anti-Patterns to Avoid

- **Storing `scanningRepos` as an array and using `.includes()`:** O(n) per repo card render; with 50+ repos this degrades on each event. Use `Set` with a per-repo boolean selector.
- **Calling `setReports()` (replace all) instead of `updateReport()` (merge one):** `setReports()` replaces the entire `reports` Record, triggering re-renders for all repo cards on every event. `updateReport()` merges one key and only triggers re-renders for subscribers of that specific key via selector.
- **Animate score in JS instead of CSS:** Implementing the health ring animation in JS (e.g., `useSpring` from `framer-motion`) re-renders the SVG on every animation frame. The CSS `transition` on `stroke-dashoffset` runs on the compositor thread with zero React render cost.
- **Calling `unlisten()` before the final `scan-progress` event fires:** The Rust backend emits a final `scan-progress` event after all repos complete (line 198 in `commands.rs`). If `unlisten()` is called too early (e.g., when `completed === total`), this final event is missed. The current pattern (call `unlisten()` in the `finally` block after `scanAllRepositories()` resolves) is correct — it deregisters after the Tauri IPC call returns, which is guaranteed to be after all events have been emitted.
- **Adding `scanningRepos` to React component state via `useState`:** The scanning state must live in the Zustand store (not component state) so the Dashboard can track which repos are in-flight even if a different component triggers the scan.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth health ring animation | JS `requestAnimationFrame` loop or React spring | CSS `transition` on `stroke-dashoffset` (already in `index.css`) | Compositor-thread animation; zero render cost; already implemented |
| Shimmer effect | Custom canvas animation | CSS `@keyframes shimmer` with `background-position` | Standard pattern; GPU-accelerated; one CSS block |
| Per-repo subscription in React | Manual subscription system | Zustand `useStore(state => state.reports[repoFullName])` selector | Zustand selector equality check handles re-render isolation automatically |
| Tauri event batching | Custom debounce queue | React `startTransition()` wrapping store updates | Marks updates as non-urgent; browser can batch with existing renders; built-in |

**Key insight:** Phase 1 is a "wire the existing plumbing" task. All building blocks exist. The work is connecting them correctly, not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Zustand Set Mutation Triggers Extra Re-Renders

**What goes wrong:** `Set` objects in Zustand state appear to change reference on every `set()` call even when contents are unchanged, because `new Set(state.scanningRepos)` always creates a new reference. If a component subscribes to the entire `scanningRepos` set, it re-renders on every `scan-progress` event.

**Why it happens:** Zustand's equality check is shallow (`Object.is`). A new `Set` instance is never `===` to the old one even with identical contents.

**How to avoid:** Components must not subscribe to `state.scanningRepos` directly. They must use a derived boolean selector:
```typescript
const isScanning = useDiagnosticsStore(
  useCallback((state) => state.scanningRepos.has(repoFullName), [repoFullName])
);
```
This subscription updates only when the boolean value changes, not on every Set modification.

**Warning signs:** React DevTools Profiler shows all visible repo cards re-rendering on every `scan-progress` event.

### Pitfall 2: `report: None` on Pre-Repo Event Causes Null Check Failures in TypeScript

**What goes wrong:** When the TypeScript `ScanProgress` interface adds `report: RepoHealthReport | null`, code that previously did `event.payload.report.healthScore` without a null check throws at runtime.

**Why it happens:** The Rust `Option<RepoHealthReport>` serializes as `null` in JSON. TypeScript strict mode will catch missing null checks at compile time if the `bindings.ts` type is correctly defined, but a handwritten placeholder may have `report: RepoHealthReport` (non-nullable).

**How to avoid:** Ensure `bindings.ts` defines `report: RepoHealthReport | null` (not `report?: RepoHealthReport`, which would be `undefined` not `null`). Always guard with `if (event.payload.report)` before accessing.

**Warning signs:** TypeScript errors saying "report is possibly null" — these are correct and must be fixed, not suppressed.

### Pitfall 3: Skeleton Dimensions Don't Match HealthRing

**What goes wrong:** When the skeleton disappears and the `HealthRing` appears, there is a layout shift (cumulative layout shift / CLS) that makes the card jump. Users perceive this as a bug.

**Why it happens:** The skeleton `div` has different dimensions than the `HealthRing` SVG element. The `HealthRing` uses `size={36}` → 36x36px. The skeleton must match exactly.

**How to avoid:** Use `h-9 w-9` (36px = 9 × 4px in Tailwind's 4px scale) for the skeleton div. Test with slow-motion in DevTools to verify no layout shift.

**Warning signs:** Visible card height change when skeleton transitions to ring.

### Pitfall 4: Missing `scanningRepos` Reset on Scan Cancellation

**What goes wrong:** If the user clicks "Stop Scan" mid-scan, `isScanRunning` becomes false but `scanningRepos` still contains the in-flight repos. Cards for those repos show skeleton state indefinitely.

**Why it happens:** The `finally` block in `startScan` needs to clear `scanningRepos: new Set()` in all exit paths including cancellation and error.

**How to avoid:** The `finally` block already runs regardless of how the scan ends. Ensure `scanningRepos: new Set()` is included in the `scan/done` state update.

**Warning signs:** After a cancelled scan, some repo cards show the shimmer animation but never resolve to their health ring.

### Pitfall 5: Re-renders During Scan Degrade UI Responsiveness

**What goes wrong:** With 50+ repos, the Repositories tab receives one `scan-progress` event per repo. Each event triggers a state update in Zustand. If multiple components are subscribed to related state, the render tree becomes expensive and the UI feels sluggish.

**Why it happens:** Using broad selectors like `const { reports, scanningRepos } = useDiagnosticsStore()` subscribes the component to ALL store updates including every event. The component re-renders on every single progress event.

**How to avoid:** Use fine-grained selectors per repo card. The `RepositoriesTab` parent should not subscribe to `reports` at all — each individual repo card row subscribes to only its own report:
```typescript
// Per-row component, not in the parent list
function RepoRow({ repo }: { repo: RepoSummary }) {
  const report = useDiagnosticsStore(
    useCallback((s) => s.reports[repo.fullName], [repo.fullName])
  );
  const isScanning = useDiagnosticsStore(
    useCallback((s) => s.scanningRepos.has(repo.fullName), [repo.fullName])
  );
  // ...
}
```

**Warning signs:** React DevTools Profiler shows the parent `RepositoriesTab` re-rendering on every event; all 50+ rows re-rendering together.

---

## Code Examples

Verified patterns from the existing codebase:

### Existing: How `updateReport()` Works (results.slice.ts)

```typescript
// Source: src/core/stores/domain/diagnostics/results.slice.ts line 53-58
updateReport: (report) => {
  set(
    (state) => ({ reports: { ...state.reports, [report.repoFullName]: report } }),
    undefined,
    "results/updateOne",
  );
},
```

This is a `Record` spread update — creates a new object reference with one key overwritten. Components subscribed to `state.reports[specificKey]` only re-render when that key's value changes.

### Existing: How `listen()` Is Used (scan.slice.ts)

```typescript
// Source: src/core/stores/domain/diagnostics/scan.slice.ts line 42-44
const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
  set({ scanProgress: event.payload }, undefined, "scan/progress");
});
```

The `listen()` call is async (returns `Promise<UnlistenFn>`). The `unlisten` function must be called to clean up. The current `finally` block at line 69 (`unlisten()`) handles this for the normal scan completion path.

### Existing: CSS Health Ring Transition (index.css)

```css
/* Source: src/index.css line 145-150 */
.health-ring-fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  /* MODIFY: change to 300ms ease-in-out per SCAN-04 */
}
```

### Existing: HealthRing SVG Component (Dashboard.tsx)

```typescript
// Source: src/extensions/dashboard/Dashboard.tsx line 553-582
function HealthRing({ score, size = 40 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "var(--color-success)" : score >= 40 ? "var(--color-warning)" : "var(--color-error)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="health-ring" width={size} height={size}>
        <circle className="health-ring-track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="health-ring-fill"
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}  // CSS transition fires when this changes
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-bold tabular-nums" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}
```

When `score` changes (because `updateReport()` updated the store), React recalculates `offset` and sets the new `strokeDashoffset`. The CSS transition fires automatically — no imperative animation needed.

### Shimmer Skeleton Pattern (to add to index.css)

```css
/* Add to src/index.css after the .health-ring-fill block */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    var(--color-surface-raised) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-raised) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Batch all reports at scan end | Per-repo `updateReport()` on each `scan-progress` event | Phase 1 (this work) | Health rings animate incrementally; users see live progress |
| No skeleton state | `scanningRepos: Set<string>` tracks in-flight repos | Phase 1 (this work) | Cards show shimmer while scanning; no empty/stale rings during active scan |
| `transition: 0.8s` on health ring | `transition: 300ms ease-in-out` | Phase 1 (this work) | Meets SCAN-04 spec requirement; faster, snappier feel |
| `unlisten` in local closure | Module-level `currentUnlisten` ref | Phase 1 (this work) | Prevents duplicate listener accumulation across HMR and rapid scan restarts |

**Deprecated/outdated:**
- `setReports()` as the primary scan completion mechanism: Still needed as a safety-net no-op after `scanAllRepositories()` resolves, but it is no longer the primary state update mechanism. Per-repo `updateReport()` in the event handler is the primary path.

---

## Open Questions

1. **Should repo cards be extracted into a separate `RepoRow` component?**
   - What we know: The current implementation renders all repo rows inline in `RepositoriesTab` with a `.map()`. Adding per-repo selectors inside the map callback creates anonymous selector functions that defeat memoization.
   - What's unclear: Whether the performance cost is measurable at the expected 50-200 repo scale, or if it is a premature optimization concern.
   - Recommendation: Extract to a named `RepoRow` component so that `useCallback` can properly memoize the per-repo selectors. This is a clean code improvement regardless of performance implications.

2. **Should `scanningRepos` state use `subscribeWithSelector` middleware?**
   - What we know: The codebase does not currently use `subscribeWithSelector`. The Zustand v5 docs show that standard per-key selectors with `useCallback` achieve the same isolation.
   - What's unclear: Whether the added middleware complexity is worth it vs. simply using `useCallback` selectors.
   - Recommendation: Use `useCallback` selectors first. Add `subscribeWithSelector` only if profiling shows re-render performance problems.

3. **Should the pre-repo `scan-progress` event set `report: None` or be eliminated?**
   - What we know: The Rust backend emits two events per repo: one before (pre-scan status "starting this repo") and one after (post-scan with results). The pre-scan event drives the skeleton state via `currentRepo`.
   - What's unclear: Whether eliminating the pre-repo event and inferring "scanning" state from the queue position is cleaner.
   - Recommendation: Keep the pre-repo event. It clearly separates "this repo is starting" from "this repo is done" semantics. Adding `report: None` to the pre-repo event is explicit and easy to reason about.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` (the config has `workflow.research`, `workflow.plan_check`, `workflow.verifier` but no `nyquist_validation` key). Skipping formal validation architecture section.

However, for completeness, Phase 1's success criteria are verifiable as follows:

| Req ID | Verification Method | Automated? |
|--------|---------------------|-----------|
| SCAN-01 | Trigger scan; observe health ring updating per-repo in Repositories tab before scan completes | Manual (visual) |
| SCAN-02 | Trigger scan; navigate to a completed repo's card and verify diagnostic breakdown appears | Manual (visual) |
| SCAN-03 | Trigger scan; observe shimmer animation on in-flight repo cards | Manual (visual) |
| SCAN-04 | Inspect DevTools computed style; verify `transition-duration: 300ms` on `.health-ring-fill` | Manual (DevTools) |
| SCAN-05 | HMR-reload the app 3+ times; trigger scan; verify scan events processed once per repo in Zustand DevTools | Manual (DevTools) |

**Test framework:** Vitest is configured (`npm run test`). No test files exist in the frontend yet. Unit tests for the store slice mutation logic (`updateReport`, `scanningRepos` Set management) would be valuable but are Wave 0 gaps if tests are required.

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)

- `src-tauri/src/diagnostics/commands.rs` — `ScanProgress` struct, `scan_all_repositories` emit points
- `src-tauri/src/diagnostics/types.rs` — `RepoHealthReport` struct definition
- `src/core/stores/domain/diagnostics/scan.slice.ts` — current listener implementation
- `src/core/stores/domain/diagnostics/results.slice.ts` — `updateReport()` implementation
- `src/extensions/dashboard/Dashboard.tsx` — `HealthRing` component, repo card rendering
- `src/index.css` — existing CSS animations and health ring transition

### Secondary (HIGH confidence — official docs)

- Tauri v2 event system: https://v2.tauri.app/develop/calling-frontend/ — `app_handle.emit()`, `listen()` patterns
- Tauri `listen()` API: https://v2.tauri.app/reference/javascript/api/namespaceevent/ — `UnlistenFn` lifecycle
- Zustand v5 docs: selector patterns for fine-grained subscriptions

### Tertiary (MEDIUM confidence — project research docs)

- `.planning/research/ARCHITECTURE.md` — Pattern 1 (incremental scan event) extensively documented
- `.planning/research/PITFALLS.md` — Pitfall 4 (batch-at-end trap), Pitfall 5 (listener memory leak)
- `.planning/research/FEATURES.md` — Realtime UI patterns section

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used; no new dependencies
- Architecture: HIGH — implementation path is a direct extension of existing code; no new patterns introduced
- Pitfalls: HIGH — Zustand Set behavior, CSS transition mechanics, Tauri listener lifecycle all verified against official docs and codebase

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (30 days — stable Tauri/Zustand APIs)

---
phase: 01-realtime-scan-ui
plan: 02
subsystem: ui
tags: [react, zustand, css, tailwind, animation, skeleton, performance]

# Dependency graph
requires:
  - 01-01 (scanningRepos Set in useDiagnosticsStore)
provides:
  - Shimmer skeleton animation per repo card during scan
  - Health ring 300ms ease-in-out transition timing
  - RepoRow component with fine-grained per-repo Zustand selectors

affects: [03-health-rings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useCallback selector pattern for fine-grained Zustand subscriptions per list item"
    - "Skeleton dimensions match target component size (h-9 w-9) to prevent CLS"
    - "CSS custom property shimmer animation compatible with Catppuccin Mocha theme"

key-files:
  created: []
  modified:
    - src/index.css
    - src/extensions/dashboard/Dashboard.tsx

key-decisions:
  - "isScanning takes priority over stale report — shimmer shows even if a previous scan result exists, reflecting current in-flight state"
  - "RepoRow uses module-level useCallback selectors (not inline lambdas) to prevent selector recreation on every parent render"
  - "RepositoriesTab keeps reports prop for sort-by-score useMemo; only row rendering delegates to RepoRow per-repo selectors"
  - "Removed navigateTo from RepositoriesTab after it migrated to RepoRow — no unused hook references"

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 01 Plan 02: Shimmer Skeleton and Health Ring Animation Summary

**Shimmer skeleton CSS with @keyframes shimmer + RepoRow extracted with per-repo useCallback selectors preventing full-list re-renders on every scan-progress event**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T10:00:52Z
- **Completed:** 2026-02-26T10:04:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Updated `.health-ring-fill` CSS transition from `0.8s cubic-bezier` to `300ms ease-in-out` (SCAN-04)
- Added `@keyframes shimmer` and `.animate-shimmer` utility class using Catppuccin Mocha CSS variables for theme consistency
- Extracted `RepoRow` component from inline `.map()` in `RepositoriesTab` — each row now subscribes only to its own report and scanning status via `useCallback` selectors
- Shimmer skeleton (`h-9 w-9 rounded-full animate-shimmer`) renders when `scanningRepos.has(repo.fullName)` is true, with dimensions matching `HealthRing size={36}` to prevent layout shift (SCAN-03)
- `isScanning` check takes priority over report presence — shows shimmer even when stale data exists during re-scan

## Task Commits

Each task was committed atomically:

1. **Task 1: Add shimmer CSS and update health ring animation timing** - `62fa424` (feat)
2. **Task 2: Extract RepoRow component with per-repo selectors and skeleton state** - `e889344` (feat)

## Files Created/Modified

- `src/index.css` - Updated `.health-ring-fill` transition to `300ms ease-in-out`; added `@keyframes shimmer` and `.animate-shimmer` utility class
- `src/extensions/dashboard/Dashboard.tsx` - Added `useCallback` import; extracted `RepoRow` component with per-repo store selectors; replaced inline ownerRepos.map() with `<RepoRow>`; removed unused `navigateTo` from `RepositoriesTab`

## Decisions Made

- `isScanning` prioritized over stale report to reflect true current scan state — avoids showing outdated health score while new scan is running for that repo
- `useCallback` selectors chosen over inline arrow functions to prevent selector recreation on every RepositoriesTab render cycle
- `RepositoriesTab` retains `reports` prop for sort-by-score `useMemo` — only the per-row rendering was moved to `RepoRow`
- `navigateTo` removed from `RepositoriesTab` after moving it into `RepoRow` to avoid unused hook references

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled cleanly on first attempt, no type errors or linting issues.

## User Setup Required

None - pure frontend CSS and TypeScript changes, no external dependencies or configuration required.

## Next Phase Readiness

- `animate-shimmer` CSS class is available globally for any component that needs skeleton states
- `RepoRow` pattern demonstrates the correct useCallback selector approach for per-item Zustand subscriptions
- All success criteria met: SCAN-03 (skeleton) and SCAN-04 (animation timing) complete
- Plan 03 (health rings) can build on `scanningRepos` store data and the established selector pattern

---
*Phase: 01-realtime-scan-ui*
*Completed: 2026-02-26*

## Self-Check: PASSED

- FOUND: src/index.css (modified - shimmer keyframe + transition timing)
- FOUND: src/extensions/dashboard/Dashboard.tsx (modified - RepoRow + useCallback)
- FOUND commit: 62fa424 (Task 1 - CSS shimmer)
- FOUND commit: e889344 (Task 2 - RepoRow component)

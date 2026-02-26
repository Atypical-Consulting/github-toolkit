# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Hardcoded OAuth Client ID:**
- Issue: OAuth Client ID `Ov23liGPdt9oE8quH9XV` is hardcoded directly in source at `src-tauri/src/github/auth.rs` line 10. Project documentation notes this is FlowForge's Client ID, not a dedicated GitHubAutomate app registration.
- Files: `src-tauri/src/github/auth.rs:10`
- Impact: App cannot be distributed or shared; OAuth flow will fail for users not authorized by FlowForge's app. Security risk if source is exposed publicly.
- Fix approach: Register a dedicated GitHub OAuth App, move Client ID to environment variable or Tauri configuration, read at runtime rather than compile-time.

**Manual Base64 Implementation:**
- Issue: Custom base64 decoder implemented in `context.rs` instead of using standard library. Home-rolled crypto-adjacent code is fragile and rarely audited.
- Files: `src-tauri/src/diagnostics/context.rs:73-97`
- Impact: Potential edge case bugs in decoding; GitHub API responses with unusual Base64 padding or whitespace could fail silently or cause panics.
- Fix approach: Replace with `base64` crate (e.g., `base64::engine::general_purpose::STANDARD.decode()`). Standard library function handles edge cases properly.

**Database Migrations via `.ok()` Swallowing Errors:**
- Issue: Schema migrations in `src-tauri/src/storage/db.rs:62-77` use `.ok()` to ignore "duplicate column" errors on repeated `ALTER TABLE` statements. This silently swallows all errors, including genuine migration failures.
- Files: `src-tauri/src/storage/db.rs:62-77`
- Impact: If a migration fails for a legitimate reason (e.g., constraint violation, disk full), the app will not error and database will be in partially-migrated state. Future operations may fail mysteriously.
- Fix approach: Check if column exists before altering, or use a proper migration version table. Only ignore `E_TableHasNoColumn` error specifically.

**Tauri-Specta Binding Generation Workaround:**
- Issue: Tauri-specta generates invalid TypeScript (`export type TAURI_CHANNEL<TSend> = null`) that must be manually patched in `lib.rs:65-70` during debug builds.
- Files: `src-tauri/src/lib.rs:65-70`
- Impact: Binding regeneration is unreliable; if the patch fails, TypeScript compilation will error. This is a symptom of tauri-specta version mismatch or bug, not a stable solution.
- Fix approach: Pin tauri-specta version that doesn't produce invalid output, or upstream the fix. Track tauri-specta release notes for resolution.

**Large Monolithic Components:**
- Issue: `Dashboard.tsx` is 940 lines, `RepoDetailsPage.tsx` is 696 lines. Both components mix state management, business logic, and UI rendering in single files.
- Files: `src/extensions/dashboard/Dashboard.tsx` (940 lines), `src/extensions/repo-details/RepoDetailsPage.tsx` (696 lines)
- Impact: Difficult to test, reuse, or modify individual concerns. Adding features requires touching bloated components.
- Fix approach: Extract sub-components (ScanControls, RepoList, HealthChart, etc.), move state hooks into custom hooks or separate modules. Aim for <300 line components.

**Unused `interval` Parameter in Auth Poll:**
- Issue: `github_poll_auth()` in `src-tauri/src/github/auth.rs:77` receives `interval: u32` parameter that is immediately discarded with `let _ = interval;`
- Files: `src-tauri/src/github/auth.rs:77`
- Impact: Dead code; suggests intent to implement exponential backoff or adaptive polling that was never completed. Confuses future maintainers.
- Fix approach: Implement exponential backoff using interval parameter, or remove parameter entirely. Update frontend callers if removing.

## Known Bugs

**Scan Cancellation Flag Not Reset on Error:**
- Symptoms: If `scan_all_repositories()` encounters an error mid-scan (e.g., network timeout), the cancellation flag may remain in `true` state, preventing subsequent scans from starting.
- Files: `src-tauri/src/diagnostics/commands.rs:78-120`, `src/core/stores/domain/diagnostics/scan.slice.ts:31-72`
- Trigger: Start scan → encounter network error mid-way → attempt second scan → scan exits immediately due to flag still true
- Workaround: Restart the application or wait for timeout before retrying. Proper fix requires resetting flag in error paths.

**Base64 Decoding Silent Failures:**
- Symptoms: README files with invalid or truncated Base64 encoding (from GitHub API edge cases) silently return empty string instead of error.
- Files: `src-tauri/src/diagnostics/context.rs:62-70`
- Trigger: Repository with corrupted file metadata from GitHub API
- Workaround: None; diagnostics proceed with empty README content, may cause false "No README" failures.

**Potential Race Condition in Scan Progress Events:**
- Symptoms: If frontend unlisten fires before last scan-progress event is emitted, progress UI may not update to completion.
- Files: `src/core/stores/domain/diagnostics/scan.slice.ts:42, 68`
- Trigger: Very fast network, rapid scan completion
- Workaround: None observed in code; relying on Tauri event ordering.

## Security Considerations

**GitHub OAuth Token Temporarily in Memory:**
- Risk: During `github_poll_auth()` in `auth.rs:109`, access token is stored in memory and passed to `token::store_token()`. If process crashes before keychain write completes, token could be in heap dump.
- Files: `src-tauri/src/github/auth.rs:109`, `src-tauri/src/github/token.rs:8-20`
- Current mitigation: Tokens stored immediately in OS keychain; Rust memory cleared when variable drops. Keychain is encrypted by OS.
- Recommendations:
  - Use `zeroize` crate to securely clear token bytes from memory after keychain write.
  - Add panic handler to ensure keychain entry is flushed even on panic.
  - Document keychain access in security guidelines.

**No Token Refresh Mechanism:**
- Risk: OAuth tokens issued by GitHub may have expiration. If app runs for extended period or token revoked externally, auth will silently fail without user knowing.
- Files: `src-tauri/src/github/token.rs`, `src-tauri/src/github/auth.rs`
- Current mitigation: Device Flow tokens typically don't expire, but nothing prevents external revocation.
- Recommendations:
  - Implement token refresh on 401 Unauthorized responses from GitHub API.
  - Show user-friendly error prompting re-authentication if token becomes invalid.

**No Rate Limit Preemption:**
- Risk: Rate limit checking exists (`rate_limit.rs`) but is not called before expensive operations like `scan_all_repositories()`. If user has few API calls remaining, scan may fail partway through.
- Files: `src-tauri/src/diagnostics/commands.rs:73-120` (no rate limit check before scan)
- Current mitigation: Errors bubble up; user sees "API error" without guidance.
- Recommendations:
  - Check remaining rate limit before starting scan, warn user if < repos × API calls per repo.
  - Implement per-repo timeout/retry with exponential backoff to handle transient rate limiting.

**Base64 Implementation Doesn't Validate Padding:**
- Risk: Custom base64 decoder silently accepts malformed input (missing padding, invalid length). Could lead to information disclosure if partial decryption occurs.
- Files: `src-tauri/src/diagnostics/context.rs:73-97`
- Current mitigation: GitHub API responses are trusted; decoding errors return empty string instead of panicking.
- Recommendations:
  - Use standard base64 crate instead of custom implementation.
  - Validate decoded output length matches expected file size before use.

**No Input Validation on Repository Names:**
- Risk: Repo names and owners passed to Tauri commands are used directly in GitHub API URLs without URL encoding validation. Specially-crafted names could potentially cause path traversal or injection.
- Files: `src-tauri/src/diagnostics/commands.rs:39-44`, `src-tauri/src/github/repos.rs:42-100`
- Current mitigation: GitHub API URL paths are constructed with format strings; OS-level URL validation happens at HTTP layer.
- Recommendations:
  - Validate owner/repo names against GitHub's documented format (alphanumeric, hyphens, underscores).
  - Add unit tests for edge cases (empty strings, unicode, special characters).

## Performance Bottlenecks

**Synchronous SQLite Writes in Event-Driven Context:**
- Problem: Database writes in `scan_all_repositories()` and backlog operations use blocking SQLite queries without connection pooling. Large scans (100+ repos) may block Tauri event loop.
- Files: `src-tauri/src/storage/commands.rs`, `src-tauri/src/backlog/commands.rs`
- Cause: Single `Mutex<Connection>` for all database operations; no async wrapper or worker pool.
- Improvement path:
  - Move database writes to spawned Tokio task (already using tokio runtime).
  - Consider `sqlx` crate for async SQLite operations instead of `rusqlite`.
  - Add batch insert support to reduce round-trips (currently individual inserts per repo).

**README Content Fetched Even When Not Needed:**
- Problem: `build_repo_context()` fetches full README content and line count for every repo, even if README check passes. Content stored in memory but not persisted, recalculated on subsequent checks.
- Files: `src-tauri/src/diagnostics/context.rs:17-28`
- Cause: No caching mechanism; fetched on every diagnostic run.
- Improvement path:
  - Cache README content in database `diagnostic_rule_results` table alongside pass/fail status.
  - Skip fetch if cached and repo not updated since last fetch (compare `pushed_at` timestamp).

**N+1 API Calls for Repository Details:**
- Problem: For each repo, at minimum 3 API calls made: `/repos/{owner}/{repo}` (basic info), `/repos/{owner}/{repo}/contents/` (root files), `/repos/{owner}/{repo}/contents/.github/workflows` (workflow files). For 100 repos = 300+ calls.
- Files: `src-tauri/src/diagnostics/commands.rs:73-120`, `src-tauri/src/diagnostics/context.rs:44-52`
- Cause: GitHub API doesn't support batch queries; sequential fetches required.
- Improvement path:
  - Use GraphQL API to fetch multiple repos and their contents in single query (major refactor).
  - Cache file listings and only refetch if `pushed_at` changed.
  - Implement smart batching: fetch only new/modified repos on incremental scans.

**Frontend Scan Progress Events May Accumulate:**
- Problem: `listen()` for `scan-progress` events in `scan.slice.ts:42` doesn't debounce or batch events. UI rerenders on every event; with 100+ repos, may render 100+ times.
- Files: `src/core/stores/domain/diagnostics/scan.slice.ts:42-44`
- Cause: Zustand batches updates, but Tauri event listener isn't debounced.
- Improvement path:
  - Batch progress events on Rust side (emit every 10 repos instead of per-repo).
  - Add debounced event listener on frontend (100ms debounce).

## Fragile Areas

**Diagnostic Rules System:**
- Files: `src-tauri/src/diagnostics/rules.rs`, `src-tauri/src/diagnostics/engine.rs`
- Why fragile: Rules are trait implementations with hardcoded logic; adding new rule requires touching engine boilerplate. No registry pattern or plugin system; tight coupling between rule implementations and engine.
- Safe modification:
  - Create new struct implementing `DiagnosticRule` trait.
  - Add to `default_rules()` vec in `rules.rs`.
  - Run tests to ensure scoring calculations unchanged.
- Test coverage: No unit tests for individual rules; only tested via end-to-end scans. Difficult to isolate rule failures.

**Authentication State Machine:**
- Files: `src-tauri/src/github/auth.rs`, `src-tauri/src/github/token.rs`, `src/core/stores/domain/github/auth.slice.ts`
- Why fragile: Auth state spans Rust (keychain) and frontend (Zustand store). Desynchronization possible if:
  - Token deleted from keychain externally (e.g., password manager sync).
  - Frontend thinks authenticated but backend token missing.
  - Concurrent auth requests race each other.
- Safe modification:
  - Always call `checkAuth()` before sensitive operations.
  - Add defensive checks in token.rs to validate keychain entry exists.
  - Never cache token in frontend state; fetch from backend on demand.
- Test coverage: Only integration-tested via mock OAuth. No unit tests for token refresh scenarios.

**Database Schema and Migrations:**
- Files: `src-tauri/src/storage/db.rs`
- Why fragile: Migrations use `.ok()` error swallowing; no version tracking. If user has partially-migrated schema from crashed app, re-running `init_db()` silently succeeds but with incomplete schema.
- Safe modification:
  - Never remove `ALTER TABLE` statements from `init_db()`.
  - Always test schema initialization on fresh and upgraded app installs.
  - Add `PRAGMA foreign_keys = ON;` to enforce referential integrity.
- Test coverage: None. Database initialization untested.

**Tauri-Specta Binding Generation:**
- Files: `src-tauri/src/lib.rs:59-71`
- Why fragile: Relies on external crate behavior; patch is brittle and may break on version upgrades.
- Safe modification:
  - Before upgrading tauri-specta, regenerate bindings and check for new invalid output.
  - If patch breaks, check tauri-specta release notes or GitHub issues.
  - Consider locking tauri-specta version to known-good release.
- Test coverage: None. Binding generation is manual/implicit.

## Scaling Limits

**SQLite Connection Pool:**
- Current capacity: Single `Mutex<Connection>` shared across all Tauri commands.
- Limit: As concurrent requests increase (future multi-window support), mutex contention will cause delays. Scan operations block all other DB operations.
- Scaling path:
  - Implement connection pool (e.g., `sqlx::Pool`).
  - Move heavy operations to background worker threads.
  - Consider migrating to PostgreSQL if moving to server-based architecture.

**GitHub API Rate Limiting:**
- Current capacity: 5000 requests/hour for authenticated user.
- Limit: Scanning 100 repos × 3 API calls/repo = 300 calls. Backlog generation + issue creation adds 100+ more. Can burn through quota quickly with multiple scans.
- Scaling path:
  - Implement incremental scans (only updated repos since last scan).
  - Batch GraphQL queries to reduce call count by 50-70%.
  - Cache results with smart invalidation (e.g., 24-hour TTL).
  - Warn user when approaching rate limit; offer option to defer non-critical scans.

**Memory Usage in Large Scans:**
- Current capacity: All `RepoHealthReport` and `DiagnosticResult` objects stored in memory until scan completes.
- Limit: Scanning 1000 repos could consume 100+ MB (each report ≈ 1-5KB with all diagnostic results). Desktop app may become sluggish.
- Scaling path:
  - Stream results to database during scan instead of collecting in memory.
  - Load reports on-demand from database for UI display.
  - Implement pagination in RepoDetailsPage (currently loads all reports).

## Dependencies at Risk

**Tauri Specta (RC Version):**
- Risk: `tauri-specta = "2.0.0-rc.21"` is pre-release. May have breaking changes or be abandoned. Binding generation patch is symptom of instability.
- Impact: If pre-release becomes outdated or breaking, binding generation could fail completely.
- Migration plan:
  - Monitor tauri-specta releases; upgrade to stable 2.0.0 when available.
  - If abandoned, consider writing custom Rust-to-TypeScript code generator or using tRPC.

**Keyring Crate (Multiple Backend Implementations):**
- Risk: `keyring = "3"` supports apple-native, windows-native, and sync-secret-service, but all three backends enabled. Unused backends add attack surface.
- Impact: Larger binary; more dependencies; potential for cross-platform bugs.
- Migration plan:
  - Use conditional compilation to enable only target platform (e.g., `#[cfg(target_os = "macos")]`).
  - Test keyring functionality on each supported platform separately.

**Reqwest with Rustls (No OpenSSL):**
- Risk: Using rustls-backed reqwest avoids OpenSSL, but rustls is younger and less battle-tested. Potential for TLS edge case bugs.
- Impact: If rustls has vulnerability, may not be patched as quickly as OpenSSL.
- Migration plan:
  - Monitor rustls security advisories via RUSTSEC database.
  - Reqwest + rustls combo is currently stable and recommended; no immediate action needed.

## Missing Critical Features

**Incremental Scan:**
- Problem: Every scan fetches all repos and rechecks all diagnostics. No delta/incremental mode. User must always do full 300+ API calls even if only 1 repo changed.
- Blocks: Large-scale adoption where users want to scan 100+ repos regularly without burning API quota.
- Priority: High

**Settings/Preferences:**
- Problem: App has no way to customize which organizations to scan, diagnostic rules to enable/disable, or scan frequency. Hardcoded to `["Atypical-Consulting"]` in `Dashboard.tsx:51`.
- Blocks: Multi-org support; enterprise deployments; user personalization.
- Priority: High

**Offline Mode:**
- Problem: App requires internet connection even to view cached scan results. No mechanism to display previously-scanned data if offline.
- Blocks: Viewing reports on flights, in poor connectivity areas.
- Priority: Medium

**Diagnostic Rule Configuration:**
- Problem: Rules have fixed severity levels (Critical, Warning, Info). No way for users to override (e.g., "License is Info-level for my org").
- Blocks: Flexible health scoring; compliance with organizational policies.
- Priority: Medium

**Background Scans / Scheduled Scans:**
- Problem: Scans must be manually initiated via UI. No way to schedule automatic periodic scans.
- Blocks: Continuous monitoring; alerting on health regressions.
- Priority: Low (would require background task handling in Tauri)

## Test Coverage Gaps

**Untested Rule Implementations:**
- What's not tested: Individual diagnostic rules (HasReadme, HasLicense, etc.) have no unit tests. Only tested via full-scan integration.
- Files: `src-tauri/src/diagnostics/rules.rs`
- Risk: Edge cases in rule logic (e.g., README length thresholds, topic validation) could fail silently. Changing severity weights has no regression tests.
- Priority: High

**Database Operations Untested:**
- What's not tested: Schema initialization, migrations, CRUD operations on scan_sessions/backlog_items.
- Files: `src-tauri/src/storage/db.rs`, `src-tauri/src/storage/*.rs`
- Risk: Data corruption or missing columns on upgrade. Backlog items silently fail to persist.
- Priority: High

**Error Path Testing:**
- What's not tested: Network errors, rate limiting, malformed GitHub API responses, keychain access denied.
- Files: All API-touching code
- Risk: App crashes on edge cases instead of graceful error handling.
- Priority: High

**Frontend State Mutations:**
- What's not tested: Zustand store slices don't have unit tests. State mutations only tested via component integration tests.
- Files: `src/core/stores/domain/**/*.slice.ts`
- Risk: State desynchronization bugs in auth, diagnostics, or backlog state are difficult to detect and reproduce.
- Priority: Medium

**Component Snapshot/Rendering Tests:**
- What's not tested: Large components (Dashboard, RepoDetailsPage) not tested for rendering or user interactions.
- Files: `src/extensions/dashboard/Dashboard.tsx`, `src/extensions/repo-details/RepoDetailsPage.tsx`
- Risk: Breaking changes to UI go undetected until user testing.
- Priority: Medium

---

*Concerns audit: 2026-02-26*

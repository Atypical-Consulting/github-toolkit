# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**GitHub API:**
- REST API v2022-11-28 - Full repository and issue management
  - SDK/Client: reqwest HTTP client
  - Authentication: OAuth Device Flow (Browser-less auth)
  - Base URL: `https://api.github.com`
  - User-Agent: `GitHubAutomate-Desktop`
  - Endpoints used:
    - `POST /login/device/code` - Start device flow
    - `POST /login/oauth/access_token` - Poll for access token
    - `GET /user` - Fetch authenticated user info
    - `GET /user/repos` - List user repositories with pagination
    - `GET /orgs/{org}/repos` - List organization repositories
    - `GET /repos/{owner}/{repo}` - Get repository details
    - `GET /repos/{owner}/{repo}/contents/{path}` - Browse repository files
    - `GET /repos/{owner}/{repo}/{path}` - Fetch file contents
    - `POST /repos/{owner}/{repo}/issues` - Create GitHub issues
    - Rate limit endpoint headers: `x-ratelimit-remaining`, `x-ratelimit-limit`

## Authentication & Identity

**GitHub OAuth Device Flow:**
- Implementation: Browser-less OAuth flow for desktop apps
- Client ID: `Ov23liGPdt9oE8quH9XV` (embedded in `src-tauri/src/github/auth.rs`)
- Scopes: `repo` (full repository access), `read:org` (organization read)
- Token storage: OS keychain via `keyring` crate
- Keychain service name: `com.githubautomate.desktop.github`
- Keychain entry: `github-oauth-token`
- Token never leaves Rust backend - frontend only receives username/avatar/scopes metadata
- OAuth endpoints:
  - Device code request: `https://github.com/login/device/code`
  - Token polling: `https://github.com/login/oauth/access_token`

**Token Management:**
- Storage mechanism: `src-tauri/src/github/token.rs`
- Store function: `store_token()` - Saves token to keychain on successful auth
- Get function: `get_token()` - Retrieves token from keychain for all API requests
- Delete function: `delete_token()` - Clears token on sign out
- Async execution: Tokio blocking tasks to avoid freezing UI

## Data Storage

**Databases:**
- SQLite 3 (bundled via rusqlite)
  - Connection: OS app data directory / `github-automate.db`
  - Client library: `rusqlite` v0.33 with no external dependencies
  - Location: `src-tauri/src/storage/db.rs` - initialization and schema
  - State management: `DbState(Mutex<Connection>)` managed by Tauri in `lib.rs`
  - Tables:
    - `scan_sessions` - Audit trail of diagnostic scans (id, started_at, completed_at, total_repos, scanned_repos)
    - `repositories` - Cached repository metadata (full_name, owner, name, description, topics, is_archived, pushed_at, updated_at, default_branch, last_commit_sha, is_private, has_issues, open_issues_count, html_url, license_name)
    - `diagnostic_results` - Health scores per repository per scan (scan_session_id, repo_full_name, health_score, critical_count, warning_count, info_count, results_json, scanned_at, commit_sha)
    - `diagnostic_rule_results` - Individual rule results (repo_full_name, commit_sha, rule_id, rule_name, severity, passed, message, scanned_at)
    - `backlog_items` - Generated tasks from failed diagnostics (id, repo_full_name, source, source_ref, title, description, severity, status, priority_score, github_issue_url, created_at, updated_at)
  - Migrations: ALTER TABLE statements for backwards compatibility

**File Storage:**
- Local filesystem only - No cloud storage integration
- App data directory determined by Tauri: `app.path().app_data_dir()`
- Database persisted locally in `github-automate.db`

**Caching:**
- In-memory: Zustand v5 stores in React state
- Persistent cache: SQLite tables for repos and diagnostic results
- Cache invalidation: Manual via `scan_all_repositories`, `scan_repository_cached` commands

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or external error tracking service

**Logs:**
- Console output in development
- No structured logging framework detected
- Error information returned via GitHubError enum in Rust

**Rate Limiting:**
- GitHub API rate limit monitoring: `src-tauri/src/github/rate_limit.rs`
- Rate limit headers parsed: `x-ratelimit-remaining`, `x-ratelimit-limit`
- Command: `github_check_rate_limit()` - Check remaining API quota
- Rate limit exceeded (0 remaining) returns `GitHubError::RateLimitExceeded`

## CI/CD & Deployment

**Hosting:**
- Desktop application (no server component)
- Bundled via Tauri:
  - macOS: `.app` and `.dmg` formats
  - Windows: `.exe` and `.msi` formats
  - Linux: `.AppImage` and `.deb` formats

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other CI configuration in repo

**Build Process:**
- Frontend: Vite production build to `dist/` directory
- Rust: Cargo build to static/dynamic libraries
- Bundle: `tauri build` combines both into native app

## Environment Configuration

**Required Environment Variables:**
- GitHub OAuth Client ID: Hardcoded in `src-tauri/src/github/auth.rs` - `Ov23liGPdt9oE8quH9XV` (NO env var currently)
- Tauri environment variables: `TAURI_PLATFORM` (set during builds), `TAURI_DEBUG`
- Vite environment variables: Prefix `VITE_`, `TAURI_` (from `vite.config.ts`)

**Build-Time Environment:**
- `TAURI_PLATFORM` - Platform identifier (windows, linux, macos)
- `TAURI_DEBUG` - Debug mode flag (affects minification and source maps)
- Vite will inject these into build

**Secrets Location:**
- GitHub OAuth token: OS keychain (not in environment variables or config files)
- API keys: None detected - Only OAuth flow used
- No `.env` file detected or needed for runtime

## Webhooks & Callbacks

**Incoming Webhooks:**
- None detected - No webhook endpoints exposed

**Outgoing Events:**
- Tauri IPC events: `scan-progress` - Emitted during `scan_all_repositories` for progress updates
- Event listener: Frontend via `@tauri-apps/api/event` - `listen("scan-progress")`
- Event payload: Scan session ID, repositories completed count, total count

**Issue Creation Callbacks:**
- Command: `create_github_issue_from_backlog()` in `src-tauri/src/backlog/mod.rs`
- Creates GitHub issue, stores issue URL in backlog item
- Updates backlog item status to `in_progress`
- No webhook to track issue state changes (one-way integration)

## API Error Handling

**Custom Error Type:**
- `GitHubError` - Tagged enum with serialized discriminant
  - Serialization: `#[serde(tag = "type", content = "message")]`
  - Variants: `NotAuthenticated`, `OAuthFailed`, `AuthorizationPending`, `SlowDown`, `ExpiredToken`, `AccessDenied`, `NetworkError`, `RateLimitExceeded`, `NotFound`, `Forbidden`, `ValidationFailed`, `ApiError`, `KeychainError`, `Internal`
  - Becomes TypeScript discriminated union via tauri-specta
  - All commands return `Result<T, GitHubError>`

**Rate Limiting Strategy:**
- Polling interval respect: `interval` field from device code response (used in `github_poll_auth`)
- Slow-down detection: `SlowDown` error triggers exponential backoff (frontend responsibility)
- Rate limit exceeded: Detected via `x-ratelimit-remaining: 0` header, returns explicit error

---

*Integration audit: 2026-02-26*

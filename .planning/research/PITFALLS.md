# Pitfalls Research

**Domain:** Tauri desktop app — MCP server integration + realtime scan UI + GitHub workflow automation
**Researched:** 2026-02-26
**Confidence:** MEDIUM-HIGH (transport/MCP pitfalls HIGH from official sources; Tauri-specific MEDIUM from GitHub issues and community; GitHub automation HIGH from official docs)

---

## Critical Pitfalls

### Pitfall 1: stdout Logging Corrupts MCP stdio Protocol

**What goes wrong:**
Any `println!`, `eprintln!` to stdout, or `console.log` in the MCP server process silently corrupts the JSON-RPC message stream. The MCP client receives garbled data it cannot parse, producing cryptic errors like "unexpected token" or silent disconnects. This works fine during development when you eyeball the terminal output but fails in production where the client is consuming stdout programmatically.

**Why it happens:**
MCP stdio transport uses stdout as the message bus — every byte on stdout is treated as protocol data. Developers naturally reach for `println!` to debug, not realizing the output is intermixed with protocol frames. Rust's `eprintln!` goes to stderr (safe), but any logging framework configured to write to stdout will break the stream.

**How to avoid:**
- Configure all logging (tracing, log crate, env_logger) to write exclusively to stderr or a file sink before writing a single line of MCP server code.
- In Rust: use `tracing_subscriber` with `.with_writer(std::io::stderr)`.
- Add a CI check that the MCP server binary produces only valid JSON-RPC on stdout under a test client.
- Never use `dbg!()` macros in MCP server code paths — they write to stderr by default in Rust, which is safe, but verify.

**Warning signs:**
- MCP client (Claude Code, Cursor) shows "Parse error" or "Invalid JSON" immediately on connection.
- Server works when run manually in terminal but fails when invoked via client config.
- Debug log lines appear intermixed in MCP inspector output.

**Phase to address:**
MCP Server foundation phase — establish the logging discipline before any tool implementations are written.

---

### Pitfall 2: MCP Server Survives App Shutdown (Zombie Process)

**What goes wrong:**
When the Tauri app closes, the MCP HTTP/SSE server thread keeps listening on its port. The next app launch fails to bind the same port, either crashing silently or degrading to a non-functional server. Users see "port already in use" errors and must kill processes manually. On macOS, the zombie process may hold the GitHub token in memory from a previous session.

**Why it happens:**
Tauri's app lifecycle (`on_window_event`, `RunEvent::Exit`) is not automatically wired to background server threads. Spawning a tokio task for the HTTP listener without binding its lifetime to the app handle means it runs until the OS reclaims the process — but OS process reclamation is not guaranteed to be immediate, especially if the Tauri WebView process and the server thread are in different tokio tasks.

**How to avoid:**
- Use a `CancellationToken` (from `tokio_util::sync`) shared between the Tauri app lifecycle and the MCP server task.
- In `RunEvent::Exit` or `on_window_event(WindowEvent::Destroyed)`, call `cancellation_token.cancel()` and await the server task's graceful shutdown.
- Bind the server port with `SO_REUSEADDR` so a fast restart can reclaim the port.
- Log on server bind and on server shutdown with the port number, so users and logs make the lifecycle visible.

**Warning signs:**
- App relaunch shows "Address already in use" in logs.
- `lsof -i :PORT` after app close shows the port still held by a process with the app's name.
- MCP clients report stale connections from a previous session.

**Phase to address:**
MCP Server foundation phase — implement the cancellation token pattern before adding any tools.

---

### Pitfall 3: MCP Tool Descriptions Are the API Contract — Vagueness Causes Wrong Tool Invocation

**What goes wrong:**
LLMs select which MCP tool to call based entirely on the tool name and description. Vague or overlapping descriptions cause the model to pick the wrong tool, invoke scan when the user asked for a query, or call fix when the user asked for a status check. This silently creates GitHub issues, branches, and PRs that the user did not intend.

**Why it happens:**
Developers write tool descriptions for human readers, not for model selection. Phrases like "manages repository diagnostics" or "handles scan operations" don't give the model enough signal to differentiate between read-only and write operations. The model treats all similarly-described tools as interchangeable.

**How to avoid:**
- Write tool descriptions with explicit action verbs: "READ-ONLY: returns cached scan results" vs "WRITE: triggers a new diagnostic scan and updates the database."
- Prefix destructive tools with explicit warnings in their descriptions: "CREATES GitHub issue, branch, and PR — irreversible."
- Keep each tool to a single responsibility. Do not create a `manage_repo` tool that sometimes reads and sometimes writes.
- Test tool selection by running the MCP server in isolation (MCP Inspector) and asking the model to select a tool for each intended operation — verify the right one is selected.

**Warning signs:**
- Model calls `fix_repo` when user said "show me the scan results."
- Users report unexpected GitHub issues or PRs appearing after a simple query.
- Tool invocation logs show the wrong tool being called consistently for a specific phrase pattern.

**Phase to address:**
MCP tool definition phase — write and review all tool descriptions before connecting to any real GitHub API operations.

---

### Pitfall 4: Frontend State Not Updated Incrementally During Scan (The "Batch-at-End" Trap)

**What goes wrong:**
The Rust backend already emits per-repo `scan-progress` events. The current `scan.slice.ts` processes events but the UI only renders a meaningful update after all repos complete. Adding "realtime ring updates" means the Zustand state must be updated per-repo, not per-scan. If the Zustand slice update function is not carefully written, each `scan-progress` event triggers a full React re-render of the entire repo list, causing 100+ renders for a 100-repo scan and making the UI feel sluggish.

**Why it happens:**
`useStore` subscriptions in React re-render the component on any state change in the store slice they subscribe to. If the scan results are stored as a flat array and each event appends or updates one element, React will re-render the whole component tree on each append. Zustand's default equality check is reference equality — a new array reference always triggers a re-render.

**How to avoid:**
- Store scan results as a `Map<repoId, RepoHealthReport>` (or `Record<string, RepoHealthReport>`) not an array — object key updates are more surgical.
- Use Zustand's `subscribeWithSelector` to let components subscribe to only the repo they render: `useStore(state => state.results[repoId])`.
- Batch rapid events using a debounce (100ms) or a Rust-side batching strategy (emit every 5 repos). The existing `scan.slice.ts` concern about accumulating events is already documented in CONCERNS.md.
- Measure render counts with React DevTools Profiler before shipping — confirm per-event render cost is bounded.

**Warning signs:**
- CPU spikes to 100% in the renderer process during scan.
- Browser DevTools "Frames" tab shows sub-10fps frame rate during active scan.
- Scan with 20 repos feels noticeably slower to the UI than a 5-repo scan.

**Phase to address:**
Realtime scan UI phase — design the state shape before implementing the event listener.

---

### Pitfall 5: Tauri Event Listener Memory Leak on Re-Subscription

**What goes wrong:**
Calling `listen("scan-progress", callback)` returns an `unlisten` function that must be called to deregister the listener. If the React component or Zustand slice that calls `listen()` is mounted multiple times (e.g., Hot Module Replacement in dev, or navigation away and back), each mount registers a new listener without removing the previous one. Memory grows with each re-subscription. In production, this manifests as scan events being processed multiple times (duplicate state updates) and increasing memory usage over long sessions.

**Why it happens:**
Tauri's event system does not deduplicate listeners — every `listen()` call registers a new callback. React's strict mode in development intentionally double-mounts components to surface this exact bug, but developers often dismiss the double-update as a dev-only artifact.

**How to avoid:**
- In the Zustand slice, store the `unlisten` promise and call it in a cleanup step before re-registering. The slice's `startScan` action should always call `unlisten?.()` before a new `listen()`.
- In React components, use `useEffect` with the cleanup return: `return () => { unlistenRef.current?.() }`.
- Verify in development: if an event fires once on Rust side but is processed twice on the frontend, a double-registration exists.
- The known bug in `scan.slice.ts:42,68` (race condition between unlisten and last event) should be fixed alongside this — use a "scan complete" sentinel event before calling unlisten.

**Warning signs:**
- In dev with HMR, scan state updates appear twice for each repo.
- Memory in the renderer process grows across multiple scan sessions without returning to baseline.
- GitHub issue #12724 and #13133 on the Tauri repo confirm this is a real, documented pattern.

**Phase to address:**
Realtime scan UI phase — fix the existing `scan.slice.ts` listener lifecycle before adding more event consumers.

---

### Pitfall 6: GitHub API Sequential Operations Fail Silently Under Race Conditions

**What goes wrong:**
The MCP fix pipeline (create issue → create branch from issue → commit → create PR) performs sequential GitHub API calls. GitHub's backend is eventually consistent — the branch created in step 2 may not be immediately available when step 3 tries to push a commit to it. The API returns a 422 "Reference does not exist" or 404 error that looks like a permanent failure but is transient. Without retry logic, the pipeline fails partway through, leaving orphaned issues and branches with no PR.

**Why it happens:**
GitHub's API acknowledges write operations before background jobs complete. This is documented in GitHub community discussions and appears consistently in automation tools. Developers assume REST API success = immediate consistency, which is false for ref creation.

**How to avoid:**
- After each write operation, implement a retry-with-backoff check before proceeding to the next step: create branch → wait up to 3s for branch to appear via GET → then create commit.
- Make the pipeline idempotent: before creating an issue, check if one already exists for this diagnostic rule + repo combination. Before creating a branch, check if it already exists.
- Implement a transaction log in the SQLite database: record each step of the pipeline with its outcome. On retry, skip completed steps.
- On partial failure, emit a clear error to the MCP client describing which step failed and what exists so far (issue #X created, branch Y created, commit failed).

**Warning signs:**
- "Reference does not exist" errors on commit creation immediately after branch creation.
- Duplicate GitHub issues or branches on retry after failure.
- MCP tool returns success but no PR appears.

**Phase to address:**
GitHub automation pipeline phase — design idempotency and retry before wiring up the API calls.

---

### Pitfall 7: Branch Protection Rules Block Automated PR Creation

**What goes wrong:**
The MCP fix pipeline creates a branch and PR using the user's OAuth token. If the target repo has branch protection rules requiring PR reviews or status checks, the PR cannot be merged and may not even be creatable without the right token permissions. The `repo` scope in the OAuth flow is necessary but not sufficient for branches in protected repos. The pipeline silently creates a PR that is immediately blocked, giving the user no guidance on why.

**Why it happens:**
GitHub's branch protection is enforced at the API level per-token type. Personal Access Tokens with `repo` scope can create PRs but cannot bypass protection rules without the "bypass" permission granted explicitly. The Device Flow OAuth token used by this app is a user token — it cannot self-grant bypass access. This is frequently overlooked because protection rules are not returned during repo listing and require a separate API call to discover.

**How to avoid:**
- Before starting the fix pipeline for a repo, call `GET /repos/{owner}/{repo}/branches/{branch}/protection` to check if the target branch is protected.
- Surface protection status in the repo health report so users know before invoking MCP tools.
- In the MCP tool description, document explicitly: "Creates PR against default branch; branch protection rules still apply and the user must complete review/merge manually."
- Do not attempt to auto-merge PRs — leave merge to the human.

**Warning signs:**
- PRs created by the tool remain permanently unmerged with "review required" status.
- API returns 403 on PR merge attempts.
- Users report "I asked MCP to fix the repo but nothing happened" after the PR was blocked.

**Phase to address:**
GitHub automation pipeline phase — check protection status as the first step of the fix pipeline.

---

### Pitfall 8: MCP Server Exposes GitHub Token Indirectly via Tool Output

**What goes wrong:**
MCP tool responses are passed verbatim to the LLM context. If any tool returns raw GitHub API responses (which can include `clone_url`, `html_url`, authorization headers in error messages, or token-adjacent metadata), this data enters the LLM's context window and may be included in its output to the user or logged by the MCP client. Even more dangerous: if a tool returns an error from a failed authenticated request that includes the request headers, the token is exposed.

**Why it happens:**
Developers return `?` (Rust question mark operator) on GitHub API errors without sanitizing the error before forwarding to the MCP client. The `reqwest::Error` type can capture the full response including headers. In Rust, `format!("{:?}", err)` on a reqwest error includes request context.

**How to avoid:**
- Never return raw `reqwest::Error` or GitHub API error responses directly from MCP tools.
- Create a sanitized `McpError` type that strips all HTTP request/response metadata and exposes only a human-readable message.
- The GitHub token must remain in the Rust keychain layer — MCP tool code must never touch the raw token string.
- Audit every `impl From<reqwest::Error> for McpError` conversion to ensure no headers are included.

**Warning signs:**
- Error messages in MCP client output contain URLs with query parameters or `Authorization: Bearer` fragments.
- Tool error responses include HTTP status codes and raw JSON from GitHub API error bodies.

**Phase to address:**
MCP Server foundation phase — define the sanitized error type before any GitHub API integration.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-code MCP port (e.g., 3000) | Simple to configure in client configs | Port conflict on machines with other services; app unusable until port freed | Never — use dynamic port with persisted config |
| Share the same SQLite `Mutex<Connection>` for MCP requests | No new code required | MCP tool requests block scan operations and vice versa; deadlock risk under concurrent MCP calls | Never for MCP — create a read-only connection pool for MCP queries |
| Return full `RepoHealthReport` objects from MCP tools | No serialization mapping needed | Response bloat wastes LLM context tokens; 100-repo responses can exceed context window | Never — project to minimal fields the LLM needs |
| Register `unlisten` cleanup only in component unmount | Simpler React code | Memory leak across HMR cycles in dev; duplicate event processing | Only if component is guaranteed to unmount on scan end (it is not in this app) |
| Use `.ok()` to ignore DB errors in MCP write paths | Matches existing pattern in `db.rs` | Silent data loss when MCP tools persist results; no way to detect corruption | Never for new MCP code — existing `.ok()` usage is already flagged as tech debt |
| Bind MCP HTTP server on `0.0.0.0` | Works in Docker/remote scenarios | Any process on the local network can invoke MCP tools including GitHub fix pipeline | Never — bind to `127.0.0.1` only; document explicitly |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub API / branch creation | Assume branch is immediately available after 201 response | Retry GET on the branch ref with exponential backoff (max 3s) before proceeding to commit step |
| GitHub API / issue creation | Use issue number from response body to form branch name immediately | Wait for issue number to stabilize; use `POST /repos/{owner}/{repo}/issues/{issue_number}/labels` to verify the issue is fully indexed |
| MCP stdio transport | Use `println!` or any stdout write for debugging | All logging to `stderr` or file; validate with MCP Inspector before client integration |
| MCP Streamable HTTP | Allow all CORS origins for local dev convenience | Validate `Origin` header against `127.0.0.1` allowlist; deny all cross-origin requests |
| GitHub OAuth token | Pass token through MCP tool parameters for "convenience" | Token lives in Rust keychain only; MCP tools call internal Tauri commands which access the keychain — token never serialized into MCP messages |
| GitHub API / rate limits | Check rate limit once at app startup | Check remaining limit before scan start AND before fix pipeline; surface remaining count in MCP query tools |
| Tauri event system | Listen to `scan-progress` without cleanup | Return and store `unlisten` function; call it in scan completion handler and component unmount |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-repo Zustand state update triggers full list re-render | UI frame rate drops during scan; CPU pegged in renderer | Store results as `Record<repoId, Report>`; use `subscribeWithSelector` per row | ~20+ repos in scan |
| Unbatched `scan-progress` events (one per repo) | 100 React renders for 100 repos; jank visible | Batch events every 5 repos on Rust side OR debounce on frontend (100ms) | ~50+ repos |
| MCP query tool returns all scan results in one response | LLM context window exceeded; tool call fails or truncates | Paginate: accept `limit` and `offset` params; default to 20 repos per page | ~30+ repos with full diagnostic detail |
| Blocking SQLite writes during scan with shared `Mutex<Connection>` | MCP tool calls stall waiting for scan to release mutex | Separate read-only connection for MCP query tools; write connection for scan | Any concurrent MCP call during active scan |
| Full re-scan on every MCP `scan` tool invocation | Rate limit exhaustion; slow response times | Respect SHA-based incremental scan cache for MCP-triggered scans; only scan repos with changed `pushed_at` | >20 repos with frequent MCP invocations |
| Accumulating Tauri channel callbacks without cleanup | Memory grows per scan session; eventual crash | Explicit `unlisten` on scan complete and on component unmount | After ~10 scan sessions without app restart |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| MCP HTTP server binds to `0.0.0.0` | Any process on the local network can invoke the fix pipeline and create GitHub issues/branches/PRs under the user's account | Bind exclusively to `127.0.0.1`; add Origin header validation |
| MCP tool error responses include raw reqwest errors | GitHub token or API internals leak into LLM context | Define sanitized `McpError` type; strip all HTTP metadata before serializing tool errors |
| No session token on MCP HTTP endpoint | Any local process (malicious app, browser JS) can call the MCP API | Generate a random session token at app startup; require it as a Bearer header on all MCP requests; store in Tauri app state only |
| OAuth Client ID from another app (FlowForge) | If FlowForge revokes or rotates the app, all GitHubAutomate users lose auth silently | Register dedicated GitHub OAuth App; update Client ID before any distribution |
| Fix pipeline commits under user identity without confirmation | Unexpected commits appear in the user's contribution history; branch/PR created without intent | Require explicit MCP tool parameter `confirmed: true` for all write operations; describe exact changes in tool response before executing |
| MCP tool descriptions accept repo name/owner as freeform string | Prompt injection: attacker crafts issue content that causes the LLM to pass malicious repo names to the tool | Validate `owner` and `repo` inputs against `^[a-zA-Z0-9_.-]+$` pattern in Rust before any API call |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Health rings show 0% until scan completes (existing behavior) | Users stare at empty UI for minutes during large scans; abandon the app | Update each ring immediately when its `scan-progress` event arrives; use a "scanning..." skeleton state for in-progress repos |
| MCP server enabled silently at startup | Users don't know a local HTTP server is running; may conflict with other services | Default OFF; require explicit enable in settings; show port number and status in a persistent settings indicator |
| Fix pipeline creates PR with no description | Reviewers see a bare PR with conventional commit title only; context about what was fixed and why is absent | Auto-generate PR body from the diagnostic rule description and the failing check details |
| Scan cancelled but cancellation flag not reset (existing bug) | Second scan invocation immediately exits; user thinks app is broken | Reset cancellation flag in all exit paths (success, error, cancellation); surface a "ready to scan" indicator in UI |
| MCP tool returns technical field names in response | LLM may relay raw field names like `hasReadme: false` to user verbatim | Map to human-readable strings in MCP response serialization: `"Missing README"` not `hasReadme: false` |
| No feedback on MCP server toggle | User clicks toggle in settings; nothing visible changes | Show "MCP Server running on port XXXX" immediately after enable; show connection count if any clients are connected |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **MCP server toggle:** Often missing actual server lifecycle management — verify that toggling OFF kills the HTTP listener and frees the port, not just sets a flag in the UI.
- [ ] **Realtime ring updates:** Often missing the `subscribeWithSelector` optimization — verify that a single repo's update does not re-render the entire repo list (use React DevTools Profiler).
- [ ] **Fix pipeline:** Often missing idempotency checks — verify that running the same fix tool twice does not create two issues, two branches, or two PRs.
- [ ] **MCP authentication:** Often missing Origin validation — verify that `curl http://127.0.0.1:PORT/mcp/tool` from a browser page on a different origin is rejected.
- [ ] **Scan cancellation flag reset:** Known existing bug — verify the flag resets after error paths, not just the happy path.
- [ ] **Event listener cleanup:** Often missing — verify that navigating away from the scan view and back does not double-register `scan-progress` listeners.
- [ ] **GitHub token never in MCP response:** Often violated in error paths — audit all `Err(e)` returns from MCP tool handlers for reqwest error passthrough.
- [ ] **DB migration safety:** Known existing tech debt — verify new tables added for MCP scan sessions use version table, not `.ok()` swallowing.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| stdout logging corruption in MCP server | LOW | Identify logging call, redirect to stderr, rebuild binary. Client reconnects automatically. |
| Zombie MCP server process after crash | LOW | Kill process by port (`lsof -ti :PORT \| xargs kill`); relaunch app. Add to troubleshooting doc. |
| Orphaned GitHub issue/branch from failed fix pipeline | MEDIUM | Add MCP query tool to list orphaned pipeline artifacts; implement cleanup tool that closes issue and deletes branch. |
| Memory leak from double-registered event listeners | MEDIUM | App restart clears all listeners. Proper fix requires finding and calling unlisten in the right lifecycle hook. |
| Partial DB migration (`.ok()` swallowed error) | HIGH | Requires manual SQLite inspection to identify missing columns; write a migration repair script; user data may need export/import. |
| Branch protection blocks automated PR | LOW | PR already exists; user completes review manually. Add pre-flight check to avoid repeating. |
| Rate limit exhaustion during MCP-triggered scan | MEDIUM | Wait for rate limit reset (up to 1 hour); implement pre-flight rate limit check with estimate. |
| OAuth Client ID revoked (FlowForge dependency) | HIGH | All users must reauthenticate after app update with new Client ID; requires app store update cycle. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| stdout logging corrupts MCP stdio | MCP Server foundation | MCP Inspector shows only valid JSON-RPC on stdout |
| Zombie MCP server process | MCP Server foundation | App close + relaunch on same port succeeds without "address in use" error |
| Vague tool descriptions cause wrong invocation | MCP tool definition | Each tool invoked correctly when model is given a natural language description of the desired action |
| Batch-at-end UI (no incremental ring updates) | Realtime scan UI | React Profiler shows bounded renders; health rings update visibly during scan |
| Event listener memory leak | Realtime scan UI | Navigate away/back 5 times then scan; verify single event processing per repo |
| GitHub API sequential operation race | GitHub automation pipeline | Run fix tool on fresh repo; verify no "reference does not exist" errors |
| Branch protection blocks PR | GitHub automation pipeline | Fix tool run against protected-branch repo surfaces protection status before creating issue |
| Token exposure via MCP error response | MCP Server foundation | Intentionally trigger a reqwest error; confirm MCP error response contains no token or HTTP headers |
| Full re-render on per-repo scan update | Realtime scan UI | Profiler shows O(1) renders per event not O(n) |
| Orphaned pipeline artifacts on failure | GitHub automation pipeline | Simulate mid-pipeline failure; verify no dangling issues/branches without corresponding PR |
| Hardcoded OAuth Client ID | Pre-distribution / settings phase | Build uses env var or Tauri config for Client ID; FlowForge Client ID not present in release binary |
| SQLite contention between scan and MCP queries | MCP Server foundation | Run full scan while issuing MCP query tool calls; verify neither blocks |

---

## Sources

- [Implementing MCP: Tips, Tricks and Pitfalls — Nearform](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) (HIGH confidence — practitioner experience)
- [MCP Transport Protocols: stdio vs SSE vs StreamableHTTP — MCPcat](https://mcpcat.io/guides/comparing-stdio-sse-streamablehttp/) (HIGH confidence — protocol comparison with failure modes)
- [MCP Server Transports — Roo Code Documentation](https://docs.roocode.com/features/mcp/server-transports) (MEDIUM confidence — tool vendor documentation)
- [MCP Security Risks and Controls — Red Hat](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls) (HIGH confidence — security-focused analysis)
- [Tauri Memory Leak from Continuous Event Emission — GitHub Issue #12724](https://github.com/tauri-apps/tauri/issues/12724) (HIGH confidence — confirmed Tauri bug tracker)
- [Tauri Channel-Based Memory Leak — GitHub Issue #13133](https://github.com/tauri-apps/tauri/issues/13133) (HIGH confidence — confirmed Tauri bug tracker)
- [Tauri unlisten bug — GitHub Issue #8916](https://github.com/tauri-apps/tauri/issues/8916) (HIGH confidence — confirmed Tauri bug tracker)
- [Long-running backend async tasks in Tauri v2 — Sneaky Crow](https://sneakycrow.dev/blog/2024-05-12-running-async-tasks-in-tauri-v2) (MEDIUM confidence — community blog)
- [GitHub Race Condition when API creates then modifies repo — community Discussion #26333](https://github.com/orgs/community/discussions/26333) (HIGH confidence — official GitHub community)
- [GitHub Branch Protection Bypass — GitHub Changelog](https://github.blog/changelog/2022-08-18-bypass-branch-protections-with-a-new-permission/) (HIGH confidence — official GitHub changelog)
- [Tauri MCP Security — Capabilities documentation](https://v2.tauri.app/security/capabilities/) (HIGH confidence — official Tauri docs)
- Codebase analysis: `/Users/phmatray/Repositories/github-phm/GitHubAutomate/.planning/codebase/CONCERNS.md` (HIGH confidence — direct code inspection)

---

*Pitfalls research for: Tauri 2 desktop app — MCP server + realtime diagnostics + GitHub automation*
*Researched: 2026-02-26*

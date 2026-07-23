# Phase 2: MCP Foundation - Research

**Researched:** 2026-02-26
**Domain:** Rust MCP binary (rmcp), Cargo multi-binary layout, SQLite WAL, stderr-only logging, error sanitization
**Confidence:** HIGH (primary stack verified via official SDK docs/crates + direct codebase inspection)

---

## Summary

Phase 2 creates a standalone `github-automate-mcp` binary that speaks the Model Context Protocol over stdio. The official Rust MCP SDK (`rmcp`, crate version **0.16.0**, published 2026-02-17) is maintained by Anthropic under the `modelcontextprotocol` GitHub org and is the unambiguous choice for this project. It ships a `ServerHandler` trait + `#[tool_router]` / `#[tool]` macro system that auto-generates JSON Schema for tool inputs and correctly marshals `CallToolResult` (including the `is_error` flag). The crate already depends on `tracing` and `tokio`, aligning perfectly with the existing `src-tauri` dependency set.

The cleanest binary layout for a Tauri project is a second `[[bin]]` section inside the existing `src-tauri/Cargo.toml`, with `default-run = "github-automate"` keeping `tauri dev` pointing at the Tauri entry point. The new MCP binary gets its own `src-tauri/src/bin/mcp.rs`. Business logic is already partially extracted into a library crate (`github_automate_lib`, declared via `[lib]` in the same Cargo.toml), so the MCP binary simply links the same lib — no workspace restructure needed.

SQLite WAL mode is a one-line pragma (`PRAGMA journal_mode=WAL`) added to `init_db`, making it persistent across all future connections. The tracing setup for the MCP binary must route all output exclusively to stderr via `.with_writer(std::io::stderr)` and `.with_ansi(false)` — any `println!` or stdout output corrupts the JSON-RPC stream.

**Primary recommendation:** Add `rmcp = { version = "0.16", features = ["server", "transport-io", "macros"] }` to `src-tauri/Cargo.toml`, create `src/bin/mcp.rs`, enable WAL in `storage/db.rs`, and implement a `ServerHandler` stub that returns stub tools via `tools/list`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | MCP server runs as a separate Rust binary using stdio transport | `[[bin]]` in same Cargo.toml + `rmcp` `stdio()` transport; `default-run` keeps Tauri working |
| MCP-02 | SQLite database uses WAL mode for concurrent access | One `PRAGMA journal_mode=WAL` call in `init_db` — persistent once set |
| MCP-03 | MCP server declares `tools` capability and returns all tools via `tools/list` | `ServerCapabilities::builder().enable_tools().build()` + `#[tool_router]` macro |
| MCP-04 | Every tool has a well-formed JSON Schema `inputSchema` and human-readable description | `schemars` feature on `rmcp`, `#[derive(JsonSchema)]` on param structs, `#[tool(description = "...")]` |
| MCP-05 | Tool execution errors return structured responses with `isError: true` | `CallToolResult` has `is_error: Option<bool>` field; framework sets it when tool fn returns `Err(...)` |
| MCP-06 | MCP binary uses stderr-only logging (stdout reserved for JSON-RPC) | `tracing_subscriber::fmt().with_writer(std::io::stderr).with_ansi(false).init()` before `serve(stdio())` |
| MCP-07 | Shared business logic extracted to library crate used by both binaries | Library already declared (`[lib] name = "github_automate_lib"`) — MCP binary just uses it |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `rmcp` | 0.16.0 | Official Rust MCP SDK; stdio server, tool routing, JSON-RPC | Maintained by Anthropic/modelcontextprotocol org; most complete implementation |
| `tokio` | 1.x (full) | Async runtime | Already in project; rmcp requires it |
| `schemars` | 1.0 | JSON Schema generation from Rust types for tool `inputSchema` | Required rmcp feature; auto-derives schema from `#[derive(JsonSchema)]` |
| `tracing` | 0.1 | Structured logging | Already used implicitly via tokio; rmcp depends on it |
| `tracing-subscriber` | 0.3 | Logging initialization and output routing to stderr | Standard companion to `tracing`; not yet in project Cargo.toml |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `anyhow` | 1.0 | Ergonomic error propagation in binary entry point | Cleaner `main() -> anyhow::Result<()>` than Box<dyn Error>; optional but recommended |
| `rusqlite` | 0.33 (bundled) | SQLite with WAL pragma | Already present; WAL is a pragma change only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `rmcp` (official) | `rust-mcp-sdk`, `mcp-sdk-rs`, `mcp-protocol-server` | These are unofficial forks/reimplementations; rmcp is the Anthropic-endorsed crate |
| Same Cargo.toml `[[bin]]` | Cargo workspace with separate crate | Workspace needs tauri-cli reconfiguration and risks `tauri dev` breakage; single-package `[[bin]]` is simpler and confirmed safe |
| `tracing-subscriber` stderr | `env_logger` | `tracing-subscriber` integrates with `tracing` (already a dep) and offers precise writer control |

**Installation (additions to `src-tauri/Cargo.toml`):**
```toml
rmcp = { version = "0.16", features = ["server", "transport-io", "macros"] }
schemars = "1.0"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
anyhow = "1.0"
```

---

## Architecture Patterns

### Recommended Project Structure

```
src-tauri/
├── Cargo.toml              # Add [[bin]] + default-run, add rmcp/schemars/tracing-subscriber
├── src/
│   ├── main.rs             # Tauri entry point (unchanged)
│   ├── lib.rs              # Shared lib — github, diagnostics, storage, backlog modules
│   ├── bin/
│   │   └── mcp.rs          # NEW: MCP binary entry point
│   ├── mcp/                # NEW: MCP server module
│   │   ├── mod.rs
│   │   ├── server.rs       # ServerHandler impl + get_info()
│   │   ├── tools.rs        # Stub tool definitions with #[tool] macros
│   │   └── error.rs        # McpError wrapper with sanitize() helper
│   ├── github/
│   ├── diagnostics/
│   ├── storage/
│   └── backlog/
```

### Pattern 1: Cargo Multi-Binary with `default-run`

**What:** Add a second `[[bin]]` entry to the existing `src-tauri/Cargo.toml`. Set `default-run` to the Tauri binary name so `cargo tauri dev` still works without `--bin`.

**When to use:** Any time you need a second standalone binary from the same Rust package without restructuring to a workspace.

**Example (`src-tauri/Cargo.toml` additions):**
```toml
[package]
name = "github-automate"
version = "0.1.0"
edition = "2024"
default-run = "github-automate"   # keeps `tauri dev` working

# Existing implicit [[bin]] from src/main.rs
# Tauri CLI uses src/main.rs automatically

[[bin]]
name = "github-automate-mcp"
path = "src/bin/mcp.rs"
```

### Pattern 2: MCP Binary Entry Point

**What:** `src/bin/mcp.rs` initializes tracing to stderr, opens the SQLite DB (WAL mode), constructs the `ServerHandler`, and calls `serve(stdio()).await`.

**When to use:** Every MCP stdio binary.

**Example (`src/bin/mcp.rs`):**
```rust
// Source: https://mcpcat.io/guides/building-mcp-server-rust/ + official rmcp README
use anyhow::Result;
use rmcp::{transport::stdio, ServiceExt};
use tracing_subscriber;

// Import from the shared library (github_automate_lib = the [lib] in this package)
use github_automate_lib::mcp::server::GitHubAutomateMcpServer;

#[tokio::main]
async fn main() -> Result<()> {
    // CRITICAL: must be before serve(stdio()) — after that stdout belongs to JSON-RPC
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    tracing::info!("github-automate-mcp starting");

    let server = GitHubAutomateMcpServer::new()?;
    let service = server.serve(stdio()).await?;
    service.waiting().await?;

    Ok(())
}
```

### Pattern 3: `ServerHandler` Stub with `#[tool_router]`

**What:** The `#[tool_router]` attribute on an impl block and `#[tool_handler]` on the `impl ServerHandler` block wire up `tools/list` and `tools/call` dispatch automatically.

**Example (`src/mcp/server.rs`):**
```rust
// Source: https://hackmd.io/_9mQgPVOS8q72PoTnftaFg + official rmcp README
use rmcp::{
    ServerHandler,
    model::{ServerCapabilities, ServerInfo, Implementation, ProtocolVersion},
    tool, tool_router, tool_handler,
};
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct GitHubAutomateMcpServer;

impl GitHubAutomateMcpServer {
    pub fn new() -> anyhow::Result<Self> {
        Ok(Self)
    }
}

// Stub tool — Phase 3 will replace with real implementations
#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetHealthScoresParams {
    #[schemars(description = "Optional repo full_name filter (e.g. 'owner/repo')")]
    pub repo: Option<String>,
}

#[tool_router]
impl GitHubAutomateMcpServer {
    #[tool(description = "READ-ONLY: Returns health scores for all or a specific repository")]
    async fn get_health_scores(
        &self,
        #[tool(aggr)] params: GetHealthScoresParams,
    ) -> Result<String, rmcp::Error> {
        // Stub — returns placeholder until Phase 3
        Ok(format!("get_health_scores stub: repo={:?}", params.repo))
    }
}

#[tool_handler]
impl ServerHandler for GitHubAutomateMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::V_2024_11_05,
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .build(),
            server_info: Implementation {
                name: "github-automate-mcp".into(),
                version: env!("CARGO_PKG_VERSION").into(),
            },
            instructions: Some(
                "GitHub repository health diagnostics and backlog management via MCP.".into()
            ),
        }
    }
}
```

### Pattern 4: WAL Mode Enablement

**What:** Single `PRAGMA journal_mode=WAL` call in `init_db`. Once set, WAL is persistent across all future connections to the same file.

**When to use:** Whenever two processes need concurrent SQLite access (WAL allows one writer + many readers simultaneously; default journal mode serializes all access).

**Example (addition to `src/storage/db.rs`):**
```rust
// Source: https://cj.rs/blog/sqlite-pragma-cheatsheet-for-performance-and-consistency/
pub fn init_db(app_data_dir: &Path) -> Result<Connection, rusqlite::Error> {
    std::fs::create_dir_all(app_data_dir).ok();
    let db_path = app_data_dir.join("github-automate.db");
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for concurrent Tauri + MCP binary access
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    // Recommended companion pragma (safe default for WAL)
    conn.execute_batch("PRAGMA synchronous=NORMAL;")?;

    // ... rest of CREATE TABLE statements (unchanged)
    Ok(conn)
}
```

The MCP binary must open the DB using the same path. The path for the MCP binary comes from the standard OS app data directory — on macOS this is `~/Library/Application Support/com.githubautomate.desktop/github-automate.db`. The MCP binary must either hardcode this path or resolve it via `dirs` crate.

### Pattern 5: Error Sanitization

**What:** A thin `McpToolError` type that wraps `GitHubError` or any internal error, strips bearer tokens and HTTP headers from messages before setting `is_error: true`.

**When to use:** All MCP tool handlers — never let raw error strings (which may contain `Authorization: Bearer ghp_...`) reach the MCP client.

**Example (`src/mcp/error.rs`):**
```rust
use rmcp::model::{CallToolResult, Content};

/// Sanitize an error message by removing known secret patterns.
pub fn sanitize_error_message(raw: &str) -> String {
    // Strip bearer tokens (ghp_, gho_, github_pat_)
    let re_token = regex::Regex::new(r"(?i)(bearer\s+|ghp_|gho_|github_pat_)\S+").unwrap();
    let scrubbed = re_token.replace_all(raw, "[REDACTED]");
    // Strip Authorization headers
    let re_header = regex::Regex::new(r"(?i)authorization:\s*\S+").unwrap();
    re_header.replace_all(&scrubbed, "authorization: [REDACTED]").to_string()
}

pub fn error_result(msg: impl std::fmt::Display) -> CallToolResult {
    let safe = sanitize_error_message(&msg.to_string());
    CallToolResult {
        content: vec![Content::text(safe)],
        is_error: Some(true),
        ..Default::default()
    }
}
```

> **Note:** Using `regex` adds a dependency. An alternative is simple string scanning with `.contains()` and redaction via positional string replacement — sufficient for Phase 2 given the limited error surfaces. The `regex` approach is more robust for Phase 5+ when write tools run API calls.

### Anti-Patterns to Avoid

- **`println!` in MCP binary:** Any write to stdout corrupts the JSON-RPC stream. Use `tracing::info!` (goes to stderr via the subscriber config) or `eprintln!` as a last resort. The OWASP MCP Top 10 (2025) lists token mismanagement as #1 — `println!("{}", token)` would be catastrophic.
- **Initializing tracing after `serve(stdio())`:** The tracing subscriber must be set up before stdio transport starts, as the transport immediately takes ownership of stdout.
- **Opening SQLite without WAL on the MCP side:** The MCP binary opening the DB in default journal mode would immediately lock out the Tauri app writer. WAL pragma must be in `init_db`, not optional.
- **Restructuring to a Cargo workspace for Phase 2 alone:** Tauri CLI has documented issues with workspace layouts and `default-run`. The `[[bin]]` approach inside the existing package is simpler and avoids CLI breakage.
- **Exposing raw `GitHubError` messages in `CallToolResult`:** `GitHubError::NetworkError` contains the raw `reqwest` error which may include URL query strings with credentials. Always pass through `sanitize_error_message()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-RPC framing, capabilities handshake, protocol versioning | Custom stdio loop with `serde_json::from_reader` | `rmcp` + `stdio()` transport | Protocol has many edge cases (batching, cancellation, progress tokens) |
| JSON Schema for tool `inputSchema` | Manual `serde_json::json!({...})` schema objects | `schemars` + `#[derive(JsonSchema)]` | Schema must match spec exactly; schemars is battle-tested and rmcp integrates it natively |
| Tool dispatch router | Manual `match tool_name { "x" => ..., "y" => ... }` | `#[tool_router]` + `#[tool_handler]` macros | Macros generate correct `ListToolsResult` population and dispatch automatically |
| WAL mode detection | Checking if WAL pragma succeeded | Just call `PRAGMA journal_mode=WAL` unconditionally | WAL is idempotent; second call is a no-op if already set |

**Key insight:** The MCP protocol handshake alone (initialize → initialized → tools/list → tools/call lifecycle) has enough correctness requirements that hand-rolling it would consume most of Phase 2's budget without any business value.

---

## Common Pitfalls

### Pitfall 1: Stdout Contamination

**What goes wrong:** A `println!`, `print!`, `dbg!`, or any write to stdout in the MCP binary causes the MCP client to receive malformed JSON-RPC and immediately disconnect or error.

**Why it happens:** `stdio()` transport uses stdout exclusively for JSON-RPC framing. Any non-JSON-RPC bytes corrupt the stream. This is a confirmed real-world issue (see `ruvnet/claude-flow` issue #835).

**How to avoid:** Set up `tracing_subscriber` with `with_writer(std::io::stderr)` as the very first statement in `main()`. Add a `clippy` lint or CI check that bans `println!` in the `src/bin/mcp.rs` and `src/mcp/` modules.

**Warning signs:** MCP Inspector shows "invalid JSON" or "unexpected end of input" errors immediately on connect.

### Pitfall 2: `tauri dev` Breaking After Adding `[[bin]]`

**What goes wrong:** Tauri CLI fails to find the main binary or picks up the wrong one after a second `[[bin]]` is added.

**Why it happens:** `cargo tauri dev` expects a single default binary. Without `default-run`, Cargo may resolve the wrong one.

**How to avoid:** Add `default-run = "github-automate"` to `[package]` in `Cargo.toml` immediately alongside the new `[[bin]]`. Verify with `cargo tauri dev` before considering the task complete.

**Warning signs:** `tauri dev` fails with "failed to get main binary" or produces a window from the wrong binary.

### Pitfall 3: MCP Binary Cannot Find the SQLite DB Path

**What goes wrong:** The MCP binary opens a different SQLite file than the Tauri app (or fails to open any), causing empty results in Phase 3 queries.

**Why it happens:** Tauri resolves the app data directory via `app.path().app_data_dir()` which uses the Tauri-configured bundle identifier. The MCP binary (a standalone process) has no Tauri runtime to ask.

**How to avoid:** The MCP binary must resolve the same OS path independently. On macOS: `~/Library/Application Support/com.githubautomate.desktop/github-automate.db`. Use the `dirs` crate (`dirs::data_dir()`) and append `com.githubautomate.desktop/github-automate.db`. Define this path logic once in the shared library (`github_automate_lib`) so both binaries use the same function.

**Warning signs:** Phase 3 tools return empty results even though the Tauri app has scan data.

### Pitfall 4: WAL Pragma Ignored Due to Error Swallowing

**What goes wrong:** The WAL pragma call fails silently (e.g., on a read-only filesystem in CI) and concurrent access causes `SQLITE_BUSY` errors.

**Why it happens:** The existing `db.rs` uses `.ok()` on many operations to swallow migration errors. If WAL setup is treated the same way, it silently fails.

**How to avoid:** Use `?` (not `.ok()`) on the WAL pragma call specifically. WAL not being set is a hard failure for this phase.

**Warning signs:** Integration test shows `database is locked` errors when both binaries are opened simultaneously.

### Pitfall 5: `is_error` Not Set — LLM Cannot Self-Correct

**What goes wrong:** Tool failures are returned as successful `CallToolResult` with error text in the content but `is_error: None`. The LLM sees "success" and doesn't know it failed.

**Why it happens:** The MCP spec says: "errors that originate from the tool SHOULD be reported inside the result object with `isError` set to `true`, NOT as a protocol-level error." It's easy to return `Ok(CallToolResult { content: vec![Content::text(err.to_string())], ..Default::default() })` thinking it's correct.

**How to avoid:** Use the `error_result()` helper (see Pattern 5 above) consistently. Never put error text in a success result.

**Warning signs:** MCP Inspector shows green "success" for a call that should have failed.

---

## Code Examples

Verified patterns from official sources:

### Minimal Stdio MCP Server

```rust
// Source: https://mcpcat.io/guides/building-mcp-server-rust/ + rmcp README
use rmcp::{transport::stdio, ServiceExt};
use tracing_subscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .init();

    let service = MyServer::new();
    let handle = service.serve(stdio()).await?;
    handle.waiting().await?;
    Ok(())
}
```

### Tool with Input Schema

```rust
// Source: https://hackmd.io/_9mQgPVOS8q72PoTnftaFg
use rmcp::{tool, tool_router};
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SumParams {
    #[schemars(description = "First operand")]
    pub a: i32,
    #[schemars(description = "Second operand")]
    pub b: i32,
}

#[tool_router]
impl MyServer {
    #[tool(description = "Add two integers")]
    fn sum(&self, #[tool(aggr)] p: SumParams) -> Result<String, rmcp::Error> {
        Ok((p.a + p.b).to_string())
    }
}
```

### WAL Mode Enablement

```rust
// Source: https://cj.rs/blog/sqlite-pragma-cheatsheet-for-performance-and-consistency/
pub fn init_db(path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    // ... schema setup
    Ok(conn)
}
```

### Error Result Helper

```rust
// Source: MCP spec + pattern from https://apxml.com/courses/getting-started-model-context-protocol/chapter-3-implementing-tools-and-logic/error-handling-reporting
use rmcp::model::{CallToolResult, Content};

pub fn mcp_error(msg: impl std::fmt::Display) -> CallToolResult {
    CallToolResult {
        content: vec![Content::text(sanitize(msg.to_string()))],
        is_error: Some(true),
        ..Default::default()
    }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `rmcp` via git dependency (pre-release) | `rmcp = "0.16"` on crates.io | 2026-02-17 (v0.16.0) | Use semver, no git dependency needed |
| Manual `ListToolsResult` construction | `#[tool_router]` + `#[tool_handler]` macros | rmcp 0.1+ | Eliminates 50+ lines of boilerplate per tool set |
| HTTP-only MCP (early Claude Desktop) | stdio transport as primary | MCP spec 2024-11-05 | All desktop AI clients expect stdio for local servers |
| `schemars 0.8` | `schemars 1.0` | 2024-2025 | API-compatible upgrade; rmcp 0.16 depends on `schemars 1.0` — use that version |

**Deprecated/outdated:**
- `rmcp 0.3` (used in some blog posts): API changed significantly — macros renamed, `tool_box` → `tool_router`. Use 0.16.
- `schemars 0.8` in older tutorials: rmcp 0.16 requires `schemars 1.0` via its own dep tree.

---

## Open Questions

1. **DB path resolution for MCP binary on macOS/Windows**
   - What we know: Tauri uses bundle ID `com.githubautomate.desktop` → macOS path `~/Library/Application Support/com.githubautomate.desktop/`
   - What's unclear: Does this match `dirs::data_dir()` output exactly? Need to verify `dirs` crate behavior on macOS.
   - Recommendation: In Plan 03 (WAL + concurrent access), write a small test that opens the same file path from both a Tauri context mock and a `dirs`-based resolver to confirm they agree before Phase 3.

2. **`schemars` version compatibility**
   - What we know: rmcp 0.16 Cargo.toml lists `schemars 1.0` as optional dep. Shuttle blog shows `schemars = "1.0"`.
   - What's unclear: Whether adding `schemars = "1.0"` directly to `src-tauri/Cargo.toml` could conflict with any transitive `schemars 0.8` dep.
   - Recommendation: Run `cargo tree | grep schemars` after adding deps to detect conflicts. If 0.8 and 1.0 coexist, the `#[derive(JsonSchema)]` trait won't unify — resolve by pinning to 1.0 everywhere.

3. **`rmcp` macro API stability at 0.16**
   - What we know: `#[tool_router]` / `#[tool_handler]` are documented; v0.16 published Feb 2026.
   - What's unclear: The hackmd guide shows `tool_box!` (old API). Current docs show `#[tool_router]`. Confirm macro names at compile time.
   - Recommendation: Use the official rust-sdk `examples/servers/counter_stdio.rs` as canonical reference during Plan 02 implementation.

---

## Sources

### Primary (HIGH confidence)
- `https://github.com/modelcontextprotocol/rust-sdk` — Official SDK repo, README, examples list
- `https://docs.rs/crate/rmcp/latest` — Version 0.16.0 confirmed (published 2026-02-17), dependency list, features
- `https://github.com/modelcontextprotocol/rust-sdk/blob/main/crates/rmcp/Cargo.toml` — Feature flags, optional deps
- `src-tauri/Cargo.toml` (this repo) — Existing deps, `[lib]` declaration, package name
- `src-tauri/src/storage/db.rs` (this repo) — Current `init_db` implementation needing WAL addition
- `src-tauri/src/github/error.rs` (this repo) — `GitHubError` variants that need sanitization in MCP errors

### Secondary (MEDIUM confidence)
- `https://mcpcat.io/guides/building-mcp-server-rust/` — Full server example with tracing stderr config; verified against official SDK pattern
- `https://hackmd.io/_9mQgPVOS8q72PoTnftaFg` — Code guide with `#[tool_router]` examples; note: uses older macro name `tool_box` in places, verify against 0.16 API
- `https://cj.rs/blog/sqlite-pragma-cheatsheet-for-performance-and-consistency/` — WAL pragma patterns, verified against SQLite official docs
- `https://github.com/tauri-apps/tauri/discussions/7592` — Multi-binary Tauri discussion; `default-run` workaround confirmed as current practice

### Tertiary (LOW confidence)
- `https://github.com/dirvine/tauri-mcp` — Example of Tauri + MCP, but uses Node.js wrapper and different architecture; not directly applicable
- OWASP MCP Top 10 (2025) on token mismanagement — security best practice reference for error sanitization rationale

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — rmcp 0.16.0 is published, confirmed via docs.rs; all deps match existing project stack
- Architecture: HIGH — `[[bin]]` + `default-run` pattern confirmed against Tauri discussions; WAL pragma confirmed via rusqlite docs and SQLite official
- Pitfalls: HIGH — stdout contamination confirmed via real GitHub issues; WAL concurrency is SQLite-spec behavior; `is_error` semantics from MCP spec

**Research date:** 2026-02-26
**Valid until:** 2026-04-26 (rmcp stable; 60-day window reasonable for 0.x series)

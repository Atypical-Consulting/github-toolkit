# Stack Research

**Domain:** MCP server in Rust + realtime incremental UI updates in Tauri 2 + React 19
**Researched:** 2026-02-26
**Confidence:** HIGH (MCP transport layer) / HIGH (Tauri event patterns)

---

## Context: What This Research Covers

The existing app (Tauri 2 + Rust + React 19 + Zustand v5) already has a working scan pipeline emitting `scan-progress` Tauri events, but the frontend batches updates. This research covers two additive capabilities:

1. **MCP server** — host a Model Context Protocol server inside the running Tauri app, accessible to Claude Code, Cursor, Windsurf, etc.
2. **Realtime incremental UI** — wire the existing `scan-progress` events into per-repo Zustand state so health rings update live instead of all at once after the scan completes.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `rmcp` | 0.16.0 | Official Rust MCP SDK — server handler, tool macros, transport | The official SDK from the `modelcontextprotocol` org. Tracks the canonical spec most closely. The `#[tool]` and `#[tool_box]` macros eliminate boilerplate. crates.io stable is `0.8.0`; `0.16.0` is on the `main` git branch (released 2026-02-17). |
| `axum` | 0.8 | HTTP server for MCP Streamable HTTP transport | rmcp's streamable HTTP server feature is built as an axum tower `Service`. Using axum 0.8 matches the `StreamableHttpService` API exactly. Axum already co-exists with Tauri's tokio runtime — spawn it on `tauri::async_runtime::spawn`. |
| `@tauri-apps/api` event namespace | 2.x (already installed) | Frontend event listener for scan progress | `listen()` from `@tauri-apps/api/event` is the standard approach. Already used in the codebase for `scan-progress` events — this milestone only fixes the frontend slice consuming it incrementally. |
| Tauri `ipc::Channel` | Tauri 2.x (already installed) | Alternative to global events for ordered streaming data | For new commands that stream data (e.g., future large scan results), `Channel` is faster and guarantees ordering. Use this for new streaming commands, keep `app.emit()` for broadcast-style events like scan progress. |

### Supporting Libraries (Rust — new additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rmcp` features: `server`, `macros`, `transport-streamable-http-server` | 0.8.0 (crates.io stable) | MCP server with HTTP/SSE transport | Use `transport-streamable-http-server` to expose MCP over `http://127.0.0.1:{port}/mcp`. This is the transport all major MCP clients (Claude Code, Cursor, Windsurf) support. |
| `schemars` | 1.0 | JSON Schema generation for MCP tool parameter definitions | Required by rmcp — the `#[tool]` macro generates JSON Schema from Rust types using `schemars`. Already compatible with `serde`. |
| `axum` | 0.8 | HTTP router for MCP server endpoint | Nest `StreamableHttpService` at `/mcp` path. Bind to `127.0.0.1` only (not `0.0.0.0`) since this is a local desktop app. Port default: `3741`. |
| `tokio` | 1.x (already installed) | Async runtime for MCP server background task | Use `tauri::async_runtime::spawn()` (not raw `tokio::spawn`) to launch the axum MCP server — this ensures Tauri and the MCP server share the same runtime and avoid double-runtime conflicts. |
| `tower` | 0.4 | Service abstraction (transitive dep of axum + rmcp) | No direct usage needed — axum and rmcp wire together through tower traits automatically. |

### Supporting Libraries (TypeScript — new additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/api/event` `listen()` | Already installed | Subscribe to Rust-emitted events in React | Already used for `scan-progress`. Fix: call `listen()` in the Zustand slice initializer and dispatch per-repo state updates immediately instead of batching. No new package needed. |

No new frontend packages are required for the realtime UI milestone. The fix is purely in how the existing `scan.slice.ts` consumes already-arriving events.

---

## Installation

```toml
# src-tauri/Cargo.toml — new dependencies to add

[dependencies]
# MCP server
rmcp = { version = "0.8", features = [
    "server",
    "macros",
    "transport-streamable-http-server",
] }
axum = "0.8"
schemars = "1.0"
# serde, tokio, thiserror are already present
```

```bash
# No new npm packages required for realtime UI milestone
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `rmcp` 0.8 (official SDK) | `rust-mcp-sdk` | If you need the 2025-11-25 protocol spec with elicitation and OAuth 2.1. For this app's scope (scan, fix, query, settings tools), rmcp 0.8 is sufficient and more stable. |
| `rmcp` 0.8 (official SDK) | `mcpkit` | If you need long-running async task protocol (MCP "tasks" extension). Out of scope for this milestone. |
| Streamable HTTP transport | stdio transport | If your MCP server is a CLI tool invoked per-request. Tauri apps are long-running processes — HTTP/SSE is the correct transport for a persistent server with session management. Stdio would require spawning a child process and is not compatible with in-process Tauri hosting. |
| `axum` 0.8 | `actix-web` | actix-web is valid but rmcp's `transport-streamable-http-server` feature ships its own `StreamableHttpService` as an axum `tower::Service` — using axum avoids wrapping or adapting the service. Stick with axum. |
| `app.emit()` global events | `Channel` for scan progress | Use `Channel` when writing new commands that stream large ordered datasets (e.g., future bulk operations). For the existing `scan-progress` event system, keep `app.emit()` — it already broadcasts to all webview windows and the codebase already expects it. Don't rewrite what works. |
| `tauri::async_runtime::spawn()` | `tokio::spawn()` | Use `tokio::spawn()` only inside already-async contexts that are certain to be on Tauri's runtime. Prefer `tauri::async_runtime::spawn()` for safety — it uses Tauri's built-in Tokio runtime handle, avoiding "no reactor running" panics when the MCP server starts before Tauri's runtime is fully up. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tauri-plugin-mcp` (0.7.1) | This plugin is a *client* plugin — it connects Tauri apps *to* external MCP servers. We are building an MCP *server* inside Tauri. Wrong direction. | `rmcp` with `features = ["server"]` |
| SSE-only transport (`transport-sse-server` feature, pre-2025 MCP spec) | The 2024-11-05 SSE transport is deprecated. Major clients are dropping support. The 2025-03-26 spec replaced it with Streamable HTTP. | `transport-streamable-http-server` feature |
| `std::thread::spawn` for the axum server | Tauri uses a Tokio runtime — mixing with a thread-local async reactor causes "no reactor running" panics in async code. | `tauri::async_runtime::spawn()` |
| Global `0.0.0.0` bind for MCP server | Exposes the MCP server (with token-bearing operations) to the local network. Only `127.0.0.1` is safe for a desktop app. | `TcpListener::bind("127.0.0.1:{port}")` |
| Re-fetching all repos after scan completes | The current batched approach forces a full store refresh on scan end. Defeats the realtime goal. | Update per-repo slice state inside the `scan-progress` event listener in `scan.slice.ts` |

---

## Stack Patterns by Variant

**MCP server with settings toggle (on/off):**
- Store toggle state in `tauri-plugin-store` (already installed)
- On startup: read toggle, conditionally call `tauri::async_runtime::spawn(run_mcp_server(app_handle))`
- On toggle change: use a `tokio::sync::watch::Sender<bool>` to signal the running server to shut down cleanly
- Do not restart Tauri to toggle — use a watch channel sentinel

**Realtime scan rings (immediate per-repo updates):**
- In `scan.slice.ts`: move from "collect all results then set" to "set immediately on each `scan-progress` event"
- Payload shape is already correct (per-repo result) — this is a one-line fix in the listener callback
- Use `useRef` + `useEffect` cleanup to call the `UnlistenFn` returned by `listen()` when the component unmounts

**MCP tool accessing SQLite state:**
- MCP tool handlers run in the axum server's tokio task — they need access to `DbState`
- Pattern: pass `Arc<Mutex<rusqlite::Connection>>` (or `tauri::State` extracted before spawn) into the MCP server's state via `Arc` clone
- Do NOT use `AppHandle.state()` inside rmcp tool handlers — `AppHandle` is not `Send + 'static` compatible with axum service factories
- Instead: clone the `Arc<DbState>` in the Tauri setup hook and move it into the `StreamableHttpService` factory closure

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `rmcp` 0.8 (crates.io) | `axum` 0.8, `tokio` 1.x, `serde` 1.x | The `transport-streamable-http-server` feature ships axum 0.8 as a dep. Pin axum to 0.8 in Cargo.toml to avoid resolver conflicts. |
| `rmcp` main branch (0.16.0) | Same as above | The git main branch is ahead of crates.io. Use crates.io `0.8` for stability unless you need a specific 0.9–0.16 feature. |
| `schemars` 1.0 | `serde` 1.x | rmcp 0.8 depends on schemars; specifying `schemars = "1.0"` in your own Cargo.toml avoids a duplicate dependency if rmcp's transitive version matches. Verify with `cargo tree -i schemars` after adding. |
| `axum` 0.8 | `tower` 0.4, `tokio` 1.x | axum 0.8 requires tower 0.4. Both are already in the Tokio ecosystem and will not conflict with Tauri 2. |
| Tauri `ipc::Channel` | `@tauri-apps/api/core` `Channel` class | The Rust `tauri::ipc::Channel` type pairs with the TypeScript `Channel` from `@tauri-apps/api/core`. Both are in the already-installed packages — no version bump needed. |

---

## Sources

- [modelcontextprotocol/rust-sdk (GitHub)](https://github.com/modelcontextprotocol/rust-sdk) — official rmcp SDK, version 0.16.0 confirmed. HIGH confidence.
- [rmcp 0.16.0 on docs.rs](https://docs.rs/crate/rmcp/latest) — feature flags verified: `server`, `macros`, `transport-streamable-http-server`, `transport-streamable-http-client`. HIGH confidence.
- [Shuttle.dev: Build a Streamable HTTP MCP Server in Rust](https://www.shuttle.dev/blog/2025/10/29/stream-http-mcp) — rmcp 0.8 + axum 0.8 Cargo.toml and `StreamableHttpService` setup verified. MEDIUM confidence (tutorial, not official docs).
- [Tauri v2: Calling the Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) — `AppHandle.emit()`, `Channel`, `listen()` patterns verified from official docs. HIGH confidence.
- [Tauri v2: Event namespace reference](https://v2.tauri.app/reference/javascript/api/namespaceevent/) — `listen()`, `once()`, `emit()`, `emitTo()` signatures verified. HIGH confidence.
- [tauri-plugin-mcp 0.7.1 on docs.rs](https://docs.rs/crate/tauri-plugin-mcp/latest) — confirmed this is a *client* plugin (connects to servers), not a server host. HIGH confidence on what to avoid.
- [MCP Bouncer (Tauri + rmcp reference app)](https://github.com/catkins/mcp-bouncer) — confirmed real-world pattern of hosting rmcp Streamable HTTP at `127.0.0.1:8091/mcp` inside a Tauri v2 app. MEDIUM confidence (third-party project).
- [HackMD: Coder's Guide to rmcp](https://hackmd.io/@Hamze/S1tlKZP0kx) — `#[tool]`, `#[tool_box]` macros and Cargo feature flags. LOW-MEDIUM confidence (community guide, cross-referenced with official SDK).

---

*Stack research for: MCP server in Rust + realtime incremental UI in Tauri 2*
*Researched: 2026-02-26*

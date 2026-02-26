# GitHubAutomate

## What This Is

A Tauri 2 desktop app that scans GitHub repositories across `phmatray` and `Atypical-Consulting`, produces health diagnostics with weighted scoring, generates a prioritized backlog, and can create GitHub issues automatically. Built with Rust backend and React 19 + TypeScript frontend.

## Core Value

Users see the health of their GitHub repositories updating live as each repo is scanned, and can act on issues — manually or through AI tools via MCP.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ GitHub OAuth Device Flow authentication with OS keychain token storage — existing
- ✓ List repos from user account and specified orgs with pagination — existing
- ✓ Repo caching in SQLite with instant load on startup — existing
- ✓ Diagnostic engine with pluggable rules (HasReadme, HasLicense, HasDescription, HasTopics, HasCiCd) — existing
- ✓ Weighted health scoring (Critical=3x, Warning=2x, Info=1x) — existing
- ✓ Full scan across all repos with progress events — existing
- ✓ SHA-based incremental scan caching per repo — existing
- ✓ Single-rule rescan on repo detail page — existing
- ✓ Backlog generation from failed diagnostics with priority scoring — existing
- ✓ Create GitHub issues from backlog items — existing
- ✓ Rate limit checking before API operations — existing
- ✓ Scan cancellation support — existing
- ✓ Toast notification system (log store + ToastOverlay) — existing
- ✓ Catppuccin Mocha-inspired dark theme — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Health rings update in realtime as each repo's diagnostics complete during scan
- [ ] Diagnostic breakdown (rules passed/failed) appears immediately per repo during scan
- [ ] MCP server exposing scan, fix, query, and settings operations
- [ ] MCP server toggle (on/off) in app settings
- [ ] MCP fix: create GitHub issue → create branch from issue → commit fix (conventional) → create PR
- [ ] MCP query: read scan history, health scores, backlog items
- [ ] MCP scan: trigger diagnostic scan from external AI tools
- [ ] MCP settings: toggle rules, change scan targets, configure thresholds

### Out of Scope

- Mobile app — desktop-first, Tauri handles cross-platform desktop
- MCP auto-registration into client configs — simple on/off toggle is sufficient
- MCP port/transport configuration — use sensible defaults
- Push code fixes from the desktop UI directly — fix automation lives in MCP only

## Context

The app already has a working scan pipeline that emits `scan-progress` Tauri events per repo, but the frontend only updates the UI after the entire scan completes. The Rust backend already computes per-repo results incrementally — the gap is in the frontend state management (scan.slice.ts batches results).

For MCP, Tauri 2 can host a local HTTP/SSE server alongside the app. The MCP server should be compatible with any MCP client (Claude Code, Cursor, Windsurf, etc.). The fix operation is a full remediation pipeline: issue → branch → conventional commit → PR.

Existing codebase has 4 Rust modules (github, diagnostics, storage, backlog) and a Zustand-based frontend with composable slices. The IPC boundary is auto-generated via tauri-specta.

## Constraints

- **Tech stack**: Tauri 2 + Rust backend + React 19 + TypeScript — no changes
- **Auth**: Token stays in Rust, never exposed to frontend or MCP clients directly
- **IPC**: All new commands must follow `#[tauri::command] #[specta::specta]` pattern
- **Conventional commits**: MCP fix operations must use conventional commit format
- **MCP protocol**: Must follow Model Context Protocol specification for tool definitions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Realtime ring updates via existing Tauri event system | Infrastructure already exists (scan-progress events), just need frontend to consume incrementally | — Pending |
| MCP server as optional feature behind settings toggle | Not all users need AI tool integration, keeps app simple by default | — Pending |
| Full fix pipeline (issue → branch → commit → PR) | Maximizes automation value for AI agents consuming MCP | — Pending |

---
*Last updated: 2026-02-26 after initialization*

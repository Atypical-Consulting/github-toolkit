# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHubAutomate is a Tauri 2 desktop app (Rust + React 19 + TypeScript) that scans GitHub repositories across `phmatray` and `Atypical-Consulting`, produces health diagnostics, generates a prioritized backlog, and can create GitHub issues automatically.

## Commands

```bash
# Development
npm run tauri dev          # Start Tauri app (Rust + Vite HMR, port 1420)
npm run dev                # Vite dev server only (no Tauri window)

# Build
npm run build              # TypeScript check + Vite production build
npm run tauri build        # Full native app bundle (.app/.dmg on macOS)

# Rust only
cargo build --manifest-path src-tauri/Cargo.toml    # Compile Rust backend
cargo test --manifest-path src-tauri/Cargo.toml     # Run Rust tests

# Frontend only
npx tsc --noEmit           # TypeScript type check
npm run test               # Vitest (run once)
npm run test:watch         # Vitest (watch mode)

# Lint & format
npm run check              # Biome format + lint (auto-fix)
```

## Architecture

### IPC Boundary (Rust ↔ TypeScript)

Commands are defined in Rust with `#[tauri::command] #[specta::specta]` and auto-exported to `src/bindings.ts` via tauri-specta when `tauri dev` runs. The bindings file should NOT be manually edited in production — it regenerates on each debug launch. A handwritten placeholder exists for offline TypeScript compilation.

**Naming convention:** Rust `snake_case` fields become TypeScript `camelCase` via `#[serde(rename_all = "camelCase")]`.

**Error pattern:** `GitHubError` is a tagged enum (`#[serde(tag = "type", content = "message")]`) that becomes a TypeScript discriminated union. All commands return `Result<T, GitHubError>` which the bindings wrap as `{ status: "ok"; data: T } | { status: "error"; error: GitHubError }`.

### Rust Backend (`src-tauri/src/`)

Four modules, all wired in `lib.rs` via `collect_commands![]`:

- **`github/`** — OAuth device flow auth (`auth.rs`), OS keychain token storage (`token.rs`), authenticated HTTP client (`client.rs`), repo listing with pagination (`repos.rs`), issue creation (`issues.rs`), rate limit checking (`rate_limit.rs`). Token never leaves Rust.
- **`diagnostics/`** — Rule engine with trait `DiagnosticRule`. Five built-in rules: HasReadme, HasLicense, HasDescription, HasTopics, HasCiCd. `context.rs` fetches repo data via GitHub API, `engine.rs` computes weighted health scores (Critical=3x, Warning=2x, Info=1x). `scan_all_repositories` emits `scan-progress` Tauri events.
- **`storage/`** — SQLite via rusqlite. `DbState(Mutex<Connection>)` managed by Tauri. Four tables: `scan_sessions`, `repositories`, `diagnostic_results`, `backlog_items`. Initialized in `lib.rs` setup.
- **`backlog/`** — Generates backlog items from failed diagnostics (priority: Critical=100, Warning=50, Info=10). Can create GitHub issues from backlog items, updating status to `in_progress`.

### Frontend (`src/`)

**State management:** Zustand v5 with composable slices pattern. Each domain store combines typed slices:
```
useGitHubStore     = AuthSlice + ReposSlice
useDiagnosticsStore = ScanSlice + ResultsSlice
useBacklogStore    = single store with filters
```

Slices use `StateCreator<Store, [["zustand/devtools", never]], [], SliceType>` and call Tauri commands via dynamic `import("@/bindings")`. Devtools middleware is enabled in dev mode.

**Scan progress** uses Tauri event system: Rust emits `scan-progress`, frontend listens via `listen()` from `@tauri-apps/api/event`.

**UI:** Tailwind CSS v4 with Catppuccin Mocha-inspired custom theme (defined as CSS variables in `index.css`). Components use `lucide-react` icons. Auth gate in `App.tsx` — unauthenticated users see `AuthScreen`, authenticated see `Dashboard`.

### Adding a New Tauri Command

1. Add the Rust function with `#[tauri::command] #[specta::specta]` in the appropriate module
2. Re-export it from the module's `mod.rs`
3. Add it to `collect_commands![]` in `lib.rs`
4. Run `tauri dev` to regenerate `src/bindings.ts` (or update the placeholder manually)

### Adding a New Diagnostic Rule

1. Create a struct implementing `DiagnosticRule` trait in `diagnostics/rules.rs`
2. Add it to the `default_rules()` vec
3. The engine, scoring, and backlog generation all work automatically

## Key Conventions

- Path alias: `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts)
- Rust edition 2024, TypeScript strict mode
- Keychain service: `com.githubautomate.desktop.github`
- GitHub API version header: `2022-11-28`, User-Agent: `GitHubAutomate-Desktop`
- OAuth Client ID is embedded in `auth.rs` (currently using FlowForge's — needs dedicated registration)
- SQLite DB location: OS app data directory / `github-automate.db`

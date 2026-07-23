# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- Rust (Edition 2024) - Backend services, GitHub API integration, diagnostics engine, SQLite persistence
- TypeScript 5 - React 19 frontend, state management, UI components
- JavaScript/JSX - React component implementation

**Secondary:**
- HTML5 - Document structure
- CSS - Styling via Tailwind CSS v4

## Runtime

**Environment:**
- Tauri 2 - Cross-platform desktop application framework (Rust + Webview)
- Node.js 18+ - JavaScript build tooling and package management (implied by package.json)

**Package Managers:**
- npm - JavaScript/TypeScript dependencies
- Cargo - Rust dependencies

**Lockfiles:**
- `package-lock.json` - npm lock file (present)
- `Cargo.lock` - Rust lock file (present)

## Frameworks

**Frontend:**
- React 19 - UI framework with hooks
- Tauri API v2 - IPC bridge between Rust backend and TypeScript frontend
- Zustand v5 - State management with composable slices pattern

**Desktop:**
- Tauri 2 - Application container, window management, cross-platform bundling

**Build & Development:**
- Vite 7 - Module bundler and dev server (port 1420)
- TypeScript 5 - Type system and compilation
- Biome 2.3 - Linter and code formatter

**Styling:**
- Tailwind CSS v4 - Utility-first CSS framework with custom theme (Catppuccin Mocha-inspired)
- CVA (class-variance-authority) v0.7 - Component variant management

## Key Dependencies

**Critical:**
- `@tanstack/react-query` v5 - Server state management (implied, in dependencies)
- `framer-motion` v12 - Animation library
- `lucide-react` v0.563 - Icon library (563+ icons)
- `react-hotkeys-hook` v5 - Keyboard shortcut handling
- `clsx` v2.1 - Classname utility
- `tailwind-merge` v3 - Tailwind class conflict resolution

**Rust Backend:**
- `tauri` v2 - IPC and window management
- `tauri-specta` v2.0.0-rc.21 - Automatic TypeScript binding generation from Rust
- `specta` v2.0.0-rc.22 - Type serialization framework
- `serde` v1 - Serialization/deserialization with camelCase support
- `tokio` v1 (full) - Async runtime
- `reqwest` v0.13 - HTTP client with JSON support
- `rusqlite` v0.33 - SQLite driver (bundled SQLite)
- `keyring` v3 - OS keychain integration (Apple native, Windows native, Linux secret service)
- `uuid` v1 - UUID generation
- `chrono` v0.4 - DateTime handling
- `thiserror` v2 - Error type derivation

**Tauri Plugins:**
- `@tauri-apps/plugin-dialog` v2 - File/folder dialogs
- `@tauri-apps/plugin-opener` v2 - Open URLs and files
- `@tauri-apps/plugin-store` v2 - Persistent key-value store
- `@tauri-apps/plugin-window-state` v2 - Window state persistence

## Configuration

**TypeScript:**
- Target: ES2020
- Module: ESNext
- Strict mode: enabled
- JSX: react-jsx
- Path alias: `@/*` → `src/*`
- Excludes test files from compilation

**Vite:**
- Dev server port: 1420
- Frontend dist directory: `../dist`
- Environment prefix: `VITE_`, `TAURI_`
- Build targets: Safari 13 (macOS), Chrome 105 (Windows)
- Minification: esbuild (production only)
- Source maps: enabled in debug builds

**Biome:**
- Import organization: enabled (auto-sort)
- Linting: enabled with recommended rules
- Formatting: enabled with 2-space indentation

**Tauri App:**
- App identifier: `com.githubautomate.desktop`
- App data directory: OS-specific (macOS: `~/Library/Application Support/com.githubautomate.desktop/`)
- Database: `github-automate.db` (SQLite)

## Platform Requirements

**Development:**
- macOS, Windows, or Linux (Tauri supports all)
- Rust toolchain (1.70+)
- Node.js 18+ with npm
- npm packages installed via `npm install`
- Cargo dependencies (installed via `cargo fetch`)

**Production:**
- macOS (.app, .dmg bundles)
- Windows (.exe, .msi bundles)
- Linux (.AppImage, .deb bundles)
- Deployment via `npm run tauri build`

**Key Build Commands:**
- `npm run tauri dev` - Start Tauri dev environment with Rust + Vite HMR
- `npm run build` - TypeScript check + Vite production build
- `npm run tauri build` - Full native app bundle
- `cargo build --manifest-path src-tauri/Cargo.toml` - Compile Rust only
- `npx tsc --noEmit` - Type check without emitting
- `npm run check` - Biome format + lint with auto-fix

## Special Configuration

**Bindings Generation:**
- `tauri-specta` auto-generates `src/bindings.ts` from Rust `#[tauri::command] #[specta::specta]` annotations during debug builds
- Specta version: v2.0.0-rc.22 with TypeScript output
- Post-generation fix applied to remove buggy `TAURI_CHANNEL` type export

**Feature Flags:**
- Tauri: No special features enabled (defaults used)
- reqwest: JSON support, rustls TLS, form encoding
- rusqlite: Bundled SQLite (no external database required)
- keyring: All platform backends (Apple native, Windows native, Linux secret service)
- tokio: Full feature set (`["full"]`)

---

*Stack analysis: 2026-02-26*

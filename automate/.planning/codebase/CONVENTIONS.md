# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- TypeScript components: PascalCase with `.tsx` or `.ts` extension (e.g., `Dashboard.tsx`, `AuthSlice.ts`)
- Rust modules: snake_case with `.rs` extension (e.g., `auth.rs`, `commands.rs`)
- Store slices: `[Domain][Slice].ts` pattern (e.g., `auth.slice.ts`, `repos.slice.ts`)
- Utility files: lowercase with descriptive names (e.g., `cn.ts` for Tailwind utilities)

**Functions:**
- TypeScript: camelCase (e.g., `startDeviceFlow`, `fetchAllRepos`, `handleScan`)
- Rust: snake_case (e.g., `scan_repository`, `build_repo_context`, `fetch_github_user`)
- React component functions: PascalCase (e.g., `Dashboard`, `StatCard`, `OverviewTab`)
- Zustand store creators: `create[Name]Slice` (e.g., `createAuthSlice`, `createReposSlice`)

**Variables:**
- TypeScript: camelCase (e.g., `isAuthenticated`, `scanProgress`, `healthScore`)
- Rust: snake_case (e.g., `device_code`, `user_code`, `from_cache`)
- React hooks: prefixed with `use` (e.g., `useGitHubStore`, `useNavigationStore`, `useEffect`)
- Constants: UPPER_SNAKE_CASE in Rust, camelCase in TypeScript (e.g., `GITHUB_CLIENT_ID` in Rust, `DEFAULT_TTL` as export)

**Types:**
- TypeScript interfaces: PascalCase with descriptive names (e.g., `AuthSlice`, `ScanProgress`, `DiagnosticResult`)
- Rust structs: PascalCase (e.g., `GitHubError`, `RepoHealthReport`, `DiagnosticRule`)
- TypeScript union types: descriptive (e.g., `type Tab = "overview" | "repositories" | "backlog"`)
- Rust enums: PascalCase variants (e.g., `Severity::Critical`, `GitHubError::OAuthFailed`)

## Code Style

**Formatting:**
- Tool: Biome v2.3
- Indent style: 2 spaces
- Enabled: formatter and linter with "recommended" rules
- Command: `npm run check` (formats and lints with auto-fix)

**Linting:**
- Tool: Biome (configured in `biome.json`)
- No ESLint or Prettier — Biome handles both
- Rules: Biome "recommended" preset (strict mode enforced for TypeScript)
- Import organization: Enabled via Biome, auto-organized on format

**TypeScript:**
- Strict mode enabled
- Target: ES2020
- Module: ESNext
- JSX: react-jsx
- Allow unused locals/parameters: false (warnings not errors)
- Path aliasing: `@/*` maps to `src/*`
- Exclude test files from tsconfig (test compilation handled by Vitest)

**Rust:**
- Edition: 2024
- Formatting: `cargo fmt` conventions (implied from project setup)
- Attributes for IPC: `#[tauri::command] #[specta::specta]` for all exported commands

## Import Organization

**Order (TypeScript):**
1. React imports: `import { useEffect, useState } from "react"`
2. External packages: `import { create } from "zustand"`
3. Tauri imports: `import { listen } from "@tauri-apps/api/event"`
4. Local absolute paths: `import { useGitHubStore } from "@/core/stores/domain/github"`
5. Local relative paths: rarely used; prefer absolute `@/*` aliases

**Path Aliases:**
- `@/*` → `src/*` (configured in tsconfig.json and vite.config.ts)
- Use aliases for all imports from `src/`, never relative paths

**Barrel Exports:**
- Used in store indexes: `src/core/stores/domain/github/index.ts` exports combined slices
- Not used for components; import directly from component files

## Error Handling

**Rust Patterns:**
- Error type: `GitHubError` (tagged enum with `#[serde(tag = "type", content = "message")]`)
- All commands return `Result<T, GitHubError>`
- Variants use descriptive names: `OAuthFailed(String)`, `NotAuthenticated`, `RateLimitExceeded(String)`
- Error creation: `Err(GitHubError::OAuthFailed(format!("message: {}", e)))`
- Best-effort operations: use `let _ = operation()` to explicitly ignore results (see `scan_all_repositories`)
- Panic-avoidance: wrap API calls in match blocks, use `.map_err()` for error translation

**TypeScript Patterns:**
- Error states in Zustand slices: explicit error properties (e.g., `authError: string | null`, `scanError: string | null`)
- Command results checked: `if (result.status === "ok")` branches vs `if (result.status === "error")`
- Tagged union errors: access via `result.error.type` and `result.error.message` properties
- Logging on error: `log.error(source, message)` called before state update
- Async try-catch: used when importing bindings dynamically, catch-all logs to console

## Logging

**Framework:** Custom Zustand store (`src/core/stores/log.ts`)

**Patterns:**
- Source identifier always provided: `log.info("scan", "message")` — source is first argument
- Levels: `info`, `success`, `warn`, `error`
- Shortcuts available: `log.info()`, `log.success()`, `log.error()`, `log.warn()`
- TTL (time-to-live): auto-dismiss after ms (success: 3000ms, error: never auto-dismiss)
- In dev mode: styled console output via `console.log('%c[source]%c message', ...)`
- In components: use `useLogStore()` hook; in stores use `log` singleton export

**When to Log:**
- Auth transitions: start, success, error for each auth operation
- Scan operations: start, progress, completion, errors
- API failures: always log before setting error state
- State transitions: annotated in Zustand `set()` third argument (e.g., `"auth/checkAuth/ok"`)

## Comments

**When to Comment:**
- Complex algorithms: explain the "why" not the "what"
- Business logic: why a specific rule severity or priority is chosen
- Workarounds: mark with reasoning if deviating from standard patterns
- Architectural decisions: comment on interfaces explaining role and usage
- Section dividers: use `// ─── Name ──────` pattern for visual organization (seen in Dashboard.tsx)

**JSDoc/TSDoc:**
- Minimal usage observed; prefer clear function names and type signatures
- Used for public interfaces: `/** Comment */` on interface properties with complex semantics
- Rust: use `///` doc comments for exported functions and public structs

## Function Design

**Size:**
- Aim for single responsibility
- Components can grow to ~100 lines for complex UI (Dashboard.tsx is ~940 lines but split into nested component functions)
- Store actions typically 10-50 lines
- Rust functions: 20-100 lines depending on logic

**Parameters:**
- TypeScript: prefer named parameters via object destructuring for optional configs
- Components: props destructured in function signature
- Rust: explicit parameter types, no implicit returns in commands
- Zustand actions: `(set, get) => ({ ... })` pattern for state access

**Return Values:**
- TypeScript: explicit void or return type in signatures
- React: components return JSX.Element
- Zustand actions: return void or Promise<void>
- Rust: all tauri commands return `Result<T, GitHubError>`

## Module Design

**Exports:**
- Barrel exports in store `index.ts` files: `export const useXxxStore = ...` and `export type XxxStore = ...`
- Component files export one default component (e.g., `export default function App()`)
- Store slices export both interface and creator (e.g., `export interface AuthSlice`, `export const createAuthSlice`)
- Rust modules re-export public items via `mod.rs`

**Barrel Files:**
- Used in: `src/core/stores/domain/{github,diagnostics,backlog}/index.ts`
- Pattern: combine slice creators and type definitions
- Zustand `create()` call happens in barrel, not in individual slice files

**Module Organization:**
- Rust: organized by domain (github/, diagnostics/, storage/, backlog/)
- TypeScript: organized by domain (stores/domain/github/, stores/domain/diagnostics/)
- Each module responsible for single concern
- Slice files separate interface definition from creator function in same file

## Tauri IPC Conventions

**Naming:**
- Rust command names: snake_case (e.g., `github_start_device_flow`, `scan_all_repositories`)
- TypeScript bindings: auto-generated from Rust, converted to camelCase (e.g., `githubStartDeviceFlow`, `scanAllRepositories`)
- Struct field renames: `#[serde(rename_all = "camelCase")]` on Rust structs for TypeScript serialization

**Attributes:**
- All exported commands: decorated with `#[tauri::command] #[specta::specta]`
- Specta generates bindings in `src/bindings.ts` on `tauri dev`
- Result type: always `Result<T, GitHubError>` for consistent error handling

**Type Safety:**
- Rust types derive: `Serialize`, `Deserialize`, `Type` (from specta)
- TypeScript bindings: automatically generated, strongly typed discriminated unions
- Error responses: tagged union with `type` and `message` fields

---

*Convention analysis: 2026-02-26*

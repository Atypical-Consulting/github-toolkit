# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Framework: Vitest v4
- Config: Not explicitly configured (uses Vitest defaults)
- Run Commands:
  ```bash
  npm run test              # Run all tests once
  npm run test:watch       # Run tests in watch mode
  ```

**Assertion Library:**
- Framework: Vitest includes chai assertions by default
- Available: standard `expect()` API

**Test Discovery:**
- Pattern: Files matching `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
- Excluded from tsconfig: `src/**/*.test.ts`, `src/**/*.test.tsx`

## Current Testing Status

**Test Files in Codebase:** None detected
- No test files exist in `src/` directory
- No test files exist in `src-tauri/src/` directory
- Framework (Vitest) is installed and configured but unused

**Testing Approach:** Not yet implemented
- Project is in early development phase
- Focus is on feature delivery over test coverage
- No existing test patterns to document

## Recommended Test Structure (For Future Implementation)

### TypeScript/React Tests

**File Location:** Co-located with source
```
src/core/stores/domain/github/
  ├── auth.slice.ts
  ├── auth.slice.test.ts          # <-- Test file
  ├── repos.slice.ts
  ├── repos.slice.test.ts         # <-- Test file
  └── index.ts

src/extensions/dashboard/
  ├── Dashboard.tsx
  ├── Dashboard.test.tsx           # <-- Test file
```

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAuthSlice } from "./auth.slice";

describe("authSlice", () => {
  describe("checkAuth", () => {
    it("should set authenticated state on success", async () => {
      // Test implementation
    });

    it("should handle auth check errors", async () => {
      // Test implementation
    });
  });

  describe("signOut", () => {
    it("should clear authentication state", async () => {
      // Test implementation
    });
  });
});
```

### Setup and Teardown

**Patterns (when implemented):**
```typescript
describe("ScanSlice", () => {
  let mockAppHandle: any;
  let mockDb: any;

  beforeEach(() => {
    // Reset mocks before each test
    mockAppHandle = {
      emit: vi.fn(),
    };
    mockDb = {
      // Mock database methods
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should emit scan-progress events", async () => {
    // Test that emitter is called correctly
  });
});
```

## Mocking Strategy (For Future Implementation)

**Framework:** Vitest's built-in mocking via `vi`

**What to Mock:**
- Tauri command imports: `@/bindings` should be mocked for store unit tests
- Event listeners: `@tauri-apps/api/event` listen() calls
- Dynamic imports in stores: mock the lazy-loaded bindings

**What NOT to Mock:**
- Zustand store structure itself (test the full slice behavior)
- Custom hooks like `useGitHubStore` (test with real store)
- Utility functions like `cn()` (simple and pure)

**Example Mocking Pattern (for future tests):**
```typescript
vi.mock("@/bindings", () => ({
  commands: {
    githubCheckAuthStatus: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        authenticated: true,
        username: "testuser",
        avatarUrl: "https://example.com/avatar.jpg",
      },
    }),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}), // Returns unlisten function
}));
```

## Component Testing (For Future Implementation)

**Approach:**
- Use Vitest with React Testing Library (not yet installed)
- Test component behavior, not implementation
- Focus on: user interactions, prop handling, conditional rendering

**Example Structure:**
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dashboard } from "./Dashboard";

describe("Dashboard", () => {
  it("should render tabs", () => {
    render(<Dashboard />);
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
  });

  it("should handle tab switching", () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("tab", { name: /repositories/i }));
    expect(screen.getByText(/repositories/i)).toBeInTheDocument();
  });
});
```

## Store/Hook Testing (For Future Implementation)

**Approach:**
- Test Zustand slices in isolation
- Mock external dependencies (Tauri commands, event listeners)
- Use `renderHook` pattern from @testing-library/react for hooks

**Example Structure:**
```typescript
import { renderHook, act } from "@testing-library/react";
import { useGitHubStore } from "@/core/stores/domain/github";

describe("useGitHubStore", () => {
  it("should start device flow and update state", async () => {
    const { result } = renderHook(() => useGitHubStore());

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(result.current.userCode).toBeDefined();
    expect(result.current.verificationUri).toBeDefined();
  });

  it("should poll authentication and update on success", async () => {
    const { result } = renderHook(() => useGitHubStore());

    // Setup device code first
    await act(async () => {
      await result.current.startDeviceFlow();
    });

    // Then poll
    await act(async () => {
      const success = await result.current.pollAuth();
      expect(success).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.username).toBeDefined();
  });
});
```

## Rust Testing (For Future Implementation)

**Location:** Tests co-located with code or in `tests/` directory
```
src-tauri/src/
  ├── github/
  │   ├── auth.rs
  │   ├── auth.rs         # Contains #[cfg(test)] mod tests
  ├── diagnostics/
  │   ├── rules.rs
  │   └── rules.rs        # Contains unit tests for rules

src-tauri/tests/
  └── integration_tests.rs
```

**Unit Test Pattern (in `.rs` files):**
```rust
#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_has_readme_checks_file_existence() {
    let ctx = RepoContext {
      root_files: vec!["README.md".to_string()],
      readme_line_count: 50,
      ..Default::new()
    };

    let rule = HasReadme;
    let result = rule.check(&ctx);

    assert!(result.passed);
    assert_eq!(result.severity, Severity::Critical);
  }

  #[test]
  fn test_has_readme_fails_for_short_readme() {
    let ctx = RepoContext {
      root_files: vec!["README.md".to_string()],
      readme_line_count: 5,
      ..Default::new()
    };

    let rule = HasReadme;
    let result = rule.check(&ctx);

    assert!(!result.passed);
    assert_eq!(result.severity, Severity::Warning);
  }
}
```

**Async Test Pattern:**
```rust
#[tokio::test]
async fn test_github_api_call() {
  // Test async functions with tokio runtime
  let result = scan_repository("owner".to_string(), "repo".to_string()).await;
  assert!(result.is_ok());
}
```

## Test Data and Fixtures (For Future Implementation)

**Location:** `src-tauri/tests/fixtures/` or test modules in each file

**Example Fixture:**
```typescript
// In a test file or shared fixtures module
export const mockRepoContext = (): RepoContext => ({
  fullName: "test-owner/test-repo",
  description: "Test repository",
  readmeLineCount: 50,
  rootFiles: ["README.md", "LICENSE", "package.json"],
  licenseeName: "MIT",
  topics: ["testing", "example"],
  workflowFiles: ["ci.yml"],
});

export const mockDiagnosticResult = (overrides = {}): DiagnosticResult => ({
  ruleId: "has-readme",
  ruleName: "Has README",
  severity: "critical" as const,
  passed: true,
  message: "README found",
  ...overrides,
});
```

## Coverage

**Requirements:** None enforced (project is pre-testing phase)

**View Coverage (when tests exist):**
```bash
vitest run --coverage
```

**Coverage tools (not installed):**
- Can be added via: `npm install -D @vitest/coverage-v8`
- Configure in vite config when needed

## Test Types in Codebase

### Unit Tests (To Be Implemented)

**Scope:** Individual functions and components
- Store slices: test state mutations and async actions
- Utility functions: test pure functions
- Diagnostic rules: test rule logic in isolation

**Approach:**
- Mock external dependencies (API calls, events)
- Test state transitions
- Verify error handling

### Integration Tests (To Be Implemented)

**Scope:** Store + component interaction, command + storage interaction
- Test full flow: UI → store → Tauri command → response → store update
- Test database reads/writes via storage layer
- Test scan progress event emission

**Approach:**
- Use actual Zustand stores (not mocked)
- Mock only Tauri IPC boundaries
- Verify side effects

### E2E Tests

**Framework:** Not used
**Status:** Not implemented

---

*Testing analysis: 2026-02-26*

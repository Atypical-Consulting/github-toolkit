# User Experience Showcase

This document showcases the UX improvements made to the CLI tool.

## Before vs After

### Token Management

#### Before
```bash
$ dotnet run
Enter your GitHub Personal Access Token: ****
# Token not saved, must re-enter every time
```

#### After
```bash
$ dotnet run
╭────────────────────────────────────────────╮
│ GitHub Renovate Enabler                    │
│ Manage Renovate configurations across      │
│ your repositories                          │
╰────────────────────────────────────────────╯

Enter your GitHub Personal Access Token: ****
Save token for future use? (Y/n): y
Token saved to ~/.gh-renovate/config.json

# Next time:
$ dotnet run
Using saved GitHub token
✓ Authenticated as phmatray
```

### Repository Overview

#### Before
```bash
Found 45 repositories
```

#### After
```bash
╭─ Repository Summary ───────────────╮
│ Total Repositories:   45           │
│ With Renovate:        12           │
│ Without Renovate:     33           │
│ Private:              30           │
│ Public:               15           │
╰────────────────────────────────────╯
```

### Repository Selection

#### Before
```bash
Name              Visibility  Updated
my-repo           Private     2025-11-01
another-repo      Public      2025-10-30
```

#### After
```bash
Name              Owner      Visibility  Renovate  Updated
my-repo           phmatray   Private     ✓         2025-11-01
another-repo      phmatray   Public      ✗         2025-10-30
org-project       my-org     Private     ✗         2025-10-29
legacy-app        my-org     Private     ✓         2025-10-28

Select repositories to enable Renovate on:
> [ ] phmatray/my-repo (Private) [✓]
  [x] phmatray/another-repo (Public) [✗]
  [x] my-org/org-project (Private) [✗]
  [ ] my-org/legacy-app (Private) [✓]
```

### Action Preview

#### Before
```bash
# No preview - just starts processing
```

#### After
```bash
╭─ Action Preview ───────────────────────────────╮
│ Action   Count  Repositories                   │
│ Create   2      phmatray/another-repo,         │
│                 my-org/org-project             │
│ Update   0                                      │
│ Skip     1      phmatray/my-repo               │
╰────────────────────────────────────────────────╯

Proceed with enabling/updating Renovate on 3 repositories? (Y/n):
```

### Processing Output

#### Before
```bash
Processing my-repo...
✓ my-repo: renovate.json already exists, skipping
Processing another-repo...
✓ another-repo: Renovate enabled
```

#### After
```bash
Processing repositories ━━━━━━━━━━━━━━━━━━━━━ 100% 3/3

⚠ phmatray/my-repo: Skipped (already has Renovate)
✓ phmatray/another-repo: Created
✓ my-org/org-project: Created
```

### Final Summary

#### Before
```bash
✓ Done!
```

#### After
```bash
╭─ Final Summary ────────────────────╮
│ ✓ Created:    2                    │
│ ⚠ Skipped:    1                    │
╰────────────────────────────────────╯

✓ Done!
```

## New Features Showcase

### 1. Dry-Run Mode

```bash
$ dotnet run -- --dry-run

╭─ Action Preview ───────────────────────────────╮
│ Action   Count  Repositories                   │
│ Create   5      phmatray/repo-1, repo-2...     │
│ Update   2      phmatray/repo-3, repo-4        │
│ Skip     3      phmatray/repo-5, repo-6...     │
╰────────────────────────────────────────────────╯

Dry-run mode - no changes will be made
```

### 2. Cache Status

```bash
$ dotnet run

✓ Authenticated as phmatray
Last fetch: 15 minutes ago

# Or if cache is old:
Last fetch: 2.5 hours ago (use --refresh to update)
```

### 3. Refresh Cache

```bash
$ dotnet run -- --refresh

✓ Authenticated as phmatray
Refreshing repository data...

Fetching repositories...
  Found 25 personal repositories
  Found 3 organizations
  ...
```

### 4. Filter with Preview

```bash
$ dotnet run -- --filter "backend-*" --dry-run

✓ Authenticated as phmatray
Last fetch: 5 minutes ago

╭─ Repository Summary ───────────────╮
│ Total Repositories:   12           │
│ With Renovate:        4            │
│ Without Renovate:     8            │
│ Private:              12           │
│ Public:               0            │
╰────────────────────────────────────╯

# Only shows repositories matching "backend-*"
# Shows preview without making changes
```

### 5. Force Update

```bash
$ dotnet run -- --force

Select repositories to enable Renovate on:
> [x] phmatray/my-repo (Private) [✓]

╭─ Action Preview ───────────────────────────────╮
│ Action   Count  Repositories                   │
│ Update   1      phmatray/my-repo               │
╰────────────────────────────────────────────────╯

Proceed with enabling/updating Renovate on 1 repositories? (Y/n): y

✓ phmatray/my-repo: Updated

╭─ Final Summary ────────────────────╮
│ ✓ Updated:    1                    │
╰────────────────────────────────────╯

✓ Done!
```

### 6. Clear Token

```bash
$ dotnet run -- --clear-token
✓ Token and cache cleared successfully
```

## Error Handling Showcase

### Authentication Failure

#### Before
```bash
✗ Authentication failed. Please check your token.
```

#### After
```bash
✗ Authentication failed. Please check your token.
Tip: Use --clear-token to reset saved credentials
```

### Detailed Error View

```bash
✗ Error: Rate limit exceeded

Show detailed error? (y/N): y

ApiException: API rate limit exceeded
  at Octokit.ApiConnection.RunRequest()
  at Octokit.RepositoriesClient.GetAllForCurrent()
  ...
```

## Complete Flow Example

```bash
$ dotnet run

╭────────────────────────────────────────────╮
│ GitHub Renovate Enabler                    │
│ Manage Renovate configurations across      │
│ your repositories                          │
╰────────────────────────────────────────────╯

Using saved GitHub token
✓ Authenticated as phmatray
Last fetch: 45 minutes ago

Fetching repositories...
  Found 25 personal repositories
  Found 3 organizations

Select organizations to include:
> [x] my-company
  [x] my-open-source-org
  [ ] archived-projects

Fetching repositories from my-company...
  Found 30 repositories in my-company
Fetching repositories from my-open-source-org...
  Found 15 repositories in my-open-source-org

Checking for existing Renovate configurations...
Checking Renovate status (70/70)...
✓ Found 70 repositories (25 already have Renovate)

╭─ Repository Summary ───────────────╮
│ Total Repositories:   70           │
│ With Renovate:        25           │
│ Without Renovate:     45           │
│ Private:              55           │
│ Public:               15           │
╰────────────────────────────────────╯

[Shows repository table with first 10 repos]
... and 60 more repositories

Select repositories to enable Renovate on:
> [x] phmatray/project-a (Private) [✗]
  [x] phmatray/project-b (Public) [✗]
  [x] my-company/backend-api (Private) [✗]
  [ ] my-company/legacy-app (Private) [✓]
  [x] my-open-source-org/awesome-lib (Public) [✗]

╭─ Action Preview ───────────────────────────────╮
│ Action   Count  Repositories                   │
│ Create   4      phmatray/project-a,            │
│                 phmatray/project-b + 2 more    │
│ Skip     0                                      │
╰────────────────────────────────────────────────╯

Proceed with enabling/updating Renovate on 4 repositories? (Y/n): y

Processing repositories ━━━━━━━━━━━━━━━━━━━━━ 100% 4/4

✓ phmatray/project-a: Created
✓ phmatray/project-b: Created
✓ my-company/backend-api: Created
✓ my-open-source-org/awesome-lib: Created

╭─ Final Summary ────────────────────╮
│ ✓ Created:    4                    │
╰────────────────────────────────────╯

✓ Done!
```

## Command Reference Quick View

```bash
# Basic usage (interactive)
dotnet run

# Preview without changes
dotnet run -- --dry-run

# Force update existing configs
dotnet run -- --force

# Refresh cached data
dotnet run -- --refresh

# Filter by name pattern
dotnet run -- --filter "backend-*"

# Skip private repos
dotnet run -- --include-private false

# Skip organizations
dotnet run -- --include-orgs false

# Combined: Force update with fresh data (preview)
dotnet run -- --force --refresh --dry-run

# Clear saved credentials
dotnet run -- --clear-token

# Show help
dotnet run -- --help
```

## Visual Design Elements

### Colors Used
- **Green** ✓ - Success, created items
- **Cyan** ✓ - Updated items, informational
- **Yellow** ⚠ - Warnings, skipped items
- **Red** ✗ - Errors, failed items
- **Dim/Grey** - Secondary information, hints

### UI Components
- **Panels** - Group related information
- **Tables** - Display structured data
- **Progress Bars** - Show operation progress
- **Spinners** - Indicate loading/processing
- **Prompts** - Interactive user input
- **Multi-Select** - Repository selection

### Typography
- **Bold** - Headers, important information
- **Dim** - Secondary/meta information
- **Regular** - Standard content
- **Monospace** - Code, paths, technical details

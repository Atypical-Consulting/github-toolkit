# Bug Fix: Markup Escaping in Spectre.Console

## Issue

The application was crashing with the following error:

```
System.InvalidOperationException: Encountered malformed markup tag at position 30.
  at Spectre.Console.MarkupTokenizer.ReadMarkup()
  at Spectre.Console.MultiSelectionPrompt`1.Render()
```

## Root Cause

Spectre.Console uses square brackets `[` and `]` for markup tags (e.g., `[red]text[/]`). When repository names or owner names contained these characters (or other special markup characters), Spectre.Console tried to parse them as markup tags, causing parsing errors.

### Example Problem

If a repository was named `my-[app]-v2`, the display string would be:
```csharp
$"{owner}/my-[app]-v2 (Private) [✓]"
```

Spectre.Console would interpret `[app]` and `[✓]` as markup tags, leading to parsing errors.

## Solution

All user-provided strings (repository names, owner names, error messages) must be escaped using Spectre.Console's `.EscapeMarkup()` extension method before being used in markup strings.

## Changes Made

### 1. Repository Selection Prompt (Line 476-484)

**Before:**
```csharp
.UseConverter(item =>
{
    var (repo, hasRenovate) = item;
    var status = hasRenovate ? "✓" : "✗";
    return $"{repo.Owner.Login}/{repo.Name} ({(repo.Private ? "Private" : "Public")}) [{status}]";
})
```

**After:**
```csharp
.UseConverter(item =>
{
    var (repo, hasRenovate) = item;
    var status = hasRenovate ? "✓" : "✗";
    var ownerName = repo.Owner.Login.EscapeMarkup();
    var repoName = repo.Name.EscapeMarkup();
    var visibility = repo.Private ? "Private" : "Public";
    return $"{ownerName}/{repoName} ({visibility}) {status}";
})
```

### 2. Repository Table Display (Line 452-460)

**Before:**
```csharp
table.AddRow(
    repo.Name,
    $"[dim]{repo.Owner.Login}[/]",
    // ...
);
```

**After:**
```csharp
table.AddRow(
    repo.Name.EscapeMarkup(),
    $"[dim]{repo.Owner.Login.EscapeMarkup()}[/]",
    // ...
);
```

### 3. Action Preview (Lines 300-322)

**Before:**
```csharp
var repoList = string.Join(", ", repos.Select(r => $"{r.repo.Owner.Login}/{r.repo.Name}"));
```

**After:**
```csharp
var repoList = string.Join(", ", repos.Select(r =>
    $"{r.repo.Owner.Login.EscapeMarkup()}/{r.repo.Name.EscapeMarkup()}"));
```

### 4. Processing Status Messages (Lines 510-554)

**Before:**
```csharp
var owner = repo.Owner.Login;
AnsiConsole.MarkupLine($"[green]✓[/] [dim]{owner}/{repo.Name}:[/] Created");

// In catch block:
AnsiConsole.MarkupLine($"[red]✗[/] [dim]{repo.Owner.Login}/{repo.Name}:[/] {ex.Message}");
```

**After:**
```csharp
var owner = repo.Owner.Login;
var repoPath = $"{owner.EscapeMarkup()}/{repo.Name.EscapeMarkup()}";
AnsiConsole.MarkupLine($"[green]✓[/] [dim]{repoPath}:[/] Created");

// In catch block:
var errorMsg = ex.Message.EscapeMarkup();
var errorRepoPath = $"{repo.Owner.Login.EscapeMarkup()}/{repo.Name.EscapeMarkup()}";
AnsiConsole.MarkupLine($"[red]✗[/] [dim]{errorRepoPath}:[/] {errorMsg}");
```

## What Gets Escaped

1. **Repository Names** - User-defined, may contain special characters
2. **Owner/Organization Names** - User-defined, may contain special characters
3. **Error Messages** - System-generated, may contain special characters

## Testing

To test this fix with edge cases, try repositories with names like:
- `my-[app]-v2` (contains square brackets)
- `test<project>` (contains angle brackets)
- `app]broken` (unmatched bracket)
- Any name with `[`, `]`, `<`, `>` characters

## Prevention

### Best Practice

Always escape user-provided strings when using them in Spectre.Console markup:

```csharp
// ❌ BAD - Direct interpolation
AnsiConsole.MarkupLine($"[green]Processing {repoName}[/]");

// ✅ GOOD - Escaped
AnsiConsole.MarkupLine($"[green]Processing {repoName.EscapeMarkup()}[/]");
```

### When to Escape

Escape strings that come from:
- API responses (GitHub repository names, usernames, etc.)
- User input
- External data sources
- Exception messages
- Any dynamic content displayed with markup

### When NOT to Escape

Don't escape:
- Your own markup tags (e.g., `[green]`, `[/]`)
- Static strings without special characters
- Already-escaped content

## Additional Notes

### Display Format Changes

As part of the fix, I also improved the display format:

**Before:**
```
phmatray/my-repo (Private) [✓]
```

**After:**
```
phmatray/my-repo (Private) ✓
```

Removed square brackets around the status indicator since they could be confused with markup tags.

### Performance Impact

The `.EscapeMarkup()` method has minimal performance impact. It only processes characters that need escaping, making it efficient for most use cases.

## Related Documentation

- [Spectre.Console Markup Documentation](https://spectreconsole.net/markup)
- [Spectre.Console Escaping](https://spectreconsole.net/markup#escaping)

## Verification

Build and run the application:

```bash
dotnet build
dotnet run -- --help
```

All operations should work without markup parsing errors, even with repositories that have special characters in their names.

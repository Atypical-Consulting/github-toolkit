![GitHubRepoTools banner](.github/banner.png)

# GitHub Repo Tools

<!-- portfolio-badges:start -->
<!-- Identity -->
[![phmatray - GitHubRepoTools](https://img.shields.io/static/v1?label=phmatray&message=GitHubRepoTools&color=blue&logo=github)](https://github.com/phmatray/GitHubRepoTools)
![Top language](https://img.shields.io/github/languages/top/phmatray/GitHubRepoTools)
[![Stars](https://img.shields.io/github/stars/phmatray/GitHubRepoTools?style=social)](https://github.com/phmatray/GitHubRepoTools/stargazers)
[![Forks](https://img.shields.io/github/forks/phmatray/GitHubRepoTools?style=social)](https://github.com/phmatray/GitHubRepoTools/network/members)

<!-- Activity -->
[![Issues](https://img.shields.io/github/issues/phmatray/GitHubRepoTools)](https://github.com/phmatray/GitHubRepoTools/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/phmatray/GitHubRepoTools)](https://github.com/phmatray/GitHubRepoTools/pulls)
[![Last commit](https://img.shields.io/github/last-commit/phmatray/GitHubRepoTools)](https://github.com/phmatray/GitHubRepoTools/commits)
<!-- portfolio-badges:end -->

<!-- portfolio-toc:start -->

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Creating a GitHub Personal Access Token](#creating-a-github-personal-access-token)
- [Command Options](#command-options)
- [Configuration & Cache](#configuration--cache)
- [Renovate Configuration](#renovate-configuration)
- [Project Structure](#project-structure)
- [Dependencies](#dependencies)
- [Tech Stack](#tech-stack)
- [License](#license)
- [Contributing](#contributing)

<!-- portfolio-toc:end -->



A powerful Spectre CLI tool to manage Renovate configurations across your GitHub repositories.

## Features

### Core Features
- **GitHub Authentication** - Secure authentication using Personal Access Token (PAT)
- **Token Persistence** - Saves your GitHub token for future use (stored in `~/.gh-renovate/config.json`)
- **Organization Support** - Manage repositories from both your personal account and organizations
- **Interactive Selection** - Beautiful multi-select interface to choose repositories
- **Renovate Status Detection** - Shows which repositories already have Renovate enabled
- **Smart Branch Detection** - Automatically uses the repository's default branch

### Data Management
- **Caching** - Caches repository data with fetch timestamps (1-hour expiration)
- **Cache Refresh** - Force refresh cached data with `--refresh` flag
- **Last Fetch Display** - Shows when repository data was last fetched

### User Experience
- **Rich UI** - Beautiful panels, tables, and progress indicators
- **Summary Statistics** - Shows repository counts, Renovate status, and visibility breakdown
- **Action Preview** - Preview what will be created, updated, or skipped before proceeding
- **Dry-Run Mode** - Preview changes without applying them using `--dry-run`
- **Confirmation Prompts** - Asks for confirmation before making changes
- **Final Summary** - Shows detailed results after operations complete

### Operations
- **Force Update** - Update existing Renovate configurations with `--force`
- **Filtering** - Filter repositories by name using wildcards
- **Visibility Control** - Include/exclude private and public repositories
- **Progress Tracking** - Real-time progress display with detailed status messages

## Installation

```bash
cd GitHubRepoTools.Cli
dotnet build
```

## Usage

### First Run

The first time you run the tool, it will prompt for your GitHub token and ask if you want to save it:

```bash
dotnet run
```

### Subsequent Runs

After saving your token, simply run:

```bash
dotnet run
```

The tool will use your saved token and show cached repository information.

### Preview Mode (Dry-Run)

See what changes would be made without actually making them:

```bash
dotnet run -- --dry-run
```

### Force Update Existing Configs

Update repositories that already have Renovate enabled:

```bash
dotnet run -- --force
```

### Refresh Cache

Force refresh the repository cache:

```bash
dotnet run -- --refresh
```

### Filter Repositories

Filter repositories by name pattern (supports wildcards):

```bash
dotnet run -- --filter "my-project-*"
```

### Skip Private or Public Repos

Only include public repositories:

```bash
dotnet run -- --include-private false
```

Only include private repositories:

```bash
dotnet run -- --include-public false
```

### Skip Organization Repositories

```bash
dotnet run -- --include-orgs false
```

### Clear Saved Token

Remove saved token and cache:

```bash
dotnet run -- --clear-token
```

### Combined Options

Preview forced updates with refreshed data:

```bash
dotnet run -- --force --refresh --dry-run
```

## Creating a GitHub Personal Access Token

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select the following scopes:
   - `repo` - Full control of private repositories
   - `read:org` - Read organization membership (for org repos)
4. Click "Generate token"
5. Copy the token (you won't be able to see it again!)

## Command Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--token` | `-t` | - | GitHub Personal Access Token |
| `--include-private` | `-p` | `true` | Include private repositories |
| `--include-public` | - | `true` | Include public repositories |
| `--filter` | `-f` | - | Filter repositories by name (supports wildcards) |
| `--include-orgs` | `-o` | `true` | Include organization repositories |
| `--force` | - | `false` | Force update existing renovate.json files |
| `--refresh` | - | `false` | Refresh cached repository data |
| `--dry-run` | - | `false` | Preview changes without applying them |
| `--clear-token` | - | `false` | Clear saved token and cache |
| `--help` | `-h` | - | Show help information |
| `--version` | `-v` | - | Show version information |

## Configuration & Cache

The tool stores configuration and cache data in `~/.gh-renovate/`:

- `config.json` - Stores your GitHub Personal Access Token
- `cache.json` - Caches repository data (expires after 1 hour)

**Security Note**: The token is stored in plain text. Make sure your home directory has appropriate permissions. You can always clear the saved token using `--clear-token`.

## Renovate Configuration

The tool creates a `renovate.json` file with the following settings:

- **Schedule**: Monday before 6am UTC
- **Labels**: Adds "dependencies" label to PRs
- **Commit Messages**: Uses semantic commit format with "chore:" prefix
- **Rate Limiting**: Maximum 2 PRs per hour, 10 concurrent PRs
- **Automerge**: Disabled by default for all updates
- **Timezone**: UTC

You can customize the configuration by modifying the `CreateRenovateConfig()` method in `EnableRenovateCommand.cs`.

## Project Structure

```
GitHubRepoTools/
├── GitHubRepoTools.sln           # Solution file
└── GitHubRepoTools.Cli/          # CLI project
    ├── Commands/
    │   └── EnableRenovateCommand.cs  # Main command implementation
    ├── Program.cs                    # Entry point
    └── GitHubRepoTools.Cli.csproj   # Project file
```

## Dependencies

- [Spectre.Console](https://spectreconsole.net/) - Beautiful console UI
- [Spectre.Console.Cli](https://spectreconsole.net/) - Command-line framework
- [Octokit](https://github.com/octokit/octokit.net) - GitHub API client

<!-- portfolio-techstack:start -->

## Tech Stack

- **.NET 9**
- Octokit
- Spectre.Console
- Spectre.Console.Cli

<!-- portfolio-techstack:end -->

<!-- portfolio-roadmap:start -->

## Roadmap

Planned work and known limitations are tracked in the [open issues](https://github.com/phmatray/GitHubRepoTools/issues). Contributions toward them are welcome.

<!-- portfolio-roadmap:end -->

## License

MIT

---

<!-- portfolio-sections:start -->

## Contributing

Contributions are welcome. Open an issue first to discuss any significant change.

1. Fork the repository and create your branch (`git checkout -b feat/my-feature`)
2. Commit your changes (`git commit -m 'feat: ...'`)
3. Push the branch and open a Pull Request

<!-- portfolio-sections:end -->

![github-toolkit banner](.github/banner.png)

# GitHub Toolkit

<!-- portfolio-badges:start -->
<!-- Identity -->
[![Atypical-Consulting - github-toolkit](https://img.shields.io/static/v1?label=Atypical-Consulting&message=github-toolkit&color=blue&logo=github)](https://github.com/Atypical-Consulting/github-toolkit)
![Top language](https://img.shields.io/github/languages/top/Atypical-Consulting/github-toolkit)
[![Stars](https://img.shields.io/github/stars/Atypical-Consulting/github-toolkit?style=social)](https://github.com/Atypical-Consulting/github-toolkit/stargazers)
[![Forks](https://img.shields.io/github/forks/Atypical-Consulting/github-toolkit?style=social)](https://github.com/Atypical-Consulting/github-toolkit/network/members)
[![License](https://img.shields.io/github/license/Atypical-Consulting/github-toolkit)](https://github.com/Atypical-Consulting/github-toolkit/blob/HEAD/LICENSE)

<!-- Activity -->
[![Issues](https://img.shields.io/github/issues/Atypical-Consulting/github-toolkit)](https://github.com/Atypical-Consulting/github-toolkit/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/Atypical-Consulting/github-toolkit)](https://github.com/Atypical-Consulting/github-toolkit/pulls)
[![Last commit](https://img.shields.io/github/last-commit/Atypical-Consulting/github-toolkit)](https://github.com/Atypical-Consulting/github-toolkit/commits)
<!-- portfolio-badges:end -->

<!-- portfolio-toc:start -->

## Table of Contents

- [Tools](#tools)
- [Features](#features)
- [Usage](#usage)
- [History](#history)
- [License](#license)

<!-- portfolio-toc:end -->



> Tools for **managing your GitHub repositories at scale** — skills, a desktop app,
> a Renovate CLI, and a DevOps sync — consolidated in one place (full git history preserved).

## Tools

| Path | What it is | From |
|---|---|---|
| [`skills/`](skills) | **Claude Code skills** for auditing, managing and improving repositories | `Atypical-Consulting/GitHubSkills` ★ |
| [`automate/`](automate) | A **Tauri desktop app** for automating GitHub workflows | `Atypical-Consulting/GitHubAutomate` |
| [`repo-tools/`](repo-tools) | A **Spectre CLI** to manage Renovate configurations across repos, with caching and interactive multi-select | `phmatray/GitHubRepoTools` |
| [`devhub-sync/`](devhub-sync) | Synchronize repositories **between Azure DevOps and GitHub** via a Blazor Server UI | `phmatray/DevHubSync` |

## Features

- **Four complementary tools** — each solves a different repo-management chore
- **Mixed stacks** — Claude Code skills, TypeScript/Tauri, and .NET/C#
- **One home** — shared issues, discussions and history for all your GitHub tooling

## Usage

Each tool is self-contained in its folder — open it and follow its own README.

```bash
git clone https://github.com/Atypical-Consulting/github-toolkit.git
cd github-toolkit/repo-tools   # or skills / automate / devhub-sync
```

## History

Each folder was merged with **full git history preserved** (`git subtree`). The
original repositories are archived and redirect here.

<!-- portfolio-techstack:start -->

## Tech Stack

- **.NET 10 · .NET 9**
- MudBlazor
- Microsoft.TeamFoundationServer.Client
- Octokit
- LibGit2Sharp
- Microsoft.EntityFrameworkCore.Sqlite
- Microsoft.EntityFrameworkCore.Design
- Microsoft.EntityFrameworkCore.Tools
- Spectre.Console

<!-- portfolio-techstack:end -->

<!-- portfolio-roadmap:start -->

## Roadmap

Planned work and known limitations are tracked in the [open issues](https://github.com/Atypical-Consulting/github-toolkit/issues). Contributions toward them are welcome.

<!-- portfolio-roadmap:end -->

## License

MIT — see [`LICENSE`](LICENSE).

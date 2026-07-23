![GitHubAutomate banner](.github/banner.png)

# Tauri + React + Typescript

<!-- portfolio-badges:start -->
<!-- Identity -->
[![Atypical-Consulting - GitHubAutomate](https://img.shields.io/static/v1?label=Atypical-Consulting&message=GitHubAutomate&color=blue&logo=github)](https://github.com/Atypical-Consulting/GitHubAutomate)
![Top language](https://img.shields.io/github/languages/top/Atypical-Consulting/GitHubAutomate)
[![Stars](https://img.shields.io/github/stars/Atypical-Consulting/GitHubAutomate?style=social)](https://github.com/Atypical-Consulting/GitHubAutomate/stargazers)
[![Forks](https://img.shields.io/github/forks/Atypical-Consulting/GitHubAutomate?style=social)](https://github.com/Atypical-Consulting/GitHubAutomate/network/members)

<!-- Activity -->
[![Issues](https://img.shields.io/github/issues/Atypical-Consulting/GitHubAutomate)](https://github.com/Atypical-Consulting/GitHubAutomate/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/Atypical-Consulting/GitHubAutomate)](https://github.com/Atypical-Consulting/GitHubAutomate/pulls)
[![Last commit](https://img.shields.io/github/last-commit/Atypical-Consulting/GitHubAutomate)](https://github.com/Atypical-Consulting/GitHubAutomate/commits)
<!-- portfolio-badges:end -->


This template should help get you started developing with Tauri, React and Typescript in Vite.

GitHubAutomate is a Tauri 2 desktop app that scans GitHub repositories across configured accounts and orgs (`phmatray`, `Atypical-Consulting`), scores their health, and turns failures into an actionable backlog — with an optional MCP server so AI tools can query and act on the same data.

## Features

- **Repository scanning with live progress** — scans repos across configured GitHub accounts/orgs and emits `scan-progress` events as each repo completes.
- **Pluggable diagnostic engine** — weighted health scoring (Critical=3x, Warning=2x, Info=1x) from rules such as `HasReadme`, `HasLicense`, `HasDescription`, `HasTopics`, and `HasCiCd`.
- **Local SQLite cache** — repos and scan results are cached locally for instant startup, with SHA-based incremental rescans so unchanged repos are skipped.
- **Prioritized backlog generation** — failed diagnostics are rolled into a priority-scored backlog, with one-click GitHub issue creation per item.
- **GitHub OAuth Device Flow auth** — authenticates via device flow with OS keychain-backed token storage; the token never leaves the Rust backend.
- **Bundled MCP server** — a `github-automate-mcp` binary exposes scan/query/fix tools over stdio so AI assistants (Claude Code, Cursor, etc.) can inspect health scores and backlog items directly.
- **Rate limit awareness and scan cancellation** — checks GitHub API rate limits before operations and supports cancelling an in-progress scan.

## Usage

Run the desktop app in development mode (starts Vite and the Tauri/Rust shell together):

```bash
npm install
npm run tauri dev
```

Build a release bundle:

```bash
npm run build
npm run tauri build
```

The bundled MCP server exposes read/scan/fix tools over stdio. Point an MCP-compatible client (e.g. Claude Code) at the built binary:

```json
{
  "mcpServers": {
    "github-automate": {
      "command": "path/to/src-tauri/target/release/github-automate-mcp"
    }
  }
}
```

Once connected, tools such as `get_health_scores`, `get_backlog_items`, `get_diagnostic_rules`, `scan_repositories`, `scan_single_repository`, and `create_github_issue` become available to the AI client (some, like the fix pipeline, are still stubs per the current roadmap — see `.planning/PROJECT.md`).

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

<!-- portfolio-techstack:start -->

## Tech Stack

- **TypeScript**
- @tanstack/react-query
- @tauri-apps/api
- @tauri-apps/plugin-dialog
- @tauri-apps/plugin-opener
- @tauri-apps/plugin-store
- @tauri-apps/plugin-window-state
- class-variance-authority
- clsx

<!-- portfolio-techstack:end -->

## Roadmap

- [ ] Realtime health-ring and diagnostic-breakdown updates in the UI as each repo finishes scanning
- [ ] Finish the MCP server's read tools (`get_health_scores`, `get_backlog_items`, `get_diagnostic_rules`) against the real SQLite store, replacing the current stubs
- [ ] MCP fix pipeline: create issue → create branch → conventional commit → open PR
- [ ] MCP server on/off toggle in app settings
- [ ] MCP settings tools to change scan targets and toggle diagnostic rules remotely

See the [open issues](https://github.com/Atypical-Consulting/GitHubAutomate/issues) for details and to propose new ideas.

<!-- portfolio-sections:start -->

## Contributing

Contributions are welcome. Open an issue first to discuss any significant change.

1. Fork the repository and create your branch (`git checkout -b feat/my-feature`)
2. Commit your changes (`git commit -m 'feat: ...'`)
3. Push the branch and open a Pull Request

## License

No license has been declared for this repository yet. Until one is added, default copyright applies — see [choosealicense.com](https://choosealicense.com/) if you intend to open it up.

<!-- portfolio-sections:end -->

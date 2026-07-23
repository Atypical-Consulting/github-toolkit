![DevHubSync banner](.github/banner.png)

# DevHubSync

<!-- portfolio-badges:start -->
<!-- Identity -->
[![phmatray - DevHubSync](https://img.shields.io/static/v1?label=phmatray&message=DevHubSync&color=blue&logo=github)](https://github.com/phmatray/DevHubSync)
![Top language](https://img.shields.io/github/languages/top/phmatray/DevHubSync)
[![Stars](https://img.shields.io/github/stars/phmatray/DevHubSync?style=social)](https://github.com/phmatray/DevHubSync/stargazers)
[![Forks](https://img.shields.io/github/forks/phmatray/DevHubSync?style=social)](https://github.com/phmatray/DevHubSync/network/members)

<!-- Activity -->
[![Issues](https://img.shields.io/github/issues/phmatray/DevHubSync)](https://github.com/phmatray/DevHubSync/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/phmatray/DevHubSync)](https://github.com/phmatray/DevHubSync/pulls)
[![Last commit](https://img.shields.io/github/last-commit/phmatray/DevHubSync)](https://github.com/phmatray/DevHubSync/commits)
<!-- portfolio-badges:end -->


> Synchronize repositories between Azure DevOps and GitHub via a Blazor Server web interface.

## Description
DevHubSync is a Blazor Server application that automates the synchronization of repositories between Azure DevOps and GitHub. It provides a web interface for configuring sync operations, managing repository transfers, and tracking synchronization history using Entity Framework Core with SQLite.

## Features
- Bi-directional repository sync between Azure DevOps and GitHub
- Web interface built with Blazor Server
- Entity Framework Core + SQLite for persistence
- Azure DevOps and GitHub API integration (Octokit)
- Sync operation history and status tracking

## Getting Started
```bash
git clone https://github.com/phmatray/DevHubSync
cd DevHubSync
dotnet run --project DevHubSync.BlazorApp
```

## License
MIT
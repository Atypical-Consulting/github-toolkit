# DevHubSync

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
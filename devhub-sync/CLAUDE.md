# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevHubSync is a Blazor Server application that synchronizes repositories between Azure DevOps and GitHub. The application provides a web interface for configuring sync operations and managing repository transfers.

## Architecture

The application follows a service-oriented architecture with these key components:

- **Data Layer**: Entity Framework Core with SQLite database
  - `DevHubSyncDbContext`: Main database context
  - `Data/Entities/`: Database entities for projects, users, repositories, and sync operations
- **Services Layer**: Core business logic for DevOps, GitHub, and sync operations
  - `IDevOpsService/DevOpsService`: Azure DevOps integration using Microsoft.TeamFoundationServer.Client
  - `IGitHubService/GitHubService`: GitHub integration using Octokit
  - `ISyncService/SyncService`: Orchestrates sync operations between platforms with database persistence
- **Models**: Configuration and domain objects for repositories, sync operations, and settings
- **Components**: Blazor UI components using MudBlazor for the user interface with autocomplete functionality
- **Configuration**: Strongly-typed configuration classes for DevOps, GitHub, and sync settings

## Development Commands

### Build and Run
```bash
# Build the solution
dotnet build

# Run the application (development)
dotnet run --project DevHubSync.BlazorApp

# Run with specific profile
dotnet run --project DevHubSync.BlazorApp --launch-profile https
```

### Database Management
```bash
# Add new migration
dotnet ef migrations add <MigrationName> --project DevHubSync.BlazorApp

# Update database
dotnet ef database update --project DevHubSync.BlazorApp

# Remove last migration
dotnet ef migrations remove --project DevHubSync.BlazorApp
```

### Testing
```bash
# Run tests (if any exist)
dotnet test
```

## Key Dependencies

- **MudBlazor** (8.7.0): UI component library
- **Microsoft.TeamFoundationServer.Client** (19.225.1): Azure DevOps API client
- **Octokit** (14.0.0): GitHub API client  
- **LibGit2Sharp** (0.31.0): Git operations library
- **Microsoft.EntityFrameworkCore.Sqlite** (9.0.6): SQLite database provider
- **Microsoft.EntityFrameworkCore.Design** (9.0.6): EF Core design-time tools
- **Microsoft.EntityFrameworkCore.Tools** (9.0.6): EF Core command-line tools

## Configuration

The application uses appsettings.json for configuration with sections for:
- DevOps: Organization URL, PAT, default project
- GitHub: PAT, default owner, repository privacy settings
- Sync: Auto-sync settings, intervals, and feature flags

Personal Access Tokens must be configured in appsettings.json or user secrets for the application to function.

## Database

The application uses SQLite with Entity Framework Core for data persistence:
- **Database file**: `devhubsync.db` (created automatically)
- **Entities**: DevOps projects, GitHub users, repositories, sync operations, and sync logs
- **Auto-creation**: Database is created automatically on first run via `EnsureCreated()`
- **Migrations**: Initial migration `InitialCreate` has been applied
- **Sync tracking**: All sync operations and their logs are persisted

## Development URLs

- HTTP: http://localhost:5246
- HTTPS: https://localhost:7093

## Database Population Workflow

To populate the database with repositories and start using the sync functionality:

1. **Configure API Access**: Ensure Personal Access Tokens are configured in appsettings.json
2. **Populate DevOps Data**: Navigate to Repositories page and click "Sync DevOps Projects"
3. **Populate GitHub Data**: Enter GitHub owner and click "Sync GitHub Repos"
4. **Enable Sync**: Use the toggle switches in the data grid to enable sync for specific repositories
5. **Start Sync Operations**: Use the Sync Operations page with improved autocomplete functionality

## Repository Management

The Repositories page provides:
- **MudDataGrid** with pagination, sorting, and filtering
- **Search functionality** across repository names, descriptions, and owners
- **Sync status toggles** for individual repositories
- **Database population** from external APIs (DevOps and GitHub)
- **Repository management** (view, sync, delete)

## Current Limitations

- GitHub to DevOps sync is not fully implemented (DevHubSync.BlazorApp/Services/SyncService.cs:150)
- Pull request and issue syncing is disabled by default
- DevOps project details are basic (only name and ID from API)
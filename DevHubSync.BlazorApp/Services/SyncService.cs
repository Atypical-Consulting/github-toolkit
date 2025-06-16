using DevHubSync.BlazorApp.Models;
using DevHubSync.BlazorApp.Data;
using DevHubSync.BlazorApp.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevHubSync.BlazorApp.Services;

public class SyncService : ISyncService
{
    private readonly IDevOpsService _devOpsService;
    private readonly IGitHubService _gitHubService;
    private readonly DevHubSyncDbContext _context;
    
    public event EventHandler<SyncOperation>? SyncProgressChanged;

    public SyncService(IDevOpsService devOpsService, IGitHubService gitHubService, DevHubSyncDbContext context)
    {
        _devOpsService = devOpsService;
        _gitHubService = gitHubService;
        _context = context;
    }

    public async Task<SyncOperation> SyncDevOpsToGitHubAsync(string devOpsProject, string devOpsRepoId, string gitHubOwner, string? gitHubRepoName = null)
    {
        var operation = new SyncOperation
        {
            SourceRepositoryId = devOpsRepoId,
            SourceType = RepositorySource.DevOps,
            TargetType = RepositorySource.GitHub,
            Direction = SyncDirection.DevOpsToGitHub,
            StartTime = DateTime.UtcNow,
            Status = SyncOperationStatus.InProgress
        };

        var operationEntity = new SyncOperationEntity
        {
            OperationId = operation.Id,
            Direction = operation.Direction,
            StartTime = operation.StartTime,
            Status = operation.Status
        };

        _context.SyncOperations.Add(operationEntity);
        await _context.SaveChangesAsync();
        
        await LogOperationAsync(operation, operationEntity, "Starting DevOps to GitHub sync", Models.LogLevel.Info);
        
        try
        {
            var devOpsRepo = await _devOpsService.GetRepositoryAsync(devOpsProject, devOpsRepoId);
            if (devOpsRepo == null)
            {
                throw new Exception("DevOps repository not found");
            }
            
            await LogOperationAsync(operation, operationEntity, $"Found DevOps repository: {devOpsRepo.Name}", Models.LogLevel.Info);
            
            var branches = await _devOpsService.GetBranchesAsync(devOpsProject, devOpsRepoId);
            var defaultBranch = devOpsRepo.DefaultBranch;
            
            await LogOperationAsync(operation, operationEntity, $"Downloading repository content from branch: {defaultBranch}", Models.LogLevel.Info);
            var zipContent = await _devOpsService.DownloadRepositoryAsync(devOpsProject, devOpsRepoId, defaultBranch);
            
            var targetRepoName = gitHubRepoName ?? devOpsRepo.Name;
            var gitHubRepo = await _gitHubService.GetRepositoryAsync(gitHubOwner, targetRepoName);
            
            if (gitHubRepo == null)
            {
                await LogOperationAsync(operation, operationEntity, $"Creating new GitHub repository: {targetRepoName}", Models.LogLevel.Info);
                gitHubRepo = await _gitHubService.CreateRepositoryAsync(
                    targetRepoName,
                    devOpsRepo.Description,
                    true
                );
            }
            
            operation.TargetRepositoryId = gitHubRepo.Id;
            
            await LogOperationAsync(operation, operationEntity, "Uploading content to GitHub", Models.LogLevel.Info);
            await _gitHubService.UploadRepositoryAsync(
                gitHubOwner,
                targetRepoName,
                zipContent,
                gitHubRepo.DefaultBranch,
                $"Sync from DevOps: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}"
            );
            
            operation.Status = SyncOperationStatus.Completed;
            operation.EndTime = DateTime.UtcNow;
            operationEntity.Status = SyncOperationStatus.Completed;
            operationEntity.EndTime = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await LogOperationAsync(operation, operationEntity, "Sync completed successfully", Models.LogLevel.Info);
        }
        catch (Exception ex)
        {
            operation.Status = SyncOperationStatus.Failed;
            operation.ErrorMessage = ex.Message;
            operation.EndTime = DateTime.UtcNow;
            operationEntity.Status = SyncOperationStatus.Failed;
            operationEntity.ErrorMessage = ex.Message;
            operationEntity.EndTime = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await LogOperationAsync(operation, operationEntity, $"Sync failed: {ex.Message}", Models.LogLevel.Error);
        }
        
        SyncProgressChanged?.Invoke(this, operation);
        return operation;
    }

    public async Task<SyncOperation> SyncGitHubToDevOpsAsync(string gitHubOwner, string gitHubRepoName, string devOpsProject, string devOpsRepoId)
    {
        var operation = new SyncOperation
        {
            SourceRepositoryId = $"{gitHubOwner}/{gitHubRepoName}",
            TargetRepositoryId = devOpsRepoId,
            SourceType = RepositorySource.GitHub,
            TargetType = RepositorySource.DevOps,
            Direction = SyncDirection.GitHubToDevOps,
            StartTime = DateTime.UtcNow,
            Status = SyncOperationStatus.InProgress
        };

        var operationEntity = new SyncOperationEntity
        {
            OperationId = operation.Id,
            Direction = operation.Direction,
            StartTime = operation.StartTime,
            Status = operation.Status
        };

        _context.SyncOperations.Add(operationEntity);
        await _context.SaveChangesAsync();
        
        await LogOperationAsync(operation, operationEntity, "Starting GitHub to DevOps sync", Models.LogLevel.Info);
        
        try
        {
            var gitHubRepo = await _gitHubService.GetRepositoryAsync(gitHubOwner, gitHubRepoName);
            if (gitHubRepo == null)
            {
                throw new Exception("GitHub repository not found");
            }
            
            await LogOperationAsync(operation, operationEntity, $"Found GitHub repository: {gitHubRepo.Name}", Models.LogLevel.Info);
            
            await LogOperationAsync(operation, operationEntity, $"Downloading repository content from branch: {gitHubRepo.DefaultBranch}", Models.LogLevel.Info);
            var zipContent = await _gitHubService.DownloadRepositoryAsync(gitHubOwner, gitHubRepoName, gitHubRepo.DefaultBranch);
            
            await LogOperationAsync(operation, operationEntity, "GitHub to DevOps sync is not yet implemented", Models.LogLevel.Warning);
            
            operation.Status = SyncOperationStatus.Completed;
            operation.EndTime = DateTime.UtcNow;
            operationEntity.Status = SyncOperationStatus.Completed;
            operationEntity.EndTime = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await LogOperationAsync(operation, operationEntity, "Sync completed (partial implementation)", Models.LogLevel.Info);
        }
        catch (Exception ex)
        {
            operation.Status = SyncOperationStatus.Failed;
            operation.ErrorMessage = ex.Message;
            operation.EndTime = DateTime.UtcNow;
            operationEntity.Status = SyncOperationStatus.Failed;
            operationEntity.ErrorMessage = ex.Message;
            operationEntity.EndTime = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await LogOperationAsync(operation, operationEntity, $"Sync failed: {ex.Message}", Models.LogLevel.Error);
        }
        
        SyncProgressChanged?.Invoke(this, operation);
        return operation;
    }

    public async Task<List<SyncOperation>> GetSyncHistoryAsync()
    {
        var operations = await _context.SyncOperations
            .Include(s => s.Logs)
            .OrderByDescending(s => s.StartTime)
            .ToListAsync();

        return operations.Select(MapToSyncOperation).ToList();
    }

    public async Task<SyncOperation?> GetSyncOperationAsync(string operationId)
    {
        var operation = await _context.SyncOperations
            .Include(s => s.Logs)
            .FirstOrDefaultAsync(s => s.OperationId == operationId);

        return operation != null ? MapToSyncOperation(operation) : null;
    }

    // Repository management methods
    public async Task<List<RepositoryEntity>> GetRepositoriesAsync()
    {
        return await _context.Repositories
            .Include(r => r.DevOpsProject)
            .Include(r => r.GitHubUser)
            .ToListAsync();
    }

    public async Task<List<RepositoryEntity>> GetDevOpsRepositoriesAsync()
    {
        return await _context.Repositories
            .Include(r => r.DevOpsProject)
            .Where(r => r.Source == RepositorySource.DevOps)
            .ToListAsync();
    }

    public async Task<List<RepositoryEntity>> GetGitHubRepositoriesAsync()
    {
        return await _context.Repositories
            .Include(r => r.GitHubUser)
            .Where(r => r.Source == RepositorySource.GitHub)
            .ToListAsync();
    }

    public async Task<RepositoryEntity?> GetRepositoryAsync(int id)
    {
        return await _context.Repositories
            .Include(r => r.DevOpsProject)
            .Include(r => r.GitHubUser)
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    public async Task<RepositoryEntity> CreateOrUpdateRepositoryAsync(RepositoryEntity repository)
    {
        var existingRepo = await _context.Repositories
            .FirstOrDefaultAsync(r => r.ExternalId == repository.ExternalId && r.Source == repository.Source);

        if (existingRepo != null)
        {
            existingRepo.Name = repository.Name;
            existingRepo.Description = repository.Description;
            existingRepo.Url = repository.Url;
            existingRepo.DefaultBranch = repository.DefaultBranch;
            existingRepo.SyncEnabled = repository.SyncEnabled;
            existingRepo.LastUpdated = repository.LastUpdated;
            _context.Repositories.Update(existingRepo);
            await _context.SaveChangesAsync();
            return existingRepo;
        }
        else
        {
            _context.Repositories.Add(repository);
            await _context.SaveChangesAsync();
            return repository;
        }
    }

    public async Task<bool> DeleteRepositoryAsync(int id)
    {
        var repository = await _context.Repositories.FindAsync(id);
        if (repository == null) return false;

        _context.Repositories.Remove(repository);
        await _context.SaveChangesAsync();
        return true;
    }

    // DevOps Projects management
    public async Task<List<DevOpsProject>> GetDevOpsProjectsAsync()
    {
        return await _context.DevOpsProjects.ToListAsync();
    }

    public async Task<DevOpsProject?> GetDevOpsProjectAsync(int id)
    {
        return await _context.DevOpsProjects.FindAsync(id);
    }

    public async Task<DevOpsProject> CreateOrUpdateDevOpsProjectAsync(DevOpsProject project)
    {
        var existingProject = await _context.DevOpsProjects
            .FirstOrDefaultAsync(p => p.ProjectId == project.ProjectId && p.OrganizationUrl == project.OrganizationUrl);

        if (existingProject != null)
        {
            existingProject.Name = project.Name;
            existingProject.Description = project.Description;
            _context.DevOpsProjects.Update(existingProject);
            await _context.SaveChangesAsync();
            return existingProject;
        }
        else
        {
            _context.DevOpsProjects.Add(project);
            await _context.SaveChangesAsync();
            return project;
        }
    }

    // GitHub Users management
    public async Task<List<GitHubUser>> GetGitHubUsersAsync()
    {
        return await _context.GitHubUsers.ToListAsync();
    }

    public async Task<GitHubUser?> GetGitHubUserAsync(int id)
    {
        return await _context.GitHubUsers.FindAsync(id);
    }

    public async Task<GitHubUser> CreateOrUpdateGitHubUserAsync(GitHubUser user)
    {
        var existingUser = await _context.GitHubUsers
            .FirstOrDefaultAsync(u => u.Username == user.Username);

        if (existingUser != null)
        {
            existingUser.DisplayName = user.DisplayName;
            existingUser.Email = user.Email;
            existingUser.AvatarUrl = user.AvatarUrl;
            _context.GitHubUsers.Update(existingUser);
            await _context.SaveChangesAsync();
            return existingUser;
        }
        else
        {
            _context.GitHubUsers.Add(user);
            await _context.SaveChangesAsync();
            return user;
        }
    }

    private async Task LogOperationAsync(SyncOperation operation, SyncOperationEntity operationEntity, string message, Models.LogLevel level)
    {
        var log = new SyncLog
        {
            Timestamp = DateTime.UtcNow,
            Message = message,
            Level = level
        };

        operation.Logs.Add(log);

        var logEntity = new SyncLogEntity
        {
            SyncOperationId = operationEntity.Id,
            Timestamp = log.Timestamp,
            Message = log.Message,
            Level = log.Level
        };

        _context.SyncLogs.Add(logEntity);
        await _context.SaveChangesAsync();
        
        SyncProgressChanged?.Invoke(this, operation);
    }

    // Data population methods
    public async Task<int> PopulateDevOpsProjectsAsync()
    {
        var projects = await _devOpsService.GetProjectsAsync();
        int addedCount = 0;

        foreach (var projectName in projects)
        {
            // Note: We need to get more project details from the DevOps service
            // For now, we'll create basic project entries
            var project = new DevOpsProject
            {
                ProjectId = projectName, // This should ideally be the actual project ID
                Name = projectName,
                Description = string.Empty,
                OrganizationUrl = string.Empty // This should come from configuration
            };

            await CreateOrUpdateDevOpsProjectAsync(project);
            addedCount++;
        }

        return addedCount;
    }

    public async Task<int> PopulateDevOpsRepositoriesAsync(string projectId)
    {
        var project = await _context.DevOpsProjects
            .FirstOrDefaultAsync(p => p.ProjectId == projectId);
        
        if (project == null)
            throw new ArgumentException($"DevOps project with ID {projectId} not found in database");

        var repositories = await _devOpsService.GetRepositoriesAsync(projectId);
        int addedCount = 0;

        foreach (var repo in repositories)
        {
            var repositoryEntity = new RepositoryEntity
            {
                ExternalId = repo.Id,
                Name = repo.Name,
                Description = repo.Description,
                Url = repo.Url,
                DefaultBranch = repo.DefaultBranch,
                Source = RepositorySource.DevOps,
                DevOpsProjectId = project.Id,
                LastUpdated = repo.LastUpdated
            };

            await CreateOrUpdateRepositoryAsync(repositoryEntity);
            addedCount++;
        }

        return addedCount;
    }

    public async Task<int> PopulateGitHubRepositoriesAsync(string? owner = null)
    {
        GitHubUser? user = null;
        
        if (!string.IsNullOrEmpty(owner))
        {
            user = await PopulateGitHubUserAsync(owner);
        }

        var repositories = await _gitHubService.GetRepositoriesAsync(owner);
        int addedCount = 0;

        foreach (var repo in repositories)
        {
            var repositoryEntity = new RepositoryEntity
            {
                ExternalId = repo.Id,
                Name = repo.Name,
                Description = repo.Description,
                Url = repo.Url,
                DefaultBranch = repo.DefaultBranch,
                Source = RepositorySource.GitHub,
                GitHubUserId = user?.Id,
                IsPrivate = repo.IsPrivate,
                Language = repo.Language,
                Stars = repo.Stars,
                Forks = repo.Forks,
                LastUpdated = repo.LastUpdated
            };

            await CreateOrUpdateRepositoryAsync(repositoryEntity);
            addedCount++;
        }

        return addedCount;
    }

    public async Task<GitHubUser> PopulateGitHubUserAsync(string username)
    {
        // Fetch actual user details from GitHub API
        var apiUser = await _gitHubService.GetUserAsync(username);
        
        var user = apiUser ?? new GitHubUser
        {
            Username = username,
            DisplayName = username,
            Email = string.Empty,
            AvatarUrl = string.Empty
        };

        return await CreateOrUpdateGitHubUserAsync(user);
    }

    private SyncOperation MapToSyncOperation(SyncOperationEntity entity)
    {
        return new SyncOperation
        {
            Id = entity.OperationId,
            SourceRepositoryId = entity.SourceRepository?.ExternalId ?? string.Empty,
            TargetRepositoryId = entity.TargetRepository?.ExternalId,
            SourceType = entity.SourceRepository?.Source ?? RepositorySource.DevOps,
            TargetType = entity.TargetRepository?.Source ?? RepositorySource.GitHub,
            Direction = entity.Direction,
            StartTime = entity.StartTime,
            EndTime = entity.EndTime,
            Status = entity.Status,
            ErrorMessage = entity.ErrorMessage,
            Logs = entity.Logs.Select(l => new SyncLog
            {
                Timestamp = l.Timestamp,
                Message = l.Message,
                Level = l.Level
            }).ToList()
        };
    }
}
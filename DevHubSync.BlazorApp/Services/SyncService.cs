using DevHubSync.BlazorApp.Models;

namespace DevHubSync.BlazorApp.Services;

public class SyncService : ISyncService
{
    private readonly IDevOpsService _devOpsService;
    private readonly IGitHubService _gitHubService;
    private readonly List<SyncOperation> _syncHistory = new();
    
    public event EventHandler<SyncOperation>? SyncProgressChanged;

    public SyncService(IDevOpsService devOpsService, IGitHubService gitHubService)
    {
        _devOpsService = devOpsService;
        _gitHubService = gitHubService;
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

        _syncHistory.Add(operation);
        LogOperation(operation, "Starting DevOps to GitHub sync", Models.LogLevel.Info);
        
        try
        {
            var devOpsRepo = await _devOpsService.GetRepositoryAsync(devOpsProject, devOpsRepoId);
            if (devOpsRepo == null)
            {
                throw new Exception("DevOps repository not found");
            }
            
            LogOperation(operation, $"Found DevOps repository: {devOpsRepo.Name}", Models.LogLevel.Info);
            
            var branches = await _devOpsService.GetBranchesAsync(devOpsProject, devOpsRepoId);
            var defaultBranch = devOpsRepo.DefaultBranch;
            
            LogOperation(operation, $"Downloading repository content from branch: {defaultBranch}", Models.LogLevel.Info);
            var zipContent = await _devOpsService.DownloadRepositoryAsync(devOpsProject, devOpsRepoId, defaultBranch);
            
            var targetRepoName = gitHubRepoName ?? devOpsRepo.Name;
            var gitHubRepo = await _gitHubService.GetRepositoryAsync(gitHubOwner, targetRepoName);
            
            if (gitHubRepo == null)
            {
                LogOperation(operation, $"Creating new GitHub repository: {targetRepoName}", Models.LogLevel.Info);
                gitHubRepo = await _gitHubService.CreateRepositoryAsync(
                    targetRepoName,
                    devOpsRepo.Description,
                    true
                );
            }
            
            operation.TargetRepositoryId = gitHubRepo.Id;
            
            LogOperation(operation, "Uploading content to GitHub", Models.LogLevel.Info);
            await _gitHubService.UploadRepositoryAsync(
                gitHubOwner,
                targetRepoName,
                zipContent,
                gitHubRepo.DefaultBranch,
                $"Sync from DevOps: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}"
            );
            
            operation.Status = SyncOperationStatus.Completed;
            operation.EndTime = DateTime.UtcNow;
            LogOperation(operation, "Sync completed successfully", Models.LogLevel.Info);
        }
        catch (Exception ex)
        {
            operation.Status = SyncOperationStatus.Failed;
            operation.ErrorMessage = ex.Message;
            operation.EndTime = DateTime.UtcNow;
            LogOperation(operation, $"Sync failed: {ex.Message}", Models.LogLevel.Error);
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

        _syncHistory.Add(operation);
        LogOperation(operation, "Starting GitHub to DevOps sync", Models.LogLevel.Info);
        
        try
        {
            var gitHubRepo = await _gitHubService.GetRepositoryAsync(gitHubOwner, gitHubRepoName);
            if (gitHubRepo == null)
            {
                throw new Exception("GitHub repository not found");
            }
            
            LogOperation(operation, $"Found GitHub repository: {gitHubRepo.Name}", Models.LogLevel.Info);
            
            LogOperation(operation, $"Downloading repository content from branch: {gitHubRepo.DefaultBranch}", Models.LogLevel.Info);
            var zipContent = await _gitHubService.DownloadRepositoryAsync(gitHubOwner, gitHubRepoName, gitHubRepo.DefaultBranch);
            
            LogOperation(operation, "GitHub to DevOps sync is not yet implemented", Models.LogLevel.Warning);
            
            operation.Status = SyncOperationStatus.Completed;
            operation.EndTime = DateTime.UtcNow;
            LogOperation(operation, "Sync completed (partial implementation)", Models.LogLevel.Info);
        }
        catch (Exception ex)
        {
            operation.Status = SyncOperationStatus.Failed;
            operation.ErrorMessage = ex.Message;
            operation.EndTime = DateTime.UtcNow;
            LogOperation(operation, $"Sync failed: {ex.Message}", Models.LogLevel.Error);
        }
        
        SyncProgressChanged?.Invoke(this, operation);
        return operation;
    }

    public Task<List<SyncOperation>> GetSyncHistoryAsync()
    {
        return Task.FromResult(_syncHistory.OrderByDescending(o => o.StartTime).ToList());
    }

    public Task<SyncOperation?> GetSyncOperationAsync(string operationId)
    {
        return Task.FromResult(_syncHistory.FirstOrDefault(o => o.Id == operationId));
    }

    private void LogOperation(SyncOperation operation, string message, Models.LogLevel level)
    {
        operation.Logs.Add(new SyncLog
        {
            Timestamp = DateTime.UtcNow,
            Message = message,
            Level = level
        });
        
        SyncProgressChanged?.Invoke(this, operation);
    }
}
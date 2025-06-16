using DevHubSync.BlazorApp.Models;

namespace DevHubSync.BlazorApp.Services;

public interface ISyncService
{
    Task<SyncOperation> SyncDevOpsToGitHubAsync(string devOpsProject, string devOpsRepoId, string gitHubOwner, string? gitHubRepoName = null);
    Task<SyncOperation> SyncGitHubToDevOpsAsync(string gitHubOwner, string gitHubRepoName, string devOpsProject, string devOpsRepoId);
    Task<List<SyncOperation>> GetSyncHistoryAsync();
    Task<SyncOperation?> GetSyncOperationAsync(string operationId);
    event EventHandler<SyncOperation>? SyncProgressChanged;
}
using DevHubSync.BlazorApp.Models;
using DevHubSync.BlazorApp.Data.Entities;

namespace DevHubSync.BlazorApp.Services;

public interface ISyncService
{
    Task<SyncOperation> SyncDevOpsToGitHubAsync(string devOpsProject, string devOpsRepoId, string gitHubOwner, string? gitHubRepoName = null);
    Task<SyncOperation> SyncGitHubToDevOpsAsync(string gitHubOwner, string gitHubRepoName, string devOpsProject, string devOpsRepoId);
    Task<List<SyncOperation>> GetSyncHistoryAsync();
    Task<SyncOperation?> GetSyncOperationAsync(string operationId);
    
    // Repository management
    Task<List<RepositoryEntity>> GetRepositoriesAsync();
    Task<List<RepositoryEntity>> GetDevOpsRepositoriesAsync();
    Task<List<RepositoryEntity>> GetGitHubRepositoriesAsync();
    Task<RepositoryEntity?> GetRepositoryAsync(int id);
    Task<RepositoryEntity> CreateOrUpdateRepositoryAsync(RepositoryEntity repository);
    Task<bool> DeleteRepositoryAsync(int id);
    
    // DevOps Projects management
    Task<List<DevOpsProject>> GetDevOpsProjectsAsync();
    Task<DevOpsProject?> GetDevOpsProjectAsync(int id);
    Task<DevOpsProject> CreateOrUpdateDevOpsProjectAsync(DevOpsProject project);
    
    // GitHub Users management
    Task<List<GitHubUser>> GetGitHubUsersAsync();
    Task<GitHubUser?> GetGitHubUserAsync(int id);
    Task<GitHubUser> CreateOrUpdateGitHubUserAsync(GitHubUser user);
    
    // Data population from external APIs
    Task<int> PopulateDevOpsProjectsAsync();
    Task<int> PopulateDevOpsRepositoriesAsync(string projectId);
    Task<int> PopulateGitHubRepositoriesAsync(string? owner = null);
    Task<GitHubUser> PopulateGitHubUserAsync(string username);
    
    event EventHandler<SyncOperation>? SyncProgressChanged;
}
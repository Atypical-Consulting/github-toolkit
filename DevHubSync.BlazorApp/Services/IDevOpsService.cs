using DevHubSync.BlazorApp.Models;

namespace DevHubSync.BlazorApp.Services;

public interface IDevOpsService
{
    Task<List<DevOpsRepository>> GetRepositoriesAsync(string projectName);
    Task<DevOpsRepository?> GetRepositoryAsync(string projectName, string repositoryId);
    Task<byte[]> DownloadRepositoryAsync(string projectName, string repositoryId, string branch);
    Task<bool> TestConnectionAsync();
    Task<List<string>> GetProjectsAsync();
    Task<List<string>> GetBranchesAsync(string projectName, string repositoryId);
    Task<List<DevOpsCommit>> GetCommitsAsync(string projectName, string repositoryId, string? branch = null, int top = 100);
    Task<DevOpsCommit?> GetCommitAsync(string projectName, string repositoryId, string commitId);
    Task<byte[]> GetCommitContentAsync(string projectName, string repositoryId, string commitId);
}
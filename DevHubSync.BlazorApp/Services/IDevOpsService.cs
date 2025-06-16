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
}
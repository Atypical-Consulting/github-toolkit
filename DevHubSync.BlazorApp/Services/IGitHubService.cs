using DevHubSync.BlazorApp.Models;
using DevHubSync.BlazorApp.Data.Entities;

namespace DevHubSync.BlazorApp.Services;

public interface IGitHubService
{
    Task<List<GitHubRepository>> GetRepositoriesAsync(string? owner = null);
    Task<GitHubRepository?> GetRepositoryAsync(string owner, string name);
    Task<GitHubRepository> CreateRepositoryAsync(string name, string description, bool isPrivate);
    Task<byte[]> DownloadRepositoryAsync(string owner, string name, string branch);
    Task<bool> TestConnectionAsync();
    Task<List<string>> GetBranchesAsync(string owner, string name);
    Task UploadRepositoryAsync(string owner, string name, byte[] zipContent, string branch, string commitMessage);
    Task<GitHubUser?> GetUserAsync(string username);
    Task<GitHubUser?> GetCurrentUserAsync();
    Task<string> CreateCommitWithAuthorAsync(string owner, string name, string branch, Dictionary<string, string> files, string commitMessage, string authorName, string authorEmail, DateTime authorDate);
    Task<string> GetLatestCommitShaAsync(string owner, string name, string branch);
}
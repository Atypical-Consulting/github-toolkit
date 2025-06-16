using System.IO.Compression;
using DevHubSync.BlazorApp.Models;
using Octokit;

namespace DevHubSync.BlazorApp.Services;

public class GitHubService : IGitHubService
{
    private readonly IConfiguration _configuration;
    private GitHubClient? _client;

    public GitHubService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    private void EnsureClient()
    {
        if (_client == null)
        {
            var pat = _configuration["GitHub:PersonalAccessToken"] ?? string.Empty;
            
            if (string.IsNullOrEmpty(pat))
            {
                throw new InvalidOperationException("GitHub configuration is missing");
            }

            _client = new GitHubClient(new ProductHeaderValue("DevHubSync"))
            {
                Credentials = new Credentials(pat)
            };
        }
    }

    public async Task<List<GitHubRepository>> GetRepositoriesAsync(string? owner = null)
    {
        EnsureClient();
        
        IReadOnlyList<Octokit.Repository> repositories;
        
        if (string.IsNullOrEmpty(owner))
        {
            repositories = await _client!.Repository.GetAllForCurrent();
        }
        else
        {
            repositories = await _client!.Repository.GetAllForUser(owner);
        }

        return repositories.Select(repo => new GitHubRepository
        {
            Id = repo.Id.ToString(),
            Name = repo.Name,
            Description = repo.Description ?? string.Empty,
            Url = repo.CloneUrl,
            DefaultBranch = repo.DefaultBranch,
            LastUpdated = repo.UpdatedAt.UtcDateTime,
            Source = RepositorySource.GitHub,
            SourceId = repo.Id.ToString(),
            Owner = repo.Owner.Login,
            IsPrivate = repo.Private,
            Language = repo.Language,
            Stars = repo.StargazersCount,
            Forks = repo.ForksCount
        }).ToList();
    }

    public async Task<GitHubRepository?> GetRepositoryAsync(string owner, string name)
    {
        EnsureClient();
        
        try
        {
            var repo = await _client!.Repository.Get(owner, name);
            
            return new GitHubRepository
            {
                Id = repo.Id.ToString(),
                Name = repo.Name,
                Description = repo.Description ?? string.Empty,
                Url = repo.CloneUrl,
                DefaultBranch = repo.DefaultBranch,
                LastUpdated = repo.UpdatedAt.UtcDateTime,
                Source = RepositorySource.GitHub,
                SourceId = repo.Id.ToString(),
                Owner = repo.Owner.Login,
                IsPrivate = repo.Private,
                Language = repo.Language,
                Stars = repo.StargazersCount,
                Forks = repo.ForksCount
            };
        }
        catch
        {
            return null;
        }
    }

    public async Task<GitHubRepository> CreateRepositoryAsync(string name, string description, bool isPrivate)
    {
        EnsureClient();
        
        var newRepo = new NewRepository(name)
        {
            Description = description,
            Private = isPrivate,
            AutoInit = true
        };

        var repo = await _client!.Repository.Create(newRepo);
        
        return new GitHubRepository
        {
            Id = repo.Id.ToString(),
            Name = repo.Name,
            Description = repo.Description ?? string.Empty,
            Url = repo.CloneUrl,
            DefaultBranch = repo.DefaultBranch,
            LastUpdated = repo.UpdatedAt.UtcDateTime,
            Source = RepositorySource.GitHub,
            SourceId = repo.Id.ToString(),
            Owner = repo.Owner.Login,
            IsPrivate = repo.Private,
            Language = repo.Language,
            Stars = repo.StargazersCount,
            Forks = repo.ForksCount
        };
    }

    public async Task<byte[]> DownloadRepositoryAsync(string owner, string name, string branch)
    {
        EnsureClient();
        
        var archiveUrl = $"https://api.github.com/repos/{owner}/{name}/zipball/{branch}";
        var response = await _client!.Connection.Get<byte[]>(new Uri(archiveUrl), null, "application/vnd.github.v3+json");
        
        return response.Body;
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            EnsureClient();
            var user = await _client!.User.Current();
            return user != null;
        }
        catch
        {
            return false;
        }
    }

    public async Task<List<string>> GetBranchesAsync(string owner, string name)
    {
        EnsureClient();
        var branches = await _client!.Repository.Branch.GetAll(owner, name);
        return branches.Select(b => b.Name).ToList();
    }

    public async Task UploadRepositoryAsync(string owner, string name, byte[] zipContent, string branch, string commitMessage)
    {
        EnsureClient();
        
        using var memoryStream = new MemoryStream(zipContent);
        using var archive = new ZipArchive(memoryStream, ZipArchiveMode.Read);
        
        var baseTree = await _client!.Git.Tree.Get(owner, name, branch);
        var newTree = new NewTree { BaseTree = baseTree.Sha };
        
        foreach (var entry in archive.Entries.Where(e => !string.IsNullOrEmpty(e.Name)))
        {
            using var entryStream = entry.Open();
            using var reader = new StreamReader(entryStream);
            var content = await reader.ReadToEndAsync();
            
            var blob = new NewBlob
            {
                Content = content,
                Encoding = EncodingType.Utf8
            };
            
            var blobResult = await _client.Git.Blob.Create(owner, name, blob);
            
            newTree.Tree.Add(new NewTreeItem
            {
                Path = entry.FullName,
                Mode = "100644",
                Type = TreeType.Blob,
                Sha = blobResult.Sha
            });
        }
        
        var treeResult = await _client.Git.Tree.Create(owner, name, newTree);
        
        var parent = await _client.Git.Reference.Get(owner, name, $"heads/{branch}");
        var newCommit = new NewCommit(commitMessage, treeResult.Sha, parent.Object.Sha);
        var commitResult = await _client.Git.Commit.Create(owner, name, newCommit);
        
        await _client.Git.Reference.Update(owner, name, $"heads/{branch}", new ReferenceUpdate(commitResult.Sha));
    }
}
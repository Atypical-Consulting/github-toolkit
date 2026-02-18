using Octokit;

namespace GitHubRepoTools.Cli.Models;

public class RepositoryCache
{
    public DateTime FetchedAt { get; set; }
    public List<CachedRepository> Repositories { get; set; } = new();
}

public class CachedRepository
{
    public string Name { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public bool HasRenovate { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string DefaultBranch { get; set; } = "main";
    public long Id { get; set; }
}
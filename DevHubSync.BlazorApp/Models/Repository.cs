namespace DevHubSync.BlazorApp.Models;

public class Repository
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string DefaultBranch { get; set; } = "main";
    public DateTime LastUpdated { get; set; }
    public RepositorySource Source { get; set; }
    public string? SourceId { get; set; }
    public SyncStatus SyncStatus { get; set; } = SyncStatus.NotSynced;
    public DateTime? LastSyncDate { get; set; }
}

public enum RepositorySource
{
    DevOps,
    GitHub
}

public enum SyncStatus
{
    NotSynced,
    Syncing,
    Synced,
    Failed
}

public class DevOpsRepository : Repository
{
    public string ProjectId { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string OrganizationUrl { get; set; } = string.Empty;
}

public class GitHubRepository : Repository
{
    public string Owner { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public string? Language { get; set; }
    public int Stars { get; set; }
    public int Forks { get; set; }
}
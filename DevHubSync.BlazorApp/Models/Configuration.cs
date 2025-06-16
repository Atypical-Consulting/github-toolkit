namespace DevHubSync.BlazorApp.Models;

public class Configuration
{
    public DevOpsConfiguration DevOps { get; set; } = new();
    public GitHubConfiguration GitHub { get; set; } = new();
    public SyncConfiguration Sync { get; set; } = new();
}

public class DevOpsConfiguration
{
    public string OrganizationUrl { get; set; } = string.Empty;
    public string PersonalAccessToken { get; set; } = string.Empty;
    public string DefaultProject { get; set; } = string.Empty;
}

public class GitHubConfiguration
{
    public string PersonalAccessToken { get; set; } = string.Empty;
    public string DefaultOwner { get; set; } = string.Empty;
    public bool CreatePrivateRepos { get; set; } = true;
}

public class SyncConfiguration
{
    public bool AutoSync { get; set; }
    public int SyncIntervalMinutes { get; set; } = 60;
    public bool SyncBranches { get; set; } = true;
    public bool SyncTags { get; set; } = true;
    public bool SyncPullRequests { get; set; } = false;
    public bool SyncIssues { get; set; } = false;
    public List<string> ExcludedFilePatterns { get; set; } = new();
}
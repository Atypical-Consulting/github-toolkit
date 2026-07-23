namespace DevHubSync.BlazorApp.Models;

public class SyncOperation
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SourceRepositoryId { get; set; } = string.Empty;
    public string? TargetRepositoryId { get; set; }
    public RepositorySource SourceType { get; set; }
    public RepositorySource TargetType { get; set; }
    public SyncDirection Direction { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public SyncOperationStatus Status { get; set; }
    public string? ErrorMessage { get; set; }
    public List<SyncLog> Logs { get; set; } = new();
}

public enum SyncDirection
{
    DevOpsToGitHub,
    GitHubToDevOps,
    Bidirectional
}

public enum SyncOperationStatus
{
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled
}

public class SyncLog
{
    public DateTime Timestamp { get; set; }
    public string Message { get; set; } = string.Empty;
    public LogLevel Level { get; set; }
}

public enum LogLevel
{
    Info,
    Warning,
    Error
}
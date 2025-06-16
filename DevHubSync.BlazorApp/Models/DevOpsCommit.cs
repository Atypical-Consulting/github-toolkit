namespace DevHubSync.BlazorApp.Models;

public class DevOpsCommit
{
    public string Id { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string AuthorEmail { get; set; } = string.Empty;
    public DateTime AuthorDate { get; set; }
    public string CommitterName { get; set; } = string.Empty;
    public string CommitterEmail { get; set; } = string.Empty;
    public DateTime CommitterDate { get; set; }
    public List<string> ParentIds { get; set; } = new();
    public string TreeId { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public List<DevOpsCommitChange> Changes { get; set; } = new();
}

public class DevOpsCommitChange
{
    public string ChangeType { get; set; } = string.Empty; // Add, Edit, Delete, Rename
    public string Path { get; set; } = string.Empty;
    public string? OriginalPath { get; set; }
    public string? Content { get; set; }
    public bool IsBinary { get; set; }
}
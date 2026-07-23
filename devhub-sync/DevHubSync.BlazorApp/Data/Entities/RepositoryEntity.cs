using System.ComponentModel.DataAnnotations;
using DevHubSync.BlazorApp.Models;

namespace DevHubSync.BlazorApp.Data.Entities;

public class RepositoryEntity
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string ExternalId { get; set; } = string.Empty;
    
    [Required]
    public string Name { get; set; } = string.Empty;
    
    public string Description { get; set; } = string.Empty;
    
    [Required]
    public string Url { get; set; } = string.Empty;
    
    public string DefaultBranch { get; set; } = "main";
    
    public RepositorySource Source { get; set; }
    
    public bool SyncEnabled { get; set; } = false;
    
    public SyncStatus SyncStatus { get; set; } = SyncStatus.NotSynced;
    
    public DateTime? LastSyncDate { get; set; }
    
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // DevOps specific properties
    public int? DevOpsProjectId { get; set; }
    public virtual DevOpsProject? DevOpsProject { get; set; }
    
    // GitHub specific properties  
    public int? GitHubUserId { get; set; }
    public virtual GitHubUser? GitHubUser { get; set; }
    public bool IsPrivate { get; set; } = true;
    public string? Language { get; set; }
    public int Stars { get; set; } = 0;
    public int Forks { get; set; } = 0;
    
    public virtual ICollection<SyncOperationEntity> SourceSyncOperations { get; set; } = new List<SyncOperationEntity>();
    public virtual ICollection<SyncOperationEntity> TargetSyncOperations { get; set; } = new List<SyncOperationEntity>();
}
using System.ComponentModel.DataAnnotations;
using DevHubSync.BlazorApp.Models;
using LogLevel = DevHubSync.BlazorApp.Models.LogLevel;

namespace DevHubSync.BlazorApp.Data.Entities;

public class SyncOperationEntity
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string OperationId { get; set; } = Guid.NewGuid().ToString();
    
    public int? SourceRepositoryId { get; set; }
    public virtual RepositoryEntity? SourceRepository { get; set; }
    
    public int? TargetRepositoryId { get; set; }
    public virtual RepositoryEntity? TargetRepository { get; set; }
    
    public SyncDirection Direction { get; set; }
    
    public DateTime StartTime { get; set; }
    
    public DateTime? EndTime { get; set; }
    
    public SyncOperationStatus Status { get; set; }
    
    public string? ErrorMessage { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public virtual ICollection<SyncLogEntity> Logs { get; set; } = new List<SyncLogEntity>();
}

public class SyncLogEntity
{
    [Key]
    public int Id { get; set; }
    
    public int SyncOperationId { get; set; }
    public virtual SyncOperationEntity SyncOperation { get; set; } = null!;
    
    public DateTime Timestamp { get; set; }
    
    [Required]
    public string Message { get; set; } = string.Empty;
    
    public LogLevel Level { get; set; }
}
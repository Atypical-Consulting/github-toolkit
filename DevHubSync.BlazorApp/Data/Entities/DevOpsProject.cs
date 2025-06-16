using System.ComponentModel.DataAnnotations;

namespace DevHubSync.BlazorApp.Data.Entities;

public class DevOpsProject
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string ProjectId { get; set; } = string.Empty;
    
    [Required]
    public string Name { get; set; } = string.Empty;
    
    public string Description { get; set; } = string.Empty;
    
    [Required]
    public string OrganizationUrl { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public virtual ICollection<RepositoryEntity> Repositories { get; set; } = new List<RepositoryEntity>();
}
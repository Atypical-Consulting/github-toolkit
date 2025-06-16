using System.ComponentModel.DataAnnotations;

namespace DevHubSync.BlazorApp.Data.Entities;

public class GitHubUser
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string Username { get; set; } = string.Empty;
    
    public string DisplayName { get; set; } = string.Empty;
    
    public string Email { get; set; } = string.Empty;
    
    public string AvatarUrl { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public virtual ICollection<RepositoryEntity> Repositories { get; set; } = new List<RepositoryEntity>();
}
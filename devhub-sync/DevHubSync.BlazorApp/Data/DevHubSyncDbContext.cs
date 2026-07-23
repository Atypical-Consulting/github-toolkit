using Microsoft.EntityFrameworkCore;
using DevHubSync.BlazorApp.Data.Entities;

namespace DevHubSync.BlazorApp.Data;

public class DevHubSyncDbContext : DbContext
{
    public DevHubSyncDbContext(DbContextOptions<DevHubSyncDbContext> options) : base(options)
    {
    }
    
    public DbSet<DevOpsProject> DevOpsProjects { get; set; }
    public DbSet<GitHubUser> GitHubUsers { get; set; }
    public DbSet<RepositoryEntity> Repositories { get; set; }
    public DbSet<SyncOperationEntity> SyncOperations { get; set; }
    public DbSet<SyncLogEntity> SyncLogs { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // DevOpsProject configuration
        modelBuilder.Entity<DevOpsProject>(entity =>
        {
            entity.HasIndex(e => e.ProjectId).IsUnique();
            entity.HasIndex(e => new { e.OrganizationUrl, e.ProjectId }).IsUnique();
        });
        
        // GitHubUser configuration
        modelBuilder.Entity<GitHubUser>(entity =>
        {
            entity.HasIndex(e => e.Username).IsUnique();
        });
        
        // RepositoryEntity configuration
        modelBuilder.Entity<RepositoryEntity>(entity =>
        {
            entity.HasIndex(e => new { e.Source, e.ExternalId }).IsUnique();
            
            // DevOps repository relationship
            entity.HasOne(r => r.DevOpsProject)
                  .WithMany(p => p.Repositories)
                  .HasForeignKey(r => r.DevOpsProjectId)
                  .OnDelete(DeleteBehavior.SetNull);
            
            // GitHub repository relationship
            entity.HasOne(r => r.GitHubUser)
                  .WithMany(u => u.Repositories)
                  .HasForeignKey(r => r.GitHubUserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
        
        // SyncOperationEntity configuration
        modelBuilder.Entity<SyncOperationEntity>(entity =>
        {
            entity.HasIndex(e => e.OperationId).IsUnique();
            
            // Source repository relationship
            entity.HasOne(s => s.SourceRepository)
                  .WithMany(r => r.SourceSyncOperations)
                  .HasForeignKey(s => s.SourceRepositoryId)
                  .OnDelete(DeleteBehavior.SetNull);
            
            // Target repository relationship
            entity.HasOne(s => s.TargetRepository)
                  .WithMany(r => r.TargetSyncOperations)
                  .HasForeignKey(s => s.TargetRepositoryId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
        
        // SyncLogEntity configuration
        modelBuilder.Entity<SyncLogEntity>(entity =>
        {
            entity.HasOne(l => l.SyncOperation)
                  .WithMany(s => s.Logs)
                  .HasForeignKey(l => l.SyncOperationId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
    
    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }
    
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }
    
    private void UpdateTimestamps()
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);
        
        foreach (var entry in entries)
        {
            if (entry.Entity is DevOpsProject project)
            {
                if (entry.State == EntityState.Added)
                    project.CreatedAt = DateTime.UtcNow;
                project.UpdatedAt = DateTime.UtcNow;
            }
            else if (entry.Entity is GitHubUser user)
            {
                if (entry.State == EntityState.Added)
                    user.CreatedAt = DateTime.UtcNow;
                user.UpdatedAt = DateTime.UtcNow;
            }
            else if (entry.Entity is RepositoryEntity repository)
            {
                if (entry.State == EntityState.Added)
                    repository.CreatedAt = DateTime.UtcNow;
                repository.UpdatedAt = DateTime.UtcNow;
            }
            else if (entry.Entity is SyncOperationEntity operation)
            {
                if (entry.State == EntityState.Added)
                    operation.CreatedAt = DateTime.UtcNow;
                operation.UpdatedAt = DateTime.UtcNow;
            }
        }
    }
}
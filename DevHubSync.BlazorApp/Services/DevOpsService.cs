using System.IO.Compression;
using DevHubSync.BlazorApp.Models;
using Microsoft.TeamFoundation.Core.WebApi;
using Microsoft.TeamFoundation.SourceControl.WebApi;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.WebApi;

namespace DevHubSync.BlazorApp.Services;

public class DevOpsService : IDevOpsService
{
    private readonly IConfiguration _configuration;
    private VssConnection? _connection;
    private GitHttpClient? _gitClient;
    private ProjectHttpClient? _projectClient;

    public DevOpsService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    private void EnsureConnection()
    {
        if (_connection == null)
        {
            var organizationUrl = _configuration["DevOps:OrganizationUrl"] ?? string.Empty;
            var pat = _configuration["DevOps:PersonalAccessToken"] ?? string.Empty;

            if (string.IsNullOrEmpty(organizationUrl) || string.IsNullOrEmpty(pat))
            {
                throw new InvalidOperationException("DevOps configuration is missing");
            }

            var credentials = new VssBasicCredential(string.Empty, pat);
            _connection = new VssConnection(new Uri(organizationUrl), credentials);
            _gitClient = _connection.GetClient<GitHttpClient>();
            _projectClient = _connection.GetClient<ProjectHttpClient>();
        }
    }

    public async Task<List<DevOpsRepository>> GetRepositoriesAsync(string projectName)
    {
        EnsureConnection();
        
        var repositories = await _gitClient!.GetRepositoriesAsync(projectName);
        var project = await _projectClient!.GetProject(projectName);
        
        return repositories.Select(repo => new DevOpsRepository
        {
            Id = repo.Id.ToString(),
            Name = repo.Name,
            Description = string.Empty, // Repository description is not directly available
            Url = repo.RemoteUrl,
            DefaultBranch = repo.DefaultBranch?.Replace("refs/heads/", "") ?? "main",
            LastUpdated = DateTime.UtcNow,
            Source = RepositorySource.DevOps,
            SourceId = repo.Id.ToString(),
            ProjectId = project.Id.ToString(),
            ProjectName = project.Name,
            OrganizationUrl = _configuration["DevOps:OrganizationUrl"] ?? string.Empty
        }).ToList();
    }

    public async Task<DevOpsRepository?> GetRepositoryAsync(string projectName, string repositoryId)
    {
        EnsureConnection();
        
        try
        {
            var repo = await _gitClient!.GetRepositoryAsync(projectName, Guid.Parse(repositoryId));
            
            var project = await _projectClient!.GetProject(projectName);
            
            return new DevOpsRepository
            {
                Id = repo.Id.ToString(),
                Name = repo.Name,
                Description = string.Empty, // Repository description is not directly available
                Url = repo.RemoteUrl,
                DefaultBranch = repo.DefaultBranch?.Replace("refs/heads/", "") ?? "main",
                LastUpdated = DateTime.UtcNow,
                Source = RepositorySource.DevOps,
                SourceId = repo.Id.ToString(),
                ProjectId = project.Id.ToString(),
                ProjectName = project.Name,
                OrganizationUrl = _configuration["DevOps:OrganizationUrl"] ?? string.Empty
            };
        }
        catch
        {
            return null;
        }
    }

    public async Task<byte[]> DownloadRepositoryAsync(string projectName, string repositoryId, string branch)
    {
        EnsureConnection();
        
        var items = await _gitClient!.GetItemsAsync(
            projectName,
            Guid.Parse(repositoryId),
            scopePath: "/",
            recursionLevel: VersionControlRecursionType.Full,
            versionDescriptor: new GitVersionDescriptor
            {
                Version = branch,
                VersionType = GitVersionType.Branch
            });

        using var memoryStream = new MemoryStream();
        using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
        {
            foreach (var item in items.Where(i => !i.IsFolder))
            {
                var content = await _gitClient.GetItemContentAsync(
                    projectName,
                    Guid.Parse(repositoryId),
                    item.Path,
                    versionDescriptor: new GitVersionDescriptor
                    {
                        Version = branch,
                        VersionType = GitVersionType.Branch
                    });

                var entry = archive.CreateEntry(item.Path.TrimStart('/'));
                using var entryStream = entry.Open();
                await content.CopyToAsync(entryStream);
            }
        }

        return memoryStream.ToArray();
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            EnsureConnection();
            var projects = await _projectClient!.GetProjects();
            return projects.Any();
        }
        catch
        {
            return false;
        }
    }

    public async Task<List<string>> GetProjectsAsync()
    {
        EnsureConnection();
        var projects = await _projectClient!.GetProjects();
        return projects.Select(p => p.Name).ToList();
    }

    public async Task<List<string>> GetBranchesAsync(string projectName, string repositoryId)
    {
        EnsureConnection();
        var branches = await _gitClient!.GetBranchesAsync(projectName, Guid.Parse(repositoryId));
        return branches.Select(b => b.Name).ToList();
    }
}
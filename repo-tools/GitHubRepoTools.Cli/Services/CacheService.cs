using System.Text.Json;
using GitHubRepoTools.Cli.Models;

namespace GitHubRepoTools.Cli.Services;

public class CacheService
{
    private static readonly string CacheDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        ".gh-renovate");

    private static readonly string CacheFile = Path.Combine(CacheDirectory, "cache.json");
    private static readonly TimeSpan CacheExpiration = TimeSpan.FromHours(1);

    public CacheService()
    {
        EnsureCacheDirectory();
    }

    private static void EnsureCacheDirectory()
    {
        if (!Directory.Exists(CacheDirectory))
        {
            Directory.CreateDirectory(CacheDirectory);
        }
    }

    public RepositoryCache? Load()
    {
        if (!File.Exists(CacheFile))
        {
            return null;
        }

        try
        {
            var json = File.ReadAllText(CacheFile);
            var cache = JsonSerializer.Deserialize<RepositoryCache>(json);

            // Check if cache is still valid
            if (cache != null && DateTime.UtcNow - cache.FetchedAt < CacheExpiration)
            {
                return cache;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public void Save(RepositoryCache cache)
    {
        cache.FetchedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(cache, new JsonSerializerOptions
        {
            WriteIndented = true
        });
        File.WriteAllText(CacheFile, json);
    }

    public void Clear()
    {
        if (File.Exists(CacheFile))
        {
            File.Delete(CacheFile);
        }
    }

    public bool IsValid()
    {
        if (!File.Exists(CacheFile))
        {
            return false;
        }

        var cache = Load();
        return cache != null;
    }

    public DateTime? GetLastFetchTime()
    {
        if (!File.Exists(CacheFile))
        {
            return null;
        }

        try
        {
            var json = File.ReadAllText(CacheFile);
            var cache = JsonSerializer.Deserialize<RepositoryCache>(json);
            return cache?.FetchedAt;
        }
        catch
        {
            return null;
        }
    }
}
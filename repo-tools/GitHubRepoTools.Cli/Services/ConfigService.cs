using System.Text.Json;
using GitHubRepoTools.Cli.Models;

namespace GitHubRepoTools.Cli.Services;

public class ConfigService
{
    private static readonly string ConfigDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        ".gh-renovate");

    private static readonly string ConfigFile = Path.Combine(ConfigDirectory, "config.json");

    public ConfigService()
    {
        EnsureConfigDirectory();
    }

    private static void EnsureConfigDirectory()
    {
        if (!Directory.Exists(ConfigDirectory))
        {
            Directory.CreateDirectory(ConfigDirectory);
        }
    }

    public AppConfig Load()
    {
        if (!File.Exists(ConfigFile))
        {
            return new AppConfig();
        }

        try
        {
            var json = File.ReadAllText(ConfigFile);
            return JsonSerializer.Deserialize<AppConfig>(json) ?? new AppConfig();
        }
        catch
        {
            return new AppConfig();
        }
    }

    public void Save(AppConfig config)
    {
        config.LastUpdated = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
        {
            WriteIndented = true
        });
        File.WriteAllText(ConfigFile, json);
    }

    public void ClearToken()
    {
        var config = Load();
        config.GitHubToken = null;
        Save(config);
    }
}
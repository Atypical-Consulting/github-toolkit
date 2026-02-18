using Octokit;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using GitHubRepoTools.Cli.Models;
using GitHubRepoTools.Cli.Services;

namespace GitHubRepoTools.Cli.Commands;

public sealed class EnableRenovateCommand : AsyncCommand<EnableRenovateCommand.Settings>
{
    public sealed class Settings : CommandSettings
    {
        [Description("GitHub Personal Access Token")]
        [CommandOption("-t|--token")]
        public string? Token { get; init; }

        [Description("Include private repositories")]
        [CommandOption("-p|--include-private")]
        [DefaultValue(true)]
        public bool IncludePrivate { get; init; }

        [Description("Include public repositories")]
        [CommandOption("--include-public")]
        [DefaultValue(true)]
        public bool IncludePublic { get; init; }

        [Description("Filter repositories by name (supports wildcards)")]
        [CommandOption("-f|--filter")]
        public string? Filter { get; init; }

        [Description("Include organization repositories")]
        [CommandOption("-o|--include-orgs")]
        [DefaultValue(true)]
        public bool IncludeOrgs { get; init; }

        [Description("Force update existing renovate.json files")]
        [CommandOption("--force")]
        [DefaultValue(false)]
        public bool Force { get; init; }

        [Description("Refresh cached repository data")]
        [CommandOption("--refresh")]
        [DefaultValue(false)]
        public bool Refresh { get; init; }

        [Description("Preview changes without applying them")]
        [CommandOption("--dry-run")]
        [DefaultValue(false)]
        public bool DryRun { get; init; }

        [Description("Clear saved token")]
        [CommandOption("--clear-token")]
        [DefaultValue(false)]
        public bool ClearToken { get; init; }
    }

    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings, CancellationToken cancellationToken)
    {
        try
        {
            var configService = new ConfigService();
            var cacheService = new CacheService();

            // Handle clear token command
            if (settings.ClearToken)
            {
                configService.ClearToken();
                cacheService.Clear();
                AnsiConsole.MarkupLine("[green]✓[/] Token and cache cleared successfully");
                return 0;
            }

            // Display banner
            ShowBanner();

            // Get GitHub token with persistence
            var config = configService.Load();
            var token = settings.Token ?? config.GitHubToken;

            if (string.IsNullOrEmpty(token))
            {
                token = AnsiConsole.Prompt(
                    new TextPrompt<string>("[yellow]Enter your GitHub Personal Access Token:[/]")
                        .PromptStyle("green")
                        .Secret());

                // Ask to save token
                if (AnsiConsole.Confirm("[cyan]Save token for future use?[/]", true))
                {
                    config.GitHubToken = token;
                    configService.Save(config);
                    AnsiConsole.MarkupLine("[dim]Token saved to ~/.gh-renovate/config.json[/]");
                }
            }
            else
            {
                AnsiConsole.MarkupLine("[dim]Using saved GitHub token[/]");
            }

            // Initialize GitHub client
            var client = new GitHubClient(new ProductHeaderValue("GitHubRepoTools"))
            {
                Credentials = new Credentials(token)
            };

            // Verify authentication
            User user = null!;
            await AnsiConsole.Status()
                .StartAsync("Authenticating with GitHub...", async ctx =>
                {
                    ctx.Spinner(Spinner.Known.Dots);
                    user = await client.User.Current();
                });

            AnsiConsole.MarkupLine($"[green]✓[/] Authenticated as [bold cyan]{user.Login}[/]");
            AnsiConsole.WriteLine();

            // Show cache status
            var lastFetch = cacheService.GetLastFetchTime();
            if (lastFetch.HasValue && !settings.Refresh)
            {
                var cacheAge = DateTime.UtcNow - lastFetch.Value;
                if (cacheAge.TotalHours < 1)
                {
                    AnsiConsole.MarkupLine($"[dim]Last fetch: {cacheAge.TotalMinutes:F0} minutes ago[/]");
                }
                else
                {
                    AnsiConsole.MarkupLine($"[dim]Last fetch: {cacheAge.TotalHours:F1} hours ago (use --refresh to update)[/]");
                }
            }
            else if (settings.Refresh)
            {
                AnsiConsole.MarkupLine("[dim]Refreshing repository data...[/]");
                cacheService.Clear();
            }

            AnsiConsole.WriteLine();

            // Fetch repositories
            var repositories = await FetchRepositoriesAsync(client, settings);

            // Save to cache
            var repositoryCache = new RepositoryCache
            {
                Repositories = repositories.Select(r => new CachedRepository
                {
                    Name = r.repo.Name,
                    Owner = r.repo.Owner.Login,
                    IsPrivate = r.repo.Private,
                    HasRenovate = r.hasRenovate,
                    UpdatedAt = r.repo.UpdatedAt.DateTime,
                    DefaultBranch = r.repo.DefaultBranch,
                    Id = r.repo.Id
                }).ToList()
            };
            cacheService.Save(repositoryCache);

            if (!repositories.Any())
            {
                AnsiConsole.MarkupLine("[yellow]⚠ No repositories found matching your criteria.[/]");
                return 0;
            }

            // Show summary panel
            ShowSummaryPanel(repositories);

            // Display repositories and let user select
            var selectedRepos = SelectRepositories(repositories);

            if (!selectedRepos.Any())
            {
                AnsiConsole.MarkupLine("[yellow]No repositories selected.[/]");
                return 0;
            }

            AnsiConsole.WriteLine();

            // Show preview of what will be done
            ShowActionPreview(selectedRepos, settings);

            // Confirm before proceeding (unless dry-run)
            if (!settings.DryRun)
            {
                if (!AnsiConsole.Confirm($"\n[yellow]Proceed with enabling/updating Renovate on {selectedRepos.Count} repositories?[/]", true))
                {
                    AnsiConsole.MarkupLine("[dim]Operation cancelled[/]");
                    return 0;
                }
            }
            else
            {
                AnsiConsole.MarkupLine("\n[cyan]Dry-run mode - no changes will be made[/]");
                return 0;
            }

            AnsiConsole.WriteLine();

            // Enable Renovate on selected repositories
            var results = await EnableRenovateAsync(client, selectedRepos, settings);

            // Show final summary
            ShowFinalSummary(results);

            return 0;
        }
        catch (AuthorizationException)
        {
            AnsiConsole.MarkupLine("[red]✗ Authentication failed. Please check your token.[/]");
            AnsiConsole.MarkupLine("[dim]Tip: Use --clear-token to reset saved credentials[/]");
            return 1;
        }
        catch (Exception ex)
        {
            AnsiConsole.MarkupLine($"[red]✗ Error: {ex.Message}[/]");
            if (AnsiConsole.Confirm("Show detailed error?"))
            {
                AnsiConsole.WriteException(ex);
            }
            return 1;
        }
    }

    private static void ShowBanner()
    {
        var panel = new Panel("[bold cyan]GitHub Renovate Enabler[/]\n[dim]Manage Renovate configurations across your repositories[/]")
        {
            Border = BoxBorder.Rounded,
            BorderStyle = new Style(Color.Cyan1)
        };
        AnsiConsole.Write(panel);
        AnsiConsole.WriteLine();
    }

    private static List<(Repository repo, bool hasRenovate)> ApplyFilters(
        List<(Repository repo, bool hasRenovate)> repositories,
        Settings settings)
    {
        return repositories.Where(item =>
        {
            var (repo, _) = item;
            if (!settings.IncludePrivate && repo.Private)
                return false;
            if (!settings.IncludePublic && !repo.Private)
                return false;
            if (!string.IsNullOrEmpty(settings.Filter))
            {
                var pattern = settings.Filter.Replace("*", ".*");
                if (!System.Text.RegularExpressions.Regex.IsMatch(repo.Name, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                    return false;
            }
            return true;
        }).ToList();
    }

    private static void ShowSummaryPanel(List<(Repository repo, bool hasRenovate)> repositories)
    {
        var totalCount = repositories.Count;
        var withRenovate = repositories.Count(r => r.hasRenovate);
        var withoutRenovate = totalCount - withRenovate;
        var privateCount = repositories.Count(r => r.repo.Private);
        var publicCount = totalCount - privateCount;

        var grid = new Grid();
        grid.AddColumn();
        grid.AddColumn();

        grid.AddRow("[cyan]Total Repositories:[/]", $"[white]{totalCount}[/]");
        grid.AddRow("[green]With Renovate:[/]", $"[white]{withRenovate}[/]");
        grid.AddRow("[yellow]Without Renovate:[/]", $"[white]{withoutRenovate}[/]");
        grid.AddRow("[red]Private:[/]", $"[white]{privateCount}[/]");
        grid.AddRow("[green]Public:[/]", $"[white]{publicCount}[/]");

        var panel = new Panel(grid)
        {
            Header = new PanelHeader(" Repository Summary ", Justify.Left),
            Border = BoxBorder.Rounded,
            BorderStyle = new Style(Color.Grey)
        };

        AnsiConsole.Write(panel);
        AnsiConsole.WriteLine();
    }

    private static void ShowActionPreview(List<(Repository repo, bool hasRenovate)> repositories, Settings settings)
    {
        var createCount = repositories.Count(r => !r.hasRenovate);
        var updateCount = repositories.Count(r => r.hasRenovate && settings.Force);
        var skipCount = repositories.Count(r => r.hasRenovate && !settings.Force);

        var table = new Table()
        {
            Border = TableBorder.Rounded
        };
        table.AddColumn("Action");
        table.AddColumn(new TableColumn("Count").Centered());
        table.AddColumn("Repositories");

        if (createCount > 0)
        {
            var repos = repositories.Where(r => !r.hasRenovate).Take(3);
            var repoList = string.Join(", ", repos.Select(r => $"{r.repo.Owner.Login.EscapeMarkup()}/{r.repo.Name.EscapeMarkup()}"));
            if (createCount > 3) repoList += $" [dim]+ {createCount - 3} more[/]";
            table.AddRow("[green]Create[/]", $"[white]{createCount}[/]", repoList);
        }

        if (updateCount > 0)
        {
            var repos = repositories.Where(r => r.hasRenovate && settings.Force).Take(3);
            var repoList = string.Join(", ", repos.Select(r => $"{r.repo.Owner.Login.EscapeMarkup()}/{r.repo.Name.EscapeMarkup()}"));
            if (updateCount > 3) repoList += $" [dim]+ {updateCount - 3} more[/]";
            table.AddRow("[cyan]Update[/]", $"[white]{updateCount}[/]", repoList);
        }

        if (skipCount > 0)
        {
            var repos = repositories.Where(r => r.hasRenovate && !settings.Force).Take(3);
            var repoList = string.Join(", ", repos.Select(r => $"{r.repo.Owner.Login.EscapeMarkup()}/{r.repo.Name.EscapeMarkup()}"));
            if (skipCount > 3) repoList += $" [dim]+ {skipCount - 3} more[/]";
            table.AddRow("[yellow]Skip[/]", $"[white]{skipCount}[/]", repoList);
        }

        AnsiConsole.Write(new Panel(table)
        {
            Header = new PanelHeader(" Action Preview ", Justify.Left),
            Border = BoxBorder.Rounded
        });
    }

    private static void ShowFinalSummary((int created, int updated, int skipped, int failed) results)
    {
        AnsiConsole.WriteLine();

        var grid = new Grid();
        grid.AddColumn();
        grid.AddColumn();

        if (results.created > 0)
            grid.AddRow("[green]✓ Created:[/]", $"[white]{results.created}[/]");
        if (results.updated > 0)
            grid.AddRow("[cyan]✓ Updated:[/]", $"[white]{results.updated}[/]");
        if (results.skipped > 0)
            grid.AddRow("[yellow]⚠ Skipped:[/]", $"[white]{results.skipped}[/]");
        if (results.failed > 0)
            grid.AddRow("[red]✗ Failed:[/]", $"[white]{results.failed}[/]");

        var panel = new Panel(grid)
        {
            Header = new PanelHeader(" Final Summary ", Justify.Left),
            Border = BoxBorder.Rounded,
            BorderStyle = new Style(Color.Green)
        };

        AnsiConsole.Write(panel);
        AnsiConsole.MarkupLine("\n[green]✓ Done![/]");
    }

    private static async Task<List<(Repository repo, bool hasRenovate)>> FetchRepositoriesAsync(GitHubClient client, Settings settings)
    {
        return await AnsiConsole.Status()
            .StartAsync("Fetching repositories...", async ctx =>
            {
                ctx.Spinner(Spinner.Known.Dots);
                var allRepos = new List<Repository>();

                // Fetch user's own repositories
                ctx.Status("Fetching your repositories...");
                var request = new RepositoryRequest
                {
                    Affiliation = RepositoryAffiliation.Owner,
                    Sort = RepositorySort.Updated,
                    Direction = SortDirection.Descending
                };

                var userRepos = await client.Repository.GetAllForCurrent(request);
                allRepos.AddRange(userRepos);
                AnsiConsole.MarkupLine($"[dim]  Found {userRepos.Count} personal repositories[/]");

                // Fetch organization repositories if requested
                if (settings.IncludeOrgs)
                {
                    ctx.Status("Fetching organizations...");
                    var orgs = await client.Organization.GetAllForCurrent();

                    if (orgs.Any())
                    {
                        AnsiConsole.MarkupLine($"[dim]  Found {orgs.Count} organizations[/]");

                        var selectedOrgs = AnsiConsole.Prompt(
                            new MultiSelectionPrompt<Organization>()
                                .Title("Select organizations to include:")
                                .NotRequired()
                                .PageSize(10)
                                .InstructionsText("[grey](Press [blue]<space>[/] to toggle, [green]<enter>[/] to accept)[/]")
                                .UseConverter(org => $"{org.Login}")
                                .AddChoices(orgs));

                        foreach (var org in selectedOrgs)
                        {
                            ctx.Status($"Fetching repositories from {org.Login}...");
                            var orgRepos = await client.Repository.GetAllForOrg(org.Login);
                            allRepos.AddRange(orgRepos);
                            AnsiConsole.MarkupLine($"[dim]  Found {orgRepos.Count} repositories in {org.Login}[/]");
                        }
                    }
                }

                // Filter based on settings
                var filtered = allRepos.Where(repo =>
                {
                    if (!settings.IncludePrivate && repo.Private)
                        return false;
                    if (!settings.IncludePublic && !repo.Private)
                        return false;
                    if (!string.IsNullOrEmpty(settings.Filter))
                    {
                        var pattern = settings.Filter.Replace("*", ".*");
                        if (!System.Text.RegularExpressions.Regex.IsMatch(repo.Name, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                            return false;
                    }
                    return true;
                }).ToList();

                // Check which repositories already have Renovate
                ctx.Status("Checking for existing Renovate configurations...");
                var reposWithStatus = new List<(Repository repo, bool hasRenovate)>();
                var checkCount = 0;
                foreach (var repo in filtered)
                {
                    checkCount++;
                    ctx.Status($"Checking Renovate status ({checkCount}/{filtered.Count})...");
                    var hasRenovate = await FileExistsAsync(client, repo.Owner.Login, repo.Name, "renovate.json");
                    reposWithStatus.Add((repo, hasRenovate));
                }

                var renovateCount = reposWithStatus.Count(r => r.hasRenovate);
                AnsiConsole.MarkupLine($"[green]✓[/] Found {filtered.Count} repositories ({renovateCount} already have Renovate)");
                return reposWithStatus;
            });
    }

    private static List<(Repository repo, bool hasRenovate)> SelectRepositories(List<(Repository repo, bool hasRenovate)> repositories)
    {
        var table = new Table();
        table.AddColumn("Name");
        table.AddColumn("Owner");
        table.AddColumn("Visibility");
        table.AddColumn("Renovate");
        table.AddColumn("Updated");

        foreach (var (repo, hasRenovate) in repositories.Take(10))
        {
            table.AddRow(
                repo.Name.EscapeMarkup(),
                $"[dim]{repo.Owner.Login.EscapeMarkup()}[/]",
                repo.Private ? "[red]Private[/]" : "[green]Public[/]",
                hasRenovate ? "[green]✓[/]" : "[dim]✗[/]",
                repo.UpdatedAt.ToString("yyyy-MM-dd"));
        }

        AnsiConsole.Write(table);

        if (repositories.Count > 10)
        {
            AnsiConsole.MarkupLine($"[dim]... and {repositories.Count - 10} more repositories[/]");
        }

        var selections = AnsiConsole.Prompt(
            new MultiSelectionPrompt<(Repository repo, bool hasRenovate)>()
                .Title("Select repositories to enable Renovate on:")
                .Required()
                .PageSize(15)
                .MoreChoicesText("[grey](Move up and down to reveal more repositories)[/]")
                .InstructionsText("[grey](Press [blue]<space>[/] to toggle, [green]<enter>[/] to accept)[/]")
                .UseConverter(item =>
                {
                    var (repo, hasRenovate) = item;
                    var status = hasRenovate ? "✓" : "✗";
                    var ownerName = repo.Owner.Login.EscapeMarkup();
                    var repoName = repo.Name.EscapeMarkup();
                    var visibility = repo.Private ? "Private" : "Public";
                    return $"{ownerName}/{repoName} ({visibility}) {status}";
                })
                .AddChoices(repositories));

        return selections.ToList();
    }

    private static async Task<(int created, int updated, int skipped, int failed)> EnableRenovateAsync(
        GitHubClient client,
        List<(Repository repo, bool hasRenovate)> repositories,
        Settings settings)
    {
        var renovateConfig = CreateRenovateConfig();
        var created = 0;
        var updated = 0;
        var skipped = 0;
        var failed = 0;

        await AnsiConsole.Progress()
            .StartAsync(async ctx =>
            {
                var task = ctx.AddTask("[green]Processing repositories[/]", maxValue: repositories.Count);

                foreach (var (repo, hasRenovate) in repositories)
                {
                    try
                    {
                        var owner = repo.Owner.Login;
                        var repoPath = $"{owner.EscapeMarkup()}/{repo.Name.EscapeMarkup()}";

                        if (hasRenovate && !settings.Force)
                        {
                            AnsiConsole.MarkupLine($"[yellow]⚠[/] [dim]{repoPath}:[/] Skipped (already has Renovate)");
                            skipped++;
                        }
                        else if (hasRenovate && settings.Force)
                        {
                            // Update existing renovate.json
                            var existingFile = await client.Repository.Content.GetAllContents(owner, repo.Name, "renovate.json");
                            var updateRequest = new UpdateFileRequest(
                                "Update Renovate configuration",
                                renovateConfig,
                                existingFile[0].Sha);

                            await client.Repository.Content.UpdateFile(owner, repo.Name, "renovate.json", updateRequest);
                            AnsiConsole.MarkupLine($"[cyan]✓[/] [dim]{repoPath}:[/] Updated");
                            updated++;
                        }
                        else
                        {
                            // Get default branch
                            var repoDetails = await client.Repository.Get(owner, repo.Name);
                            var defaultBranch = repoDetails.DefaultBranch;

                            // Create renovate.json
                            var createRequest = new CreateFileRequest(
                                "Add Renovate configuration",
                                renovateConfig,
                                defaultBranch);

                            await client.Repository.Content.CreateFile(owner, repo.Name, "renovate.json", createRequest);
                            AnsiConsole.MarkupLine($"[green]✓[/] [dim]{repoPath}:[/] Created");
                            created++;
                        }
                    }
                    catch (Exception ex)
                    {
                        var errorMsg = ex.Message.EscapeMarkup();
                        var errorRepoPath = $"{repo.Owner.Login.EscapeMarkup()}/{repo.Name.EscapeMarkup()}";
                        AnsiConsole.MarkupLine($"[red]✗[/] [dim]{errorRepoPath}:[/] {errorMsg}");
                        failed++;
                    }

                    task.Increment(1);
                }
            });

        return (created, updated, skipped, failed);
    }

    private static async Task<bool> FileExistsAsync(GitHubClient client, string owner, string repo, string path)
    {
        try
        {
            await client.Repository.Content.GetAllContents(owner, repo, path);
            return true;
        }
        catch (NotFoundException)
        {
            return false;
        }
    }

    private static string CreateRenovateConfig()
    {
        return """
        {
          "$schema": "https://docs.renovatebot.com/renovate-schema.json",
          "extends": [
            "config:recommended"
          ],
          "timezone": "UTC",
          "schedule": [
            "before 6am on Monday"
          ],
          "labels": [
            "dependencies"
          ],
          "commitMessagePrefix": "chore:",
          "commitMessageAction": "update",
          "commitMessageTopic": "{{depName}}",
          "prHourlyLimit": 2,
          "prConcurrentLimit": 10,
          "automerge": false,
          "major": {
            "automerge": false
          },
          "minor": {
            "automerge": false
          },
          "patch": {
            "automerge": false
          },
          "packageRules": [
            {
              "matchUpdateTypes": ["minor", "patch"],
              "matchCurrentVersion": "!/^0/",
              "automerge": false
            }
          ]
        }
        """;
    }
}
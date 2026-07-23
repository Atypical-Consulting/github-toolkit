using GitHubRepoTools.Cli.Commands;
using Spectre.Console;
using Spectre.Console.Cli;

var app = new CommandApp<EnableRenovateCommand>();

app.Configure(config =>
{
    config.SetApplicationName("gh-renovate");
    config.SetApplicationVersion("1.0.0");

    config.ValidateExamples();

    config.AddExample("--token", "ghp_xxxxxxxxxxxx");
    config.AddExample("--token", "ghp_xxxxxxxxxxxx", "--filter", "my-project-*");
    config.AddExample("--token", "ghp_xxxxxxxxxxxx", "--dry-run");
    config.AddExample("--token", "ghp_xxxxxxxxxxxx", "--force", "--refresh");
    config.AddExample("--clear-token");
});

try
{
    return await app.RunAsync(args);
}
catch (Exception ex)
{
    AnsiConsole.WriteException(ex, ExceptionFormats.ShortenEverything);
    return 1;
}

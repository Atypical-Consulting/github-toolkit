using DevHubSync.BlazorApp.Components;
using DevHubSync.BlazorApp.Services;
using DevHubSync.BlazorApp.Data;
using Microsoft.EntityFrameworkCore;
using MudBlazor.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

// Add Entity Framework
builder.Services.AddDbContext<DevHubSyncDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? 
                     "Data Source=devhubsync.db"));

// Add MudBlazor services
builder.Services.AddMudServices();

// Add application services
builder.Services.AddScoped<IDevOpsService, DevOpsService>();
builder.Services.AddScoped<IGitHubService, GitHubService>();
builder.Services.AddScoped<ISyncService, SyncService>();

var app = builder.Build();

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<DevHubSyncDbContext>();
    context.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();


app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
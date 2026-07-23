using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DevHubSync.BlazorApp.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DevOpsProjects",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProjectId = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    OrganizationUrl = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DevOpsProjects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GitHubUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Username = table.Column<string>(type: "TEXT", nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", nullable: false),
                    AvatarUrl = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GitHubUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Repositories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ExternalId = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Url = table.Column<string>(type: "TEXT", nullable: false),
                    DefaultBranch = table.Column<string>(type: "TEXT", nullable: false),
                    Source = table.Column<int>(type: "INTEGER", nullable: false),
                    SyncEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SyncStatus = table.Column<int>(type: "INTEGER", nullable: false),
                    LastSyncDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastUpdated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DevOpsProjectId = table.Column<int>(type: "INTEGER", nullable: true),
                    GitHubUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    IsPrivate = table.Column<bool>(type: "INTEGER", nullable: false),
                    Language = table.Column<string>(type: "TEXT", nullable: true),
                    Stars = table.Column<int>(type: "INTEGER", nullable: false),
                    Forks = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Repositories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Repositories_DevOpsProjects_DevOpsProjectId",
                        column: x => x.DevOpsProjectId,
                        principalTable: "DevOpsProjects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Repositories_GitHubUsers_GitHubUserId",
                        column: x => x.GitHubUserId,
                        principalTable: "GitHubUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SyncOperations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OperationId = table.Column<string>(type: "TEXT", nullable: false),
                    SourceRepositoryId = table.Column<int>(type: "INTEGER", nullable: true),
                    TargetRepositoryId = table.Column<int>(type: "INTEGER", nullable: true),
                    Direction = table.Column<int>(type: "INTEGER", nullable: false),
                    StartTime = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndTime = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    ErrorMessage = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncOperations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SyncOperations_Repositories_SourceRepositoryId",
                        column: x => x.SourceRepositoryId,
                        principalTable: "Repositories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SyncOperations_Repositories_TargetRepositoryId",
                        column: x => x.TargetRepositoryId,
                        principalTable: "Repositories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SyncLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SyncOperationId = table.Column<int>(type: "INTEGER", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Message = table.Column<string>(type: "TEXT", nullable: false),
                    Level = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SyncLogs_SyncOperations_SyncOperationId",
                        column: x => x.SyncOperationId,
                        principalTable: "SyncOperations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DevOpsProjects_OrganizationUrl_ProjectId",
                table: "DevOpsProjects",
                columns: new[] { "OrganizationUrl", "ProjectId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DevOpsProjects_ProjectId",
                table: "DevOpsProjects",
                column: "ProjectId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GitHubUsers_Username",
                table: "GitHubUsers",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Repositories_DevOpsProjectId",
                table: "Repositories",
                column: "DevOpsProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Repositories_GitHubUserId",
                table: "Repositories",
                column: "GitHubUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Repositories_Source_ExternalId",
                table: "Repositories",
                columns: new[] { "Source", "ExternalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SyncLogs_SyncOperationId",
                table: "SyncLogs",
                column: "SyncOperationId");

            migrationBuilder.CreateIndex(
                name: "IX_SyncOperations_OperationId",
                table: "SyncOperations",
                column: "OperationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SyncOperations_SourceRepositoryId",
                table: "SyncOperations",
                column: "SourceRepositoryId");

            migrationBuilder.CreateIndex(
                name: "IX_SyncOperations_TargetRepositoryId",
                table: "SyncOperations",
                column: "TargetRepositoryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SyncLogs");

            migrationBuilder.DropTable(
                name: "SyncOperations");

            migrationBuilder.DropTable(
                name: "Repositories");

            migrationBuilder.DropTable(
                name: "DevOpsProjects");

            migrationBuilder.DropTable(
                name: "GitHubUsers");
        }
    }
}

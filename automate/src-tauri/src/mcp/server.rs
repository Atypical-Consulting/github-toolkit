use anyhow::Result;
use rmcp::{
    ServerHandler, tool,
    handler::server::{tool::ToolRouter, wrapper::Parameters},
    model::{ServerCapabilities, ServerInfo, Implementation, ProtocolVersion},
};
use schemars::JsonSchema;
use serde::Deserialize;

// --- Parameter structs with JSON Schema ---

#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetHealthScoresParams {
    /// Optional repository full name filter (e.g. "owner/repo"). Omit for all repos.
    pub repo: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetBacklogItemsParams {
    /// Filter by repository owner (e.g. "phmatray")
    pub owner: Option<String>,
    /// Filter by severity: "critical", "warning", or "info"
    pub severity: Option<String>,
    /// Filter by status: "todo", "in_progress", or "done"
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetDiagnosticRulesParams {
    /// No parameters needed — returns all rules
    #[serde(default)]
    pub _placeholder: Option<()>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ScanRepositoriesParams {
    /// No parameters needed — scans all configured repos
    #[serde(default)]
    pub _placeholder: Option<()>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ScanSingleRepositoryParams {
    /// Repository owner (e.g. "phmatray")
    pub owner: String,
    /// Repository name (e.g. "GitHubAutomate")
    pub repo: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct CreateGithubIssueParams {
    /// Repository full name (e.g. "owner/repo")
    pub repo: String,
    /// Diagnostic rule ID that failed (e.g. "has_readme")
    pub rule_id: String,
}

// --- Server struct ---

#[derive(Debug, Clone)]
pub struct GitHubAutomateMcpServer {
    tool_router: ToolRouter<Self>,
}

impl GitHubAutomateMcpServer {
    pub fn new() -> Result<Self> {
        Ok(Self {
            tool_router: Self::tool_router(),
        })
    }
}

// --- Tool router ---

#[rmcp::tool_router]
impl GitHubAutomateMcpServer {
    #[tool(description = "READ-ONLY: Returns health scores for all or a specific repository from the local database")]
    async fn get_health_scores(
        &self,
        Parameters(params): Parameters<GetHealthScoresParams>,
    ) -> String {
        // Stub — Phase 3 replaces with real SQLite query
        format!("get_health_scores stub: repo={:?}", params.repo)
    }

    #[tool(description = "READ-ONLY: Returns backlog items, optionally filtered by owner, severity, or status")]
    async fn get_backlog_items(
        &self,
        Parameters(params): Parameters<GetBacklogItemsParams>,
    ) -> String {
        format!(
            "get_backlog_items stub: owner={:?}, severity={:?}, status={:?}",
            params.owner, params.severity, params.status
        )
    }

    #[tool(description = "READ-ONLY: Returns all diagnostic rule definitions with id, name, severity, and enabled status")]
    async fn get_diagnostic_rules(
        &self,
        Parameters(_params): Parameters<GetDiagnosticRulesParams>,
    ) -> String {
        "get_diagnostic_rules stub: returns all rules".to_string()
    }

    #[tool(description = "Triggers a full diagnostic scan of all configured repositories. Results are written to the local database.")]
    async fn scan_repositories(
        &self,
        Parameters(_params): Parameters<ScanRepositoriesParams>,
    ) -> String {
        "scan_repositories stub: would scan all repos".to_string()
    }

    #[tool(description = "Scans a single repository by owner and name. Updates only that repo's data in the local database.")]
    async fn scan_single_repository(
        &self,
        Parameters(params): Parameters<ScanSingleRepositoryParams>,
    ) -> String {
        format!("scan_single_repository stub: {}/{}", params.owner, params.repo)
    }

    #[tool(description = "Creates a GitHub issue for a failed diagnostic rule on a repository. Idempotent — returns existing issue if one already exists.")]
    async fn create_github_issue(
        &self,
        Parameters(params): Parameters<CreateGithubIssueParams>,
    ) -> String {
        format!("create_github_issue stub: repo={}, rule={}", params.repo, params.rule_id)
    }
}

// --- ServerHandler impl ---

#[rmcp::tool_handler]
impl ServerHandler for GitHubAutomateMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::V_2024_11_05,
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .build(),
            server_info: Implementation {
                name: "github-automate-mcp".into(),
                title: None,
                version: env!("CARGO_PKG_VERSION").into(),
                description: None,
                icons: None,
                website_url: None,
            },
            instructions: Some(
                "GitHub repository health diagnostics and backlog management. \
                 Use get_health_scores to check repo health, get_backlog_items \
                 to see pending work, and scan tools to run diagnostics.".into()
            ),
        }
    }
}

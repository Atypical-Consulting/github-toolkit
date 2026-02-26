// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::Result;
use github_automate_lib::mcp::server::GitHubAutomateMcpServer;

#[tokio::main]
async fn main() -> Result<()> {
    // CRITICAL: tracing must be set up before stdio transport starts.
    // All output goes to stderr — stdout is reserved for JSON-RPC.
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    tracing::info!("github-automate-mcp starting");

    let _server = GitHubAutomateMcpServer::new()?;

    // TODO (Plan 02): Replace with `server.serve(stdio()).await` + `.waiting().await`
    tracing::info!("github-automate-mcp initialized (no protocol handler yet)");

    Ok(())
}

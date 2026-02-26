use anyhow::Result;

#[derive(Debug, Clone)]
pub struct GitHubAutomateMcpServer;

impl GitHubAutomateMcpServer {
    pub fn new() -> Result<Self> {
        Ok(Self)
    }
}

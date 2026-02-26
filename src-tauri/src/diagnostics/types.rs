use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Severity {
    Critical,
    Warning,
    Info,
}

impl Severity {
    pub fn weight(&self) -> f64 {
        match self {
            Severity::Critical => 3.0,
            Severity::Warning => 2.0,
            Severity::Info => 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticResult {
    pub rule_id: String,
    pub rule_name: String,
    pub severity: Severity,
    pub passed: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoHealthReport {
    pub repo_full_name: String,
    pub owner: String,
    pub repo_name: String,
    pub health_score: f64,
    pub critical_count: u32,
    pub warning_count: u32,
    pub info_count: u32,
    pub results: Vec<DiagnosticResult>,
    pub scanned_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CachedRepoHealthReport {
    pub report: RepoHealthReport,
    pub commit_sha: String,
    pub from_cache: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RuleInfo {
    pub id: String,
    pub name: String,
    pub severity: Severity,
}

pub struct RepoContext {
    pub owner: String,
    pub repo_name: String,
    pub description: Option<String>,
    pub topics: Vec<String>,
    pub license_name: Option<String>,
    pub root_files: Vec<String>,
    pub workflow_files: Vec<String>,
    #[allow(dead_code)]
    pub readme_content: Option<String>,
    pub readme_line_count: u32,
    #[allow(dead_code)]
    pub pushed_at: Option<String>,
}

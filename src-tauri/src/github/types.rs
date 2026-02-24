use serde::{Deserialize, Serialize};
use specta::Type;

// Internal types
#[derive(Debug, Deserialize)]
pub struct GitHubUserRef {
    pub login: String,
    pub avatar_url: String,
}

#[derive(Debug, Deserialize)]
pub struct GitHubLabel {
    pub id: u64,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GitHubIssue {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub user: GitHubUserRef,
    pub labels: Vec<GitHubLabel>,
    pub assignees: Vec<GitHubUserRef>,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub body: Option<String>,
    pub comments: u32,
    pub html_url: String,
    pub pull_request: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct GitHubComment {
    pub id: u64,
    pub user: GitHubUserRef,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
}

/// GitHub branch as returned by API
#[derive(Debug, Deserialize)]
pub struct GitHubBranchCommit {
    pub sha: String,
}

#[derive(Debug, Deserialize)]
pub struct GitHubBranch {
    pub name: String,
    pub commit: GitHubBranchCommit,
}

/// GitHub repo as returned by API
#[derive(Debug, Deserialize)]
pub struct GitHubRepo {
    pub full_name: String,
    pub name: String,
    pub description: Option<String>,
    pub default_branch: String,
    pub topics: Option<Vec<String>>,
    pub archived: bool,
    pub private: bool,
    pub has_issues: bool,
    pub open_issues_count: u32,
    pub pushed_at: Option<String>,
    pub html_url: String,
    pub license: Option<GitHubLicense>,
    pub owner: GitHubUserRef,
}

#[derive(Debug, Deserialize)]
pub struct GitHubLicense {
    pub spdx_id: Option<String>,
    pub name: String,
}

/// GitHub content entry (from /repos/{owner}/{repo}/contents/{path})
#[derive(Debug, Deserialize)]
pub struct GitHubContentEntry {
    pub name: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub path: String,
    pub size: Option<u64>,
}

/// GitHub file content (with base64 encoded content)
#[derive(Debug, Deserialize)]
pub struct GitHubFileContent {
    pub name: String,
    pub path: String,
    pub content: Option<String>,
    pub encoding: Option<String>,
    pub size: u64,
}

// IPC Types

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoSummary {
    pub full_name: String,
    pub owner: String,
    pub name: String,
    pub description: Option<String>,
    pub default_branch: String,
    pub topics: Vec<String>,
    pub is_archived: bool,
    pub is_private: bool,
    pub has_issues: bool,
    pub open_issues_count: u32,
    pub pushed_at: Option<String>,
    pub html_url: String,
    pub license_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoListResponse {
    pub items: Vec<RepoSummary>,
    pub has_next_page: bool,
    pub next_page: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContentEntry {
    pub name: String,
    pub entry_type: String,
    pub path: String,
    pub size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub name: String,
    pub path: String,
    pub content: String,
    pub size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IssueSummary {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LabelInfo {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AuthResult {
    pub authenticated: bool,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub scopes: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub avatar_url: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub limit: u32,
    pub remaining: u32,
    pub reset: u32,
    pub used: u32,
}

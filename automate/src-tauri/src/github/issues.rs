use super::client;
use super::error::GitHubError;
use super::types::IssueSummary;

#[derive(Debug, serde::Serialize)]
struct CreateIssueBody {
    title: String,
    body: String,
    labels: Vec<String>,
}

#[derive(Debug, serde::Deserialize)]
struct GitHubCreatedIssue {
    number: u32,
    title: String,
    state: String,
    html_url: String,
}

#[tauri::command]
#[specta::specta]
pub async fn github_create_issue(
    owner: String,
    repo: String,
    title: String,
    body: String,
    labels: Vec<String>,
) -> Result<IssueSummary, GitHubError> {
    let path = format!("/repos/{}/{}/issues", owner, repo);
    let create_body = CreateIssueBody {
        title,
        body,
        labels,
    };

    let resp = client::github_post(&path, &create_body).await?;

    let issue: GitHubCreatedIssue = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse created issue: {}", e)))?;

    Ok(IssueSummary {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        html_url: issue.html_url,
    })
}

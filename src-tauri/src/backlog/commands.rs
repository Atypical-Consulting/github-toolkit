use tauri::State;
use crate::diagnostics::types::{RepoHealthReport, Severity};
use crate::github::error::GitHubError;
use crate::github::types::IssueSummary;
use crate::storage::backlog::{BacklogFilters, BacklogItem};
use crate::storage::DbState;

#[tauri::command]
#[specta::specta]
pub fn generate_backlog_from_scan(
    reports: Vec<RepoHealthReport>,
    db: State<DbState>,
) -> Result<Vec<BacklogItem>, String> {
    let mut items = Vec::new();
    let now = chrono::Utc::now().to_rfc3339();

    for report in &reports {
        for result in &report.results {
            if !result.passed {
                // Skip if backlog item already exists for this repo+rule
                if crate::storage::backlog::backlog_item_exists(
                    &db,
                    &report.repo_full_name,
                    &result.rule_id,
                )
                .unwrap_or(false)
                {
                    continue;
                }
                let priority = match result.severity {
                    Severity::Critical => 100,
                    Severity::Warning => 50,
                    Severity::Info => 10,
                };
                let item = BacklogItem {
                    id: uuid::Uuid::new_v4().to_string(),
                    repo_full_name: report.repo_full_name.clone(),
                    source: "diagnostic".to_string(),
                    source_ref: Some(result.rule_id.clone()),
                    title: format!("[{}] {}", report.repo_full_name, result.rule_name),
                    description: Some(result.message.clone()),
                    severity: format!("{:?}", result.severity).to_lowercase(),
                    status: "todo".to_string(),
                    priority_score: priority,
                    github_issue_url: None,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                };
                crate::storage::backlog::insert_backlog_item(&db, &item).map_err(|e| e.to_string())?;
                items.push(item);
            }
        }
    }

    Ok(items)
}

#[tauri::command]
#[specta::specta]
pub fn list_backlog(
    filters: BacklogFilters,
    db: State<DbState>,
) -> Result<Vec<BacklogItem>, String> {
    crate::storage::backlog::list_backlog_items(&db, &filters)
}

#[tauri::command]
#[specta::specta]
pub fn update_backlog_item_status(
    id: String,
    status: String,
    db: State<DbState>,
) -> Result<(), String> {
    crate::storage::backlog::update_backlog_status(&db, &id, &status)
}

#[tauri::command]
#[specta::specta]
pub fn delete_backlog(
    id: String,
    db: State<DbState>,
) -> Result<(), String> {
    crate::storage::backlog::delete_backlog_item(&db, &id)
}

#[tauri::command]
#[specta::specta]
pub async fn create_github_issue_from_backlog(
    item_id: String,
    db: State<'_, DbState>,
) -> Result<IssueSummary, GitHubError> {
    // Get the backlog item
    let filters = BacklogFilters {
        owner: None,
        repo: None,
        severity: None,
        status: None,
        source: None,
    };
    let items = crate::storage::backlog::list_backlog_items(&db, &filters)
        .map_err(|e| GitHubError::Internal(e))?;

    let item = items.iter().find(|i| i.id == item_id)
        .ok_or_else(|| GitHubError::NotFound(format!("Backlog item {} not found", item_id)))?;

    // Parse owner/repo from full_name
    let parts: Vec<&str> = item.repo_full_name.split('/').collect();
    if parts.len() != 2 {
        return Err(GitHubError::Internal(format!("Invalid repo name: {}", item.repo_full_name)));
    }
    let owner = parts[0].to_string();
    let repo = parts[1].to_string();

    let labels = vec![
        "github-automate".to_string(),
        item.severity.clone(),
    ];

    let body = item.description.clone().unwrap_or_default();

    let issue = crate::github::issues::github_create_issue(
        owner, repo, item.title.clone(), body, labels,
    ).await?;

    // Update backlog item with issue URL
    {
        let conn = db.0.lock().map_err(|e| GitHubError::Internal(e.to_string()))?;
        conn.execute(
            "UPDATE backlog_items SET github_issue_url = ?1, status = 'in_progress', updated_at = ?2 WHERE id = ?3",
            rusqlite::params![issue.html_url, chrono::Utc::now().to_rfc3339(), item_id],
        ).map_err(|e| GitHubError::Internal(e.to_string()))?;
    }

    Ok(issue)
}

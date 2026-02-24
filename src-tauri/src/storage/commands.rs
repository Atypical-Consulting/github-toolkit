use tauri::State;
use crate::github::error::GitHubError;
use crate::github::types::RepoSummary;
use crate::diagnostics::types::RepoHealthReport;
use super::db::DbState;

#[tauri::command]
#[specta::specta]
pub fn persist_repos(
    repos: Vec<RepoSummary>,
    db: State<DbState>,
) -> Result<(), GitHubError> {
    super::repos::upsert_repos(&db, &repos)
        .map_err(|e| GitHubError::Internal(e))
}

#[tauri::command]
#[specta::specta]
pub fn load_cached_repos(
    db: State<DbState>,
) -> Result<Vec<RepoSummary>, GitHubError> {
    super::repos::list_repos(&db)
        .map_err(|e| GitHubError::Internal(e))
}

#[tauri::command]
#[specta::specta]
pub fn load_all_diagnostics(
    db: State<DbState>,
) -> Result<Vec<RepoHealthReport>, GitHubError> {
    super::diagnostics::list_all_latest_diagnostics(&db)
        .map_err(|e| GitHubError::Internal(e))
}

use tauri::{AppHandle, Emitter, State};
use crate::github::error::GitHubError;
use crate::github::types::RepoSummary;
use crate::storage::db::DbState;
use super::context::build_repo_context;
use super::engine::DiagnosticsEngine;
use super::types::{CachedRepoHealthReport, DiagnosticResult, RepoHealthReport, RuleInfo};
use serde::{Serialize, Deserialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub total: u32,
    pub completed: u32,
    pub current_repo: String,
    pub from_cache: bool,
}

#[tauri::command]
#[specta::specta]
pub fn list_diagnostic_rules() -> Vec<RuleInfo> {
    DiagnosticsEngine::new().list_rules()
}

#[tauri::command]
#[specta::specta]
pub async fn scan_repository(
    owner: String,
    repo: String,
) -> Result<RepoHealthReport, GitHubError> {
    // Fetch repo info first
    let path = format!("/repos/{}/{}", owner, repo);
    let resp = crate::github::client::github_get(&path).await?;
    let github_repo: crate::github::types::GitHubRepo = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse repo: {}", e)))?;

    let repo_summary = RepoSummary {
        full_name: github_repo.full_name,
        owner: github_repo.owner.login,
        name: github_repo.name,
        description: github_repo.description,
        default_branch: github_repo.default_branch,
        topics: github_repo.topics.unwrap_or_default(),
        is_archived: github_repo.archived,
        is_private: github_repo.private,
        has_issues: github_repo.has_issues,
        open_issues_count: github_repo.open_issues_count,
        pushed_at: github_repo.pushed_at,
        html_url: github_repo.html_url,
        license_name: github_repo.license.map(|l| l.name),
    };

    let ctx = build_repo_context(&repo_summary).await?;
    let engine = DiagnosticsEngine::new();
    Ok(engine.run(&ctx))
}

#[tauri::command]
#[specta::specta]
pub async fn scan_all_repositories(
    repos: Vec<RepoSummary>,
    app_handle: AppHandle,
    db: State<'_, DbState>,
) -> Result<Vec<CachedRepoHealthReport>, GitHubError> {
    let engine = DiagnosticsEngine::new();
    let total = repos.len() as u32;
    let mut reports = Vec::new();

    for (i, repo) in repos.iter().enumerate() {
        let _ = app_handle.emit("scan-progress", ScanProgress {
            total,
            completed: i as u32,
            current_repo: repo.full_name.clone(),
            from_cache: false,
        });

        // 1. Fetch current HEAD SHA
        let sha_result = crate::github::repos::fetch_default_branch_sha(
            &repo.owner,
            &repo.name,
            &repo.default_branch,
        ).await;

        let current_sha = match sha_result {
            Ok(sha) => sha,
            Err(e) => {
                eprintln!("Failed to fetch SHA for {}: {:?}", repo.full_name, e);
                reports.push(CachedRepoHealthReport {
                    report: RepoHealthReport {
                        repo_full_name: repo.full_name.clone(),
                        owner: repo.owner.clone(),
                        repo_name: repo.name.clone(),
                        health_score: 0.0,
                        critical_count: 0,
                        warning_count: 0,
                        info_count: 0,
                        results: vec![],
                        scanned_at: chrono::Utc::now().to_rfc3339(),
                    },
                    commit_sha: String::new(),
                    from_cache: false,
                });
                continue;
            }
        };

        // 2. Check for cached individual rule results for this commit
        let cached_rules = crate::storage::diagnostics::get_rule_results_for_commit(
            &db, &repo.full_name, &current_sha,
        ).map_err(|e| GitHubError::Internal(e))?;

        let all_rule_ids: Vec<String> = engine.list_rules().iter().map(|r| r.id.clone()).collect();
        let cached_rule_ids: std::collections::HashSet<String> = cached_rules.iter().map(|r| r.rule_id.clone()).collect();
        let missing_rule_ids: Vec<&String> = all_rule_ids.iter().filter(|id| !cached_rule_ids.contains(id.as_str())).collect();

        let from_cache = missing_rule_ids.is_empty();

        let results = if from_cache {
            // All rules already scanned for this commit — use cache
            cached_rules
        } else {
            // Some rules missing — run a full scan and store each rule individually
            match build_repo_context(repo).await {
                Ok(ctx) => {
                    let fresh_report = engine.run(&ctx);
                    // Save each rule result individually
                    for result in &fresh_report.results {
                        if let Err(e) = crate::storage::diagnostics::upsert_rule_result(
                            &db, &repo.full_name, &current_sha, result, &fresh_report.scanned_at,
                        ) {
                            eprintln!("Failed to save rule result {}: {}", result.rule_id, e);
                        }
                    }
                    // Also save the aggregate report (best-effort)
                    let session_id = uuid::Uuid::new_v4().to_string();
                    if let Err(e) = crate::storage::diagnostics::insert_diagnostic_result(
                        &db, &session_id, &fresh_report, Some(&current_sha),
                    ) {
                        eprintln!("Failed to save aggregate diagnostic: {}", e);
                    }
                    fresh_report.results
                }
                Err(e) => {
                    eprintln!("Failed to scan {}: {:?}", repo.full_name, e);
                    vec![]
                }
            }
        };

        // Recompute aggregate from the individual results
        let report = build_report_from_results(&repo.full_name, &repo.owner, &repo.name, &results);

        let _ = app_handle.emit("scan-progress", ScanProgress {
            total,
            completed: (i + 1) as u32,
            current_repo: repo.full_name.clone(),
            from_cache,
        });

        reports.push(CachedRepoHealthReport {
            report,
            commit_sha: current_sha,
            from_cache,
        });
    }

    let _ = app_handle.emit("scan-progress", ScanProgress {
        total,
        completed: total,
        current_repo: String::new(),
        from_cache: false,
    });

    Ok(reports)
}

/// Build a RepoHealthReport from individual DiagnosticResult entries.
fn build_report_from_results(
    full_name: &str,
    owner: &str,
    repo_name: &str,
    results: &[DiagnosticResult],
) -> RepoHealthReport {
    use super::types::Severity;

    let mut critical_count = 0u32;
    let mut warning_count = 0u32;
    let mut info_count = 0u32;
    let mut total_weight = 0.0f64;
    let mut passed_weight = 0.0f64;

    for result in results {
        let weight = result.severity.weight();
        total_weight += weight;
        if result.passed {
            passed_weight += weight;
        } else {
            match result.severity {
                Severity::Critical => critical_count += 1,
                Severity::Warning => warning_count += 1,
                Severity::Info => info_count += 1,
            }
        }
    }

    let health_score = if total_weight > 0.0 {
        (passed_weight / total_weight) * 100.0
    } else {
        100.0
    };

    RepoHealthReport {
        repo_full_name: full_name.to_string(),
        owner: owner.to_string(),
        repo_name: repo_name.to_string(),
        health_score,
        critical_count,
        warning_count,
        info_count,
        results: results.to_vec(),
        scanned_at: chrono::Utc::now().to_rfc3339(),
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_repo_diagnostics(
    repo_full_name: String,
    db: State<DbState>,
) -> Result<Option<RepoHealthReport>, GitHubError> {
    // Try the individual rule results table first (canonical source)
    let rule_results = crate::storage::diagnostics::get_latest_rule_results_for_repo(&db, &repo_full_name)
        .map_err(|e| GitHubError::Internal(e))?;

    if let Some((results, _sha)) = rule_results {
        let parts: Vec<&str> = repo_full_name.split('/').collect();
        let owner = parts.first().unwrap_or(&"").to_string();
        let repo_name = parts.get(1).unwrap_or(&"").to_string();
        let report = build_report_from_results(&repo_full_name, &owner, &repo_name, &results);
        return Ok(Some(report));
    }

    // Fall back to the aggregate table
    crate::storage::diagnostics::get_latest_diagnostic_for_repo(&db, &repo_full_name)
        .map(|opt| opt.map(|(report, _sha)| report))
        .map_err(|e| GitHubError::Internal(e))
}

#[tauri::command]
#[specta::specta]
pub async fn scan_repository_cached(
    owner: String,
    repo: String,
    default_branch: String,
    db: State<'_, DbState>,
) -> Result<CachedRepoHealthReport, GitHubError> {
    let full_name = format!("{}/{}", owner, repo);

    // 1. Fetch current HEAD SHA for the default branch
    let current_sha = crate::github::repos::fetch_default_branch_sha(&owner, &repo, &default_branch).await?;

    // 2. Check for cached individual rule results for this commit
    let cached_rules = crate::storage::diagnostics::get_rule_results_for_commit(
        &db, &full_name, &current_sha,
    ).map_err(|e| GitHubError::Internal(e))?;

    let engine = DiagnosticsEngine::new();
    let all_rule_ids: Vec<String> = engine.list_rules().iter().map(|r| r.id.clone()).collect();
    let cached_rule_ids: std::collections::HashSet<String> = cached_rules.iter().map(|r| r.rule_id.clone()).collect();
    let all_cached = all_rule_ids.iter().all(|id| cached_rule_ids.contains(id.as_str()));

    if all_cached {
        let report = build_report_from_results(&full_name, &owner, &repo, &cached_rules);
        return Ok(CachedRepoHealthReport {
            report,
            commit_sha: current_sha,
            from_cache: true,
        });
    }

    // 3. No full cache hit — run a fresh scan
    let api_path = format!("/repos/{}/{}", owner, repo);
    let resp = crate::github::client::github_get(&api_path).await?;
    let github_repo: crate::github::types::GitHubRepo = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse repo: {}", e)))?;

    let repo_summary = RepoSummary {
        full_name: github_repo.full_name,
        owner: github_repo.owner.login,
        name: github_repo.name,
        description: github_repo.description,
        default_branch: github_repo.default_branch,
        topics: github_repo.topics.unwrap_or_default(),
        is_archived: github_repo.archived,
        is_private: github_repo.private,
        has_issues: github_repo.has_issues,
        open_issues_count: github_repo.open_issues_count,
        pushed_at: github_repo.pushed_at,
        html_url: github_repo.html_url,
        license_name: github_repo.license.map(|l| l.name),
    };

    let ctx = build_repo_context(&repo_summary).await?;
    let report = engine.run(&ctx);

    // 4. Store each rule result individually
    for result in &report.results {
        if let Err(e) = crate::storage::diagnostics::upsert_rule_result(
            &db, &full_name, &current_sha, result, &report.scanned_at,
        ) {
            eprintln!("Failed to save rule result {}: {}", result.rule_id, e);
        }
    }

    // Also save the aggregate report (best-effort, don't fail the scan)
    let session_id = uuid::Uuid::new_v4().to_string();
    if let Err(e) = crate::storage::diagnostics::insert_diagnostic_result(
        &db, &session_id, &report, Some(&current_sha),
    ) {
        eprintln!("Failed to save aggregate diagnostic: {}", e);
    }

    Ok(CachedRepoHealthReport {
        report,
        commit_sha: current_sha,
        from_cache: false,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn scan_single_diagnostic(
    owner: String,
    repo: String,
    rule_id: String,
    db: State<'_, DbState>,
) -> Result<DiagnosticResult, GitHubError> {
    let full_name = format!("{}/{}", owner, repo);

    // Fetch repo info
    let api_path = format!("/repos/{}/{}", owner, repo);
    let resp = crate::github::client::github_get(&api_path).await?;
    let github_repo: crate::github::types::GitHubRepo = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse repo: {}", e)))?;

    let default_branch = github_repo.default_branch.clone();

    let repo_summary = RepoSummary {
        full_name: github_repo.full_name,
        owner: github_repo.owner.login,
        name: github_repo.name,
        description: github_repo.description,
        default_branch: github_repo.default_branch,
        topics: github_repo.topics.unwrap_or_default(),
        is_archived: github_repo.archived,
        is_private: github_repo.private,
        has_issues: github_repo.has_issues,
        open_issues_count: github_repo.open_issues_count,
        pushed_at: github_repo.pushed_at,
        html_url: github_repo.html_url,
        license_name: github_repo.license.map(|l| l.name),
    };

    let ctx = build_repo_context(&repo_summary).await?;
    let engine = DiagnosticsEngine::new();

    let result = engine
        .run_single(&ctx, &rule_id)
        .ok_or_else(|| GitHubError::NotFound(format!("Unknown rule: {}", rule_id)))?;

    // Persist this individual rule result with the current commit SHA
    if let Ok(current_sha) = crate::github::repos::fetch_default_branch_sha(&owner, &repo, &default_branch).await {
        let scanned_at = chrono::Utc::now().to_rfc3339();
        let _ = crate::storage::diagnostics::upsert_rule_result(
            &db, &full_name, &current_sha, &result, &scanned_at,
        );
    }

    Ok(result)
}

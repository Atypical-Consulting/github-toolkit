use rusqlite::params;
use crate::diagnostics::types::{DiagnosticResult, RepoHealthReport, Severity};
use super::db::DbState;

pub fn insert_diagnostic_result(
    db: &DbState,
    session_id: &str,
    report: &RepoHealthReport,
    commit_sha: Option<&str>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let results_json = serde_json::to_string(&report.results).unwrap_or_default();
    conn.execute(
        "INSERT INTO diagnostic_results (scan_session_id, repo_full_name, health_score, critical_count, warning_count, info_count, results_json, scanned_at, commit_sha)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            session_id,
            report.repo_full_name,
            report.health_score,
            report.critical_count,
            report.warning_count,
            report.info_count,
            results_json,
            report.scanned_at,
            commit_sha,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_cached_diagnostic(
    db: &DbState,
    repo_full_name: &str,
    commit_sha: &str,
) -> Result<Option<RepoHealthReport>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT health_score, critical_count, warning_count, info_count, results_json, scanned_at
         FROM diagnostic_results
         WHERE repo_full_name = ?1 AND commit_sha = ?2
         ORDER BY scanned_at DESC LIMIT 1"
    ).map_err(|e| e.to_string())?;

    let result = stmt.query_row(
        params![repo_full_name, commit_sha],
        |row| {
            Ok((
                row.get::<_, f64>(0)?,
                row.get::<_, u32>(1)?,
                row.get::<_, u32>(2)?,
                row.get::<_, u32>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        },
    );

    match result {
        Ok((health_score, critical_count, warning_count, info_count, results_json, scanned_at)) => {
            let results: Vec<DiagnosticResult> =
                serde_json::from_str(&results_json).unwrap_or_default();
            let parts: Vec<&str> = repo_full_name.split('/').collect();
            Ok(Some(RepoHealthReport {
                repo_full_name: repo_full_name.to_string(),
                owner: parts.first().unwrap_or(&"").to_string(),
                repo_name: parts.get(1).unwrap_or(&"").to_string(),
                health_score,
                critical_count,
                warning_count,
                info_count,
                results,
                scanned_at,
            }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Insert or replace a single rule result for a repo+commit.
pub fn upsert_rule_result(
    db: &DbState,
    repo_full_name: &str,
    commit_sha: &str,
    result: &DiagnosticResult,
    scanned_at: &str,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let severity_str = match result.severity {
        Severity::Critical => "critical",
        Severity::Warning => "warning",
        Severity::Info => "info",
    };
    conn.execute(
        "INSERT INTO diagnostic_rule_results (repo_full_name, commit_sha, rule_id, rule_name, severity, passed, message, scanned_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(repo_full_name, commit_sha, rule_id) DO UPDATE SET
           rule_name = excluded.rule_name,
           severity = excluded.severity,
           passed = excluded.passed,
           message = excluded.message,
           scanned_at = excluded.scanned_at",
        params![
            repo_full_name,
            commit_sha,
            result.rule_id,
            result.rule_name,
            severity_str,
            result.passed as i32,
            result.message,
            scanned_at,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get all rule results for a repo+commit from the individual rule results table.
pub fn get_rule_results_for_commit(
    db: &DbState,
    repo_full_name: &str,
    commit_sha: &str,
) -> Result<Vec<DiagnosticResult>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT rule_id, rule_name, severity, passed, message
         FROM diagnostic_rule_results
         WHERE repo_full_name = ?1 AND commit_sha = ?2
         ORDER BY rule_id"
    ).map_err(|e| e.to_string())?;

    let results = stmt.query_map(params![repo_full_name, commit_sha], |row| {
        let severity_str: String = row.get(2)?;
        let passed: i32 = row.get(3)?;
        Ok(DiagnosticResult {
            rule_id: row.get(0)?,
            rule_name: row.get(1)?,
            severity: match severity_str.as_str() {
                "critical" => Severity::Critical,
                "warning" => Severity::Warning,
                _ => Severity::Info,
            },
            passed: passed != 0,
            message: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    results.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Get the latest rule results for a repo (from the most recent commit).
pub fn get_latest_rule_results_for_repo(
    db: &DbState,
    repo_full_name: &str,
) -> Result<Option<(Vec<DiagnosticResult>, String)>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Find the most recent commit_sha for this repo
    let sha_result: Result<(String,), _> = conn.query_row(
        "SELECT commit_sha FROM diagnostic_rule_results
         WHERE repo_full_name = ?1
         ORDER BY scanned_at DESC LIMIT 1",
        params![repo_full_name],
        |row| Ok((row.get(0)?,)),
    );

    let commit_sha = match sha_result {
        Ok((sha,)) => sha,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };

    // Get all rule results for that commit
    let mut stmt = conn.prepare(
        "SELECT rule_id, rule_name, severity, passed, message
         FROM diagnostic_rule_results
         WHERE repo_full_name = ?1 AND commit_sha = ?2
         ORDER BY rule_id"
    ).map_err(|e| e.to_string())?;

    let results: Vec<DiagnosticResult> = stmt
        .query_map(params![repo_full_name, &commit_sha], |row| {
            let severity_str: String = row.get(2)?;
            let passed: i32 = row.get(3)?;
            Ok(DiagnosticResult {
                rule_id: row.get(0)?,
                rule_name: row.get(1)?,
                severity: match severity_str.as_str() {
                    "critical" => Severity::Critical,
                    "warning" => Severity::Warning,
                    _ => Severity::Info,
                },
                passed: passed != 0,
                message: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if results.is_empty() {
        Ok(None)
    } else {
        Ok(Some((results, commit_sha)))
    }
}

pub fn get_latest_diagnostic_for_repo(
    db: &DbState,
    repo_full_name: &str,
) -> Result<Option<(RepoHealthReport, Option<String>)>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT health_score, critical_count, warning_count, info_count, results_json, scanned_at, commit_sha
         FROM diagnostic_results
         WHERE repo_full_name = ?1
         ORDER BY scanned_at DESC LIMIT 1"
    ).map_err(|e| e.to_string())?;

    let result = stmt.query_row(params![repo_full_name], |row| {
        Ok((
            row.get::<_, f64>(0)?,
            row.get::<_, u32>(1)?,
            row.get::<_, u32>(2)?,
            row.get::<_, u32>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?,
        ))
    });

    match result {
        Ok((health_score, critical_count, warning_count, info_count, results_json, scanned_at, commit_sha)) => {
            let results: Vec<DiagnosticResult> =
                serde_json::from_str(&results_json).unwrap_or_default();
            let parts: Vec<&str> = repo_full_name.split('/').collect();
            Ok(Some((
                RepoHealthReport {
                    repo_full_name: repo_full_name.to_string(),
                    owner: parts.first().unwrap_or(&"").to_string(),
                    repo_name: parts.get(1).unwrap_or(&"").to_string(),
                    health_score,
                    critical_count,
                    warning_count,
                    info_count,
                    results,
                    scanned_at,
                },
                commit_sha,
            )))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Load diagnostic reports for every repo from the individual rule results table.
/// Groups rule results by (repo_full_name, commit_sha) and picks the latest commit per repo.
pub fn list_all_latest_diagnostics(
    db: &DbState,
) -> Result<Vec<RepoHealthReport>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // For each repo, find the commit_sha with the most recent scanned_at
    let mut latest_stmt = conn.prepare(
        "SELECT repo_full_name, commit_sha, MAX(scanned_at) as latest
         FROM diagnostic_rule_results
         GROUP BY repo_full_name"
    ).map_err(|e| e.to_string())?;

    let latest_rows: Vec<(String, String)> = latest_stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // For each (repo, sha), gather all rule results and build a report
    let mut reports = Vec::new();
    let mut rules_stmt = conn.prepare(
        "SELECT rule_id, rule_name, severity, passed, message, scanned_at
         FROM diagnostic_rule_results
         WHERE repo_full_name = ?1 AND commit_sha = ?2
         ORDER BY rule_id"
    ).map_err(|e| e.to_string())?;

    for (full_name, sha) in &latest_rows {
        let results: Vec<DiagnosticResult> = rules_stmt
            .query_map(params![full_name, sha], |row| {
                let severity_str: String = row.get(2)?;
                let passed: i32 = row.get(3)?;
                Ok(DiagnosticResult {
                    rule_id: row.get(0)?,
                    rule_name: row.get(1)?,
                    severity: match severity_str.as_str() {
                        "critical" => Severity::Critical,
                        "warning" => Severity::Warning,
                        _ => Severity::Info,
                    },
                    passed: passed != 0,
                    message: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        if results.is_empty() {
            continue;
        }

        // Compute aggregate scores
        let mut critical_count = 0u32;
        let mut warning_count = 0u32;
        let mut info_count = 0u32;
        let mut total_weight = 0.0f64;
        let mut passed_weight = 0.0f64;

        for r in &results {
            let weight = r.severity.weight();
            total_weight += weight;
            if r.passed {
                passed_weight += weight;
            } else {
                match r.severity {
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

        let (owner, repo_name) = match full_name.split_once('/') {
            Some((o, r)) => (o.to_string(), r.to_string()),
            None => (full_name.clone(), String::new()),
        };

        reports.push(RepoHealthReport {
            repo_full_name: full_name.clone(),
            owner,
            repo_name,
            health_score,
            critical_count,
            warning_count,
            info_count,
            results,
            scanned_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    Ok(reports)
}

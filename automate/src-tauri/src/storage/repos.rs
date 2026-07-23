use rusqlite::params;
use crate::github::types::RepoSummary;
use super::db::DbState;

pub fn upsert_repo(db: &DbState, repo: &RepoSummary) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let topics_json = serde_json::to_string(&repo.topics).unwrap_or_default();
    conn.execute(
        "INSERT INTO repositories (full_name, owner, name, description, topics, is_archived, is_private, has_issues, open_issues_count, pushed_at, html_url, license_name, default_branch, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(full_name) DO UPDATE SET
            owner = ?2, name = ?3, description = ?4, topics = ?5, is_archived = ?6,
            is_private = ?7, has_issues = ?8, open_issues_count = ?9, pushed_at = ?10,
            html_url = ?11, license_name = ?12, default_branch = ?13, updated_at = ?14",
        params![
            repo.full_name,
            repo.owner,
            repo.name,
            repo.description,
            topics_json,
            repo.is_archived as i32,
            repo.is_private as i32,
            repo.has_issues as i32,
            repo.open_issues_count,
            repo.pushed_at,
            repo.html_url,
            repo.license_name,
            repo.default_branch,
            chrono::Utc::now().to_rfc3339(),
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upsert_repos(db: &DbState, repos: &[RepoSummary]) -> Result<(), String> {
    for repo in repos {
        upsert_repo(db, repo)?;
    }
    Ok(())
}

pub fn list_repos(db: &DbState) -> Result<Vec<RepoSummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT full_name, owner, name, description, topics, is_archived, is_private, has_issues, open_issues_count, pushed_at, html_url, license_name, default_branch
         FROM repositories
         ORDER BY pushed_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        let topics_json: String = row.get::<_, Option<String>>(4)?.unwrap_or_default();
        let topics: Vec<String> = serde_json::from_str(&topics_json).unwrap_or_default();
        Ok(RepoSummary {
            full_name: row.get(0)?,
            owner: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            topics,
            is_archived: row.get::<_, i32>(5)? != 0,
            is_private: row.get::<_, Option<i32>>(6)?.unwrap_or(0) != 0,
            has_issues: row.get::<_, Option<i32>>(7)?.unwrap_or(1) != 0,
            open_issues_count: row.get::<_, Option<u32>>(8)?.unwrap_or(0),
            pushed_at: row.get(9)?,
            html_url: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
            license_name: row.get(11)?,
            default_branch: row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "main".to_string()),
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

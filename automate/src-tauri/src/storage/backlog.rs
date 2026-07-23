use rusqlite::params;
use serde::{Deserialize, Serialize};
use specta::Type;
use super::db::DbState;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BacklogItem {
    pub id: String,
    pub repo_full_name: String,
    pub source: String,
    pub source_ref: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub severity: String,
    pub status: String,
    pub priority_score: i32,
    pub github_issue_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BacklogFilters {
    pub owner: Option<String>,
    pub repo: Option<String>,
    pub severity: Option<String>,
    pub status: Option<String>,
    pub source: Option<String>,
}

pub fn insert_backlog_item(db: &DbState, item: &BacklogItem) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO backlog_items (id, repo_full_name, source, source_ref, title, description, severity, status, priority_score, github_issue_url, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            item.id,
            item.repo_full_name,
            item.source,
            item.source_ref,
            item.title,
            item.description,
            item.severity,
            item.status,
            item.priority_score,
            item.github_issue_url,
            item.created_at,
            item.updated_at,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_backlog_items(db: &DbState, filters: &BacklogFilters) -> Result<Vec<BacklogItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut sql = "SELECT id, repo_full_name, source, source_ref, title, description, severity, status, priority_score, github_issue_url, created_at, updated_at FROM backlog_items WHERE 1=1".to_string();
    let mut param_values: Vec<String> = Vec::new();

    if let Some(ref owner) = filters.owner {
        param_values.push(format!("{}/%", owner));
        sql.push_str(&format!(" AND repo_full_name LIKE ?{}", param_values.len()));
    }
    if let Some(ref severity) = filters.severity {
        param_values.push(severity.clone());
        sql.push_str(&format!(" AND severity = ?{}", param_values.len()));
    }
    if let Some(ref status) = filters.status {
        param_values.push(status.clone());
        sql.push_str(&format!(" AND status = ?{}", param_values.len()));
    }
    if let Some(ref source) = filters.source {
        param_values.push(source.clone());
        sql.push_str(&format!(" AND source = ?{}", param_values.len()));
    }

    sql.push_str(" ORDER BY priority_score DESC, created_at DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();
    let items = stmt
        .query_map(params.as_slice(), |row| {
            Ok(BacklogItem {
                id: row.get(0)?,
                repo_full_name: row.get(1)?,
                source: row.get(2)?,
                source_ref: row.get(3)?,
                title: row.get(4)?,
                description: row.get(5)?,
                severity: row.get(6)?,
                status: row.get(7)?,
                priority_score: row.get(8)?,
                github_issue_url: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

pub fn update_backlog_status(db: &DbState, id: &str, status: &str) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE backlog_items SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, chrono::Utc::now().to_rfc3339(), id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_backlog_item(db: &DbState, id: &str) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM backlog_items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn backlog_item_exists(db: &DbState, repo_full_name: &str, source_ref: &str) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM backlog_items WHERE repo_full_name = ?1 AND source_ref = ?2",
        params![repo_full_name, source_ref],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(count > 0)
}

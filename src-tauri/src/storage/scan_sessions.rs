use rusqlite::params;
use super::db::DbState;

pub fn insert_session(db: &DbState, session_id: &str, total_repos: u32) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO scan_sessions (id, started_at, total_repos, scanned_repos)
         VALUES (?1, ?2, ?3, 0)",
        params![
            session_id,
            chrono::Utc::now().to_rfc3339(),
            total_repos,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

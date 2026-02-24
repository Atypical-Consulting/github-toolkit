use std::path::Path;
use std::sync::Mutex;
use rusqlite::Connection;

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(app_data_dir: &Path) -> Result<Connection, rusqlite::Error> {
    std::fs::create_dir_all(app_data_dir).ok();
    let db_path = app_data_dir.join("github-automate.db");
    let conn = Connection::open(db_path)?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS scan_sessions (
            id TEXT PRIMARY KEY,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            total_repos INTEGER NOT NULL,
            scanned_repos INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS repositories (
            full_name TEXT PRIMARY KEY,
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            topics TEXT,
            is_archived INTEGER DEFAULT 0,
            pushed_at TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS diagnostic_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_session_id TEXT NOT NULL REFERENCES scan_sessions(id),
            repo_full_name TEXT NOT NULL REFERENCES repositories(full_name),
            health_score REAL NOT NULL,
            critical_count INTEGER NOT NULL,
            warning_count INTEGER NOT NULL,
            info_count INTEGER NOT NULL,
            results_json TEXT NOT NULL,
            scanned_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS backlog_items (
            id TEXT PRIMARY KEY,
            repo_full_name TEXT NOT NULL,
            source TEXT NOT NULL,
            source_ref TEXT,
            title TEXT NOT NULL,
            description TEXT,
            severity TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'todo',
            priority_score INTEGER DEFAULT 0,
            github_issue_url TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    ")?;

    // Migrations — add columns if they don't exist yet
    // .ok() swallows "duplicate column name" errors on subsequent launches
    conn.execute_batch("
        ALTER TABLE repositories ADD COLUMN default_branch TEXT;
    ").ok();
    conn.execute_batch("
        ALTER TABLE repositories ADD COLUMN last_commit_sha TEXT;
    ").ok();
    conn.execute_batch("
        ALTER TABLE diagnostic_results ADD COLUMN commit_sha TEXT;
    ").ok();

    // Add missing columns to repositories
    conn.execute_batch("ALTER TABLE repositories ADD COLUMN is_private INTEGER DEFAULT 0;").ok();
    conn.execute_batch("ALTER TABLE repositories ADD COLUMN has_issues INTEGER DEFAULT 1;").ok();
    conn.execute_batch("ALTER TABLE repositories ADD COLUMN open_issues_count INTEGER DEFAULT 0;").ok();
    conn.execute_batch("ALTER TABLE repositories ADD COLUMN html_url TEXT DEFAULT '';").ok();
    conn.execute_batch("ALTER TABLE repositories ADD COLUMN license_name TEXT;").ok();

    // Individual rule results table — one row per rule per repo per scan
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS diagnostic_rule_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_full_name TEXT NOT NULL,
            commit_sha TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            rule_name TEXT NOT NULL,
            severity TEXT NOT NULL,
            passed INTEGER NOT NULL,
            message TEXT NOT NULL,
            scanned_at TEXT NOT NULL,
            UNIQUE(repo_full_name, commit_sha, rule_id)
        );
    ")?;

    Ok(conn)
}

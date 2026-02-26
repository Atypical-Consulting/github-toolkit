mod github;
mod diagnostics;
mod storage;
mod backlog;

use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{Builder, collect_commands};

use github::{
    github_start_device_flow, github_poll_auth, github_get_auth_status, github_sign_out,
    github_list_user_repos, github_list_org_repos, github_get_repo_contents, github_get_file_content,
    github_create_issue, github_check_rate_limit,
};
use diagnostics::{get_repo_diagnostics, list_diagnostic_rules, scan_all_repositories, scan_repository, scan_repository_cached, scan_single_diagnostic, cancel_scan, ScanCancellationFlag};
use storage::{persist_repos, load_cached_repos, load_all_diagnostics};
use backlog::{
    generate_backlog_from_scan, list_backlog, update_backlog_item_status,
    delete_backlog, create_github_issue_from_backlog,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        // Auth commands
        github_start_device_flow,
        github_poll_auth,
        github_get_auth_status,
        github_sign_out,
        // Repo commands
        github_list_user_repos,
        github_list_org_repos,
        github_get_repo_contents,
        github_get_file_content,
        // Issue commands
        github_create_issue,
        // Rate limit
        github_check_rate_limit,
        // Diagnostic commands
        scan_repository,
        scan_all_repositories,
        scan_repository_cached,
        get_repo_diagnostics,
        scan_single_diagnostic,
        list_diagnostic_rules,
        cancel_scan,
        // Storage / cache commands
        persist_repos,
        load_cached_repos,
        load_all_diagnostics,
        // Backlog commands
        generate_backlog_from_scan,
        list_backlog,
        update_backlog_item_status,
        delete_backlog,
        create_github_issue_from_backlog,
    ]);

    #[cfg(debug_assertions)]
    {
        builder
            .export(Typescript::default(), "../src/bindings.ts")
            .expect("Failed to export TypeScript bindings");

        // Fix tauri-specta bug: generated `export type TAURI_CHANNEL<TSend> = null`
        let bindings_path = std::path::Path::new("../src/bindings.ts");
        if let Ok(content) = std::fs::read_to_string(bindings_path) {
            let fixed = content.replace("export type TAURI_CHANNEL<TSend> = null\n", "");
            std::fs::write(bindings_path, fixed).ok();
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            // Initialize SQLite database
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            let conn = storage::init_db(&app_data_dir).expect("Failed to initialize database");
            app.manage(storage::DbState(std::sync::Mutex::new(conn)));
            app.manage(ScanCancellationFlag(std::sync::atomic::AtomicBool::new(false)));

            builder.mount_events(app);

            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use super::client;
use super::error::GitHubError;
use super::types::{
    ContentEntry, FileContent, GitHubContentEntry, GitHubFileContent, GitHubRepo, RepoListResponse,
    RepoSummary,
};

pub async fn fetch_default_branch_sha(
    owner: &str,
    repo: &str,
    branch: &str,
) -> Result<String, GitHubError> {
    let path = format!("/repos/{}/{}/branches/{}", owner, repo, branch);
    let resp = client::github_get(&path).await?;
    let branch_info: super::types::GitHubBranch = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse branch: {}", e)))?;
    Ok(branch_info.commit.sha)
}

fn github_repo_to_summary(repo: GitHubRepo) -> RepoSummary {
    RepoSummary {
        full_name: repo.full_name,
        owner: repo.owner.login,
        name: repo.name,
        description: repo.description,
        default_branch: repo.default_branch,
        topics: repo.topics.unwrap_or_default(),
        is_archived: repo.archived,
        is_private: repo.private,
        has_issues: repo.has_issues,
        open_issues_count: repo.open_issues_count,
        pushed_at: repo.pushed_at,
        html_url: repo.html_url,
        license_name: repo.license.map(|l| l.name),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn github_list_user_repos(
    page: u32,
    per_page: u32,
) -> Result<RepoListResponse, GitHubError> {
    let path = "/user/repos";
    let page_str = page.to_string();
    let per_page_str = per_page.to_string();
    let params = [
        ("page", page_str.as_str()),
        ("per_page", per_page_str.as_str()),
        ("sort", "pushed"),
        ("direction", "desc"),
        ("type", "owner"),
    ];

    let resp = client::github_get_with_params(path, &params).await?;

    let link_header = resp
        .headers()
        .get("link")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    let repos: Vec<GitHubRepo> = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse repo list: {}", e)))?;

    let items: Vec<RepoSummary> = repos.into_iter().map(github_repo_to_summary).collect();

    let (has_next_page, next_page) = match &link_header {
        Some(header) => {
            let next = client::parse_next_page(header);
            (next.is_some(), next)
        }
        None => (false, None),
    };

    Ok(RepoListResponse {
        items,
        has_next_page,
        next_page,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn github_list_org_repos(
    org: String,
    page: u32,
    per_page: u32,
) -> Result<RepoListResponse, GitHubError> {
    let path = format!("/orgs/{}/repos", org);
    let page_str = page.to_string();
    let per_page_str = per_page.to_string();
    let params = [
        ("page", page_str.as_str()),
        ("per_page", per_page_str.as_str()),
        ("sort", "pushed"),
        ("direction", "desc"),
        ("type", "all"),
    ];

    let resp = client::github_get_with_params(&path, &params).await?;

    let link_header = resp
        .headers()
        .get("link")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    let repos: Vec<GitHubRepo> = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse org repo list: {}", e)))?;

    let items: Vec<RepoSummary> = repos.into_iter().map(github_repo_to_summary).collect();

    let (has_next_page, next_page) = match &link_header {
        Some(header) => {
            let next = client::parse_next_page(header);
            (next.is_some(), next)
        }
        None => (false, None),
    };

    Ok(RepoListResponse {
        items,
        has_next_page,
        next_page,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn github_get_repo_contents(
    owner: String,
    repo: String,
    path: String,
) -> Result<Vec<ContentEntry>, GitHubError> {
    let api_path = format!("/repos/{}/{}/contents/{}", owner, repo, path);
    let resp = client::github_get(&api_path).await?;

    let entries: Vec<GitHubContentEntry> = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse contents: {}", e)))?;

    Ok(entries
        .into_iter()
        .map(|e| ContentEntry {
            name: e.name,
            entry_type: e.entry_type,
            path: e.path,
            size: e.size.map(|s| s as u32),
        })
        .collect())
}

#[tauri::command]
#[specta::specta]
pub async fn github_get_file_content(
    owner: String,
    repo: String,
    path: String,
) -> Result<FileContent, GitHubError> {
    let api_path = format!("/repos/{}/{}/contents/{}", owner, repo, path);
    let resp = client::github_get(&api_path).await?;

    let file: GitHubFileContent = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse file content: {}", e)))?;

    let decoded_content = if let Some(content) = &file.content {
        // GitHub returns base64-encoded content with newlines
        let cleaned = content.replace('\n', "");
        String::from_utf8(
            base64_decode(&cleaned)
                .map_err(|e| GitHubError::Internal(format!("Base64 decode error: {}", e)))?,
        )
        .map_err(|e| GitHubError::Internal(format!("UTF-8 decode error: {}", e)))?
    } else {
        String::new()
    };

    Ok(FileContent {
        name: file.name,
        path: file.path,
        content: decoded_content,
        size: file.size as u32,
    })
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // Simple base64 decoder
    use std::collections::HashMap;
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut table: HashMap<u8, u8> = HashMap::new();
    for (i, &c) in alphabet.iter().enumerate() {
        table.insert(c, i as u8);
    }

    let input = input.as_bytes();
    let mut output = Vec::new();
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;

    for &byte in input {
        if byte == b'=' {
            break;
        }
        if byte == b'\n' || byte == b'\r' || byte == b' ' {
            continue;
        }
        let val = table
            .get(&byte)
            .ok_or_else(|| format!("Invalid base64 character: {}", byte as char))?;
        buf = (buf << 6) | (*val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }

    Ok(output)
}

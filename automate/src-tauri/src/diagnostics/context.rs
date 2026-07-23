use crate::github::client;
use crate::github::error::GitHubError;
use crate::github::types::{GitHubContentEntry, GitHubFileContent, RepoSummary};
use super::types::RepoContext;

pub async fn build_repo_context(repo: &RepoSummary) -> Result<RepoContext, GitHubError> {
    let owner = &repo.owner;
    let repo_name = &repo.name;

    // Fetch root files
    let root_files = fetch_directory_names(owner, repo_name, "").await.unwrap_or_default();

    // Fetch workflow files
    let workflow_files = fetch_directory_names(owner, repo_name, ".github/workflows").await.unwrap_or_default();

    // Fetch README content if it exists
    let readme_file = root_files.iter().find(|f| f.to_lowercase().starts_with("readme"));
    let (readme_content, readme_line_count) = if let Some(readme) = readme_file {
        match fetch_file_content(owner, repo_name, readme).await {
            Ok(content) => {
                let line_count = content.lines().count() as u32;
                (Some(content), line_count)
            }
            Err(_) => (None, 0),
        }
    } else {
        (None, 0)
    };

    Ok(RepoContext {
        owner: owner.clone(),
        repo_name: repo_name.clone(),
        description: repo.description.clone(),
        topics: repo.topics.clone(),
        license_name: repo.license_name.clone(),
        root_files,
        workflow_files,
        readme_content,
        readme_line_count,
        pushed_at: repo.pushed_at.clone(),
    })
}

async fn fetch_directory_names(owner: &str, repo: &str, path: &str) -> Result<Vec<String>, GitHubError> {
    let api_path = format!("/repos/{}/{}/contents/{}", owner, repo, path);
    let resp = client::github_get(&api_path).await?;
    let entries: Vec<GitHubContentEntry> = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse contents: {}", e)))?;
    Ok(entries.into_iter().map(|e| e.name).collect())
}

async fn fetch_file_content(owner: &str, repo: &str, path: &str) -> Result<String, GitHubError> {
    let api_path = format!("/repos/{}/{}/contents/{}", owner, repo, path);
    let resp = client::github_get(&api_path).await?;
    let file: GitHubFileContent = resp
        .json()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse file: {}", e)))?;

    if let Some(content) = &file.content {
        let cleaned = content.replace('\n', "");
        let bytes = base64_decode(&cleaned)
            .map_err(|e| GitHubError::Internal(format!("Base64 decode error: {}", e)))?;
        String::from_utf8(bytes)
            .map_err(|e| GitHubError::Internal(format!("UTF-8 decode error: {}", e)))
    } else {
        Ok(String::new())
    }
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
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
        if byte == b'=' { break; }
        if byte == b'\n' || byte == b'\r' || byte == b' ' { continue; }
        let val = table.get(&byte).ok_or_else(|| format!("Invalid base64 char: {}", byte as char))?;
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

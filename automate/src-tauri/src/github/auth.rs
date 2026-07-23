use super::error::GitHubError;
use super::token;
use super::types::{AuthResult, DeviceFlowResponse};
use std::time::Duration;

const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";

// Scopes needed: repo, read:org
const GITHUB_CLIENT_ID: &str = "Ov23liGPdt9oE8quH9XV";

#[derive(Debug, serde::Deserialize)]
struct GitHubDeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u32,
    interval: u32,
}

#[derive(Debug, serde::Deserialize)]
struct GitHubTokenResponse {
    access_token: Option<String>,
    #[allow(dead_code)]
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn github_start_device_flow(
    scopes: Vec<String>,
) -> Result<DeviceFlowResponse, GitHubError> {
    let client = reqwest::Client::new();
    let scope_string = scopes.join(" ");

    let resp = client
        .post(GITHUB_DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("scope", scope_string.as_str()),
        ])
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(GitHubError::OAuthFailed(format!(
            "Device code request failed: {}",
            body
        )));
    }

    let raw: GitHubDeviceCodeResponse = resp
        .json()
        .await
        .map_err(|e| GitHubError::OAuthFailed(format!("Failed to parse response: {}", e)))?;

    Ok(DeviceFlowResponse {
        device_code: raw.device_code,
        user_code: raw.user_code,
        verification_uri: raw.verification_uri,
        expires_in: raw.expires_in,
        interval: raw.interval,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn github_poll_auth(
    device_code: String,
    interval: u32,
) -> Result<AuthResult, GitHubError> {
    let _ = interval;
    let client = reqwest::Client::new();

    let resp = client
        .post(GITHUB_ACCESS_TOKEN_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code.as_str()),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| GitHubError::NetworkError(e.to_string()))?;

    let data: GitHubTokenResponse = resp
        .json()
        .await
        .map_err(|e| GitHubError::OAuthFailed(format!("Failed to parse response: {}", e)))?;

    if let Some(error) = &data.error {
        return match error.as_str() {
            "authorization_pending" => Err(GitHubError::AuthorizationPending),
            "slow_down" => Err(GitHubError::SlowDown),
            "expired_token" => Err(GitHubError::ExpiredToken),
            "access_denied" => Err(GitHubError::AccessDenied),
            other => Err(GitHubError::OAuthFailed(other.to_string())),
        };
    }

    if let Some(access_token) = &data.access_token {
        token::store_token(access_token).await?;
        let user = token::fetch_github_user(&client, access_token).await?;
        let scopes = data
            .scope
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        return Ok(AuthResult {
            authenticated: true,
            username: Some(user.login),
            avatar_url: Some(user.avatar_url),
            scopes,
        });
    }

    Err(GitHubError::OAuthFailed(
        "No access token in response".to_string(),
    ))
}

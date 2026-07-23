use rmcp::model::{CallToolResult, Content};

/// Sanitize an error message by removing known secret patterns.
/// Strips bearer tokens (ghp_, gho_, github_pat_) and Authorization headers.
pub fn sanitize_error_message(raw: &str) -> String {
    let mut result = raw.to_string();
    // Strip GitHub tokens
    for prefix in &["ghp_", "gho_", "github_pat_"] {
        while let Some(start) = result.find(prefix) {
            let end = result[start..]
                .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ',')
                .map(|i| start + i)
                .unwrap_or(result.len());
            result.replace_range(start..end, "[REDACTED]");
        }
    }
    // Strip "Bearer <token>" patterns (case-insensitive)
    let lower = result.to_lowercase();
    if let Some(idx) = lower.find("bearer ") {
        let token_start = idx + 7;
        let token_end = result[token_start..]
            .find(|c: char| c.is_whitespace() || c == '"' || c == '\'')
            .map(|i| token_start + i)
            .unwrap_or(result.len());
        result.replace_range(idx..token_end, "Bearer [REDACTED]");
    }
    // Strip "authorization: <value>" patterns
    let lower = result.to_lowercase();
    if let Some(idx) = lower.find("authorization:") {
        let val_start = idx + 14;
        let val_end = result[val_start..]
            .find(|c: char| c == '\n' || c == '\r')
            .map(|i| val_start + i)
            .unwrap_or(result.len());
        result.replace_range(idx..val_end, "authorization: [REDACTED]");
    }
    result
}

/// Create a CallToolResult with is_error: true and sanitized message.
pub fn error_result(msg: impl std::fmt::Display) -> CallToolResult {
    let safe = sanitize_error_message(&msg.to_string());
    CallToolResult::error(vec![Content::text(safe)])
}

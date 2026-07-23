use super::rules::{self, DiagnosticRule};
use super::types::{DiagnosticResult, RepoContext, RepoHealthReport, RuleInfo, Severity};

pub struct DiagnosticsEngine {
    rules: Vec<Box<dyn DiagnosticRule>>,
}

impl DiagnosticsEngine {
    pub fn new() -> Self {
        Self {
            rules: rules::default_rules(),
        }
    }

    pub fn list_rules(&self) -> Vec<RuleInfo> {
        self.rules
            .iter()
            .map(|rule| RuleInfo {
                id: rule.id().to_string(),
                name: rule.name().to_string(),
                severity: rule.default_severity(),
            })
            .collect()
    }

    pub fn run_single(&self, ctx: &RepoContext, rule_id: &str) -> Option<DiagnosticResult> {
        self.rules
            .iter()
            .find(|rule| rule.id() == rule_id)
            .map(|rule| rule.check(ctx))
    }

    pub fn run(&self, ctx: &RepoContext) -> RepoHealthReport {
        let results: Vec<DiagnosticResult> = self.rules.iter().map(|rule| rule.check(ctx)).collect();

        let mut critical_count = 0u32;
        let mut warning_count = 0u32;
        let mut info_count = 0u32;
        let mut total_weight = 0.0f64;
        let mut passed_weight = 0.0f64;

        for result in &results {
            let weight = result.severity.weight();
            total_weight += weight;
            if result.passed {
                passed_weight += weight;
            } else {
                match result.severity {
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

        RepoHealthReport {
            repo_full_name: format!("{}/{}", ctx.owner, ctx.repo_name),
            owner: ctx.owner.clone(),
            repo_name: ctx.repo_name.clone(),
            health_score,
            critical_count,
            warning_count,
            info_count,
            results,
            scanned_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

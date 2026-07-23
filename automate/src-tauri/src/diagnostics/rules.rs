use super::types::{DiagnosticResult, RepoContext, Severity};

pub trait DiagnosticRule: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn default_severity(&self) -> Severity;
    fn check(&self, ctx: &RepoContext) -> DiagnosticResult;
}

pub struct HasReadme;
impl DiagnosticRule for HasReadme {
    fn id(&self) -> &str { "has-readme" }
    fn name(&self) -> &str { "Has README" }
    fn default_severity(&self) -> Severity { Severity::Critical }
    fn check(&self, ctx: &RepoContext) -> DiagnosticResult {
        let has_readme = ctx.root_files.iter().any(|f| f.to_lowercase().starts_with("readme"));
        let (passed, message) = if !has_readme {
            (false, "No README file found in repository root".to_string())
        } else if ctx.readme_line_count < 10 {
            (false, format!("README exists but is very short ({} lines)", ctx.readme_line_count))
        } else {
            (true, format!("README found with {} lines", ctx.readme_line_count))
        };
        DiagnosticResult {
            rule_id: self.id().to_string(),
            rule_name: self.name().to_string(),
            severity: if has_readme && ctx.readme_line_count < 10 { Severity::Warning } else { self.default_severity() },
            passed,
            message,
        }
    }
}

pub struct HasLicense;
impl DiagnosticRule for HasLicense {
    fn id(&self) -> &str { "has-license" }
    fn name(&self) -> &str { "Has License" }
    fn default_severity(&self) -> Severity { Severity::Warning }
    fn check(&self, ctx: &RepoContext) -> DiagnosticResult {
        let has_license_file = ctx.root_files.iter().any(|f| {
            let lower = f.to_lowercase();
            lower == "license" || lower == "license.md" || lower == "license.txt"
        });
        let has_license_meta = ctx.license_name.is_some();
        let passed = has_license_file || has_license_meta;
        let message = if passed {
            format!("License found: {}", ctx.license_name.as_deref().unwrap_or("file present"))
        } else {
            "No LICENSE file or license metadata found".to_string()
        };
        DiagnosticResult {
            rule_id: self.id().to_string(),
            rule_name: self.name().to_string(),
            severity: self.default_severity(),
            passed,
            message,
        }
    }
}

pub struct HasDescription;
impl DiagnosticRule for HasDescription {
    fn id(&self) -> &str { "has-description" }
    fn name(&self) -> &str { "Has Description" }
    fn default_severity(&self) -> Severity { Severity::Warning }
    fn check(&self, ctx: &RepoContext) -> DiagnosticResult {
        let passed = ctx.description.as_ref().is_some_and(|d| !d.trim().is_empty());
        let message = if passed {
            "Repository has a description".to_string()
        } else {
            "Repository is missing a description".to_string()
        };
        DiagnosticResult {
            rule_id: self.id().to_string(),
            rule_name: self.name().to_string(),
            severity: self.default_severity(),
            passed,
            message,
        }
    }
}

pub struct HasTopics;
impl DiagnosticRule for HasTopics {
    fn id(&self) -> &str { "has-topics" }
    fn name(&self) -> &str { "Has Topics" }
    fn default_severity(&self) -> Severity { Severity::Info }
    fn check(&self, ctx: &RepoContext) -> DiagnosticResult {
        let passed = !ctx.topics.is_empty();
        let message = if passed {
            format!("Repository has {} topic(s)", ctx.topics.len())
        } else {
            "Repository has no topics/tags configured".to_string()
        };
        DiagnosticResult {
            rule_id: self.id().to_string(),
            rule_name: self.name().to_string(),
            severity: self.default_severity(),
            passed,
            message,
        }
    }
}

pub struct HasCiCd;
impl DiagnosticRule for HasCiCd {
    fn id(&self) -> &str { "has-cicd" }
    fn name(&self) -> &str { "Has CI/CD" }
    fn default_severity(&self) -> Severity { Severity::Warning }
    fn check(&self, ctx: &RepoContext) -> DiagnosticResult {
        let passed = !ctx.workflow_files.is_empty();
        let message = if passed {
            format!("Found {} workflow file(s) in .github/workflows/", ctx.workflow_files.len())
        } else {
            "No CI/CD workflows found in .github/workflows/".to_string()
        };
        DiagnosticResult {
            rule_id: self.id().to_string(),
            rule_name: self.name().to_string(),
            severity: self.default_severity(),
            passed,
            message,
        }
    }
}

pub fn default_rules() -> Vec<Box<dyn DiagnosticRule>> {
    vec![
        Box::new(HasReadme),
        Box::new(HasLicense),
        Box::new(HasDescription),
        Box::new(HasTopics),
        Box::new(HasCiCd),
    ]
}

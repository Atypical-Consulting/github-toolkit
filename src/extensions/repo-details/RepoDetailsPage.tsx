import { useEffect, useState } from "react";
import { useNavigationStore } from "@/core/stores/navigation";
import { useDiagnosticsStore } from "@/core/stores/domain/diagnostics";
import { useGitHubStore } from "@/core/stores/domain/github";
import { useBacklogStore } from "@/core/stores/domain/backlog";
import type { DiagnosticResult } from "@/core/stores/domain/diagnostics/results.slice";
import { cn } from "@/core/lib/cn";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Shield,
  CheckCircle2,
  XOctagon,
  AlertTriangle,
  CircleDot,
  Lock,
  Archive,
  GitBranch,
  Activity,
  Loader2,
  Clock,
  GitCommit,
  ListChecks,
  Play,
  Plus,
} from "lucide-react";

interface Props {
  repoFullName: string;
}

export function RepoDetailsPage({ repoFullName }: Props) {
  const { goBack } = useNavigationStore();
  const { repos } = useGitHubStore();
  const {
    reports,
    rules,
    loadRules,
    loadReportForRepo,
    rescanRepo,
    scanRule,
    isRepoRescanning,
    getRepoScanError,
    getScanningRuleId,
    getRuleOverrides,
    getRepoScanMeta,
  } = useDiagnosticsStore();
  const { items: backlogItems, createFromDiagnostic } = useBacklogStore();
  const [creatingBacklogRuleId, setCreatingBacklogRuleId] = useState<
    string | null
  >(null);

  const repo = repos.find((r) => r.fullName === repoFullName);
  const baseReport = reports[repoFullName] ?? null;
  const isRescanning = isRepoRescanning(repoFullName);
  const scanError = getRepoScanError(repoFullName);
  const scanningRuleId = getScanningRuleId(repoFullName);
  const ruleOverrides = getRuleOverrides(repoFullName);
  const scanMeta = getRepoScanMeta(repoFullName);

  // Build a record of ruleId -> DiagnosticResult from the report + overrides
  const resultsByRuleId: Record<string, DiagnosticResult> = {};
  if (baseReport) {
    for (const r of baseReport.results) {
      resultsByRuleId[r.ruleId] = r;
    }
  }
  for (const [id, r] of Object.entries(ruleOverrides)) {
    resultsByRuleId[id] = r;
  }

  const repoBacklogItems = backlogItems.filter(
    (i) => i.repoFullName === repoFullName,
  );

  // Load rules + report on mount
  useEffect(() => {
    loadRules();
    loadReportForRepo(repoFullName);
  }, [repoFullName, loadRules, loadReportForRepo]);

  function handleRescan() {
    if (!repo) return;
    rescanRepo(repoFullName, repo.owner, repo.name, repo.defaultBranch);
  }

  function handleScanRule(ruleId: string) {
    if (!repo) return;
    scanRule(repoFullName, repo.owner, repo.name, ruleId);
  }

  async function handleCreateBacklogItem(ruleId: string) {
    const result = resultsByRuleId[ruleId];
    if (!result || result.passed || !baseReport) return;
    setCreatingBacklogRuleId(ruleId);
    try {
      await createFromDiagnostic(baseReport, result);
    } finally {
      setCreatingBacklogRuleId(null);
    }
  }

  // Compute summary from all available results
  const scannedResults = Object.values(resultsByRuleId);
  const hasAnyResults = scannedResults.length > 0;
  const healthScore = baseReport?.healthScore ?? null;
  const criticalCount = scannedResults.filter(
    (r) => !r.passed && r.severity === "critical",
  ).length;
  const warningCount = scannedResults.filter(
    (r) => !r.passed && r.severity === "warning",
  ).length;
  const infoCount = scannedResults.filter(
    (r) => !r.passed && r.severity === "info",
  ).length;
  const qualityGate =
    healthScore != null
      ? healthScore >= 80
        ? "PASSED"
        : "FAILED"
      : null;

  const severityOrder: Array<"critical" | "warning" | "info"> = [
    "critical",
    "warning",
    "info",
  ];

  // Group rules by severity
  const groupedRules = severityOrder
    .map((severity) => ({
      severity,
      rules: rules.filter(
        (rule) => rule.severity.toLowerCase() === severity,
      ),
    }))
    .filter((g) => g.rules.length > 0);

  return (
    <div className="px-6 py-6 animate-in fade-in-up">
      {/* ── Navigation Bar ─────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={goBack}
          className="flex items-center gap-2 rounded-lg px-3 py-2 font-display text-[13px] font-medium text-text-dim transition-colors hover:bg-surface-raised hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to repositories
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRescan}
            disabled={isRescanning}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 font-display text-[12px] font-semibold transition-colors",
              isRescanning
                ? "cursor-not-allowed bg-surface-hover text-text-dim"
                : "bg-accent/10 text-accent hover:bg-accent/20",
            )}
          >
            {isRescanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {isRescanning ? "Scanning all..." : "Scan All"}
          </button>

          {repo && (
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-4 py-2 font-display text-[12px] font-medium text-text-dim transition-colors hover:bg-surface-raised hover:text-text"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              GitHub
            </a>
          )}
        </div>
      </div>

      {/* ── Repo Header ────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-text">
            {repo?.name ?? repoFullName.split("/")[1]}
          </h1>
          {repo?.isArchived && (
            <span className="flex items-center gap-1 rounded-md bg-surface-hover px-2 py-0.5 text-[11px] text-text-dim">
              <Archive className="h-3 w-3" />
              archived
            </span>
          )}
          {repo?.isPrivate && (
            <span className="flex items-center gap-1 rounded-md bg-surface-hover px-2 py-0.5 text-[11px] text-text-dim">
              <Lock className="h-3 w-3" />
              private
            </span>
          )}
        </div>
        <p className="mt-1 font-display text-[13px] text-text-dim">
          {repo?.owner ?? repoFullName.split("/")[0]}
          {repo?.description && (
            <span className="ml-2 text-text-dim/60">{repo.description}</span>
          )}
        </p>
      </div>

      {/* ── Quality Gate (only if we have a full scan) ────── */}
      {qualityGate && (
        <div
          className={cn(
            "mb-6 flex items-center justify-between rounded-xl border px-6 py-4",
            qualityGate === "PASSED"
              ? "border-success/20 bg-success/5"
              : "border-error/20 bg-error/5",
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                qualityGate === "PASSED" ? "bg-success/10" : "bg-error/10",
              )}
            >
              {qualityGate === "PASSED" ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XOctagon className="h-5 w-5 text-error" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-[12px] font-medium uppercase tracking-wider text-text-dim">
                  Quality Gate
                </span>
                <span
                  className={cn(
                    "rounded-md px-2.5 py-0.5 font-display text-[12px] font-bold uppercase tracking-wide",
                    qualityGate === "PASSED"
                      ? "bg-success/10 text-success"
                      : "bg-error/10 text-error",
                  )}
                >
                  {qualityGate}
                </span>
              </div>
              <p className="mt-0.5 font-display text-[12px] text-text-dim/70">
                {qualityGate === "PASSED"
                  ? "This repository meets the quality standards."
                  : "This repository has issues that need attention."}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {baseReport?.scannedAt && (
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim/60">
                <Clock className="h-3 w-3" />
                {formatRelativeDate(baseReport.scannedAt)}
              </span>
            )}
            {scanMeta && (
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim/60">
                <GitCommit className="h-3 w-3" />
                {scanMeta.commitSha.slice(0, 7)}
                {scanMeta.fromCache && (
                  <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                    cached
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Scan Error ─────────────────────────────────────── */}
      {scanError && (
        <div className="mb-6 rounded-xl border border-error/20 bg-error/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <XOctagon className="h-4 w-4 text-error" />
            <span className="font-display text-[13px] font-medium text-error">Scan failed</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-error/70">{scanError}</p>
        </div>
      )}

      {/* ── Summary Cards (only if we have results) ──────── */}
      {hasAnyResults && healthScore != null && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          <HealthScoreCard score={healthScore} />
          <SeverityCard
            label="Critical"
            count={criticalCount}
            color="error"
            icon={XOctagon}
          />
          <SeverityCard
            label="Warnings"
            count={warningCount}
            color="warning"
            icon={AlertTriangle}
          />
          <SeverityCard
            label="Info"
            count={infoCount}
            color="accent"
            icon={CircleDot}
          />
        </div>
      )}

      {/* ── Diagnostic Rules ─────────────────────────────── */}
      {rules.length > 0 && (
        <div className="mb-6 rounded-xl border border-border-subtle bg-surface-raised/30">
          <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3">
            <ListChecks className="h-4 w-4 text-text-dim" />
            <span className="font-display text-[13px] font-semibold text-text">
              Diagnostic Rules
            </span>
            <span className="font-mono text-[11px] text-text-dim">
              {rules.length} rules
            </span>
            {hasAnyResults && (
              <span className="font-mono text-[11px] text-text-dim/50">
                &middot; {scannedResults.filter((r) => r.passed).length} passed
              </span>
            )}
          </div>

          <div className="divide-y divide-border-subtle/50">
            {groupedRules.map(({ severity, rules }) => (
              <div key={severity}>
                <div className="flex items-center gap-2 bg-surface/50 px-5 py-2">
                  <SeverityDot severity={severity} />
                  <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                    {severity}
                  </span>
                  <span className="font-mono text-[11px] text-text-dim/50">
                    {rules.length}
                  </span>
                </div>

                <div className="divide-y divide-border-subtle/30">
                  {rules.map((rule) => {
                    const result = resultsByRuleId[rule.id];
                    const isScanning = scanningRuleId === rule.id;
                    const hasResult = result != null;
                    const isFailed = hasResult && !result.passed;
                    const hasBacklogItem = repoBacklogItems.some(
                      (i) => i.sourceRef === rule.id,
                    );
                    const isCreatingBacklog =
                      creatingBacklogRuleId === rule.id;

                    return (
                      <div
                        key={rule.id}
                        className={cn(
                          "flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-raised/60",
                          hasResult && result.passed && "opacity-60",
                        )}
                      >
                        {/* Status icon */}
                        {!hasResult ? (
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-surface-hover" />
                          </div>
                        ) : result.passed ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        ) : severity === "critical" ? (
                          <XOctagon className="h-4 w-4 shrink-0 text-error" />
                        ) : severity === "warning" ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                        ) : (
                          <CircleDot className="h-4 w-4 shrink-0 text-accent" />
                        )}

                        {/* Rule info */}
                        <div className="min-w-0 flex-1">
                          <span className="font-display text-[13px] font-medium text-text">
                            {rule.name}
                          </span>
                          {hasResult ? (
                            <p className="mt-0.5 font-display text-[12px] text-text-dim">
                              {result.message}
                            </p>
                          ) : (
                            <p className="mt-0.5 font-display text-[12px] text-text-dim/40">
                              Not scanned yet
                            </p>
                          )}
                        </div>

                        {/* Run button */}
                        <button
                          onClick={() => handleScanRule(rule.id)}
                          disabled={isScanning || scanningRuleId !== null}
                          className={cn(
                            "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-display text-[11px] font-medium transition-colors",
                            isScanning
                              ? "cursor-not-allowed bg-surface-hover text-text-dim"
                              : "text-text-dim hover:bg-surface-hover hover:text-text",
                          )}
                          title={`Run "${rule.name}" diagnostic`}
                        >
                          {isScanning ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Run
                        </button>

                        {/* Create backlog button (only for failed rules without existing backlog item) */}
                        {isFailed && !hasBacklogItem && (
                          <button
                            onClick={() => handleCreateBacklogItem(rule.id)}
                            disabled={
                              isCreatingBacklog ||
                              creatingBacklogRuleId !== null
                            }
                            className={cn(
                              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-display text-[11px] font-medium transition-colors",
                              isCreatingBacklog
                                ? "cursor-not-allowed bg-surface-hover text-text-dim"
                                : "text-accent hover:bg-accent/10 hover:text-accent",
                            )}
                            title={`Create backlog item for "${rule.name}"`}
                          >
                            {isCreatingBacklog ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            Backlog
                          </button>
                        )}

                        {/* Status badge */}
                        {hasResult ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-2.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wide",
                              result.passed
                                ? "bg-success/8 text-success"
                                : severity === "critical"
                                  ? "bg-error/8 text-error"
                                  : severity === "warning"
                                    ? "bg-warning/8 text-warning"
                                    : "bg-accent/8 text-accent",
                            )}
                          >
                            {result.passed ? "pass" : "fail"}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-md bg-surface-hover/50 px-2.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wide text-text-dim/40">
                            --
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Backlog Items ─────────────────────────────────── */}
      {repoBacklogItems.length > 0 && (
        <div className="mb-6 rounded-xl border border-border-subtle bg-surface-raised/30">
          <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3">
            <Activity className="h-4 w-4 text-text-dim" />
            <span className="font-display text-[13px] font-semibold text-text">
              Backlog Items
            </span>
            <span className="font-mono text-[11px] text-text-dim">
              {repoBacklogItems.length}
            </span>
          </div>

          <div className="divide-y divide-border-subtle/50">
            {repoBacklogItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <SeverityDot severity={item.severity} />
                <div className="min-w-0 flex-1">
                  <span className="font-display text-[13px] text-text">
                    {item.title}
                  </span>
                  {item.description && (
                    <p className="mt-0.5 truncate font-display text-[12px] text-text-dim">
                      {item.description}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 font-display text-[10px] font-semibold uppercase",
                    item.status === "todo"
                      ? "bg-surface-hover text-text-dim"
                      : item.status === "in_progress"
                        ? "bg-accent/10 text-accent"
                        : "bg-success/10 text-success",
                  )}
                >
                  {item.status}
                </span>
                {item.githubIssueUrl && (
                  <a
                    href={item.githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-hover"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Repo Metadata ─────────────────────────────────── */}
      {repo && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border-subtle bg-surface-raised/30 px-5 py-3">
          {repo.licenseName && (
            <MetaChip icon={Shield} label={repo.licenseName} />
          )}
          {repo.defaultBranch && (
            <MetaChip icon={GitBranch} label={repo.defaultBranch} />
          )}
          {repo.pushedAt && (
            <MetaChip
              icon={Activity}
              label={`Last push ${formatRelativeDate(repo.pushedAt)}`}
            />
          )}
          {repo.openIssuesCount > 0 && (
            <MetaChip
              icon={CircleDot}
              label={`${repo.openIssuesCount} open issues`}
            />
          )}
          {repo.topics.length > 0 && (
            <div className="flex items-center gap-1.5">
              {repo.topics.map((topic: string) => (
                <span
                  key={topic}
                  className="rounded-md bg-mauve/8 px-2 py-0.5 font-display text-[10px] font-medium text-mauve"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────

function HealthScoreCard({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-success" : score >= 40 ? "text-warning" : "text-error";
  const bgColor =
    score >= 80
      ? "bg-success/5 border-success/20"
      : score >= 40
        ? "bg-warning/5 border-warning/20"
        : "bg-error/5 border-error/20";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border px-4 py-4",
        bgColor,
      )}
    >
      <span className={cn("font-display text-3xl font-bold", color)}>
        {Math.round(score)}
      </span>
      <span className="mt-1 font-display text-[11px] font-medium uppercase tracking-wider text-text-dim">
        Health Score
      </span>
    </div>
  );
}

function SeverityCard({
  label,
  count,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  color: "error" | "warning" | "accent";
  icon: typeof XOctagon;
}) {
  const colorClasses = {
    error: "text-error bg-error/5 border-error/20",
    warning: "text-warning bg-warning/5 border-warning/20",
    accent: "text-accent bg-accent/5 border-accent/20",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border px-4 py-4",
        count > 0
          ? colorClasses[color]
          : "border-border-subtle bg-surface-raised/30",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-4 w-4",
            count > 0 ? colorClasses[color].split(" ")[0] : "text-text-dim/40",
          )}
        />
        <span
          className={cn(
            "font-display text-2xl font-bold",
            count > 0 ? colorClasses[color].split(" ")[0] : "text-text-dim/40",
          )}
        >
          {count}
        </span>
      </div>
      <span className="font-display text-[11px] font-medium uppercase tracking-wider text-text-dim">
        {label}
      </span>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-error",
    warning: "bg-warning",
    info: "bg-accent",
  };
  return (
    <div
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        colors[severity] ?? "bg-text-dim",
      )}
    />
  );
}

function MetaChip({
  icon: Icon,
  label,
}: {
  icon: typeof Shield;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 font-display text-[11px] text-text-dim">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return dateStr;
  }
}

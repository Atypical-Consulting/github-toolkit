import { useEffect, useState, useRef, useMemo } from "react";
import { useGitHubStore } from "@/core/stores/domain/github";
import { useDiagnosticsStore } from "@/core/stores/domain/diagnostics";
import { useBacklogStore } from "@/core/stores/domain/backlog";
import { useNavigationStore } from "@/core/stores/navigation";
import { cn } from "@/core/lib/cn";
import {
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Play,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  Archive,
  Shield,
  CircleDot,
  Loader2,
  Search,
  LayoutGrid,
  ListChecks,
  Activity,
  Terminal,
  FileText,
  Sparkles,
  Eye,
  ArrowUpRight,
  Command,
} from "lucide-react";

type Tab = "overview" | "repositories" | "backlog";

// ─── Main Dashboard ────────────────────────────────────────────────

export function Dashboard() {
  const { repos, reposLoading, reposCacheLoaded, loadCachedRepos, fetchAllRepos } = useGitHubStore();
  const { isScanRunning, scanProgress, startScan, reports, diagnosticsCacheLoaded, loadCachedDiagnostics, getHealthDistribution } =
    useDiagnosticsStore();
  const { items: backlogItems, generateFromScan } = useBacklogStore();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // On mount: load cached repos + diagnostics from DB, then refresh repos from API
  useEffect(() => {
    if (!reposCacheLoaded && !reposLoading) {
      // Load cached data first for instant display
      loadCachedRepos().then(() => {
        // Then refresh from API in background
        fetchAllRepos(["Atypical-Consulting"]);
      });
    }
  }, [reposCacheLoaded, reposLoading, loadCachedRepos, fetchAllRepos]);

  useEffect(() => {
    if (!diagnosticsCacheLoaded) {
      loadCachedDiagnostics();
    }
  }, [diagnosticsCacheLoaded, loadCachedDiagnostics]);

  const distribution = getHealthDistribution();
  const hasReports = reports.size > 0;
  const scannedCount = reports.size;

  const handleScan = async () => {
    if (repos.length > 0 && !isScanRunning) {
      await startScan(repos);
    }
  };

  const handleGenerateBacklog = async () => {
    const allReports = Array.from(reports.values());
    if (allReports.length > 0) {
      await generateFromScan(allReports);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof LayoutGrid; count?: number }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "repositories", label: "Repositories", icon: LayoutGrid, count: repos.length },
    { id: "backlog", label: "Backlog", icon: ListChecks, count: backlogItems.length },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Tab Bar + Actions */}
      <div className="flex items-center justify-between border-b border-border-subtle px-6">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3.5 py-2.5 font-display text-[13px] font-medium transition-all",
                activeTab === tab.id
                  ? "text-text"
                  : "text-text-dim hover:text-text-muted",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none",
                    activeTab === tab.id
                      ? "bg-accent/12 text-accent"
                      : "bg-surface-hover/50 text-text-dim",
                  )}
                >
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <span className="absolute inset-x-2 -bottom-[calc(0.625rem+1px)] h-[2px] rounded-full bg-accent" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {hasReports && activeTab === "overview" && (
            <button
              onClick={handleGenerateBacklog}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 font-display text-[12px] font-medium text-text-muted transition-all hover:border-text-dim hover:text-text"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate Backlog
            </button>
          )}
          <button
            onClick={handleScan}
            disabled={isScanRunning || repos.length === 0 || reposLoading}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-display text-[12px] font-semibold transition-all",
              isScanRunning
                ? "bg-error/12 text-error"
                : "bg-accent/12 text-accent hover:bg-accent/20",
              (repos.length === 0 || reposLoading) && "cursor-not-allowed opacity-40",
            )}
          >
            {isScanRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" fill="currentColor" />
                Run Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "overview" && (
          <OverviewTab
            repos={repos}
            reposLoading={reposLoading}
            distribution={distribution}
            scannedCount={scannedCount}
            isScanRunning={isScanRunning}
            scanProgress={scanProgress}
            reports={reports}
          />
        )}
        {activeTab === "repositories" && (
          <RepositoriesTab repos={repos} reports={reports} reposLoading={reposLoading} />
        )}
        {activeTab === "backlog" && <BacklogTab items={backlogItems} />}
      </div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────

function OverviewTab({
  repos,
  reposLoading,
  distribution,
  scannedCount,
  isScanRunning,
  scanProgress,
  reports,
}: {
  repos: any[];
  reposLoading: boolean;
  distribution: { healthy: number; warning: number; critical: number };
  scannedCount: number;
  isScanRunning: boolean;
  scanProgress: { total: number; completed: number; currentRepo: string } | null;
  reports: Map<string, any>;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          icon={GitBranch}
          label="Total Repos"
          value={reposLoading ? "..." : repos.length}
          accent="accent"
          delay={0}
        />
        <StatCard
          icon={CheckCircle2}
          label="Healthy"
          value={distribution.healthy}
          accent="success"
          delay={1}
        />
        <StatCard
          icon={AlertTriangle}
          label="Warnings"
          value={distribution.warning}
          accent="warning"
          delay={2}
        />
        <StatCard
          icon={XOctagon}
          label="Critical"
          value={distribution.critical}
          accent="error"
          delay={3}
        />
      </div>

      {/* Scan Terminal */}
      <ScanTerminal
        isScanRunning={isScanRunning}
        scanProgress={scanProgress}
        reports={reports}
        scannedCount={scannedCount}
      />

      {/* Health Distribution Bar */}
      {scannedCount > 0 && (
        <HealthBar distribution={distribution} total={scannedCount} />
      )}
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  delay = 0,
}: {
  icon: typeof GitBranch;
  label: string;
  value: string | number;
  accent: "accent" | "success" | "warning" | "error";
  delay?: number;
}) {
  const colors = {
    accent: {
      border: "border-l-accent",
      icon: "text-accent",
      glow: "",
      bg: "bg-accent/5",
    },
    success: {
      border: "border-l-success",
      icon: "text-success",
      glow: "",
      bg: "bg-success/5",
    },
    warning: {
      border: "border-l-warning",
      icon: "text-warning",
      glow: "",
      bg: "bg-warning/5",
    },
    error: {
      border: "border-l-error",
      icon: "text-error",
      glow: "",
      bg: "bg-error/5",
    },
  }[accent];

  return (
    <div
      className={cn(
        "animate-fade-in-up group rounded-xl border border-border-subtle border-l-2 p-4 transition-all hover:border-border",
        colors.border,
        colors.glow,
        colors.bg,
        `stagger-${delay + 1}`,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-[11px] font-medium uppercase tracking-widest text-text-dim">
            {label}
          </p>
          <p className="mt-1.5 font-mono text-3xl font-bold tabular-nums text-text">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg bg-surface-raised p-2.5 transition-colors group-hover:bg-surface-hover",
            colors.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Scan Terminal ─────────────────────────────────────────────────

function ScanTerminal({
  isScanRunning,
  scanProgress,
  reports,
  scannedCount,
}: {
  isScanRunning: boolean;
  scanProgress: { total: number; completed: number; currentRepo: string } | null;
  reports: Map<string, any>;
  scannedCount: number;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);

  const logEntries = useMemo(() => {
    return Array.from(reports.entries()).map(([name, report]) => ({
      repo: name,
      score: report.healthScore,
      critical: report.criticalCount,
      warning: report.warningCount,
      info: report.infoCount,
    }));
  }, [reports]);

  useEffect(() => {
    if (isScanRunning && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logEntries.length, isScanRunning]);

  useEffect(() => {
    if (isScanRunning) setExpanded(true);
  }, [isScanRunning]);

  const pct = scanProgress
    ? Math.round((scanProgress.completed / Math.max(scanProgress.total, 1)) * 100)
    : 0;

  if (!isScanRunning && logEntries.length === 0) {
    return (
      <div className="animate-fade-in-up stagger-5 rounded-xl border border-dashed border-border-subtle p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised">
          <Terminal className="h-5 w-5 text-text-dim" />
        </div>
        <p className="font-display text-sm text-text-dim">
          No scan results yet. Hit{" "}
          <span className="font-medium text-accent">Run Scan</span> to analyze
          your repositories.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle">
      {/* Terminal Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface-alt"
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-error/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
          </div>
          <span className="font-display text-[13px] font-medium text-text">Scan Log</span>
          {isScanRunning && scanProgress && (
            <span className="font-mono text-xs text-text-dim">
              {scanProgress.completed}/{scanProgress.total}
            </span>
          )}
          {!isScanRunning && scannedCount > 0 && (
            <span className="rounded-md bg-success/10 px-2 py-0.5 font-display text-[10px] font-semibold text-success">
              Complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isScanRunning && (
            <div className="flex items-center gap-2">
              <div className="h-1 w-32 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-lavender transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="font-mono text-[11px] tabular-nums text-accent">
                {pct}%
              </span>
            </div>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-text-dim" />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-dim" />
          )}
        </div>
      </button>

      {/* Thin gradient progress bar */}
      {isScanRunning && (
        <div className="h-px bg-surface">
          <div
            className="h-full bg-gradient-to-r from-accent to-lavender transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Log Body */}
      {expanded && (
        <div className="max-h-72 overflow-auto bg-surface font-mono text-xs">
          {/* Currently scanning */}
          {isScanRunning && scanProgress && scanProgress.currentRepo && (
            <div className="sticky top-0 flex items-center gap-2 border-b border-border-subtle bg-surface/95 px-4 py-2.5 backdrop-blur-sm">
              <Loader2 className="h-3 w-3 animate-spin text-accent" />
              <span className="text-text-dim">scanning</span>
              <span className="text-accent">{scanProgress.currentRepo}</span>
            </div>
          )}

          {logEntries.map((entry, i) => (
            <div
              key={entry.repo}
              className="flex items-center gap-2 border-b border-border-subtle/50 px-4 py-1.5 transition-colors hover:bg-surface-raised/50"
            >
              <span className="w-8 text-right tabular-nums text-text-dim/50">
                {String(i + 1).padStart(3, "\u2007")}
              </span>
              <span className="text-border">|</span>
              <ScoreIndicator score={entry.score} />
              <span className="flex-1 truncate text-text-muted">{entry.repo}</span>
              <div className="flex items-center gap-3 text-[11px]">
                {entry.critical > 0 && (
                  <span className="text-error">{entry.critical} crit</span>
                )}
                {entry.warning > 0 && (
                  <span className="text-warning">{entry.warning} warn</span>
                )}
                {entry.info > 0 && (
                  <span className="text-text-dim">{entry.info} info</span>
                )}
                {entry.critical === 0 && entry.warning === 0 && entry.info === 0 && (
                  <span className="text-success">clean</span>
                )}
              </div>
            </div>
          ))}
          <div ref={logEndRef} />

          {logEntries.length === 0 && isScanRunning && (
            <div className="px-4 py-3 text-text-dim">Waiting for results...</div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-success" : score >= 40 ? "text-warning" : "text-error";
  const bg = score >= 80 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-error";
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("h-1.5 w-1.5 rounded-full", bg)} />
      <span className={cn("w-8 tabular-nums font-semibold", color)}>
        {Math.round(score)}%
      </span>
    </div>
  );
}

// ─── Health Distribution Bar ───────────────────────────────────────

function HealthBar({
  distribution,
  total,
}: {
  distribution: { healthy: number; warning: number; critical: number };
  total: number;
}) {
  const segments = [
    { count: distribution.healthy, color: "bg-success", label: "Healthy", textColor: "text-success" },
    { count: distribution.warning, color: "bg-warning", label: "Warning", textColor: "text-warning" },
    { count: distribution.critical, color: "bg-error", label: "Critical", textColor: "text-error" },
  ].filter((s) => s.count > 0);

  return (
    <div className="animate-fade-in-up rounded-xl border border-border-subtle p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[13px] font-medium text-text">
          Health Distribution
        </span>
        <span className="font-mono text-xs text-text-dim">{total} scanned</span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn(
              "transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full",
              seg.color,
            )}
            style={{ width: `${(seg.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-sm", seg.color)} />
            <span className="font-display text-[12px] text-text-dim">
              {seg.label}
            </span>
            <span className={cn("font-mono text-[12px] font-semibold", seg.textColor)}>
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Health Ring (SVG gauge) ───────────────────────────────────────

function HealthRing({ score, size = 40 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "var(--color-success)" : score >= 40 ? "var(--color-warning)" : "var(--color-error)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="health-ring" width={size} height={size}>
        <circle className="health-ring-track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="health-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute font-mono text-[10px] font-bold tabular-nums"
        style={{ color }}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

// ─── Repositories Tab ──────────────────────────────────────────────

function RepositoriesTab({
  repos,
  reports,
  reposLoading,
}: {
  repos: any[];
  reports: Map<string, any>;
  reposLoading: boolean;
}) {
  const { navigateTo } = useNavigationStore();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "score" | "issues">("name");

  const filtered = useMemo(() => {
    let list = [...repos];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.topics.some((t: string) => t.toLowerCase().includes(q)),
      );
    }

    if (sortBy === "score") {
      list.sort((a, b) => {
        const sa = reports.get(a.fullName)?.healthScore ?? -1;
        const sb = reports.get(b.fullName)?.healthScore ?? -1;
        return sa - sb;
      });
    } else if (sortBy === "issues") {
      list.sort((a, b) => b.openIssuesCount - a.openIssuesCount);
    } else {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    return list;
  }, [repos, search, sortBy, reports]);

  // Group by owner
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const repo of filtered) {
      const existing = map.get(repo.owner) ?? [];
      existing.push(repo);
      map.set(repo.owner, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (reposLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span className="font-display text-sm text-text-dim">Loading repositories...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Search + Sort */}
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories..."
            className="w-full rounded-xl border border-border-subtle bg-surface-raised py-2.5 pl-10 pr-14 font-display text-[13px] text-text placeholder:text-text-dim/60 transition-all focus:border-accent/40 focus:bg-surface-alt focus:outline-none"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-border-subtle bg-surface px-1.5 py-0.5">
            <Command className="h-3 w-3 text-text-dim/60" />
            <span className="font-mono text-[10px] text-text-dim/60">K</span>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-border-subtle">
          {(["name", "score", "issues"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                "px-3.5 py-2.5 font-display text-[11px] font-medium capitalize transition-all",
                sortBy === s
                  ? "bg-surface-hover text-text"
                  : "bg-surface-raised text-text-dim hover:text-text-muted",
                s !== "name" && "border-l border-border-subtle",
              )}
            >
              {s === "name" ? "Name" : s === "score" ? "Score" : "Issues"}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Repo List */}
      <div className="space-y-6">
        {grouped.map(([owner, ownerRepos]) => (
          <div key={owner}>
            {/* Owner Header */}
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="font-display text-[12px] font-semibold uppercase tracking-widest text-text-dim">
                {owner}
              </span>
              <div className="h-px flex-1 bg-border-subtle" />
              <span className="font-mono text-[11px] text-text-dim/60">
                {ownerRepos.length}
              </span>
            </div>

            {/* Repo Cards */}
            <div className="space-y-1.5">
              {ownerRepos.map((repo) => {
                const report = reports.get(repo.fullName);

                return (
                  <div
                    key={repo.fullName}
                    className="overflow-hidden rounded-xl border border-border-subtle transition-all hover:border-border hover:bg-surface-raised/50"
                  >
                    <button
                      onClick={() =>
                        navigateTo({ name: "repo-details", repoFullName: repo.fullName })
                      }
                      className="flex w-full items-center gap-3.5 px-4 py-3 text-left"
                    >
                      {/* Navigate chevron */}
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-text-dim">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>

                      {/* Health indicator */}
                      {report ? (
                        <HealthRing score={report.healthScore} size={36} />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-surface-hover" />
                        </div>
                      )}

                      {/* Repo info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-[13px] font-semibold text-text">
                            {repo.name}
                          </span>
                          {repo.isArchived && (
                            <span className="flex items-center gap-1 rounded-md bg-surface-hover/60 px-1.5 py-0.5 text-[10px] text-text-dim">
                              <Archive className="h-2.5 w-2.5" />
                              archived
                            </span>
                          )}
                          {repo.isPrivate && (
                            <Lock className="h-3 w-3 shrink-0 text-text-dim/60" />
                          )}
                        </div>
                        {repo.description && (
                          <p className="mt-0.5 truncate font-display text-[12px] text-text-dim">
                            {repo.description}
                          </p>
                        )}
                      </div>

                      {/* Topics */}
                      <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                        {repo.topics.slice(0, 3).map((topic: string) => (
                          <span
                            key={topic}
                            className="rounded-md bg-mauve/8 px-2 py-0.5 font-display text-[10px] font-medium text-mauve"
                          >
                            {topic}
                          </span>
                        ))}
                        {repo.topics.length > 3 && (
                          <span className="font-mono text-[10px] text-text-dim">
                            +{repo.topics.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Open issues */}
                      {repo.openIssuesCount > 0 && (
                        <span className="shrink-0 font-mono text-[11px] text-text-dim">
                          {repo.openIssuesCount} <CircleDot className="inline h-3 w-3" />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised">
            <Eye className="h-5 w-5 text-text-dim" />
          </div>
          <p className="font-display text-sm text-text-dim">
            {search
              ? "No repositories match your search."
              : "No repositories found."}
          </p>
        </div>
      )}
    </div>
  );
}

function MetaChip({ icon: Icon, label }: { icon: typeof Shield; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
      <Icon className="h-3 w-3" />
      <span className="font-display">{label}</span>
    </div>
  );
}

// ─── Backlog Tab ───────────────────────────────────────────────────

function BacklogTab({ items }: { items: any[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const existing = map.get(item.repoFullName) ?? [];
      existing.push(item);
      map.set(item.repoFullName, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised">
          <FileText className="h-5 w-5 text-text-dim" />
        </div>
        <p className="font-display text-sm text-text-muted">No backlog items yet.</p>
        <p className="mt-1.5 font-display text-xs text-text-dim">
          Run a scan and generate backlog to see items here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-[13px] font-medium text-text">
          {items.length} items
          <span className="ml-1.5 text-text-dim">across {grouped.length} repositories</span>
        </span>
      </div>

      <div className="space-y-4">
        {grouped.map(([repoName, repoItems]) => (
          <div
            key={repoName}
            className="overflow-hidden rounded-xl border border-border-subtle"
          >
            <div className="flex items-center gap-2.5 bg-surface-raised px-4 py-2.5">
              <GitBranch className="h-3.5 w-3.5 text-text-dim" />
              <span className="font-display text-[13px] font-semibold text-text">{repoName}</span>
              <span className="rounded-md bg-surface-hover/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-dim">
                {repoItems.length}
              </span>
            </div>
            <div>
              {repoItems.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-t border-border-subtle/60 px-4 py-3 transition-colors hover:bg-surface-raised/30"
                >
                  <SeverityDot severity={item.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[13px] text-text-muted">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 truncate font-display text-[11px] text-text-dim">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wide",
                      item.severity === "critical"
                        ? "bg-error/8 text-error"
                        : item.severity === "warning"
                          ? "bg-warning/8 text-warning"
                          : "bg-accent/8 text-accent",
                    )}
                  >
                    {item.severity}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-text-dim">
                    P{item.priorityScore}
                  </span>
                  {item.githubIssueUrl && (
                    <a
                      href={item.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent transition-colors hover:text-accent-hover"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  return (
    <div
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        severity === "critical"
          ? "bg-error"
          : severity === "warning"
            ? "bg-warning"
            : "bg-accent",
      )}
    />
  );
}

// ─── Utils ─────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

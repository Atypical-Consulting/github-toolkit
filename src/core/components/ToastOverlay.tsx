import { AlertTriangle, CheckCircle2, Info, X, XOctagon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { cn } from "@/core/lib/cn";
import { type LogEntry, useLogStore } from "@/core/stores/log";

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XOctagon,
} as const;

const styles = {
  info: "border-accent/30 bg-accent/8 text-accent",
  success: "border-success/30 bg-success/8 text-success",
  warning: "border-warning/30 bg-warning/8 text-warning",
  error: "border-error/30 bg-error/8 text-error",
} as const;

function Toast({ entry }: { entry: LogEntry }) {
  const dismiss = useLogStore((s) => s.dismiss);
  const Icon = icons[entry.level];

  useEffect(() => {
    if (entry.ttl == null) return;
    const timer = setTimeout(() => dismiss(entry.id), entry.ttl);
    return () => clearTimeout(timer);
  }, [entry.id, entry.ttl, dismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-full duration-200",
        styles[entry.level],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[11px] font-semibold uppercase tracking-wider opacity-60">
          {entry.source}
        </p>
        <p className="mt-0.5 font-display text-[13px] text-text">
          {entry.message}
        </p>
      </div>
      <button
        onClick={() => dismiss(entry.id)}
        className="shrink-0 rounded-md p-0.5 opacity-40 transition-opacity hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastOverlay() {
  // Select full entries array by reference (stable), then derive the tail in a memo
  const allEntries = useLogStore(useShallow((s) => s.entries));
  const entries = useMemo(() => allEntries.slice(-5), [allEntries]);

  if (entries.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {entries.map((entry) => (
        <div key={entry.id} className="pointer-events-auto">
          <Toast entry={entry} />
        </div>
      ))}
    </div>
  );
}

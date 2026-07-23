import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type LogLevel = "info" | "success" | "warning" | "error";

export interface LogEntry {
  id: string;
  level: LogLevel;
  source: string;
  message: string;
  timestamp: number;
  /** Auto-dismiss after ms (null = sticky until manually dismissed) */
  ttl: number | null;
}

interface LogStore {
  entries: LogEntry[];
  /** Max entries kept in memory (older ones are pruned) */
  maxEntries: number;
  /** Push a log entry and optionally show it as a toast */
  log: (
    level: LogLevel,
    source: string,
    message: string,
    ttl?: number | null,
  ) => string;
  /** Convenience shortcuts */
  info: (source: string, message: string) => string;
  success: (source: string, message: string) => string;
  warn: (source: string, message: string) => string;
  error: (source: string, message: string) => string;
  /** Dismiss a specific toast by id */
  dismiss: (id: string) => void;
  /** Clear all entries */
  clear: () => void;
}

let counter = 0;
function makeId(): string {
  return `log-${Date.now()}-${++counter}`;
}

const DEFAULT_TTL: Record<LogLevel, number | null> = {
  info: 4000,
  success: 3000,
  warning: 6000,
  error: null, // errors stick until dismissed
};

export const useLogStore = create<LogStore>()(
  devtools(
    (set) => {
      const log: LogStore["log"] = (level, source, message, ttl) => {
        const id = makeId();
        const entry: LogEntry = {
          id,
          level,
          source,
          message,
          timestamp: Date.now(),
          ttl: ttl !== undefined ? ttl : DEFAULT_TTL[level],
        };

        if (import.meta.env.DEV) {
          const tag = `[${source}]`;
          const fn =
            level === "error"
              ? console.error
              : level === "warning"
                ? console.warn
                : console.log;
          fn(
            `%c${tag}%c ${message}`,
            "color: #89b4fa; font-weight: bold",
            "color: inherit",
          );
        }

        set(
          (state) => ({
            entries: [...state.entries, entry].slice(-state.maxEntries),
          }),
          undefined,
          `log/${level}`,
        );

        return id;
      };

      return {
        entries: [],
        maxEntries: 200,

        log,

        info: (source, message) => log("info", source, message),
        success: (source, message) => log("success", source, message),
        warn: (source, message) => log("warning", source, message),
        error: (source, message) => log("error", source, message),

        dismiss: (id) =>
          set(
            (state) => ({
              entries: state.entries.filter((e) => e.id !== id),
            }),
            undefined,
            "log/dismiss",
          ),

        clear: () => set({ entries: [] }, undefined, "log/clear"),
      };
    },
    { name: "log", enabled: import.meta.env.DEV },
  ),
);

/** Shorthand for use inside store actions (outside React) */
export const log = {
  info: (source: string, message: string) =>
    useLogStore.getState().info(source, message),
  success: (source: string, message: string) =>
    useLogStore.getState().success(source, message),
  warn: (source: string, message: string) =>
    useLogStore.getState().warn(source, message),
  error: (source: string, message: string) =>
    useLogStore.getState().error(source, message),
};

import { Check, Copy, ExternalLink, Github } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useGitHubStore } from "@/core/stores/domain/github";

export function AuthScreen() {
  const {
    userCode,
    verificationUri,
    startDeviceFlow,
    pollAuth,
    authError,
    pollInterval,
  } = useGitHubStore();
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  const handleStart = useCallback(async () => {
    await startDeviceFlow();
    setPolling(true);
  }, [startDeviceFlow]);

  useEffect(() => {
    if (!polling || !userCode) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const poll = async () => {
      const success = await pollAuth();
      if (success || cancelled) {
        setPolling(false);
        return;
      }
      // Re-read pollInterval from store each cycle (it may increase on SlowDown)
      const currentInterval = useGitHubStore.getState().pollInterval;
      console.log(`[pollAuth] next poll in ${currentInterval}s`);
      timeoutId = setTimeout(poll, currentInterval * 1000);
    };

    // First poll after the initial interval
    const initialInterval = useGitHubStore.getState().pollInterval;
    timeoutId = setTimeout(poll, initialInterval * 1000);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [polling, userCode, pollAuth]);

  // Stop polling when a real error occurs
  useEffect(() => {
    if (authError && polling) {
      setPolling(false);
    }
  }, [authError, polling]);

  const copyCode = () => {
    if (userCode) {
      navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-surface">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="flex flex-col items-center gap-3">
          <Github className="h-16 w-16 text-accent" />
          <h1 className="text-2xl font-bold text-text">GitHubAutomate</h1>
          <p className="text-center text-text-muted">
            Sign in with GitHub to scan your repositories and diagnose health
            issues.
          </p>
        </div>

        {!userCode ? (
          <button
            onClick={handleStart}
            className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-surface transition hover:bg-accent-hover"
          >
            Sign in with GitHub
          </button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-alt p-4 text-center">
              <p className="mb-2 text-sm text-text-muted">
                Enter this code on GitHub:
              </p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-3xl font-bold tracking-widest text-accent">
                  {userCode}
                </code>
                <button
                  onClick={copyCode}
                  className="rounded p-1 hover:bg-surface-hover"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-success" />
                  ) : (
                    <Copy className="h-5 w-5 text-text-dim" />
                  )}
                </button>
              </div>
            </div>

            {verificationUri && (
              <a
                href={verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent bg-transparent px-4 py-3 text-accent transition hover:bg-accent/10"
              >
                Open GitHub <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <p className="text-center text-sm text-text-dim">
              Waiting for authorization...
            </p>
          </div>
        )}

        {authError && (
          <div className="space-y-2">
            <p className="text-center text-sm text-error">{authError}</p>
            <button
              onClick={handleStart}
              className="w-full rounded-lg border border-accent bg-transparent px-4 py-2 text-sm text-accent transition hover:bg-accent/10"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

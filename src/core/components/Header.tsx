import { useGitHubStore } from "@/core/stores/domain/github";
import { LogOut, Hexagon } from "lucide-react";

export function Header() {
  const { username, avatarUrl, signOut } = useGitHubStore();

  return (
    <header className="glass flex h-14 items-center justify-between px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <Hexagon className="h-4.5 w-4.5 text-accent" strokeWidth={2.5} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[15px] font-semibold tracking-tight text-text">
            GitHub
          </span>
          <span className="font-display text-[15px] font-light tracking-tight text-accent">
            Automate
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 rounded-full border border-border-subtle bg-surface-raised/60 py-1.5 pl-1.5 pr-3.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username ?? "User"}
              className="h-6 w-6 rounded-full ring-1 ring-border"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-surface-hover" />
          )}
          <span className="font-display text-[13px] font-medium text-text-muted">
            {username}
          </span>
        </div>
        <button
          onClick={signOut}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-dim transition-all hover:bg-surface-hover hover:text-text"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

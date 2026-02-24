import { useEffect } from "react";
import { Header } from "@/core/components/Header";
import { AuthScreen } from "@/extensions/settings/AuthScreen";
import { Dashboard } from "@/extensions/dashboard/Dashboard";
import { RepoDetailsPage } from "@/extensions/repo-details/RepoDetailsPage";
import { useGitHubStore } from "@/core/stores/domain/github";
import { useNavigationStore } from "@/core/stores/navigation";

export default function App() {
  const { isAuthenticated, checkAuth, isLoading } = useGitHubStore();
  const { currentView } = useNavigationStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-surface">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
        <span className="font-display text-sm text-text-dim">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <Header />
      <main className="flex-1 overflow-auto">
        {currentView.name === "dashboard" && <Dashboard />}
        {currentView.name === "repo-details" && (
          <RepoDetailsPage repoFullName={currentView.repoFullName} />
        )}
      </main>
    </div>
  );
}

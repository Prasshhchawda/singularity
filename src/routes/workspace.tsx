import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AgentWorkspace } from "../components/agent-workspace";
import { CEOInbox } from "../components/ceo-inbox";
import { WorkspaceShell } from "../components/workspace-shell";
import { supabase } from "../services/supabase";

export const Route = createFileRoute("/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const navigate = useNavigate();
  const [page, setPage] = useState<"home" | "workflow">("workflow");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session) {
        setUserId(session.user.id);
        setIsAuthorized(true);
      } else {
        void navigate({ to: "/", replace: true });
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: sessionData, error: sessionError }) => {
        if (!isMounted) return;
        if (sessionError) throw sessionError;
        if (sessionData.session) {
          setUserId(sessionData.session.user.id);
          setPage("workflow");
          setIsAuthorized(true);
        } else {
          void navigate({ to: "/", replace: true });
        }
      })
      .catch((sessionError: unknown) => {
        if (isMounted) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : "Unable to verify your sign-in status.",
          );
        }
      });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <p role="alert">{error}</p>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        Checking your sign-in status...
      </main>
    );
  }

  return (
    <WorkspaceShell active={page} onNavigate={setPage}>
      {page === "home" ? (
        <CEOInbox />
      ) : userId ? (
        <AgentWorkspace
          key={userId}
          userId={userId}
        />
      ) : null}
    </WorkspaceShell>
  );
}

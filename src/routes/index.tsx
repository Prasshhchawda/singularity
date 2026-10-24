import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AgentWorkspace } from "../components/agent-workspace";
import { CEOInbox } from "../components/ceo-inbox";
import { WorkspaceShell } from "../components/workspace-shell";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [page, setPage] = useState<"home" | "workflow">("home");
  const [showAllAgents, setShowAllAgents] = useState(true);

  return (
    <WorkspaceShell active={page} onNavigate={setPage}>
      {page === "home" ? (
        <CEOInbox />
      ) : (
        <AgentWorkspace showAllAgents={showAllAgents} onShowAllAgentsChange={setShowAllAgents} />
      )}
    </WorkspaceShell>
  );
}

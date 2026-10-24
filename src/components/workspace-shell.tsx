import { Link } from "@tanstack/react-router";
import { Inbox, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { WorkspaceBackground } from "./workspace-background";

export function WorkspaceShell({
  children,
  active,
  onNavigate,
}: {
  active: "home" | "workflow";
  onNavigate: (page: "home" | "workflow") => void;
  children: ReactNode;
}) {
  return (
    <main className={`workspace-shell min-h-dvh text-foreground workspace-shell-${active}`}>
      <WorkspaceBackground />
      <header className="workspace-header">
        <div className="workspace-brand">
          <Link to="/" className="font-display text-lg font-semibold tracking-tight">
            Singularity
          </Link>
        </div>
        <nav className="workspace-nav" aria-label="Workspace">
          <button
            type="button"
            className={active === "home" ? "selected" : ""}
            aria-current={active === "home" ? "page" : undefined}
            onClick={() => onNavigate("home")}
          >
            <Inbox size={15} strokeWidth={1.7} />
            CEO Inbox
          </button>
          <button
            type="button"
            className={active === "workflow" ? "selected" : ""}
            aria-current={active === "workflow" ? "page" : undefined}
            onClick={() => onNavigate("workflow")}
          >
            <Workflow size={15} strokeWidth={1.7} />
            Agent Workflow
          </button>
        </nav>
        <span className="workspace-secure">PRIVATE WORKSPACE</span>
      </header>
      {children}
    </main>
  );
}

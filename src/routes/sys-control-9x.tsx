import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { OpsConsole } from "../components/ops-console";
import { PassphrasePrompt } from "../components/secret-admin-access";
import { isOpsConsoleUnlocked, OPS_UNLOCK_KEY } from "../lib/opsAccess";
import { AdminStoreProvider } from "../lib/adminStore";
import "../ops-console.css";

export const Route = createFileRoute("/sys-control-9x")({
  ssr: false,
  component: SecretOpsRoute,
});

function SecretOpsRoute() {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setUnlocked(isOpsConsoleUnlocked());
    setChecked(true);
  }, []);

  function lockConsole() {
    window.sessionStorage.removeItem(OPS_UNLOCK_KEY);
    setUnlocked(false);
  }

  if (!checked) return <main className="ops-gate-page" aria-busy="true" />;

  if (!unlocked) {
    return (
      <main className="ops-gate-page">
        <PassphrasePrompt onSuccess={() => setUnlocked(true)} />
        <button className="ops-gate-home" type="button" onClick={() => void navigate({ to: "/" })}>
          <LockKeyhole size={14} /> Return to user app
        </button>
      </main>
    );
  }

  return (
    <AdminStoreProvider>
      <OpsConsole onExit={() => void navigate({ to: "/" })} onLock={lockConsole} />
    </AdminStoreProvider>
  );
}

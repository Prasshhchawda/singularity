import { useEffect, useState } from "react";
import { usePwaUpdate } from "./pwa-update-context";

export function PwaUpdatePrompt() {
  const { updateAvailable, updating, updateError, updateNow } = usePwaUpdate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!updateAvailable) setDismissed(false);
  }, [updateAvailable]);

  if (!updateAvailable || dismissed) return null;

  return (
    <aside
      aria-label="App update"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl border border-border bg-background p-4 text-foreground shadow-lg"
    >
      <div>
        <p className="text-sm">An update is ready to install.</p>
        {updateError && <p className="mt-1 text-xs text-destructive">{updateError}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => setDismissed(true)}
          type="button"
        >
          Not now
        </button>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
          disabled={updating}
          onClick={() => void updateNow()}
          type="button"
        >
          {updating ? "Installing..." : "Update now"}
        </button>
      </div>
    </aside>
  );
}

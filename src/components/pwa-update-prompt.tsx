/// <reference types="vite-plugin-pwa/client" />

import { useEffect, useState } from "react";

export function PwaUpdatePrompt() {
  const [updateServiceWorker, setUpdateServiceWorker] = useState<(() => Promise<void>) | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    void import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const update = registerSW({
          immediate: true,
          onNeedRefresh() {
            if (active) setUpdateServiceWorker(() => update);
          },
          onRegisterError(error) {
            console.error("Service worker registration failed.", error);
          },
        });
      })
      .catch((error: unknown) => {
        console.error("Unable to load service worker registration.", error);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!updateServiceWorker) return null;

  return (
    <aside
      aria-label="App update"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl border border-border bg-background p-4 text-foreground shadow-lg"
    >
      <p className="text-sm">An update is ready to install.</p>
      <div className="flex shrink-0 gap-2">
        <button
          className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => setUpdateServiceWorker(null)}
          type="button"
        >
          Later
        </button>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={() => {
            void updateServiceWorker().catch((error: unknown) => {
              console.error("Unable to activate the service worker update.", error);
            });
          }}
          type="button"
        >
          Update
        </button>
      </div>
    </aside>
  );
}

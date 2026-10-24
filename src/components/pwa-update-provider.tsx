/// <reference types="vite-plugin-pwa/client" />

import { useEffect, useState, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { EMPTY_UPDATE_STATE, PwaUpdateContext } from "./pwa-update-context";

export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <PwaUpdateContext.Provider value={EMPTY_UPDATE_STATE}>{children}</PwaUpdateContext.Provider>
    );
  }

  return <PwaUpdateClient>{children}</PwaUpdateClient>;
}

function PwaUpdateClient({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>();
  const [serviceWorkerSupported, setServiceWorkerSupported] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_serviceWorkerUrl, serviceWorkerRegistration) {
      setRegistration(serviceWorkerRegistration);
    },
    onRegisterError(error) {
      console.error("Service worker registration failed.", error);
      setCheckError("Unable to connect to the update service.");
    },
  });

  useEffect(() => {
    setServiceWorkerSupported("serviceWorker" in navigator);
  }, []);

  async function checkForUpdates() {
    setCheckError(null);
    if (!registration) {
      setCheckError(
        serviceWorkerSupported
          ? "The update service is still starting. Try again shortly."
          : "Service worker updates are not supported in this browser.",
      );
      return;
    }

    setChecking(true);
    try {
      await registration.update();
    } catch (error) {
      console.error("Unable to check for service worker updates.", error);
      setCheckError("Unable to check for updates. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function updateNow() {
    if (updating) return;

    setUpdateError(null);
    setUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch (error) {
      console.error("Unable to activate the service worker update.", error);
      setUpdateError("Unable to install the update. Please try again.");
      setUpdating(false);
    }
  }

  return (
    <PwaUpdateContext.Provider
      value={{
        updateAvailable: needRefresh,
        serviceWorkerReady: registration !== undefined,
        serviceWorkerSupported,
        checking,
        updating,
        checkError,
        updateError,
        checkForUpdates,
        updateNow,
      }}
    >
      {children}
    </PwaUpdateContext.Provider>
  );
}

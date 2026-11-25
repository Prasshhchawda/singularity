export const OPS_UNLOCK_KEY = "kinetik-ops-console-unlocked";
export const OPS_ROUTE = "/sys-control-9x";

export function isOpsConsoleUnlocked() {
  return typeof window !== "undefined" && window.sessionStorage.getItem(OPS_UNLOCK_KEY) === "true";
}

export function unlockOpsConsole() {
  window.sessionStorage.setItem(OPS_UNLOCK_KEY, "true");
}

export function getOpsPassphrase() {
  const configuredPassphrase = import.meta.env.VITE_ADMIN_SECRET_KEY?.trim();
  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return configuredPassphrase || (isLocalhost ? "kinetik-dev-2026" : "");
}

export function isValidOpsPassphrase(value: string) {
  const expectedPassphrase = getOpsPassphrase();
  return Boolean(expectedPassphrase) && value === expectedPassphrase;
}

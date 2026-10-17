import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const rememberMeKey = "singularity-remember-me";
const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

function shouldRememberSession() {
  return getRememberMe();
}

const authStorage = {
  getItem(key) {
    if (typeof window === "undefined") return null;

    return shouldRememberSession()
      ? (window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key))
      : window.sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;

    const persistentStorage = shouldRememberSession() ? window.localStorage : window.sessionStorage;
    const temporaryStorage = shouldRememberSession() ? window.sessionStorage : window.localStorage;

    persistentStorage.setItem(key, value);
    temporaryStorage.removeItem(key);
  },
  removeItem(key) {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function getRememberMe() {
  return typeof window === "undefined" || window.localStorage.getItem(rememberMeKey) !== "false";
}

export function setRememberMe(rememberMe) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(rememberMeKey, String(rememberMe));

  if (!rememberMe) {
    window.localStorage.removeItem(authStorageKey);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: authStorageKey,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window === "undefined" ? undefined : authStorage,
  },
});

import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./admin-db.types";

export class AdminAuthorizationError extends Error {
  constructor() {
    super("A signed-in administrator account is required.");
    this.name = "AdminAuthorizationError";
  }
}

function getSupabaseConfig() {
  const url =
    process.env["SUPABASE_URL"]?.trim() || import.meta.env["VITE_SUPABASE_URL"]?.trim();
  const anonKey =
    process.env["SUPABASE_ANON_KEY"]?.trim() ||
    import.meta.env["VITE_SUPABASE_ANON_KEY"]?.trim();

  if (!url || !anonKey) {
    throw new Error("Supabase server configuration is incomplete.");
  }

  return { url, anonKey };
}

export function createPublicSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createUserSupabaseClient(accessToken: string) {
  const { url, anonKey } = getSupabaseConfig();
  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

export async function requireAdmin(accessToken: string): Promise<{
  client: SupabaseClient<Database>;
  adminId: string;
}> {
  if (!accessToken) throw new AdminAuthorizationError();

  const client = createUserSupabaseClient(accessToken);
  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError) {
    if (userError.status === 401 || userError.status === 403) {
      throw new AdminAuthorizationError();
    }
    throw new Error(`Could not verify the administrator session: ${userError.message}`);
  }
  if (!userData.user) throw new AdminAuthorizationError();

  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("role, is_suspended")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not verify the administrator role: ${profileError.message}`);
  }
  if (profile?.role !== "admin" || profile.is_suspended) {
    throw new AdminAuthorizationError();
  }

  return { client, adminId: userData.user.id };
}

export function createMeetingAccessCode() {
  const code = randomBytes(32).toString("base64url");
  return {
    code,
    hash: createHash("sha256").update(code).digest("hex"),
  };
}

export function hashMeetingAccessCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

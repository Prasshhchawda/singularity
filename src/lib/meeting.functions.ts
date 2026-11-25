import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DiscoveryCallStatus } from "./admin.types";

function failOnError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

export const submitDiscoveryCall = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().trim().email().max(320),
      fullName: z.string().trim().min(1).max(120),
      company: z.string().trim().max(200),
      requestedRole: z.string().trim().min(1).max(500),
      scheduledAt: z.string().datetime(),
    }),
  )
  .handler(async ({ data }) => {
    const { createPublicSupabaseClient } = await import("./admin.server");
    const client = createPublicSupabaseClient();
    const { data: calls, error } = await client.rpc("create_discovery_call", {
      p_email: data.email,
      p_full_name: data.fullName,
      p_company: data.company,
      p_requested_role: data.requestedRole,
      p_scheduled_at: data.scheduledAt,
    });
    failOnError(error, "Could not submit discovery call");
    const call = calls?.[0];
    if (!call) throw new Error("The discovery call request was not created.");
    return call;
  });

export const getDiscoveryCallTimer = createServerFn({ method: "POST" })
  .validator(z.object({ callId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { createPublicSupabaseClient } = await import("./admin.server");
    const client = createPublicSupabaseClient();
    const { data: rows, error } = await client.rpc("get_discovery_call_timer", {
      p_call_id: data.callId,
    });
    failOnError(error, "Could not load the call countdown");
    const call = rows?.[0];
    if (!call) throw new Error("This discovery call could not be found.");
    return call;
  });

export const checkMeetingAccess = createServerFn({ method: "POST" })
  .validator(
    z.object({
      callId: z.string().uuid(),
      accessCode: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    }),
  )
  .handler(async ({ data }) => {
    const { createPublicSupabaseClient } = await import("./admin.server");
    const client = createPublicSupabaseClient();
    const { data: results, error } = await client.rpc("get_meeting_access", {
      p_call_id: data.callId,
      p_access_code: data.accessCode,
    });
    failOnError(error, "Could not verify the meeting access code");
    const result = results?.[0];
    if (!result) {
      throw new Error("The meeting access response was empty.");
    }

    return {
      isValid: result.is_valid,
      secondsUntilReady: result.seconds_until_ready,
      meetingUrl: result.meeting_url,
      scheduledAt: result.scheduled_at,
      linkConfigured: result.link_configured,
    };
  });

export const getMarketplaceEmployees = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicSupabaseClient } = await import("./admin.server");
  const client = createPublicSupabaseClient();
  const { data: employees, error } = await client
    .from("ai_employees")
    .select("id, name, role_category, description, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  failOnError(error, "Could not load the AI employee marketplace");
  return employees ?? [];
});

export type MeetingTimerStatus = {
  call_created_at: string;
  scheduled_at: string;
  status: DiscoveryCallStatus;
  seconds_until_ready: number;
};

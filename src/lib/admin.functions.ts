import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  AIEmployee,
  AdminOverview,
  AdminUser,
  AuditLog,
  DiscoveryCall,
  StorageSummary,
  UsageCategory,
} from "./admin.types";

const accessSchema = z.object({ accessToken: z.string().min(1).max(8192) });

async function getAdmin(accessToken: string) {
  const { requireAdmin } = await import("./admin.server");
  return requireAdmin(accessToken);
}

function failOnError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

function mapDiscoveryCall(row: {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  company: string;
  requested_role: string;
  scheduled_at: string;
  status: DiscoveryCall["status"];
  notes: string;
  meeting_url: string | null;
  meeting_link_sent_at: string | null;
  meeting_link_sent_by: string | null;
  meeting_access_code_hash: string | null;
  meeting_access_revoked_at: string | null;
  admin_seen_at: string | null;
  created_at: string;
}): DiscoveryCall {
  return {
    id: row.id,
    user_id: row.user_id,
    email: row.email,
    full_name: row.full_name,
    company: row.company,
    requested_role: row.requested_role,
    scheduled_at: row.scheduled_at,
    status: row.status,
    notes: row.notes,
    meeting_url: row.meeting_url,
    meeting_link_sent_at: row.meeting_link_sent_at,
    meeting_link_sent_by: row.meeting_link_sent_by,
    has_active_code: Boolean(row.meeting_access_code_hash && !row.meeting_access_revoked_at),
    admin_seen_at: row.admin_seen_at,
    created_at: row.created_at,
  };
}

export const verifyAdminSession = createServerFn({ method: "POST" })
  .validator(accessSchema)
  .handler(async ({ data }) => {
    const { AdminAuthorizationError, requireAdmin } = await import("./admin.server");
    try {
      await requireAdmin(data.accessToken);
      return true;
    } catch (error) {
      if (error instanceof AdminAuthorizationError) return false;
      throw error;
    }
  });

export const getAdminOverview = createServerFn({ method: "POST" })
  .validator(accessSchema)
  .handler(async ({ data }): Promise<AdminOverview> => {
    const { client } = await getAdmin(data.accessToken);
    const [users, employees, calls, usage, storage, audit] = await Promise.all([
      client.from("user_profiles").select("id", { count: "exact", head: true }),
      client
        .from("ai_employees")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      client
        .from("discovery_calls")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      client.from("admin_ai_usage_by_category").select("tokens_last_24h"),
      client.from("admin_inbox_storage_summary").select("bytes_used"),
      client
        .from("admin_audit_logs")
        .select("id, admin_id, action, target_type, target_id, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    failOnError(users.error, "Could not load user count");
    failOnError(employees.error, "Could not load AI employee count");
    failOnError(calls.error, "Could not load pending call count");
    failOnError(usage.error, "Could not load AI usage");
    failOnError(storage.error, "Could not load inbox storage");
    failOnError(audit.error, "Could not load recent audit activity");

    const usageRows = usage.data ?? [];
    const storageRows = storage.data ?? [];

    return {
      totalUsers: users.count ?? 0,
      activeEmployees: employees.count ?? 0,
      pendingCalls: calls.count ?? 0,
      tokensLast24Hours: usageRows.reduce((total, row) => total + Number(row.tokens_last_24h), 0),
      inboxStorageBytes: storageRows.reduce((total, row) => total + Number(row.bytes_used), 0),
      recentAuditLogs: (audit.data ?? []) as AuditLog[],
    };
  });

export const getAdminEmployees = createServerFn({ method: "POST" })
  .validator(accessSchema)
  .handler(async ({ data }): Promise<AIEmployee[]> => {
    const { client } = await getAdmin(data.accessToken);
    const { data: employees, error } = await client.rpc("admin_get_ai_employees");
    failOnError(error, "Could not load AI employees");
    return employees ?? [];
  });

const employeeInput = accessSchema.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  role_category: z.enum(["sales", "support", "marketing", "finance", "recruiting", "analytics"]),
  description: z.string().trim().max(2000),
  system_prompt: z.string().trim().min(1).max(30000),
  gemini_model: z.string().trim().min(1).max(128),
  temperature: z.number().min(0).max(2),
  is_active: z.boolean(),
});

export const saveAdminEmployee = createServerFn({ method: "POST" })
  .validator(employeeInput)
  .handler(async ({ data }) => {
    const { client } = await getAdmin(data.accessToken);
    const values = {
      name: data.name,
      role_category: data.role_category,
      description: data.description,
      system_prompt: data.system_prompt,
      gemini_model: data.gemini_model,
      temperature: data.temperature,
      is_active: data.is_active,
    };

    if (data.id) {
      const { data: row, error } = await client
        .from("ai_employees")
        .update(values)
        .eq("id", data.id)
        .select("id")
        .maybeSingle();
      failOnError(error, "Could not update AI employee");
      if (!row) throw new Error("AI employee was not found or is no longer available.");
      return { id: row.id };
    }

    const { data: row, error } = await client
      .from("ai_employees")
      .insert(values)
      .select("id")
      .single();
    failOnError(error, "Could not create AI employee");
    if (!row) throw new Error("AI employee was not created.");
    return { id: row.id };
  });

export const getAdminCalls = createServerFn({ method: "POST" })
  .validator(
    accessSchema.extend({
      status: z
        .enum(["all", "pending", "scheduled", "completed", "converted", "cancelled"])
        .default("all"),
      search: z.string().trim().max(200).default(""),
    }),
  )
  .handler(async ({ data }): Promise<DiscoveryCall[]> => {
    const { client } = await getAdmin(data.accessToken);
    let query = client
      .from("discovery_calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.search) {
      const search = data.search.replace(/[%_\\]/g, "\\$&");
      query = query.or(
        `email.ilike.%${search}%,full_name.ilike.%${search}%,company.ilike.%${search}%`,
      );
    }
    const { data: calls, error } = await query;
    failOnError(error, "Could not load discovery calls");
    return (calls ?? []).map(mapDiscoveryCall);
  });

export const updateAdminCall = createServerFn({ method: "POST" })
  .validator(
    accessSchema.extend({
      callId: z.string().uuid(),
      status: z
        .enum(["pending", "scheduled", "completed", "converted", "cancelled"])
        .optional(),
      notes: z.string().max(10000).optional(),
      scheduledAt: z.string().datetime().optional(),
      meetingUrl: z
        .string()
        .trim()
        .url()
        .refine((value) => value.startsWith("https://"), "Meeting link must use HTTPS.")
        .nullable()
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (
      data.status === undefined &&
      data.notes === undefined &&
      data.scheduledAt === undefined &&
      data.meetingUrl === undefined
    ) {
      throw new Error("Choose at least one discovery-call field to update.");
    }

    const { client } = await getAdmin(data.accessToken);
    const changes: {
      status?: DiscoveryCall["status"];
      notes?: string;
      scheduled_at?: string;
      meeting_url?: string | null;
    } = {};
    if (data.status !== undefined) changes.status = data.status;
    if (data.notes !== undefined) changes.notes = data.notes;
    if (data.scheduledAt !== undefined) changes.scheduled_at = data.scheduledAt;
    if (data.meetingUrl !== undefined) changes.meeting_url = data.meetingUrl;

    const { data: row, error } = await client
      .from("discovery_calls")
      .update(changes)
      .eq("id", data.callId)
      .select("id")
      .maybeSingle();
    failOnError(error, "Could not update discovery call");
    if (!row) throw new Error("Discovery call was not found.");
    return { id: row.id };
  });

export const linkDiscoveryCallToUser = createServerFn({ method: "POST" })
  .validator(
    accessSchema.extend({
      callId: z.string().uuid(),
      email: z.string().trim().email().max(320),
    }),
  )
  .handler(async ({ data }) => {
    const { client } = await getAdmin(data.accessToken);
    const { data: profile, error: profileError } = await client
      .from("user_profiles")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();
    failOnError(profileError, "Could not find a matching workspace account");
    if (!profile) throw new Error("No workspace account matches that email address.");

    const { data: call, error } = await client
      .from("discovery_calls")
      .update({ user_id: profile.id })
      .eq("id", data.callId)
      .select("id")
      .maybeSingle();
    failOnError(error, "Could not link the discovery call to the account");
    if (!call) throw new Error("Discovery call was not found.");
    return { userId: profile.id };
  });

export const issueMeetingAccessCode = createServerFn({ method: "POST" })
  .validator(accessSchema.extend({ callId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { client } = await getAdmin(data.accessToken);
    const { createMeetingAccessCode } = await import("./admin.server");
    const { code, hash } = createMeetingAccessCode();
    const { data: row, error } = await client
      .from("discovery_calls")
      .update({
        meeting_access_code_hash: hash,
        meeting_access_revoked_at: null,
        meeting_link_sent_at: null,
        meeting_link_sent_by: null,
      })
      .eq("id", data.callId)
      .select("id")
      .maybeSingle();
    failOnError(error, "Could not issue meeting access code");
    if (!row) throw new Error("Discovery call was not found.");
    return { code };
  });

export const revokeMeetingAccessCode = createServerFn({ method: "POST" })
  .validator(accessSchema.extend({ callId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { client } = await getAdmin(data.accessToken);
    const { data: row, error } = await client
      .from("discovery_calls")
      .update({ meeting_access_revoked_at: new Date().toISOString() })
      .eq("id", data.callId)
      .select("id")
      .maybeSingle();
    failOnError(error, "Could not revoke meeting access code");
    if (!row) throw new Error("Discovery call was not found.");
    return { id: row.id };
  });

export const markMeetingMessageSent = createServerFn({ method: "POST" })
  .validator(accessSchema.extend({ callId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { client, adminId } = await getAdmin(data.accessToken);
    const { data: row, error } = await client
      .from("discovery_calls")
      .update({
        meeting_link_sent_at: new Date().toISOString(),
        meeting_link_sent_by: adminId,
      })
      .eq("id", data.callId)
      .not("meeting_access_code_hash", "is", null)
      .is("meeting_access_revoked_at", null)
      .select("id")
      .maybeSingle();
    failOnError(error, "Could not mark the customer message as sent");
    if (!row) throw new Error("Issue an active meeting code before marking the message as sent.");
    return { id: row.id };
  });

export const getAdminNotifications = createServerFn({ method: "POST" })
  .validator(accessSchema)
  .handler(async ({ data }) => {
    const { client } = await getAdmin(data.accessToken);
    const { data: calls, error, count } = await client
      .from("discovery_calls")
      .select("id, full_name, email, created_at, scheduled_at", { count: "exact" })
      .is("admin_seen_at", null)
      .order("created_at", { ascending: false })
      .limit(8);
    failOnError(error, "Could not load notifications");
    return { unreadCount: count ?? 0, calls: calls ?? [] };
  });

export const markAdminNotificationsSeen = createServerFn({ method: "POST" })
  .validator(accessSchema.extend({ callIds: z.array(z.string().uuid()).max(100) }))
  .handler(async ({ data }) => {
    if (data.callIds.length === 0) return { updated: 0 };
    const { client } = await getAdmin(data.accessToken);
    const { data: rows, error } = await client
      .from("discovery_calls")
      .update({ admin_seen_at: new Date().toISOString() })
      .in("id", data.callIds)
      .is("admin_seen_at", null)
      .select("id");
    failOnError(error, "Could not mark notifications as read");
    return { updated: rows?.length ?? 0 };
  });

export const getAdminUsers = createServerFn({ method: "POST" })
  .validator(
    accessSchema.extend({
      search: z.string().trim().max(200).default(""),
      page: z.number().int().min(0).max(10000).default(0),
    }),
  )
  .handler(async ({ data }): Promise<{ users: AdminUser[]; total: number }> => {
    const { client } = await getAdmin(data.accessToken);
    const pageSize = 25;
    let profileQuery = client
      .from("user_profiles")
      .select("id, email, role, is_suspended, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    if (data.search) {
      const search = data.search.replace(/[%_\\]/g, "\\$&");
      profileQuery = profileQuery.ilike("email", `%${search}%`);
    }

    const { data: profiles, error: profileError, count } = await profileQuery;
    failOnError(profileError, "Could not load users");
    const ids = (profiles ?? []).map((profile) => profile.id);
    if (ids.length === 0) return { users: [], total: count ?? 0 };

    const [metricsResult, employeesResult] = await Promise.all([
      client
        .from("admin_user_workspace_metrics")
        .select("user_id, employee_count, message_count, storage_bytes")
        .in("user_id", ids),
      client
        .from("client_employees")
        .select("id, client_id, employee_name, employee_role, status")
        .in("client_id", ids),
    ]);
    failOnError(metricsResult.error, "Could not load workspace metrics");
    failOnError(employeesResult.error, "Could not load assigned specialists");

    const metrics = new Map(
      (metricsResult.data ?? []).map((metric) => [metric.user_id, metric]),
    );
    const employeesByUser = new Map<string, AdminUser["employees"]>();
    for (const employee of employeesResult.data ?? []) {
      const current = employeesByUser.get(employee.client_id) ?? [];
      current.push({
        id: employee.id,
        employee_name: employee.employee_name,
        employee_role: employee.employee_role,
        status: employee.status,
      });
      employeesByUser.set(employee.client_id, current);
    }

    return {
      total: count ?? 0,
      users: (profiles ?? []).map((profile) => {
        const metric = metrics.get(profile.id);
        return {
          ...profile,
          employee_count: metric?.employee_count ?? 0,
          message_count: metric?.message_count ?? 0,
          storage_bytes: metric?.storage_bytes ?? 0,
          employees: employeesByUser.get(profile.id) ?? [],
        };
      }),
    };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .validator(
    accessSchema.extend({
      userId: z.string().uuid(),
      isSuspended: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { client, adminId } = await getAdmin(data.accessToken);
    if (data.userId === adminId && data.isSuspended) {
      throw new Error("You cannot suspend the currently signed-in administrator.");
    }
    const { data: profile, error } = await client
      .from("user_profiles")
      .update({ is_suspended: data.isSuspended })
      .eq("id", data.userId)
      .select("id")
      .maybeSingle();
    failOnError(error, "Could not update account access");
    if (!profile) throw new Error("User was not found.");
    return { id: profile.id, isSuspended: data.isSuspended };
  });

export const grantUserEmployee = createServerFn({ method: "POST" })
  .validator(
    accessSchema.extend({
      userId: z.string().uuid(),
      employeeName: z.string().trim().min(1).max(120),
      employeeRole: z.string().trim().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const { client } = await getAdmin(data.accessToken);
    const { data: existing, error: lookupError } = await client
      .from("client_employees")
      .select("id")
      .eq("client_id", data.userId)
      .eq("employee_name", data.employeeName)
      .maybeSingle();
    failOnError(lookupError, "Could not check existing employee access");
    if (existing) return { id: existing.id, alreadyAssigned: true };

    const { data: employee, error } = await client
      .from("client_employees")
      .insert({
        client_id: data.userId,
        employee_name: data.employeeName,
        employee_role: data.employeeRole,
        status: "active",
      })
      .select("id")
      .single();
    failOnError(error, "Could not grant specialist access");
    if (!employee) throw new Error("Specialist access was not created.");
    return { id: employee.id, alreadyAssigned: false };
  });

export const revokeUserEmployee = createServerFn({ method: "POST" })
  .validator(
    accessSchema.extend({
      userId: z.string().uuid(),
      employeeId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const { client } = await getAdmin(data.accessToken);
    const { data: employee, error: lookupError } = await client
      .from("client_employees")
      .select("id")
      .eq("client_id", data.userId)
      .eq("id", data.employeeId)
      .maybeSingle();
    failOnError(lookupError, "Could not check specialist access");
    if (!employee) throw new Error("This specialist is not assigned to the user.");

    const { error } = await client
      .from("client_employees")
      .delete()
      .eq("client_id", data.userId)
      .eq("id", data.employeeId);
    failOnError(error, "Could not revoke specialist access");
    return { id: employee.id };
  });

export const getAdminMonitoring = createServerFn({ method: "POST" })
  .validator(accessSchema)
  .handler(async ({ data }): Promise<{
    usage: UsageCategory[];
    storage: StorageSummary[];
    archivedFiles: Array<{
      id: string;
      filename: string;
      size_bytes: number;
      received_at: string;
    }>;
  }> => {
    const { client } = await getAdmin(data.accessToken);
    const [usageResult, storageResult, filesResult] = await Promise.all([
      client
        .from("admin_ai_usage_by_category")
        .select("role_category, request_count, tokens_in, tokens_out, tokens_last_24h")
        .order("tokens_last_24h", { ascending: false }),
      client
        .from("admin_inbox_storage_summary")
        .select("status, file_count, bytes_used")
        .order("status"),
      client
        .from("received_files")
        .select("id, filename, size_bytes, received_at")
        .eq("status", "archived")
        .order("received_at", { ascending: true })
        .limit(100),
    ]);
    failOnError(usageResult.error, "Could not load AI usage breakdown");
    failOnError(storageResult.error, "Could not load inbox storage summary");
    failOnError(filesResult.error, "Could not load archived files");
    return {
      usage: usageResult.data ?? [],
      storage: storageResult.data ?? [],
      archivedFiles: filesResult.data ?? [],
    };
  });

export const purgeArchivedFiles = createServerFn({ method: "POST" })
  .validator(
    accessSchema.extend({
      before: z.string().datetime(),
      confirmText: z.literal("PURGE"),
    }),
  )
  .handler(async ({ data }) => {
    const { client, adminId } = await getAdmin(data.accessToken);
    const { error: auditError } = await client
      .from("admin_audit_logs")
      .insert({
        admin_id: adminId,
        action: "purge_archived_files_started",
        target_type: "received_files",
        metadata: { before: data.before, outcome: "started" },
      });
    failOnError(auditError, "Could not record the storage cleanup");

    let filesDeleted = 0;
    let bytesDeleted = 0;

    for (;;) {
      const { data: files, error: filesError } = await client
        .from("received_files")
        .select("id, storage_path, size_bytes")
        .eq("status", "archived")
        .lt("received_at", data.before)
        .order("received_at", { ascending: true })
        .limit(100);
      failOnError(filesError, "Could not list archived files for cleanup");
      if (!files || files.length === 0) break;

      const { error: storageError } = await client.storage
        .from("singularity-inbox")
        .remove(files.map((file) => file.storage_path));
      failOnError(storageError, "Could not delete archived inbox objects");

      const { error: rowError } = await client
        .from("received_files")
        .delete()
        .in("id", files.map((file) => file.id));
      failOnError(rowError, "Could not delete archived file records");

      filesDeleted += files.length;
      bytesDeleted += files.reduce((total, file) => total + Number(file.size_bytes), 0);
    }

    const { error: auditFinishError } = await client
      .from("admin_audit_logs")
      .insert({
        admin_id: adminId,
        action: "purge_archived_files_completed",
        target_type: "received_files",
        target_id: null,
        metadata: {
          before: data.before,
          outcome: "completed",
          files_deleted: filesDeleted,
          bytes_deleted: bytesDeleted,
        },
      });
    failOnError(auditFinishError, "Files were purged, but the audit log could not be finalized");

    return { filesDeleted, bytesDeleted };
  });

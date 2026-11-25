export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EmployeeCategory =
  | "sales"
  | "support"
  | "marketing"
  | "finance"
  | "recruiting"
  | "analytics";

export type EmployeeStatus = "active" | "paused" | "setup";

export type AIEmployee = {
  id: string;
  name: string;
  role_category: EmployeeCategory;
  description: string;
  system_prompt: string;
  gemini_model: string;
  temperature: number;
  is_active: boolean;
  created_at: string;
};

export type DiscoveryCallStatus =
  | "pending"
  | "scheduled"
  | "completed"
  | "converted"
  | "cancelled";

export type DiscoveryCall = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  company: string;
  requested_role: string;
  scheduled_at: string;
  status: DiscoveryCallStatus;
  notes: string;
  meeting_url: string | null;
  meeting_link_sent_at: string | null;
  meeting_link_sent_by: string | null;
  has_active_code: boolean;
  admin_seen_at: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Json;
  created_at: string;
};

export type AdminUser = {
  id: string;
  email: string | null;
  role: "user" | "admin";
  is_suspended: boolean;
  created_at: string;
  employee_count: number;
  message_count: number;
  storage_bytes: number;
  employees: Array<{
    id: string;
    employee_name: string;
    employee_role: string;
    status: EmployeeStatus;
  }>;
};

export type UsageCategory = {
  role_category: string;
  request_count: number;
  tokens_in: number;
  tokens_out: number;
  tokens_last_24h: number;
};

export type StorageSummary = {
  status: "received" | "archived";
  file_count: number;
  bytes_used: number;
};

export type AdminOverview = {
  totalUsers: number;
  activeEmployees: number;
  pendingCalls: number;
  tokensLast24Hours: number;
  inboxStorageBytes: number;
  recentAuditLogs: AuditLog[];
};

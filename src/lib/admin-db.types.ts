import type { Json } from "./admin.types";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

type UserProfileRow = {
  id: string;
  email: string | null;
  role: "user" | "admin";
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
};

type AIEmployeeRow = {
  id: string;
  name: string;
  role_category: "sales" | "support" | "marketing" | "finance" | "recruiting" | "analytics";
  description: string;
  system_prompt: string;
  gemini_model: string;
  temperature: number;
  is_active: boolean;
  created_at: string;
};

type DiscoveryCallRow = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  company: string;
  requested_role: string;
  scheduled_at: string;
  status: "pending" | "scheduled" | "completed" | "converted" | "cancelled";
  notes: string;
  meeting_url: string | null;
  meeting_link_sent_at: string | null;
  meeting_link_sent_by: string | null;
  meeting_access_code_hash: string | null;
  meeting_access_revoked_at: string | null;
  admin_seen_at: string | null;
  created_at: string;
};

type AIUsageLogRow = {
  id: string;
  user_id: string | null;
  employee_id: string | null;
  tokens_in: number;
  tokens_out: number;
  model: string;
  latency_ms: number | null;
  created_at: string;
};

type ReceivedFileRow = {
  id: string;
  user_id: string | null;
  filename: string;
  client_name: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  received_at: string;
  status: "received" | "archived";
  assigned_agent: string | null;
  is_read: boolean;
};

type ClientEmployeeRow = {
  id: string;
  client_id: string;
  employee_name: string;
  employee_role: string;
  status: "active" | "paused" | "setup";
  created_at: string;
};

type ConversationRow = {
  id: string;
  client_id: string;
  title: string;
  primary_employee_id: string | null;
  created_at: string;
  updated_at: string;
};

type ConversationEmployeeRow = {
  conversation_id: string;
  employee_id: string;
};

type ConversationMessageRow = {
  id: string;
  conversation_id: string;
  sender: "client" | "agent" | "system";
  employee_id: string | null;
  content: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      user_profiles: Table<
        UserProfileRow,
        Pick<UserProfileRow, "id"> & Partial<Pick<UserProfileRow, "email" | "role" | "is_suspended">>,
        Partial<Pick<UserProfileRow, "email" | "role" | "is_suspended">>
      >;
      admin_audit_logs: Table<
        {
          id: string;
          admin_id: string;
          action: string;
          target_type: string;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          admin_id: string;
          action: string;
          target_type: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        }
      >;
      ai_employees: Table<AIEmployeeRow, Omit<AIEmployeeRow, "id" | "created_at"> & Partial<Pick<AIEmployeeRow, "id" | "created_at">>>;
      discovery_calls: Table<DiscoveryCallRow, Omit<DiscoveryCallRow, "id" | "created_at"> & Partial<Pick<DiscoveryCallRow, "id" | "created_at">>>;
      ai_usage_logs: Table<
        AIUsageLogRow & { discovery_call_id: string | null },
        Omit<AIUsageLogRow, "id" | "created_at"> &
          Partial<Pick<AIUsageLogRow, "id" | "created_at">> & { discovery_call_id?: string | null }
      >;
      received_files: Table<ReceivedFileRow, Omit<ReceivedFileRow, "id" | "received_at"> & Partial<Pick<ReceivedFileRow, "id" | "received_at">>>;
      client_employees: Table<
        ClientEmployeeRow,
        Omit<ClientEmployeeRow, "id" | "created_at"> & Partial<Pick<ClientEmployeeRow, "id" | "created_at">>
      >;
      conversations: Table<ConversationRow, Omit<ConversationRow, "id" | "created_at" | "updated_at"> & Partial<Pick<ConversationRow, "id" | "created_at" | "updated_at">>>;
      conversation_employees: Table<ConversationEmployeeRow, ConversationEmployeeRow>;
      conversation_messages: Table<
        ConversationMessageRow,
        Omit<ConversationMessageRow, "id" | "created_at"> & Partial<Pick<ConversationMessageRow, "id" | "created_at">>
      >;
    };
    Views: {
      admin_ai_usage_by_category: View<{
        role_category: string;
        request_count: number;
        tokens_in: number;
        tokens_out: number;
        tokens_last_24h: number;
      }>;
      admin_inbox_storage_summary: View<{
        status: "received" | "archived";
        file_count: number;
        bytes_used: number;
      }>;
      admin_user_workspace_metrics: View<{
        user_id: string;
        employee_count: number;
        message_count: number;
        storage_bytes: number;
      }>;
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_active_user: { Args: Record<string, never>; Returns: boolean };
      admin_get_ai_employees: { Args: Record<string, never>; Returns: AIEmployeeRow[] };
      create_discovery_call: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_company: string;
          p_requested_role: string;
          p_scheduled_at: string;
        };
        Returns: { call_id: string; created_at: string }[];
      };
      get_discovery_call_timer: {
        Args: { p_call_id: string };
        Returns: {
          call_created_at: string;
          scheduled_at: string;
          status: DiscoveryCallRow["status"];
          seconds_until_ready: number;
        }[];
      };
      get_meeting_access: {
        Args: { p_call_id: string; p_access_code: string };
        Returns: {
          is_valid: boolean;
          seconds_until_ready: number;
          meeting_url: string | null;
          scheduled_at: string | null;
          link_configured: boolean;
        }[];
      };
      get_meeting_employee_config: {
        Args: { p_call_id: string; p_access_code: string; p_employee_name: string };
        Returns: {
          system_prompt: string;
          gemini_model: string;
          temperature: number;
        }[];
      };
      record_ai_usage: {
        Args: {
          p_call_id: string;
          p_access_code: string;
          p_employee_name: string;
          p_tokens_in: number;
          p_tokens_out: number;
          p_model: string;
          p_latency_ms: number;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type EmployeeCategory =
  "sales" | "support" | "marketing" | "finance" | "recruiting" | "analytics";

export type AIEmployee = {
  id: string;
  name: string;
  category: EmployeeCategory;
  role: string;
  description: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  isActive: boolean;
  createdAt: string;
};

export type DiscoveryCallStatus = "pending" | "scheduled" | "completed" | "converted";

export type DiscoveryCall = {
  id: string;
  name: string;
  email: string;
  company: string;
  requestedRole: string;
  scheduledAt: string;
  status: DiscoveryCallStatus;
  notes: string;
};

export type WorkspaceUser = {
  id: string;
  name: string;
  email: string;
  hiredEmployees: string[];
  messageCount: number;
  storageBytes: number;
  hasAccess: boolean;
};

export type UsageCategory = {
  category: EmployeeCategory;
  tokensIn: number;
  tokensOut: number;
  requests: number;
};

export type StorageMetrics = {
  activeBytes: number;
  archivedBytes: number;
  archivedFiles: number;
};

export type ActivityEntry = {
  id: string;
  action: string;
  target: string;
  createdAt: string;
};

export type EmployeeDraft = Omit<AIEmployee, "id" | "createdAt"> & { id?: string };

type AdminStoreValue = {
  employees: AIEmployee[];
  calls: DiscoveryCall[];
  users: WorkspaceUser[];
  usage: UsageCategory[];
  storage: StorageMetrics;
  activity: ActivityEntry[];
  saveEmployee: (draft: EmployeeDraft) => void;
  toggleEmployee: (id: string) => void;
  updateCall: (id: string, changes: Partial<Pick<DiscoveryCall, "status" | "notes">>) => void;
  toggleUserAccess: (id: string) => void;
  cleanupArchivedFiles: () => void;
};

const initialEmployees: AIEmployee[] = [
  {
    id: "nova",
    name: "NOVA",
    category: "sales",
    role: "AI Sales Rep",
    description: "Outbound, lead qualifying & thoughtful follow-ups.",
    model: "gemini-2.5-flash",
    temperature: 0.7,
    systemPrompt:
      "You are NOVA, an ethical sales assistant. Qualify leads and draft thoughtful follow-ups without claiming to contact anyone.",
    isActive: true,
    createdAt: "2026-01-08T09:00:00.000Z",
  },
  {
    id: "atlas",
    name: "ATLAS",
    category: "support",
    role: "AI Support Agent",
    description: "Tickets, live chat, and multilingual customer support.",
    model: "gemini-2.5-flash",
    temperature: 0.6,
    systemPrompt:
      "You are ATLAS, a precise and empathetic customer support assistant. Ask concise questions and never claim to change an account.",
    isActive: true,
    createdAt: "2026-01-10T09:00:00.000Z",
  },
  {
    id: "echo",
    name: "ECHO",
    category: "marketing",
    role: "AI Social Media Manager",
    description: "Social posts, captions, schedules, and reply drafts.",
    model: "gemini-2.5-flash",
    temperature: 0.8,
    systemPrompt:
      "You are ECHO, a social media assistant. Write platform-aware content and do not claim to publish it.",
    isActive: true,
    createdAt: "2026-01-12T09:00:00.000Z",
  },
  {
    id: "ledger",
    name: "LEDGER",
    category: "finance",
    role: "AI Bookkeeper",
    description: "Invoice summaries, expense organization, and reports.",
    model: "gemini-2.5-pro",
    temperature: 0.3,
    systemPrompt:
      "You are LEDGER, a careful bookkeeping assistant. Explain assumptions and never invent transactions.",
    isActive: true,
    createdAt: "2026-01-14T09:00:00.000Z",
  },
  {
    id: "scout",
    name: "SCOUT",
    category: "recruiting",
    role: "AI Recruiter",
    description: "Inclusive job descriptions, screening, and interview plans.",
    model: "gemini-2.5-flash",
    temperature: 0.5,
    systemPrompt:
      "You are SCOUT, an inclusive recruiting assistant. Support human hiring decisions; do not make them.",
    isActive: true,
    createdAt: "2026-01-16T09:00:00.000Z",
  },
  {
    id: "quill",
    name: "QUILL",
    category: "marketing",
    role: "AI Content Writer",
    description: "Blogs, SEO pages, email drafts, and ad copy.",
    model: "gemini-2.5-pro",
    temperature: 0.8,
    systemPrompt:
      "You are QUILL, an original content writer. Label assumptions and never claim to publish or send content.",
    isActive: true,
    createdAt: "2026-01-18T09:00:00.000Z",
  },
  {
    id: "pulse",
    name: "PULSE",
    category: "analytics",
    role: "AI Data Analyst",
    description: "Dashboards, forecasts, and weekly insights.",
    model: "gemini-2.5-flash",
    temperature: 0.4,
    systemPrompt:
      "You are PULSE, a data analyst. Explain calculations and distinguish measured facts from estimates.",
    isActive: false,
    createdAt: "2026-01-20T09:00:00.000Z",
  },
];

const initialCalls: DiscoveryCall[] = [
  {
    id: "call-1048",
    name: "Priya Sharma",
    email: "priya@northstar.in",
    company: "Northstar Retail",
    requestedRole: "Customer support",
    scheduledAt: "2026-11-27T10:30:00.000Z",
    status: "pending",
    notes: "Interested in after-hours support coverage.",
  },
  {
    id: "call-1047",
    name: "Arjun Mehta",
    email: "arjun@brightpath.io",
    company: "Brightpath",
    requestedRole: "Sales and lead qualification",
    scheduledAt: "2026-11-28T08:00:00.000Z",
    status: "scheduled",
    notes: "Send implementation overview before the call.",
  },
  {
    id: "call-1046",
    name: "Maya Kapoor",
    email: "maya@fieldnote.co",
    company: "Fieldnote",
    requestedRole: "Content writing",
    scheduledAt: "2026-11-21T12:00:00.000Z",
    status: "completed",
    notes: "Follow up with the QUILL sample.",
  },
  {
    id: "call-1045",
    name: "Dev Patel",
    email: "dev@orbitworks.com",
    company: "Orbit Works",
    requestedRole: "Analytics",
    scheduledAt: "2026-11-20T09:30:00.000Z",
    status: "converted",
    notes: "Workspace setup completed.",
  },
  {
    id: "call-1044",
    name: "Isha Rao",
    email: "isha@loomlabs.in",
    company: "Loom Labs",
    requestedRole: "Recruiting",
    scheduledAt: "2026-11-30T11:00:00.000Z",
    status: "pending",
    notes: "",
  },
];

const initialUsers: WorkspaceUser[] = [
  {
    id: "user-001",
    name: "Priya Sharma",
    email: "priya@northstar.in",
    hiredEmployees: ["ATLAS", "NOVA"],
    messageCount: 384,
    storageBytes: 2_480_000_000,
    hasAccess: true,
  },
  {
    id: "user-002",
    name: "Arjun Mehta",
    email: "arjun@brightpath.io",
    hiredEmployees: ["NOVA", "PULSE"],
    messageCount: 216,
    storageBytes: 840_000_000,
    hasAccess: true,
  },
  {
    id: "user-003",
    name: "Maya Kapoor",
    email: "maya@fieldnote.co",
    hiredEmployees: ["QUILL", "ECHO"],
    messageCount: 592,
    storageBytes: 5_160_000_000,
    hasAccess: true,
  },
  {
    id: "user-004",
    name: "Dev Patel",
    email: "dev@orbitworks.com",
    hiredEmployees: ["PULSE", "LEDGER"],
    messageCount: 148,
    storageBytes: 1_320_000_000,
    hasAccess: false,
  },
  {
    id: "user-005",
    name: "Isha Rao",
    email: "isha@loomlabs.in",
    hiredEmployees: ["SCOUT"],
    messageCount: 97,
    storageBytes: 460_000_000,
    hasAccess: true,
  },
];

const initialUsage: UsageCategory[] = [
  { category: "sales", tokensIn: 824_400, tokensOut: 316_200, requests: 2481 },
  { category: "support", tokensIn: 1_208_800, tokensOut: 540_400, requests: 3942 },
  { category: "marketing", tokensIn: 936_100, tokensOut: 682_700, requests: 2864 },
  { category: "finance", tokensIn: 412_600, tokensOut: 228_900, requests: 896 },
  { category: "recruiting", tokensIn: 298_300, tokensOut: 174_200, requests: 724 },
  { category: "analytics", tokensIn: 668_900, tokensOut: 321_800, requests: 1748 },
];

const initialStorage: StorageMetrics = {
  activeBytes: 10_260_000_000,
  archivedBytes: 4_180_000_000,
  archivedFiles: 286,
};

const initialActivity: ActivityEntry[] = [
  {
    id: "activity-1",
    action: "Discovery call requested",
    target: "Priya Sharma · Northstar Retail",
    createdAt: "Today · 09:42",
  },
  {
    id: "activity-2",
    action: "Employee status changed",
    target: "PULSE · Set inactive",
    createdAt: "Today · 09:18",
  },
  {
    id: "activity-3",
    action: "Workspace access updated",
    target: "Dev Patel · Access revoked",
    createdAt: "Yesterday · 16:05",
  },
  {
    id: "activity-4",
    action: "Call marked complete",
    target: "Maya Kapoor · Fieldnote",
    createdAt: "Yesterday · 14:31",
  },
];

const AdminStoreContext = createContext<AdminStoreValue | null>(null);

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [calls, setCalls] = useState(initialCalls);
  const [users, setUsers] = useState(initialUsers);
  const [usage] = useState(initialUsage);
  const [storage, setStorage] = useState(initialStorage);
  const [activity, setActivity] = useState(initialActivity);

  const addActivity = useCallback((action: string, target: string) => {
    setActivity((current) =>
      [{ id: `activity-${Date.now()}`, action, target, createdAt: "Just now" }, ...current].slice(
        0,
        8,
      ),
    );
  }, []);

  const saveEmployee = useCallback(
    (draft: EmployeeDraft) => {
      const employee: AIEmployee = {
        ...draft,
        id: draft.id ?? `employee-${crypto.randomUUID()}`,
        createdAt: draft.id
          ? (employees.find((item) => item.id === draft.id)?.createdAt ?? new Date().toISOString())
          : new Date().toISOString(),
      };
      setEmployees((current) =>
        draft.id
          ? current.map((item) => (item.id === draft.id ? employee : item))
          : [employee, ...current],
      );
      addActivity(draft.id ? "Employee profile updated" : "AI employee created", employee.name);
    },
    [addActivity, employees],
  );

  const toggleEmployee = useCallback(
    (id: string) => {
      const employee = employees.find((item) => item.id === id);
      if (!employee) return;
      const isActive = !employee.isActive;
      setEmployees((current) =>
        current.map((item) => (item.id === id ? { ...item, isActive } : item)),
      );
      addActivity(isActive ? "Employee activated" : "Employee deactivated", employee.name);
    },
    [addActivity, employees],
  );

  const updateCall = useCallback(
    (id: string, changes: Partial<Pick<DiscoveryCall, "status" | "notes">>) => {
      const call = calls.find((item) => item.id === id);
      if (!call) return;
      setCalls((current) =>
        current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      );
      if (changes.status && changes.status !== call.status) {
        addActivity("Discovery call status updated", `${call.name} · ${changes.status}`);
      }
    },
    [addActivity, calls],
  );

  const toggleUserAccess = useCallback(
    (id: string) => {
      const user = users.find((item) => item.id === id);
      if (!user) return;
      const hasAccess = !user.hasAccess;
      setUsers((current) =>
        current.map((item) => (item.id === id ? { ...item, hasAccess } : item)),
      );
      addActivity(hasAccess ? "Workspace access granted" : "Workspace access revoked", user.name);
    },
    [addActivity, users],
  );

  const cleanupArchivedFiles = useCallback(() => {
    setStorage((current) => ({ ...current, archivedBytes: 0, archivedFiles: 0 }));
    addActivity("Archived storage cleared", "Mock inbox storage");
  }, [addActivity]);

  const value = useMemo<AdminStoreValue>(
    () => ({
      employees,
      calls,
      users,
      usage,
      storage,
      activity,
      saveEmployee,
      toggleEmployee,
      updateCall,
      toggleUserAccess,
      cleanupArchivedFiles,
    }),
    [
      employees,
      calls,
      users,
      usage,
      storage,
      activity,
      saveEmployee,
      toggleEmployee,
      updateCall,
      toggleUserAccess,
      cleanupArchivedFiles,
    ],
  );

  return createElement(AdminStoreContext.Provider, { value }, children);
}

export function useAdminStore() {
  const store = useContext(AdminStoreContext);
  if (!store) throw new Error("useAdminStore must be used inside AdminStoreProvider.");
  return store;
}

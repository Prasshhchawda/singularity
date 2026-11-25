import { useMemo, useState, type ComponentType, type FormEvent } from "react";
import {
  Activity,
  Archive,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clock3,
  Database,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  type AIEmployee,
  type DiscoveryCall,
  type DiscoveryCallStatus,
  type EmployeeCategory,
  type EmployeeDraft,
  type WorkspaceUser,
  useAdminStore,
} from "../lib/adminStore";

type ConsoleSection = "overview" | "employees" | "calls" | "users" | "monitoring";
type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

const sections: Array<{ id: ConsoleSection; label: string; icon: IconType }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "employees", label: "AI employees", icon: Bot },
  { id: "calls", label: "Discovery calls", icon: BriefcaseBusiness },
  { id: "users", label: "Users & workspaces", icon: Users },
  { id: "monitoring", label: "Usage & storage", icon: Activity },
];

const categoryLabels: Record<EmployeeCategory, string> = {
  sales: "Sales",
  support: "Support",
  marketing: "Marketing",
  finance: "Finance",
  recruiting: "Recruiting",
  analytics: "Analytics",
};

const callStatuses: DiscoveryCallStatus[] = ["pending", "scheduled", "completed", "converted"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${formatNumber(bytes)} B`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function OpsConsole({ onExit, onLock }: { onExit: () => void; onLock: () => void }) {
  const [section, setSection] = useState<ConsoleSection>("overview");

  return (
    <div className="ops-layout">
      <aside className="ops-sidebar">
        <div className="ops-brand">
          <div className="ops-brand-icon">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <strong>KINETIK</strong>
            <span>OPS CONSOLE</span>
          </div>
        </div>

        <div className="ops-local-badge">
          <span /> LOCAL MOCK DATA
        </div>

        <nav className="ops-nav" aria-label="Operations console sections">
          <p className="ops-nav-label">WORKSPACE</p>
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`ops-nav-link${section === item.id ? " is-active" : ""}`}
                onClick={() => setSection(item.id)}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
                {section === item.id && <span className="ops-nav-indicator" />}
              </button>
            );
          })}
        </nav>

        <div className="ops-sidebar-bottom">
          <div className="ops-protected-note">
            <ShieldCheck size={16} />
            <span>
              Offline preview
              <br />
              <strong>No live customer data</strong>
            </span>
          </div>
          <button type="button" className="ops-exit-button" onClick={onExit}>
            <ArrowLeft size={16} /> Exit to user app
          </button>
          <button type="button" className="ops-lock-button" onClick={onLock}>
            <LockKeyhole size={15} /> Lock console
          </button>
        </div>
      </aside>

      <div className="ops-main">
        <header className="ops-topbar">
          <div className="ops-breadcrumb">
            <span>Operations</span>
            <span className="ops-breadcrumb-slash">/</span>
            <strong>{sections.find((item) => item.id === section)?.label}</strong>
          </div>
          <div className="ops-topbar-right">
            <span className="ops-environment-pill">
              <span /> DEMO ENVIRONMENT
            </span>
            <div className="ops-avatar">K</div>
          </div>
        </header>

        <main className="ops-content">
          {section === "overview" && <OverviewPanel onNavigate={setSection} />}
          {section === "employees" && <EmployeesPanel />}
          {section === "calls" && <CallsPanel />}
          {section === "users" && <UsersPanel />}
          {section === "monitoring" && <MonitoringPanel />}
        </main>
      </div>
    </div>
  );
}

function OverviewPanel({ onNavigate }: { onNavigate: (section: ConsoleSection) => void }) {
  const { employees, calls, users, usage, storage, activity } = useAdminStore();
  const activeEmployees = employees.filter((item) => item.isActive).length;
  const pendingCalls = calls.filter((item) => item.status === "pending").length;
  const totalTokens = usage.reduce((sum, item) => sum + item.tokensIn + item.tokensOut, 0);
  const storageTotal = storage.activeBytes + storage.archivedBytes;
  const metrics = [
    {
      label: "Total users",
      value: formatNumber(users.length),
      note: "Across all workspaces",
      icon: Users,
      tone: "blue",
    },
    {
      label: "Active AI employees",
      value: formatNumber(activeEmployees),
      note: `of ${employees.length} specialists`,
      icon: Bot,
      tone: "violet",
    },
    {
      label: "Pending discovery calls",
      value: formatNumber(pendingCalls),
      note: "Awaiting follow-up",
      icon: BriefcaseBusiness,
      tone: "amber",
    },
    {
      label: "Gemini tokens · 24h",
      value: `${(totalTokens / 1_000_000).toFixed(1)}M`,
      note: "Mock usage estimate",
      icon: Zap,
      tone: "green",
    },
    {
      label: "CEO Inbox storage",
      value: formatBytes(storageTotal),
      note: `${storage.archivedFiles} archived files`,
      icon: Archive,
      tone: "rose",
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="CONTROL CENTER"
        title="Good morning, KINETIK"
        description="A clear snapshot of your AI employee marketplace and workspace activity."
      />
      <div className="ops-demo-callout">
        <ShieldCheck size={16} />
        <span>
          This console uses local mock data only. Changes are temporary in-memory edits and do not
          reach Supabase.
        </span>
      </div>
      <section className="ops-metric-grid" aria-label="Marketplace overview metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="ops-metric-card" key={metric.label}>
              <div className={`ops-metric-icon tone-${metric.tone}`}>
                <Icon size={18} />
              </div>
              <span className="ops-metric-label">{metric.label}</span>
              <strong className="ops-metric-value">{metric.value}</strong>
              <span className="ops-metric-note">{metric.note}</span>
            </article>
          );
        })}
      </section>

      <div className="ops-overview-grid">
        <section className="ops-panel ops-activity-panel">
          <div className="ops-panel-heading">
            <div>
              <p className="ops-eyebrow">LATEST UPDATES</p>
              <h2>Recent activity</h2>
            </div>
            <span className="ops-live-pill">
              <span /> LIVE PREVIEW
            </span>
          </div>
          <div className="ops-activity-list">
            {activity.map((item) => (
              <article className="ops-activity-item" key={item.id}>
                <span className="ops-activity-dot">
                  <Activity size={14} />
                </span>
                <div>
                  <strong>{item.action}</strong>
                  <span>{item.target}</span>
                </div>
                <time>{item.createdAt}</time>
              </article>
            ))}
          </div>
        </section>

        <section className="ops-panel ops-quick-panel">
          <div className="ops-panel-heading">
            <div>
              <p className="ops-eyebrow">QUICK ACCESS</p>
              <h2>Manage workspace</h2>
            </div>
          </div>
          <button type="button" className="ops-quick-link" onClick={() => onNavigate("employees")}>
            <span className="ops-quick-icon">
              <Bot size={17} />
            </span>
            <span>
              <strong>AI employee catalog</strong>
              <small>Manage specialist profiles</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
          <button type="button" className="ops-quick-link" onClick={() => onNavigate("calls")}>
            <span className="ops-quick-icon amber">
              <BriefcaseBusiness size={17} />
            </span>
            <span>
              <strong>Discovery call pipeline</strong>
              <small>Review incoming requests</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
          <button type="button" className="ops-quick-link" onClick={() => onNavigate("users")}>
            <span className="ops-quick-icon green">
              <Users size={17} />
            </span>
            <span>
              <strong>User workspaces</strong>
              <small>Access and activity overview</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        </section>
      </div>
    </>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ops-page-heading">
      <div>
        <p className="ops-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmployeesPanel() {
  const { employees, saveEmployee, toggleEmployee } = useAdminStore();
  const [editor, setEditor] = useState<AIEmployee | "new" | null>(null);

  return (
    <>
      <PageHeading
        eyebrow="MARKETPLACE"
        title="AI employee catalog"
        description="Manage specialist profiles and model behavior in this local preview."
        action={
          <button
            type="button"
            className="ops-primary-button ops-heading-button"
            onClick={() => setEditor("new")}
          >
            <Plus size={16} /> Add employee
          </button>
        }
      />
      <section className="ops-panel">
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>CATEGORY</th>
                <th>MODEL</th>
                <th>TEMPERATURE</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="ops-employee-name">
                      <span className="ops-employee-avatar">{employee.name.slice(0, 1)}</span>
                      <span>
                        <strong>{employee.name}</strong>
                        <small>{employee.role}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="ops-category-pill">{categoryLabels[employee.category]}</span>
                  </td>
                  <td className="ops-mono">{employee.model}</td>
                  <td className="ops-mono">{employee.temperature.toFixed(1)}</td>
                  <td>
                    <span className={`ops-status ${employee.isActive ? "is-active" : "is-paused"}`}>
                      <span />
                      {employee.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td>
                    <div className="ops-row-actions">
                      <button
                        type="button"
                        className="ops-small-button"
                        onClick={() => setEditor(employee)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`ops-small-button ${employee.isActive ? "is-warning" : ""}`}
                        onClick={() => toggleEmployee(employee.id)}
                      >
                        {employee.isActive ? "Pause" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editor && (
        <EmployeeEditor
          {...(editor === "new" ? {} : { employee: editor })}
          onClose={() => setEditor(null)}
          onSave={(draft) => {
            saveEmployee(draft);
            setEditor(null);
          }}
        />
      )}
    </>
  );
}

function EmployeeEditor({
  employee,
  onClose,
  onSave,
}: {
  employee?: AIEmployee;
  onClose: () => void;
  onSave: (draft: EmployeeDraft) => void;
}) {
  const [draft, setDraft] = useState<EmployeeDraft>(() =>
    employee
      ? {
          id: employee.id,
          name: employee.name,
          category: employee.category,
          role: employee.role,
          description: employee.description,
          model: employee.model,
          temperature: employee.temperature,
          systemPrompt: employee.systemPrompt,
          isActive: employee.isActive,
        }
      : {
          name: "",
          category: "sales",
          role: "",
          description: "",
          model: "gemini-2.5-flash",
          temperature: 0.7,
          systemPrompt: "",
          isActive: true,
        },
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draft);
  }

  return (
    <div
      className="ops-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="ops-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ops-editor-title"
      >
        <header>
          <div>
            <p className="ops-eyebrow">{employee ? "EDIT PROFILE" : "NEW SPECIALIST"}</p>
            <h2 id="ops-editor-title">
              {employee ? `Edit ${employee.name}` : "Create AI employee"}
            </h2>
          </div>
          <button
            type="button"
            className="ops-icon-button"
            onClick={onClose}
            aria-label="Close editor"
          >
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="ops-form-grid">
            <label>
              Name
              <input
                required
                maxLength={40}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value.toUpperCase() })}
                placeholder="e.g. NOVA"
              />
            </label>
            <label>
              Role
              <input
                required
                maxLength={80}
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                placeholder="AI Sales Rep"
              />
            </label>
            <label>
              Category
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft({ ...draft, category: event.target.value as EmployeeCategory })
                }
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gemini model
              <input
                required
                value={draft.model}
                onChange={(event) => setDraft({ ...draft, model: event.target.value })}
              />
            </label>
            <label>
              Temperature <span className="ops-inline-value">{draft.temperature.toFixed(1)}</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={draft.temperature}
                onChange={(event) =>
                  setDraft({ ...draft, temperature: Number(event.target.value) })
                }
              />
            </label>
            <label className="ops-form-wide">
              Description
              <textarea
                required
                rows={2}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </label>
            <label className="ops-form-wide">
              System prompt
              <textarea
                required
                rows={5}
                value={draft.systemPrompt}
                onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
              />
            </label>
          </div>
          <footer>
            <button type="button" className="ops-secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ops-primary-button">
              <Check size={16} /> Save profile
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function CallsPanel() {
  const { calls, updateCall } = useAdminStore();
  const [filter, setFilter] = useState<DiscoveryCallStatus | "all">("all");
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const filteredCalls = calls.filter((call) => filter === "all" || call.status === filter);

  return (
    <>
      <PageHeading
        eyebrow="CUSTOMER PIPELINE"
        title="Discovery calls"
        description="Track requests, update call status, and keep internal notes."
      />
      <section className="ops-panel">
        <div className="ops-panel-toolbar">
          <div>
            <p className="ops-eyebrow">REQUESTS</p>
            <h2>{filteredCalls.length} calls</h2>
          </div>
          <label className="ops-filter-select">
            <span>Status</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as DiscoveryCallStatus | "all")}
            >
              <option value="all">All statuses</option>
              {callStatuses.map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <div className="ops-call-list">
          {filteredCalls.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              draft={notesDrafts[call.id] ?? call.notes}
              onStatusChange={(status) => updateCall(call.id, { status })}
              onDraftChange={(notes) =>
                setNotesDrafts((current) => ({ ...current, [call.id]: notes }))
              }
              onSaveNotes={() => updateCall(call.id, { notes: notesDrafts[call.id] ?? call.notes })}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function CallCard({
  call,
  draft,
  onStatusChange,
  onDraftChange,
  onSaveNotes,
}: {
  call: DiscoveryCall;
  draft: string;
  onStatusChange: (status: DiscoveryCallStatus) => void;
  onDraftChange: (notes: string) => void;
  onSaveNotes: () => void;
}) {
  return (
    <article className="ops-call-card">
      <div className="ops-call-main">
        <div className="ops-call-avatar">
          {call.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="ops-call-info">
          <strong>{call.name}</strong>
          <span>
            {call.email} · {call.company}
          </span>
          <small>Looking for: {call.requestedRole}</small>
        </div>
        <div className="ops-call-date">
          <Clock3 size={14} />
          {formatDate(call.scheduledAt)}
        </div>
        <label className={`ops-call-status status-${call.status}`}>
          <select
            value={call.status}
            onChange={(event) => onStatusChange(event.target.value as DiscoveryCallStatus)}
            aria-label={`Update status for ${call.name}`}
          >
            {callStatuses.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
      </div>
      <div className="ops-call-notes">
        <FileText size={14} />
        <textarea
          aria-label={`Internal notes for ${call.name}`}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Add internal notes..."
        />
        <button
          type="button"
          className="ops-small-button"
          disabled={draft === call.notes}
          onClick={onSaveNotes}
        >
          Save note
        </button>
      </div>
    </article>
  );
}

function UsersPanel() {
  const { users, toggleUserAccess } = useAdminStore();
  const [search, setSearch] = useState("");
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter(
      (user) => !query || `${user.name} ${user.email}`.toLowerCase().includes(query),
    );
  }, [users, search]);

  return (
    <>
      <PageHeading
        eyebrow="ACCOUNTS"
        title="Users & workspaces"
        description="Search mock accounts and simulate workspace access changes."
      />
      <section className="ops-panel">
        <div className="ops-panel-toolbar">
          <div>
            <p className="ops-eyebrow">DIRECTORY</p>
            <h2>{filteredUsers.length} users</h2>
          </div>
          <label className="ops-search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users..."
            />
          </label>
        </div>
        <div className="ops-table-wrap">
          <table className="ops-table ops-user-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>HIRED SPECIALISTS</th>
                <th>MESSAGES</th>
                <th>STORAGE</th>
                <th>WORKSPACE</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <UserRow key={user.id} user={user} onToggle={() => toggleUserAccess(user.id)} />
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td className="ops-empty-cell" colSpan={6}>
                    No users match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function UserRow({ user, onToggle }: { user: WorkspaceUser; onToggle: () => void }) {
  return (
    <tr>
      <td>
        <div className="ops-user-name">
          <span className="ops-user-avatar">
            {user.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
        </div>
      </td>
      <td>
        <div className="ops-hired-list">
          {user.hiredEmployees.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </td>
      <td className="ops-number-cell">{formatNumber(user.messageCount)}</td>
      <td className="ops-number-cell">{formatBytes(user.storageBytes)}</td>
      <td>
        <span className={`ops-status ${user.hasAccess ? "is-active" : "is-paused"}`}>
          <span />
          {user.hasAccess ? "Enabled" : "Paused"}
        </span>
      </td>
      <td>
        <button
          type="button"
          className={`ops-small-button ${user.hasAccess ? "is-warning" : ""}`}
          onClick={onToggle}
        >
          {user.hasAccess ? "Revoke" : "Grant"} access
        </button>
      </td>
    </tr>
  );
}

function MonitoringPanel() {
  const { usage, storage, cleanupArchivedFiles } = useAdminStore();
  const [cleanupMessage, setCleanupMessage] = useState("");
  const tokensTotal = usage.reduce((sum, item) => sum + item.tokensIn + item.tokensOut, 0);
  const maxTokens = Math.max(...usage.map((item) => item.tokensIn + item.tokensOut));
  const storageTotal = storage.activeBytes + storage.archivedBytes;

  function confirmCleanup() {
    if (!storage.archivedFiles) return;
    if (
      !window.confirm(
        `Purge ${storage.archivedFiles} mock archived files (${formatBytes(storage.archivedBytes)})?`,
      )
    )
      return;
    cleanupArchivedFiles();
    setCleanupMessage("Mock archived storage has been cleared.");
  }

  return (
    <>
      <PageHeading
        eyebrow="SYSTEM HEALTH"
        title="Usage & storage"
        description="Review mock Gemini usage and CEO Inbox storage estimates."
      />
      <section className="ops-panel ops-usage-panel">
        <div className="ops-panel-heading">
          <div>
            <p className="ops-eyebrow">GEMINI · LAST 24 HOURS</p>
            <h2>{(tokensTotal / 1_000_000).toFixed(2)}M tokens</h2>
          </div>
          <span className="ops-subtle-pill">
            <ArrowDownRight size={14} /> Mock totals
          </span>
        </div>
        <div className="ops-usage-list">
          {usage.map((item) => {
            const total = item.tokensIn + item.tokensOut;
            const ratio = maxTokens ? Math.round((total / maxTokens) * 100) : 0;
            return (
              <div className="ops-usage-row" key={item.category}>
                <div className="ops-usage-label">
                  <strong>{categoryLabels[item.category]}</strong>
                  <span>{formatNumber(item.requests)} requests</span>
                </div>
                <div className="ops-progress-track">
                  <span style={{ width: `${ratio}%` }} />
                </div>
                <div className="ops-usage-tokens">
                  {formatNumber(total)} <small>tokens</small>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="ops-panel ops-storage-panel">
        <div className="ops-panel-heading">
          <div>
            <p className="ops-eyebrow">CEO INBOX</p>
            <h2>Storage overview</h2>
          </div>
          <span className="ops-subtle-pill">
            <Database size={14} /> {formatBytes(storageTotal)} total
          </span>
        </div>
        <div className="ops-storage-grid">
          <StorageTile
            label="Active files"
            value={formatBytes(storage.activeBytes)}
            icon={FileText}
            detail="Available in the inbox"
          />
          <StorageTile
            label="Archived files"
            value={formatBytes(storage.archivedBytes)}
            icon={Archive}
            detail={`${formatNumber(storage.archivedFiles)} files`}
          />
        </div>
        <div className="ops-storage-bar">
          <span
            style={{ width: `${storageTotal ? (storage.activeBytes / storageTotal) * 100 : 0}%` }}
          />
        </div>
        <div className="ops-storage-legend">
          <span>
            <i className="is-active" /> Active
          </span>
          <span>
            <i className="is-archived" /> Archived
          </span>
        </div>
        <div className="ops-cleanup-row">
          <div>
            <strong>Clean up archived files</strong>
            <span>Simulation only. It will not delete real files.</span>
            {cleanupMessage && <em role="status">{cleanupMessage}</em>}
          </div>
          <button
            type="button"
            className="ops-danger-button"
            disabled={!storage.archivedFiles}
            onClick={confirmCleanup}
          >
            <Trash2 size={15} /> Purge mock archive
          </button>
        </div>
      </section>
    </>
  );
}

function StorageTile({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string;
  icon: IconType;
  detail: string;
}) {
  return (
    <article className="ops-storage-tile">
      <span className="ops-storage-icon">
        <Icon size={17} />
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

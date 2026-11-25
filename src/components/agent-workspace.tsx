import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { supabase } from "../services/supabase";
import "../agent-workspace.css";

type Employee = {
  id: string;
  employee_name: string;
  employee_role: string;
  status: "active" | "paused" | "setup";
};

type Conversation = {
  id: string;
  title: string;
  primary_employee_id: string | null;
  updated_at: string;
};

type Message = {
  id: string;
  sender: "client" | "agent" | "system";
  content: string;
  created_at: string;
};

export function AgentWorkspace({ userId }: { userId: string }) {
  const [agents, setAgents] = useState<Employee[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Employee[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [showAgentList, setShowAgentList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const [employeeResult, conversationResult] = await Promise.all([
        supabase
          .from("client_employees")
          .select("id, employee_name, employee_role, status")
          .eq("client_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("conversations")
          .select("id, title, primary_employee_id, updated_at")
          .eq("client_id", userId)
          .order("updated_at", { ascending: false }),
      ]);

      if (!active) return;

      if (employeeResult.error) {
        setError(employeeResult.error.message);
        setLoading(false);
        return;
      }
      if (conversationResult.error) {
        setError(conversationResult.error.message);
        setLoading(false);
        return;
      }

      const employeeRows = employeeResult.data as Employee[];
      setAgents(employeeRows);
      setSelectedAgents(employeeRows.slice(0, 1));
      setConversations(conversationResult.data as Conversation[]);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function openConversation(conversation: Conversation) {
    setLoading(true);
    setError("");
    setShowAgentList(false);

    const [linkResult, messageResult] = await Promise.all([
      supabase
        .from("conversation_employees")
        .select("employee_id")
        .eq("conversation_id", conversation.id),
      supabase
        .from("conversation_messages")
        .select("id, sender, content, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true }),
    ]);

    if (linkResult.error) setError(linkResult.error.message);
    if (messageResult.error) setError(messageResult.error.message);

    const ids = (linkResult.data ?? []).map((row) => row.employee_id);
    setSelectedAgents(agents.filter((agent) => ids.includes(agent.id)));
    setMessages((messageResult.data as Message[]) ?? []);
    setConversationId(conversation.id);
    setLoading(false);
  }

  async function syncConversationAgents(ids: string[]) {
    if (!conversationId) return;

    const primaryId = ids[0] ?? null;
    const { error: deleteError } = await supabase
      .from("conversation_employees")
      .delete()
      .eq("conversation_id", conversationId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (ids.length > 0) {
      const { error: insertError } = await supabase
        .from("conversation_employees")
        .insert(ids.map((employeeId) => ({
          conversation_id: conversationId,
          employee_id: employeeId,
        })));
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    await supabase
      .from("conversations")
      .update({ primary_employee_id: primaryId })
      .eq("id", conversationId);
  }

  function toggleAgent(agent: Employee) {
    const exists = selectedAgents.some((item) => item.id === agent.id);
    const next = exists
      ? selectedAgents.filter((item) => item.id !== agent.id)
      : [...selectedAgents, agent];

    setSelectedAgents(next);
    void syncConversationAgents(next.map((item) => item.id));
  }

  async function createConversation() {
    setConversationId(null);
    setMessages([]);
    setMessage("");
    setError("");
    setShowAgentList(false);

    if (agents.length > 0) setSelectedAgents(agents.slice(0, 1));
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!content || sending) return;

    if (selectedAgents.length === 0) {
      setError("Choose an assigned AI employee to start.");
      return;
    }

    setSending(true);
    setError("");
    setMessage("");

    let activeConversationId = conversationId;

    if (!activeConversationId) {
      const primary = selectedAgents[0];
      if (!primary) {
        setError("Choose an assigned AI employee to start.");
        setMessage(content);
        setSending(false);
        return;
      }
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({
          client_id: userId,
          title: selectedAgents.length === 1
            ? primary.employee_name
            : `${selectedAgents.length} AI Employees`,
          primary_employee_id: primary.id,
        })
        .select("id, title, primary_employee_id, updated_at")
        .single();

      if (conversationError) {
        setError(conversationError.message);
        setMessage(content);
        setSending(false);
        return;
      }

      const { error: linksError } = await supabase
        .from("conversation_employees")
        .insert(selectedAgents.map((agent) => ({
          conversation_id: conversation.id,
          employee_id: agent.id,
        })));

      if (linksError) {
        setError(linksError.message);
        setMessage(content);
        setSending(false);
        return;
      }

      activeConversationId = conversation.id;
      setConversationId(conversation.id);
      setConversations((current) => [conversation as Conversation, ...current]);
    }

    const { data: savedMessage, error: messageError } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: activeConversationId,
        sender: "client",
        employee_id: null,
        content,
      })
      .select("id, sender, content, created_at")
      .single();

    if (messageError) {
      setError(messageError.message);
      setMessage(content);
    } else {
      setMessages((current) => [...current, savedMessage as Message]);
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeConversationId);
    }

    setSending(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const primaryAgent = selectedAgents[0];

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">KINETIK<span>.</span></div>
          <button className="new-chat" type="button" onClick={() => void createConversation()}>
            + New chat
          </button>
        </div>

        <div className="sidebar-section">
          <p className="section-label">YOUR CONVERSATIONS</p>
          {conversations.length === 0 ? (
            <div className="empty-sidebar">
              <div className="empty-icon">☰</div>
              <p>No messages yet</p>
              <span>Your conversations will appear here.</span>
            </div>
          ) : (
            conversations.map((chat) => (
              <button
                className={`conversation-item ${conversationId === chat.id ? "selected" : ""}`}
                key={chat.id}
                type="button"
                onClick={() => void openConversation(chat)}
              >
                {chat.title}
              </button>
            ))
          )}
        </div>

        <div className="sidebar-section employees-section">
          <p className="section-label">YOUR AI EMPLOYEES</p>
          {agents.map((agent) => (
            <button
              className="employee-item"
              key={agent.id}
              type="button"
              onClick={() => toggleAgent(agent)}
            >
              <div className="employee-avatar">{agent.employee_name.charAt(0)}</div>
              <div className="employee-info">
                <strong>{agent.employee_name}</strong>
                <span>{agent.employee_role}</span>
              </div>
              <span className={`online-dot ${agent.status}`} />
            </button>
          ))}
          {!loading && agents.length === 0 && (
            <p className="no-assigned-agents">No AI employees assigned yet.</p>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="profile-avatar">U</div>
          <div>
            <strong>Your Workspace</strong>
            <span>Client account</span>
          </div>
        </div>
      </aside>

      <main className="chat-area">
        <header className="topbar">
          <div>
            <span className="workspace-label">WORKSPACE</span>
            <h2>AI Employee Workspace</h2>
          </div>
          <div className="status">
            <span className="online-dot" /> Workspace active
          </div>
        </header>

        <section className="chat-content">
          <div className="agent-profile">
            <div className="passport-photo"><span>PHOTO</span></div>
            <h2>
              {selectedAgents.length === 1
                ? selectedAgents[0]?.employee_name ?? "AI Employee"
                : `${selectedAgents.length} Agents Selected`}
            </h2>
            <p>
              {selectedAgents.length === 1
                ? selectedAgents[0]?.employee_role ?? "AI employee"
                : "Your AI team is selected"}
            </p>
            <span className="working-status">
              <span className="online-dot" /> Ready to work
            </span>
          </div>

          <div className="agent-selector">
            <span className="selector-label">WORKING WITH</span>
            <div className="agent-tags">
              {selectedAgents.map((agent) => (
                <div className="agent-tag" key={agent.id}>
                  {agent.employee_name}
                  <button type="button" onClick={() => toggleAgent(agent)}>×</button>
                </div>
              ))}

              <div className="add-agent-wrapper">
                <button
                  className="add-agent"
                  type="button"
                  onClick={() => setShowAgentList((current) => !current)}
                >
                  + Add agent
                </button>

                {showAgentList && (
                  <div className="agent-dropdown">
                    {agents.map((agent) => (
                      <button type="button" key={agent.id} onClick={() => toggleAgent(agent)}>
                        <span>
                          <strong>{agent.employee_name}</strong>
                          <small>{agent.employee_role}</small>
                        </span>
                        {selectedAgents.some((item) => item.id === agent.id) && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="messages-area">
            {messages.length === 0 ? (
              <div className="welcome-message">
                <div className="welcome-icon">✦</div>
                <h2>What can I help you with?</h2>
                <p>
                  {primaryAgent
                    ? `Send a message to ${primaryAgent.employee_name} and your selected AI team.`
                    : "Send a message to your AI employee team to get started."}
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div className="message-row" key={msg.id}>
                  <div className="user-message">{msg.content}</div>
                </div>
              ))
            )}
            {sending && (
              <div className="message-row">
                <div className="user-message">Saving message...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && <p className="workspace-chat-error" role="alert">{error}</p>}

          <form className="chat-input-container" onSubmit={(event) => void sendMessage(event)}>
            <textarea
              placeholder="Message your AI employee..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              type="submit"
              className="send-button"
              disabled={!message.trim() || sending || loading}
            >
              ↑
            </button>
          </form>
          <p className="input-disclaimer">
            AI employees can make mistakes. Review important work.
          </p>
        </section>
      </main>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { checkMeetingAccess, getMarketplaceEmployees } from "../lib/meeting.functions";
import "../agent-workspace-page.css";

export const Route = createFileRoute("/agent-workspace")({
  validateSearch: (search: Record<string, unknown>) => ({
    demo: search["demo"] === true || search["demo"] === "true",
  }),
  component: AgentWorkspacePage,
});

type Agent = { id: string; name: string; role: string };
type ChatMessage = { text: string; sender: "you" | "agent" };
type TaskState = "Working" | "Ready" | "Approved" | "Failed";
type ReviewTask = {
  id: string;
  text: string;
  agent: Agent;
  state: TaskState;
};
const demoAgents: Agent[] = [
  { id: "lexi", name: "LEXI", role: "Project Manager" },
  { id: "atlas", name: "ATLAS", role: "Customer support specialist" },
  { id: "echo", name: "ECHO", role: "Social media specialist" },
  { id: "ledger", name: "LEDGER", role: "Bookkeeping specialist" },
  { id: "scout", name: "SCOUT", role: "Recruiting specialist" },
  { id: "quill", name: "QUILL", role: "Content writing specialist" },
  { id: "pulse", name: "PULSE", role: "Data analytics specialist" },
];

function AgentWorkspacePage() {
  const navigate = useNavigate();
  const { demo } = Route.useSearch();
  const [unlocked, setUnlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [meetingAccess, setMeetingAccess] = useState<{ callId: string; accessCode: string } | null>(
    null,
  );
  const [accessError, setAccessError] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [showAgentList, setShowAgentList] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [phoneTab, setPhoneTab] = useState<"chat" | "review">("chat");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const phoneMessagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    phoneMessagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phoneTab]);

  useEffect(() => {
    if (demo) {
      setAgents(demoAgents);
      setSelectedAgents(demoAgents[0] ? [demoAgents[0]] : []);
      setAgentsLoading(false);
      return;
    }

    let active = true;
    getMarketplaceEmployees()
      .then((employees) => {
        if (!active) return;
        const marketplaceAgents = employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          role: employee.description,
        }));
        setAgents(marketplaceAgents);
        setSelectedAgents(marketplaceAgents[0] ? [marketplaceAgents[0]] : []);
      })
      .catch((error: unknown) => {
        if (active) {
          setAgentsError(
            error instanceof Error ? error.message : "AI employees could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setAgentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo]);

  useEffect(() => {
    if (demo) {
      setMeetingAccess(null);
      setAccessError("");
      setUnlocked(true);
      setCheckingAccess(false);
      return;
    }

    let active = true;
    const storedAccess = window.sessionStorage.getItem("kinetik-meeting-access");
    if (!storedAccess) {
      setCheckingAccess(false);
      return;
    }

    let access: { callId: string; accessCode: string };
    try {
      const parsed: unknown = JSON.parse(storedAccess);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("callId" in parsed) ||
        typeof parsed.callId !== "string" ||
        !("accessCode" in parsed) ||
        typeof parsed.accessCode !== "string"
      ) {
        throw new Error("Stored meeting access is invalid.");
      }
      access = { callId: parsed.callId, accessCode: parsed.accessCode };
    } catch {
      window.sessionStorage.removeItem("kinetik-meeting-access");
      setCheckingAccess(false);
      return;
    }

    checkMeetingAccess({ data: access })
      .then((result) => {
        if (!active) return;
        if (result.isValid && result.secondsUntilReady === 0) {
          setMeetingAccess(access);
          setUnlocked(true);
        } else {
          window.sessionStorage.removeItem("kinetik-meeting-access");
          setAccessError("This meeting code is invalid or the workspace is not ready yet.");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAccessError(
            error instanceof Error ? error.message : "Meeting access could not be verified.",
          );
        }
      })
      .finally(() => {
        if (active) setCheckingAccess(false);
      });

    return () => {
      active = false;
    };
  }, [demo]);

  function toggleAgent(agent: Agent) {
    setSelectedAgents((current) =>
      current.some((item) => item.id === agent.id)
        ? current.filter((item) => item.id !== agent.id)
        : [...current, agent],
    );
  }

  function updateTask(id: string, state: TaskState) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, state } : task)));
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    if (!selectedAgents[0]) {
      setChatError(agentsError || "Select an active AI employee before sending a message.");
      return;
    }

    const text = message.trim();
    const taskId = crypto.randomUUID();
    const taskAgent = selectedAgents[0];
    setTasks((current) => [{ id: taskId, text, agent: taskAgent, state: "Working" }, ...current]);

    setMessages((current) => [...current, { text, sender: "you" }]);
    setMessage("");
    setSending(true);
    setChatError("");

    try {
      const primaryAgent = selectedAgents[0];
      const history = messages.map((item) => ({
        role: item.sender === "agent" ? ("assistant" as const) : ("user" as const),
        content: item.text,
      }));
      const endpoint = demo ? "https://singularity-1-pusr.onrender.com/api/agent" : "/api/chat";
      const payload = demo
        ? {
            task: text,
            agentName: primaryAgent.name,
            agentRole: primaryAgent.role,
            previousResults: history,
          }
        : {
            message: text,
            callId: meetingAccess?.callId,
            accessCode: meetingAccess?.accessCode,
            agent: {
              name: primaryAgent.name,
              role:
                selectedAgents.length > 1
                  ? `${primaryAgent.role}; coordinate with ${selectedAgents
                      .slice(1)
                      .map((agent) => agent.name)
                      .join(", ")}`
                  : primaryAgent.role,
            },
            history,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { reply?: unknown; error?: unknown };
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Gemini could not respond.",
        );
      }
      if (typeof result.reply !== "string" || !result.reply.trim()) {
        throw new Error("Gemini returned an empty response.");
      }

      setMessages((current) => [...current, { text: result.reply as string, sender: "agent" }]);
      updateTask(taskId, "Ready");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to send message.");
      updateTask(taskId, "Failed");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function startNewChat() {
    setMessages([]);
    setSelectedAgents(agents[0] ? [agents[0]] : []);
    setShowAgentList(false);
    setChatError("");
  }

  if (!unlocked) {
    return (
      <main className="agent-page-locked">
        <div>
          <span>KINETIK</span>
          <h1>{checkingAccess ? "Verifying access" : "Workspace locked"}</h1>
          <p>
            {checkingAccess
              ? "Checking your private meeting code…"
              : accessError ||
                "Enter the private code from your meeting confirmation page to continue."}
          </p>
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: "/get-agent",
                search: { callId: meetingAccess?.callId ?? "", demo: false },
                replace: true,
              })
            }
          >
            {checkingAccess ? "Please wait" : "Back to confirmation"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="phone-stage">
        <div className="phone-blob phone-blob-one" />
        <div className="phone-blob phone-blob-two" />
        <div className="phone-blob phone-blob-three" />

        <main className="phone-frame">
          {phoneTab === "chat" ? (
            <>
              <header className="phone-head">
                <h1>{selectedAgents[0]?.name ?? "AI Employee"}</h1>
                <p>{selectedAgents[0]?.role ?? "Choose an AI employee"}</p>
                <div
                  className="phone-agent-chips"
                  role="listbox"
                  aria-label="Choose an AI employee"
                >
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      role="option"
                      aria-selected={agent.id === selectedAgents[0]?.id}
                      className={
                        agent.id === selectedAgents[0]?.id ? "phone-chip selected" : "phone-chip"
                      }
                      onClick={() => setSelectedAgents([agent])}
                    >
                      {agent.name}
                    </button>
                  ))}
                  {agentsLoading && <span className="phone-loading">Loading agents…</span>}
                  {agentsError && (
                    <span className="phone-error" role="alert">
                      {agentsError}
                    </span>
                  )}
                </div>
              </header>

              <div className="phone-scroll">
                {messages.length === 0 ? (
                  <div className="phone-empty">
                    <h2>Assign a task</h2>
                    <p>
                      Describe the work. {selectedAgents[0]?.name ?? "Your AI employee"} will send
                      it to Review when it’s done.
                    </p>
                  </div>
                ) : (
                  messages.map((item, index) => (
                    <div
                      key={`${index}-${item.sender}`}
                      className={`phone-bubble ${item.sender === "you" ? "you" : "agent"}`}
                    >
                      {item.text}
                    </div>
                  ))
                )}
                {sending && <div className="phone-bubble agent">Working on it…</div>}
                <div ref={phoneMessagesEnd} />
              </div>

              {chatError && (
                <p className="phone-chat-error" role="alert">
                  {chatError}
                </p>
              )}
              <form className="phone-compose" onSubmit={sendMessage}>
                <input
                  value={message}
                  placeholder={`Message ${selectedAgents[0]?.name ?? "AI employee"}`}
                  onChange={(event) => setMessage(event.target.value)}
                  aria-label="Describe a task"
                />
                <button
                  type="submit"
                  disabled={!message.trim() || sending || !selectedAgents[0]}
                  aria-label="Assign task"
                >
                  ↑
                </button>
              </form>
            </>
          ) : (
            <>
              <header className="phone-head">
                <h1>Review</h1>
                <p>
                  {tasks.some((task) => task.state === "Ready")
                    ? `${tasks.filter((task) => task.state === "Ready").length} waiting for you`
                    : "Finished work appears here"}
                </p>
              </header>

              <div className="phone-scroll phone-review-list">
                {tasks.length === 0 ? (
                  <div className="phone-empty">
                    <h2>No review yet</h2>
                    <p>Assign a task to review its work.</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <article className="phone-task-card" key={task.id}>
                      <div className="phone-task-row">
                        <span className="phone-avatar">{task.agent.name[0]}</span>
                        <div className="phone-task-copy">
                          <strong>{task.agent.name}</strong>
                          <span>{task.text}</span>
                        </div>
                        <span
                          className={`phone-status ${task.state.toLowerCase().replace(" ", "-")}`}
                        >
                          {task.state}
                        </span>
                      </div>
                      {task.state === "Ready" && (
                        <div className="phone-task-actions">
                          <button
                            className="phone-approve"
                            type="button"
                            onClick={() => updateTask(task.id, "Approved")}
                          >
                            Approve
                          </button>
                          <button type="button" onClick={() => updateTask(task.id, "Working")}>
                            Request changes
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </>
          )}

          <nav className="phone-tabs" aria-label="Workspace sections">
            <button
              type="button"
              className={phoneTab === "chat" ? "selected" : ""}
              onClick={() => setPhoneTab("chat")}
            >
              Assign Task
            </button>
            <button
              type="button"
              className={phoneTab === "review" ? "selected" : ""}
              onClick={() => setPhoneTab("review")}
            >
              Review
              {tasks.some((task) => task.state === "Ready") && <i className="phone-review-dot" />}
            </button>
          </nav>
        </main>
      </div>

      <div className="agent-page-workspace">
        <aside className="agent-page-sidebar">
          <div className="agent-page-sidebar-header">
            <div className="agent-page-brand">{demo ? "REVIEW" : "MESSAGING"}</div>
            <div className="agent-page-messaging-actions">
              <button
                type="button"
                aria-label={demo ? "Assign new task" : "New conversation"}
                onClick={startNewChat}
              >
                ✎
              </button>
              <button type="button" aria-label={demo ? "Review options" : "Messaging options"}>
                •••
              </button>
            </div>
          </div>

          <div className="agent-page-sidebar-section">
            <div className="agent-page-empty-sidebar">
              {demo ? (
                <>
                  <p>No review yet</p>
                  <span>Assign a task to an AI employee to review its work.</span>
                </>
              ) : (
                <>
                  <p>No messages yet</p>
                  <span>Start a conversation with an AI employee.</span>
                </>
              )}
            </div>
          </div>

          <div className="agent-page-footer">
            <div className="agent-page-profile-avatar">U</div>
            <div>
              <strong>Your Workspace</strong>
              <span>{demo ? "Demo account" : "Client account"}</span>
            </div>
          </div>
        </aside>

        <main className="agent-page-chat">
          <header className="agent-page-topbar">
            <div>
              <span className="agent-page-label">{demo ? "DEMO TASK WORKSPACE" : "WORKSPACE"}</span>
              <h2>{demo ? "Assign Tasks & Review Work · Demo" : "AI Employee Workspace"}</h2>
            </div>
            <div className="agent-page-status">
              <span className="agent-page-online" /> {demo ? "Demo workspace" : "Workspace active"}
            </div>
          </header>

          <section className="agent-page-content">
            <div className="agent-page-profile">
              <div className="agent-page-passport">PHOTO</div>
              <h2>
                {selectedAgents.length === 1
                  ? selectedAgents[0]?.name
                  : `${selectedAgents.length} Agents Selected`}
              </h2>
              <p>
                {selectedAgents.length === 1 ? selectedAgents[0]?.role : "Your AI team is selected"}
              </p>
              <span className="agent-page-working">
                <span className="agent-page-online" />{" "}
                {demo ? "Gemini task agent" : "Ready to work"}
              </span>
            </div>

            <div className="agent-page-selector">
              <span className="agent-page-selector-label">WORKING WITH</span>
              <div className="agent-page-tags">
                {selectedAgents.map((agent) => (
                  <div className="agent-page-tag" key={agent.id}>
                    {agent.name}
                    <button type="button" onClick={() => toggleAgent(agent)}>
                      ×
                    </button>
                  </div>
                ))}

                <div className="agent-page-add-wrap">
                  <button
                    className="agent-page-add"
                    type="button"
                    onClick={() => setShowAgentList((current) => !current)}
                  >
                    + Add agent
                  </button>
                  {showAgentList && (
                    <div className="agent-page-dropdown">
                      {agents.map((agent) => (
                        <button type="button" key={agent.id} onClick={() => toggleAgent(agent)}>
                          <span>{agent.name}</span>
                          {selectedAgents.some((item) => item.id === agent.id) && <span>✓</span>}
                        </button>
                      ))}
                      {agentsLoading && <span>Loading AI employees…</span>}
                      {agentsError && <span role="alert">{agentsError}</span>}
                      {!agentsLoading && !agentsError && agents.length === 0 && (
                        <span>No AI employees are available.</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="agent-page-messages">
              {messages.length === 0 ? (
                <div className="agent-page-welcome">
                  <div className="agent-page-welcome-icon">✦</div>
                  <h2>{demo ? "Assign a task for review" : "What can I help you with?"}</h2>
                  <p>
                    {demo
                      ? "Describe the work you want an AI employee to complete."
                      : "Send a message to your AI employee team to get started."}
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    className={`agent-page-message-row ${msg.sender === "agent" ? "agent" : "client"}`}
                    key={index}
                  >
                    {msg.sender === "agent" && (
                      <span className="agent-page-message-avatar">
                        {selectedAgents[0]?.name.charAt(0) ?? "A"}
                      </span>
                    )}
                    <div className="agent-page-user-message">{msg.text}</div>
                  </div>
                ))
              )}
              {sending && (
                <div className="agent-page-message-row agent">
                  <span className="agent-page-message-avatar">
                    {selectedAgents[0]?.name.charAt(0) ?? "A"}
                  </span>
                  <div className="agent-page-thinking">Thinking...</div>
                </div>
              )}
            </div>

            {chatError && <p className="agent-page-chat-error">{chatError}</p>}

            <form className="agent-page-input" onSubmit={sendMessage}>
              <textarea
                placeholder={demo ? "Describe a task to assign..." : "Message your AI employee..."}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button type="submit" disabled={!message.trim() || sending || !selectedAgents[0]}>
                ↑
              </button>
            </form>
            <p className="agent-page-disclaimer">
              {demo
                ? "Gemini demo mode. Do not submit sensitive or confidential information."
                : "AI employees can make mistakes. Review important work."}
            </p>
          </section>
        </main>
      </div>
    </>
  );
}

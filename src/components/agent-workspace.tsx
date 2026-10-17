import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Check, LoaderCircle, Plus, Send, Sparkles, UserRound } from "lucide-react";

const AGENTS = [
  {
    name: "Senior Operations Executive",
    focus: "Operations and execution",
  },
  {
    name: "Marketing Manager",
    focus: "Marketing and growth",
  },
  {
    name: "Business Analyst",
    focus: "Analysis and insights",
  },
  {
    name: "Category Manager",
    focus: "Category performance",
  },
  {
    name: "Inventory Manager",
    focus: "Stock and replenishment",
  },
  {
    name: "Warehouse Inventory Manager",
    focus: "Warehouse operations",
  },
  {
    name: "Product and Project Manager",
    focus: "Product and delivery",
  },
] as const;

type AgentName = (typeof AGENTS)[number]["name"];
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
type AgentThreads = Partial<Record<AgentName, ChatMessage[]>>;
const EMPTY_MESSAGES: ChatMessage[] = [];

export function AgentWorkspace() {
  const [selectedAgent, setSelectedAgent] = useState<AgentName>(AGENTS[0].name);
  const [threads, setThreads] = useState<AgentThreads>({});
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = threads[selectedAgent] ?? EMPTY_MESSAGES;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  function selectAgent(agent: AgentName) {
    if (streaming) return;
    setSelectedAgent(agent);
    setError("");
  }

  function clearConversation() {
    if (streaming) return;
    setThreads((current) => ({ ...current, [selectedAgent]: [] }));
    setError("");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || streaming) return;

    const agent = selectedAgent;
    const history = threads[agent] ?? [];
    setDraft("");
    setError("");
    setStreaming(true);
    setThreads((current) => ({
      ...current,
      [agent]: [
        ...(current[agent] ?? []),
        { role: "user", content: prompt },
        { role: "assistant", content: "" },
      ],
    }));

    try {
      const selectedAgent = AGENTS.find((item) => item.name === agent);
      if (!selectedAgent) {
        throw new Error("The selected agent could not be found.");
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          agent: { name: selectedAgent.name, role: selectedAgent.focus },
          history,
        }),
      });
      const result = (await response.json()) as { reply?: unknown; error?: unknown };

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "The assistant could not respond. Please try again.",
        );
      }
      const reply = result.reply;
      if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("The assistant returned an empty response. Please try again.");
      }

      setThreads((current) => {
        const thread = [...(current[agent] ?? [])];
        if (thread.at(-1)?.role === "assistant") {
          thread[thread.length - 1] = { role: "assistant", content: reply };
        }
        return { ...current, [agent]: thread };
      });
    } catch (sendError) {
      setThreads((current) => {
        const thread = [...(current[agent] ?? [])];
        if (thread.at(-1)?.role === "assistant" && !thread.at(-1)?.content) thread.pop();
        return { ...current, [agent]: thread };
      });
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The assistant could not respond. Please try again.",
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="agent-workspace" aria-label="Agent workflow and chat">
      <div className="agent-workspace-heading">
        <div>
          <p className="inbox-kicker">SINGULARITY / OPERATIONS</p>
          <h1>Agent Workflow</h1>
          <p className="inbox-subtitle">Choose a specialist and start a conversation.</p>
        </div>
        <span className="secure-indicator">
          <span className="agent-online-dot" /> 7 agents available
        </span>
      </div>

      <div className="agent-flow-card">
        <div className="agent-flow-heading">
          <div>
            <p className="agent-section-kicker">YOUR TEAM</p>
            <h2>Specialist workflow</h2>
          </div>
          <span>SELECT AN AGENT TO CHAT</span>
        </div>
        <div className="agent-flow" aria-label="Choose an agent">
          {AGENTS.map((agent, index) => (
            <div className="agent-flow-step" key={agent.name}>
              <button
                className={`agent-flow-node${selectedAgent === agent.name ? " is-active" : ""}`}
                type="button"
                aria-pressed={selectedAgent === agent.name}
                disabled={streaming}
                onClick={() => selectAgent(agent.name)}
              >
                <span className="agent-node-index">
                  {selectedAgent === agent.name ? (
                    <Check size={13} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span className="agent-node-copy">
                  <strong>{agent.name}</strong>
                  <small>{agent.focus}</small>
                </span>
                <span className="agent-node-status">
                  {selectedAgent === agent.name ? "ACTIVE" : "READY"}
                </span>
              </button>
              {index < AGENTS.length - 1 && (
                <span className="agent-flow-connector" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>

      <section className="agent-chat-card" aria-label={`Chat with ${selectedAgent}`}>
        <div className="agent-chat-header">
          <div className="agent-chat-avatar">
            <Bot size={18} strokeWidth={1.6} />
          </div>
          <div className="agent-chat-title">
            <span>CHAT SESSION</span>
            <h2>{selectedAgent}</h2>
          </div>
          <button
            className="agent-new-chat"
            type="button"
            onClick={clearConversation}
            disabled={streaming || messages.length === 0}
          >
            <Plus size={15} />
            New chat
          </button>
        </div>

        <div className="agent-messages" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? (
            <div className="agent-chat-welcome">
              <span className="agent-welcome-icon">
                <Sparkles size={19} strokeWidth={1.5} />
              </span>
              <h3>What can I help you with?</h3>
              <p>
                Ask the {selectedAgent} about{" "}
                {AGENTS.find((agent) => agent.name === selectedAgent)?.focus.toLowerCase()}.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <article
                className={`agent-message ${message.role}`}
                key={`${selectedAgent}-${index}`}
              >
                <span className="agent-message-avatar" aria-hidden="true">
                  {message.role === "user" ? <UserRound size={14} /> : <Bot size={14} />}
                </span>
                <div className="agent-message-body">
                  <span>{message.role === "user" ? "YOU" : selectedAgent.toUpperCase()}</span>
                  <p>
                    {message.content || (streaming && index === messages.length - 1 ? " " : "")}
                  </p>
                  {streaming && index === messages.length - 1 && message.role === "assistant" && (
                    <span className="agent-typing" aria-label="Assistant is responding">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </div>
              </article>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <p className="agent-chat-error" role="alert">
            {error}
          </p>
        )}

        <form className="agent-composer" onSubmit={(event) => void sendMessage(event)}>
          <label className="agent-select-wrap">
            <span>ASSISTANT</span>
            <select
              value={selectedAgent}
              disabled={streaming}
              onChange={(event) => {
                const agent = AGENTS.find((item) => item.name === event.target.value);
                if (agent) selectAgent(agent.name);
              }}
              aria-label="Choose an AI agent"
            >
              {AGENTS.map((agent) => (
                <option key={agent.name} value={agent.name}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <div className="agent-composer-input">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              aria-label="Message the selected agent"
              placeholder={`Message ${selectedAgent}…`}
              rows={1}
              maxLength={4000}
              disabled={streaming}
            />
            <button
              type="submit"
              className="agent-send-button"
              disabled={!draft.trim() || streaming}
              aria-label={streaming ? "Agent is responding" : "Send message"}
            >
              {streaming ? <LoaderCircle size={17} className="agent-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="agent-composer-hint">Enter to send · Shift + Enter for a new line</p>
        </form>
      </section>
    </section>
  );
}

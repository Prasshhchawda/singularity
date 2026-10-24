import { useEffect, useRef, useState, type FormEvent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Select from "@radix-ui/react-select";
import {
  Bot,
  Check,
  ChevronDown,
  CircleArrowLeft,
  LoaderCircle,
  Plus,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

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

export function AgentWorkspace({
  showAllAgents,
  onShowAllAgentsChange,
}: {
  showAllAgents: boolean;
  onShowAllAgentsChange: (showAll: boolean) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState<AgentName>(AGENTS[0].name);
  const [teamAgents, setTeamAgents] = useState<AgentName[]>([AGENTS[0].name]);
  const [threads, setThreads] = useState<AgentThreads>({});
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = threads[selectedAgent] ?? EMPTY_MESSAGES;
  const visibleAgents = showAllAgents
    ? AGENTS
    : AGENTS.filter((agent) => teamAgents.includes(agent.name));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => {
    if (!streaming) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const estimatedProgress = Math.round(95 * (1 - Math.exp(-elapsed / 5000)));
      setProgress((current) => (current >= 100 ? current : Math.min(95, estimatedProgress)));
    }, 200);
    return () => window.clearInterval(timer);
  }, [streaming]);

  useEffect(() => {
    if (progress !== 100) return;
    const timer = window.setTimeout(() => setProgress(0), 450);
    return () => window.clearTimeout(timer);
  }, [progress]);

  function selectAgent(agent: AgentName) {
    if (streaming) return;
    setSelectedAgent(agent);
    setError("");
  }

  function chooseIndividualAgent(agent: AgentName) {
    if (streaming) return;
    setSelectedAgent(agent);
    setTeamAgents([agent]);
    onShowAllAgentsChange(false);
    setError("");
  }

  function addTeamAgent(agent: AgentName) {
    if (streaming || teamAgents.includes(agent)) return;
    setTeamAgents((current) => [...current, agent]);
    setSelectedAgent(agent);
    setError("");
  }

  function removeTeamAgent(agent: AgentName) {
    if (streaming || teamAgents.length <= 1) return;
    const nextTeam = teamAgents.filter((name) => name !== agent);
    setTeamAgents(nextTeam);
    if (selectedAgent === agent) setSelectedAgent(nextTeam[0]);
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
    setProgress(0);
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

      setProgress(100);
      setThreads((current) => {
        const thread = [...(current[agent] ?? [])];
        if (thread.at(-1)?.role === "assistant") {
          thread[thread.length - 1] = { role: "assistant", content: reply };
        }
        return { ...current, [agent]: thread };
      });
    } catch (sendError) {
      setProgress(0);
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
      <div className="agent-view-toggle-row">
        {!showAllAgents && (
          <button
            className="agent-view-toggle"
            type="button"
            onClick={() => onShowAllAgentsChange(true)}
            aria-label="Show all seven agents"
            title="Show all seven agents"
          >
            <CircleArrowLeft size={19} strokeWidth={1.7} />
          </button>
        )}
      </div>
      <div className="agent-workspace-heading">
        <div>
          <p className="inbox-kicker">SINGULARITY / OPERATIONS</p>
          <h1>Agent Workflow</h1>
          <p className="inbox-subtitle">Choose a specialist and start a conversation.</p>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="agent-individual-trigger" type="button" disabled={streaming}>
              <span className="agent-online-dot" />
              Get individual agent
              <ChevronDown size={13} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="agent-picker-menu" align="end" sideOffset={8}>
              <p className="agent-picker-heading">CHOOSE A SPECIALIST</p>
              {AGENTS.map((agent) => (
                <DropdownMenu.Item
                  className="agent-picker-item"
                  key={agent.name}
                  onSelect={() => chooseIndividualAgent(agent.name)}
                >
                  <span>
                    <strong>{agent.name}</strong>
                    <small>{agent.focus}</small>
                  </span>
                  {selectedAgent === agent.name && <Check size={14} />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="agent-flow-card">
        <div className="agent-flow-heading">
          <div>
            <p className="agent-section-kicker">YOUR TEAM</p>
            <h2>Specialist workflow</h2>
          </div>
          <div className="agent-flow-actions">
            {!showAllAgents && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="agent-flow-action"
                    type="button"
                    aria-label="Add an agent to your workflow"
                    disabled={streaming || teamAgents.length === AGENTS.length}
                  >
                    <Plus size={14} />
                    Add agent
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="agent-picker-menu" align="end" sideOffset={7}>
                    <p className="agent-picker-heading">ADD TO YOUR WORKFLOW</p>
                    {AGENTS.filter((agent) => !teamAgents.includes(agent.name)).map((agent) => (
                      <DropdownMenu.Item
                        className="agent-picker-item"
                        key={agent.name}
                        onSelect={() => addTeamAgent(agent.name)}
                      >
                        <span>
                          <strong>{agent.name}</strong>
                          <small>{agent.focus}</small>
                        </span>
                        <Plus size={13} />
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </div>
        <div
          className={`agent-flow${showAllAgents ? "" : " is-focused"}`}
          aria-label="Choose an agent"
        >
          {visibleAgents.map((agent, index) => (
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
              {!showAllAgents && (
                <button
                  className="agent-flow-node-remove"
                  type="button"
                  aria-label={`Remove ${agent.name} from your workflow`}
                  title={
                    teamAgents.length === 1
                      ? "Keep at least one agent in your workflow"
                      : "Remove agent"
                  }
                  disabled={streaming || teamAgents.length <= 1}
                  onClick={() => removeTeamAgent(agent.name)}
                >
                  <X size={12} />
                </button>
              )}
              {index < visibleAgents.length - 1 && (
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
                  {(streaming || progress === 100) &&
                    index === messages.length - 1 &&
                    message.role === "assistant" && (
                      <div
                        className="agent-response-progress"
                        role="progressbar"
                        aria-label={`${selectedAgent} is thinking`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        aria-valuetext={progress === 100 ? "Response ready" : `${progress}%`}
                      >
                        <span style={{ width: `${progress}%` }} />
                      </div>
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
            <Select.Root
              value={selectedAgent}
              disabled={streaming}
              onValueChange={(value) => {
                const agent = AGENTS.find((item) => item.name === value);
                if (agent) selectAgent(agent.name);
              }}
            >
              <Select.Trigger className="agent-select-trigger" aria-label="Choose an AI agent">
                <Select.Value />
                <Select.Icon>
                  <ChevronDown size={12} />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="agent-select-content"
                  position="popper"
                  side="top"
                  align="start"
                  sideOffset={8}
                >
                  <Select.Viewport className="agent-select-viewport">
                    {AGENTS.map((agent) => (
                      <Select.Item
                        className="agent-select-item"
                        key={agent.name}
                        value={agent.name}
                      >
                        <Select.ItemText>{agent.name}</Select.ItemText>
                        <Select.ItemIndicator className="agent-select-item-indicator">
                          <Check size={13} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
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

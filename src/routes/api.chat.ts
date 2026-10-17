import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenAI } from "@google/genai";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  message?: unknown;
  agent?: {
    name?: unknown;
    role?: unknown;
  };
  history?: unknown;
};

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    (value.role === "user" || value.role === "assistant") &&
    "content" in value &&
    typeof value.content === "string"
  );
}

function getGeminiClient() {
  const geminiApiKey = process.env["GEMINI_API_KEY"]?.trim();
  console.info("Gemini API key configured:", Boolean(geminiApiKey));

  if (!geminiApiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey: geminiApiKey,
  });
}

function getGeminiErrorDetails(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Gemini API error";
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : undefined;
  const apiKey = process.env["GEMINI_API_KEY"]?.trim();
  const apiKeyPattern = apiKey
    ? new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
    : null;
  let sanitizedMessage = message.replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[REDACTED]");
  if (apiKeyPattern) {
    sanitizedMessage = sanitizedMessage.replace(apiKeyPattern, "[REDACTED]");
  }

  return { status, message: sanitizedMessage };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as ChatRequest | null;

          const message = typeof body?.message === "string" ? body.message.trim() : "";
          const agentName = typeof body?.agent?.name === "string" ? body.agent.name.trim() : "";
          const agentRole = typeof body?.agent?.role === "string" ? body.agent.role.trim() : "";
          const history = body?.history;

          if (!message) {
            return Response.json({ error: "A message is required." }, { status: 400 });
          }
          if (!agentName || !agentRole) {
            return Response.json(
              { error: "An agent name and role are required." },
              { status: 400 },
            );
          }
          if (!Array.isArray(history) || !history.every(isChatMessage)) {
            return Response.json({ error: "Chat history is invalid." }, { status: 400 });
          }

          const ai = getGeminiClient();
          if (!ai) {
            console.error("Gemini configuration error: GEMINI_API_KEY is not set.");
            return Response.json(
              { error: "Gemini is not configured. Set GEMINI_API_KEY in the server environment." },
              { status: 503 },
            );
          }

          const interaction = await ai.interactions.create({
            model: "gemini-3.8-flash",
            input: [
              ...history.map(({ role, content }) =>
                role === "assistant"
                  ? {
                      type: "model_output" as const,
                      content: [{ type: "text" as const, text: content }],
                    }
                  : {
                      type: "user_input" as const,
                      content: [{ type: "text" as const, text: content }],
                    },
              ),
              { type: "user_input", content: [{ type: "text", text: message }] },
            ],
            system_instruction: `You are the ${agentName} for Singularity. Your role is ${agentRole}. Respond as a practical, helpful business specialist in this role. Ask concise follow-up questions when needed. Be clear about assumptions and do not claim to have taken actions outside this chat.`,
          });

          const reply = interaction.output_text?.trim();
          if (!reply) {
            return Response.json({ error: "Gemini returned an empty response." }, { status: 502 });
          }

          return Response.json({ reply });
        } catch (error) {
          const details = getGeminiErrorDetails(error);
          console.error("Gemini API request failed:", details);

          const message = details.status
            ? `Gemini API request failed (HTTP ${details.status}): ${details.message}`
            : `Gemini request failed: ${details.message}`;
          const status = details.status === 429 ? 503 : 502;

          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

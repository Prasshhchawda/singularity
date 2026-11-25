import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenAI } from "@google/genai";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  message?: unknown;
  callId?: unknown;
  accessCode?: unknown;
  agent?: {
    name?: unknown;
    role?: unknown;
  };
  history?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

function getTokenCount(value: unknown, key: string) {
  if (!isRecord(value)) return 0;
  const usage = value["usageMetadata"];
  if (!isRecord(usage)) return 0;
  const count = usage[key];
  return typeof count === "number" && Number.isFinite(count) && count >= 0
    ? Math.floor(count)
    : 0;
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
          const callId = typeof body?.callId === "string" ? body.callId.trim() : "";
          const accessCode = typeof body?.accessCode === "string" ? body.accessCode.trim() : "";
          const agentName = typeof body?.agent?.name === "string" ? body.agent.name.trim() : "";
          const agentRole = typeof body?.agent?.role === "string" ? body.agent.role.trim() : "";
          const history = body?.history;

          if (!message) {
            return Response.json({ error: "A message is required." }, { status: 400 });
          }
          if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(callId) ||
            !/^[A-Za-z0-9_-]{43}$/.test(accessCode)
          ) {
            return Response.json({ error: "Meeting access is invalid." }, { status: 401 });
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
          if (message.length > 20000 || history.length > 100) {
            return Response.json({ error: "The chat request is too large." }, { status: 413 });
          }

          const { createPublicSupabaseClient } = await import("../lib/admin.server");
          const supabase = createPublicSupabaseClient();
          const { data: accessRows, error: accessError } = await supabase.rpc(
            "get_meeting_access",
            { p_call_id: callId, p_access_code: accessCode },
          );
          if (accessError) {
            console.error("Meeting access verification failed:", accessError.message);
            return Response.json({ error: "Meeting access could not be verified." }, { status: 503 });
          }
          if (!accessRows?.[0]?.is_valid) {
            return Response.json({ error: "Meeting access is invalid." }, { status: 401 });
          }

          const { data: employeeConfigs, error: employeeConfigError } = await supabase.rpc(
            "get_meeting_employee_config",
            {
              p_call_id: callId,
              p_access_code: accessCode,
              p_employee_name: agentName,
            },
          );
          if (employeeConfigError) {
            console.error("AI employee configuration could not be loaded:", employeeConfigError.message);
            return Response.json({ error: "The AI employee configuration could not be loaded." }, { status: 503 });
          }
          const employeeConfig = employeeConfigs?.[0];
          if (!employeeConfig) {
            return Response.json({ error: "This AI employee is unavailable." }, { status: 404 });
          }

          const ai = getGeminiClient();
          if (!ai) {
            console.error("Gemini configuration error: GEMINI_API_KEY is not set.");
            return Response.json(
              { error: "Gemini is not configured. Set GEMINI_API_KEY in the server environment." },
              { status: 503 },
            );
          }

          const systemInstruction = employeeConfig.system_prompt;
          const modelCandidates = [...new Set([
            employeeConfig.gemini_model,
            "gemini-flash-latest",
            "gemini-3.5-flash",
            "gemini-3.8-flash",
          ])];
          let reply = "";
          let selectedModel = "";
          let tokenCountIn = 0;
          let tokenCountOut = 0;
          let lastError: unknown;
          const startedAt = Date.now();

          for (const model of modelCandidates) {
            try {
              const response = await ai.models.generateContent({
                model,
                contents: [
                  ...history.map(({ role, content }) => ({
                    role: role === "assistant" ? ("model" as const) : ("user" as const),
                    parts: [{ text: content }],
                  })),
                  { role: "user", parts: [{ text: message }] },
                ],
                config: { systemInstruction, temperature: employeeConfig.temperature },
              });
              reply = response.text?.trim() ?? "";
              if (reply) {
                selectedModel = model;
                tokenCountIn = getTokenCount(response, "promptTokenCount");
                tokenCountOut = getTokenCount(response, "candidatesTokenCount");
                break;
              }
            } catch (modelError) {
              lastError = modelError;
            }
          }

          if (!reply) {
            throw lastError ?? new Error("Gemini returned an empty response.");
          }

          const { error: usageError } = await supabase.rpc("record_ai_usage", {
            p_call_id: callId,
            p_access_code: accessCode,
            p_employee_name: agentName,
            p_tokens_in: tokenCountIn,
            p_tokens_out: tokenCountOut,
            p_model: selectedModel,
            p_latency_ms: Math.min(Date.now() - startedAt, 600000),
          });
          if (usageError) {
            console.error("Gemini usage could not be recorded:", usageError.message);
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

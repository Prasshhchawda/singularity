import dotenv from "dotenv";
import express from "express";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
app.set("trust proxy", 1);

const defaultOrigins = [
  "https://singularity-piov.onrender.com",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
];
if (process.env.NODE_ENV !== "production") {
  defaultOrigins.push("http://localhost:5173", "http://127.0.0.1:5173");
}
const allowedOrigins = new Set([
  ...defaultOrigins,
  ...(process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: "This frontend origin is not allowed." });
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const requestBuckets = new Map();
const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 20;

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of requestBuckets) {
    if (now - bucket.startedAt >= rateLimitWindowMs) requestBuckets.delete(ip);
  }
}, rateLimitWindowMs).unref();

app.use("/api/agent", (req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  let bucket = requestBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= rateLimitWindowMs) {
    bucket = { startedAt: now, count: 0 };
    requestBuckets.set(ip, bucket);
  }
  if (bucket.count >= maxRequestsPerWindow) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Try again shortly." });
  }
  bucket.count += 1;
  next();
});

app.post("/api/agent", async (req, res) => {
  try {
    const body = req.body;
    const task = typeof body?.task === "string" ? body.task.trim() : "";
    const agentName = typeof body?.agentName === "string" ? body.agentName.trim() : "";
    const agentRole = typeof body?.agentRole === "string" ? body.agentRole.trim() : "";
    const previousResults = body?.previousResults ?? [];

    if (!task || !agentName || !agentRole) {
      return res.status(400).json({
        error: "Task, agent name, and role are required.",
      });
    }
    if (
      task.length > 20000 ||
      agentName.length > 120 ||
      agentRole.length > 500 ||
      !Array.isArray(previousResults) ||
      previousResults.length > 100 ||
      !previousResults.every(
        (item) =>
          item &&
          typeof item === "object" &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" &&
          item.content.length <= 20000,
      )
    ) {
      return res.status(400).json({ error: "The task request is invalid or too large." });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return res.status(503).json({
        error: "Gemini is not configured on the backend.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
You are ${agentName} on the Singularity AI team.
Your role: ${agentRole}
Task: ${task}
Previous agents' results:
${JSON.stringify(previousResults, null, 2)}

Provide findings, recommended actions, assumptions, and risks.
Do not claim to have performed real-world actions you did not perform.
`,
    });

    res.json({ reply: response.text || "No response returned." });
  } catch (error) {
    console.error("Agent request failed:", error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: "The agent request failed. Check the server terminal.",
    });
  }
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Singularity backend listening on port ${PORT}`);
});

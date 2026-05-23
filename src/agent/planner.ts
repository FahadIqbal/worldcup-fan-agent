// src/agent/planner.ts
// WorldCup Fan Command Center — Core Agentic Loop

import { VertexAI } from "@google-cloud/vertexai";
import { tavilySearch } from "@/tools/tavily";
import { neonQuery, neonUpsert } from "@/tools/neon";
import { browserScrape } from "@/tools/browserbase";
import { detectCompoundGoal, buildSkillPrompt, type Skill, type SkillId } from "./skills";
import type { UserLocation } from "@/types/location";
import {
  createSession, getSession, appendMessage, logToolCall,
  updateSessionContext, persistRunLog, loadUserContext,
  buildContextMessage, type SessionState,
} from "./memory";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ParsedToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentRequest {
  message: string;
  userId: string;
  sessionId?: string;
  userLocation?: UserLocation;
}

export interface AgentResponse {
  text: string;
  skillId: string;
  toolsUsed: string[];
  sessionId: string;
  tokensUsed: number;
}

// ─── Vertex AI setup ───────────────────────────────────────────────────────

function getModel() {
  const vertex = new VertexAI({
    project: process.env.GCP_PROJECT_ID!,
    location: process.env.GCP_REGION ?? "us-central1",
  });
  return vertex.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-1.5-pro-002",
    generationConfig: {
      maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "4096"),
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE ?? "0.3"),
      topP: 0.8,
    },
  });
}

// ─── Main entry point ──────────────────────────────────────────────────────

export async function runFanAgent(
  req: AgentRequest,
  onToken?: (token: string) => Promise<void>
): Promise<AgentResponse> {
  let state: SessionState;
  if (req.sessionId) {
    state = getSession(req.sessionId) ?? createSession(req.userId);
  } else {
    state = createSession(req.userId);
  }

  // Load Neon context on the first message of a session
  let userContextStr = "";
  if (state.conversationHistory.length === 0) {
    const ctx = await loadUserContext(req.userId);
    userContextStr = buildContextMessage(ctx);
    if (ctx.profile) {
      updateSessionContext(state.sessionId, {
        passportCountry: ctx.profile.passportCountry,
        originCity: ctx.profile.homeCity,
      });
    }
    if (ctx.activeTrips[0]) {
      updateSessionContext(state.sessionId, {
        activeTripId: ctx.activeTrips[0].id,
        matchId: ctx.activeTrips[0].matchId ?? undefined,
      });
    }
  }

  // Inject real-time location context into every request
  if (req.userLocation?.city) {
    const loc = req.userLocation;
    userContextStr +=
      `\n\n=== DETECTED USER LOCATION ===\n` +
      `City: ${loc.city}\n` +
      `Country: ${loc.country}\n` +
      `Country code: ${loc.countryCode}\n` +
      `Preferred currency: ${loc.currency}\n` +
      (loc.timezone ? `Timezone: ${loc.timezone}\n` : "") +
      `Detection method: ${loc.source}\n` +
      `IMPORTANT: Treat this as the user's departure city and home country for all trip planning, ` +
      `visa checks, and price alerts unless the user explicitly specifies otherwise.\n` +
      `=== END LOCATION ===`;
    // Sync into session so follow-up messages also carry the location
    updateSessionContext(state.sessionId, { originCity: loc.city });
  }

  const skills = detectCompoundGoal(req.message);
  const primarySkill = skills[0];

  appendMessage(state.sessionId, "user", req.message);

  let result: { text: string; toolsUsed: string[]; tokensUsed: number };

  if (!process.env.GCP_PROJECT_ID) {
    // Demo mode — no Vertex AI credentials configured
    result = await demoResponse(primarySkill.id, req.message, onToken);
  } else {
    try {
      result = await agentLoop({
        state,
        systemPrompt: buildSkillPrompt(primarySkill, userContextStr),
        skill: primarySkill,
        onToken,
      });

      // Compound goal: run the secondary skill too
      if (skills.length > 1) {
        const secondary = await agentLoop({
          state,
          systemPrompt: buildSkillPrompt(skills[1], ""),
          skill: skills[1],
          onToken,
        });
        result.text += "\n\n---\n\n" + secondary.text;
        result.toolsUsed.push(...secondary.toolsUsed);
        result.tokensUsed += secondary.tokensUsed;
      }
    } catch (err) {
      const msg = `I ran into an issue processing your request: ${String(err)}\n\nPlease try again.`;
      if (onToken) await onToken(msg);
      result = { text: msg, toolsUsed: [], tokensUsed: 0 };
    }
  }

  // Persist run log to Neon (non-fatal if it fails)
  try {
    await persistRunLog(state, primarySkill.id, req.message, result.text, result.tokensUsed);
  } catch {
    // Silently ignore — don't fail the response because logging failed
  }

  appendMessage(state.sessionId, "model", result.text);

  return { ...result, skillId: primarySkill.id, sessionId: state.sessionId };
}

// ─── Core agentic loop ─────────────────────────────────────────────────────

async function agentLoop(params: {
  state: SessionState;
  systemPrompt: string;
  skill: Skill;
  onToken?: (token: string) => Promise<void>;
}): Promise<{ text: string; toolsUsed: string[]; tokensUsed: number }> {
  const { state, systemPrompt, skill, onToken } = params;

  // The last entry in conversationHistory IS the current user message.
  // Pass prior history to startChat, then sendMessage the current message.
  const priorHistory = state.conversationHistory.slice(0, -1);
  const currentUserMessage =
    state.conversationHistory[state.conversationHistory.length - 1]?.parts[0]?.text ?? "";

  const model = getModel();
  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: `Understood. I am ready to help with ${skill.name}.` }] },
      ...priorHistory,
    ],
  });

  let finalText = "";
  let totalTokens = 0;
  const toolsUsed = new Set<string>();

  // In round 0 we send the user's message.
  // In subsequent rounds we send tool results so Gemini can continue.
  let nextUserMsg = currentUserMessage;

  for (let round = 0; round < skill.maxRounds; round++) {
    const response = await chat.sendMessage(nextUserMsg);
    const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    totalTokens += response.response.usageMetadata?.totalTokenCount ?? 0;

    if (!text) break;

    // Stream the response tokens
    if (onToken) {
      for (const word of text.split(" ")) {
        await onToken(word + " ");
        await new Promise((r) => setTimeout(r, 8));
      }
    }

    const toolCalls = parseToolCalls(text);

    if (toolCalls.length === 0) {
      // No tool calls → this is the final answer
      finalText = text;
      break;
    }

    // Execute tools (reads in parallel, writes sequentially)
    const readCalls = toolCalls.filter((c) => c.name !== "neon_upsert");
    const writeCalls = toolCalls.filter((c) => c.name === "neon_upsert");
    const toolResults: Array<{ name: string; result: unknown }> = [];

    const readSettled = await Promise.allSettled(
      readCalls.map(async (call) => {
        const t0 = Date.now();
        const res = await executeTool(call);
        logToolCall(state.sessionId, {
          name: call.name, args: call.args, result: res, durationMs: Date.now() - t0,
        });
        toolsUsed.add(call.name);
        return { name: call.name, result: res };
      })
    );
    readSettled.forEach((r) => {
      toolResults.push(r.status === "fulfilled" ? r.value : { name: "error", result: String(r.reason) });
    });

    for (const call of writeCalls) {
      const t0 = Date.now();
      const res = await executeTool(call);
      logToolCall(state.sessionId, {
        name: call.name, args: call.args, result: res, durationMs: Date.now() - t0,
      });
      toolsUsed.add(call.name);
      toolResults.push({ name: call.name, result: res });
    }

    // Feed results back; next loop iteration sends them as the user turn
    nextUserMsg = `Tool results:\n${JSON.stringify(toolResults, null, 2)}\n\nPlease continue with your response.`;

    if (round === skill.maxRounds - 1) finalText = text; // fallback
  }

  return { text: finalText, toolsUsed: Array.from(toolsUsed), tokensUsed: totalTokens };
}

// ─── Tool executor ─────────────────────────────────────────────────────────

async function executeTool(call: ParsedToolCall): Promise<unknown> {
  try {
    switch (call.name) {
      case "tavily_search":
        return await tavilySearch(String(call.args.query ?? ""));
      case "neon_query":
        return await neonQuery(String(call.args.sql ?? "SELECT 1"));
      case "neon_upsert":
        return await neonUpsert(
          String(call.args.table ?? ""),
          (call.args.data as Record<string, unknown>) ?? {}
        );
      case "browser_scrape":
        return await browserScrape(String(call.args.url ?? ""));
      default:
        return { error: `Unknown tool: ${call.name}` };
    }
  } catch (err) {
    return { error: String(err) };
  }
}

// ─── Tool call parser ──────────────────────────────────────────────────────

/**
 * Extract tool calls from model text output.
 * Expected format: {"tool": "tavily_search", "args": {"query": "..."}}
 */
function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  // Match nested JSON objects for args (handles up to 2 levels of nesting)
  const pattern =
    /\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{(?:[^{}]|\{[^{}]*\})*\})\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    try {
      calls.push({ name: match[1], args: JSON.parse(match[2]) });
    } catch {
      // skip malformed JSON
    }
  }
  return calls;
}

// ─── Demo mode (no GCP credentials) ───────────────────────────────────────

const DEMO_INTROS: Record<SkillId, string> = {
  "SK-01": "I'd love to help you plan a complete World Cup trip! Here's a sample of what I can do:",
  "SK-02": "I can set up a flight price alert for you. Here's how it would look:",
  "SK-03": "Let me check the visa requirements for your journey.",
  "SK-04": "Here's the FIFA 2026 match schedule information you're looking for:",
  "SK-05": "Let me find accommodation near the stadium for you.",
  "SK-06": "Here's my fantasy league analysis:",
  "SK-07": "Here's your budget breakdown:",
  "SK-08": "Here are the fan zones near the venue:",
  "SK-09": "Here are your transport options:",
  "SK-10": "Here's the weather forecast for your match city:",
};

async function demoResponse(
  skillId: SkillId,
  userMessage: string,
  onToken?: (token: string) => Promise<void>
): Promise<{ text: string; toolsUsed: string[]; tokensUsed: number }> {
  const intro = DEMO_INTROS[skillId] ?? "I can help with that!";

  const text = `${intro}

> ⚠️ **DEMO MODE** — \`GCP_PROJECT_ID\` is not configured.
> The live agent uses Gemini 1.5 Pro via Vertex AI to search the web, check visas,
> find flights, and save your trip to your profile.
>
> **To activate:** Add your GCP credentials to \`.env.local\` and restart the server.
> See \`.env.example\` for all required variables.

**Your query:** "${userMessage}"

Once configured, I would:
1. 🔍 Search Tavily for live data on your request
2. ✈️  Scrape real flight prices via Google Flights
3. 🌐 Check official government visa pages
4. 💾 Save your plan to your Neon profile

**Ready to go?** Copy \`.env.example\` → \`.env.local\` and fill in your keys!`;

  if (onToken) {
    for (const word of text.split(" ")) {
      await onToken(word + " ");
      await new Promise((r) => setTimeout(r, 12));
    }
  }

  return { text, toolsUsed: [], tokensUsed: 0 };
}

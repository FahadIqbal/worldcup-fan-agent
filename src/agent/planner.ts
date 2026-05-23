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
    const errStr = String(err);
    // Vertex AI not authenticated locally — answer with Tavily live search instead
    if (errStr.includes("GoogleAuthError") || errStr.includes("Unable to authenticate") || !process.env.GCP_PROJECT_ID) {
      result = await tavilyFallbackResponse(primarySkill, req.message, req.userLocation, onToken);
    } else {
      const msg = `I ran into an issue: ${errStr}\n\nPlease try again.`;
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

// ─── Tavily fallback (Vertex AI unavailable) ──────────────────────────────
// Runs real Tavily searches when GCP credentials aren't configured locally.
// Users get live, cited answers instead of a placeholder message.

const SKILL_QUERIES: Record<SkillId, (msg: string, loc?: UserLocation) => string[]> = {
  "SK-01": (m, l) => [
    `FIFA World Cup 2026 travel guide flights hotels ${l?.city ?? ""} ${m}`,
    `World Cup 2026 host cities venues schedule tickets site:fifa.com OR site:sportingnews.com`,
  ],
  "SK-02": (m, l) => [
    `cheapest flights ${l?.city ?? ""} to USA World Cup 2026 price tracker`,
    `flight price alert World Cup 2026 ${m}`,
  ],
  "SK-03": (m, l) => [
    `${l?.country ?? ""} passport US visa requirements 2026 World Cup entry`,
    `site:travel.state.gov OR site:canada.ca ${l?.country ?? ""} visitor visa tourist`,
  ],
  "SK-04": (_, l) => [
    `FIFA World Cup 2026 full match schedule fixtures groups ${l?.country ?? ""}`,
    `World Cup 2026 kickoff times dates venues site:fifa.com`,
  ],
  "SK-05": (m, l) => [
    `best hotels near World Cup 2026 stadium ${m} ${l?.city ?? ""}`,
    `accommodation World Cup 2026 host city booking tips`,
  ],
  "SK-06": (m) => [
    `World Cup 2026 fantasy football picks injuries form ${m}`,
    `best players World Cup 2026 fantasy team captain picks`,
  ],
  "SK-07": (_, l) => [
    `World Cup 2026 total trip cost budget breakdown flights hotel tickets ${l?.country ?? ""}`,
    `how much does it cost to attend World Cup 2026 budget guide`,
  ],
  "SK-08": (m) => [
    `FIFA fan zone official World Cup 2026 ${m} free viewing party`,
    `best sports bars public viewing World Cup 2026 host cities`,
  ],
  "SK-09": (m) => [
    `transport airport to stadium World Cup 2026 ${m} public transit`,
    `getting around World Cup 2026 host city match day transport guide`,
  ],
  "SK-10": (m) => [
    `weather World Cup 2026 host cities June July climate ${m}`,
    `what to pack World Cup 2026 outdoor stadium summer USA`,
  ],
};

const SKILL_HEADERS: Record<SkillId, string> = {
  "SK-01": "✈️ World Cup 2026 — Trip Planning",
  "SK-02": "🔔 Flight Price Monitoring",
  "SK-03": "🛂 Visa & Entry Requirements",
  "SK-04": "📅 Match Schedule & Fixtures",
  "SK-05": "🏨 Hotels & Accommodation",
  "SK-06": "⚽ Fantasy League Advice",
  "SK-07": "💰 Trip Budget Breakdown",
  "SK-08": "🎪 Fan Zones & Viewing Parties",
  "SK-09": "🚌 Transport & Getting Around",
  "SK-10": "🌤 Weather & Packing Guide",
};

async function tavilyFallbackResponse(
  skill: Skill,
  userMessage: string,
  location: UserLocation | undefined,
  onToken?: (token: string) => Promise<void>
): Promise<{ text: string; toolsUsed: string[]; tokensUsed: number }> {
  const queries = SKILL_QUERIES[skill.id]?.(userMessage, location) ?? [userMessage];

  // Run searches in parallel
  const searchResults = await Promise.all(queries.map((q) => tavilySearch(q, "advanced")));

  const header = SKILL_HEADERS[skill.id] ?? "🌍 World Cup 2026";
  const locNote = location?.city ? ` — tailored for travellers from **${location.city}, ${location.country}**` : "";

  // Build a structured, cited response from Tavily results
  const sections = searchResults
    .map((r, i) => {
      if (!r.results || r.results.startsWith("[Tavily]")) return null;
      const lines = r.results.split("\n").filter(Boolean);
      const answer = lines.find((l) => l.startsWith("DIRECT ANSWER:"))?.replace("DIRECT ANSWER: ", "");
      const sources = lines.filter((l) => l.startsWith("URL:")).slice(0, 2).map((l) => l.replace("URL: ", ""));
      const content = lines
        .filter((l) => !l.startsWith("URL:") && !l.startsWith("[") && !l.startsWith("DIRECT ANSWER:"))
        .slice(0, 6)
        .join("\n");

      return { query: queries[i], answer, content, sources };
    })
    .filter(Boolean);

  let text = `## ${header}${locNote}\n\n`;

  if (sections.length === 0) {
    text += `I searched for live information about your query but couldn't retrieve results right now. Please try again in a moment.\n\n**Your question:** ${userMessage}`;
  } else {
    for (const s of sections) {
      if (!s) continue;
      if (s.answer) text += `> **${s.answer}**\n\n`;
      if (s.content) text += `${s.content}\n\n`;
      if (s.sources.length > 0) {
        text += `**Sources:** ${s.sources.map((u) => `[${new URL(u).hostname}](${u})`).join(" · ")}\n\n`;
      }
      text += "---\n\n";
    }

    text += `*Powered by Tavily live search · Connect Google Cloud credentials for the full Gemini 1.5 Pro agentic experience.*`;
  }

  if (onToken) {
    for (const word of text.split(" ")) {
      await onToken(word + " ");
      await new Promise((r) => setTimeout(r, 6));
    }
  }

  return { text, toolsUsed: ["tavily_search"], tokensUsed: 0 };
}

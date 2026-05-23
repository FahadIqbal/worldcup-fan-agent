// agent/planner.ts
// WorldCup Fan Command Center — Core Agentic Loop
// Runs inside Google Cloud Agent Builder with Gemini 1.5 Pro

import { VertexAI } from "@google-cloud/vertexai";
import { tavilySearch } from "../tools/tavily";
import { neonQuery, neonUpsert } from "../tools/neon";
import { browserScrape } from "../tools/browserbase";
import {
  classifyIntent,
  detectCompoundGoal,
  buildSkillPrompt,
  type Skill,
} from "./skills";
import {
  createSession,
  getSession,
  appendMessage,
  logToolCall,
  updateSessionContext,
  persistRunLog,
  loadUserContext,
  buildContextMessage,
  type SessionState,
} from "./memory";

// ─── Vertex AI setup ───────────────────────────────────────────────────────

const vertex = new VertexAI({
  project: process.env.GCP_PROJECT_ID!,
  location: process.env.GCP_REGION ?? "us-central1",
});

function getModel() {
  return vertex.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-1.5-pro-002",
    generationConfig: {
      maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "4096"),
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE ?? "0.3"),
      topP: 0.8,
    },
  });
}

// ─── Tool call types ───────────────────────────────────────────────────────

interface ParsedToolCall {
  name: string;
  args: Record<string, unknown>;
}

// ─── Main agent entry point ────────────────────────────────────────────────

export interface AgentRequest {
  message: string;
  userId: string;
  sessionId?: string;
}

export interface AgentResponse {
  text: string;
  skillId: string;
  toolsUsed: string[];
  sessionId: string;
  tokensUsed: number;
}

/**
 * Run the fan agent for a single user message.
 * Supports streaming via the onToken callback.
 */
export async function runFanAgent(
  req: AgentRequest,
  onToken?: (token: string) => void
): Promise<AgentResponse> {
  // Session management
  let state: SessionState;
  if (req.sessionId) {
    state = getSession(req.sessionId) ?? createSession(req.userId);
  } else {
    state = createSession(req.userId);
  }

  // Load user context from Neon (on first message)
  let userContextStr = "";
  if (state.conversationHistory.length === 0) {
    const ctx = await loadUserContext(req.userId);
    userContextStr = buildContextMessage(ctx);
    // Pre-fill session context from profile
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

  // Classify intent → select skill(s)
  const skills = detectCompoundGoal(req.message);
  const primarySkill = skills[0];

  // Build system prompt for this skill
  const systemPrompt = buildSkillPrompt(primarySkill, userContextStr);

  // Append user message to history
  appendMessage(state.sessionId, "user", req.message);

  // Run agentic loop
  const result = await agentLoop({
    state,
    systemPrompt,
    skill: primarySkill,
    onToken,
  });

  // If compound goal, run secondary skill with context
  if (skills.length > 1) {
    const secondaryResult = await agentLoop({
      state,
      systemPrompt: buildSkillPrompt(skills[1], ""),
      skill: skills[1],
      onToken,
    });
    result.text += "\n\n---\n\n" + secondaryResult.text;
    result.toolsUsed.push(...secondaryResult.toolsUsed);
  }

  // Persist run log
  await persistRunLog(
    state,
    primarySkill.id,
    req.message,
    result.text,
    result.tokensUsed
  );

  appendMessage(state.sessionId, "model", result.text);

  return {
    ...result,
    skillId: primarySkill.id,
    sessionId: state.sessionId,
  };
}

// ─── Core agentic loop ─────────────────────────────────────────────────────

async function agentLoop(params: {
  state: SessionState;
  systemPrompt: string;
  skill: Skill;
  onToken?: (token: string) => void;
}): Promise<{ text: string; toolsUsed: string[]; tokensUsed: number }> {
  const { state, systemPrompt, skill, onToken } = params;
  const model = getModel();
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      {
        role: "model",
        parts: [{ text: "Understood. I am ready to help with " + skill.name + "." }],
      },
      ...state.conversationHistory,
    ],
  });

  let finalText = "";
  let totalTokens = 0;
  const toolsUsed = new Set<string>();

  const MAX_ROUNDS = skill.maxRounds;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const userMsg =
      round === 0
        ? state.conversationHistory[state.conversationHistory.length - 1]?.parts[0]?.text ?? ""
        : "Please continue with the next step.";

    // Call Gemini
    const result = await chat.sendMessage(userMsg);
    const response = result.response;
    const text =
      response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    totalTokens += response.usageMetadata?.totalTokenCount ?? 0;

    if (!text) break;

    // Stream tokens
    if (onToken) {
      const words = text.split(" ");
      for (const word of words) {
        onToken(word + " ");
        await new Promise((r) => setTimeout(r, 8)); // natural pacing
      }
    }

    // Parse tool calls embedded in the response
    const toolCalls = parseToolCalls(text);

    if (toolCalls.length === 0) {
      // No more tool calls — this is the final answer
      finalText = text;
      break;
    }

    // Execute tools (parallel where safe)
    const independentCalls = toolCalls.filter(
      (c) => !c.name.startsWith("neon_upsert") // writes run sequentially
    );
    const writeCalls = toolCalls.filter((c) => c.name.startsWith("neon_upsert"));

    const toolResults: Array<{ name: string; result: unknown }> = [];

    // Run reads in parallel
    const readResults = await Promise.allSettled(
      independentCalls.map(async (call) => {
        const t0 = Date.now();
        const res = await executeTool(call);
        logToolCall(state.sessionId, {
          name: call.name,
          args: call.args,
          result: res,
          durationMs: Date.now() - t0,
        });
        toolsUsed.add(call.name);
        return { name: call.name, result: res };
      })
    );

    readResults.forEach((r) => {
      if (r.status === "fulfilled") toolResults.push(r.value);
      else toolResults.push({ name: "error", result: String(r.reason) });
    });

    // Run writes sequentially
    for (const call of writeCalls) {
      const t0 = Date.now();
      const res = await executeTool(call);
      logToolCall(state.sessionId, {
        name: call.name,
        args: call.args,
        result: res,
        durationMs: Date.now() - t0,
      });
      toolsUsed.add(call.name);
      toolResults.push({ name: call.name, result: res });
    }

    // Feed results back — next round will process them
    await chat.sendMessage(
      `Tool results:\n${JSON.stringify(toolResults, null, 2)}\n\nContinue your response.`
    );

    // If this was the last meaningful round, capture text
    if (round === MAX_ROUNDS - 1) {
      finalText = text;
    }
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
 * Extract JSON tool calls from model output text.
 *
 * Expected format (model outputs these inline):
 * {"tool": "tavily_search", "args": {"query": "FIFA 2026 schedule"}}
 */
function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];

  // Match tool call JSON objects
  const pattern = /\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    try {
      calls.push({
        name: match[1],
        args: JSON.parse(match[2]),
      });
    } catch {
      // Skip malformed JSON
    }
  }

  return calls;
}

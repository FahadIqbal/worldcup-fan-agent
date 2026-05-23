// src/agent/memory.ts
// Session + long-term memory manager for WorldCup Fan Command Center

import { neonQuery, neonUpsert } from "@/tools/neon";

export interface UserContext {
  profile: UserProfile | null;
  activeTrips: Trip[];
  activeAlerts: PriceAlert[];
  recentRuns: AgentRun[];
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  passportCountry: string;
  homeCity: string;
  homeCountry: string;
  currency: string;
}

export interface Trip {
  id: string;
  matchId: string | null;
  originCity: string;
  destinationCity: string;
  status: "draft" | "confirmed" | "completed";
  costBreakdown: Record<string, number>;
  itinerary: ItineraryDay[];
  createdAt: string;
}

export interface ItineraryDay {
  day: number;
  date: string;
  activities: string[];
  transport: string;
}

export interface PriceAlert {
  id: string;
  routeOrigin: string;
  routeDest: string;
  maxPrice: number;
  currency: string;
  currentPrice: number | null;
  lastChecked: string | null;
  active: boolean;
}

export interface AgentRun {
  id: string;
  skillId: string;
  goal: string;
  createdAt: string;
}

export interface SessionState {
  userId: string;
  sessionId: string;
  activeTripId: string | null;
  matchId: string | null;
  originCity: string | null;
  passportCountry: string | null;
  conversationHistory: ConversationMessage[];
  toolCallLog: ToolCall[];
  startedAt: string;
}

export interface ConversationMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  calledAt: string;
}

// ─── Long-term memory (Neon) ───────────────────────────────────────────────

export async function loadUserContext(userId: string): Promise<UserContext> {
  try {
    const [profileRes, tripsRes, alertsRes, runsRes] = await Promise.all([
      neonQuery(`SELECT * FROM user_profiles WHERE id = '${userId}' LIMIT 1`),
      neonQuery(
        `SELECT * FROM trips WHERE user_id = '${userId}' AND status != 'completed' ORDER BY created_at DESC LIMIT 5`
      ),
      neonQuery(
        `SELECT * FROM price_alerts WHERE user_id = '${userId}' AND active = true ORDER BY created_at DESC LIMIT 10`
      ),
      neonQuery(
        `SELECT id, skill_id, goal, created_at FROM agent_runs WHERE user_id = '${userId}' ORDER BY created_at DESC LIMIT 3`
      ),
    ]);

    return {
      profile: (profileRes.rows?.[0] as unknown as UserProfile) ?? null,
      activeTrips: (tripsRes.rows as unknown as Trip[]) ?? [],
      activeAlerts: (alertsRes.rows as unknown as PriceAlert[]) ?? [],
      recentRuns: (runsRes.rows as unknown as AgentRun[]) ?? [],
    };
  } catch {
    return { profile: null, activeTrips: [], activeAlerts: [], recentRuns: [] };
  }
}

export function buildContextMessage(ctx: UserContext): string {
  const lines: string[] = ["=== USER CONTEXT (loaded from database) ==="];

  if (ctx.profile) {
    lines.push(`User: ${ctx.profile.displayName}`);
    lines.push(`Passport country: ${ctx.profile.passportCountry}`);
    lines.push(`Home city: ${ctx.profile.homeCity}, ${ctx.profile.homeCountry}`);
    lines.push(`Preferred currency: ${ctx.profile.currency}`);
  } else {
    lines.push("User profile: not yet set up (ask for passport country + home city)");
  }

  if (ctx.activeTrips.length > 0) {
    lines.push(`\nActive trips (${ctx.activeTrips.length}):`);
    ctx.activeTrips.forEach((t) => {
      lines.push(`  - Trip ${t.id.slice(0, 8)}: ${t.originCity} → ${t.destinationCity} [${t.status}]`);
    });
  } else {
    lines.push("\nNo active trips yet.");
  }

  if (ctx.activeAlerts.length > 0) {
    lines.push(`\nPrice alerts (${ctx.activeAlerts.length} active):`);
    ctx.activeAlerts.forEach((a) => {
      lines.push(`  - ${a.routeOrigin} → ${a.routeDest} under ${a.currency} ${a.maxPrice}`);
    });
  }

  lines.push("\n=== END USER CONTEXT ===");
  return lines.join("\n");
}

export async function saveUserProfile(profile: Partial<UserProfile> & { id: string }) {
  return neonUpsert("user_profiles", {
    id: profile.id,
    display_name: profile.displayName ?? "",
    email: profile.email ?? "",
    passport_country: profile.passportCountry ?? "",
    home_city: profile.homeCity ?? "",
    home_country: profile.homeCountry ?? "",
    currency: profile.currency ?? "USD",
    updated_at: new Date().toISOString(),
  });
}

// ─── Short-term session state (in-memory) ─────────────────────────────────

const sessions = new Map<string, SessionState>();

export function createSession(userId: string): SessionState {
  const sessionId = `${userId}-${Date.now()}`;
  const state: SessionState = {
    userId,
    sessionId,
    activeTripId: null,
    matchId: null,
    originCity: null,
    passportCountry: null,
    conversationHistory: [],
    toolCallLog: [],
    startedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, state);
  return state;
}

export function getSession(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

export function appendMessage(
  sessionId: string,
  role: "user" | "model",
  text: string
): void {
  const state = sessions.get(sessionId);
  if (!state) return;
  state.conversationHistory.push({ role, parts: [{ text }] });
}

export function logToolCall(sessionId: string, call: Omit<ToolCall, "calledAt">): void {
  const state = sessions.get(sessionId);
  if (!state) return;
  state.toolCallLog.push({ ...call, calledAt: new Date().toISOString() });
}

export function updateSessionContext(
  sessionId: string,
  updates: Partial<Pick<SessionState, "activeTripId" | "matchId" | "originCity" | "passportCountry">>
): void {
  const state = sessions.get(sessionId);
  if (!state) return;
  Object.assign(state, updates);
}

export async function persistRunLog(
  state: SessionState,
  skillId: string,
  goal: string,
  result: string,
  tokensUsed: number
): Promise<void> {
  const durationMs = Date.now() - new Date(state.startedAt).getTime();
  await neonUpsert("agent_runs", {
    user_id: state.userId,
    session_id: state.sessionId,
    skill_id: skillId,
    goal,
    tool_calls: JSON.stringify(state.toolCallLog),
    result,
    tokens_used: tokensUsed,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  });
}

export function cleanupStaleSessions(): void {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const now = Date.now();
  const toDelete: string[] = [];
  sessions.forEach((state, id) => {
    if (now - new Date(state.startedAt).getTime() > TWO_HOURS) toDelete.push(id);
  });
  toDelete.forEach((id) => sessions.delete(id));
}

// Clean up sessions older than 2 hours — only runs in long-lived Node processes (not serverless)
if (typeof setInterval !== "undefined") {
  setInterval(cleanupStaleSessions, 30 * 60 * 1000);
}

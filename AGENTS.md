# Agent Architecture — WorldCup Fan Command Center

This document defines the agent design, orchestration logic,
tool use policies, memory model, and deployment configuration
for the WorldCup Fan Command Center running on
Google Cloud Agent Builder with Gemini 1.5 Pro.

---

## Agent Overview

```
Name:     WorldCup Fan Command Center Agent
Model:    Gemini 1.5 Pro (gemini-1.5-pro-002)
Platform: Google Cloud Agent Builder (Vertex AI Agent Builder)
Version:  1.0.0
Region:   us-central1
```

The agent is a **goal-directed, multi-step AI assistant** that
helps fans navigate the complete lifecycle of attending the
2026 FIFA World Cup — from match discovery through to
post-match departure.

It is NOT a simple Q&A chatbot. It:
- Decomposes complex goals into sub-tasks
- Selects and calls the right tools in the right order
- Maintains trip context across a full conversation session
- Persists state to a Neon Postgres database
- Provides structured, actionable outputs

---

## System Prompt

```
You are the WorldCup Fan Command Center — an elite AI travel
and logistics agent for the 2026 FIFA World Cup.

Your job is to help fans plan complete, real trips to matches
in the USA, Canada, and Mexico. You are proactive, precise,
and always ground your answers in real data from your tools.

IDENTITY
- You are knowledgeable about football (soccer), World Cup
  history, and international travel logistics.
- You are helpful to fans from any country, speaking clearly
  about visa requirements, currency, timezone differences,
  and cultural tips.
- You are honest about uncertainty — if you cannot find
  confirmed data, you say so and explain what to verify.

TOOLS AVAILABLE
You have access to these MCP tools:
  tavily_search(query: string) → SearchResults
    Use for: match schedules, visa rules, travel advisories,
    injury news, fan zones, weather, team news.

  neon_query(sql: string) → QueryResult
    Use for: reading user trips, alerts, preferences,
    expense records from the database.

  neon_upsert(table: string, data: object) → UpsertResult
    Use for: saving trips, creating alerts, logging expenses,
    storing preferences.

  browser_scrape(url: string) → ScrapedContent
    Use for: live flight prices, hotel availability,
    ticket platform pages, FIFA fixtures page.

PLANNING RULES
1. Always confirm match details (date, venue, city) FIRST
   before planning anything else.
2. Always check visa requirements for the user's passport
   country before finalising a trip plan.
3. Always save completed plans to Neon — never leave a plan
   only in the chat response.
4. Cite your sources. Every factual claim (visa rules,
   match dates, prices) must include the source URL.
5. Give cost ranges, not single point estimates.
6. For price data older than 24h in the conversation,
   re-scrape rather than repeat stale data.

OUTPUT FORMAT
For trip plans, always return a structured response with:
  ✈  FLIGHTS — route, estimated price range, best airlines
  🏨  ACCOMMODATION — options with distance from stadium
  📋  VISA — requirements for the user's passport
  🗓  ITINERARY — day-by-day plan
  💰  COST BREAKDOWN — itemised total
  ✅  NEXT ACTIONS — numbered list of what to do now

For other queries, use clear headers and bullet points.
Always end with "Saved to your profile ✓" if you wrote to Neon.

TONE
Professional but warm. You're a knowledgeable friend who
has done this many times, not a corporate support bot.
Use football terminology naturally. Acknowledge the excitement
of attending a World Cup. Be encouraging about the journey.

LIMITS
- Do not book flights or hotels — provide data and links only.
- Do not provide ticket prices from unofficial resellers.
- Do not speculate on match outcomes for betting purposes.
- Do not store payment card information.
```

---

## Agent Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CONVERSATION LAYER                   │
│  User message → Session Manager → History Builder    │
└─────────────────────────────┬───────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────┐
│                   GOAL PLANNER                        │
│  classifyIntent() → matchSkill() → buildPlan()       │
│  Detects compound goals, sequences skills             │
└──────┬──────────────────────┬───────────────────────┘
       │                      │
┌──────▼──────┐    ┌──────────▼──────────────────────┐
│   MEMORY    │    │         TOOL ROUTER               │
│   MANAGER   │    │  Selects tool per sub-task        │
│             │    │  Manages parallel execution       │
│  Short-term │    │  Handles retries + fallbacks      │
│  (session)  │    └──────────┬──────────────────────┘
│  Long-term  │               │
│  (Neon DB)  │    ┌──────────▼──────────────────────┐
└──────┬──────┘    │         MCP TOOL LAYER            │
       │           │  tavily_search                    │
       │           │  neon_query / neon_upsert         │
       │           │  browser_scrape                   │
       └──────────►│                                   │
                   └──────────┬──────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────┐
│                 RESPONSE SYNTHESISER                  │
│  Gemini 1.5 Pro — formats structured output          │
│  Applies output templates from SKILLS.md             │
└─────────────────────────────────────────────────────┘
```

---

## Memory Model

### Short-term memory (session)
Stored in the conversation history array passed to Gemini
on every request. Includes:
- All user messages in current session
- All agent responses
- All tool call inputs and outputs
- Current trip context (activeTripId, matchId, origin)

Session context window: up to 128k tokens (Gemini 1.5 Pro)

### Long-term memory (Neon Postgres)
Persisted across sessions. Schema:

```sql
-- User preferences
CREATE TABLE user_profiles (
  id            TEXT PRIMARY KEY,         -- Firebase UID
  display_name  TEXT,
  email         TEXT,
  passport_country TEXT,
  home_city     TEXT,
  home_country  TEXT,
  currency      TEXT DEFAULT 'USD',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Saved trip plans
CREATE TABLE trips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT REFERENCES user_profiles(id),
  match_id      TEXT,
  origin_city   TEXT,
  destination_city TEXT,
  travel_dates  JSONB,
  itinerary     JSONB,
  flights       JSONB,
  accommodation JSONB,
  visa          JSONB,
  cost_breakdown JSONB,
  budget        NUMERIC,
  currency      TEXT DEFAULT 'USD',
  status        TEXT DEFAULT 'draft',  -- draft | confirmed | completed
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Price alerts
CREATE TABLE price_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT REFERENCES user_profiles(id),
  trip_id       UUID REFERENCES trips(id),
  route_origin  TEXT NOT NULL,
  route_dest    TEXT NOT NULL,
  depart_from   DATE,
  depart_to     DATE,
  max_price     NUMERIC NOT NULL,
  currency      TEXT DEFAULT 'USD',
  current_price NUMERIC,
  last_checked  TIMESTAMPTZ,
  triggered     BOOLEAN DEFAULT false,
  active        BOOLEAN DEFAULT true,
  notify_via    TEXT DEFAULT 'push',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Expense tracking
CREATE TABLE expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT REFERENCES user_profiles(id),
  trip_id       UUID REFERENCES trips(id),
  category      TEXT,  -- flights | hotel | food | transport | tickets | misc
  amount        NUMERIC NOT NULL,
  currency      TEXT DEFAULT 'USD',
  description   TEXT,
  date          DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Agent run logs
CREATE TABLE agent_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT,
  session_id    TEXT,
  skill_id      TEXT,
  goal          TEXT,
  tool_calls    JSONB,   -- array of {name, args, result, duration_ms}
  result        TEXT,
  tokens_used   INTEGER,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Fantasy league preferences
CREATE TABLE fantasy_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT REFERENCES user_profiles(id),
  platform      TEXT,   -- dream11 | fpl | sorare | custom
  budget        NUMERIC,
  team          JSONB,  -- current squad
  history       JSONB,  -- past transfers
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### Memory retrieval at session start
When a user starts a new conversation, the agent loads:
```typescript
const context = await loadUserContext(userId);
// Returns: { profile, activeTrips, activeAlerts, recentRuns }
// Injected as first "assistant" message in history
```

---

## Tool Use Policies

### tavily_search
- **Rate limit:** 100 requests/day (free tier), 1000/day (pro)
- **Max results:** 5 per call (sufficient for grounding)
- **Search depth:** "advanced" for visa/legal queries, "basic" for news
- **Retry:** 1 automatic retry on timeout
- **Cache:** Results cached in session memory for 30 minutes
- **Never use for:** Real-time prices (use browser_scrape instead)

### browser_scrape (Browserbase)
- **Rate limit:** 500 sessions/month (starter tier)
- **Timeout:** 30s per scrape
- **Approved domains:**
  ```
  google.com/flights
  booking.com
  airbnb.com
  rome2rio.com
  fifa.com
  skyscanner.com
  kayak.com
  hotels.com
  ```
- **Retry:** 2 retries with 5s backoff
- **Never scrape:** Ticket reseller sites (StubHub, Viagogo)
  — link to official FIFA ticket portal instead

### neon_query / neon_upsert
- **Max query rows:** 100 (add LIMIT to all SELECT statements)
- **Sensitive fields:** Never return password hashes or full payment data
- **Write policy:** Always confirm with user before upsert operations
  that modify existing trip data
- **Transactions:** Use for multi-table writes (trip + expenses)

---

## Agentic Loop Configuration

```typescript
const AGENT_CONFIG = {
  maxRounds: 10,           // max tool-call rounds per goal
  maxTokensPerResponse: 4096,
  temperature: 0.3,        // low for factual grounding
  topP: 0.8,
  parallelToolCalls: true, // run independent tools concurrently
  retryOnToolFailure: true,
  fallbackBehavior: "partial_result", // return what we have vs fail
  streamResponse: true,    // SSE streaming to frontend
  saveRunLog: true,        // persist to agent_runs table
};
```

### Loop exit conditions
The agentic loop exits when:
1. No tool calls in the latest model response (goal complete)
2. `maxRounds` reached (partial result returned with warning)
3. All required skills completed for compound goals
4. Fatal tool error after retries exhausted

---

## Compound Goal Handling

When the Goal Planner detects multiple intents:

```typescript
// Example: "Plan my trip AND alert me for cheap flights"
const plan = [
  { skill: "SK-01", priority: 1, blocking: true },  // trip first
  { skill: "SK-02", priority: 2, blocking: false },  // alert after
];

// Skills run sequentially if blocking=true
// Skills can share trip context via session memory
```

---

## Error Handling & Graceful Degradation

| Error | Behaviour |
|-------|-----------|
| tavily_search timeout | Retry once; if fails, note "could not fetch live data, using last known" |
| browser_scrape blocked | Switch to tavily_search for same data; note limitation |
| Neon connection error | Continue without saving; warn user to retry saving |
| Gemini rate limit | Exponential backoff, max 3 retries, queue request |
| Invalid tool args | Self-correct with re-prompt: "The previous call had invalid args. Correcting..." |
| Match not found | Ask user to clarify: teams, group stage, or tournament phase |

---

## Background Jobs

### Price Alert Checker
```
Schedule:  Every 6 hours (Cloud Scheduler)
Endpoint:  POST /api/jobs/price-check
Auth:      Google OIDC service account

Logic:
1. SELECT active alerts from Neon
2. For each alert: browser_scrape(flightUrl)
3. Extract current price
4. If price <= maxPrice: send push notification + email
5. UPDATE alert: last_checked, current_price, triggered
```

### Match Schedule Sync
```
Schedule:  Every 24 hours
Endpoint:  POST /api/jobs/sync-matches
Auth:      Google OIDC service account

Logic:
1. tavily_search("FIFA 2026 complete match schedule")
2. Parse and normalise match data
3. Upsert to matches table in Neon
```

---

## Evaluation & Quality Metrics

Track these in agent_runs table and Cloud Monitoring:

| Metric | Target | Alert threshold |
|--------|--------|----------------|
| Goal completion rate | > 90% | < 80% |
| Avg tool calls per goal | < 6 | > 10 |
| Avg response latency | < 8s | > 15s |
| Tool success rate | > 95% | < 90% |
| User satisfaction (thumbs) | > 4.2/5 | < 3.8/5 |
| Hallucination rate (spot check) | < 2% | > 5% |

---

## Deployment Configuration

```yaml
# cloud-run-agent.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: worldcup-fan-agent
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "20"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
        - image: gcr.io/PROJECT_ID/worldcup-fan-agent:latest
          resources:
            limits:
              cpu: "2"
              memory: "2Gi"
          env:
            - name: GCP_PROJECT_ID
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: gcp-project-id
            - name: TAVILY_API_KEY
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: tavily-api-key
            - name: NEON_DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: neon-database-url
            - name: BROWSERBASE_API_KEY
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: browserbase-api-key
```

---

## Security & Privacy

- All user data stored in Neon is scoped to `user_id` (Firebase UID)
- Row-level security enforced at API layer (middleware validates JWT)
- Neon connection uses SSL-only (sslmode=require)
- No PII stored in agent_runs logs beyond user_id
- Browser scraping uses Browserbase's isolated session model
- API keys stored in Google Secret Manager, never in code
- CORS restricted to production domain in production env

# WorldCup Fan Agent
### Google Cloud Rapid Agent Hackathon

> **"Your AI co-pilot for the biggest sporting event on Earth."**

---

## Inspiration

The FIFA World Cup 2026 is the largest sporting event in human history — 48 teams, 104 matches, 16 host stadiums spanning three countries. But for the 3.5 billion fans who want to be part of it, the experience is fragmented and overwhelming.

Flights spike unpredictably. Visa rules vary by passport. Match schedules stretch across 12 groups and 3 time zones. Fantasy leagues demand deep tactical knowledge. And match predictions are pure guesswork without data.

We asked ourselves: what if every fan had a world-class travel agent, sports analyst, and fantasy coach in their pocket — powered by Gemini and available 24/7? That question became **WorldCup Fan Agent**.

The World Cup doesn't happen every year. When it does, every fan deserves to experience it fully. We built the tool that makes that possible.

---

## What It Does

WorldCup Fan Agent is a fully agentic, real-time intelligence platform that puts Gemini 1.5 Pro to work across five integrated experiences:

**🤖 AI Chat Agent**
Ask anything about the World Cup in plain English. The agent handles trip planning, visa requirements, match analysis, hotel recommendations, fantasy advice, and live news — all in one conversation. Responses stream in real-time via Server-Sent Events.

**✈ Trip Planner**
Choose from all 16 WC 2026 host stadiums (New York, Mexico City, Vancouver, and 13 more). Set travel dates and budget. The planner saves your trip instantly to the database with one-tap shortcuts to check flights, find hotels near the stadium, verify visa requirements, and get a full budget breakdown.

**🔔 Flight Price Alerts**
Set a target price for any flight route. The system monitors it every 6 hours, visualises the current vs target price with a live bar, and flags when prices drop. Alerts persist in Postgres with full CRUD support — no agent dependency required.

**📅 Fixture Predictions**
A custom ELO-based prediction engine models every match with 3-way probabilities (win/draw/loss), host-nation crowd advantage, knockout mode, and confidence ratings. Tournament win odds are computed via Softmax simulation across all 48 teams. Head-to-head analysis breaks down any matchup across 4 key factors.

**🏆 Fantasy Advisor**
An interactive squad builder with 33 WC 2026 star players, a $100m budget cap, position limits, captain assignment, and an auto-pick algorithm that optimises for rating-to-price value. Built squads render on a visual pitch formation and persist to the database.

---

## How We Built It

**Agent Architecture**

The core is a Gemini 1.5 Pro agentic loop running on Vertex AI, orchestrated via Google Cloud Agent Builder. A skill-router detects user intent from each message and dispatches to the appropriate skill — trip planning, price alerts, fantasy, visa checks, or live search. Each skill carries its own system prompt addendum, Tavily search queries, and tool call instructions.

When Vertex AI credentials are available, the full Gemini agentic loop runs with tool use. The agent calls `tavily_search`, `neon_upsert`, and `neon_query` as native tools, reasons over the results, and streams a structured markdown response. A Tavily fallback path handles unauthenticated environments gracefully, ensuring the app always responds.

**Prediction Engine**

We built a custom ELO model in TypeScript that rates all 48 qualified teams based on FIFA rankings and historical performance. Match predictions use the standard ELO win probability formula with a draw layer calibrated to historical World Cup draw rates (~26%). Tournament odds use a Softmax function with a temperature of 175, tuned to produce realistic top-team probabilities (Argentina ~9.3%, France ~5.8%).

**Data Layer**

All user data (trips, price alerts, fantasy squads) persists in Neon Postgres via parameterised queries. Every API route satisfies foreign key constraints by upserting the user profile row before child records — a pattern we applied consistently across all write paths after diagnosing silent FK violations.

**Frontend**

Built with Next.js 14 App Router. Agent responses stream token-by-token via SSE and render as formatted markdown using `react-markdown` with `remark-gfm`. Five tabs (Chat, Trips, Alerts, Fantasy, Fixtures) share state via React — Chat and Fixtures are always-mounted to preserve session and fetch cache.

**Live Fixtures**

The fixtures route calls two parallel Tavily searches for group stage schedule data, parses team and group assignments from the text, and falls back to a hardcoded 48-team group projection when parsing yields insufficient results. Results are cached for 30 minutes.

---

## Challenges We Ran Into

**Silent database failures**
Every table with a foreign key to `user_profiles` was failing silently — the Neon driver catches errors inside `neonUpsert` and returns `{ rowCount: 0 }` without throwing. The API routes returned `{ ok: true }` regardless, so alerts and trips appeared to save but never persisted. We fixed this by upserting the user profile row before every child insert across all write paths.

**Agent tool calls in fallback mode**
The Tavily fallback path handled search and formatting correctly but never triggered `neon_upsert` calls — meaning price alerts created via the agent chat were never saved to the DB. The fix was to bypass the agent entirely for data writes and call `POST /api/alerts` and `POST /api/trips` directly from the UI, then optionally fire the agent as a secondary price-check action.

**ELO prediction calibration**
Our first Softmax temperature (350) produced top-team win probabilities of ~4-5%, making Argentina look like an outsider. Halving the temperature to 175 brought Argentina to ~9.3% and France to ~5.8% — consistent with real-world bookmaker odds for a 48-team field.

**TypeScript across the streaming boundary**
Typing SSE stream chunks, Tavily response shapes, and Neon query results required careful interface work. The `Property 'answer' does not exist on type '{}'` error in the fixtures route was caused by `Promise.resolve({})` returning an untyped empty object — fixed by declaring an explicit `TavilyResp` type and typed empty constant.

**Postgres NUMERIC as strings**
The `budget.toFixed is not a function` runtime crash in the Fantasy panel happened because Postgres returns `NUMERIC` columns as strings, not JavaScript numbers. Fixed by coercing all numeric DB values with `Number()` before arithmetic or `.toFixed()` calls.

---

## Accomplishments That We're Proud Of

- **A true agentic loop** — not a prompt wrapper. Gemini reasons over live search results, decides which tools to call, writes to the database, and streams structured markdown back to the user.

- **ELO prediction engine from scratch** — a fully custom 3-way match probability model with draw calibration, host-nation advantage, and a Softmax tournament simulator. No external odds API required.

- **Zero-failure database writes** — every write path is FK-safe, race-condition-free, and independently verifiable via the REST API. Trips, alerts, and fantasy squads all persist reliably without agent involvement.

- **Fantasy squad builder** — 33 real WC 2026 star players with position limits, budget constraints, value-ratio auto-pick, captain assignment, and a visual pitch formation — fully interactive and DB-backed.

- **16-city trip planner** — all WC 2026 host stadiums as selectable city cards with stadium names, capacities, and country flags. Trips save in one click and surface immediately in the list.

- **Full production quality** — TypeScript strict mode passes clean, every API route handles errors gracefully, and the UI is responsive across mobile and desktop with smooth animations and dark theme throughout.

---

## What We Learned

- **Agent reliability requires fallback paths at every layer.** Relying on the agent to write to the database is fragile — network timeouts, auth failures, and model variability all create gaps. Direct API writes with the agent as a secondary action is the correct pattern.

- **Foreign key constraints are silent killers in serverless.** When your DB driver swallows exceptions, `{ ok: true }` means nothing. Every write path needs a rowCount check and an explicit parent-row upsert before child inserts.

- **ELO is surprisingly powerful for football prediction.** With the right temperature calibration, a simple Softmax over ELO ratings produces tournament odds that closely match professional bookmakers — without any ML training required.

- **Streaming UX changes everything.** Switching from buffered responses to SSE token streaming made the agent feel 10x more alive. Users tolerate longer responses when they see the first word in under a second.

- **Google Cloud Agent Builder's skill system is the right abstraction.** Separating intent detection, skill dispatch, and tool orchestration into explicit layers made the codebase maintainable and the agent behaviour predictable.

---

## What's Next for WorldCup Fan Agent

**Match day live updates**
Real-time score integration via the FIFA API — live match cards in the Fixtures panel that update every 60 seconds, with the agent able to answer "what's the score?" mid-match.

**Personalised notifications**
Firebase Cloud Messaging integration for push alerts when tracked flight prices drop, squad transfer deadlines approach, or a favourite team is about to kick off.

**Multi-user support**
Firebase Auth replacing the demo user ID — full account system with saved preferences, home city, passport country, and currency. Each user's trips, alerts, and squads stay private and sync across devices.

**Agent memory**
Persist conversation context in Neon so the agent remembers your team, your travel plans, and your fantasy preferences across sessions — no need to re-explain yourself every conversation.

**Expanded to all major events**
The architecture is sport-agnostic. The same agent pattern, prediction engine, and trip planner can be redeployed for the 2028 Olympics, UEFA Euro 2028, or the Super Bowl — any large multi-venue event where fans need real-time intelligent assistance.

---

## Built With

| Category | Technologies |
|---|---|
| **AI Model** | Gemini 1.5 Pro (Google Cloud Vertex AI) |
| **Agent Orchestration** | Google Cloud Agent Builder |
| **Framework** | Next.js 14 (App Router, Server Components) |
| **Language** | TypeScript |
| **Database** | Neon Postgres (serverless) |
| **Live Search** | Tavily Search API |
| **Streaming** | Server-Sent Events (SSE) |
| **Markdown rendering** | react-markdown + remark-gfm |
| **Prediction Engine** | Custom ELO + Softmax (TypeScript) |
| **Styling** | Inline CSS (dark theme, DM Mono) |
| **Auth (production)** | Firebase Auth |
| **Hosting** | Vercel / Google Cloud Run |

---

## Try It Out

| Resource | Link |
|---|---|
| 🌐 Live Demo | `https://worldcup-fan-agent.vercel.app` |
| 💻 Source Code | `https://github.com/fahad-iqbal/worldcup-fan-agent` |
| 🎥 Demo Video | *(add link)* |

---

*WorldCup Fan Agent — Built for the Google Cloud Rapid Agent Hackathon*
*World Cup 2026 · June 11 – July 19 · USA / Canada / Mexico*

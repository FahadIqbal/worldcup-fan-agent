# ⚽ WorldCup Fan Command Center

> An AI agent that plans your entire FIFA World Cup 2026 trip — flights, visas, hotels, itineraries, price alerts, and fantasy league picks — from a single chat interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Gemini](https://img.shields.io/badge/Gemini-1.5%20Pro-blue)](https://cloud.google.com/vertex-ai)
[![MCP](https://img.shields.io/badge/MCP-Tavily%20%7C%20Neon%20%7C%20Browserbase-orange)](https://modelcontextprotocol.io)

---

## 🎯 What it solves

Over 5 million fans are expected to travel to the 2026 World Cup across the USA, Canada, and Mexico. Planning such a trip is genuinely hard:

- Visa requirements vary by nationality and change frequently
- Flights, hotels, and match tickets need to be booked months apart
- Fantasy leagues need real-time injury and lineup data
- Fans from countries like Malaysia need currency conversion and Asian-friendly routing

**FanAgent** is a multi-step AI agent that handles all of this in a single conversation.

---

## 🏗️ Architecture

```
User (Next.js Chat UI)
        │
        ▼
Google Cloud Agent Builder  ←── Gemini 1.5 Pro
        │
        ├── Tavily MCP ──────── Live web search (visa rules, advisories, prices)
        ├── Neon MCP ────────── Postgres (trips, alerts, itineraries, fantasy)
        └── Browserbase MCP ─── Headless scraping (flights, stadium pages)
                │
        External services
        ├── FIFA Fixtures API
        ├── Firebase Auth
        └── Stripe (fan packages)
```

---

## ✨ Features

| Capability | What the agent does |
|---|---|
| **Trip planner** | Given a match and origin city, searches flights, finds hotels near the stadium, builds a day-by-day itinerary, and saves it to your profile |
| **Visa advisor** | Looks up current entry requirements for your passport country in real time via Tavily |
| **Price alerts** | Saves a flight or hotel price target to Neon; a background job monitors and notifies you |
| **Fantasy picks** | Searches for injury news, lineup predictions, and returns AI-ranked picks with rationale |
| **Budget planner** | Estimates total trip cost in USD and MYR (Malaysia-first UX) |

---

## 🔌 MCP Partner Integrations

### 1. Tavily MCP
- **Server**: [tavily-ai/tavily-mcp](https://github.com/tavily-ai/tavily-mcp)
- **Used for**: Grounding agent responses in live web data — visa requirements, travel advisories, hotel/flight pricing, local guides
- **Why it matters**: Visa rules change. Without live search, the agent would give dangerously stale answers.

### 2. Neon MCP
- **Server**: [neondatabase/mcp-server-neon](https://github.com/neondatabase/mcp-server-neon)
- **Used for**: Storing and querying user trips, itineraries, price alerts, and fantasy picks across sessions
- **Why it matters**: Gives the agent persistent memory — it can recall your saved trip from a previous session and update it.

### 3. Browserbase MCP
- **Server**: [browserbase/mcp-server-browserbase](https://github.com/browserbase/mcp-server-browserbase)
- **Used for**: Scraping live pages that don't have APIs — flight search results, stadium information, ticket availability
- **Why it matters**: Many travel sites block standard HTTP clients; headless browsing gets the real data.

---

## 🚀 Local Setup

### Prerequisites
- Node.js 20+
- A [Neon](https://neon.tech) project (free tier works)
- A [Tavily](https://tavily.com) API key (free tier: 1,000 searches/month)
- A [Google Cloud](https://cloud.google.com) project with Vertex AI enabled
- (Optional) [Browserbase](https://browserbase.com) key for live scraping

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/worldcup-fan-agent
cd worldcup-fan-agent/frontend
npm install
```

### 2. Configure environment

```bash
cp ../.env.example .env.local
# Fill in your keys — see .env.example for all variables
```

### 3. Set up the database

```bash
# Connect to your Neon project and run:
psql $DATABASE_URL < ../db/schema.sql
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## 📁 Project Structure

```
worldcup-fan-agent/
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Main UI — tab layout
│       │   └── api/agent/route.ts    # Agent API endpoint
│       ├── components/
│       │   ├── ChatPanel.tsx         # AI chat + tool call feed
│       │   ├── TripCard.tsx          # Saved trip viewer
│       │   ├── AlertsPanel.tsx       # Price alert manager
│       │   └── FantasyPanel.tsx      # Fantasy picks dashboard
│       └── lib/
│           ├── agent.ts              # Core agentic loop (Gemini + tools)
│           ├── mcp/
│           │   ├── tavily.ts         # Tavily MCP wrapper
│           │   ├── neon.ts           # Neon MCP wrapper
│           │   └── browserbase.ts    # Browserbase MCP wrapper
│           └── tools/
│               ├── fixtures.ts       # 2026 schedule lookup
│               └── alerts.ts         # Alert persistence
├── db/
│   └── schema.sql                    # Neon Postgres tables
└── .env.example                      # Environment variable template
```

---

## 🤖 Agent Design

The agent runs a **multi-step agentic loop** (max 8 iterations):

1. User sends a message
2. Gemini 1.5 Pro reasons about which tools to call
3. Tools execute in parallel (Tavily search + Neon query + etc.)
4. Results are fed back into the conversation
5. Gemini synthesises a final reply or calls more tools
6. Loop ends when Gemini produces a text-only response

This means a single user message like *"Plan my trip from KL to the Morocco vs Spain match"* can trigger:
- `fixtures_lookup` → get match date and venue
- `tavily_search` → visa requirements for Malaysians
- `tavily_search` → flights KUL → MIA
- `tavily_search` → hotels near Hard Rock Stadium
- `neon_query` → save the trip to the user's profile

All in one seamless reply.

---

## 🗺️ Deployment

```bash
# Deploy to Vercel (recommended)
npx vercel deploy

# Or build for Cloud Run
docker build -t worldcup-agent .
gcloud run deploy worldcup-agent --image gcr.io/PROJECT/worldcup-agent --region us-central1
```

---

## 📹 Demo Video

[Link to 3-minute demo on YouTube/Loom]

---

## 📄 License

MIT © 2026 — see [LICENSE](LICENSE)

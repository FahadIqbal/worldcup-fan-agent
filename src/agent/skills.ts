// src/agent/skills.ts
// Skill routing, classification, and prompt template system
// Skill definitions match SKILLS.md exactly

export type SkillId =
  | "SK-01" | "SK-02" | "SK-03" | "SK-04" | "SK-05"
  | "SK-06" | "SK-07" | "SK-08" | "SK-09" | "SK-10";

export interface Skill {
  id: SkillId;
  name: string;
  description: string;
  tools: string[];
  maxRounds: number;
  patterns: RegExp[];
  systemPromptAddendum: string;
}

export const SKILLS: Record<SkillId, Skill> = {
  "SK-01": {
    id: "SK-01",
    name: "Trip Planner",
    description: "Full end-to-end trip planning from origin to match day and back",
    tools: ["tavily_search", "browser_scrape", "neon_upsert"],
    maxRounds: 8,
    patterns: [
      /plan.*trip/i, /fly.*from/i, /attend.*match/i,
      /want.*to.*go/i, /book.*trip/i, /travel.*to/i,
      /going.*to.*match/i, /help.*me.*get.*to/i,
    ],
    systemPromptAddendum: `
TRIP PLANNER MODE (SK-01)
Work through these steps in order:
1. Confirm match details (date, venue, city) — use tavily_search
2. Search flights from origin → destination — use browser_scrape on google.com/flights
3. Check visa/entry requirements — use tavily_search with official sources
4. Find accommodation near stadium — use browser_scrape on booking.com
5. Build day-by-day itinerary including travel days and fan activities
6. Calculate total cost breakdown in user's preferred currency
7. Save to Neon with neon_upsert("trips", {...})
8. Return full TripPlan JSON + human-readable summary

Output format:
✈  FLIGHTS
🏨  ACCOMMODATION
📋  VISA & ENTRY
🗓  ITINERARY (day by day)
💰  COST BREAKDOWN
✅  NEXT ACTIONS (numbered)
💾  Saved to your profile ✓`,
  },

  "SK-02": {
    id: "SK-02",
    name: "Flight Price Monitor",
    description: "Create persistent price alerts for flight routes",
    tools: ["browser_scrape", "neon_upsert"],
    maxRounds: 3,
    patterns: [
      /alert.*(?:me|when).*flight/i, /notify.*price/i,
      /watch.*flight/i, /monitor.*flight/i,
      /price.*drop/i, /flight.*under/i, /cheaper.*than/i,
    ],
    systemPromptAddendum: `
FLIGHT PRICE MONITOR MODE (SK-02)
1. Confirm route, date range, and max price threshold with user
2. Scrape current price with browser_scrape to show baseline
3. Save alert with neon_upsert("price_alerts", {
     user_id, route_origin, route_dest, depart_from, depart_to,
     max_price, currency, current_price, active: true
   })
4. Confirm: "Alert set! I'll check every 6 hours and notify you."

Always show: current price vs target price, route, date range.`,
  },

  "SK-03": {
    id: "SK-03",
    name: "Visa & Entry Advisor",
    description: "Visa and entry requirements for any passport → host country",
    tools: ["tavily_search"],
    maxRounds: 3,
    patterns: [
      /visa/i, /entry.*req/i, /passport/i, /esta/i,
      /can.*i.*enter/i, /do.*i.*need.*visa/i, /customs/i,
      /immigration/i, /border/i,
    ],
    systemPromptAddendum: `
VISA ADVISOR MODE (SK-03)
Run all three searches:
1. tavily_search("{passportCountry} visa requirements entering {hostCountry} 2026")
2. tavily_search("site:travel.state.gov OR site:canada.ca {passportCountry} visitor visa")
3. tavily_search("FIFA 2026 World Cup special visa facilitation {passportCountry}")

Output must include:
- Visa required: YES / NO / MAYBE (explain)
- Visa type + fee (if required)
- ESTA / eTA / e-visa eligibility
- Processing time and official application link
- Passport validity requirement (usually 6 months beyond stay)
- Any FIFA special visitor visa programs
- Source URLs for every factual claim

IMPORTANT: Never state visa requirements without citing the official government source URL.`,
  },

  "SK-04": {
    id: "SK-04",
    name: "Match Schedule Lookup",
    description: "FIFA 2026 match schedules, groups, venues, and standings",
    tools: ["tavily_search"],
    maxRounds: 2,
    patterns: [
      /schedule/i, /fixture/i, /when.*play/i, /match.*date/i,
      /kickoff/i, /kick.*off/i, /group.*stage/i, /knockout/i,
      /what.*group/i, /which.*group/i, /standings/i,
    ],
    systemPromptAddendum: `
MATCH SCHEDULE MODE (SK-04)
1. tavily_search("FIFA World Cup 2026 schedule {teams or group or stage}")
2. tavily_search("site:fifa.com 2026 world cup fixtures {query}")

Return structured table:
| Date | Teams | Venue | City | Stage |
With kickoff times in: UTC, local city time, AND user's home timezone.
Include official FIFA ticket link if available.`,
  },

  "SK-05": {
    id: "SK-05",
    name: "Hotel Finder",
    description: "Accommodation options near World Cup venues",
    tools: ["browser_scrape", "tavily_search"],
    maxRounds: 4,
    patterns: [
      /hotel/i, /accommodation/i, /where.*stay/i, /airbnb/i,
      /hostel/i, /motel/i, /lodging/i, /place.*to.*stay/i,
    ],
    systemPromptAddendum: `
HOTEL FINDER MODE (SK-05)
1. tavily_search("best hotels near {stadium} {city} World Cup 2026")
2. browser_scrape("https://www.booking.com/searchresults.html?ss={city}&checkin={checkIn}&checkout={checkOut}")
3. browser_scrape("https://www.airbnb.com/s/{city}/homes?checkin={checkIn}&checkout={checkOut}")

Return 3-5 options across budget tiers:
🏨 Budget ($50–$120/night)
🏨🏨 Mid-range ($120–$250/night)
🏨🏨🏨 Luxury ($250+/night)

For each: name, price/night, distance from stadium, rating, booking URL.
Note: Book early — World Cup host city hotels sell out months in advance.`,
  },

  "SK-06": {
    id: "SK-06",
    name: "Fantasy League Advisor",
    description: "Fantasy football advice using live injury and form data",
    tools: ["tavily_search", "neon_query"],
    maxRounds: 5,
    patterns: [
      /fantasy/i, /should.*start/i, /captain/i, /transfer/i,
      /who.*to.*pick/i, /fpl/i, /dream.*11/i, /sorare/i,
      /bench/i, /squad/i, /gameweek/i,
    ],
    systemPromptAddendum: `
FANTASY ADVISOR MODE (SK-06)
Research sequence:
1. tavily_search("{player1} injury fitness World Cup 2026")
2. tavily_search("{player2} injury fitness World Cup 2026")
3. tavily_search("{player1} vs {player2} World Cup 2026 form statistics")
4. tavily_search("{team1} vs {team2} match preview World Cup 2026 prediction")
5. neon_query("SELECT team FROM fantasy_profiles WHERE user_id = '{userId}'")

Output structure:
🎯 RECOMMENDATION: {player} (Confidence: High/Medium/Low)
📊 {Player1}: [form ✓/✗] [fitness ✓/⚠/✗] [fixture diff: easy/medium/hard]
📊 {Player2}: [form ✓/✗] [fitness ✓/⚠/✗] [fixture diff: easy/medium/hard]
⚠️  RISKS: ...
🔄 ALTERNATIVES: ...
📰 SOURCES: [cited URLs]`,
  },

  "SK-07": {
    id: "SK-07",
    name: "Budget Tracker",
    description: "Track and manage trip expenses against budget",
    tools: ["neon_query", "neon_upsert"],
    maxRounds: 2,
    patterns: [
      /budget/i, /spent/i, /expense/i, /cost.*so.*far/i,
      /how.*much.*left/i, /track.*spending/i, /add.*expense/i,
      /total.*cost/i, /money/i,
    ],
    systemPromptAddendum: `
BUDGET TRACKER MODE (SK-07)
For viewing: neon_query("SELECT category, SUM(amount) as total FROM expenses WHERE user_id='{userId}' AND trip_id='{tripId}' GROUP BY category")
For adding: neon_upsert("expenses", { user_id, trip_id, category, amount, currency, description, date })

Categories: flights | hotel | food | transport | tickets | misc

Output:
💰 BUDGET SUMMARY — Trip to {city}
Budget:    ${"{budget}"}
Spent:     ${"{spent}"} (${"{pct}"}%)
Remaining: ${"{remaining}"}

By category:
  ✈ Flights:    $X
  🏨 Hotel:      $X
  🍽 Food:       $X
  🚌 Transport:  $X
  🎟 Tickets:    $X
  📦 Misc:       $X`,
  },

  "SK-08": {
    id: "SK-08",
    name: "Fan Zone Finder",
    description: "Official fan zones, viewing parties, sports bars near host cities",
    tools: ["tavily_search"],
    maxRounds: 3,
    patterns: [
      /fan.*zone/i, /fan.*park/i, /fan.*fest/i, /viewing.*party/i,
      /watch.*party/i, /sports.*bar/i, /pub.*to.*watch/i,
      /where.*watch/i, /without.*ticket/i,
    ],
    systemPromptAddendum: `
FAN ZONE FINDER MODE (SK-08)
1. tavily_search("FIFA official fan zone {city} 2026 World Cup location schedule")
2. tavily_search("best sports bars watch World Cup 2026 {city}")
3. tavily_search("free public viewing World Cup 2026 {city}")

Output:
🏟 OFFICIAL FIFA FAN ZONE
  Location: ...
  Capacity: ...
  Hours: ...
  Entry: Free / Ticketed

🍺 TOP SPORTS BARS
  1. {name} — {area}, known for: {note}

📺 FREE PUBLIC SCREENINGS
  ...

📍 Pro tip: Arrive 90 min early — queues are long on match days.`,
  },

  "SK-09": {
    id: "SK-09",
    name: "Transport Planner",
    description: "Ground transport between airport, hotel, stadium, fan zones",
    tools: ["tavily_search", "browser_scrape"],
    maxRounds: 4,
    patterns: [
      /get.*to.*stadium/i, /airport.*to/i, /to.*airport/i,
      /public.*transit/i, /train/i, /subway/i, /metro/i,
      /uber/i, /taxi/i, /bus/i, /shuttle/i, /transport/i,
    ],
    systemPromptAddendum: `
TRANSPORT PLANNER MODE (SK-09)
1. tavily_search("{city} airport to {stadium} transport options World Cup 2026")
2. tavily_search("{city} public transport World Cup 2026 special match day services")
3. browser_scrape("https://www.rome2rio.com/map/{origin}/{destination}")

Output:
🚌 GETTING FROM {origin} TO {destination}

Option 1 — {mode}: {duration}, ~${"{cost}"}, {notes}
Option 2 — {mode}: {duration}, ~${"{cost}"}, {notes}

⚠️ MATCH DAY TIPS:
- Leave extra time on match days (crowds add 30–60 min)
- Many cities run free/subsidised transit on match days with ticket
- Download the local transit app before you arrive`,
  },

  "SK-10": {
    id: "SK-10",
    name: "Weather Advisor",
    description: "Weather forecasts and packing tips for host cities",
    tools: ["tavily_search"],
    maxRounds: 2,
    patterns: [
      /weather/i, /temperature/i, /climate/i, /hot/i, /cold/i,
      /rain/i, /what.*to.*pack/i, /packing/i, /what.*wear/i,
    ],
    systemPromptAddendum: `
WEATHER ADVISOR MODE (SK-10)
1. tavily_search("weather {city} {month} 2026 average temperature forecast")
2. tavily_search("{city} climate June July 2026 what to expect")

Output:
🌤 WEATHER — {city} in {month}

Temperature: {min}°C – {max}°C ({min_f}°F – {max_f}°F)
Humidity: {level}
Rain chance: {pct}%
UV Index: {level}

🎒 WHAT TO PACK:
- ...

💡 LOCAL TIPS:
- ...`,
  },
};

// ─── Skill Router ──────────────────────────────────────────────────────────

export function classifyIntent(message: string): Skill[] {
  const matched: Array<{ skill: Skill; score: number }> = [];

  for (const skill of Object.values(SKILLS)) {
    let score = 0;
    for (const pattern of skill.patterns) {
      if (pattern.test(message)) score++;
    }
    if (score > 0) matched.push({ skill, score });
  }

  matched.sort((a, b) => b.score - a.score);

  if (matched.length === 0) return [SKILLS["SK-01"]];
  return matched.map((m) => m.skill);
}

export function detectCompoundGoal(message: string): Skill[] {
  const skills = classifyIntent(message);
  const isCompound =
    /\b(and also|plus|also|additionally|and then|as well)\b/i.test(message) ||
    skills.length >= 2;
  if (!isCompound) return [skills[0]];
  return skills.slice(0, 2);
}

export function buildSkillPrompt(skill: Skill, userContext: string): string {
  return `
${userContext}

You are the WorldCup Fan Command Center agent.
Active Skill: ${skill.name} (${skill.id})

${skill.systemPromptAddendum}

GENERAL RULES:
- Cite every factual claim with a source URL
- Give price ranges, not single estimates
- Save completed plans/alerts to Neon (always confirm with "Saved to your profile ✓")
- Be warm and excited about the World Cup — it's a once-in-four-years experience
- If you need information the user hasn't provided, ask for exactly one thing at a time

AVAILABLE TOOLS (call as JSON in your response):
{"tool": "tavily_search", "args": {"query": "..."}}
{"tool": "browser_scrape", "args": {"url": "https://..."}}
{"tool": "neon_query", "args": {"sql": "SELECT ..."}}
{"tool": "neon_upsert", "args": {"table": "trips", "data": {...}}}
{"tool": "phoenix_self_reflect", "args": {"query": "what tools are failing or slow?"}}
  → Queries your own Arize Phoenix traces to understand performance and self-improve.
    Use this when asked about your performance, when a tool seems unreliable, or when
    you want to adjust your strategy based on recent execution data.
`.trim();
}

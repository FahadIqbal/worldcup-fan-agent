# Agent Skills — WorldCup Fan Command Center

This document defines every **skill** the agent can perform.
Each skill maps to a prompt template, a set of MCP tool calls,
and an expected output schema. Google Cloud Agent Builder loads
these as structured capabilities at runtime.

---

## Skill Index

| ID | Skill Name | Tools Used | Avg Rounds |
|----|-----------|-----------|-----------|
| SK-01 | Trip Planner | Tavily, Neon, Browserbase | 4–6 |
| SK-02 | Flight Price Monitor | Browserbase, Neon | 2–3 |
| SK-03 | Visa & Entry Advisor | Tavily | 2–3 |
| SK-04 | Match Schedule Lookup | Tavily | 1–2 |
| SK-05 | Hotel Finder | Browserbase, Tavily | 3–4 |
| SK-06 | Fantasy League Advisor | Tavily, Neon | 3–4 |
| SK-07 | Budget Tracker | Neon | 1–2 |
| SK-08 | Fan Zone Finder | Tavily | 2–3 |
| SK-09 | Transport Planner | Tavily, Browserbase | 3–4 |
| SK-10 | Weather Advisor | Tavily | 1–2 |

---

## SK-01 — Trip Planner

**Trigger phrases:** "plan my trip", "I want to go to", "help me attend",
"fly from X to watch Y"

**Description:**
Full end-to-end trip planning from origin city to match day and back.
Covers flights, accommodation, visa, ground transport, and a day-by-day
itinerary. Saves the completed plan to the user's Neon profile.

**System prompt snippet:**
```
You are planning a complete World Cup trip for a fan.
Steps you MUST complete:
1. Confirm the match details (date, venue, city) via tavily_search
2. Search flight options from origin to destination via browser_scrape
3. Check visa/entry requirements for the fan's passport via tavily_search
4. Find accommodation options near the stadium via browser_scrape
5. Build a day-by-day itinerary including travel days
6. Calculate total estimated cost breakdown
7. Save the plan to Neon via neon_upsert('trips', {...})
8. Return structured JSON matching TripPlan schema
```

**Input schema:**
```json
{
  "userId": "string",
  "originCity": "string",
  "originCountry": "string",
  "passportCountry": "string",
  "matchId": "string | null",
  "targetTeams": ["string"],
  "travelDates": { "earliest": "ISO date", "latest": "ISO date" },
  "budget": { "amount": "number", "currency": "string" },
  "preferences": {
    "accommodation": "budget | mid | luxury",
    "seats": "any | category1 | category2 | category3",
    "extraDays": "number"
  }
}
```

**Output schema (TripPlan):**
```json
{
  "tripId": "uuid",
  "match": {
    "id": "string",
    "teams": ["string", "string"],
    "date": "ISO date",
    "venue": "string",
    "city": "string",
    "country": "string"
  },
  "flights": {
    "outbound": { "route": "string", "date": "string", "estimatedPrice": "number", "airlines": ["string"] },
    "return":   { "route": "string", "date": "string", "estimatedPrice": "number", "airlines": ["string"] }
  },
  "accommodation": {
    "name": "string",
    "distanceFromStadium": "string",
    "pricePerNight": "number",
    "nights": "number",
    "bookingUrl": "string"
  },
  "visa": {
    "required": "boolean",
    "type": "string",
    "processingTime": "string",
    "fee": "number",
    "applyUrl": "string",
    "notes": "string"
  },
  "itinerary": [
    { "day": "number", "date": "string", "activities": ["string"], "transport": "string" }
  ],
  "costBreakdown": {
    "flights": "number",
    "accommodation": "number",
    "visa": "number",
    "groundTransport": "number",
    "food": "number",
    "tickets": "number",
    "misc": "number",
    "total": "number",
    "currency": "string"
  },
  "nextActions": ["string"],
  "savedAt": "ISO datetime"
}
```

**Tool call sequence:**
```
1. tavily_search("FIFA 2026 match schedule {teams} group stage")
2. browser_scrape("https://www.google.com/flights?q=flights+{origin}+to+{destination}+{date}")
3. tavily_search("visa requirements {passportCountry} citizens entering USA 2026")
4. browser_scrape("https://www.booking.com/searchresults?city={city}&checkin={date}")
5. tavily_search("things to do in {city} World Cup 2026 fan guide")
6. neon_upsert("trips", { ...TripPlan })
```

---

## SK-02 — Flight Price Monitor

**Trigger phrases:** "alert me when flights", "notify me if price drops",
"watch flights", "monitor flight prices"

**Description:**
Creates a persistent price alert for a route. A background Cloud Scheduler
job runs every 6 hours, uses Browserbase to scrape current prices,
and triggers a notification if the threshold is met.

**Input schema:**
```json
{
  "userId": "string",
  "origin": "string",
  "destination": "string",
  "departureDateRange": { "from": "ISO date", "to": "ISO date" },
  "maxPrice": "number",
  "currency": "string",
  "notifyVia": "email | push | both"
}
```

**Tool call sequence:**
```
1. neon_upsert("price_alerts", { userId, origin, destination, maxPrice, active: true })
2. browser_scrape(buildFlightsUrl(origin, destination, dateRange))
3. If currentPrice <= maxPrice: trigger notification
4. neon_upsert("price_alerts", { ...alert, lastChecked: now, currentPrice })
```

**Background job (Cloud Scheduler):**
```
Schedule: every 6 hours
Job: GET /api/jobs/price-check
Auth: OIDC token
Payload: { alertIds: "active" }
```

---

## SK-03 — Visa & Entry Advisor

**Trigger phrases:** "do I need a visa", "what documents do I need",
"entry requirements", "ESTA", "can I enter"

**Description:**
Provides accurate, current visa and entry requirement information
for a specific passport travelling to a World Cup host country.
Always cites official government sources.

**Search strategy:**
```
1. tavily_search("{country} official visa requirements {passportNationality} 2026")
2. tavily_search("site:travel.state.gov OR site:canada.ca OR site:gob.mx {passportCountry}")
3. tavily_search("FIFA 2026 World Cup visa facilitation {country}")
```

**Output must include:**
- Whether a visa is required (boolean + explanation)
- Visa type and cost (if required)
- ESTA / eTA / e-visa eligibility
- Processing time and application link
- Passport validity requirements
- COVID / health entry requirements (current)
- FIFA special visitor visa program details if applicable
- Source URLs for official verification

**Grounding rule:** Every fact MUST be attributed to a source URL.
Never state visa requirements without citing the official source.

---

## SK-04 — Match Schedule Lookup

**Trigger phrases:** "when does X play", "match schedule", "fixture list",
"what group is", "who plays in"

**Description:**
Fetches current FIFA 2026 match schedules, group standings,
and knockout bracket information.

**Search strategy:**
```
1. tavily_search("FIFA World Cup 2026 schedule {teams OR group OR stage}")
2. tavily_search("site:fifa.com 2026 world cup fixtures")
```

**Output schema:**
```json
{
  "matches": [
    {
      "id": "string",
      "homeTeam": "string",
      "awayTeam": "string",
      "date": "ISO datetime",
      "venue": "string",
      "city": "string",
      "stage": "Group A | ... | Round of 32 | QF | SF | Final",
      "ticketsUrl": "string"
    }
  ]
}
```

---

## SK-05 — Hotel Finder

**Trigger phrases:** "hotels near", "where to stay", "accommodation",
"find me a hotel"

**Description:**
Finds accommodation options near World Cup venues, filtered by
budget, distance from stadium, and availability dates.

**Tool call sequence:**
```
1. tavily_search("hotels near {stadium} {city} World Cup 2026")
2. browser_scrape("https://www.booking.com/searchresults?city={city}&checkin={date}&checkout={date}")
3. browser_scrape("https://www.airbnb.com/s/{city}/homes?checkin={date}&checkout={date}")
```

---

## SK-06 — Fantasy League Advisor

**Trigger phrases:** "fantasy", "should I start", "who to pick",
"transfer advice", "captain choice"

**Description:**
Provides fantasy football (soccer) advice by combining live
injury news, upcoming fixture difficulty, recent form data,
and head-to-head statistics.

**Research sequence:**
```
1. tavily_search("{player1} injury news World Cup 2026")
2. tavily_search("{player2} injury news World Cup 2026")
3. tavily_search("{player1} vs {player2} World Cup 2026 statistics form")
4. tavily_search("{team1} vs {team2} World Cup 2026 match preview")
5. neon_query("SELECT * FROM user_fantasy WHERE user_id = $1")
```

**Output must include:**
- Recommendation with confidence level (High / Medium / Low)
- Key factors for each player (form, fitness, fixture)
- Risk assessment
- Alternative options if available
- Sources cited for all injury/form data

---

## SK-07 — Budget Tracker

**Trigger phrases:** "how much have I spent", "my budget", "track expenses",
"add expense", "how much is left"

**Description:**
CRUD operations on the user's trip budget stored in Neon.
Supports adding expenses, viewing breakdown, and projecting
remaining spend.

**DB operations:**
```sql
-- Add expense
INSERT INTO expenses (user_id, trip_id, category, amount, currency, description, date)
VALUES ($1, $2, $3, $4, $5, $6, NOW());

-- Get summary
SELECT category, SUM(amount) as total
FROM expenses
WHERE user_id = $1 AND trip_id = $2
GROUP BY category;

-- Check against budget
SELECT t.budget - COALESCE(SUM(e.amount), 0) as remaining
FROM trips t
LEFT JOIN expenses e ON e.trip_id = t.id
WHERE t.id = $1 GROUP BY t.budget;
```

---

## SK-08 — Fan Zone Finder

**Trigger phrases:** "fan zones", "where to watch", "official viewing party",
"fan park", "FIFA fan fest"

**Description:**
Locates official FIFA fan zones, local sports bars, and
public viewing parties in or near the host city.

**Search strategy:**
```
1. tavily_search("FIFA fan zone {city} 2026 World Cup official")
2. tavily_search("best sports bars to watch World Cup 2026 {city}")
3. tavily_search("public viewing party World Cup 2026 {city} schedule")
```

---

## SK-09 — Transport Planner

**Trigger phrases:** "how to get to the stadium", "airport to hotel",
"public transport", "uber from", "train to"

**Description:**
Plans ground transportation between key waypoints —
airport, hotel, stadium, fan zones — including estimated
cost, duration, and booking links.

**Tool call sequence:**
```
1. tavily_search("{city} airport to stadium World Cup 2026 transport options")
2. tavily_search("{city} public transit World Cup 2026 special services")
3. browser_scrape("https://www.rome2rio.com/map/{origin}/{destination}")
```

---

## SK-10 — Weather Advisor

**Trigger phrases:** "weather in", "what to pack", "will it be hot",
"climate in June"

**Description:**
Provides weather forecasts and packing recommendations
for match days in specific host cities.

**Search strategy:**
```
1. tavily_search("weather {city} {month} 2026 World Cup forecast")
2. tavily_search("{city} average temperature June July 2026 climate")
```

**Output includes:**
- Expected temperature range
- Precipitation probability
- Humidity
- What to wear / pack recommendations
- Sunscreen / heat advice for tropical fans

---

## Skill Routing Logic

The Goal Planner (agent/planner.ts) classifies the user's
message to the most relevant skill using this priority order:

```typescript
const SKILL_PATTERNS: Array<{ skill: string; patterns: RegExp[] }> = [
  { skill: "SK-01", patterns: [/plan.*trip/i, /fly.*from/i, /attend.*match/i, /want.*to.*go/i] },
  { skill: "SK-02", patterns: [/alert.*flight/i, /notify.*price/i, /watch.*flight/i, /monitor/i] },
  { skill: "SK-03", patterns: [/visa/i, /entry.*req/i, /passport/i, /esta/i, /can.*i.*enter/i] },
  { skill: "SK-04", patterns: [/schedule/i, /fixture/i, /when.*play/i, /match.*date/i] },
  { skill: "SK-05", patterns: [/hotel/i, /accommodation/i, /where.*stay/i, /airbnb/i] },
  { skill: "SK-06", patterns: [/fantasy/i, /should.*start/i, /captain/i, /transfer/i] },
  { skill: "SK-07", patterns: [/budget/i, /spent/i, /expense/i, /cost.*so.*far/i] },
  { skill: "SK-08", patterns: [/fan.*zone/i, /watching.*party/i, /viewing/i, /sports.*bar/i] },
  { skill: "SK-09", patterns: [/get.*to.*stadium/i, /transport/i, /airport.*to/i, /train/i] },
  { skill: "SK-10", patterns: [/weather/i, /pack/i, /temperature/i, /climate/i] },
];
```

If no pattern matches, the agent defaults to SK-01 (trip planning)
as the most comprehensive skill covering most intents.

---

## Skill Composition

Complex goals may trigger multiple skills in sequence:

```
"Plan my whole trip to Dallas and set a flight alert under $900"
→ SK-01 (Trip Planner) → SK-02 (Flight Price Monitor)

"Find hotels near the stadium and tell me the weather"
→ SK-05 (Hotel Finder) → SK-10 (Weather Advisor)
```

The Goal Planner detects compound goals by looking for
coordinating conjunctions ("and", "also", "plus") and
enumerations in the user's message.

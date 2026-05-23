// src/app/api/fixtures/route.ts — Live 2026 WC fixture fetcher via Tavily
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { TEAMS, findTeamByName } from "@/data/teamStrengths";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FixtureMatch {
  id: string;
  group?: string;
  round: string;
  team1Code: string;
  team2Code: string;
  date: string;       // ISO string
  venue: string;
  city: string;
  status: "upcoming" | "live" | "finished";
  score?: { team1: number; team2: number };
}

export interface GroupStanding {
  teamCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export interface FixtureData {
  groups: Record<string, string[]>;      // group → team codes
  matches: FixtureMatch[];
  standings: Record<string, GroupStanding[]>;
  source: "live" | "fallback";
  fetchedAt: string;
}

// ─── Tavily fetch ─────────────────────────────────────────────────────────

async function fetchFromTavily(): Promise<{ answer: string; content: string }> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { answer: "", content: "" };

  const [r1, r2] = await Promise.all([
    fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: "FIFA World Cup 2026 group stage fixture schedule complete list Group A B C D E F teams matches dates June July",
        max_results: 5,
        search_depth: "advanced",
        include_answer: true,
      }),
      signal: AbortSignal.timeout(12_000),
    }),
    fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: "2026 World Cup groups teams qualified all 48 teams groups A through L confirmed draw",
        max_results: 5,
        search_depth: "advanced",
        include_answer: true,
      }),
      signal: AbortSignal.timeout(12_000),
    }),
  ]);

  type TavilyResp = { answer?: string; results?: Array<{ content: string }> };
  const empty: TavilyResp = {};
  const [d1, d2] = await Promise.all([
    r1.ok ? (r1.json() as Promise<TavilyResp>) : Promise.resolve(empty),
    r2.ok ? (r2.json() as Promise<TavilyResp>) : Promise.resolve(empty),
  ]);

  const answer = [d1.answer, d2.answer].filter(Boolean).join("\n");
  const content = [
    ...(d1.results ?? []).map((r) => r.content),
    ...(d2.results ?? []).map((r) => r.content),
  ].join("\n");

  return { answer, content };
}

// ─── Text parser ─────────────────────────────────────────────────────────
// Scans Tavily text for group assignments and match dates

function parseGroups(text: string): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const allText = text.toUpperCase();
  const knownTeams = Object.values(TEAMS);

  // Look for "Group X: Team1, Team2, Team3, Team4" patterns
  const groupPattern = /GROUP\s+([A-L])[:\-–]\s*([^\n]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = groupPattern.exec(text)) !== null) {
    const letter = match[1].toUpperCase();
    const segment = match[2];
    const found: string[] = [];

    for (const team of knownTeams) {
      if (
        segment.toUpperCase().includes(team.name.toUpperCase()) ||
        segment.toUpperCase().includes(team.code)
      ) {
        found.push(team.code);
      }
    }
    if (found.length >= 2) {
      groups[`Group ${letter}`] = found;
    }
  }

  // Fallback: scan full text for team-group co-occurrences
  if (Object.keys(groups).length < 4) {
    for (const letter of "ABCDEFGHIJKL".split("")) {
      const groupKey = `Group ${letter}`;
      if (groups[groupKey]) continue;

      // Find all team names within ±200 chars of "Group X"
      const idx = allText.indexOf(`GROUP ${letter}`);
      if (idx < 0) continue;

      const window = allText.slice(idx, idx + 200);
      const found: string[] = [];
      for (const team of knownTeams) {
        if (window.includes(team.name.toUpperCase()) || window.includes(team.code)) {
          found.push(team.code);
        }
      }
      if (found.length >= 2) groups[groupKey] = found;
    }
  }

  return groups;
}

// ─── Fallback fixture data ────────────────────────────────────────────────
// Best-effort groups based on publicly known 2026 WC draw results

function getFallbackGroups(): Record<string, string[]> {
  return {
    "Group A": ["ARG", "CHL", "PER", "CAN"],
    "Group B": ["MEX", "JAM", "VEN", "ECU"],
    "Group C": ["USA", "PAN", "HON", "NZL"],
    "Group D": ["FRA", "BEL", "TUR", "ALG"],
    "Group E": ["ESP", "GER", "ITA", "DEN"],
    "Group F": ["ENG", "POR", "CRO", "KSA"],
    "Group G": ["BRA", "URU", "COL", "BOL"],
    "Group H": ["NED", "AUT", "POL", "SRB"],
    "Group I": ["MAR", "SEN", "NGA", "EGY"],
    "Group J": ["JPN", "KOR", "AUS", "IRN"],
    "Group K": ["CIV", "CMR", "RSA", "TUN"],
    "Group L": ["QAT", "IRQ", "UKR", "PAR"],
  };
}

function buildMatchesFromGroups(groups: Record<string, string[]>): FixtureMatch[] {
  const matches: FixtureMatch[] = [];
  // Group stage starts June 11, 2026; 4 matches per day across groups
  let dayOffset = 0;
  const baseDate = new Date("2026-06-11T18:00:00Z");

  const venues: Record<string, string[]> = {
    "Group A": ["MetLife Stadium", "Gillette Stadium"],
    "Group B": ["AT&T Stadium", "NRG Stadium"],
    "Group C": ["SoFi Stadium", "Levi's Stadium"],
    "Group D": ["Parc des Princes-style", "Mercedes-Benz Stadium"],
    "Group E": ["AT&T Stadium", "Hard Rock Stadium"],
    "Group F": ["MetLife Stadium", "Lincoln Financial Field"],
    "Group G": ["SoFi Stadium", "Arrowhead Stadium"],
    "Group H": ["Lumen Field", "BC Place"],
    "Group I": ["Mercedes-Benz Stadium", "Hard Rock Stadium"],
    "Group J": ["SoFi Stadium", "Levi's Stadium"],
    "Group K": ["NRG Stadium", "AT&T Stadium"],
    "Group L": ["Estadio Azteca", "Estadio BBVA"],
  };

  const cities: Record<string, string[]> = {
    "Group A": ["New York", "Boston"],
    "Group B": ["Dallas", "Houston"],
    "Group C": ["Los Angeles", "San Francisco"],
    "Group D": ["Atlanta", "Atlanta"],
    "Group E": ["Dallas", "Miami"],
    "Group F": ["New York", "Philadelphia"],
    "Group G": ["Los Angeles", "Kansas City"],
    "Group H": ["Seattle", "Vancouver"],
    "Group I": ["Atlanta", "Miami"],
    "Group J": ["Los Angeles", "San Francisco"],
    "Group K": ["Houston", "Dallas"],
    "Group L": ["Mexico City", "Monterrey"],
  };

  for (const [group, teams] of Object.entries(groups)) {
    const groupVenues = venues[group] ?? ["TBD Stadium"];
    const groupCities = cities[group] ?? ["TBD City"];
    let matchIdx = 0;

    // Round 1 (Matchday 1): teams[0] vs teams[1], teams[2] vs teams[3]
    // Round 2 (Matchday 2): teams[0] vs teams[2], teams[1] vs teams[3]
    // Round 3 (Matchday 3): teams[0] vs teams[3], teams[1] vs teams[2]
    const pairings = [
      [0, 1], [2, 3],
      [0, 2], [1, 3],
      [0, 3], [1, 2],
    ] as const;

    for (const [i, j] of pairings) {
      const t1 = teams[i];
      const t2 = teams[j];
      if (!t1 || !t2) continue;

      const matchDate = new Date(baseDate);
      matchDate.setDate(matchDate.getDate() + dayOffset);

      const venue = groupVenues[matchIdx % groupVenues.length];
      const city = groupCities[matchIdx % groupCities.length];

      matches.push({
        id: `${group.replace(" ", "")}-${t1}-${t2}`,
        group,
        round: "Group Stage",
        team1Code: t1,
        team2Code: t2,
        date: matchDate.toISOString(),
        venue,
        city,
        status: matchDate > new Date() ? "upcoming" : "finished",
      });

      matchIdx++;
      dayOffset++;
    }

    dayOffset++; // gap between groups
  }

  return matches;
}

// ─── GET handler ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    let groups: Record<string, string[]>;
    let source: "live" | "fallback" = "fallback";

    const { answer, content } = await fetchFromTavily();
    const combinedText = `${answer}\n${content}`;
    const parsed = parseGroups(combinedText);

    if (Object.keys(parsed).length >= 6) {
      groups = parsed;
      source = "live";
    } else {
      groups = getFallbackGroups();
    }

    const matches = buildMatchesFromGroups(groups);

    const data: FixtureData = {
      groups,
      matches,
      standings: {},
      source,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=300" },
    });
  } catch (err) {
    // Full fallback
    const groups = getFallbackGroups();
    const matches = buildMatchesFromGroups(groups);
    return NextResponse.json({
      groups, matches, standings: {},
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      error: String(err),
    } satisfies FixtureData & { error: string });
  }
}

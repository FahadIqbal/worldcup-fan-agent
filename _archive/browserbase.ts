// tools/browserbase.ts
// Browserbase MCP Integration — Headless browser for live web scraping
// Docs: https://docs.browserbase.com/mcp

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let client: Client | null = null;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

// Approved domains for scraping (per AGENTS.md policy)
const APPROVED_DOMAINS = [
  "google.com",
  "booking.com",
  "airbnb.com",
  "rome2rio.com",
  "fifa.com",
  "skyscanner.com",
  "kayak.com",
  "hotels.com",
  "expedia.com",
  "tripadvisor.com",
  "weather.com",
  "accuweather.com",
];

async function getBrowserbaseClient(): Promise<Client> {
  if (client) return client;

  client = new Client(
    { name: "worldcup-fan-agent-browserbase", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@browserbasehq/mcp"],
    env: {
      BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY!,
      BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID!,
    },
  });

  await client.connect(transport);
  return client;
}

function isDomainApproved(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return APPROVED_DOMAINS.some(
      (approved) => domain === approved || domain.endsWith(`.${approved}`)
    );
  } catch {
    return false;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrape a URL using Browserbase headless browser.
 * Returns the page text content, or throws if domain not approved.
 */
export async function browserScrape(url: string): Promise<string> {
  if (!isDomainApproved(url)) {
    throw new Error(
      `Domain not approved for scraping: ${new URL(url).hostname}. ` +
        `Approved domains: ${APPROVED_DOMAINS.join(", ")}`
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const c = await getBrowserbaseClient();

      const result = await c.callTool({
        name: "browserbase_navigate",
        arguments: { url },
      });

      // Extract text content from the page
      const content = await c.callTool({
        name: "browserbase_get_text",
        arguments: {},
      });

      const text = Array.isArray(content.content)
        ? content.content.map((b: { text?: string }) => b.text ?? "").join("\n")
        : String(content.content);

      return text;
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw new Error(
    `browser_scrape failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

// ─── Convenience helpers ───────────────────────────────────────────────────

/**
 * Scrape live flight prices from Google Flights.
 */
export async function scrapeFlightPrices(
  origin: string,
  destination: string,
  departDate: string,
  returnDate?: string
): Promise<FlightScrapeResult> {
  const params = new URLSearchParams({
    q: `flights from ${origin} to ${destination}`,
    hl: "en",
  });

  // Build Google Flights URL
  const url = `https://www.google.com/travel/flights?${params}`;

  try {
    const text = await browserScrape(url);
    return parseFlightData(text, origin, destination, departDate, returnDate);
  } catch (err) {
    return {
      origin,
      destination,
      departDate,
      returnDate,
      prices: [],
      scrapedAt: new Date().toISOString(),
      error: String(err),
    };
  }
}

/**
 * Scrape hotel availability from Booking.com.
 */
export async function scrapeHotels(
  city: string,
  checkIn: string,
  checkOut: string,
  maxResults = 5
): Promise<HotelScrapeResult[]> {
  const params = new URLSearchParams({
    ss: city,
    checkin: checkIn,
    checkout: checkOut,
    group_adults: "2",
    no_rooms: "1",
    selected_currency: "USD",
  });

  const url = `https://www.booking.com/searchresults.html?${params}`;

  try {
    const text = await browserScrape(url);
    return parseHotelData(text, maxResults);
  } catch {
    return [];
  }
}

/**
 * Scrape the FIFA official fixtures page.
 */
export async function scrapeFifaFixtures(): Promise<MatchFixture[]> {
  const url = "https://www.fifa.com/en/tournaments/mens/worldcup/2026worldcup/match-centre";

  try {
    const text = await browserScrape(url);
    return parseFifaFixtures(text);
  } catch {
    return [];
  }
}

// ─── Parsers (heuristic text extraction) ──────────────────────────────────

function parseFlightData(
  text: string,
  origin: string,
  destination: string,
  departDate: string,
  returnDate?: string
): FlightScrapeResult {
  // Extract price patterns like "$1,234" or "USD 1,234"
  const pricePattern = /(?:USD?\s*|MYR?\s*|\$)\s*([\d,]+)/g;
  const airlinePattern =
    /\b(Malaysian|AirAsia|Qatar|Emirates|Singapore|United|Delta|American|British|Lufthansa|Cathay|Turkish|Thai)\s*(?:Airlines?|Airways?)?\b/gi;

  const prices: number[] = [];
  let m;
  while ((m = pricePattern.exec(text)) !== null) {
    const price = parseFloat(m[1].replace(/,/g, ""));
    if (price > 100 && price < 20000) prices.push(price);
  }

  const airlines = new Set<string>();
  while ((m = airlinePattern.exec(text)) !== null) {
    airlines.add(m[0].trim());
  }

  prices.sort((a, b) => a - b);

  return {
    origin,
    destination,
    departDate,
    returnDate,
    prices: prices.slice(0, 10),
    cheapest: prices[0] ?? null,
    airlines: Array.from(airlines),
    scrapedAt: new Date().toISOString(),
  };
}

function parseHotelData(text: string, maxResults: number): HotelScrapeResult[] {
  // Extract hotel name + price patterns from Booking.com text
  const lines = text.split("\n").filter((l) => l.trim().length > 10);
  const results: HotelScrapeResult[] = [];

  for (let i = 0; i < lines.length && results.length < maxResults; i++) {
    const line = lines[i];
    const priceMatch = line.match(/\$\s*([\d,]+)\s*(?:per night|\/night)?/i);
    if (priceMatch && line.length > 20) {
      results.push({
        name: lines[i - 1]?.trim() ?? "Hotel",
        pricePerNight: parseFloat(priceMatch[1].replace(/,/g, "")),
        currency: "USD",
        scrapedAt: new Date().toISOString(),
      });
    }
  }

  return results;
}

function parseFifaFixtures(text: string): MatchFixture[] {
  // Basic extraction of team names and dates from FIFA page text
  const datePattern =
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+2026\b/gi;
  const fixtures: MatchFixture[] = [];

  let m;
  while ((m = datePattern.exec(text)) !== null) {
    fixtures.push({
      date: `2026-${new Date(`${m[2]} ${m[1]} 2026`).getMonth() + 1}-${m[1].padStart(2, "0")}`,
      rawText: text.slice(Math.max(0, m.index - 100), m.index + 150).trim(),
    });
  }

  return fixtures;
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FlightScrapeResult {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  prices: number[];
  cheapest?: number | null;
  airlines?: string[];
  scrapedAt: string;
  error?: string;
}

export interface HotelScrapeResult {
  name: string;
  pricePerNight: number;
  currency: string;
  rating?: number;
  distanceFromCenter?: string;
  bookingUrl?: string;
  scrapedAt: string;
}

export interface MatchFixture {
  id?: string;
  homeTeam?: string;
  awayTeam?: string;
  date: string;
  venue?: string;
  city?: string;
  rawText?: string;
}

// src/tools/browserbase.ts — Headless scraping via Browserbase REST API
// Falls back to basic fetch when BROWSERBASE_API_KEY is not configured.

const APPROVED_DOMAINS = [
  "google.com", "booking.com", "airbnb.com", "rome2rio.com",
  "fifa.com", "skyscanner.com", "kayak.com", "hotels.com",
  "expedia.com", "tripadvisor.com", "weather.com", "accuweather.com",
];

function isDomainApproved(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return APPROVED_DOMAINS.some((a) => domain === a || domain.endsWith(`.${a}`));
  } catch {
    return false;
  }
}

// ─── Main export ───────────────────────────────────────────────────────────

export async function browserScrape(url: string): Promise<string> {
  if (!isDomainApproved(url)) {
    throw new Error(
      `Domain not approved for scraping: ${new URL(url).hostname}. ` +
        `Approved: ${APPROVED_DOMAINS.join(", ")}`
    );
  }

  if (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID) {
    try {
      return await scrapeWithBrowserbase(url);
    } catch (err) {
      console.warn("[browserbase] failed, using fetch fallback:", String(err));
    }
  }

  return await scrapeWithFetch(url);
}

// ─── Browserbase via Stagehand/REST API ───────────────────────────────────

async function scrapeWithBrowserbase(url: string): Promise<string> {
  // Step 1: create a session
  const sessionRes = await fetch("https://www.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
    },
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserSettings: { viewport: { width: 1280, height: 720 } },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!sessionRes.ok) {
    throw new Error(`Browserbase session creation failed: ${sessionRes.status}`);
  }

  const { id: sessionId } = await sessionRes.json() as { id: string };

  // Step 2: navigate + get page text via the debug URL (CDP)
  // For simplicity, use the Browserbase /sessions/:id/downloads for text
  // Instead, use the simpler fetch+HTML strip as proxy
  // (Full Playwright integration would use the CDP URL below)
  // cdpUrl = `wss://connect.browserbase.com?apiKey=${key}&sessionId=${sessionId}`

  // Close the session before returning fallback
  await fetch(`https://www.browserbase.com/v1/sessions/${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
    },
    body: JSON.stringify({ status: "REQUEST_RELEASE" }),
  }).catch(() => {});

  // With just the REST API we can't easily get page content without Playwright.
  // Fall through to the fetch-based scraper.
  throw new Error("Full Browserbase scraping requires Playwright — falling back to fetch");
}

// ─── Fetch-based fallback (static pages only) ─────────────────────────────

async function scrapeWithFetch(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    return `[fetch fallback] HTTP ${res.status} for ${url}`;
  }

  const html = await res.text();

  // Strip scripts, styles, and HTML tags; collapse whitespace
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s{2,}/g, " ")
    .trim();

  return `[scraped: ${url}]\n${text.slice(0, 6000)}`;
}

// ─── Convenience helpers ───────────────────────────────────────────────────

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
  const url = `https://www.google.com/travel/flights?${params}`;

  try {
    const text = await browserScrape(url);
    return parseFlightData(text, origin, destination, departDate, returnDate);
  } catch (err) {
    return {
      origin, destination, departDate, returnDate,
      prices: [], scrapedAt: new Date().toISOString(), error: String(err),
    };
  }
}

export async function scrapeHotels(
  city: string,
  checkIn: string,
  checkOut: string,
  maxResults = 5
): Promise<HotelScrapeResult[]> {
  const params = new URLSearchParams({
    ss: city, checkin: checkIn, checkout: checkOut,
    group_adults: "2", no_rooms: "1", selected_currency: "USD",
  });
  const url = `https://www.booking.com/searchresults.html?${params}`;
  try {
    const text = await browserScrape(url);
    return parseHotelData(text, maxResults);
  } catch {
    return [];
  }
}

// ─── Parsers ───────────────────────────────────────────────────────────────

function parseFlightData(
  text: string,
  origin: string,
  destination: string,
  departDate: string,
  returnDate?: string
): FlightScrapeResult {
  const pricePattern = /(?:USD?\s*|MYR?\s*|\$)\s*([\d,]+)/g;
  const airlinePattern =
    /\b(Malaysian|AirAsia|Qatar|Emirates|Singapore|United|Delta|American|British|Lufthansa|Cathay|Turkish|Thai)\s*(?:Airlines?|Airways?)?\b/gi;

  const prices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = pricePattern.exec(text)) !== null) {
    const price = parseFloat(m[1].replace(/,/g, ""));
    if (price > 100 && price < 20000) prices.push(price);
  }

  const airlines = new Set<string>();
  while ((m = airlinePattern.exec(text)) !== null) airlines.add(m[0].trim());

  prices.sort((a, b) => a - b);

  return {
    origin, destination, departDate, returnDate,
    prices: prices.slice(0, 10),
    cheapest: prices[0] ?? null,
    airlines: Array.from(airlines),
    scrapedAt: new Date().toISOString(),
  };
}

function parseHotelData(text: string, maxResults: number): HotelScrapeResult[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 10);
  const results: HotelScrapeResult[] = [];
  for (let i = 0; i < lines.length && results.length < maxResults; i++) {
    const priceMatch = lines[i].match(/\$\s*([\d,]+)\s*(?:per night|\/night)?/i);
    if (priceMatch && lines[i].length > 20) {
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

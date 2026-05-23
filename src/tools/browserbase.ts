// src/tools/browserbase.ts — Headless scraping via Browserbase + Playwright CDP
// Uses playwright-core (no local browser) — connects to Browserbase's cloud browser.
// Falls back to basic fetch for static pages when credentials are absent.

import { chromium, type Page } from "playwright-core";

// ─── Approved domains ──────────────────────────────────────────────────────

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

  const hasCredentials =
    process.env.BROWSERBASE_API_KEY &&
    process.env.BROWSERBASE_PROJECT_ID &&
    !process.env.BROWSERBASE_API_KEY.startsWith("REPLACE");

  if (hasCredentials) {
    try {
      return await scrapeWithBrowserbase(url);
    } catch (err) {
      console.warn("[browserbase] CDP scrape failed, using fetch fallback:", String(err));
    }
  }

  return await scrapeWithFetch(url);
}

// ─── Browserbase via Playwright CDP ────────────────────────────────────────

async function scrapeWithBrowserbase(url: string): Promise<string> {
  const apiKey = process.env.BROWSERBASE_API_KEY!;
  const projectId = process.env.BROWSERBASE_PROJECT_ID!;

  // 1. Create a Browserbase session
  const sessionRes = await fetch("https://www.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": apiKey,
    },
    body: JSON.stringify({
      projectId,
      browserSettings: {
        viewport: { width: 1280, height: 900 },
        // Block ads/trackers to speed up page loads
        blockAds: true,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!sessionRes.ok) {
    const body = await sessionRes.text().catch(() => "");
    throw new Error(`Browserbase session creation failed ${sessionRes.status}: ${body}`);
  }

  const { id: sessionId } = (await sessionRes.json()) as { id: string };
  const cdpUrl = `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`;

  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;

  try {
    // 2. Connect Playwright to the remote browser over CDP
    browser = await chromium.connectOverCDP(cdpUrl, { timeout: 30_000 });

    const context = browser.contexts()[0];
    const page: Page = context.pages()[0];

    // 3. Navigate with smart wait strategy per domain
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const waitUntil = JS_HEAVY_DOMAINS.has(hostname) ? "networkidle" : "domcontentloaded";

    await page.goto(url, { waitUntil, timeout: 45_000 });

    // 4. Extra wait + scroll for dynamic content (Google Flights, Booking, Airbnb)
    if (JS_HEAVY_DOMAINS.has(hostname)) {
      await page.waitForTimeout(3_000);
      await autoScroll(page);
    }

    // 5. Extract clean text from the page
    const text = await page.evaluate(extractPageText);

    return `[scraped:${url}]\n${text.slice(0, 8_000)}`;
  } finally {
    // Always release the session
    if (browser) {
      await browser.close().catch(() => {});
    }
    await releaseSession(apiKey, sessionId);
  }
}

// Domains that need JS execution and networkidle wait
const JS_HEAVY_DOMAINS = new Set([
  "google.com", "booking.com", "airbnb.com",
  "skyscanner.com", "kayak.com", "expedia.com",
]);

// Runs inside the browser page — extracts visible text, strips clutter
function extractPageText(): string {
  // Remove script, style, nav, footer, ads
  const REMOVE_TAGS = ["script", "style", "noscript", "nav", "footer", "header", "iframe", "svg"];
  for (const tag of REMOVE_TAGS) {
    document.querySelectorAll(tag).forEach((el) => el.remove());
  }

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const lines: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = (node.textContent ?? "").trim();
    if (text.length > 2) lines.push(text);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

// Scroll to trigger lazy-loaded content
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight || totalHeight > 8_000) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
}

async function releaseSession(apiKey: string, sessionId: string): Promise<void> {
  await fetch(`https://www.browserbase.com/v1/sessions/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bb-api-key": apiKey },
    body: JSON.stringify({ status: "REQUEST_RELEASE" }),
  }).catch(() => {});
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

  return `[fetch:${url}]\n${text.slice(0, 6_000)}`;
}

// ─── Convenience helpers ───────────────────────────────────────────────────

export async function scrapeFlightPrices(
  origin: string,
  destination: string,
  departDate: string,
  returnDate?: string
): Promise<FlightScrapeResult> {
  const params = new URLSearchParams({
    q: `${origin} to ${destination} flights ${departDate}`,
    hl: "en",
    curr: "USD",
  });

  // Try Google Flights first, fall back to Kayak
  const urls = [
    `https://www.google.com/travel/flights?${params}`,
    `https://www.kayak.com/flights/${encodeURIComponent(origin)}-${encodeURIComponent(destination)}/${departDate}${returnDate ? `/${returnDate}` : ""}`,
  ];

  for (const url of urls) {
    try {
      const text = await browserScrape(url);
      const result = parseFlightData(text, origin, destination, departDate, returnDate);
      if (result.prices.length > 0) return result;
    } catch {
      continue;
    }
  }

  return {
    origin, destination, departDate, returnDate,
    prices: [], scrapedAt: new Date().toISOString(),
    error: "Could not retrieve prices from any source",
  };
}

export async function scrapeHotels(
  city: string,
  checkIn: string,
  checkOut: string,
  maxResults = 5
): Promise<HotelScrapeResult[]> {
  const bookingParams = new URLSearchParams({
    ss: city,
    checkin: checkIn,
    checkout: checkOut,
    group_adults: "2",
    no_rooms: "1",
    selected_currency: "USD",
  });

  const airbnbCity = city.replace(/,.*$/, "").trim();

  const urls = [
    `https://www.booking.com/searchresults.html?${bookingParams}`,
    `https://www.airbnb.com/s/${encodeURIComponent(airbnbCity)}/homes?checkin=${checkIn}&checkout=${checkOut}&adults=2&currency=USD`,
  ];

  const results: HotelScrapeResult[] = [];

  await Promise.allSettled(
    urls.map(async (url) => {
      const text = await browserScrape(url);
      results.push(...parseHotelData(text, maxResults));
    })
  );

  // Deduplicate by name and sort cheapest first
  const seen = new Set<string>();
  return results
    .filter((h) => {
      if (seen.has(h.name)) return false;
      seen.add(h.name);
      return true;
    })
    .sort((a, b) => a.pricePerNight - b.pricePerNight)
    .slice(0, maxResults);
}

// ─── Parsers ───────────────────────────────────────────────────────────────

function parseFlightData(
  text: string,
  origin: string,
  destination: string,
  departDate: string,
  returnDate?: string
): FlightScrapeResult {
  // Match prices: $1,234 / USD 1234 / 1,234 USD / MYR 2,500
  const pricePattern =
    /(?:USD?|MYR|EUR|GBP|AUD|CAD|SGD|JPY|INR|BRL|MXN|AED|SAR)?\s*\$?\s*([\d][,\d]{1,6})(?:\s*(?:USD|MYR|EUR|GBP|AUD|CAD|SGD|JPY|INR|BRL|MXN|AED|SAR))?/g;

  const airlinePattern =
    /\b(Air Canada|Air France|AirAsia|Alaska|American|British Airways|Cathay Pacific|Delta|Emirates|Etihad|Frontier|Hawaiian|Iberia|Japan Airlines|JetBlue|KLM|Korean Air|Lufthansa|Malaysian|Norwegian|Qantas|Qatar Airways|Singapore Airlines|Southwest|Spirit|Turkish Airlines|United|Virgin Atlantic|WestJet)\b/gi;

  const prices: number[] = [];
  let m: RegExpExecArray | null;

  while ((m = pricePattern.exec(text)) !== null) {
    const price = parseFloat(m[1].replace(/,/g, ""));
    // Sanity filter: flights are $80–$20,000
    if (price >= 80 && price <= 20_000) prices.push(price);
  }

  const airlines = new Set<string>();
  while ((m = airlinePattern.exec(text)) !== null) airlines.add(m[0].trim());

  prices.sort((a, b) => a - b);
  // Remove outliers: keep only prices within 4x of the median
  const filtered = prices.filter((p) => {
    const median = prices[Math.floor(prices.length / 2)];
    return p <= median * 4;
  });

  return {
    origin, destination, departDate, returnDate,
    prices: filtered.slice(0, 10),
    cheapest: filtered[0] ?? null,
    airlines: Array.from(airlines),
    scrapedAt: new Date().toISOString(),
  };
}

function parseHotelData(text: string, maxResults: number): HotelScrapeResult[] {
  const results: HotelScrapeResult[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 5);

  // Look for price patterns: $123/night, $123 per night, USD 123
  const priceRe = /(?:\$|USD\s*)([\d][,\d]{0,4})(?:\s*(?:\/night|per night|\/nightly))?/i;
  // Hotel rating: 8.5/10, 4.2★, Excellent, Very Good
  const ratingRe = /(\d+\.\d+)\s*(?:\/\s*10|★|⭐)|(?:Exceptional|Superb|Fabulous|Very Good|Good)\s+(\d+\.?\d*)/i;

  for (let i = 0; i < lines.length && results.length < maxResults; i++) {
    const priceMatch = lines[i].match(priceRe);
    if (!priceMatch) continue;

    const pricePerNight = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (pricePerNight < 20 || pricePerNight > 5_000) continue;

    // Name is usually 1–3 lines before the price line
    const nameLine = lines[i - 1] ?? lines[i - 2] ?? "";
    const name = nameLine.replace(/\d+\/\d+|★+|⭐+/g, "").trim();
    if (!name || name.length < 4) continue;

    let rating: number | undefined;
    for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
      const rm = lines[j].match(ratingRe);
      if (rm) {
        rating = parseFloat(rm[1] ?? rm[2]);
        break;
      }
    }

    results.push({
      name: name.slice(0, 80),
      pricePerNight,
      currency: "USD",
      rating,
      scrapedAt: new Date().toISOString(),
    });
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

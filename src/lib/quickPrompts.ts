// src/lib/quickPrompts.ts
// Intelligent quick-prompt engine for WorldCup Fan Command Center.
// Selects and scores prompts from a pool of 15+ candidates based on:
//   - World Cup phase (pre/groups/knockouts/final)
//   - Days remaining to first match (urgency)
//   - User location + nearest host venue
//   - Home national team (or lack thereof)
//   - Visa requirements for that passport
//   - Local currency pricing
//   - Host-country vs travelling-fan mode

import type { UserLocation } from "@/types/location";

// ─── WC 2026 timeline ──────────────────────────────────────────────────────
const WC_OPEN  = new Date("2026-06-11").getTime(); // first match
const WC_CLOSE = new Date("2026-07-19").getTime(); // final

type Phase = "pre" | "groups" | "knockouts" | "final" | "post";

function wcPhase(now: Date): Phase {
  const t = now.getTime();
  if (t < WC_OPEN)                                    return "pre";
  if (t < new Date("2026-07-01").getTime())           return "groups";
  if (t < new Date("2026-07-13").getTime())           return "knockouts";
  if (t <= WC_CLOSE)                                  return "final";
  return "post";
}

// ─── Country → national team ───────────────────────────────────────────────
const TEAM: Record<string, string> = {
  US:"USA", CA:"Canada", MX:"Mexico",
  BR:"Brazil", AR:"Argentina", CO:"Colombia", UY:"Uruguay",
  PE:"Peru", CL:"Chile", EC:"Ecuador", PY:"Paraguay", BO:"Bolivia",
  FR:"France", DE:"Germany", ES:"Spain", IT:"Italy", PT:"Portugal",
  NL:"Netherlands", GB:"England", BE:"Belgium", CH:"Switzerland",
  HR:"Croatia", RS:"Serbia", AT:"Austria", DK:"Denmark", SE:"Sweden",
  NO:"Norway", PL:"Poland", UA:"Ukraine", TR:"Türkiye", GR:"Greece",
  JP:"Japan", KR:"South Korea", IR:"Iran", SA:"Saudi Arabia", QA:"Qatar",
  AU:"Australia", NZ:"New Zealand",
  MA:"Morocco", NG:"Nigeria", SN:"Senegal", EG:"Egypt",
  GH:"Ghana", CM:"Cameroon", CI:"Ivory Coast", TN:"Tunisia", ZA:"South Africa",
  CR:"Costa Rica", JM:"Jamaica", PA:"Panama",
};

// ─── Country → nearest WC venue ────────────────────────────────────────────
interface Venue { city: string; abbr: string; stadium: string; state: string }
const V: Record<string, Venue> = {
  ny:  { city:"New York",     abbr:"NY",  stadium:"MetLife Stadium",     state:"NJ" },
  la:  { city:"Los Angeles",  abbr:"LA",  stadium:"SoFi Stadium",        state:"CA" },
  dal: { city:"Dallas",       abbr:"DAL", stadium:"AT&T Stadium",        state:"TX" },
  mia: { city:"Miami",        abbr:"MIA", stadium:"Hard Rock Stadium",   state:"FL" },
  sea: { city:"Seattle",      abbr:"SEA", stadium:"Lumen Field",         state:"WA" },
  bos: { city:"Boston",       abbr:"BOS", stadium:"Gillette Stadium",    state:"MA" },
  sf:  { city:"San Francisco",abbr:"SF",  stadium:"Levi's Stadium",      state:"CA" },
  atl: { city:"Atlanta",      abbr:"ATL", stadium:"Mercedes-Benz Stadium",state:"GA"},
  hou: { city:"Houston",      abbr:"HOU", stadium:"NRG Stadium",         state:"TX" },
  kc:  { city:"Kansas City",  abbr:"KC",  stadium:"Arrowhead Stadium",   state:"MO" },
  phi: { city:"Philadelphia", abbr:"PHI", stadium:"Lincoln Financial Field",state:"PA"},
  tor: { city:"Toronto",      abbr:"YYZ", stadium:"BMO Field",           state:"ON" },
  van: { city:"Vancouver",    abbr:"YVR", stadium:"BC Place",            state:"BC" },
  mxc: { city:"Mexico City",  abbr:"MEX", stadium:"Estadio Azteca",      state:"MX" },
  mty: { city:"Monterrey",    abbr:"MTY", stadium:"Estadio BBVA",        state:"MX" },
  gdl: { city:"Guadalajara",  abbr:"GDL", stadium:"Estadio Akron",       state:"MX" },
};

// Map country code → nearest venue (for non-host-country fans)
const NEAREST_VENUE: Record<string, Venue> = {
  // Pacific Asia → LA or Seattle
  JP:V.la, KR:V.la, CN:V.la, TW:V.la, HK:V.la, MO:V.la,
  MY:V.la, SG:V.la, PH:V.la, ID:V.la, TH:V.la, VN:V.la, MM:V.la,
  AU:V.la, NZ:V.la,
  // South Asia → NY (large diaspora in NJ/NY)
  IN:V.ny, PK:V.ny, BD:V.ny, LK:V.ny, NP:V.ny,
  // Middle East → NY
  AE:V.ny, SA:V.ny, QA:V.ny, KW:V.ny, BH:V.ny, OM:V.ny, JO:V.ny,
  // Europe → NY, Boston or Philadelphia
  GB:V.ny, FR:V.ny, DE:V.ny, IT:V.ny, ES:V.ny, NL:V.ny, BE:V.ny,
  PT:V.bos, IE:V.bos, CH:V.ny, AT:V.ny, PL:V.ny, UA:V.ny,
  SE:V.ny, NO:V.ny, DK:V.ny, FI:V.ny, GR:V.ny, TR:V.ny,
  HR:V.ny, RS:V.ny,
  // South America → Miami
  BR:V.mia, AR:V.mia, CO:V.mia, UY:V.mia, PE:V.mia,
  CL:V.mia, EC:V.mia, PY:V.mia, BO:V.mia,
  // Caribbean / Central America → Miami or Dallas
  CR:V.dal, JM:V.mia, PA:V.mia,
  // West Africa → Miami
  NG:V.mia, GH:V.mia, SN:V.mia, CI:V.mia, CM:V.mia,
  // North Africa → NY
  EG:V.ny, MA:V.ny, TN:V.ny,
  // Southern Africa → Miami
  ZA:V.mia,
};

const getNearestVenue = (cc: string): Venue => NEAREST_VENUE[cc] ?? V.ny;

// ─── Currency formatting ────────────────────────────────────────────────────
const RATE: Record<string, number> = {
  USD:1, EUR:0.92, GBP:0.79, JPY:155, KRW:1380, INR:84,
  AUD:1.55, CAD:1.37, SGD:1.35, MYR:4.5, AED:3.67, SAR:3.75,
  QAR:3.64, BRL:5.2, MXN:17.5, COP:4100, EGP:49, NGN:1600,
  ZAR:18.5, TRY:32, CHF:0.88, NOK:11, SEK:11, DKK:6.9,
  CNY:7.3, HKD:7.8, TWD:32, THB:35, IDR:16400, PHP:58,
  PKR:278, BDT:110, MAD:10,
};
const SYM: Record<string, string> = {
  USD:"$", EUR:"€", GBP:"£", JPY:"¥", KRW:"₩", INR:"₹", AUD:"A$",
  CAD:"C$", SGD:"S$", MYR:"RM ", AED:"AED ", SAR:"SAR ", BRL:"R$",
  MXN:"MX$", EGP:"EGP ", NGN:"₦", ZAR:"R ", CHF:"CHF ", CNY:"¥",
  THB:"฿", NOK:"kr", SEK:"kr", DKK:"kr",
};

function fmt(usd: number, cur: string): string {
  const rate = RATE[cur] ?? 1;
  const val  = Math.round(usd * rate);
  const s    = SYM[cur] ?? `${cur} `;
  if (val >= 10_000) return `${s}${(val / 1000).toFixed(0)}k`;
  if (val >= 1_000)  return `${s}${(val / 1000).toFixed(1)}k`;
  return `${s}${val.toLocaleString()}`;
}

// ─── Per-route flight estimates (USD round-trip) ───────────────────────────
const FLIGHT_USD: Record<string, { low: number; mid: number }> = {
  MY:{low:650,mid:950}, SG:{low:680,mid:1000}, JP:{low:700,mid:1100},
  KR:{low:700,mid:1050},AU:{low:950,mid:1500}, NZ:{low:1100,mid:1700},
  PH:{low:580,mid:900}, ID:{low:620,mid:950},  TH:{low:580,mid:900},
  VN:{low:600,mid:950}, CN:{low:700,mid:1200}, TW:{low:720,mid:1100},
  IN:{low:680,mid:1050},PK:{low:650,mid:1000}, BD:{low:700,mid:1100},
  AE:{low:500,mid:850}, SA:{low:530,mid:880},  QA:{low:520,mid:860},
  GB:{low:340,mid:600}, FR:{low:360,mid:640},  DE:{low:360,mid:640},
  NL:{low:360,mid:640}, IT:{low:370,mid:670},  ES:{low:390,mid:690},
  PT:{low:400,mid:700}, IE:{low:350,mid:620},  CH:{low:380,mid:660},
  PL:{low:370,mid:650}, SE:{low:380,mid:660},  NO:{low:400,mid:680},
  TR:{low:420,mid:750}, UA:{low:430,mid:760},
  BR:{low:340,mid:620}, AR:{low:380,mid:680},  CO:{low:320,mid:580},
  NG:{low:680,mid:1150},GH:{low:660,mid:1100}, SN:{low:700,mid:1200},
  EG:{low:580,mid:980}, MA:{low:560,mid:950},  ZA:{low:820,mid:1380},
};

const getFlightUSD = (cc: string) => FLIGHT_USD[cc] ?? { low: 500, mid: 900 };

// ─── Visa classification ────────────────────────────────────────────────────
// HIGH = almost certainly need a B-2 visa for USA
const VISA_REQUIRED = new Set([
  "MY","IN","PK","BD","LK","NP","AF","NG","ET","TZ","KE","UG","ZM","ZW",
  "GH","CM","CI","BF","ML","SN","GN","TG","BJ","NE","SD","SS","ER","DJ",
  "SO","MZ","AO","CG","CD","TD","CF","RW","BI","MG","MU","SC","KM","MV",
  "MM","KH","LA","TL","BT","PG","SB","VU","WS","TO","FJ","PW","FM","MH",
  "EG","LY","TN","DZ","MR","CN","VN","PH","ID","MN","UZ","KZ","TM","TJ","KG",
  "AZ","AM","GE","BY","CU","VE","NI","HT","SR","GY","BO","PY","EC",
  "SY","IQ","IR","YE","LB","TR","RU",
]);

// VWP / ESTA countries (no visa, just ESTA)
const VWP = new Set([
  "GB","FR","DE","IT","ES","NL","BE","CH","AT","SE","NO","DK","FI","IE",
  "PT","GR","LU","IS","LI","SI","SK","CZ","HU","EE","LV","LT","MT","HR",
  "RO","BG","PL","CY","JP","KR","AU","NZ","SG","BR","CL","TW","HK","MO",
]);

// ─── Context object ────────────────────────────────────────────────────────
interface Ctx {
  loc:         UserLocation;
  now:         Date;
  daysToWC:    number;
  phase:       Phase;
  homeTeam:    string | null;
  venue:       Venue;
  isHost:      boolean;      // lives in US / CA / MX
  isMxHost:    boolean;
  fromCity:    string;
  hasLoc:      boolean;
  cur:         string;
  flight:      { low: string; mid: string };
  visaStatus:  "required" | "esta" | "free" | "unknown";
}

function buildCtx(loc: UserLocation): Ctx {
  const now      = new Date();
  const daysToWC = Math.max(0, Math.ceil((WC_OPEN - now.getTime()) / 86_400_000));
  const phase    = wcPhase(now);
  const cc       = loc.countryCode ?? "";
  const homeTeam = TEAM[cc] ?? null;
  const isHost   = ["US","CA","MX"].includes(cc);
  const isMxHost = cc === "MX";
  const venue    = isHost ? V.ny : getNearestVenue(cc); // host-country fans see generic NY for trip planning
  const fromCity = loc.city || "your city";
  const hasLoc   = !!loc.city;
  const cur      = loc.currency || "USD";
  const f        = getFlightUSD(cc);
  const flight   = { low: fmt(f.low, cur), mid: fmt(f.mid, cur) };

  let visaStatus: Ctx["visaStatus"] = "unknown";
  if (VISA_REQUIRED.has(cc))  visaStatus = "required";
  else if (VWP.has(cc))       visaStatus = "esta";
  else if (isHost)             visaStatus = "free";

  return { loc, now, daysToWC, phase, homeTeam, venue, isHost, isMxHost, fromCity, hasLoc, cur, flight, visaStatus };
}

// ─── Prompt pool ───────────────────────────────────────────────────────────
export interface QuickPrompt { icon: string; label: string; prompt: string }

interface PromptDef {
  id:     string;
  build:  (ctx: Ctx) => QuickPrompt;
  score:  (ctx: Ctx) => number;   // 0 = hide
}

const POOL: PromptDef[] = [

  // ── 1. URGENCY TRIP (countdown timer feel) ─────────────────────────────
  {
    id: "urgent-trip",
    build: (ctx) => ({
      icon: ctx.daysToWC <= 14 ? "🚨" : "🚀",
      label: ctx.daysToWC > 0
        ? `${ctx.daysToWC}d to kick-off — plan now`
        : "World Cup is ON — plan now",
      prompt: ctx.hasLoc
        ? `⚡ The 2026 World Cup kicks off in ${ctx.daysToWC} days — flights are filling fast! I'm in ${ctx.fromCity}, ${ctx.loc.country}. Give me the most urgent action plan: fastest route to ${ctx.venue.city} (${ctx.venue.stadium}), what to book TODAY, match ticket options, and ${ctx.visaStatus === "required" ? "whether I can still get a US visa in time" : "what I need for entry"}. Budget for flights: around ${ctx.flight.mid}.`
        : `The 2026 World Cup starts in ${ctx.daysToWC} days! Help me plan a trip — which host city has the best fan experience, what must I book right now before it sells out, and what's a realistic total budget?`,
    }),
    score: (ctx) => {
      if (ctx.phase === "post") return 0;
      if (ctx.isHost) return 0; // host-country fans don't need flight urgency
      const d = ctx.daysToWC;
      return d <= 7 ? 99 : d <= 14 ? 97 : d <= 21 ? 94 : d <= 45 ? 86 : d <= 90 ? 76 : 65;
    },
  },

  // ── 2. FULL TRIP PLAN ──────────────────────────────────────────────────
  {
    id: "trip-plan",
    build: (ctx) => ({
      icon: "✈️",
      label: ctx.hasLoc
        ? `${ctx.loc.city.split(" ")[0]} → ${ctx.venue.city} guide`
        : "Plan my WC trip",
      prompt: ctx.hasLoc
        ? `Build me a complete World Cup 2026 trip from ${ctx.fromCity}, ${ctx.loc.country} to ${ctx.venue.city}. I need: best flight routes and timing (budget ${ctx.flight.low}–${ctx.flight.mid}), hotels within 30 min of ${ctx.venue.stadium}, how to get match tickets (official vs resale), day-by-day itinerary, and any entry requirements for ${ctx.loc.country} passport holders.`
        : `Build me a complete World Cup 2026 travel plan. Which host city has the best atmosphere for a first-timer, how do I get match tickets, what should I budget for flights + hotels, and what are the must-know entry requirements for international fans?`,
    }),
    score: (ctx) => ctx.isHost ? 0 : (ctx.hasLoc ? 81 : 63),
  },

  // ── 3. VISA — URGENT for high-risk passports ───────────────────────────
  {
    id: "visa",
    build: (ctx) => ({
      icon: ctx.visaStatus === "required" ? "🛂" : "📋",
      label: ctx.hasLoc
        ? `${ctx.loc.country} passport → USA?`
        : "Visa requirements",
      prompt: ctx.hasLoc && ctx.visaStatus === "required"
        ? `URGENT: As a ${ctx.loc.country} passport holder, do I need a US visa for the World Cup 2026? The tournament starts in ${ctx.daysToWC} days. What's the fastest visa option still available — B-2 tourist, Express, or any other route? What documents do I need, which US consulate in ${ctx.loc.country} processes them fastest, and is there any visa-on-arrival option? Also cover Canada and Mexico entry since they're co-hosts.`
        : ctx.hasLoc
        ? `As a ${ctx.loc.country} passport holder, what do I need to enter the USA for the 2026 World Cup? Do I need an ESTA, any special sports event authorization, or anything beyond my passport? Also cover Canada and Mexico since they're co-hosts.`
        : `What are the visa and entry requirements for the 2026 World Cup in the USA? Break it down by region — which countries need a visa, which get ESTA, and are there any special World Cup fan ID cards like previous tournaments?`,
    }),
    score: (ctx) => {
      if (ctx.isHost || ctx.phase === "post") return 0;
      if (ctx.visaStatus === "required") {
        const d = ctx.daysToWC;
        return d <= 30 ? 96 : d <= 60 ? 90 : 83;
      }
      if (ctx.visaStatus === "esta")     return 35;
      return ctx.hasLoc ? 55 : 42;
    },
  },

  // ── 4. PRICE ALERT ─────────────────────────────────────────────────────
  {
    id: "price-alert",
    build: (ctx) => ({
      icon: "🔔",
      label: ctx.hasLoc
        ? `Track ${ctx.loc.city.split(" ")[0]}→${ctx.venue.abbr} prices`
        : "Flight price tracker",
      prompt: ctx.hasLoc
        ? `Set a smart price alert for World Cup 2026: monitor return flights from ${ctx.fromCity} to ${ctx.venue.city} for travel June 8–July 21, 2026. Alert me when round-trip drops below ${ctx.flight.low}. Check all major airlines, nearby airports (${ctx.venue.state} area), and let me know if any flash deals appear. Also what's the price trend — are flights going up or down as the tournament gets closer?`
        : `How do I find the cheapest flights to the 2026 World Cup? Set up price tracking for New York, Los Angeles, Dallas, and Miami, and tell me which city typically has the cheapest flights. What's a good price target and when should I buy?`,
    }),
    score: (ctx) => ctx.isHost ? 0 : (ctx.hasLoc ? 82 : 53),
  },

  // ── 5. HOTELS ──────────────────────────────────────────────────────────
  {
    id: "hotels",
    build: (ctx) => ({
      icon: "🏨",
      label: ctx.hasLoc
        ? `Hotels near ${ctx.venue.stadium.split(" ").slice(0,2).join(" ")}`
        : "Stadium hotels guide",
    prompt: ctx.hasLoc
        ? `Find the best places to stay near ${ctx.venue.stadium}, ${ctx.venue.city} for World Cup 2026. I'm flying from ${ctx.fromCity} (budget-conscious traveller). Compare: walking-distance hotels, public-transit-accessible options, and short-term rentals (Airbnb/VRBO). Include price ranges in ${ctx.cur}, which dates to avoid peak pricing, and tips for securing rooms during sold-out match weeks.`
        : `What's the best accommodation strategy for World Cup 2026? Compare staying near stadiums vs city centres, how early to book, typical price ranges, and whether fan packages are worth it vs booking independently.`,
    }),
    score: (ctx) => ctx.hasLoc ? 75 : 54,
  },

  // ── 6. HOME TEAM SCHEDULE (only if country has a team) ─────────────────
  {
    id: "home-team",
    build: (ctx) => ({
      icon: "🏆",
      label: `${ctx.homeTeam} WC schedule`,
      prompt: ctx.loc.city
        ? `I'm a ${ctx.homeTeam} fan based in ${ctx.fromCity}. Show me ${ctx.homeTeam}'s complete World Cup 2026 schedule — group stage opponents, cities, stadiums, and kick-off times converted to ${ctx.loc.timezone ?? ctx.loc.country} time. Which match gives the best live experience? If I can only go to one game, which should it be and what's the estimated ticket + travel cost from ${ctx.fromCity} in ${ctx.cur}?`
        : `Show me ${ctx.homeTeam}'s complete World Cup 2026 group stage schedule — opponents, host cities, stadiums, and dates. Predict their likely path to the final and which match would be the best to attend for atmosphere.`,
    }),
    score: (ctx) => ctx.homeTeam ? (ctx.hasLoc ? 88 : 82) : 0,
  },

  // ── 7. NO QUALIFYING TEAM → "who to adopt" ─────────────────────────────
  {
    id: "adopt-team",
    build: (ctx) => ({
      icon: "🌍",
      label: "Which team to adopt?",
      prompt: ctx.hasLoc
        ? `${ctx.loc.country} isn't at the World Cup 2026 — so who should I support? I'm from ${ctx.fromCity} and I want an exciting team to follow. Recommend my top 3 adopted teams considering: playing style, cultural connections to ${ctx.loc.country}, World Cup 2026 chances, and how fun they are to watch. Then build me a fantasy team around my best pick.`
        : `My country isn't in the World Cup 2026. Help me pick a team to adopt! Give me the top 5 "neutral fan favourites" ranked by: entertainment value, underdog stories, superstar players, and genuine title chances. Build me a fantasy team around the top recommendation.`,
    }),
    score: (ctx) => {
      if (ctx.isHost || ctx.homeTeam) return 0;
      return ctx.hasLoc ? 85 : 67;
    },
  },

  // ── 8. FANTASY PICKS (phase-aware) ─────────────────────────────────────
  {
    id: "fantasy",
    build: (ctx) => {
      const label =
        ctx.phase === "pre"        ? (ctx.homeTeam ? `Fantasy + ${ctx.homeTeam} picks` : "Build fantasy team") :
        ctx.phase === "groups"     ? "Fantasy GW captain" :
        ctx.phase === "knockouts"  ? "Knockout fantasy picks" :
                                     "Final fantasy lineup";
      const prompt =
        ctx.phase === "pre"
          ? ctx.homeTeam
            ? `Build my optimal World Cup 2026 fantasy team with a ${ctx.homeTeam} bias. Which ${ctx.homeTeam} players are genuine must-haves? Then complete the squad with the best value picks and differentials. Give me GW1 captain choice with xG-based reasoning, a budget allocation plan, and 3 players to target on the cheap who will explode in value.`
            : `Build me the best World Cup 2026 fantasy team from scratch. Cover: must-have premiums (top 5), best budget enablers (under $6m), sleeper differentials no-one's picking, GW1 captain with statistical justification, and a transfer strategy for the tournament.`
          : ctx.phase === "groups"
          ? `World Cup fantasy GW update: who are the in-form players right now, who's injured or suspended, and who has the best fixture this gameweek? Give me a captain pick with xG/xA numbers and two alternative options if my first choice is unavailable.`
          : `World Cup knockout fantasy: with the tournament entering the ${ctx.phase} stage, which players should I prioritise? Who has the form, best fixtures, and set-piece responsibilities? Give me a captain pick and any essential transfers to make this week.`;
      return { icon: "⚽", label, prompt };
    },
    score: (ctx) => ctx.phase === "post" ? 0 : 68,
  },

  // ── 9. WEATHER + PACKING ───────────────────────────────────────────────
  {
    id: "weather",
    build: (ctx) => ({
      icon: "🌡️",
      label: ctx.hasLoc
        ? `Packing from ${ctx.loc.country} to ${ctx.venue.city}`
        : "WC weather & packing",
      prompt: ctx.hasLoc
        ? `I'm travelling to the World Cup 2026 from ${ctx.fromCity}, ${ctx.loc.country} (tropical/humid climate) to ${ctx.venue.city} in June–July. What's the weather like there vs home? Give me a complete packing list for outdoor stadium matches — what to wear, what to avoid, sun/heat protection tips, and the most common mistake tourists from ${ctx.loc.country} make when visiting the USA in summer.`
        : `What's the weather like at the World Cup 2026 host cities in June–July? Rank them from hottest to coolest, flag which have rain risk, and give a universal packing list for attending outdoor matches across multiple US cities.`,
    }),
    score: (ctx) => ctx.hasLoc ? 63 : 49,
  },

  // ── 10. FULL BUDGET BREAKDOWN ──────────────────────────────────────────
  {
    id: "budget",
    build: (ctx) => ({
      icon: "💰",
      label: ctx.hasLoc
        ? `Real WC budget from ${ctx.loc.city.split(" ")[0]}`
        : "Total trip cost estimate",
      prompt: ctx.hasLoc
        ? `Give me a complete, honest budget breakdown for a 7-day World Cup 2026 trip from ${ctx.fromCity} to ${ctx.venue.city}, all prices in ${ctx.cur}. Line items: return flights (my route estimate: ${ctx.flight.low}–${ctx.flight.mid}), 7 nights hotel, 2 match tickets (Category 1, 2, and 3 prices), food/drink per day (fan zone vs restaurant), local transport, visa fees if applicable, travel insurance, and airport transfers. Give budget, comfortable, and VIP tiers.`
        : `What's the realistic total cost of attending the World Cup 2026? Break down flights, accommodation, match tickets, food, and extras for both a budget traveller and a mid-range fan. Which host city gives the best value?`,
    }),
    score: (ctx) => !ctx.isHost && ctx.hasLoc ? 70 : (ctx.hasLoc ? 38 : 44),
  },

  // ── 11. HOST COUNTRY: GET TICKETS ──────────────────────────────────────
  {
    id: "host-tickets",
    build: (ctx) => ({
      icon: "🎟️",
      label: ctx.isMxHost
        ? "Mexico City match tickets"
        : `Match tickets near ${ctx.loc.city.split(" ")[0]}`,
      prompt: ctx.isMxHost
        ? `I'm in ${ctx.fromCity}, Mexico — World Cup 2026 host country! How do I get tickets to matches at Estadio Azteca, Estadio BBVA (Monterrey), and Estadio Akron (Guadalajara)? Compare official FIFA ballot vs resale prices in MXN, which Mexico group games have the best atmosphere, and what happens with unsold tickets closer to match day?`
        : `I'm in ${ctx.fromCity} — in a 2026 World Cup host country! What's the best strategy to get match tickets? Compare: official FIFA ticket portal, authorised resellers, and fan-to-fan resale. What are typical Category 1/2/3 prices in ${ctx.cur}? Which matches near me still have availability, and are there day-of-match ticket options?`,
    }),
    score: (ctx) => ctx.isHost ? 96 : 0,
  },

  // ── 12. HOST COUNTRY: FAN FESTIVAL ─────────────────────────────────────
  {
    id: "host-fanzone",
    build: (ctx) => ({
      icon: "🎪",
      label: `Fan zones in ${ctx.loc.city.split(" ")[0]}`,
      prompt: `What are the official FIFA Fan Festival locations and biggest public watch parties near ${ctx.fromCity} for the 2026 World Cup? Give me: opening dates, capacity, whether it's free or ticketed, what activities and concerts are planned, best viewing spots for people without match tickets, and tips for the full fan experience without entering the stadium.`,
    }),
    score: (ctx) => ctx.isHost ? 85 : 28,
  },

  // ── 13. HOST COUNTRY: MULTI-VENUE ROAD TRIP ────────────────────────────
  {
    id: "host-roadtrip",
    build: (ctx) => ({
      icon: "🗺️",
      label: "World Cup road trip",
      prompt: `Plan me a World Cup 2026 road trip starting from ${ctx.fromCity}! I want to see matches at 3–4 different venues. Design the optimal route: order of venues, realistic driving distances and times, which types of matches to target at each stop (group stage for atmosphere vs knockouts for drama), how many days I need, estimated fuel and hotel costs, and the best "non-obvious" venue to include that most fans will overlook.`,
    }),
    score: (ctx) => ctx.isHost ? 79 : 0,
  },

  // ── 14. HOST COUNTRY: HOME TEAM DEEP DIVE ──────────────────────────────
  {
    id: "host-national",
    build: (ctx) => ({
      icon: ctx.loc.countryCode === "CA" ? "🍁" : ctx.loc.countryCode === "MX" ? "🦅" : "🦅",
      label: ctx.loc.countryCode === "CA" ? "Canada WC fixtures" : ctx.loc.countryCode === "MX" ? "El Tri fixtures" : "USMNT fixtures",
      prompt: ctx.loc.countryCode === "CA"
        ? `As a Canadian fan at home for the World Cup 2026 — show me Canada's full group stage schedule, which home cities they play in, and how to get tickets for the loudest possible home crowd. How do Toronto and Vancouver compare for atmosphere? Predict Canada's best-case path to the knockout rounds.`
        : ctx.loc.countryCode === "MX"
        ? `I'm a Mexico fan living in ${ctx.fromCity}. Show me El Tri's complete World Cup 2026 group stage schedule, the three Mexican host stadiums they're playing at, and how to get the best tickets for a Mexico home match. What's the atmosphere like at the Azteca for a World Cup game, and what's Mexico's realistic shot at a deep run?`
        : `Show me the USMNT's full World Cup 2026 schedule — all group stage matches, host cities, kick-off times (ET), and predictions. Which match should I attend for the loudest home crowd? Give me squad depth, key players to watch, and a realistic tournament projection for the USA.`,
    }),
    score: (ctx) => ctx.isHost ? 82 : 0,
  },

  // ── 15. LIVE MATCH / FAN ZONE (during tournament) ──────────────────────
  {
    id: "live-now",
    build: (ctx) => ({
      icon: "📡",
      label: ctx.isHost ? "Matches near me today" : "Watch live from home",
      prompt: ctx.isHost
        ? `What World Cup 2026 matches are coming up in the next 3 days, and which venues are nearest to ${ctx.fromCity}? Are there still tickets available, and if not, what are the best local fan zones or sports bars? Also give me the live standings in all groups.`
        : `The World Cup 2026 is on right now and I'm watching from ${ctx.fromCity}! What are the must-watch matches this week, what are the current group standings, and what time do matches kick off in my timezone? Also recommend the best legal streaming service for ${ctx.loc.country}.`,
    }),
    score: (ctx) => (ctx.phase === "groups" || ctx.phase === "knockouts" || ctx.phase === "final") ? 91 : 0,
  },
];

// ─── Public API ────────────────────────────────────────────────────────────
export function getTopPrompts(location: UserLocation, count = 6): QuickPrompt[] {
  const ctx = buildCtx(location);
  return POOL
    .map((def) => ({ def, s: def.score(ctx) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .map(({ def }) => def.build(ctx));
}

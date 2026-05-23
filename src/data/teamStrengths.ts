// src/data/teamStrengths.ts — 2026 World Cup team ELO ratings & metadata

export interface TeamInfo {
  name: string;
  code: string;
  flag: string;
  elo: number;
  fifaRank: number;
  confederation: "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";
  isHost?: boolean;
  group?: string;
}

// ELO ratings scaled to ~FIFA ranking order (Jan 2026 estimate)
// Host nations get +75 home advantage in prediction calculations
export const TEAMS: Record<string, TeamInfo> = {
  ARG: { name: "Argentina",    code: "ARG", flag: "🇦🇷", elo: 2075, fifaRank: 1,  confederation: "CONMEBOL" },
  FRA: { name: "France",       code: "FRA", flag: "🇫🇷", elo: 1993, fifaRank: 2,  confederation: "UEFA" },
  ENG: { name: "England",      code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", elo: 1978, fifaRank: 3,  confederation: "UEFA" },
  BEL: { name: "Belgium",      code: "BEL", flag: "🇧🇪", elo: 1962, fifaRank: 4,  confederation: "UEFA" },
  BRA: { name: "Brazil",       code: "BRA", flag: "🇧🇷", elo: 1957, fifaRank: 5,  confederation: "CONMEBOL" },
  POR: { name: "Portugal",     code: "POR", flag: "🇵🇹", elo: 1950, fifaRank: 6,  confederation: "UEFA" },
  NED: { name: "Netherlands",  code: "NED", flag: "🇳🇱", elo: 1941, fifaRank: 7,  confederation: "UEFA" },
  ESP: { name: "Spain",        code: "ESP", flag: "🇪🇸", elo: 1929, fifaRank: 8,  confederation: "UEFA" },
  GER: { name: "Germany",      code: "GER", flag: "🇩🇪", elo: 1916, fifaRank: 9,  confederation: "UEFA" },
  ITA: { name: "Italy",        code: "ITA", flag: "🇮🇹", elo: 1902, fifaRank: 10, confederation: "UEFA" },
  URU: { name: "Uruguay",      code: "URU", flag: "🇺🇾", elo: 1887, fifaRank: 11, confederation: "CONMEBOL" },
  COL: { name: "Colombia",     code: "COL", flag: "🇨🇴", elo: 1873, fifaRank: 12, confederation: "CONMEBOL" },
  CRO: { name: "Croatia",      code: "CRO", flag: "🇭🇷", elo: 1866, fifaRank: 13, confederation: "UEFA" },
  MAR: { name: "Morocco",      code: "MAR", flag: "🇲🇦", elo: 1854, fifaRank: 14, confederation: "CAF" },
  SEN: { name: "Senegal",      code: "SEN", flag: "🇸🇳", elo: 1838, fifaRank: 15, confederation: "CAF" },
  USA: { name: "USA",          code: "USA", flag: "🇺🇸", elo: 1824, fifaRank: 16, confederation: "CONCACAF", isHost: true },
  MEX: { name: "Mexico",       code: "MEX", flag: "🇲🇽", elo: 1810, fifaRank: 17, confederation: "CONCACAF", isHost: true },
  JPN: { name: "Japan",        code: "JPN", flag: "🇯🇵", elo: 1798, fifaRank: 18, confederation: "AFC" },
  AUS: { name: "Australia",    code: "AUS", flag: "🇦🇺", elo: 1774, fifaRank: 19, confederation: "AFC" },
  DEN: { name: "Denmark",      code: "DEN", flag: "🇩🇰", elo: 1768, fifaRank: 20, confederation: "UEFA" },
  SUI: { name: "Switzerland",  code: "SUI", flag: "🇨🇭", elo: 1760, fifaRank: 21, confederation: "UEFA" },
  KOR: { name: "South Korea",  code: "KOR", flag: "🇰🇷", elo: 1752, fifaRank: 22, confederation: "AFC" },
  CAN: { name: "Canada",       code: "CAN", flag: "🇨🇦", elo: 1746, fifaRank: 23, confederation: "CONCACAF", isHost: true },
  AUT: { name: "Austria",      code: "AUT", flag: "🇦🇹", elo: 1740, fifaRank: 24, confederation: "UEFA" },
  POL: { name: "Poland",       code: "POL", flag: "🇵🇱", elo: 1733, fifaRank: 25, confederation: "UEFA" },
  SRB: { name: "Serbia",       code: "SRB", flag: "🇷🇸", elo: 1726, fifaRank: 26, confederation: "UEFA" },
  ECU: { name: "Ecuador",      code: "ECU", flag: "🇪🇨", elo: 1718, fifaRank: 27, confederation: "CONMEBOL" },
  TUR: { name: "Turkey",       code: "TUR", flag: "🇹🇷", elo: 1714, fifaRank: 28, confederation: "UEFA" },
  UKR: { name: "Ukraine",      code: "UKR", flag: "🇺🇦", elo: 1708, fifaRank: 29, confederation: "UEFA" },
  CHL: { name: "Chile",        code: "CHL", flag: "🇨🇱", elo: 1703, fifaRank: 30, confederation: "CONMEBOL" },
  KSA: { name: "Saudi Arabia", code: "KSA", flag: "🇸🇦", elo: 1696, fifaRank: 31, confederation: "AFC" },
  NGA: { name: "Nigeria",      code: "NGA", flag: "🇳🇬", elo: 1689, fifaRank: 32, confederation: "CAF" },
  IRN: { name: "Iran",         code: "IRN", flag: "🇮🇷", elo: 1683, fifaRank: 33, confederation: "AFC" },
  PAN: { name: "Panama",       code: "PAN", flag: "🇵🇦", elo: 1668, fifaRank: 34, confederation: "CONCACAF" },
  CIV: { name: "Ivory Coast",  code: "CIV", flag: "🇨🇮", elo: 1663, fifaRank: 35, confederation: "CAF" },
  EGY: { name: "Egypt",        code: "EGY", flag: "🇪🇬", elo: 1657, fifaRank: 36, confederation: "CAF" },
  ALG: { name: "Algeria",      code: "ALG", flag: "🇩🇿", elo: 1650, fifaRank: 37, confederation: "CAF" },
  RSA: { name: "South Africa", code: "RSA", flag: "🇿🇦", elo: 1638, fifaRank: 38, confederation: "CAF" },
  CMR: { name: "Cameroon",     code: "CMR", flag: "🇨🇲", elo: 1632, fifaRank: 39, confederation: "CAF" },
  JAM: { name: "Jamaica",      code: "JAM", flag: "🇯🇲", elo: 1619, fifaRank: 40, confederation: "CONCACAF" },
  HON: { name: "Honduras",     code: "HON", flag: "🇭🇳", elo: 1608, fifaRank: 41, confederation: "CONCACAF" },
  QAT: { name: "Qatar",        code: "QAT", flag: "🇶🇦", elo: 1598, fifaRank: 42, confederation: "AFC" },
  NZL: { name: "New Zealand",  code: "NZL", flag: "🇳🇿", elo: 1592, fifaRank: 43, confederation: "OFC" },
  VEN: { name: "Venezuela",    code: "VEN", flag: "🇻🇪", elo: 1587, fifaRank: 44, confederation: "CONMEBOL" },
  PAR: { name: "Paraguay",     code: "PAR", flag: "🇵🇾", elo: 1582, fifaRank: 45, confederation: "CONMEBOL" },
  IRQ: { name: "Iraq",         code: "IRQ", flag: "🇮🇶", elo: 1576, fifaRank: 46, confederation: "AFC" },
  TUN: { name: "Tunisia",      code: "TUN", flag: "🇹🇳", elo: 1568, fifaRank: 47, confederation: "CAF" },
  BOL: { name: "Bolivia",      code: "BOL", flag: "🇧🇴", elo: 1555, fifaRank: 48, confederation: "CONMEBOL" },
};

export const TEAM_ARRAY = Object.values(TEAMS).sort((a, b) => b.elo - a.elo);

export function getTeam(code: string): TeamInfo | undefined {
  return TEAMS[code.toUpperCase()];
}

export function findTeamByName(name: string): TeamInfo | undefined {
  const lower = name.toLowerCase();
  return TEAM_ARRAY.find(
    (t) => t.name.toLowerCase().includes(lower) || t.code.toLowerCase() === lower
  );
}

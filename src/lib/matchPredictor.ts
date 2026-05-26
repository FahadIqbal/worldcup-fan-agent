// src/lib/matchPredictor.ts — ELO-based match predictor + Monte Carlo tournament simulation

import { TEAMS, TEAM_ARRAY, type TeamInfo } from "@/data/teamStrengths";

// ─── Core ELO prediction ───────────────────────────────────────────────────

export interface MatchPrediction {
  team1Win: number;  // percent
  draw: number;
  team2Win: number;
  team1Elo: number;
  team2Elo: number;
  eloDiff: number;   // positive = team1 stronger
  confidence: "low" | "medium" | "high";
  label: string;     // human-readable verdict
}

export function predictMatch(
  team1: TeamInfo,
  team2: TeamInfo,
  options: { isKnockout?: boolean; hostCodes?: string[] } = {}
): MatchPrediction {
  const { isKnockout = false, hostCodes = ["USA", "MEX", "CAN"] } = options;

  let elo1 = team1.elo;
  let elo2 = team2.elo;

  // Host nation crowd advantage (~75 ELO points)
  if (hostCodes.includes(team1.code)) elo1 += 75;
  if (hostCodes.includes(team2.code)) elo2 += 75;

  const diff = elo1 - elo2;
  // Standard ELO win probability
  const rawWin1 = 1 / (1 + Math.pow(10, -diff / 400));

  let team1Win: number;
  let draw: number;
  let team2Win: number;

  if (isKnockout) {
    // No draws in knockout (goes to extra time/penalties)
    team1Win = Math.round(rawWin1 * 100);
    draw = 0;
    team2Win = 100 - team1Win;
  } else {
    // Group stage: model draws as proportional to closeness
    // Historical WC draw rate ~26%, peaks when teams are evenly matched
    const closeness = 1 - Math.abs(rawWin1 - 0.5) * 2; // 0 (lopsided) → 1 (even)
    const drawRaw = 0.28 * Math.pow(Math.max(0, closeness), 0.6);
    const adj = 1 - drawRaw;
    team1Win = Math.round(rawWin1 * adj * 100);
    draw = Math.round(drawRaw * 100);
    team2Win = 100 - team1Win - draw;
  }

  const absDiff = Math.abs(diff);
  const confidence: MatchPrediction["confidence"] =
    absDiff >= 200 ? "high" : absDiff >= 80 ? "medium" : "low";

  const label = buildLabel(team1, team2, team1Win, draw, team2Win, diff);

  return { team1Win, draw, team2Win, team1Elo: elo1, team2Elo: elo2, eloDiff: diff, confidence, label };
}

function buildLabel(
  t1: TeamInfo, t2: TeamInfo,
  w1: number, d: number, w2: number,
  diff: number
): string {
  if (Math.abs(diff) < 50) return `Toss-up — either side can win`;
  if (w1 >= 70) return `${t1.name} heavy favourites (${w1}%)`;
  if (w2 >= 70) return `${t2.name} heavy favourites (${w2}%)`;
  if (w1 >= 55) return `${t1.name} slight edge (${w1}% win)`;
  if (w2 >= 55) return `${t2.name} slight edge (${w2}% win)`;
  if (d >= 30) return `Draw most likely (${d}%) — closely matched`;
  return `Competitive match — ${w1 > w2 ? t1.name : t2.name} narrow favourite`;
}

// ─── Tournament winner simulation ─────────────────────────────────────────
// Simplified: computes win probability based on relative ELO strength
// rather than full bracket Monte Carlo (fast and accurate for top-level odds)

export interface TournamentOdds {
  code: string;
  name: string;
  flag: string;
  elo: number;
  winPct: number;      // % chance to win the tournament
  top4Pct: number;     // % chance to reach semis
  top8Pct: number;     // % chance to reach quarters
  tier: "favourite" | "contender" | "outsider" | "longshot";
}

export function computeTournamentOdds(teams: TeamInfo[] = TEAM_ARRAY): TournamentOdds[] {
  // Use Softmax over ELO to estimate relative tournament win probability
  // Then calibrate so totals ≈ 100%
  const TEMP = 175; // temperature — calibrated for 48-team WC (top team ≈ 15-20%)

  const scores = teams.map((t) => Math.exp(t.elo / TEMP));
  const totalScore = scores.reduce((a, b) => a + b, 0);

  // Raw win probability
  const rawWin = scores.map((s) => s / totalScore);

  // Top-4 and top-8: approximate using relative strength with dampening
  const rawTop4 = rawWin.map((p) => Math.pow(p, 0.55) * 4);
  const rawTop8 = rawWin.map((p) => Math.pow(p, 0.45) * 8);

  // Normalize top-4 and top-8 so they sum to 4 and 8 respectively
  const sumTop4 = rawTop4.reduce((a, b) => a + b, 0);
  const sumTop8 = rawTop8.reduce((a, b) => a + b, 0);

  return teams.map((team, i) => {
    const winPct = rawWin[i] * 100;
    const top4Pct = (rawTop4[i] / sumTop4) * 4 * 100;
    const top8Pct = (rawTop8[i] / sumTop8) * 8 * 100;

    const tier: TournamentOdds["tier"] =
      winPct >= 10 ? "favourite" :
      winPct >= 4  ? "contender" :
      winPct >= 1  ? "outsider" : "longshot";

    return {
      code: team.code, name: team.name, flag: team.flag, elo: team.elo,
      winPct: Math.round(winPct * 10) / 10,
      top4Pct: Math.round(top4Pct * 10) / 10,
      top8Pct: Math.round(top8Pct * 10) / 10,
      tier,
    };
  });
}

// ─── Detailed head-to-head breakdown ─────────────────────────────────────

export interface HeadToHeadResult {
  team1: TeamInfo;
  team2: TeamInfo;
  prediction: MatchPrediction;
  factors: Factor[];
  tournamentOdds1: number;
  tournamentOdds2: number;
}

interface Factor {
  label: string;
  advantage: "team1" | "team2" | "neutral";
  detail: string;
}

// ─── Group Standings Simulation ────────────────────────────────────────────

export interface GroupStanding {
  team: TeamInfo;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export function computeGroupStandings(teamCodes: string[]): GroupStanding[] {
  const teams = teamCodes.map((c) => TEAMS[c.toUpperCase()]).filter(Boolean) as TeamInfo[];
  const map = new Map<string, GroupStanding>();
  for (const t of teams) {
    map.set(t.code, { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
  }
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const t1 = teams[i];
      const t2 = teams[j];
      const pred = predictMatch(t1, t2);
      const s1 = map.get(t1.code)!;
      const s2 = map.get(t2.code)!;
      s1.played++; s2.played++;
      const isDraw = pred.draw > pred.team1Win && pred.draw > pred.team2Win;
      if (isDraw) {
        const g = pred.draw >= 32 ? 1 : 2;
        s1.drawn++; s1.pts++; s1.gf += g; s1.ga += g;
        s2.drawn++; s2.pts++; s2.gf += g; s2.ga += g;
      } else if (pred.team1Win > pred.team2Win) {
        const margin = pred.team1Win >= 68 ? 2 : 1;
        s1.won++; s1.pts += 3; s1.gf += margin + 1; s1.ga += 1;
        s2.lost++; s2.gf += 1; s2.ga += margin + 1;
      } else {
        const margin = pred.team2Win >= 68 ? 2 : 1;
        s2.won++; s2.pts += 3; s2.gf += margin + 1; s2.ga += 1;
        s1.lost++; s1.gf += 1; s1.ga += margin + 1;
      }
    }
  }
  for (const s of map.values()) s.gd = s.gf - s.ga;
  return Array.from(map.values()).sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.gd !== a.gd ? b.gd - a.gd : b.gf - a.gf
  );
}

// ─── Knockout Bracket Simulation ────────────────────────────────────────────

export interface BracketMatch {
  team1: TeamInfo;
  team2: TeamInfo;
  prediction: MatchPrediction;
  winner: TeamInfo;
}

export interface KnockoutBracket {
  qf: [BracketMatch, BracketMatch, BracketMatch, BracketMatch];
  sf: [BracketMatch, BracketMatch];
  final: BracketMatch;
  champion: TeamInfo;
}

function bMatchup(t1: TeamInfo, t2: TeamInfo): BracketMatch {
  const prediction = predictMatch(t1, t2, { isKnockout: true });
  const winner = prediction.team1Win >= prediction.team2Win ? t1 : t2;
  return { team1: t1, team2: t2, prediction, winner };
}

export function simulateKnockoutBracket(seeds?: TeamInfo[]): KnockoutBracket {
  const s = seeds ?? TEAM_ARRAY.slice(0, 8);
  const qf1 = bMatchup(s[0], s[7]);
  const qf2 = bMatchup(s[3], s[4]);
  const qf3 = bMatchup(s[1], s[6]);
  const qf4 = bMatchup(s[2], s[5]);
  const sf1 = bMatchup(qf1.winner, qf2.winner);
  const sf2 = bMatchup(qf3.winner, qf4.winner);
  const final = bMatchup(sf1.winner, sf2.winner);
  return { qf: [qf1, qf2, qf3, qf4], sf: [sf1, sf2], final, champion: final.winner };
}

// ─── Head-to-Head breakdown ───────────────────────────────────────────────

export function headToHead(code1: string, code2: string): HeadToHeadResult | null {
  const team1 = TEAMS[code1.toUpperCase()];
  const team2 = TEAMS[code2.toUpperCase()];
  if (!team1 || !team2) return null;

  const prediction = predictMatch(team1, team2);
  const allOdds = computeTournamentOdds();
  const odds1 = allOdds.find((o) => o.code === team1.code)?.winPct ?? 0;
  const odds2 = allOdds.find((o) => o.code === team2.code)?.winPct ?? 0;

  const factors: Factor[] = [
    {
      label: "FIFA ELO Rating",
      advantage: team1.elo > team2.elo ? "team1" : team1.elo < team2.elo ? "team2" : "neutral",
      detail: `${team1.name} ${team1.elo} vs ${team2.name} ${team2.elo} (+${Math.abs(team1.elo - team2.elo)} ELO gap)`,
    },
    {
      label: "Host Nation Boost",
      advantage: team1.isHost ? "team1" : team2.isHost ? "team2" : "neutral",
      detail: team1.isHost
        ? `${team1.name} get +75 ELO home crowd advantage`
        : team2.isHost
        ? `${team2.name} get +75 ELO home crowd advantage`
        : "Neither team is a host nation",
    },
    {
      label: "Tournament Pedigree",
      advantage:
        team1.fifaRank < team2.fifaRank - 5 ? "team1" :
        team2.fifaRank < team1.fifaRank - 5 ? "team2" : "neutral",
      detail: `${team1.name} FIFA #${team1.fifaRank} vs ${team2.name} FIFA #${team2.fifaRank}`,
    },
    {
      label: "Tournament Win Odds",
      advantage: odds1 > odds2 ? "team1" : odds2 > odds1 ? "team2" : "neutral",
      detail: `${team1.name} ${odds1}% vs ${team2.name} ${odds2}% to win WC 2026`,
    },
  ];

  return { team1, team2, prediction, factors, tournamentOdds1: odds1, tournamentOdds2: odds2 };
}

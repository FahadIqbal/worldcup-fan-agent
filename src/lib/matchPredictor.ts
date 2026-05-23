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

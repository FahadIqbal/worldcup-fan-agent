"use client";
// src/components/FixturesPanel.tsx — WC 2026 fixtures + AI win predictions

import { useEffect, useState, useMemo } from "react";
import {
  predictMatch,
  computeTournamentOdds,
  computeGroupStandings,
  simulateKnockoutBracket,
  headToHead,
  type MatchPrediction,
  type TournamentOdds,
  type GroupStanding,
  type BracketMatch,
  type KnockoutBracket,
} from "@/lib/matchPredictor";
import { TEAMS, TEAM_ARRAY, type TeamInfo } from "@/data/teamStrengths";
import type { FixtureData, FixtureMatch } from "@/app/api/fixtures/route";

interface FixturesPanelProps {
  onAskAgent?: (prompt: string) => void;
}

type SubTab = "schedule" | "standings" | "predictions" | "bracket" | "h2h";

// ─── Utility ──────────────────────────────────────────────────────────────

function formatMatchDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return "Finished";
  if (days === 0) return "Today!";
  if (days === 1) return "Tomorrow";
  return `In ${days}d`;
}

// ─── Match card with prediction bar ─────────────────────────────────────

function PredictionBar({ pred, compact = false }: { pred: MatchPrediction; compact?: boolean }) {
  const { team1Win, draw, team2Win } = pred;
  const barH = compact ? 5 : 8;

  return (
    <div>
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 4 }}>
          <span style={{ color: team1Win > team2Win ? "#00c896" : "#94a3b8", fontWeight: team1Win > team2Win ? 700 : 400 }}>
            {team1Win}%
          </span>
          {draw > 0 && <span style={{ color: "#64748b" }}>{draw}% draw</span>}
          <span style={{ color: team2Win > team1Win ? "#00c896" : "#94a3b8", fontWeight: team2Win > team1Win ? 700 : 400 }}>
            {team2Win}%
          </span>
        </div>
      )}
      <div style={{ display: "flex", height: barH, borderRadius: 4, overflow: "hidden", gap: 1 }}>
        <div style={{ width: `${team1Win}%`, background: team1Win > team2Win ? "#00c896" : "#1e3a2e", transition: "width 0.8s ease" }} />
        {draw > 0 && <div style={{ width: `${draw}%`, background: "#1e2d50" }} />}
        <div style={{ width: `${team2Win}%`, background: team2Win > team1Win ? "#0ea5e9" : "#0a1a2e", transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

function MatchCard({ match, onAskAgent }: { match: FixtureMatch; onAskAgent?: (p: string) => void }) {
  const team1 = TEAMS[match.team1Code];
  const team2 = TEAMS[match.team2Code];
  if (!team1 || !team2) return null;

  const pred = predictMatch(team1, team2);
  const timeLabel = daysUntil(match.date);
  const isLive = match.status === "live";
  const confColor = pred.confidence === "high" ? "#00c896" : pred.confidence === "medium" ? "#f59e0b" : "#94a3b8";

  return (
    <div style={{
      background: isLive ? "#0a1a0f" : "#0d1421",
      border: `1px solid ${isLive ? "#00c89666" : "#1e2d50"}`,
      borderRadius: 12, padding: "14px 16px",
      transition: "border-color 0.2s",
      animation: "fadeUp 0.25s ease",
    }}>
      {/* Match meta */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 10, color: "#64748b" }}>
        <span>{match.group ?? match.round} · {match.city}</span>
        <span style={{ color: isLive ? "#00c896" : timeLabel === "Today!" ? "#f59e0b" : "#64748b", fontWeight: isLive || timeLabel === "Today!" ? 700 : 400 }}>
          {isLive ? "🔴 LIVE" : timeLabel}
        </span>
      </div>

      {/* Teams */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
        {/* Team 1 */}
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 22, marginBottom: 3 }}>{team1.flag}</div>
          <div style={{ color: pred.team1Win > pred.team2Win ? "#f1f5f9" : "#94a3b8", fontSize: 13, fontWeight: 700 }}>
            {team1.name}
          </div>
          <div style={{ color: "#334155", fontSize: 10 }}>#{team1.fifaRank}</div>
        </div>

        {/* Score or VS */}
        <div style={{ padding: "0 12px", textAlign: "center" }}>
          {match.score ? (
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>
              {match.score.team1} – {match.score.team2}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>VS</div>
          )}
          <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>
            {new Date(match.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
          </div>
        </div>

        {/* Team 2 */}
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: 22, marginBottom: 3 }}>{team2.flag}</div>
          <div style={{ color: pred.team2Win > pred.team1Win ? "#f1f5f9" : "#94a3b8", fontSize: 13, fontWeight: 700 }}>
            {team2.name}
          </div>
          <div style={{ color: "#334155", fontSize: 10 }}>#{team2.fifaRank}</div>
        </div>
      </div>

      {/* Prediction bar */}
      <PredictionBar pred={pred} />

      {/* AI label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 10, color: confColor }}>
          {pred.confidence === "high" ? "●" : pred.confidence === "medium" ? "◑" : "○"} {pred.label}
        </span>
        {onAskAgent && (
          <button
            onClick={() => onAskAgent(`Analyse the ${team1.name} vs ${team2.name} World Cup 2026 match — predicted lineup, key players, tactical breakdown and your prediction`)}
            style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 6,
              border: "1px solid #1e2d50", background: "transparent",
              color: "#64748b", cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#00c896"; (e.currentTarget as HTMLElement).style.color = "#00c896"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d50"; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
          >
            ⚽ Deep analysis →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Schedule tab ─────────────────────────────────────────────────────────

function ScheduleTab({ data, onAskAgent }: { data: FixtureData; onAskAgent?: (p: string) => void }) {
  const groups = Object.keys(data.groups).sort();
  const [activeGroup, setActiveGroup] = useState(groups[0] ?? "Group A");

  const groupMatches = useMemo(
    () => data.matches.filter((m) => m.group === activeGroup),
    [data.matches, activeGroup]
  );

  const groupTeams = (data.groups[activeGroup] ?? []).map((c) => TEAMS[c]).filter(Boolean) as TeamInfo[];

  return (
    <div>
      {/* Group selector */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {groups.map((g) => {
          const letter = g.replace("Group ", "");
          const active = g === activeGroup;
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: `1px solid ${active ? "#00c896" : "#1e2d50"}`,
                background: active ? "#00c89622" : "transparent",
                color: active ? "#00c896" : "#64748b", fontSize: 12, fontWeight: active ? 700 : 400,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Group teams mini row */}
      {groupTeams.length > 0 && (
        <div style={{
          display: "flex", gap: 8, padding: "10px 14px", borderRadius: 10,
          background: "#0a0f1e", border: "1px solid #1e2d50", marginBottom: 14,
        }}>
          {groupTeams.map((t) => (
            <div key={t.code} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 16 }}>{t.flag}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{t.name}</span>
              <span style={{ fontSize: 9, color: "#334155" }}>#{t.fifaRank}</span>
            </div>
          ))}
        </div>
      )}

      {/* Matches */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {groupMatches.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", padding: 20 }}>
            No fixtures available for this group yet.
          </div>
        ) : (
          groupMatches.map((m) => <MatchCard key={m.id} match={m} onAskAgent={onAskAgent} />)
        )}
      </div>

      {data.source === "fallback" && (
        <div style={{ marginTop: 12, fontSize: 10, color: "#334155", textAlign: "center" }}>
          ⚠ Using projected group data — live fixture data could not be fetched. Tap "Deep analysis" to get live match info from the agent.
        </div>
      )}
    </div>
  );
}

// ─── Predictions tab ──────────────────────────────────────────────────────

function PredictionsTab({ onAskAgent }: { onAskAgent?: (p: string) => void }) {
  const odds = useMemo(() => computeTournamentOdds(), []);
  const top10 = odds.slice(0, 10);
  const rest = odds.slice(10, 20);
  const max = top10[0]?.winPct ?? 1;

  const tierColors: Record<string, string> = {
    favourite: "#00c896",
    contender: "#0ea5e9",
    outsider:  "#f59e0b",
    longshot:  "#64748b",
  };

  return (
    <div>
      <div style={{ color: "#64748b", fontSize: 10, marginBottom: 14, letterSpacing: 1 }}>
        🏆 TOURNAMENT WIN PROBABILITY — ELO MODEL · {odds.length} TEAMS
      </div>

      {/* Podium top 3 */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, marginBottom: 24, height: 110 }}>
        {[top10[1], top10[0], top10[2]].map((team, i) => {
          if (!team) return null;
          const heights = [80, 110, 65];
          const labels = ["2nd", "1st", "3rd"];
          const colors = ["#94a3b8", "#f59e0b", "#cd7c32"];
          return (
            <div key={team.code} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{team.flag}</div>
              <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 700, marginBottom: 2 }}>{team.name}</div>
              <div style={{ fontSize: 13, color: colors[i], fontWeight: 800 }}>{team.winPct}%</div>
              <div style={{
                height: heights[i], background: colors[i] + "33",
                border: `1px solid ${colors[i]}66`, borderRadius: "6px 6px 0 0",
                marginTop: 4, display: "flex", alignItems: "flex-end",
                justifyContent: "center", paddingBottom: 6, minWidth: 70,
              }}>
                <span style={{ fontSize: 10, color: colors[i] }}>{labels[i]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full table top 10 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {top10.map((team, i) => {
          const color = tierColors[team.tier];
          const barW = (team.winPct / max) * 100;
          return (
            <div key={team.code} style={{
              background: "#0d1421", border: "1px solid #1e2d50",
              borderRadius: 10, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ color: "#334155", fontSize: 11, width: 18, flexShrink: 0 }}>#{i + 1}</span>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{team.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{team.name}</span>
                  <span style={{ fontSize: 12, color, fontWeight: 700 }}>{team.winPct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "#0a0f1e", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${barW}%`, borderRadius: 3,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    transition: "width 0.8s ease",
                  }} />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 9, color: "#334155" }}>
                  <span>Top 4: {team.top4Pct}%</span>
                  <span>QF: {team.top8Pct}%</span>
                  <span style={{ marginLeft: "auto", color, textTransform: "uppercase", fontWeight: 600 }}>{team.tier}</span>
                </div>
              </div>
              {onAskAgent && (
                <button
                  onClick={() => onAskAgent(`What are ${team.name}'s chances of winning the 2026 World Cup? Analyse their squad, draw, potential path to the final, and key threats.`)}
                  style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 6, border: "1px solid #1e2d50",
                    background: "transparent", color: "#64748b", cursor: "pointer", fontFamily: "inherit",
                    flexShrink: 0, transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = color; (e.currentTarget as HTMLElement).style.borderColor = color; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748b"; (e.currentTarget as HTMLElement).style.borderColor = "#1e2d50"; }}
                >
                  Analyse →
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Contenders 11-20 */}
      <div style={{ color: "#334155", fontSize: 10, marginBottom: 8 }}>CONTENDERS (11–20)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {rest.map((team) => (
          <div key={team.code} style={{
            background: "#0a0f1e", border: "1px solid #1e2d50",
            borderRadius: 8, padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>{team.flag}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{team.name}</span>
            <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>{team.winPct}%</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, fontSize: 10, color: "#334155", lineHeight: 1.6 }}>
        💡 Probabilities computed using ELO ratings with host-nation boost (+75) for USA, Canada, Mexico.
        Softmax model over all 48 qualified teams. Not a betting product.
      </div>
    </div>
  );
}

// ─── Head-to-Head tab ─────────────────────────────────────────────────────

function HeadToHeadTab({ onAskAgent }: { onAskAgent?: (p: string) => void }) {
  const [team1Code, setTeam1Code] = useState("ARG");
  const [team2Code, setTeam2Code] = useState("FRA");
  const [isKnockout, setIsKnockout] = useState(false);

  const team1 = TEAMS[team1Code];
  const team2 = TEAMS[team2Code];
  const pred = team1 && team2 ? predictMatch(team1, team2, { isKnockout }) : null;
  const h2h = team1 && team2 ? headToHead(team1Code, team2Code) : null;

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    background: "#0a0f1e", border: "1px solid #1e2d50",
    color: "#e2e8f0", fontSize: 13, fontFamily: "inherit",
    outline: "none", cursor: "pointer",
  };

  const factorColor = (adv: "team1" | "team2" | "neutral") =>
    adv === "team1" ? "#00c896" : adv === "team2" ? "#0ea5e9" : "#64748b";

  return (
    <div>
      <div style={{ color: "#64748b", fontSize: 10, marginBottom: 14, letterSpacing: 1 }}>
        ⚔ PICK ANY TWO TEAMS — GET AI PREDICTION
      </div>

      {/* Team selectors */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>Team 1</div>
          <select value={team1Code} onChange={(e) => setTeam1Code(e.target.value)} style={selectStyle}>
            {TEAM_ARRAY.map((t) => (
              <option key={t.code} value={t.code}>{t.flag} {t.name} (#{t.fifaRank})</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 18, color: "#334155", fontWeight: 700, marginTop: 16 }}>VS</div>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>Team 2</div>
          <select value={team2Code} onChange={(e) => setTeam2Code(e.target.value)} style={selectStyle}>
            {TEAM_ARRAY.map((t) => (
              <option key={t.code} value={t.code}>{t.flag} {t.name} (#{t.fifaRank})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Knockout toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => setIsKnockout((v) => !v)}
          style={{
            padding: "5px 14px", borderRadius: 20,
            border: `1px solid ${isKnockout ? "#f59e0b" : "#1e2d50"}`,
            background: isKnockout ? "#f59e0b22" : "transparent",
            color: isKnockout ? "#f59e0b" : "#64748b",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {isKnockout ? "⚡ Knockout mode (no draws)" : "⚽ Group stage mode"}
        </button>
      </div>

      {pred && team1 && team2 && (
        <div style={{ background: "#0d1421", border: "1px solid #00c89633", borderRadius: 14, padding: "20px 18px", marginBottom: 14 }}>
          {/* Teams header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{team1.flag}</div>
              <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>{team1.name}</div>
              <div style={{ color: "#64748b", fontSize: 10 }}>ELO {team1.elo} · #{team1.fifaRank}</div>
              <div style={{ fontSize: 28, color: "#00c896", fontWeight: 800, marginTop: 8 }}>{pred.team1Win}%</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>win chance</div>
            </div>

            {!isKnockout && pred.draw > 0 && (
              <div style={{ textAlign: "center", padding: "0 8px" }}>
                <div style={{ fontSize: 18, color: "#334155", fontWeight: 700 }}>=</div>
                <div style={{ fontSize: 20, color: "#64748b", fontWeight: 800 }}>{pred.draw}%</div>
                <div style={{ fontSize: 9, color: "#334155" }}>draw</div>
              </div>
            )}

            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{team2.flag}</div>
              <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>{team2.name}</div>
              <div style={{ color: "#64748b", fontSize: 10 }}>ELO {team2.elo} · #{team2.fifaRank}</div>
              <div style={{ fontSize: 28, color: "#0ea5e9", fontWeight: 800, marginTop: 8 }}>{pred.team2Win}%</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>win chance</div>
            </div>
          </div>

          <PredictionBar pred={pred} />

          {/* Verdict */}
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 8,
            background: "#0a0f1e", border: "1px solid #1e2d50",
            fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, textAlign: "center",
          }}>
            🔮 {pred.label}
          </div>

          {/* Factors breakdown */}
          {h2h && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, letterSpacing: 1 }}>KEY FACTORS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {h2h.factors.map((f) => (
                  <div key={f.label} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "8px 12px", borderRadius: 8,
                    background: "#060b14", border: `1px solid ${factorColor(f.advantage)}22`,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 3,
                      background: factorColor(f.advantage),
                      boxShadow: `0 0 5px ${factorColor(f.advantage)}`,
                    }} />
                    <div>
                      <div style={{ fontSize: 11, color: factorColor(f.advantage), fontWeight: 600, marginBottom: 2 }}>
                        {f.label}
                        {f.advantage === "team1" && <span style={{ color: "#64748b", fontWeight: 400 }}> → {team1.name}</span>}
                        {f.advantage === "team2" && <span style={{ color: "#64748b", fontWeight: 400 }}> → {team2.name}</span>}
                        {f.advantage === "neutral" && <span style={{ color: "#64748b", fontWeight: 400 }}> → Even</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{f.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ask agent CTA */}
          {onAskAgent && (
            <button
              onClick={() => onAskAgent(`Give me a deep-dive prediction for ${team1.name} vs ${team2.name} at the 2026 World Cup — expected lineup, tactical analysis, key players, historical record, and your match prediction with score.`)}
              style={{
                width: "100%", marginTop: 14, padding: "10px", borderRadius: 10,
                border: "1px solid #00c89666",
                background: "linear-gradient(135deg, #00c89611, #0ea5e911)",
                color: "#00c896", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #00c89622, #0ea5e922)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #00c89611, #0ea5e911)"; }}
            >
              ⚽ Get full AI match analysis for {team1.name} vs {team2.name} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Standings tab ────────────────────────────────────────────────────────

function StandingsTab({ data, onAskAgent }: { data: FixtureData; onAskAgent?: (p: string) => void }) {
  const groups = Object.keys(data.groups).sort();
  const [activeGroup, setActiveGroup] = useState(groups[0] ?? "Group A");

  const teamCodes = data.groups[activeGroup] ?? [];
  const standings = useMemo(() => computeGroupStandings(teamCodes), [teamCodes.join(",")]);

  return (
    <div>
      {/* Group selector */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {groups.map((g) => {
          const letter = g.replace("Group ", "");
          const active = g === activeGroup;
          return (
            <button key={g} onClick={() => setActiveGroup(g)} style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${active ? "#00c896" : "#1e2d50"}`,
              background: active ? "#00c89622" : "transparent",
              color: active ? "#00c896" : "#64748b",
              fontSize: 12, fontWeight: active ? 700 : 400,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}>
              {letter}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "20px 1fr 28px 28px 28px 28px 36px 40px",
          padding: "8px 14px", background: "#0a0f1e", borderBottom: "1px solid #1e2d50",
        }}>
          {["", "Team", "P", "W", "D", "L", "GD", "Pts"].map((h, i) => (
            <span key={i} style={{
              color: "#334155", fontSize: 9, textAlign: i >= 2 ? "center" : "left",
              letterSpacing: 0.8, fontWeight: 600,
            }}>{h}</span>
          ))}
        </div>

        {standings.map((s: GroupStanding, i: number) => {
          const qualified = i < 2;
          const third = i === 2;
          return (
            <div key={s.team.code} style={{
              display: "grid", gridTemplateColumns: "20px 1fr 28px 28px 28px 28px 36px 40px",
              padding: "10px 14px", borderBottom: "1px solid #1e2d5022",
              background: qualified ? "#0a1a0f" : "transparent",
              borderLeft: `3px solid ${qualified ? "#00c896" : third ? "#f59e0b44" : "transparent"}`,
              transition: "background 0.2s", animation: "fadeUp 0.25s ease",
            }}>
              <span style={{
                color: qualified ? "#00c896" : third ? "#f59e0b" : "#334155",
                fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center",
              }}>
                {qualified ? "✓" : i + 1}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{s.team.flag}</span>
                <div>
                  <div style={{ color: qualified ? "#f1f5f9" : "#94a3b8", fontSize: 12, fontWeight: qualified ? 700 : 400 }}>
                    {s.team.name}
                  </div>
                  <div style={{ color: "#334155", fontSize: 9 }}>FIFA #{s.team.fifaRank}</div>
                </div>
              </div>
              {[s.played, s.won, s.drawn, s.lost,
                s.gd > 0 ? `+${s.gd}` : String(s.gd), s.pts].map((v, j) => (
                <span key={j} style={{
                  textAlign: "center", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  color: j === 5 ? (qualified ? "#00c896" : "#f1f5f9") : j === 4 ? (s.gd > 0 ? "#00c896" : s.gd < 0 ? "#ef4444" : "#64748b") : "#94a3b8",
                  fontWeight: j === 5 ? 800 : 400,
                }}>
                  {v}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 10, marginBottom: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#00c896" }}>
          <span style={{ width: 10, height: 3, background: "#00c896", borderRadius: 2, display: "inline-block" }} />
          Top 2 qualify
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#f59e0b" }}>
          <span style={{ width: 10, height: 3, background: "#f59e0b", borderRadius: 2, display: "inline-block" }} />
          Best 3rd contender
        </span>
      </div>
      <div style={{ fontSize: 10, color: "#334155", marginBottom: 12 }}>
        📊 Projected standings based on ELO prediction model — not actual match results.
      </div>

      {onAskAgent && (
        <button
          onClick={() => onAskAgent(`Analyse ${activeGroup} at the 2026 World Cup — who are the favourites, key clashes, and how will the final standings look?`)}
          style={{
            padding: "7px 14px", borderRadius: 8, border: "1px solid #00c89644",
            background: "transparent", color: "#00c896", fontSize: 11,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#00c89611"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          ⚽ Ask agent to analyse {activeGroup} →
        </button>
      )}
    </div>
  );
}

// ─── Bracket tab ──────────────────────────────────────────────────────────

function BracketMatchCard({ match, showWinner }: { match: BracketMatch; showWinner: boolean }) {
  return (
    <div style={{
      background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 10,
      padding: "10px 12px", marginBottom: 8,
    }}>
      {([match.team1, match.team2] as const).map((team, i) => {
        const isWinner = showWinner && team.code === match.winner.code;
        const chance = i === 0 ? match.prediction.team1Win : match.prediction.team2Win;
        return (
          <div key={team.code} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
            borderBottom: i === 0 ? "1px solid #1e2d5033" : undefined,
            opacity: showWinner && !isWinner ? 0.4 : 1,
            transition: "opacity 0.2s",
          }}>
            <span style={{ fontSize: 17 }}>{team.flag}</span>
            <span style={{ flex: 1, color: isWinner ? "#00c896" : "#e2e8f0", fontSize: 12, fontWeight: isWinner ? 700 : 400 }}>
              {team.name}
            </span>
            <span style={{ fontSize: 10, color: "#64748b" }}>{chance}%</span>
            {isWinner && <span style={{ color: "#00c896", fontSize: 11 }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}

function BracketTab({ onAskAgent }: { onAskAgent?: (p: string) => void }) {
  const bracket = useMemo((): KnockoutBracket => simulateKnockoutBracket(), []);

  return (
    <div>
      <div style={{ color: "#64748b", fontSize: 10, marginBottom: 16, letterSpacing: 1 }}>
        🏆 PREDICTED KNOCKOUT BRACKET — ELO MODEL · TOP 8 SEEDS · KNOCKOUT RULES
      </div>

      {/* QF */}
      <div style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
        ⚡ QUARTER-FINALS
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {bracket.qf.map((m, i) => <BracketMatchCard key={i} match={m} showWinner />)}
      </div>

      {/* SF */}
      <div style={{ color: "#0ea5e9", fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
        🔥 SEMI-FINALS
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {bracket.sf.map((m, i) => <BracketMatchCard key={i} match={m} showWinner />)}
      </div>

      {/* Final */}
      <div style={{ color: "#00c896", fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
        🏆 FINAL
      </div>
      <div style={{
        background: "linear-gradient(135deg, #0a1a0f, #0d1421)",
        border: "1px solid #00c89644", borderRadius: 14, padding: "16px",
        boxShadow: "0 0 24px #00c89618", marginBottom: 14,
      }}>
        <BracketMatchCard match={bracket.final} showWinner={false} />

        {/* Champion display */}
        <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
          <div style={{ fontSize: 52, marginBottom: 8, filter: "drop-shadow(0 0 20px #f59e0b66)", animation: "pulse 2s ease infinite" }}>
            {bracket.champion.flag}
          </div>
          <div style={{ color: "#f59e0b", fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
            {bracket.champion.name}
          </div>
          <div style={{
            display: "inline-block", marginTop: 8, padding: "3px 14px", borderRadius: 20,
            background: "#f59e0b22", border: "1px solid #f59e0b44",
            color: "#f59e0b", fontSize: 10, letterSpacing: 1, fontWeight: 700,
          }}>
            🏆 PREDICTED CHAMPION
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: "#334155", lineHeight: 1.6, marginBottom: 12 }}>
        💡 Seeded by ELO rating. 1v8, 4v5 (top half) · 2v7, 3v6 (bottom half). Draws not possible in knockout.
        Not a betting product.
      </div>

      {onAskAgent && (
        <button
          onClick={() => onAskAgent(`Analyse the predicted 2026 World Cup knockout bracket — who has the easiest path, who faces the toughest draw, and is ${bracket.champion.name} genuinely the most likely champion?`)}
          style={{
            width: "100%", padding: "10px", borderRadius: 10,
            border: "1px solid #00c89666",
            background: "linear-gradient(135deg, #00c89611, #0ea5e911)",
            color: "#00c896", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #00c89622, #0ea5e922)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #00c89611, #0ea5e911)"; }}
        >
          ⚽ Get full AI tournament bracket analysis →
        </button>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────

export default function FixturesPanel({ onAskAgent }: FixturesPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("schedule");
  const [fixtures, setFixtures] = useState<FixtureData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try localStorage cache first (30 min)
    const cached = typeof window !== "undefined" ? localStorage.getItem("wc2026_fixtures") : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as FixtureData & { _cacheTs: number };
        if (Date.now() - parsed._cacheTs < 30 * 60 * 1000) {
          setFixtures(parsed);
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }
    }

    fetch("/api/fixtures")
      .then((r) => r.json())
      .then((d: FixtureData) => {
        setFixtures(d);
        if (typeof window !== "undefined") {
          localStorage.setItem("wc2026_fixtures", JSON.stringify({ ...d, _cacheTs: Date.now() }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const SUB_TABS: Array<{ id: SubTab; label: string }> = [
    { id: "schedule",    label: "📅 Schedule" },
    { id: "standings",   label: "📊 Standings" },
    { id: "predictions", label: "🏆 Predictions" },
    { id: "bracket",     label: "⚡ Bracket" },
    { id: "h2h",         label: "⚔ H2H" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'DM Mono', monospace" }}>
      {/* Sub-tab bar */}
      <div style={{
        display: "flex", borderBottom: "1px solid #1e2d50",
        background: "#060b14", flexShrink: 0, padding: "0 16px",
      }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: "10px 14px", background: "transparent", border: "none",
              borderBottom: subTab === t.id ? "2px solid #00c896" : "2px solid transparent",
              color: subTab === t.id ? "#00c896" : "#64748b",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {subTab === "schedule" && (
            loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 120, background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 12, animation: "shimmer 1.5s ease infinite" }} />
                ))}
              </div>
            ) : fixtures ? (
              <ScheduleTab data={fixtures} onAskAgent={onAskAgent} />
            ) : (
              <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
                Could not load fixture schedule. Try refreshing.
              </div>
            )
          )}

          {subTab === "standings" && (
            loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ height: 44, background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 8, animation: "shimmer 1.5s ease infinite" }} />
                ))}
              </div>
            ) : fixtures ? (
              <StandingsTab data={fixtures} onAskAgent={onAskAgent} />
            ) : (
              <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
                Could not load standings data. Try refreshing.
              </div>
            )
          )}
          {subTab === "predictions" && <PredictionsTab onAskAgent={onAskAgent} />}
          {subTab === "bracket" && <BracketTab onAskAgent={onAskAgent} />}
          {subTab === "h2h" && <HeadToHeadTab onAskAgent={onAskAgent} />}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

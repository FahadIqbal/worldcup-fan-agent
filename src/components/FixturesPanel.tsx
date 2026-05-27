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
  const barH = compact ? 4 : 7;

  return (
    <div>
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, fontFamily: "var(--font-mono)" }}>
          <span style={{ color: team1Win > team2Win ? "var(--accent)" : "var(--text2)", fontWeight: team1Win > team2Win ? 700 : 400 }}>
            {team1Win}%
          </span>
          {draw > 0 && <span style={{ color: "var(--text3)" }}>{draw}% draw</span>}
          <span style={{ color: team2Win > team1Win ? "var(--blue, #38bdf8)" : "var(--text2)", fontWeight: team2Win > team1Win ? 700 : 400 }}>
            {team2Win}%
          </span>
        </div>
      )}
      <div style={{ display: "flex", height: barH, borderRadius: 4, overflow: "hidden", gap: 1, background: "var(--bg, #060b14)" }}>
        <div style={{ width: `${team1Win}%`, background: team1Win > team2Win ? "var(--accent)" : "var(--surface3, #152438)", transition: "width 0.8s ease", borderRadius: "4px 0 0 4px" }} />
        {draw > 0 && <div style={{ width: `${draw}%`, background: "var(--border2, #243a55)" }} />}
        <div style={{ width: `${team2Win}%`, background: team2Win > team1Win ? "var(--blue, #38bdf8)" : "var(--surface2, #101f30)", transition: "width 0.8s ease", borderRadius: "0 4px 4px 0" }} />
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
  const confColor = pred.confidence === "high" ? "var(--accent)" : pred.confidence === "medium" ? "var(--yellow, #fbbf24)" : "var(--text2)";

  return (
    <div style={{
      background: isLive ? "rgba(0,200,150,0.07)" : "var(--surface, #0d1825)",
      border: `1px solid ${isLive ? "var(--accent-border)" : "var(--border, #1a2d4a)"}`,
      borderRadius: 12, padding: "14px 16px",
      transition: "border-color 0.2s, background 0.2s",
      animation: "fadeUp 0.25s ease",
      cursor: "default",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border2, #243a55)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = isLive ? "var(--accent-border)" : "var(--border, #1a2d4a)"; }}
    >
      {/* Match meta */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 11 }}>
        <span style={{ color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{match.group ?? match.round} · {match.city}</span>
        <span style={{
          color: isLive ? "var(--accent)" : timeLabel === "Today!" ? "var(--yellow, #fbbf24)" : "var(--text3)",
          fontWeight: isLive || timeLabel === "Today!" ? 600 : 400,
          fontFamily: "var(--font-mono)", fontSize: 10,
        }}>
          {isLive ? "● LIVE" : timeLabel}
        </span>
      </div>

      {/* Teams row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {/* Team 1 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 24 }}>{team1.flag}</span>
          <span style={{ color: pred.team1Win > pred.team2Win ? "var(--text)" : "var(--text2)", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
            {team1.name}
          </span>
          <span style={{ color: "var(--text4)", fontSize: 10, fontFamily: "var(--font-mono)" }}>FIFA #{team1.fifaRank}</span>
        </div>

        {/* VS / Score */}
        <div style={{ textAlign: "center", padding: "0 8px" }}>
          {match.score ? (
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-1px", fontFamily: "var(--font-mono)" }}>
              {match.score.team1}–{match.score.team2}
            </div>
          ) : (
            <div style={{
              fontSize: 10, fontWeight: 700, color: "var(--text3)",
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "3px 8px", fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
            }}>VS</div>
          )}
          <div style={{ fontSize: 9, color: "var(--text4)", marginTop: 3, fontFamily: "var(--font-mono)" }}>
            {new Date(match.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
          </div>
        </div>

        {/* Team 2 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
          <span style={{ fontSize: 24 }}>{team2.flag}</span>
          <span style={{ color: pred.team2Win > pred.team1Win ? "var(--text)" : "var(--text2)", fontSize: 13, fontWeight: 600, lineHeight: 1.2, textAlign: "right" }}>
            {team2.name}
          </span>
          <span style={{ color: "var(--text4)", fontSize: 10, fontFamily: "var(--font-mono)" }}>FIFA #{team2.fifaRank}</span>
        </div>
      </div>

      {/* Prediction bar */}
      <PredictionBar pred={pred} />

      {/* AI verdict */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
        <span style={{ fontSize: 10, color: confColor, display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: confColor, display: "inline-block", flexShrink: 0 }} />
          {pred.label}
        </span>
        {onAskAgent && (
          <button
            onClick={() => onAskAgent(`Analyse the ${team1.name} vs ${team2.name} World Cup 2026 match — predicted lineup, key players, tactical breakdown and your prediction`)}
            style={{
              fontSize: 10, padding: "3px 9px", borderRadius: 6,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text3)", cursor: "pointer",
              fontFamily: "var(--font-mono)", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border)";
              (e.currentTarget as HTMLElement).style.color = "var(--accent)";
              (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--text3)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            Deep analysis →
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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {groups.map((g) => {
          const letter = g.replace("Group ", "");
          const active = g === activeGroup;
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                width: 34, height: 34, borderRadius: 9,
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? "var(--accent-dim)" : "var(--surface)",
                color: active ? "var(--accent)" : "var(--text2)",
                fontSize: 12, fontWeight: active ? 700 : 500,
                cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all 0.15s",
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
          display: "flex", gap: 10, padding: "10px 16px", borderRadius: 10,
          background: "var(--bg)", border: "1px solid var(--border)", marginBottom: 16,
          flexWrap: "wrap",
        }}>
          {groupTeams.map((t) => (
            <div key={t.code} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 17 }}>{t.flag}</span>
              <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>{t.name}</span>
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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {groups.map((g) => {
          const letter = g.replace("Group ", "");
          const active = g === activeGroup;
          return (
            <button key={g} onClick={() => setActiveGroup(g)} style={{
              width: 34, height: 34, borderRadius: 9,
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              background: active ? "var(--accent-dim)" : "var(--surface)",
              color: active ? "var(--accent)" : "var(--text2)",
              fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; } }}
            onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text2)"; } }}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "22px 1fr 30px 30px 30px 30px 38px 44px",
          padding: "9px 16px", background: "var(--bg)", borderBottom: "1px solid var(--border)",
        }}>
          {["", "Team", "P", "W", "D", "L", "GD", "Pts"].map((h, i) => (
            <span key={i} style={{
              color: "var(--text4)", fontSize: 10, textAlign: i >= 2 ? "center" : "left",
              letterSpacing: "0.08em", fontWeight: 600, fontFamily: "var(--font-mono)",
            }}>{h}</span>
          ))}
        </div>

        {standings.map((s: GroupStanding, i: number) => {
          const qualified = i < 2;
          const third = i === 2;
          return (
            <div key={s.team.code} style={{
              display: "grid", gridTemplateColumns: "22px 1fr 30px 30px 30px 30px 38px 44px",
              padding: "11px 16px", borderBottom: "1px solid var(--border)",
              background: qualified ? "rgba(0,200,150,0.04)" : "transparent",
              borderLeft: `3px solid ${qualified ? "var(--accent)" : third ? "rgba(251,191,36,0.4)" : "transparent"}`,
              transition: "background 0.2s", animation: "fadeUp 0.25s ease",
            }}>
              <span style={{
                color: qualified ? "var(--accent)" : third ? "var(--yellow, #fbbf24)" : "var(--text4)",
                fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center",
                fontFamily: "var(--font-mono)",
              }}>
                {qualified ? "✓" : i + 1}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 17 }}>{s.team.flag}</span>
                <div>
                  <div style={{ color: qualified ? "var(--text)" : "var(--text2)", fontSize: 13, fontWeight: qualified ? 600 : 400, lineHeight: 1.2 }}>
                    {s.team.name}
                  </div>
                  <div style={{ color: "var(--text4)", fontSize: 9.5, fontFamily: "var(--font-mono)" }}>FIFA #{s.team.fifaRank}</div>
                </div>
              </div>
              {[s.played, s.won, s.drawn, s.lost,
                s.gd > 0 ? `+${s.gd}` : String(s.gd), s.pts].map((v, j) => (
                <span key={j} style={{
                  textAlign: "center", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  color: j === 5 ? (qualified ? "var(--accent)" : "var(--text)")
                       : j === 4 ? (s.gd > 0 ? "var(--accent)" : s.gd < 0 ? "var(--red, #f87171)" : "var(--text3)")
                       : "var(--text2)",
                  fontWeight: j === 5 ? 700 : 400,
                }}>
                  {v}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 11, marginBottom: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)" }}>
          <span style={{ width: 12, height: 3, background: "var(--accent)", borderRadius: 2, display: "inline-block" }} />
          Top 2 qualify
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--yellow, #fbbf24)" }}>
          <span style={{ width: 12, height: 3, background: "var(--yellow, #fbbf24)", borderRadius: 2, display: "inline-block" }} />
          Best 3rd contender
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text4)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
        📊 Projected standings based on ELO prediction model — not actual match results.
      </div>

      {onAskAgent && (
        <button
          onClick={() => onAskAgent(`Analyse ${activeGroup} at the 2026 World Cup — who are the favourites, key clashes, and how will the final standings look?`)}
          style={{
            padding: "8px 16px", borderRadius: 9, border: "1px solid var(--accent-border)",
            background: "var(--accent-dim)", color: "var(--accent)", fontSize: 12,
            cursor: "pointer", fontFamily: "var(--font-sans)", fontWeight: 500,
            transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,200,150,0.12)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)"; }}
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      {/* Sub-tab bar */}
      <div style={{
        display: "flex", borderBottom: "1px solid var(--border, #1a2d4a)",
        background: "rgba(6,11,20,0.8)", flexShrink: 0,
        padding: "6px 16px 0", gap: 2, overflowX: "auto", scrollbarWidth: "none",
      }}>
        {SUB_TABS.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              style={{
                padding: "7px 13px 9px", background: active ? "var(--accent-dim)" : "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                borderRadius: "7px 7px 0 0",
                color: active ? "var(--accent)" : "var(--text3)",
                fontSize: 11.5, fontWeight: active ? 600 : 400,
                cursor: "pointer", fontFamily: "var(--font-sans)",
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text2)"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text3)"; }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 28px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {subTab === "schedule" && (
            loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 130, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, animation: "shimmer 1.5s ease infinite", opacity: 0.6 }} />
                ))}
              </div>
            ) : fixtures ? (
              <ScheduleTab data={fixtures} onAskAgent={onAskAgent} />
            ) : (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: 40 }}>
                Could not load fixture schedule. Try refreshing.
              </div>
            )
          )}

          {subTab === "standings" && (
            loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ height: 48, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, animation: "shimmer 1.5s ease infinite", opacity: 0.6 }} />
                ))}
              </div>
            ) : fixtures ? (
              <StandingsTab data={fixtures} onAskAgent={onAskAgent} />
            ) : (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: 40 }}>
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

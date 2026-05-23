"use client";
// src/components/FantasyPanel.tsx — Fantasy league picks dashboard

import { useEffect, useState } from "react";

interface FantasyProfile {
  id: string;
  platform: string;
  budget: number | null;
  team: FantasyPlayer[] | null;
  updated_at: string;
}

interface FantasyPlayer {
  name: string;
  team: string;
  position: string;
  price?: number;
  form?: string;
  fitness?: "fit" | "doubt" | "out";
  isCaptain?: boolean;
}

const PLATFORM_ICONS: Record<string, string> = {
  fpl: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  dream11: "🇮🇳",
  sorare: "🃏",
  custom: "⚽",
};

const FITNESS_COLORS: Record<string, string> = {
  fit: "#00c896",
  doubt: "#f59e0b",
  out: "#ef4444",
};

const QUICK_ASKS = [
  "Should I captain Mbappe or Vinicius Jr this gameweek?",
  "Who are the best value midfielders from Group A teams?",
  "Any injury concerns for Argentina players?",
  "Best differential picks for the World Cup quarterfinals?",
];

interface FantasyPanelProps {
  userId: string;
  onAskAgent?: (prompt: string) => void;
}

export default function FantasyPanel({ userId, onAskAgent }: FantasyPanelProps) {
  const [profile, setProfile] = useState<FantasyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trips?userId=${encodeURIComponent(userId)}`)
      .then(() => {
        // Fantasy profile would come from a dedicated endpoint;
        // for now we show the empty state with quick-ask shortcuts.
        setProfile(null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
        Loading fantasy data…
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, marginBottom: 20 }}>
          Fantasy League
        </h2>

        {/* Quick-ask shortcuts */}
        <div style={{
          background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 14,
          padding: "16px 20px", marginBottom: 20,
        }}>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 12 }}>
            🎯 QUICK ASK THE AGENT
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QUICK_ASKS.map((q) => (
              <button
                key={q}
                onClick={() => onAskAgent?.(q)}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "1px solid #1e2d50",
                  background: "#0a0f1e", color: "#94a3b8", fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#00c89666"; (e.currentTarget as HTMLElement).style.color = "#00c896"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d50"; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
              >
                ⚽ {q}
              </button>
            ))}
          </div>
        </div>

        {/* Squad viewer */}
        {profile && profile.team && profile.team.length > 0 ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>{PLATFORM_ICONS[profile.platform] ?? "⚽"}</span>
              <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>
                {profile.platform.toUpperCase()} Squad
              </span>
              {profile.budget && (
                <span style={{ marginLeft: "auto", color: "#00c896", fontSize: 13 }}>
                  Budget remaining: ${profile.budget.toLocaleString()}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {profile.team.map((player) => (
                <PlayerCard key={player.name} player={player} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 14,
            padding: "32px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>No squad saved yet.</div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
              Ask the agent for fantasy advice and it will save your squad picks here.
              <br />Supports FPL, Dream11, Sorare, and custom leagues.
            </div>
          </div>
        )}

        {/* Advice note */}
        <div style={{
          marginTop: 20, padding: "12px 16px", borderRadius: 10,
          background: "#0a1a12", border: "1px solid #00c89622",
          color: "#64748b", fontSize: 11, lineHeight: 1.6,
        }}>
          💡 The agent uses live injury news, upcoming fixture difficulty, and form data
          to give you fantasy picks. Use the chat tab or the quick-ask buttons above to get advice.
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ player }: { player: FantasyPlayer }) {
  const fitnessColor = player.fitness ? FITNESS_COLORS[player.fitness] : "#64748b";

  return (
    <div style={{
      background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10,
      padding: "10px 14px", position: "relative",
    }}>
      {player.isCaptain && (
        <span style={{
          position: "absolute", top: 8, right: 8,
          fontSize: 10, padding: "1px 6px", borderRadius: 10,
          background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44",
        }}>
          C
        </span>
      )}

      <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>{player.name}</div>
      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
        {player.team} · {player.position}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        {player.fitness && (
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 6,
            background: fitnessColor + "22", color: fitnessColor,
          }}>
            {player.fitness === "fit" ? "✓ Fit" : player.fitness === "doubt" ? "⚠ Doubt" : "✗ Out"}
          </span>
        )}
        {player.price && (
          <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
            ${player.price}m
          </span>
        )}
      </div>
    </div>
  );
}

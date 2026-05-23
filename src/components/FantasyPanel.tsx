"use client";
// src/components/FantasyPanel.tsx — Fantasy league dashboard with pitch formation and WC countdown

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
  fpl: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", dream11: "🇮🇳", sorare: "🃏", custom: "⚽",
};
const PLATFORM_LABELS: Record<string, string> = {
  fpl: "Fantasy Premier League", dream11: "Dream11", sorare: "Sorare", custom: "Custom League",
};
const FITNESS_COLORS: Record<string, string> = {
  fit: "#00c896", doubt: "#f59e0b", out: "#ef4444",
};

const WC_START = new Date("2026-06-11T18:00:00Z");

function daysToWC(): number {
  return Math.max(0, Math.ceil((WC_START.getTime() - Date.now()) / 86400000));
}

function WCCountdown() {
  const days = daysToWC();
  const urgency = days <= 7 ? "#ef4444" : days <= 21 ? "#f59e0b" : "#00c896";
  return (
    <div style={{
      background: `linear-gradient(135deg, ${urgency}18, ${urgency}08)`,
      border: `1px solid ${urgency}44`,
      borderRadius: 14, padding: "14px 18px", marginBottom: 18,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ fontSize: 28, filter: `drop-shadow(0 0 10px ${urgency})` }}>🏆</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: urgency, fontSize: 22, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>
          {days} days
        </div>
        <div style={{ color: "#94a3b8", fontSize: 11 }}>
          until World Cup 2026 kicks off · June 11, USA/Canada/Mexico
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontSize: 10, padding: "3px 10px", borderRadius: 20,
          background: urgency + "22", color: urgency,
          border: `1px solid ${urgency}44`, fontWeight: 700,
        }}>
          {days <= 7 ? "🚨 FINAL DAYS" : days <= 21 ? "⚡ LOCK IN SQUAD" : "PLAN AHEAD"}
        </div>
      </div>
    </div>
  );
}

function FormStars({ form }: { form: string | undefined }) {
  if (!form) return null;
  const score = parseFloat(form);
  const filled = Math.round(Math.min(5, score));
  return (
    <span style={{ fontSize: 9, letterSpacing: -1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < filled ? "#f59e0b" : "#1e2d50" }}>★</span>
      ))}
    </span>
  );
}

function PitchFormation({ players }: { players: FantasyPlayer[] }) {
  const rows: Record<string, FantasyPlayer[]> = {
    GK: [], DEF: [], MID: [], FWD: [],
  };
  for (const p of players) {
    const pos = p.position?.toUpperCase() ?? "";
    if (pos === "GK") rows.GK.push(p);
    else if (["DEF", "CB", "RB", "LB", "WB"].some((x) => pos.includes(x))) rows.DEF.push(p);
    else if (["FWD", "ST", "CF", "ATT", "LW", "RW"].some((x) => pos.includes(x))) rows.FWD.push(p);
    else rows.MID.push(p);
  }

  const rowOrder: Array<[string, string]> = [
    ["FWD", "Forwards"], ["MID", "Midfielders"], ["DEF", "Defenders"], ["GK", "Goalkeeper"],
  ];

  return (
    <div style={{
      background: "linear-gradient(180deg, #0a1a0f 0%, #061208 100%)",
      border: "1px solid #00c89622", borderRadius: 14,
      padding: "20px 12px", marginBottom: 18, position: "relative", overflow: "hidden",
    }}>
      {/* Pitch markings */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: [
          "linear-gradient(transparent calc(50% - 1px), #00c89611 calc(50%), transparent calc(50% + 1px))",
        ].join(","),
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 60, height: 60, borderRadius: "50%", border: "1px solid #00c89611", pointerEvents: "none",
      }} />

      {rowOrder.map(([pos, label]) => {
        const group = rows[pos];
        if (group.length === 0) return null;
        return (
          <div key={pos} style={{ marginBottom: 14 }}>
            <div style={{ textAlign: "center", color: "#1e4a28", fontSize: 9, marginBottom: 8, letterSpacing: 1 }}>
              {label.toUpperCase()}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              {group.map((player) => (
                <PitchPlayerChip key={player.name} player={player} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PitchPlayerChip({ player }: { player: FantasyPlayer }) {
  const fitnessColor = player.fitness ? FITNESS_COLORS[player.fitness] : "#64748b";
  return (
    <div style={{
      background: "#0a1a12ee", border: `1px solid ${player.isCaptain ? "#f59e0b" : "#00c89633"}`,
      borderRadius: 10, padding: "8px 10px", textAlign: "center", minWidth: 72,
      position: "relative", backdropFilter: "blur(4px)",
      boxShadow: player.isCaptain ? "0 0 12px #f59e0b33" : undefined,
    }}>
      {player.isCaptain && (
        <div style={{
          position: "absolute", top: -6, right: -4, fontSize: 8, padding: "1px 5px",
          borderRadius: 8, background: "#f59e0b", color: "#000", fontWeight: 800,
        }}>C</div>
      )}
      <div style={{
        width: 28, height: 28, borderRadius: "50%", margin: "0 auto 5px",
        background: "linear-gradient(135deg, #00c896, #0ea5e9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#060b14",
      }}>
        {player.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
      </div>
      <div style={{ color: "#f1f5f9", fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}>
        {player.name.split(" ").slice(-1)[0]}
      </div>
      <div style={{ color: "#64748b", fontSize: 9, marginTop: 1 }}>{player.team}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
        {player.fitness && (
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: fitnessColor,
            boxShadow: `0 0 4px ${fitnessColor}`,
          }} />
        )}
        <FormStars form={player.form} />
        {player.price && (
          <span style={{ fontSize: 9, color: "#64748b" }}>${player.price}m</span>
        )}
      </div>
    </div>
  );
}

function BudgetBar({ budget, team }: { budget: number | null; team: FantasyPlayer[] | null }) {
  if (!budget || !team) return null;
  const spent = team.reduce((s, p) => s + (p.price ?? 0), 0);
  const pct = Math.min(100, Math.round((spent / budget) * 100));
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#00c896";
  return (
    <div style={{
      background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 12,
      padding: "12px 16px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: "#64748b" }}>Budget spent</span>
        <span style={{ color }}>
          ${spent.toFixed(1)}m / ${budget.toFixed(1)}m
          <span style={{ color: "#64748b" }}> ({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "#0a0f1e", border: "1px solid #1e2d50", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 4,
          background: `linear-gradient(90deg, #00c896, ${color})`,
          transition: "width 0.6s ease",
        }} />
      </div>
      <div style={{ fontSize: 10, color: "#334155", marginTop: 5 }}>
        ${(budget - spent).toFixed(1)}m remaining in the bank
      </div>
    </div>
  );
}

const DYNAMIC_ASKS = [
  { icon: "🎯", q: "Should I captain Mbappe or Vinicius Jr this gameweek?" },
  { icon: "💸", q: "Who are the best value midfielders from Group A teams?" },
  { icon: "🚨", q: "Any injury concerns for Argentina players right now?" },
  { icon: "🔀", q: "Best differential picks for the World Cup quarterfinals?" },
  { icon: "📈", q: "Which forwards have the best fixture run in the group stage?" },
  { icon: "🌟", q: "Who should I transfer in before the knockout rounds?" },
];

interface FantasyPanelProps {
  userId: string;
  onAskAgent?: (prompt: string) => void;
}

export default function FantasyPanel({ userId, onAskAgent }: FantasyPanelProps) {
  const [profile, setProfile] = useState<FantasyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/fantasy?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d: { profiles?: FantasyProfile[] }) => {
        setProfile(d.profiles?.[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div style={{ padding: "20px 16px", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ height: 72, background: "#0d1a12", border: "1px solid #00c89622", borderRadius: 14, marginBottom: 18, animation: "shimmer 1.5s ease infinite" }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 40, background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 8, marginBottom: 8, animation: "shimmer 1.5s ease infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  const hasSquad = profile && profile.team && profile.team.length > 0;

  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* WC Countdown */}
        <WCCountdown />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, margin: 0, flex: 1 }}>
            Fantasy League
          </h2>
          {profile && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{PLATFORM_ICONS[profile.platform] ?? "⚽"}</span>
              <span style={{ color: "#64748b", fontSize: 11 }}>
                {PLATFORM_LABELS[profile.platform] ?? profile.platform}
              </span>
            </div>
          )}
        </div>

        {/* Budget bar */}
        {hasSquad && <BudgetBar budget={profile.budget} team={profile.team} />}

        {/* Pitch formation or empty state */}
        {hasSquad ? (
          <>
            <div style={{ color: "#64748b", fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>
              ⚽ SQUAD · {profile!.team!.length} PLAYERS
            </div>
            <PitchFormation players={profile!.team!} />
          </>
        ) : (
          <div style={{
            background: "#0d1421", border: "1px dashed #1e2d50", borderRadius: 14,
            padding: "32px 20px", textAlign: "center", marginBottom: 18,
          }}>
            <div style={{ fontSize: 42, marginBottom: 12, filter: "drop-shadow(0 0 12px #00c89633)" }}>🏆</div>
            <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              No squad built yet
            </div>
            <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.7, maxWidth: 280, margin: "0 auto 16px" }}>
              The World Cup kicks off in {daysToWC()} days. Ask the agent to build
              an optimised squad based on form, fixtures, and value.
            </div>
            <button
              onClick={() => onAskAgent?.("Build me an optimal World Cup 2026 fantasy team — best value picks, captain choice, and transfer strategy for the group stage")}
              style={{
                padding: "10px 20px", borderRadius: 20, border: "1px solid #00c896",
                background: "#00c89622", color: "#00c896", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                boxShadow: "0 0 16px #00c89633",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#00c89633"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#00c89622"; }}
            >
              ⚽ Build my World Cup squad →
            </button>
          </div>
        )}

        {/* Quick-ask grid */}
        <div style={{
          background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 14,
          padding: "16px 18px", marginBottom: 16,
        }}>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 12, letterSpacing: 1 }}>
            🎯 QUICK ADVICE FROM THE AGENT
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {DYNAMIC_ASKS.map(({ icon, q }) => (
              <button
                key={q}
                onClick={() => onAskAgent?.(q)}
                style={{
                  padding: "9px 12px", borderRadius: 10, border: "1px solid #1e2d50",
                  background: "#0a0f1e", color: "#94a3b8", fontSize: 11,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  lineHeight: 1.4, transition: "all 0.15s", display: "flex", gap: 6,
                  alignItems: "flex-start",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#00c89666";
                  (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                  (e.currentTarget as HTMLElement).style.background = "#0a1a0f";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#1e2d50";
                  (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                  (e.currentTarget as HTMLElement).style.background = "#0a0f1e";
                }}
              >
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Info tip */}
        <div style={{
          padding: "11px 14px", borderRadius: 10,
          background: "#0a1a12", border: "1px solid #00c89622",
          color: "#64748b", fontSize: 11, lineHeight: 1.7,
        }}>
          💡 The agent uses live injury news, upcoming fixture difficulty, and form data to recommend picks.
          Your saved squad will appear on the pitch above after the agent stores it.
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
      `}</style>
    </div>
  );
}

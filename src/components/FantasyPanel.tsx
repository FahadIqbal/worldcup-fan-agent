"use client";
// src/components/FantasyPanel.tsx — Fantasy dashboard with interactive squad builder

import { useEffect, useState, useCallback } from "react";

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

// ─── WC 2026 Star Players ────────────────────────────────────────────────────

interface WCPlayer {
  name: string; country: string; flag: string; pos: "GK" | "DEF" | "MID" | "FWD";
  price: number; rating: number; form: number;
}

const WC_PLAYERS: WCPlayer[] = [
  // GK
  { name: "E. Martínez",    country: "ARG", flag: "🇦🇷", pos: "GK",  price: 8.0, rating: 9.2, form: 4.5 },
  { name: "Alisson",        country: "BRA", flag: "🇧🇷", pos: "GK",  price: 7.5, rating: 9.0, form: 4.2 },
  { name: "Courtois",       country: "BEL", flag: "🇧🇪", pos: "GK",  price: 7.0, rating: 8.8, form: 4.0 },
  { name: "Pickford",       country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pos: "GK",  price: 6.0, rating: 8.4, form: 3.8 },
  { name: "Unai Simón",     country: "ESP", flag: "🇪🇸", pos: "GK",  price: 5.5, rating: 8.5, form: 4.1 },
  // DEF
  { name: "T. Hernández",   country: "FRA", flag: "🇫🇷", pos: "DEF", price: 8.5, rating: 9.2, form: 4.8 },
  { name: "Hakimi",         country: "MAR", flag: "🇲🇦", pos: "DEF", price: 8.0, rating: 9.0, form: 4.6 },
  { name: "Grimaldo",       country: "ESP", flag: "🇪🇸", pos: "DEF", price: 7.5, rating: 9.0, form: 4.6 },
  { name: "Ruben Dias",     country: "POR", flag: "🇵🇹", pos: "DEF", price: 7.5, rating: 8.9, form: 4.5 },
  { name: "Van Dijk",       country: "NED", flag: "🇳🇱", pos: "DEF", price: 7.5, rating: 8.8, form: 4.2 },
  { name: "L. Martínez",   country: "ARG", flag: "🇦🇷", pos: "DEF", price: 7.0, rating: 8.6, form: 4.0 },
  { name: "Cancelo",        country: "POR", flag: "🇵🇹", pos: "DEF", price: 7.0, rating: 8.5, form: 4.3 },
  { name: "Reece James",    country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pos: "DEF", price: 6.5, rating: 8.4, form: 3.9 },
  { name: "Koulibaly",      country: "SEN", flag: "🇸🇳", pos: "DEF", price: 6.0, rating: 8.4, form: 4.1 },
  { name: "De Vrij",        country: "NED", flag: "🇳🇱", pos: "DEF", price: 5.5, rating: 8.1, form: 3.8 },
  // MID
  { name: "Bellingham",     country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pos: "MID", price: 12.5, rating: 9.8, form: 5.0 },
  { name: "Pedri",          country: "ESP", flag: "🇪🇸", pos: "MID", price: 11.0, rating: 9.6, form: 4.9 },
  { name: "De Bruyne",      country: "BEL", flag: "🇧🇪", pos: "MID", price: 12.0, rating: 9.5, form: 4.7 },
  { name: "Valverde",       country: "URU", flag: "🇺🇾", pos: "MID", price: 10.5, rating: 9.4, form: 4.8 },
  { name: "Foden",          country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pos: "MID", price: 10.0, rating: 9.3, form: 4.7 },
  { name: "Dani Olmo",      country: "ESP", flag: "🇪🇸", pos: "MID", price: 9.5, rating: 9.2, form: 4.6 },
  { name: "Camavinga",      country: "FRA", flag: "🇫🇷", pos: "MID", price: 9.5, rating: 9.1, form: 4.5 },
  { name: "Luis Díaz",      country: "COL", flag: "🇨🇴", pos: "MID", price: 9.0, rating: 9.0, form: 4.4 },
  { name: "Guler",          country: "TUR", flag: "🇹🇷", pos: "MID", price: 7.0, rating: 8.7, form: 4.2 },
  { name: "Wijnaldum",      country: "NED", flag: "🇳🇱", pos: "MID", price: 6.5, rating: 8.2, form: 3.9 },
  // FWD
  { name: "Mbappé",         country: "FRA", flag: "🇫🇷", pos: "FWD", price: 14.5, rating: 9.9, form: 5.0 },
  { name: "Vinicius Jr",    country: "BRA", flag: "🇧🇷", pos: "FWD", price: 14.0, rating: 9.8, form: 4.9 },
  { name: "Lautaro",        country: "ARG", flag: "🇦🇷", pos: "FWD", price: 12.0, rating: 9.5, form: 4.7 },
  { name: "Saka",           country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pos: "FWD", price: 11.5, rating: 9.4, form: 4.8 },
  { name: "Leão",           country: "POR", flag: "🇵🇹", pos: "FWD", price: 11.0, rating: 9.3, form: 4.6 },
  { name: "Osimhen",        country: "NGA", flag: "🇳🇬", pos: "FWD", price: 10.5, rating: 9.1, form: 4.5 },
  { name: "Lewandowski",    country: "POL", flag: "🇵🇱", pos: "FWD", price: 10.0, rating: 8.9, form: 4.3 },
  { name: "Richarlison",    country: "BRA", flag: "🇧🇷", pos: "FWD", price: 9.5, rating: 8.7, form: 4.2 },
];

const SQUAD_SIZE = 11;
const BUDGET = 100.0;
const POS_LIMITS: Record<string, { min: number; max: number }> = {
  GK: { min: 1, max: 1 }, DEF: { min: 3, max: 4 },
  MID: { min: 3, max: 5 }, FWD: { min: 1, max: 3 },
};
const FITNESS_COLORS: Record<string, string> = { fit: "#00c896", doubt: "#f59e0b", out: "#ef4444" };

const WC_START = new Date("2026-06-11T18:00:00Z");
function daysToWC() { return Math.max(0, Math.ceil((WC_START.getTime() - Date.now()) / 86400000)); }

// ─── Sub-components ───────────────────────────────────────────────────────────

function WCCountdown() {
  const days = daysToWC();
  const urgency = days <= 7 ? "#ef4444" : days <= 21 ? "#f59e0b" : "#00c896";
  return (
    <div style={{
      background: `linear-gradient(135deg, ${urgency}18, ${urgency}08)`,
      border: `1px solid ${urgency}44`, borderRadius: 14,
      padding: "14px 18px", marginBottom: 18,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ fontSize: 28, filter: `drop-shadow(0 0 10px ${urgency})` }}>🏆</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: urgency, fontSize: 22, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>
          {days} days
        </div>
        <div style={{ color: "var(--text2)", fontSize: 11 }}>
          until World Cup 2026 · June 11, USA / Canada / Mexico
        </div>
      </div>
      <div style={{
        fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
        background: urgency + "22", color: urgency, border: `1px solid ${urgency}44`,
      }}>
        {days <= 7 ? "🚨 FINAL DAYS" : days <= 21 ? "⚡ LOCK IN SQUAD" : "PLAN AHEAD"}
      </div>
    </div>
  );
}

function FormStars({ form }: { form: number | undefined }) {
  if (!form) return null;
  const filled = Math.round(Math.min(5, form));
  return (
    <span style={{ fontSize: 8, letterSpacing: -1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < filled ? "#f59e0b" : "var(--border)" }}>★</span>
      ))}
    </span>
  );
}

function RatingBar({ rating, posColor }: { rating: number; posColor: string }) {
  const pct = Math.round(((rating - 7.5) / 2.5) * 100); // maps 7.5–10 to 0–100%
  return (
    <div style={{ width: "100%", height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden", marginTop: 5 }}>
      <div style={{
        height: "100%", width: `${pct}%`, borderRadius: 2,
        background: `linear-gradient(90deg, ${posColor}66, ${posColor})`,
        transition: "width 0.4s ease",
      }} />
    </div>
  );
}

function PitchFormation({ players }: { players: FantasyPlayer[] }) {
  const rows: Record<string, FantasyPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
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
      {/* Pitch center line */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(transparent calc(50% - 1px), #00c89611 calc(50%), transparent calc(50% + 1px))",
      }} />
      {/* Center circle */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 60, height: 60, borderRadius: "50%", border: "1px solid #00c89611", pointerEvents: "none",
      }} />
      {rowOrder.map(([pos, label]) => {
        const group = rows[pos];
        if (!group.length) return null;
        return (
          <div key={pos} style={{ marginBottom: 14 }}>
            <div style={{ textAlign: "center", color: "#1e4a28", fontSize: 9, marginBottom: 8, letterSpacing: 1 }}>
              {label.toUpperCase()}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              {group.map((player) => {
                const fitnessColor = player.fitness ? FITNESS_COLORS[player.fitness] : "var(--text3)";
                return (
                  <div key={player.name} style={{
                    background: "#0a1a12ee", border: `1px solid ${player.isCaptain ? "#f59e0b" : "#00c89633"}`,
                    borderRadius: 10, padding: "8px 10px", textAlign: "center", minWidth: 68,
                    position: "relative", boxShadow: player.isCaptain ? "0 0 12px #f59e0b33" : undefined,
                  }}>
                    {player.isCaptain && (
                      <div style={{
                        position: "absolute", top: -6, right: -4, fontSize: 8,
                        padding: "1px 5px", borderRadius: 8, background: "#f59e0b",
                        color: "#000", fontWeight: 800,
                      }}>C</div>
                    )}
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", margin: "0 auto 5px",
                      background: "linear-gradient(135deg, var(--accent), var(--blue))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: "var(--bg)",
                    }}>
                      {player.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ color: "var(--text)", fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}>
                      {player.name.split(" ").slice(-1)[0]}
                    </div>
                    <div style={{ color: "var(--text3)", fontSize: 9 }}>{player.team}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 3 }}>
                      {player.fitness && (
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: fitnessColor, boxShadow: `0 0 3px ${fitnessColor}` }} />
                      )}
                      {player.price && <span style={{ fontSize: 8, color: "var(--text3)" }}>${player.price}m</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BudgetDisplay({ budget, team }: { budget: number | null; team: FantasyPlayer[] | null }) {
  if (!budget || !team) return null;
  const cap = Number(budget);
  const spent = team.reduce((s, p) => s + (p.price ?? 0), 0);
  const pct = Math.min(100, Math.round((spent / cap) * 100));
  const color = pct > 90 ? "var(--red)" : pct > 70 ? "var(--orange)" : "var(--accent)";
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: "var(--text3)" }}>Budget spent</span>
        <span style={{ color }}>
          ${spent.toFixed(1)}m / ${cap.toFixed(1)}m
          <span style={{ color: "var(--text3)" }}> ({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "var(--bg)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, var(--accent), ${color})`, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--text4)", marginTop: 5 }}>${(cap - spent).toFixed(1)}m remaining</div>
    </div>
  );
}

// ─── Squad Builder ────────────────────────────────────────────────────────────

function SquadBuilder({ userId, onSaved }: { userId: string; onSaved: (team: FantasyPlayer[]) => void }) {
  const [posTab, setPosTab] = useState<"GK" | "DEF" | "MID" | "FWD">("FWD");
  const [squad, setSquad] = useState<WCPlayer[]>([]);
  const [captainName, setCaptainName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const spent = squad.reduce((s, p) => s + p.price, 0);
  const remaining = BUDGET - spent;
  const byPos = (pos: string) => squad.filter((p) => p.pos === pos).length;

  const isSelected = (p: WCPlayer) => squad.some((s) => s.name === p.name);

  const canAdd = (p: WCPlayer) => {
    if (isSelected(p)) return true;
    if (squad.length >= SQUAD_SIZE) return false;
    if (remaining < p.price) return false;
    const limit = POS_LIMITS[p.pos];
    if (limit && byPos(p.pos) >= limit.max) return false;
    return true;
  };

  const toggle = (p: WCPlayer) => {
    if (isSelected(p)) {
      setSquad((prev) => prev.filter((s) => s.name !== p.name));
      if (captainName === p.name) setCaptainName(null);
    } else if (canAdd(p)) {
      setSquad((prev) => [...prev, p]);
      if (!captainName) setCaptainName(p.name);
    }
  };

  const autoPick = () => {
    const best: WCPlayer[] = [];
    const pick = (pos: "GK" | "DEF" | "MID" | "FWD", count: number) => {
      const candidates = WC_PLAYERS.filter((p) => p.pos === pos)
        .sort((a, b) => b.rating / b.price - a.rating / a.price);
      let added = 0;
      let rem = BUDGET - best.reduce((s, p) => s + p.price, 0);
      for (const p of candidates) {
        if (added >= count) break;
        if (p.price <= rem) { best.push(p); rem -= p.price; added++; }
      }
    };
    pick("GK", 1); pick("DEF", 4); pick("MID", 4); pick("FWD", 2);
    setSquad(best);
    const cap = best.filter((p) => p.pos === "FWD" || p.pos === "MID")
      .sort((a, b) => b.rating - a.rating)[0];
    setCaptainName(cap?.name ?? null);
  };

  const save = async () => {
    if (squad.length < 11) { setError("Select 11 players to save your squad"); return; }
    setSaving(true); setError("");
    const teamData: FantasyPlayer[] = squad.map((p) => ({
      name: p.name, team: p.country, position: p.pos,
      price: p.price, form: String(p.form), fitness: "fit",
      isCaptain: p.name === captainName,
    }));
    try {
      const res = await fetch("/api/fantasy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, team: teamData, budget: BUDGET, platform: "custom" }),
      });
      if (!res.ok) throw new Error();
      onSaved(teamData);
    } catch {
      setError("Could not save squad — try again.");
    } finally { setSaving(false); }
  };

  const tabPlayers = WC_PLAYERS.filter((p) => p.pos === posTab);
  const posColors: Record<string, string> = { GK: "#f59e0b", DEF: "#3b82f6", MID: "#00c896", FWD: "#ef4444" };

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
      overflow: "hidden", marginBottom: 18,
    }}>
      {/* Builder header */}
      <div style={{
        padding: "14px 18px",
        background: "linear-gradient(135deg, rgba(0,200,150,0.06), var(--surface))",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>⚽</span>
          <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>Build Your Squad</span>
          <span style={{ color: "var(--text3)", fontSize: 11, marginLeft: "auto" }}>
            {squad.length}/{SQUAD_SIZE} selected
          </span>
        </div>

        {/* Budget bar */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
          <span style={{ color: "var(--text3)" }}>Budget</span>
          <span style={{ color: remaining < 5 ? "var(--red)" : "var(--accent)" }}>
            ${spent.toFixed(1)}m / $100m · <strong>${remaining.toFixed(1)}m left</strong>
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4, transition: "width 0.3s",
            width: `${Math.min(100, (spent / BUDGET) * 100)}%`,
            background: `linear-gradient(90deg, var(--accent), ${spent / BUDGET > 0.9 ? "var(--red)" : "var(--blue)"})`,
          }} />
        </div>

        {/* Formation summary chips */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => {
            const count = byPos(pos);
            const limit = POS_LIMITS[pos];
            const full = count >= limit.max;
            return (
              <span key={pos} style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                background: count >= limit.min ? posColors[pos] + "22" : "var(--bg)",
                color: count >= limit.min ? posColors[pos] : "var(--text4)",
                border: `1px solid ${count >= limit.min ? posColors[pos] + "44" : "var(--border)"}`,
              }}>
                {pos} {count}/{limit.max} {full ? "✓" : ""}
              </span>
            );
          })}
          {captainName && (
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
              background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44",
            }}>
              ©️ {captainName.split(" ").slice(-1)[0]}
            </span>
          )}
        </div>
      </div>

      {/* Position tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {(["FWD", "MID", "DEF", "GK"] as const).map((pos) => (
          <button key={pos} onClick={() => setPosTab(pos)} style={{
            flex: 1, padding: "8px 4px", border: "none",
            borderBottom: posTab === pos ? `2px solid ${posColors[pos]}` : "2px solid transparent",
            background: "transparent",
            color: posTab === pos ? posColors[pos] : "var(--text3)",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            transition: "all 0.15s",
          }}>
            {pos}
            <span style={{ fontSize: 9, marginLeft: 4, color: posTab === pos ? posColors[pos] + "aa" : "var(--text4)" }}>
              {byPos(pos)}/{POS_LIMITS[pos].max}
            </span>
          </button>
        ))}
      </div>

      {/* Player grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 8, padding: "12px", maxHeight: 280, overflowY: "auto",
      }}>
        {tabPlayers.map((p) => {
          const selected = isSelected(p);
          const addable = canAdd(p);
          const isCap = captainName === p.name;
          return (
            <div key={p.name} onClick={() => toggle(p)} style={{
              padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${selected ? posColors[posTab] : "var(--border)"}`,
              background: selected ? posColors[posTab] + "14" : "var(--bg)",
              cursor: addable || selected ? "pointer" : "not-allowed",
              opacity: !addable && !selected ? 0.4 : 1,
              transition: "all 0.15s", position: "relative",
            }}>
              {selected && (
                <div style={{
                  position: "absolute", top: 6, right: 8,
                  fontSize: 9, color: posColors[posTab], fontWeight: 700,
                }}>
                  ✓
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: selected ? posColors[posTab] + "33" : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, border: `1px solid ${selected ? posColors[posTab] + "66" : "var(--border2)"}`,
                }}>
                  {p.flag}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--text)", fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{p.name}</div>
                  <div style={{ color: "var(--text3)", fontSize: 9 }}>{p.country}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, color: "var(--text3)" }}>Rtg {p.rating.toFixed(1)}</span>
                <span style={{ fontSize: 11, color: posColors[posTab], fontWeight: 700 }}>${p.price}m</span>
              </div>
              <RatingBar rating={p.rating} posColor={posColors[posTab]} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <FormStars form={p.form} />
                <span style={{ fontSize: 9, color: "var(--text3)" }}>
                  val {(p.rating / p.price).toFixed(2)}
                </span>
              </div>
              {selected && (
                <button onClick={(e) => { e.stopPropagation(); setCaptainName(p.name); }} style={{
                  marginTop: 6, width: "100%", padding: "3px", borderRadius: 6, fontSize: 9, fontWeight: 700,
                  border: `1px solid ${isCap ? "#f59e0b" : "var(--border)"}`,
                  background: isCap ? "#f59e0b22" : "transparent",
                  color: isCap ? "#f59e0b" : "var(--text4)", cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}>
                  {isCap ? "© Captain" : "Make captain"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
        {error && <div style={{ color: "var(--red)", fontSize: 11, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={autoPick} style={{
            padding: "8px 14px", borderRadius: 8, border: "1px solid var(--blue-dim)",
            background: "var(--blue-dim)", color: "var(--blue)", fontSize: 11,
            cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
          }}>
            ⚡ Auto-pick
          </button>
          <button onClick={save} disabled={saving || squad.length < SQUAD_SIZE} style={{
            flex: 1, padding: "8px", borderRadius: 8, border: "none",
            background: squad.length >= SQUAD_SIZE && !saving
              ? "linear-gradient(135deg, var(--accent), var(--blue))"
              : "var(--border)",
            color: "#fff", fontSize: 12, fontWeight: 700,
            cursor: squad.length >= SQUAD_SIZE && !saving ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}>
            {saving ? "Saving…" : squad.length >= SQUAD_SIZE ? "Save Squad ✓" : `${SQUAD_SIZE - squad.length} more to go`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick-ask prompts ────────────────────────────────────────────────────────

const QUICK_ASKS = [
  { icon: "🎯", q: "Who should I captain — Mbappé or Vinicius Jr?" },
  { icon: "💸", q: "Best value midfielders under $9m for WC 2026?" },
  { icon: "🚨", q: "Any injury concerns for Argentina's squad?" },
  { icon: "🔀", q: "Best differential picks for the knockout rounds?" },
  { icon: "📈", q: "Which forwards have the easiest group-stage fixtures?" },
  { icon: "🌟", q: "Top 5 players to transfer in before the quarterfinals?" },
];

// ─── Main component ───────────────────────────────────────────────────────────

interface FantasyPanelProps { userId: string; onAskAgent?: (prompt: string) => void; }

export default function FantasyPanel({ userId, onAskAgent }: FantasyPanelProps) {
  const [profile, setProfile] = useState<FantasyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  const loadProfile = useCallback(() => {
    setLoading(true);
    fetch(`/api/fantasy?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d: { profiles?: FantasyProfile[] }) => { setProfile(d.profiles?.[0] ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSquadSaved = (team: FantasyPlayer[]) => {
    setProfile((prev) => prev
      ? { ...prev, team, budget: BUDGET, updated_at: new Date().toISOString() }
      : { id: "local", platform: "custom", budget: BUDGET, team, updated_at: new Date().toISOString() }
    );
    setShowBuilder(false);
  };

  if (loading) {
    return (
      <div style={{ padding: "20px 16px", fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ height: 72, background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 14, marginBottom: 18, animation: "shimmer 1.5s ease infinite" }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 40, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8, animation: "shimmer 1.5s ease infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  const hasSquad = profile?.team && profile.team.length > 0;

  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%", fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <WCCountdown />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h2 style={{ color: "var(--text)", fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
            Fantasy Advisor {hasSquad && <span style={{ color: "var(--text3)", fontWeight: 400 }}>· {profile!.team!.length} players</span>}
          </h2>
          <button onClick={() => setShowBuilder((v) => !v)} style={{
            padding: "5px 14px", borderRadius: 20,
            border: `1px solid ${showBuilder ? "var(--accent)" : "var(--border)"}`,
            background: showBuilder ? "var(--accent-dim)" : "transparent",
            color: showBuilder ? "var(--accent)" : "var(--text2)",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
          }}>
            {showBuilder ? "✕ Close" : hasSquad ? "✏ Edit Squad" : "⚽ Build Squad"}
          </button>
        </div>

        {/* Budget bar (when squad exists) */}
        {hasSquad && !showBuilder && <BudgetDisplay budget={profile!.budget} team={profile!.team} />}

        {/* Squad Builder */}
        {showBuilder && <SquadBuilder userId={userId} onSaved={handleSquadSaved} />}

        {/* Pitch or empty state */}
        {!showBuilder && (
          hasSquad ? (
            <>
              <div style={{ color: "var(--text3)", fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>
                ⚽ SQUAD · {profile!.team!.length} PLAYERS
              </div>
              <PitchFormation players={profile!.team!} />
            </>
          ) : (
            <div style={{
              background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 14,
              padding: "32px 20px", textAlign: "center", marginBottom: 18,
            }}>
              <div style={{ fontSize: 42, marginBottom: 12, filter: "drop-shadow(0 0 12px var(--accent-glow))" }}>🏆</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No squad built yet</div>
              <div style={{ color: "var(--text3)", fontSize: 11, lineHeight: 1.7, maxWidth: 280, margin: "0 auto 16px" }}>
                Pick 11 players from WC 2026 stars within a $100m budget. Captain your best scorer.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setShowBuilder(true)} style={{
                  padding: "10px 20px", borderRadius: 20, border: "1px solid var(--accent)",
                  background: "var(--accent-dim)", color: "var(--accent)", fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
                  boxShadow: "0 0 16px var(--accent-glow)",
                }}>
                  ⚽ Build my squad →
                </button>
                <button onClick={() => onAskAgent?.("Build me an optimal World Cup 2026 fantasy team — best value picks, captain choice, formation and transfer strategy")} style={{
                  padding: "10px 16px", borderRadius: 20, border: "1px solid var(--blue-dim)",
                  background: "var(--blue-dim)", color: "var(--blue)", fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  Ask agent →
                </button>
              </div>
            </div>
          )
        )}

        {/* Top value picks */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ color: "var(--text3)", fontSize: 10, marginBottom: 12, letterSpacing: 1 }}>
            🔥 TOP VALUE PICKS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {WC_PLAYERS
              .sort((a, b) => b.rating / b.price - a.rating / a.price)
              .slice(0, 5)
              .map((p) => (
                <div key={p.name} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 8, background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: 14 }}>{p.flag}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: "var(--text)", fontSize: 11, fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: "var(--text4)", fontSize: 10, marginLeft: 6 }}>{p.pos}</span>
                  </div>
                  <FormStars form={p.form} />
                  <span style={{ color: "var(--accent)", fontSize: 11, fontWeight: 700 }}>${p.price}m</span>
                  <span style={{ color: "var(--text3)", fontSize: 9 }}>
                    {(p.rating / p.price).toFixed(2)} val
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Quick-ask grid */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ color: "var(--text3)", fontSize: 10, marginBottom: 12, letterSpacing: 1 }}>
            🎯 QUICK ADVICE FROM THE AGENT
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {QUICK_ASKS.map(({ icon, q }) => (
              <button key={q} onClick={() => onAskAgent?.(q)} style={{
                padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--bg)", color: "var(--text2)", fontSize: 11,
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                lineHeight: 1.4, display: "flex", gap: 6, alignItems: "flex-start",
                transition: "all 0.15s",
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
                  (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text2)";
                  (e.currentTarget as HTMLElement).style.background = "var(--bg)";
                }}
              >
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{
          padding: "11px 14px", borderRadius: 10,
          background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
          color: "var(--text3)", fontSize: 11, lineHeight: 1.7,
        }}>
          💡 Build your squad manually or ask the agent for AI-powered recommendations.
          Your captain earns double points — pick your best forward or midfielder.
        </div>
      </div>
    </div>
  );
}

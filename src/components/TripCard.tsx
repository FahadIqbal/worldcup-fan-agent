"use client";
// src/components/TripCard.tsx — Saved trip viewer with countdown, budget bars, and agent CTAs

import { useEffect, useState, useCallback } from "react";

interface Trip {
  id: string;
  origin_city: string;
  destination_city: string;
  status: "draft" | "confirmed" | "completed" | "cancelled";
  budget: number | null;
  currency: string;
  cost_breakdown: Record<string, number> | null;
  itinerary: Array<{ day: number; date: string; activities: string[] }> | null;
  travel_dates: { depart?: string; return?: string } | null;
  match_id: string | null;
  created_at: string;
}

interface TripCardProps {
  userId: string;
  onAskAgent?: (prompt: string) => void;
}

const STATUS_STEPS = ["draft", "confirmed", "travel", "done"] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: "Planning", confirmed: "Confirmed", completed: "Done", cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", confirmed: "#00c896", completed: "#3b82f6", cancelled: "#ef4444",
};
const CATEGORY_ICONS: Record<string, string> = {
  flights: "✈", hotel: "🏨", visa: "📋", groundTransport: "🚌",
  food: "🍽", tickets: "🎟", misc: "📦",
};

function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function CountdownBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  const color = days <= 7 ? "#ef4444" : days <= 30 ? "#f59e0b" : "#00c896";
  const label = days < 0 ? "Departed" : days === 0 ? "Today!" : `${days}d to go`;
  return (
    <span style={{
      fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
      background: color + "22", color, border: `1px solid ${color}55`,
      animation: days <= 7 && days >= 0 ? "countPulse 2s ease infinite" : undefined,
    }}>
      {label}
    </span>
  );
}

function StatusTrail({ status }: { status: string }) {
  const stepIndex = status === "completed" ? 3 : status === "confirmed" ? 1 : status === "draft" ? 0 : -1;
  const labels = ["Planning", "Confirmed", "Travelling", "Done"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 14 }}>
      {labels.map((label, i) => {
        const done = i < stepIndex || (status === "completed" && i === 3);
        const active = i === stepIndex && status !== "cancelled";
        const color = done || active ? "#00c896" : "#1e2d50";
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < labels.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", fontSize: 9,
                background: done ? "#00c896" : active ? "#00c89644" : "#0a0f1e",
                border: `2px solid ${color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done ? "#060b14" : color, fontWeight: 700,
                boxShadow: active ? "0 0 8px #00c89666" : undefined,
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 9, color: active ? "#00c896" : done ? "#64748b" : "#334155", whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: done ? "#00c896" : "#1e2d50",
                margin: "0 4px", marginBottom: 14, transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BudgetBar({ breakdown, budget, currency }: {
  breakdown: Record<string, number> | null;
  budget: number | null;
  currency: string;
}) {
  const total = breakdown ? Object.values(breakdown).reduce((a, b) => a + b, 0) : 0;
  if (!total && !budget) return null;
  const pct = budget ? Math.min(100, Math.round((total / budget) * 100)) : 0;
  const barColor = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#00c896";

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11 }}>
        <span style={{ color: "#64748b" }}>Budget used</span>
        <span style={{ color: barColor, fontWeight: 700 }}>
          {currency} {total.toLocaleString()} {budget ? `/ ${budget.toLocaleString()}` : ""}
          {budget ? <span style={{ color: "#64748b", fontWeight: 400 }}> ({pct}%)</span> : null}
        </span>
      </div>
      {budget && (
        <div style={{ height: 6, borderRadius: 4, background: "#0a0f1e", border: "1px solid #1e2d50", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 4,
            background: `linear-gradient(90deg, #00c896, ${barColor})`,
            transition: "width 0.6s ease", boxShadow: `0 0 6px ${barColor}55`,
          }} />
        </div>
      )}

      {breakdown && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {Object.entries(breakdown).map(([cat, amt]) => {
            const catPct = total ? Math.round((amt / total) * 100) : 0;
            return (
              <div key={cat} style={{
                background: "#0a0f1e", border: "1px solid #1e2d50",
                borderRadius: 8, padding: "6px 10px", fontSize: 11,
              }}>
                <span style={{ marginRight: 5 }}>{CATEGORY_ICONS[cat] ?? "📌"}</span>
                <span style={{ color: "#94a3b8" }}>{cat}</span>
                <span style={{ color: "#e2e8f0", fontWeight: 600, marginLeft: 6 }}>
                  {currency} {Number(amt).toLocaleString()}
                </span>
                <span style={{ color: "#334155", marginLeft: 4 }}>({catPct}%)</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 14, padding: "16px 20px" }}>
      {[80, 50, 65].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 14 : 10, width: `${w}%`, borderRadius: 4,
          background: "#1e2d50", marginBottom: 10, animation: "shimmer 1.5s ease infinite",
        }} />
      ))}
    </div>
  );
}

export default function TripCard({ userId, onAskAgent }: TripCardProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/trips?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        setTrips(d.trips ?? []);
        if (d.trips?.length > 0) setExpanded(d.trips[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: "20px 16px", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ fontSize: 52, marginBottom: 16, filter: "drop-shadow(0 0 20px #00c89644)" }}>✈️</div>
        <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No trips planned yet</div>
        <div style={{ color: "#64748b", fontSize: 12, maxWidth: 280, margin: "0 auto 20px", lineHeight: 1.6 }}>
          The World Cup starts in {daysUntil("2026-06-11") ?? "days"} days. Let the agent build your perfect trip plan.
        </div>
        <button
          onClick={() => onAskAgent?.("Plan a complete trip from my city to a World Cup match — flights, hotel near stadium, visa requirements and total budget breakdown")}
          style={{
            padding: "10px 20px", borderRadius: 20, border: "1px solid #00c896",
            background: "#00c89622", color: "#00c896", fontSize: 12,
            cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            boxShadow: "0 0 16px #00c89633", transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#00c89633"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#00c89622"; }}
        >
          ✈ Plan my World Cup trip →
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, margin: 0 }}>
            My Trips <span style={{ color: "#64748b", fontWeight: 400 }}>({trips.length})</span>
          </h2>
          <button
            onClick={() => onAskAgent?.("I want to add another World Cup trip — help me plan it")}
            style={{
              padding: "5px 14px", borderRadius: 20, border: "1px solid #1e2d50",
              background: "transparent", color: "#94a3b8", fontSize: 11,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#00c896"; (e.currentTarget as HTMLElement).style.color = "#00c896"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d50"; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
          >
            + New trip
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {trips.map((trip) => {
            const isOpen = expanded === trip.id;
            const days = daysUntil(trip.travel_dates?.depart);
            const statusColor = STATUS_COLORS[trip.status] ?? "#94a3b8";

            return (
              <div key={trip.id} style={{
                background: "#0d1421",
                border: `1px solid ${isOpen ? "#00c89644" : "#1e2d50"}`,
                borderRadius: 14, overflow: "hidden",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxShadow: isOpen ? "0 0 20px #00c89611" : "none",
              }}>
                {/* Header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : trip.id)}
                  style={{
                    width: "100%", padding: "16px 20px", display: "flex",
                    alignItems: "center", gap: 12, background: "transparent",
                    border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: "linear-gradient(135deg, #00c896, #0ea5e9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, boxShadow: "0 0 12px #00c89633",
                  }}>
                    ✈️
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                      {trip.origin_city} → {trip.destination_city}
                    </div>
                    {trip.travel_dates?.depart && (
                      <div style={{ color: "#64748b", fontSize: 11 }}>
                        {new Date(trip.travel_dates.depart).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                        {trip.travel_dates.return && ` – ${new Date(trip.travel_dates.return).toLocaleDateString("en", { day: "numeric", month: "short" })}`}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 20,
                      background: statusColor + "22", color: statusColor,
                      border: `1px solid ${statusColor}44`,
                    }}>
                      {STATUS_LABELS[trip.status] ?? trip.status}
                    </span>
                    <CountdownBadge days={days} />
                  </div>

                  <span style={{ color: "#334155", fontSize: 14, marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ padding: "4px 20px 20px", borderTop: "1px solid #1e2d5044" }}>
                    <StatusTrail status={trip.status} />

                    <BudgetBar
                      breakdown={trip.cost_breakdown}
                      budget={trip.budget}
                      currency={trip.currency}
                    />

                    {/* Itinerary */}
                    {trip.itinerary && trip.itinerary.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>ITINERARY</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {trip.itinerary.slice(0, 4).map((day) => (
                            <div key={day.day} style={{
                              background: "#0a0f1e", border: "1px solid #1e2d50",
                              borderRadius: 8, padding: "8px 12px",
                              display: "flex", gap: 12, alignItems: "flex-start",
                            }}>
                              <div style={{
                                background: "#00c89622", color: "#00c896", fontSize: 10,
                                padding: "2px 8px", borderRadius: 6, flexShrink: 0, fontWeight: 700,
                              }}>
                                Day {day.day}
                              </div>
                              <div>
                                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>{day.date}</div>
                                <div style={{ color: "#e2e8f0", fontSize: 12, lineHeight: 1.5 }}>
                                  {day.activities.slice(0, 2).join(" · ")}
                                  {day.activities.length > 2 && <span style={{ color: "#64748b" }}> +{day.activities.length - 2} more</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                          {trip.itinerary.length > 4 && (
                            <div style={{ color: "#334155", fontSize: 10, paddingLeft: 8 }}>
                              +{trip.itinerary.length - 4} more days…
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CTA buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                      {[
                        { label: "✈ Update flights", prompt: `Update the flight prices for my ${trip.origin_city} → ${trip.destination_city} trip` },
                        { label: "🏨 Find hotels", prompt: `Find hotels near the stadium for my World Cup trip to ${trip.destination_city}` },
                        { label: "🛂 Visa status", prompt: `Check visa and entry requirements for my trip to ${trip.destination_city} for the World Cup` },
                      ].map(({ label, prompt }) => (
                        <button
                          key={label}
                          onClick={() => onAskAgent?.(prompt)}
                          style={{
                            padding: "5px 12px", borderRadius: 8, border: "1px solid #1e2d50",
                            background: "#0a0f1e", color: "#94a3b8", fontSize: 11,
                            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#00c89666"; (e.currentTarget as HTMLElement).style.color = "#00c896"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d50"; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div style={{ marginTop: 12, color: "#334155", fontSize: 10 }}>
                      Saved {new Date(trip.created_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes countPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>
    </div>
  );
}

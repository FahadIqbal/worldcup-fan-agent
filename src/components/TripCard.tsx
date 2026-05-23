"use client";
// src/components/TripCard.tsx — Saved trip viewer panel

import { useEffect, useState } from "react";

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

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#1a1a2e", color: "#94a3b8", label: "Draft" },
  confirmed: { bg: "#0a1a12", color: "#00c896", label: "Confirmed" },
  completed: { bg: "#0a0f1e", color: "#3b82f6", label: "Completed" },
  cancelled: { bg: "#1a0a0a", color: "#ef4444", label: "Cancelled" },
};

const CATEGORY_ICONS: Record<string, string> = {
  flights: "✈", hotel: "🏨", visa: "📋",
  groundTransport: "🚌", food: "🍽", tickets: "🎟", misc: "📦",
};

interface TripCardProps {
  userId: string;
}

export default function TripCard({ userId }: TripCardProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trips?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setTrips(d.trips ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
        Loading trips…
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✈️</div>
        <div style={{ color: "#94a3b8", fontSize: 14 }}>No trips saved yet.</div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Ask the agent to plan a trip and it will appear here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ color: "#f1f5f9", fontSize: 16, marginBottom: 20, fontWeight: 600 }}>
          My Trips ({trips.length})
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {trips.map((trip) => {
            const st = STATUS_STYLES[trip.status] ?? STATUS_STYLES.draft;
            const isOpen = expanded === trip.id;
            const total = trip.cost_breakdown
              ? Object.values(trip.cost_breakdown).reduce((a, b) => a + b, 0)
              : null;

            return (
              <div key={trip.id} style={{
                background: "#0d1421", border: "1px solid #1e2d50", borderRadius: 14,
                overflow: "hidden", transition: "border-color 0.2s",
              }}>
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : trip.id)}
                  style={{
                    width: "100%", padding: "16px 20px", display: "flex",
                    alignItems: "center", gap: 12, background: "transparent",
                    border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "linear-gradient(135deg, #00c896, #0ea5e9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>
                    ✈️
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>
                      {trip.origin_city} → {trip.destination_city}
                    </div>
                    {trip.travel_dates?.depart && (
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                        {new Date(trip.travel_dates.depart).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                        {trip.travel_dates.return && ` – ${new Date(trip.travel_dates.return).toLocaleDateString("en", { day: "numeric", month: "short" })}`}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 20,
                      background: st.bg, color: st.color, border: `1px solid ${st.color}33`,
                    }}>
                      {st.label}
                    </span>
                    {total !== null && (
                      <span style={{ fontSize: 12, color: "#00c896", fontWeight: 600 }}>
                        {trip.currency} {total.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <span style={{ color: "#64748b", fontSize: 16, marginLeft: 8 }}>
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid #1e2d5044" }}>

                    {/* Cost breakdown */}
                    {trip.cost_breakdown && Object.keys(trip.cost_breakdown).length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>💰 COST BREAKDOWN</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {Object.entries(trip.cost_breakdown).map(([cat, amt]) => (
                            <div key={cat} style={{
                              background: "#0a0f1e", border: "1px solid #1e2d50",
                              borderRadius: 8, padding: "6px 12px",
                              color: "#e2e8f0", fontSize: 12,
                            }}>
                              {CATEGORY_ICONS[cat] ?? "📌"} {cat}: <strong>{trip.currency} {Number(amt).toLocaleString()}</strong>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 10, color: "#00c896", fontSize: 13, fontWeight: 600 }}>
                          Total: {trip.currency} {total?.toLocaleString()}
                          {trip.budget && (
                            <span style={{ color: "#64748b", fontSize: 11, marginLeft: 8, fontWeight: 400 }}>
                              / budget {trip.currency} {Number(trip.budget).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Itinerary preview */}
                    {trip.itinerary && trip.itinerary.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>🗓 ITINERARY</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {trip.itinerary.slice(0, 4).map((day) => (
                            <div key={day.day} style={{
                              background: "#0a0f1e", border: "1px solid #1e2d50",
                              borderRadius: 8, padding: "8px 12px",
                            }}>
                              <span style={{ color: "#00c896", fontSize: 11, marginRight: 8 }}>
                                Day {day.day}
                              </span>
                              <span style={{ color: "#94a3b8", fontSize: 11 }}>{day.date}</span>
                              <div style={{ color: "#e2e8f0", fontSize: 12, marginTop: 4 }}>
                                {day.activities.slice(0, 2).join(" · ")}
                                {day.activities.length > 2 && ` +${day.activities.length - 2} more`}
                              </div>
                            </div>
                          ))}
                          {trip.itinerary.length > 4 && (
                            <div style={{ color: "#64748b", fontSize: 11, paddingLeft: 8 }}>
                              +{trip.itinerary.length - 4} more days…
                            </div>
                          )}
                        </div>
                      </div>
                    )}

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
    </div>
  );
}

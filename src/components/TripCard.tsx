"use client";
// src/components/TripCard.tsx — Trip planner with inline form, countdown, and budget bars

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

const WC_HOST_CITIES = [
  { city: "New York",      country: "USA",    flag: "🇺🇸", stadium: "MetLife Stadium",          cap: "82,500" },
  { city: "Los Angeles",   country: "USA",    flag: "🇺🇸", stadium: "SoFi Stadium",              cap: "70,240" },
  { city: "Dallas",        country: "USA",    flag: "🇺🇸", stadium: "AT&T Stadium",              cap: "80,000" },
  { city: "Miami",         country: "USA",    flag: "🇺🇸", stadium: "Hard Rock Stadium",         cap: "65,326" },
  { city: "Atlanta",       country: "USA",    flag: "🇺🇸", stadium: "Mercedes-Benz Stadium",     cap: "71,000" },
  { city: "Houston",       country: "USA",    flag: "🇺🇸", stadium: "NRG Stadium",              cap: "72,220" },
  { city: "Seattle",       country: "USA",    flag: "🇺🇸", stadium: "Lumen Field",              cap: "69,000" },
  { city: "San Francisco", country: "USA",    flag: "🇺🇸", stadium: "Levi's Stadium",           cap: "68,500" },
  { city: "Kansas City",   country: "USA",    flag: "🇺🇸", stadium: "Arrowhead Stadium",        cap: "73,000" },
  { city: "Boston",        country: "USA",    flag: "🇺🇸", stadium: "Gillette Stadium",         cap: "65,878" },
  { city: "Philadelphia",  country: "USA",    flag: "🇺🇸", stadium: "Lincoln Financial Field",  cap: "67,594" },
  { city: "Vancouver",     country: "Canada", flag: "🇨🇦", stadium: "BC Place",                 cap: "54,500" },
  { city: "Toronto",       country: "Canada", flag: "🇨🇦", stadium: "BMO Field",                cap: "45,736" },
  { city: "Mexico City",   country: "Mexico", flag: "🇲🇽", stadium: "Estadio Azteca",           cap: "87,523" },
  { city: "Guadalajara",   country: "Mexico", flag: "🇲🇽", stadium: "Estadio Akron",            cap: "49,850" },
  { city: "Monterrey",     country: "Mexico", flag: "🇲🇽", stadium: "Estadio BBVA",             cap: "51,349" },
];

const CATEGORY_ICONS: Record<string, string> = {
  flights: "✈", hotel: "🏨", visa: "📋", groundTransport: "🚌",
  food: "🍽", tickets: "🎟", misc: "📦",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", confirmed: "#00c896", completed: "#3b82f6", cancelled: "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Planning", confirmed: "Confirmed", completed: "Done", cancelled: "Cancelled",
};

function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function CountdownBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  const color = days <= 7 ? "#ef4444" : days <= 30 ? "#f59e0b" : "#00c896";
  const label = days < 0 ? "Departed" : days === 0 ? "Today!" : `${days}d away`;
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
      background: color + "22", color, border: `1px solid ${color}55`,
      animation: days >= 0 && days <= 7 ? "countPulse 2s ease infinite" : undefined,
    }}>
      {label}
    </span>
  );
}

function StatusTrail({ status }: { status: string }) {
  const labels = ["Planning", "Confirmed", "Travelling", "Done"];
  const stepIdx = status === "completed" ? 3 : status === "confirmed" ? 1 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
      {labels.map((label, i) => {
        const done = i < stepIdx || (status === "completed" && i === 3);
        const active = i === stepIdx && status !== "cancelled";
        const c = done || active ? "#00c896" : "#1e2d50";
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < labels.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", fontSize: 9, fontWeight: 700,
                background: done ? "#00c896" : active ? "#00c89444" : "#0a0f1e",
                border: `2px solid ${c}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done ? "#060b14" : c,
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
                flex: 1, height: 2, margin: "0 4px", marginBottom: 14,
                background: done ? "#00c896" : "#1e2d50", transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BudgetBar({ breakdown, budget, currency }: {
  breakdown: Record<string, number> | null; budget: number | null; currency: string;
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
          {currency} {total.toLocaleString()}{budget ? ` / ${budget.toLocaleString()} (${pct}%)` : ""}
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
          {Object.entries(breakdown).map(([cat, amt]) => (
            <div key={cat} style={{
              background: "#0a0f1e", border: "1px solid #1e2d50",
              borderRadius: 8, padding: "5px 10px", fontSize: 10,
            }}>
              {CATEGORY_ICONS[cat] ?? "📌"}{" "}
              <span style={{ color: "#94a3b8" }}>{cat}</span>{" "}
              <strong style={{ color: "#e2e8f0" }}>{currency} {Number(amt).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddTripForm({ userId, onClose, onSaved, onAskAgent }: {
  userId: string; onClose: () => void; onSaved: () => void; onAskAgent?: (p: string) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [destCity, setDestCity] = useState<typeof WC_HOST_CITIES[0] | null>(null);
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = !saving && origin.trim() && destCity;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, originCity: origin.trim(),
          destinationCity: destCity!.city,
          departDate: departDate || null, returnDate: returnDate || null,
          budget: budget ? Number(budget) : null, currency,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      onSaved();
      setTimeout(onClose, 1800);
    } catch {
      setError("Could not save trip — please try again.");
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
    borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 12,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  if (saved) {
    return (
      <div style={{
        background: "#0a1a12", border: "1px solid #00c89633", borderRadius: 14,
        padding: "28px 18px", marginBottom: 20, textAlign: "center",
        animation: "slideDown 0.2s ease",
      }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
        <div style={{ color: "#00c896", fontSize: 14, fontWeight: 700 }}>Trip saved!</div>
        <div style={{ color: "#64748b", fontSize: 11, marginTop: 6 }}>
          {origin} → {destCity?.city} · {destCity?.stadium}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#0d1a12", border: "1px solid #00c89633", borderRadius: 14,
      padding: "18px", marginBottom: 20, animation: "slideDown 0.2s ease",
    }}>
      <div style={{ color: "#00c896", fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
        ✈ Plan Your World Cup Trip
      </div>

      {/* Origin */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>Flying from</div>
        <input
          value={origin} onChange={(e) => setOrigin(e.target.value)}
          placeholder="Your city (e.g. Kuala Lumpur)" style={inputStyle}
        />
      </div>

      {/* Host city selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 8 }}>Match city</div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6,
          maxHeight: 200, overflowY: "auto", paddingRight: 2,
        }}>
          {WC_HOST_CITIES.map((c) => {
            const selected = destCity?.city === c.city;
            return (
              <button key={c.city} onClick={() => setDestCity(c)} style={{
                padding: "8px 10px", borderRadius: 10, border: `1px solid ${selected ? "#00c896" : "#1e2d50"}`,
                background: selected ? "#00c89618" : "#0a0f1e",
                color: selected ? "#00c896" : "#94a3b8",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                textAlign: "left", transition: "all 0.15s",
                boxShadow: selected ? "0 0 8px #00c89622" : undefined,
              }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{c.flag}</div>
                <div style={{ fontWeight: selected ? 700 : 500 }}>{c.city}</div>
                <div style={{ fontSize: 9, color: selected ? "#00c89699" : "#334155", marginTop: 1 }}>
                  {c.country}
                </div>
              </button>
            );
          })}
        </div>
        {destCity && (
          <div style={{
            marginTop: 8, padding: "6px 10px", borderRadius: 8,
            background: "#0a1a12", border: "1px solid #00c89622",
            fontSize: 10, color: "#64748b",
          }}>
            🏟 {destCity.stadium} · Cap. {destCity.cap}
          </div>
        )}
      </div>

      {/* Dates */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>Depart</div>
          <input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)}
            min="2026-06-11" max="2026-07-20"
            style={{ ...inputStyle, colorScheme: "dark" }} />
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>Return</div>
          <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
            min="2026-06-11" max="2026-07-25"
            style={{ ...inputStyle, colorScheme: "dark" }} />
        </div>
      </div>

      {/* Budget */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>Currency</div>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}>
            {["USD", "MYR", "EUR", "GBP", "AUD", "SGD", "CAD", "INR"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>Total budget (optional)</div>
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
            placeholder="5000" style={inputStyle} />
        </div>
      </div>

      {error && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 8 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={!canSubmit} style={{
          flex: 1, padding: "9px", borderRadius: 8, border: "none",
          background: canSubmit ? "linear-gradient(135deg, #00c896, #0ea5e9)" : "#1e2d50",
          color: "#fff", fontSize: 12, fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit",
        }}>
          {saving ? "Saving…" : "Save Trip →"}
        </button>
        <button onClick={onClose} disabled={saving} style={{
          padding: "9px 14px", borderRadius: 8, border: "1px solid #1e2d50",
          background: "transparent", color: "#64748b", fontSize: 12,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          Cancel
        </button>
      </div>

      {onAskAgent && origin && destCity && (
        <button onClick={() => onAskAgent(
          `Plan a detailed trip from ${origin} to ${destCity.city} for the World Cup 2026 — ` +
          `flights, hotel near ${destCity.stadium}, visa requirements and full budget breakdown in ${currency}.`
        )} style={{
          width: "100%", padding: "6px", borderRadius: 8, marginTop: 6,
          border: "1px solid #0ea5e944", background: "transparent",
          color: "#0ea5e9", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
        }}>
          Ask agent for detailed itinerary →
        </button>
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
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/trips?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        const t = d.trips ?? [];
        setTrips(t);
        if (t.length > 0) setExpanded(t[0].id);
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

  const wcDays = daysUntil("2026-06-11") ?? 0;

  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* WC countdown banner */}
        <div style={{
          background: "linear-gradient(135deg, #00c89614, #0ea5e908)",
          border: "1px solid #00c89633", borderRadius: 14,
          padding: "14px 18px", marginBottom: 18,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ fontSize: 28, filter: "drop-shadow(0 0 10px #00c896)" }}>✈️</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#00c896", fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
              {wcDays} days
            </div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
              until World Cup 2026 · June 11 · USA / Canada / Mexico
            </div>
          </div>
          <div style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
            background: wcDays <= 30 ? "#f59e0b22" : "#00c89622",
            color: wcDays <= 30 ? "#f59e0b" : "#00c896",
            border: `1px solid ${wcDays <= 30 ? "#f59e0b44" : "#00c89644"}`,
          }}>
            {trips.length} trip{trips.length !== 1 ? "s" : ""} planned
          </div>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h2 style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
            My Trips
          </h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              padding: "5px 14px", borderRadius: 20,
              border: `1px solid ${showForm ? "#00c896" : "#1e2d50"}`,
              background: showForm ? "#00c89622" : "transparent",
              color: showForm ? "#00c896" : "#94a3b8",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {showForm ? "✕ Close" : "+ Plan Trip"}
          </button>
        </div>

        {/* Add trip form */}
        {showForm && (
          <AddTripForm
            userId={userId}
            onClose={() => setShowForm(false)}
            onSaved={load}
            onAskAgent={onAskAgent}
          />
        )}

        {/* Empty state */}
        {trips.length === 0 && !showForm && (
          <div style={{
            padding: "40px 20px", textAlign: "center",
            border: "1px dashed #1e2d50", borderRadius: 14, background: "#0d1421",
          }}>
            <div style={{ fontSize: 48, marginBottom: 14, filter: "drop-shadow(0 0 20px #00c89644)" }}>🗺️</div>
            <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              No trips planned yet
            </div>
            <div style={{ color: "#64748b", fontSize: 12, maxWidth: 280, margin: "0 auto 20px", lineHeight: 1.7 }}>
              16 stadiums across 3 countries. Pick your match city, set your travel dates, and we&apos;ll build the perfect trip.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  padding: "10px 20px", borderRadius: 20, border: "1px solid #00c896",
                  background: "#00c89622", color: "#00c896", fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
                  boxShadow: "0 0 16px #00c89633",
                }}
              >
                ✈ Plan my World Cup trip →
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              {["New York 🇺🇸", "Mexico City 🇲🇽", "Vancouver 🇨🇦", "Dallas 🇺🇸", "Miami 🇺🇸"].map((city) => (
                <span key={city} style={{
                  fontSize: 10, padding: "3px 10px", borderRadius: 20,
                  background: "#0a0f1e", border: "1px solid #1e2d50", color: "#64748b",
                }}>
                  {city}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trip list */}
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
                boxShadow: isOpen ? "0 0 20px #00c89611" : "none",
                transition: "all 0.2s",
              }}>
                {/* Card header — click to expand */}
                <button
                  onClick={() => setExpanded(isOpen ? null : trip.id)}
                  style={{
                    width: "100%", padding: "16px 20px",
                    display: "flex", alignItems: "center", gap: 12,
                    background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: "linear-gradient(135deg, #00c896, #0ea5e9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, boxShadow: "0 0 14px #00c89633",
                  }}>
                    {WC_HOST_CITIES.find((c) => c.city === trip.destination_city)?.flag ?? "✈️"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, marginBottom: 3 }}>
                      {trip.origin_city} → {trip.destination_city}
                    </div>
                    {trip.travel_dates?.depart ? (
                      <div style={{ color: "#64748b", fontSize: 11 }}>
                        {new Date(trip.travel_dates.depart).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                        {trip.travel_dates.return && ` – ${new Date(trip.travel_dates.return).toLocaleDateString("en", { day: "numeric", month: "short" })}`}
                      </div>
                    ) : (
                      <div style={{ color: "#334155", fontSize: 11 }}>Dates TBD · World Cup Jun–Jul 2026</div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 20,
                      background: statusColor + "22", color: statusColor, border: `1px solid ${statusColor}44`,
                    }}>
                      {STATUS_LABELS[trip.status] ?? trip.status}
                    </span>
                    <CountdownBadge days={days} />
                  </div>

                  <span style={{ color: "#334155", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div style={{ padding: "4px 20px 20px", borderTop: "1px solid #1e2d5044" }}>
                    <StatusTrail status={trip.status} />
                    <BudgetBar breakdown={trip.cost_breakdown} budget={trip.budget} currency={trip.currency} />

                    {/* Itinerary */}
                    {trip.itinerary && trip.itinerary.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>ITINERARY</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {trip.itinerary.slice(0, 4).map((day) => (
                            <div key={day.day} style={{
                              background: "#0a0f1e", border: "1px solid #1e2d50",
                              borderRadius: 8, padding: "8px 12px", display: "flex", gap: 12,
                            }}>
                              <div style={{
                                background: "#00c89622", color: "#00c896",
                                fontSize: 10, padding: "2px 8px", borderRadius: 6, flexShrink: 0, fontWeight: 700,
                              }}>
                                Day {day.day}
                              </div>
                              <div>
                                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>{day.date}</div>
                                <div style={{ color: "#e2e8f0", fontSize: 12, lineHeight: 1.5 }}>
                                  {day.activities.slice(0, 2).join(" · ")}
                                  {day.activities.length > 2 && (
                                    <span style={{ color: "#64748b" }}> +{day.activities.length - 2} more</span>
                                  )}
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

                    {/* CTA quick actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                      {[
                        { label: "✈ Flight prices", prompt: `Find cheapest flights from ${trip.origin_city} to ${trip.destination_city} for the World Cup 2026 (June–July)` },
                        { label: "🏨 Hotels nearby", prompt: `Find hotels near the World Cup stadium in ${trip.destination_city} for my trip` },
                        { label: "🛂 Visa check", prompt: `What visa do I need to travel to ${trip.destination_city} for the World Cup 2026?` },
                        { label: "💰 Budget plan", prompt: `Create a detailed budget breakdown for a World Cup 2026 trip to ${trip.destination_city} from ${trip.origin_city}` },
                      ].map(({ label, prompt }) => (
                        <button key={label} onClick={() => onAskAgent?.(prompt)} style={{
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

                    <div style={{ marginTop: 10, color: "#1e2d50", fontSize: 10 }}>
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
        @keyframes countPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

"use client";
// src/components/AlertsPanel.tsx — Price alert manager with live price bars and add-alert form

import { useEffect, useState, useCallback } from "react";

interface PriceAlert {
  id: string;
  route_origin: string;
  route_dest: string;
  depart_from: string | null;
  depart_to: string | null;
  max_price: number;
  currency: string;
  current_price: number | null;
  last_checked: string | null;
  triggered: boolean;
  active: boolean;
  created_at: string;
}

interface AlertsPanelProps {
  userId: string;
  onAskAgent?: (prompt: string) => void;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PriceBar({ current, max, currency }: { current: number | null; max: number; currency: string }) {
  if (current === null) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
          <span style={{ color: "var(--text3)" }}>Current price</span>
          <span style={{ color: "var(--text4)" }}>Not checked yet</span>
        </div>
        <div style={{ height: 5, borderRadius: 4, background: "var(--border)" }} />
      </div>
    );
  }

  const pct = Math.min(140, Math.round((current / max) * 100));
  const below = current <= max;
  const diff = Math.abs(current - max);
  const diffPct = Math.round((diff / max) * 100);
  const barColor = below ? "var(--accent)" : pct > 120 ? "var(--red)" : "var(--orange)";

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
        <span style={{ color: "var(--text3)" }}>
          Current: <strong style={{ color: barColor }}>
            {currency} {current.toLocaleString()}
          </strong>
        </span>
        <span style={{ color: below ? "var(--accent)" : "var(--orange)", fontWeight: 600 }}>
          {below ? `🎉 ${diffPct}% below target` : `▲ ${diffPct}% above target`}
        </span>
      </div>

      <div style={{ height: 6, borderRadius: 4, background: "var(--bg)", border: "1px solid var(--border)", overflow: "hidden", position: "relative" }}>
        {/* Target marker */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, (max / (max * 1.4)) * 100)}%`,
          width: 2, background: "var(--text4)",
        }} />
        <div style={{
          height: "100%", width: `${Math.min(100, pct)}%`,
          background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
          borderRadius: 4, transition: "width 0.8s ease",
          boxShadow: below ? "0 0 6px var(--accent-glow)" : undefined,
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text4)", marginTop: 3 }}>
        <span>$0</span>
        <span style={{ color: "var(--text3)" }}>Target: {currency} {max.toLocaleString()}</span>
      </div>
    </div>
  );
}

function AddAlertForm({
  userId, onClose, onSaved, onAskAgent,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  onAskAgent?: (prompt: string) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!origin || !dest || !price) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, origin, dest, price: Number(price), currency }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      onSaved();
      setTimeout(onClose, 1500);
    } catch {
      setError("Could not save alert — check your connection.");
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 12,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  if (saved) {
    return (
      <div style={{
        background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 14,
        padding: "24px 18px", marginBottom: 20, textAlign: "center",
        animation: "slideDown 0.2s ease",
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
        <div style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>Alert saved!</div>
        <div style={{ color: "var(--text3)", fontSize: 11, marginTop: 4 }}>
          We&apos;ll notify you when {origin.toUpperCase()} → {dest} drops below {currency} {Number(price).toLocaleString()}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--accent-border)", borderRadius: 14,
      padding: "16px 18px", marginBottom: 20,
      animation: "slideDown 0.2s ease",
    }}>
      <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
        🔔 Track a new route
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ color: "var(--text3)", fontSize: 10, marginBottom: 4 }}>From</div>
          <input
            value={origin} onChange={(e) => setOrigin(e.target.value)}
            placeholder="Kuala Lumpur" style={inputStyle}
          />
        </div>
        <div>
          <div style={{ color: "var(--text3)", fontSize: 10, marginBottom: 4 }}>To (host city)</div>
          <input
            value={dest} onChange={(e) => setDest(e.target.value)}
            placeholder="New York" style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ color: "var(--text3)", fontSize: 10, marginBottom: 4 }}>Currency</div>
          <select
            value={currency} onChange={(e) => setCurrency(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {["USD", "MYR", "EUR", "GBP", "AUD", "SGD", "INR"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ color: "var(--text3)", fontSize: 10, marginBottom: 4 }}>Alert me below</div>
          <input
            type="number" value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder="900" style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--red)", fontSize: 11, marginBottom: 8 }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={submit} disabled={saving || !origin || !dest || !price}
          style={{
            flex: 1, padding: "8px", borderRadius: 8, border: "none",
            background: !saving && origin && dest && price ? "linear-gradient(135deg, var(--accent), var(--blue))" : "var(--border)",
            color: "#fff", fontSize: 12,
            cursor: !saving && origin && dest && price ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontWeight: 600,
          }}
        >
          {saving ? "Saving…" : "Set Alert →"}
        </button>
        <button
          onClick={onClose} disabled={saving}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text3)", fontSize: 12,
            cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>

      {onAskAgent && origin && dest && price && (
        <button
          onClick={() => onAskAgent(
            `Check current flight prices from ${origin} to ${dest} for the World Cup 2026 travel window (June–July 2026). My target budget is ${currency} ${price}.`
          )}
          style={{
            width: "100%", padding: "6px", borderRadius: 8, border: "1px solid var(--blue-dim)",
            background: "transparent", color: "var(--blue)", fontSize: 11,
            cursor: "pointer", fontFamily: "inherit", marginTop: 6,
          }}
        >
          Ask agent for current prices →
        </button>
      )}
    </div>
  );
}

function AlertRow({ alert, onDelete, deletingId, refreshing }: {
  alert: PriceAlert;
  onDelete: (id: string) => void;
  deletingId: string | null;
  refreshing: boolean;
}) {
  const isDeleting = deletingId === alert.id;
  const pulseColor = alert.triggered ? "var(--accent)" : alert.active ? "var(--blue)" : "var(--text3)";

  return (
    <div style={{
      background: alert.triggered ? "var(--accent-dim)" : "var(--surface)",
      border: `1px solid ${alert.triggered ? "var(--accent-border)" : alert.active ? "var(--blue-dim)" : "var(--border)"}`,
      borderRadius: 12, padding: "14px 16px",
      transition: "border-color 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Route + status dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: pulseColor,
              boxShadow: alert.active && !alert.triggered ? `0 0 6px ${pulseColor}` : undefined,
              animation: alert.active && !alert.triggered ? "monitorPulse 2s ease infinite" : undefined,
            }} />
            <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>
              ✈ {alert.route_origin} → {alert.route_dest}
            </span>
          </div>

          {alert.depart_from && (
            <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 4, marginLeft: 15 }}>
              Window: {alert.depart_from}{alert.depart_to ? ` – ${alert.depart_to}` : ""}
            </div>
          )}

          <div style={{ fontSize: 11, color: "var(--text3)", marginLeft: 15, marginBottom: 2 }}>
            Target: <strong style={{ color: "var(--text)" }}>
              {alert.currency} {Number(alert.max_price).toLocaleString()}
            </strong>
          </div>

          <PriceBar current={alert.current_price} max={Number(alert.max_price)} currency={alert.currency} />

          <div style={{ fontSize: 10, color: "var(--text4)", marginTop: 6, display: "flex", gap: 12 }}>
            <span>Checked: {refreshing ? "⏳ checking…" : relativeTime(alert.last_checked)}</span>
            <span>Created: {new Date(alert.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <button
          onClick={() => onDelete(alert.id)} disabled={isDeleting}
          title="Remove alert"
          style={{
            padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text3)", fontSize: 12,
            cursor: isDeleting ? "not-allowed" : "pointer", flexShrink: 0,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLElement).style.color = "var(--red)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text3)"; }}
        >
          {isDeleting ? "…" : "✕"}
        </button>
      </div>
    </div>
  );
}

export default function AlertsPanel({ userId, onAskAgent }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/alerts?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const deactivate = async (alertId: string) => {
    setDeletingId(alertId);
    try {
      await fetch("/api/alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const refreshPrices = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/jobs/price-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scheduler-secret": "local-refresh" },
        body: JSON.stringify({ userId }),
      });
      await new Promise((r) => setTimeout(r, 1500));
      load();
    } catch {
      // silently fail
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px 16px", fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", marginBottom: 10 }}>
              {[70, 50, 90].map((w, j) => (
                <div key={j} style={{ height: 10, width: `${w}%`, background: "var(--border)", borderRadius: 4, marginBottom: 8, animation: "shimmer 1.5s ease infinite" }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const active = alerts.filter((a) => a.active && !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);
  const inactive = alerts.filter((a) => !a.active && !a.triggered);

  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%", fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <h2 style={{ color: "var(--text)", fontSize: 16, fontWeight: 600, margin: 0, flex: 1 }}>
            Price Alerts
          </h2>
          {triggered.length > 0 && (
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 20,
              background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)",
              animation: "countPulse 1.5s ease infinite",
            }}>
              🎉 {triggered.length} triggered!
            </span>
          )}
          {active.length > 0 && (
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 20,
              background: "var(--blue-dim)", color: "var(--blue)", border: "1px solid var(--blue-dim)",
            }}>
              ● {active.length} monitoring
            </span>
          )}
          <button
            onClick={refreshPrices} disabled={refreshing}
            title="Refresh all prices"
            style={{
              padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text3)", fontSize: 11,
              cursor: refreshing ? "not-allowed" : "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (!refreshing) { (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)"; (e.currentTarget as HTMLElement).style.color = "var(--blue)"; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text3)"; }}
          >
            {refreshing ? "⏳ checking…" : "↺ Refresh"}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              padding: "4px 12px", borderRadius: 20, border: "1px solid var(--accent-border)",
              background: showForm ? "var(--accent-dim)" : "transparent",
              color: "var(--accent)", fontSize: 11,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {showForm ? "✕ Cancel" : "+ Track route"}
          </button>
        </div>

        {/* Add alert form */}
        {showForm && (
          <AddAlertForm
            userId={userId}
            onClose={() => setShowForm(false)}
            onSaved={load}
            onAskAgent={onAskAgent}
          />
        )}

        {/* Empty state */}
        {alerts.length === 0 && !showForm && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16, filter: "drop-shadow(0 0 16px var(--blue-dim))" }}>🔔</div>
            <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No price alerts yet</div>
            <div style={{ color: "var(--text3)", fontSize: 12, maxWidth: 280, margin: "0 auto 20px", lineHeight: 1.6 }}>
              Track flight prices to World Cup host cities. Get notified when they drop below your target.
            </div>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: "10px 20px", borderRadius: 20, border: "1px solid var(--blue)",
                background: "var(--blue-dim)", color: "var(--blue)", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
              }}
            >
              🔔 Track my first route →
            </button>
          </div>
        )}

        {/* Triggered */}
        {triggered.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: "var(--accent)", fontSize: 11, marginBottom: 10, fontWeight: 600 }}>
              🎉 TRIGGERED — BOOK NOW
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {triggered.map((a) => (
                <AlertRow key={a.id} alert={a} onDelete={deactivate} deletingId={deletingId} refreshing={refreshing} />
              ))}
            </div>
          </div>
        )}

        {/* Active */}
        {active.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: "var(--text3)", fontSize: 11, marginBottom: 10 }}>
              ● MONITORING ({active.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {active.map((a) => (
                <AlertRow key={a.id} alert={a} onDelete={deactivate} deletingId={deletingId} refreshing={refreshing} />
              ))}
            </div>
          </div>
        )}

        {/* Inactive */}
        {inactive.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: "var(--text4)", fontSize: 11, marginBottom: 10 }}>⏸ INACTIVE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inactive.map((a) => (
                <AlertRow key={a.id} alert={a} onDelete={deactivate} deletingId={deletingId} refreshing={refreshing} />
              ))}
            </div>
          </div>
        )}

        {/* Popular routes */}
        {alerts.length === 0 && !showForm && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ color: "var(--text3)", fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>
              🌍 POPULAR WC 2026 ROUTES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { from: "London", to: "New York", est: "$340–$580" },
                { from: "São Paulo", to: "Miami", est: "$280–$520" },
                { from: "Tokyo", to: "Los Angeles", est: "$650–$1,100" },
                { from: "Dubai", to: "New York", est: "$480–$820" },
                { from: "Lagos", to: "New York", est: "$650–$1,100" },
                { from: "Sydney", to: "Los Angeles", est: "$900–$1,500" },
              ].map(({ from, to, est }) => (
                <button key={from} onClick={() => { setShowForm(true); }} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 8,
                  background: "var(--bg)", border: "1px solid var(--border)",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--blue-dim)"; (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg)"; }}
                >
                  <span style={{ fontSize: 14 }}>✈</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: "var(--text)", fontSize: 11, fontWeight: 600 }}>{from}</span>
                    <span style={{ color: "var(--text4)", fontSize: 11 }}> → </span>
                    <span style={{ color: "var(--blue)", fontSize: 11, fontWeight: 600 }}>{to}</span>
                  </div>
                  <span style={{ color: "var(--text3)", fontSize: 10 }}>{est}</span>
                  <span style={{ color: "var(--text4)", fontSize: 11 }}>+</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tip */}
        {alerts.length > 0 && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, background: "var(--bg)",
            border: "1px solid var(--border)", color: "var(--text3)", fontSize: 11, lineHeight: 1.6,
          }}>
            💡 Prices are checked every 6 hours. Click ↺ Refresh to check right now. Hit the triggered alerts fast — World Cup fares sell out quickly.
          </div>
        )}
      </div>

    </div>
  );
}

"use client";
// src/components/AlertsPanel.tsx — Price alert manager

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
}

function PriceDiff({ current, max, currency }: { current: number | null; max: number; currency: string }) {
  if (current === null) return <span style={{ color: "#64748b" }}>Not checked yet</span>;
  const diff = current - max;
  const pct = Math.abs(Math.round((diff / max) * 100));
  if (diff <= 0) {
    return (
      <span style={{ color: "#00c896", fontWeight: 600 }}>
        {currency} {current.toLocaleString()} 🎉 {pct}% below target!
      </span>
    );
  }
  return (
    <span style={{ color: "#f59e0b" }}>
      {currency} {current.toLocaleString()} ({pct}% above target)
    </span>
  );
}

export default function AlertsPanel({ userId }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
        Loading alerts…
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
        <div style={{ color: "#94a3b8", fontSize: 14 }}>No price alerts set.</div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Ask the agent to "alert me when flights from X to Y drop below $900" to start monitoring.
        </div>
      </div>
    );
  }

  const active = alerts.filter((a) => a.active && !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);
  const inactive = alerts.filter((a) => !a.active && !a.triggered);

  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, margin: 0 }}>
            Price Alerts
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Pill color="#00c896">{active.length} active</Pill>
            {triggered.length > 0 && <Pill color="#f59e0b">{triggered.length} triggered</Pill>}
          </div>
        </div>

        {triggered.length > 0 && (
          <Section title="🎉 Triggered — Book Now!" alerts={triggered} onDelete={deactivate} deletingId={deletingId} />
        )}
        {active.length > 0 && (
          <Section title="🔔 Monitoring" alerts={active} onDelete={deactivate} deletingId={deletingId} />
        )}
        {inactive.length > 0 && (
          <Section title="⏸ Inactive" alerts={inactive} onDelete={deactivate} deletingId={deletingId} />
        )}
      </div>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 20,
      background: color + "22", color, border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  );
}

function Section({ title, alerts, onDelete, deletingId }: {
  title: string;
  alerts: PriceAlert[];
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} onDelete={onDelete} deletingId={deletingId} />
        ))}
      </div>
    </div>
  );
}

function AlertRow({ alert, onDelete, deletingId }: {
  alert: PriceAlert;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const isDeleting = deletingId === alert.id;

  return (
    <div style={{
      background: alert.triggered ? "#0d1a0a" : "#0d1421",
      border: `1px solid ${alert.triggered ? "#00c89633" : "#1e2d50"}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          {/* Route */}
          <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            ✈ {alert.route_origin} → {alert.route_dest}
          </div>

          {/* Date range */}
          {alert.depart_from && (
            <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>
              Travel window: {alert.depart_from}{alert.depart_to ? ` – ${alert.depart_to}` : ""}
            </div>
          )}

          {/* Target price */}
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Target: <strong style={{ color: "#e2e8f0" }}>{alert.currency} {Number(alert.max_price).toLocaleString()}</strong>
          </div>

          {/* Current price */}
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Current: <PriceDiff current={alert.current_price} max={Number(alert.max_price)} currency={alert.currency} />
          </div>

          {/* Last checked */}
          {alert.last_checked && (
            <div style={{ color: "#334155", fontSize: 10, marginTop: 6 }}>
              Last checked: {new Date(alert.last_checked).toLocaleString()}
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(alert.id)} disabled={isDeleting}
          title="Remove alert"
          style={{
            padding: "4px 8px", borderRadius: 6, border: "1px solid #1e2d50",
            background: "transparent", color: "#64748b", fontSize: 12,
            cursor: isDeleting ? "not-allowed" : "pointer", flexShrink: 0,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#ef4444"; (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d50"; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
        >
          {isDeleting ? "…" : "✕"}
        </button>
      </div>
    </div>
  );
}

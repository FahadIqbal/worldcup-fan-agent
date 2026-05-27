"use client";
// src/app/page.tsx — WorldCup Fan Command Center — Main tab layout

import { useState, useCallback, useEffect } from "react";
import ChatPanel from "@/components/ChatPanel";
import TripCard from "@/components/TripCard";
import AlertsPanel from "@/components/AlertsPanel";
import FantasyPanel from "@/components/FantasyPanel";
import FixturesPanel from "@/components/FixturesPanel";
import LocationPicker from "@/components/LocationPicker";
import { useLocation } from "@/hooks/useLocation";

// Replace with Firebase Auth UID in production
const DEMO_USER_ID = "demo-user";

const WC_START = new Date("2026-06-11T18:00:00Z");
const WC_END   = new Date("2026-07-19T00:00:00Z");

function useTournamentPhase() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return { days: 0, hrs: 0, mins: 0, secs: 0, isOn: false, isPost: false, mounted: false };
  const ms    = WC_START.getTime() - now.getTime();
  const isOn  = now >= WC_START && now <= WC_END;
  const isPost = now > WC_END;
  const days  = Math.max(0, Math.ceil(ms / 86400000));
  const hrs   = Math.max(0, Math.floor((ms % 86400000) / 3600000));
  const mins  = Math.max(0, Math.floor((ms % 3600000) / 60000));
  const secs  = Math.max(0, Math.floor((ms % 60000) / 1000));
  return { days, hrs, mins, secs, isOn, isPost, mounted: true };
}

type Tab = "chat" | "trips" | "alerts" | "fantasy" | "fixtures";

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "chat",     icon: "💬", label: "Chat" },
  { id: "trips",    icon: "✈️",  label: "Trips" },
  { id: "alerts",   icon: "🔔", label: "Alerts" },
  { id: "fantasy",  icon: "🏆", label: "Fantasy" },
  { id: "fixtures", icon: "📅", label: "Fixtures" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("chat");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const { location, detecting, setLocation, detectByIP, detectByGPS } = useLocation();
  const { days, hrs, mins, secs, isOn, isPost, mounted: phaseMounted } = useTournamentPhase();

  const handleAskAgent = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    setTab("chat");
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      background: "var(--bg, #060b14)",
      color: "var(--text, #f1f5f9)",
      fontFamily: "var(--font-sans, 'Inter', sans-serif)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient gradient */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 90% 55% at 50% -15%, #00c89610 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 85% 85%, #3b82f610 0%, transparent 55%), radial-gradient(ellipse 30% 25% at 15% 70%, #a78bfa08 0%, transparent 50%)",
      }} />

      {/* Header */}
      <header style={{
        padding: "0 20px",
        height: 56,
        borderBottom: "1px solid var(--border, #1a2d4a)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(6,11,20,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        position: "relative",
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          width: 34, height: 34, borderRadius: 9, fontSize: 17, flexShrink: 0,
          background: "linear-gradient(135deg, #00c896 0%, #0ea5e9 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 1px #00c89630, 0 0 16px #00c89630",
        }}>⚽</div>

        {/* Title */}
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", letterSpacing: "-0.4px" }}>
            WorldCup Fan Command Center
          </div>
          <div style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.08em", marginTop: 3, fontFamily: "var(--font-mono)", opacity: 0.8 }}>
            GEMINI 1.5 PRO · GOOGLE CLOUD AGENT BUILDER
          </div>
        </div>

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <LocationPicker
            location={location}
            detecting={detecting}
            onSelect={setLocation}
            onDetectGPS={detectByGPS}
            onDetectIP={detectByIP}
          />
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 11px", borderRadius: 20,
            background: "var(--accent-dim, #00c89618)",
            border: "1px solid var(--accent-border, #00c89630)",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--accent)", boxShadow: "0 0 6px var(--accent)",
              animation: "pulse 2s ease infinite", flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.06em", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              ONLINE
            </span>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        background: "rgba(6,11,20,0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        position: "relative",
        zIndex: 10,
        flexShrink: 0,
        padding: "6px 12px 0",
        gap: 2,
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "8px 6px 10px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                background: active ? "var(--accent-dim)" : "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                borderRadius: "8px 8px 0 0",
                color: active ? "var(--accent)" : "var(--text3)",
                fontSize: 11, fontWeight: active ? 600 : 400,
                cursor: "pointer", fontFamily: "var(--font-sans)",
                transition: "all 0.18s ease",
                letterSpacing: 0.1,
              }}
              onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.color = "var(--text2)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; } }}
              onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.color = "var(--text3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tournament Status Bar — client-only to avoid hydration mismatch */}
      {phaseMounted && !isPost && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "4px 16px",
          background: isOn ? "rgba(0,200,150,0.06)" : "var(--bg2, #080e18)",
          borderBottom: `1px solid ${isOn ? "var(--accent-border)" : "var(--border)"}`,
          flexShrink: 0, overflowX: "auto",
          scrollbarWidth: "none", fontSize: 10,
          fontFamily: "var(--font-mono)",
        }}>
          {isOn ? (
            <>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "var(--accent)",
                flexShrink: 0, boxShadow: "0 0 8px var(--accent)", animation: "glow 1.5s ease infinite",
              }} />
              <span style={{ color: "var(--accent)", fontWeight: 600, letterSpacing: "0.08em", flexShrink: 0 }}>LIVE · FIFA WORLD CUP 2026</span>
            </>
          ) : (
            <>
              <span style={{ color: "var(--text3)", letterSpacing: "0.06em", flexShrink: 0 }}>⚽ KICK-OFF IN</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 1, flexShrink: 0 }}>
                {[{ v: days, u: "d" }, { v: hrs, u: "h" }, { v: mins, u: "m" }, { v: secs, u: "s" }].map(({ v, u }, i) => (
                  <span key={u} style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <span suppressHydrationWarning style={{
                      color: "var(--text)", fontSize: 12, fontWeight: 700,
                      minWidth: u === "d" ? 24 : 20, textAlign: "right",
                    }}>
                      {String(v).padStart(2, "0")}
                    </span>
                    <span style={{ color: "var(--text4)", fontSize: 9 }}>{u}</span>
                    {i < 3 && <span style={{ color: "var(--text4)", fontSize: 10, margin: "0 1px" }}>:</span>}
                  </span>
                ))}
              </div>
            </>
          )}
          <div style={{ width: 1, height: 10, background: "var(--border)", flexShrink: 0, margin: "0 4px" }} />
          <span style={{ color: "var(--text4)", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.04em" }}>
            🇺🇸 USA · 🇨🇦 Canada · 🇲🇽 Mexico · Jun 11 – Jul 19
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 5, flexShrink: 0 }}>
            {["New York", "Mexico City", "LA", "Dallas"].map((city) => (
              <span key={city} style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 20,
                background: "var(--surface)", border: "1px solid var(--border)",
                color: "var(--text3)", whiteSpace: "nowrap", letterSpacing: "0.04em",
              }}>{city}</span>
            ))}
          </div>
        </div>
      )}

      {/* Panel area */}
      <main style={{ flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Chat — always mounted so session state persists */}
        <div style={{ display: tab === "chat" ? "flex" : "none", flexDirection: "column", height: "100%" }}>
          <ChatPanel
            userId={DEMO_USER_ID}
            userLocation={location}
            initialPrompt={pendingPrompt ?? undefined}
            onPromptConsumed={() => setPendingPrompt(null)}
          />
        </div>

        {tab === "trips" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <TripCard userId={DEMO_USER_ID} onAskAgent={handleAskAgent} />
          </div>
        )}

        {tab === "alerts" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <AlertsPanel userId={DEMO_USER_ID} onAskAgent={handleAskAgent} />
          </div>
        )}

        {tab === "fantasy" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <FantasyPanel userId={DEMO_USER_ID} onAskAgent={handleAskAgent} />
          </div>
        )}

        {/* Fixtures — always mounted to preserve fetch cache */}
        <div style={{ display: tab === "fixtures" ? "flex" : "none", flexDirection: "column", height: "100%" }}>
          <FixturesPanel onAskAgent={handleAskAgent} />
        </div>
      </main>

      <style>{`
        @media (max-width: 520px) { .tab-label { display: none !important; } }
      `}</style>
    </div>
  );
}

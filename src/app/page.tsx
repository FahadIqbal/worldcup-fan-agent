"use client";
// src/app/page.tsx — WorldCup Fan Command Center — Main tab layout

import { useState, useCallback } from "react";
import ChatPanel from "@/components/ChatPanel";
import TripCard from "@/components/TripCard";
import AlertsPanel from "@/components/AlertsPanel";
import FantasyPanel from "@/components/FantasyPanel";
import FixturesPanel from "@/components/FixturesPanel";
import LocationPicker from "@/components/LocationPicker";
import { useLocation } from "@/hooks/useLocation";

// Replace with Firebase Auth UID in production
const DEMO_USER_ID = "demo-user";

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

  const handleAskAgent = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    setTab("chat");
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      background: "#060b14",
      color: "#e2e8f0",
      fontFamily: "'DM Mono', monospace",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient gradient */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, #00c89614 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 80% 80%, #3b82f614 0%, transparent 50%)",
      }} />

      {/* Header */}
      <header style={{
        padding: "14px 20px",
        borderBottom: "1px solid #1e2d50",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#060b14ee",
        backdropFilter: "blur(12px)",
        position: "relative",
        zIndex: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, fontSize: 18, flexShrink: 0,
          background: "linear-gradient(135deg, #00c896, #0ea5e9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 20px #00c89644",
        }}>
          ⚽
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", letterSpacing: "-0.3px" }}>
            WorldCup Fan Command Center
          </div>
          <div style={{ fontSize: 10, color: "#00c896", letterSpacing: 1 }}>
            POWERED BY GEMINI 1.5 PRO · GOOGLE CLOUD AGENT BUILDER
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <LocationPicker
            location={location}
            detecting={detecting}
            onSelect={setLocation}
            onDetectGPS={detectByGPS}
            onDetectIP={detectByIP}
          />
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 20,
            background: "#0a1a12", border: "1px solid #00c89633",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", display: "inline-block",
              background: "#00c896", boxShadow: "0 0 6px #00c896",
              animation: "pulse 2s ease infinite",
            }} />
            <span style={{ fontSize: 10, color: "#00c896", letterSpacing: 1 }}>AGENT ONLINE</span>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav style={{
        display: "flex",
        borderBottom: "1px solid #1e2d50",
        background: "#060b14ee",
        backdropFilter: "blur(12px)",
        position: "relative",
        zIndex: 10,
        flexShrink: 0,
      }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "10px 4px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              background: "transparent", border: "none",
              borderBottom: tab === t.id ? "2px solid #00c896" : "2px solid transparent",
              color: tab === t.id ? "#00c896" : "#64748b",
              fontSize: 10, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s", letterSpacing: 0.3,
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

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
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 480px) { .tab-label { display: none !important; } }
      `}</style>
    </div>
  );
}

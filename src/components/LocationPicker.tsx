"use client";
// src/components/LocationPicker.tsx — Location badge + popover for header

import { useState, useRef, useEffect, useCallback } from "react";
import type { UserLocation } from "@/types/location";

const POPULAR_CITIES: Array<{
  emoji: string;
  city: string;
  country: string;
  countryCode: string;
  currency: string;
}> = [
  { emoji: "🇲🇾", city: "Kuala Lumpur",  country: "Malaysia",       countryCode: "MY", currency: "MYR" },
  { emoji: "🇸🇬", city: "Singapore",     country: "Singapore",      countryCode: "SG", currency: "SGD" },
  { emoji: "🇯🇵", city: "Tokyo",         country: "Japan",          countryCode: "JP", currency: "JPY" },
  { emoji: "🇰🇷", city: "Seoul",         country: "South Korea",    countryCode: "KR", currency: "KRW" },
  { emoji: "🇮🇳", city: "Mumbai",        country: "India",          countryCode: "IN", currency: "INR" },
  { emoji: "🇦🇺", city: "Sydney",        country: "Australia",      countryCode: "AU", currency: "AUD" },
  { emoji: "🇬🇧", city: "London",        country: "United Kingdom", countryCode: "GB", currency: "GBP" },
  { emoji: "🇫🇷", city: "Paris",         country: "France",         countryCode: "FR", currency: "EUR" },
  { emoji: "🇩🇪", city: "Berlin",        country: "Germany",        countryCode: "DE", currency: "EUR" },
  { emoji: "🇧🇷", city: "São Paulo",     country: "Brazil",         countryCode: "BR", currency: "BRL" },
  { emoji: "🇲🇽", city: "Mexico City",   country: "Mexico",         countryCode: "MX", currency: "MXN" },
  { emoji: "🇦🇪", city: "Dubai",         country: "UAE",            countryCode: "AE", currency: "AED" },
  { emoji: "🇪🇬", city: "Cairo",         country: "Egypt",          countryCode: "EG", currency: "EGP" },
  { emoji: "🇳🇬", city: "Lagos",         country: "Nigeria",        countryCode: "NG", currency: "NGN" },
  { emoji: "🇿🇦", city: "Johannesburg",  country: "South Africa",   countryCode: "ZA", currency: "ZAR" },
  { emoji: "🇺🇸", city: "New York",      country: "United States",  countryCode: "US", currency: "USD" },
  { emoji: "🇨🇦", city: "Toronto",       country: "Canada",         countryCode: "CA", currency: "CAD" },
  { emoji: "🇨🇳", city: "Shanghai",      country: "China",          countryCode: "CN", currency: "CNY" },
];

interface LocationPickerProps {
  location: UserLocation;
  detecting: boolean;
  onSelect: (loc: UserLocation) => void;
  onDetectGPS: () => void;
  onDetectIP: () => void;
}

export default function LocationPicker({
  location,
  detecting,
  onSelect,
  onDetectGPS,
  onDetectIP,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = useCallback(
    (c: (typeof POPULAR_CITIES)[number]) => {
      onSelect({ city: c.city, country: c.country, countryCode: c.countryCode, currency: c.currency, source: "manual" });
      setOpen(false);
      setSearch("");
    },
    [onSelect]
  );

  const handleCustomSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const val = search.trim();
      if (!val) return;
      // Accept "City, Country" or just "City"
      const parts = val.split(",").map((s) => s.trim());
      onSelect({ city: parts[0], country: parts[1] ?? "", countryCode: "", currency: "USD", source: "manual" });
      setOpen(false);
      setSearch("");
    },
    [search, onSelect]
  );

  const filtered = search
    ? POPULAR_CITIES.filter(
        (c) =>
          c.city.toLowerCase().includes(search.toLowerCase()) ||
          c.country.toLowerCase().includes(search.toLowerCase())
      )
    : POPULAR_CITIES;

  const label = detecting
    ? "Detecting…"
    : location.city
    ? `${location.city}`
    : "Set location";

  const sourceIcon =
    location.source === "ip" ? "📡" :
    location.source === "gps" ? "📍" :
    location.source === "manual" ? "✏️" : "📍";

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Badge trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change your location"
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 20,
          background: open ? "#0d2a1e" : "#0a1a12",
          border: `1px solid ${open ? "#00c89666" : "#00c89633"}`,
          color: "#00c896", fontSize: 11, cursor: "pointer",
          fontFamily: "'DM Mono', monospace", letterSpacing: 0.5,
          transition: "all 0.15s",
        }}
      >
        <span>{sourceIcon}</span>
        <span>{detecting ? "…" : label}</span>
        <span style={{ color: "#00c89680", fontSize: 9 }}>▾</span>
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 280, maxHeight: 420,
          background: "#0a0f1e", border: "1px solid #1e2d50",
          borderRadius: 12, boxShadow: "0 8px 32px #000a",
          zIndex: 100, overflow: "hidden",
          display: "flex", flexDirection: "column",
          fontFamily: "'DM Mono', monospace",
        }}>
          {/* Header */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #1e2d50" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Your departure city</div>
            {location.city && (
              <div style={{ fontSize: 12, color: "#e2e8f0", marginBottom: 8 }}>
                Currently: <span style={{ color: "#00c896" }}>{location.city}{location.country ? `, ${location.country}` : ""}</span>
                <span style={{ color: "#334155", marginLeft: 6, fontSize: 10 }}>via {location.source}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => { onDetectIP(); setOpen(false); }}
                style={{
                  flex: 1, padding: "5px 8px", borderRadius: 8, fontSize: 10,
                  background: "#0d1f14", border: "1px solid #00c89633",
                  color: "#00c896", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                📡 Auto-detect
              </button>
              <button
                onClick={() => { onDetectGPS(); setOpen(false); }}
                style={{
                  flex: 1, padding: "5px 8px", borderRadius: 8, fontSize: 10,
                  background: "#0d1f14", border: "1px solid #00c89633",
                  color: "#00c896", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                📍 Use GPS
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #1e2d50" }}>
            <form onSubmit={handleCustomSubmit}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or type city, country…"
                autoFocus
                style={{
                  width: "100%", background: "#060b14",
                  border: "1px solid #1e2d50", borderRadius: 8,
                  padding: "6px 10px", color: "#e2e8f0", fontSize: 11,
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </form>
          </div>

          {/* City list */}
          <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "12px", color: "#64748b", fontSize: 11, textAlign: "center" }}>
                Press Enter to use "{search}"
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={`${c.city}-${c.countryCode}`}
                onClick={() => handleSelect(c)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 12px", background: "transparent", border: "none",
                  color: location.city === c.city ? "#00c896" : "#94a3b8",
                  fontSize: 11, cursor: "pointer", textAlign: "left",
                  fontFamily: "inherit", transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#0d1f14"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 14 }}>{c.emoji}</span>
                <span style={{ flex: 1 }}>{c.city}</span>
                <span style={{ color: "#334155", fontSize: 10 }}>{c.country}</span>
                {location.city === c.city && <span style={{ color: "#00c896", fontSize: 10 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

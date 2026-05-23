"use client";
// src/hooks/useLocation.ts — Location detection with localStorage, IP, and GPS fallback

import { useState, useEffect, useCallback } from "react";
import { type UserLocation, DEFAULT_LOCATION } from "@/types/location";

export type { UserLocation };

const STORAGE_KEY = "wc26_user_location";

export function useLocation() {
  const [location, setLocationState] = useState<UserLocation | null>(null);
  const [detecting, setDetecting] = useState(false);

  const detectByIP = useCallback(async () => {
    setDetecting(true);
    try {
      const res = await fetch("/api/location");
      const data = await res.json() as UserLocation & { error?: string };
      if (data.error || !data.city) return;
      const loc: UserLocation = { ...data, source: "ip" };
      setLocationState(loc);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    } catch {
      // Silent fail — no location set, user can pick manually
    } finally {
      setDetecting(false);
    }
  }, []);

  // On mount: load from localStorage first, then fall back to IP detection
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UserLocation;
        if (parsed.city) {
          setLocationState(parsed);
          return;
        }
      } catch {
        // Bad stored data — proceed to detect
      }
    }
    detectByIP();
  // detectByIP is stable (useCallback with no deps), safe to include
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectByGPS = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json() as {
            address?: {
              city?: string; town?: string; village?: string; county?: string;
              state?: string; country?: string; country_code?: string;
            };
          };
          const addr = data.address ?? {};
          const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? "";
          if (!city) return;
          const loc: UserLocation = {
            city,
            country: addr.country ?? "",
            countryCode: (addr.country_code ?? "").toUpperCase(),
            region: addr.state,
            currency: "USD", // Nominatim doesn't provide currency; will be overridden by manual picks
            source: "gps",
          };
          setLocationState(loc);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
        } catch {
          // Silent fail
        } finally {
          setDetecting(false);
        }
      },
      () => setDetecting(false),
      { timeout: 10_000 }
    );
  }, []);

  const setLocation = useCallback((loc: UserLocation) => {
    const manual: UserLocation = { ...loc, source: "manual" };
    setLocationState(manual);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manual));
  }, []);

  const resetLocation = useCallback(() => {
    setLocationState(null);
    localStorage.removeItem(STORAGE_KEY);
    detectByIP();
  }, [detectByIP]);

  return {
    location: location ?? DEFAULT_LOCATION,
    hasLocation: !!location?.city,
    detecting,
    setLocation,
    detectByIP,
    detectByGPS,
    resetLocation,
  };
}

// src/app/api/location/route.ts — IP-based geolocation (ip-api.com, no key needed)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { UserLocation } from "@/types/location";

function isPrivateIP(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("::ffff:127.")
  );
}

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : req.headers.get("x-real-ip") ?? "";

  // On localhost, ip-api.com will return "fail" for private IPs — that's fine,
  // the client will fall back to GPS or manual selection.
  const fields = "status,city,regionName,country,countryCode,currency,timezone";
  const apiUrl =
    ip && !isPrivateIP(ip)
      ? `http://ip-api.com/json/${ip}?fields=${fields}`
      : `http://ip-api.com/json/?fields=${fields}`;

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(5_000) });
    const data = await res.json() as {
      status: string;
      city?: string;
      regionName?: string;
      country?: string;
      countryCode?: string;
      currency?: string;
      timezone?: string;
    };

    if (data.status !== "success" || !data.city) {
      return NextResponse.json({ error: "location_unavailable" });
    }

    const location: UserLocation = {
      city: data.city,
      country: data.country ?? "",
      countryCode: data.countryCode ?? "",
      region: data.regionName,
      currency: data.currency ?? "USD",
      timezone: data.timezone,
      source: "ip",
    };

    return NextResponse.json(location);
  } catch {
    return NextResponse.json({ error: "location_unavailable" });
  }
}

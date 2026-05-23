// src/app/api/trips/route.ts — GET/POST saved trips for a user
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { neonQuery, neonUpsert } from "@/tools/neon";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const result = await neonQuery(
      `SELECT id, origin_city, destination_city, status, budget, currency,
              cost_breakdown, itinerary, travel_dates, match_id, created_at
       FROM trips
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    return NextResponse.json({ trips: result.rows ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, originCity, destinationCity, departDate, returnDate, budget, currency } =
      body as Record<string, string>;

    if (!userId || !originCity || !destinationCity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Satisfy FK constraint — upsert profile row first
    await neonUpsert("user_profiles", { id: userId, display_name: userId, currency: currency ?? "USD" });

    const result = await neonUpsert("trips", {
      user_id: userId,
      origin_city: originCity.trim(),
      destination_city: destinationCity.trim(),
      travel_dates: JSON.stringify({ depart: departDate ?? null, return: returnDate ?? null }),
      budget: budget ? Number(budget) : null,
      currency: currency ?? "USD",
      status: "draft",
    });

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

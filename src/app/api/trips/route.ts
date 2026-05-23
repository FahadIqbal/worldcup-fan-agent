// src/app/api/trips/route.ts — GET saved trips for a user
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { neonQuery } from "@/tools/neon";

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

// src/app/api/fantasy/route.ts — GET/PUT fantasy profile for a user
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { neonQuery, neonUpsert } from "@/tools/neon";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const result = await neonQuery(
      `SELECT id, platform, budget, team, history, updated_at
       FROM fantasy_profiles
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 5`,
      [userId]
    );
    return NextResponse.json({ profiles: result.rows ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { userId, platform, budget, team } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    // Satisfy FK — upsert user profile row first
    await neonUpsert("user_profiles", { id: userId, display_name: userId });

    // Use raw query for correct ON CONFLICT (user_id, platform) behaviour
    await neonQuery(
      `INSERT INTO fantasy_profiles (user_id, platform, budget, team, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, platform) DO UPDATE SET
         budget     = EXCLUDED.budget,
         team       = EXCLUDED.team,
         updated_at = NOW()`,
      [userId, platform ?? "custom", budget ?? null, team ? JSON.stringify(team) : null]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

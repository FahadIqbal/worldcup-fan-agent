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
    await neonUpsert("fantasy_profiles", {
      user_id: userId,
      platform: platform ?? "custom",
      budget: budget ?? null,
      team: team ? JSON.stringify(team) : null,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

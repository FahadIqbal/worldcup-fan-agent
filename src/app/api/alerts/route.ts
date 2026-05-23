// src/app/api/alerts/route.ts — CRUD for price alerts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { neonQuery, neonUpsert } from "@/tools/neon";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const result = await neonQuery(
      `SELECT id, route_origin, route_dest, depart_from, depart_to,
              max_price, currency, current_price, last_checked, triggered, active, created_at
       FROM price_alerts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    return NextResponse.json({ alerts: result.rows ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, origin, dest, price, currency, departFrom, departTo } = body as Record<string, string>;

    if (!userId || !origin || !dest || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Ensure the user profile row exists (FK constraint on price_alerts)
    await neonUpsert("user_profiles", { id: userId, display_name: userId, currency: currency ?? "USD" });

    const result = await neonUpsert("price_alerts", {
      user_id: userId,
      route_origin: origin.trim().toUpperCase(),
      route_dest: dest.trim(),
      max_price: Number(price),
      currency: currency ?? "USD",
      depart_from: departFrom ?? null,
      depart_to: departTo ?? null,
      active: true,
      triggered: false,
      current_price: null,
    });

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { alertId } = await req.json();
  if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

  try {
    await neonUpsert("price_alerts", { id: alertId, active: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

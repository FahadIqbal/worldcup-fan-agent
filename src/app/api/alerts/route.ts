// src/app/api/alerts/route.ts — GET/DELETE price alerts for a user
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
       WHERE user_id = '${userId}'
       ORDER BY created_at DESC
       LIMIT 20`
    );
    return NextResponse.json({ alerts: result.rows ?? [] });
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

// src/app/api/jobs/price-check/route.ts
// Cloud Scheduler job — runs every 6 hours to check flight price alerts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { neonQuery, neonUpsert } from "@/tools/neon";
import { scrapeFlightPrices } from "@/tools/browserbase";

async function verifySchedulerToken(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  if (process.env.NODE_ENV === "development") {
    return auth === `Bearer ${process.env.SCHEDULER_SECRET}`;
  }
  try {
    const token = auth.replace("Bearer ", "");
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const data = await res.json();
    return data.email === process.env.SCHEDULER_SERVICE_ACCOUNT_EMAIL;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifySchedulerToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alertsRes = await neonQuery(`
    SELECT * FROM price_alerts
    WHERE active = true
      AND (last_checked IS NULL OR last_checked < NOW() - INTERVAL '5 hours')
    ORDER BY created_at ASC
    LIMIT 50
  `);

  const alerts = (alertsRes.rows ?? []) as Array<{
    id: string;
    user_id: string;
    route_origin: string;
    route_dest: string;
    depart_from: string;
    depart_to: string;
    max_price: number;
    currency: string;
    notify_via: string;
  }>;

  const results: Array<{
    alertId: string;
    triggered: boolean;
    currentPrice: number | null;
    error?: string;
  }> = [];

  for (const alert of alerts) {
    try {
      const scrape = await scrapeFlightPrices(
        alert.route_origin,
        alert.route_dest,
        alert.depart_from,
        alert.depart_to
      );

      const currentPrice = scrape.cheapest ?? null;
      const triggered = currentPrice !== null && currentPrice <= alert.max_price;

      await neonUpsert("price_alerts", {
        id: alert.id,
        current_price: currentPrice,
        last_checked: new Date().toISOString(),
        triggered,
        active: !triggered,
      });

      if (triggered && currentPrice !== null) {
        await sendPriceAlertNotification({
          userId: alert.user_id,
          route: `${alert.route_origin} → ${alert.route_dest}`,
          price: currentPrice,
          maxPrice: alert.max_price,
          currency: alert.currency,
          notifyVia: alert.notify_via,
          departFrom: alert.depart_from,
          departTo: alert.depart_to,
        });
      }

      results.push({ alertId: alert.id, triggered, currentPrice });
    } catch (err) {
      results.push({ alertId: alert.id, triggered: false, currentPrice: null, error: String(err) });
    }
  }

  return NextResponse.json({
    checked: alerts.length,
    triggered: results.filter((r) => r.triggered).length,
    results,
    checkedAt: new Date().toISOString(),
  });
}

// ─── Notification dispatcher ───────────────────────────────────────────────

async function sendPriceAlertNotification(params: {
  userId: string;
  route: string;
  price: number;
  maxPrice: number;
  currency: string;
  notifyVia: string;
  departFrom: string;
  departTo: string;
}) {
  const message = `
🚨 Price Alert Triggered!
✈  ${params.route}
💰  ${params.currency} ${params.price} (your target: ${params.currency} ${params.maxPrice})
📅  Travel window: ${params.departFrom} – ${params.departTo}

Book now before the price goes back up!
  `.trim();

  if (params.notifyVia === "push" || params.notifyVia === "both") {
    await sendPushNotification(params.userId, message);
  }
  if (params.notifyVia === "email" || params.notifyVia === "both") {
    await sendEmailNotification(params.userId, "Flight Price Alert 🚨", message);
  }
}

async function sendPushNotification(userId: string, body: string) {
  const res = await neonQuery(`SELECT fcm_token FROM user_profiles WHERE id = '${userId}'`);
  const token = (res.rows?.[0] as { fcm_token?: string })?.fcm_token;
  if (!token) return;
  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${process.env.FCM_SERVER_KEY}`,
    },
    body: JSON.stringify({
      to: token,
      notification: { title: "Flight Price Alert 🚨 — WorldCup Fan Agent", body },
    }),
  });
}

async function sendEmailNotification(userId: string, subject: string, body: string) {
  const res = await neonQuery(`SELECT email FROM user_profiles WHERE id = '${userId}'`);
  const email = (res.rows?.[0] as { email?: string })?.email;
  if (!email) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "WorldCup Fan Agent <alerts@worldcupfanagent.com>",
      to: [email],
      subject,
      text: body,
    }),
  });
}

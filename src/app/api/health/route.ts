// src/app/api/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { neonQuery } from "@/tools/neon";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await neonQuery("SELECT 1");
    checks.neon = "ok";
  } catch {
    checks.neon = "error";
  }

  const isSet = (v?: string) => !!v && !v.startsWith("REPLACE");
  checks.vertexai = isSet(process.env.GCP_PROJECT_ID) ? "ok" : "error";
  checks.tavily = isSet(process.env.TAVILY_API_KEY) ? "ok" : "error";
  checks.browserbase = isSet(process.env.BROWSERBASE_API_KEY) ? "ok" : "error";

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}

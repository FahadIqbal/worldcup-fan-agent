// src/app/api/agent/route.ts — Main streaming agent endpoint
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — matches Cloud Run timeout

import { NextRequest } from "next/server";
import { runFanAgent } from "@/agent/planner";

export async function POST(req: NextRequest) {
  const { message, userId, sessionId, userLocation } = await req.json();

  if (!message || !userId) {
    return new Response(JSON.stringify({ error: "message and userId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  (async () => {
    try {
      const result = await runFanAgent(
        { message, userId, sessionId, userLocation },
        async (token) => {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
        }
      );

      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            skillId: result.skillId,
            tools: result.toolsUsed,
            sessionId: result.sessionId,
          })}\n\n`
        )
      );
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } catch (err) {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ token: `\n\nError: ${String(err)}` })}\n\n`)
      );
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

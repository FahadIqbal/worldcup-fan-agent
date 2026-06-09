// src/tools/phoenix.ts
// Phoenix self-reflection tool — lets the agent query its own Arize Phoenix traces
// to understand its recent performance and adapt its strategy (self-improvement loop).
//
// Phoenix REST API docs: https://arize.com/docs/phoenix/api/rest-api

export async function phoenixSelfReflect(query: string): Promise<string> {
  const rawUrl =
    process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "https://app.phoenix.arize.com";
  const apiKey = process.env.PHOENIX_API_KEY;
  const project = process.env.PHOENIX_PROJECT ?? "worldcup-fan-agent";

  if (!apiKey) {
    return JSON.stringify({
      error: "PHOENIX_API_KEY not configured — observability disabled.",
      hint: "Add PHOENIX_API_KEY to your environment to enable self-reflection.",
    });
  }

  // Strip trailing /v1/traces if present — we want the base URL
  const baseUrl = rawUrl.replace(/\/v1\/traces$/, "");

  try {
    // ── Fetch recent spans from Phoenix ─────────────────────────────────────
    const spansUrl = new URL("/v1/spans", baseUrl);
    spansUrl.searchParams.set("project_name", project);
    spansUrl.searchParams.set("limit", "50");

    const res = await fetch(spansUrl.toString(), {
      headers: { "api_key": apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      return JSON.stringify({
        error: `Phoenix API ${res.status}: ${body}`,
        url: spansUrl.toString(),
      });
    }

    const data = (await res.json()) as { data?: SpanData[] };
    const spans: SpanData[] = data.data ?? [];

    if (spans.length === 0) {
      return JSON.stringify({
        message: "No spans found yet — run a few queries first to populate traces.",
        project,
      });
    }

    // ── Analyse performance ──────────────────────────────────────────────────
    const llmSpans = spans.filter(
      (s) => s.attributes?.["openinference.span.kind"] === "LLM"
    );
    const toolSpans = spans.filter(
      (s) => s.attributes?.["openinference.span.kind"] === "TOOL"
    );
    const agentSpans = spans.filter(
      (s) => s.attributes?.["openinference.span.kind"] === "AGENT"
    );
    const errorSpans = spans.filter((s) => s.status_code === "ERROR");

    const avgLatency = (arr: SpanData[]) =>
      arr.length === 0
        ? 0
        : Math.round(
            arr.reduce((sum, s) => {
              const ms =
                new Date(s.end_time).getTime() -
                new Date(s.start_time).getTime();
              return sum + ms;
            }, 0) / arr.length
          );

    const toolUsage = toolSpans.reduce(
      (acc, s) => {
        const name = String(s.attributes?.["tool.name"] ?? "unknown");
        acc[name] = (acc[name] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const toolErrors = toolSpans
      .filter((s) => s.status_code === "ERROR")
      .reduce(
        (acc, s) => {
          const name = String(s.attributes?.["tool.name"] ?? "unknown");
          acc[name] = (acc[name] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const totalTokens = llmSpans.reduce(
      (sum, s) =>
        sum + (Number(s.attributes?.["llm.token_count.total"] ?? 0)),
      0
    );

    const modelUsage = llmSpans.reduce(
      (acc, s) => {
        const m = String(s.attributes?.["llm.model_name"] ?? "unknown");
        acc[m] = (acc[m] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // ── Generate actionable insights ─────────────────────────────────────────
    const insights = generateInsights({
      llmCount: llmSpans.length,
      avgLlmMs: avgLatency(llmSpans),
      avgAgentMs: avgLatency(agentSpans),
      toolUsage,
      toolErrors,
      errorCount: errorSpans.length,
      totalSpans: spans.length,
    });

    return JSON.stringify(
      {
        query,
        project,
        window: `${spans.length} most-recent spans`,
        summary: {
          agent_sessions: agentSpans.length,
          llm_calls: llmSpans.length,
          tool_calls: toolSpans.length,
          errors: errorSpans.length,
          error_rate_pct:
            spans.length > 0
              ? Math.round((errorSpans.length / spans.length) * 100)
              : 0,
        },
        performance: {
          avg_llm_latency_ms: avgLatency(llmSpans),
          avg_agent_latency_ms: avgLatency(agentSpans),
          total_tokens_used: totalTokens,
          models_used: modelUsage,
        },
        tool_usage: toolUsage,
        tool_errors: toolErrors,
        insights,
      },
      null,
      2
    );
  } catch (err) {
    return JSON.stringify({ error: `Phoenix query failed: ${String(err)}` });
  }
}

// ── Insight generation — turns metrics into actionable advice ─────────────

function generateInsights(m: {
  llmCount: number;
  avgLlmMs: number;
  avgAgentMs: number;
  toolUsage: Record<string, number>;
  toolErrors: Record<string, number>;
  errorCount: number;
  totalSpans: number;
}): string[] {
  const insights: string[] = [];

  // Latency
  if (m.avgLlmMs > 6_000) {
    insights.push(
      `⚠️ High LLM latency (avg ${m.avgLlmMs}ms) — consider reducing maxOutputTokens or using gemini-2.0-flash instead of pro variants`
    );
  }
  if (m.avgAgentMs > 20_000) {
    insights.push(
      `⚠️ Slow agent sessions (avg ${m.avgAgentMs}ms) — reduce maxRounds in skill config or simplify multi-tool plans`
    );
  }

  // Error rate
  if (m.errorCount > 0) {
    insights.push(
      `⚠️ ${m.errorCount} error spans (${Math.round((m.errorCount / m.totalSpans) * 100)}% error rate) — investigate failing tools`
    );
  }

  // Tool-specific errors
  for (const [tool, errCount] of Object.entries(m.toolErrors)) {
    const total = m.toolUsage[tool] ?? errCount;
    const rate = Math.round((errCount / total) * 100);
    if (rate >= 25) {
      insights.push(
        `⚠️ ${tool} failing ${rate}% of the time (${errCount}/${total} calls) — check API key / rate limits`
      );
    }
  }

  // Tool imbalance
  const browserCalls = m.toolUsage.browser_scrape ?? 0;
  const tavilyCalls = m.toolUsage.tavily_search ?? 0;
  if (browserCalls > tavilyCalls * 3 && browserCalls > 5) {
    insights.push(
      `ℹ️ Heavy browser_scrape usage (${browserCalls} calls) — consider using tavily_search for quicker web lookups`
    );
  }

  // LLM call volume
  if (m.llmCount > 30) {
    insights.push(
      `ℹ️ High LLM call volume (${m.llmCount}) — agent may be iterating too many rounds; consider tightening maxRounds`
    );
  }

  if (insights.length === 0) {
    insights.push(
      `✅ Performance looks healthy — low latency, no errors, balanced tool usage`
    );
  }

  return insights;
}

// ── Types ─────────────────────────────────────────────────────────────────

interface SpanData {
  start_time: string;
  end_time: string;
  status_code: "OK" | "ERROR" | "UNSET";
  attributes?: Record<string, unknown>;
}

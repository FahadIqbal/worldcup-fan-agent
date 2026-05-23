// src/tools/tavily.ts — Tavily Search via direct REST API
// Replaces the MCP child-process approach with a simple fetch call.

export async function tavilySearch(
  query: string,
  depth: "basic" | "advanced" = "advanced"
): Promise<TavilySearchResult> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    return {
      query,
      results: "[Tavily] TAVILY_API_KEY not configured — skipping web search.",
      retrievedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 5,
        search_depth: depth,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return {
        query,
        results: `[Tavily] Search failed: HTTP ${response.status}`,
        retrievedAt: new Date().toISOString(),
      };
    }

    const data = await response.json() as TavilyRawResponse;

    const lines: string[] = [];
    if (data.answer) lines.push(`DIRECT ANSWER: ${data.answer}\n`);

    data.results?.forEach((r, i) => {
      lines.push(`[${i + 1}] ${r.title}`);
      lines.push(`URL: ${r.url}`);
      lines.push(r.content.slice(0, 600));
      lines.push("");
    });

    return {
      query,
      results: lines.join("\n") || "No results found.",
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      query,
      results: `[Tavily] Error: ${String(err)}`,
      retrievedAt: new Date().toISOString(),
    };
  }
}

interface TavilyRawResponse {
  answer?: string;
  results?: Array<{ title: string; url: string; content: string; score: number }>;
}

export interface TavilySearchResult {
  query: string;
  results: string;
  retrievedAt: string;
}

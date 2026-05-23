// tools/tavily.ts — Tavily MCP Integration
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let client: Client | null = null;

async function getTavilyClient(): Promise<Client> {
  if (client) return client;
  client = new Client({ name: "worldcup-fan-agent", version: "1.0.0" }, {});
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "tavily-mcp@0.1.4"],
    env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY! },
  });
  await client.connect(transport);
  return client;
}

export async function tavilySearch(
  query: string,
  depth: "basic" | "advanced" = "advanced"
): Promise<TavilySearchResult> {
  const c = await getTavilyClient();
  const result = await c.callTool({
    name: "tavily_search",
    arguments: { query, max_results: 5, search_depth: depth, include_answer: true },
  });

  const text = Array.isArray(result.content)
    ? result.content.map((b: { text?: string }) => b.text ?? "").join("\n")
    : String(result.content);

  return { query, results: text, retrievedAt: new Date().toISOString() };
}

export interface TavilySearchResult {
  query: string;
  results: string;
  retrievedAt: string;
}

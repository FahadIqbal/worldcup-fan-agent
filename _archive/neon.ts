// tools/neon.ts — Neon Postgres MCP Integration
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let client: Client | null = null;

async function getNeonClient(): Promise<Client> {
  if (client) return client;
  client = new Client({ name: "worldcup-fan-agent", version: "1.0.0" }, {});
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@neondatabase/mcp-server-neon"],
    env: { DATABASE_URL: process.env.NEON_DATABASE_URL! },
  });
  await client.connect(transport);
  return client;
}

export async function neonQuery(sql: string): Promise<NeonQueryResult> {
  const c = await getNeonClient();
  const result = await c.callTool({ name: "query", arguments: { sql } });
  try {
    const text = Array.isArray(result.content)
      ? result.content.map((b: { text?: string }) => b.text ?? "").join("")
      : String(result.content);
    return JSON.parse(text);
  } catch {
    return { rows: [], rowCount: 0 };
  }
}

export async function neonUpsert(
  table: string,
  data: Record<string, unknown>
): Promise<NeonQueryResult> {
  const keys = Object.keys(data);
  const cols = keys.join(", ");
  const vals = keys.map((k) => {
    const v = data[k];
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  }).join(", ");

  const updates = keys
    .filter((k) => k !== "id")
    .map((k) => {
      const v = data[k];
      if (v === null || v === undefined) return `${k} = NULL`;
      if (typeof v === "number" || typeof v === "boolean") return `${k} = ${v}`;
      if (typeof v === "object") return `${k} = '${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `${k} = '${String(v).replace(/'/g, "''")}'`;
    })
    .join(", ");

  const sql = data.id
    ? `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT (id) DO UPDATE SET ${updates}`
    : `INSERT INTO ${table} (${cols}) VALUES (${vals})`;

  return neonQuery(sql);
}

export interface NeonQueryResult {
  rows: Record<string, unknown>[];
  rowCount?: number;
}

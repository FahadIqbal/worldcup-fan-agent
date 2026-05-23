// src/tools/neon.ts — Neon Postgres via @neondatabase/serverless
// Uses direct connection instead of MCP for reliability in serverless environments.

import { Pool } from "@neondatabase/serverless";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error("NEON_DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  }
  return pool;
}

export async function neonQuery(sql: string): Promise<NeonQueryResult> {
  try {
    const result = await getPool().query(sql);
    return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount ?? 0 };
  } catch (err) {
    console.error("[neon] query error:", err);
    return { rows: [], rowCount: 0 };
  }
}

export async function neonUpsert(
  table: string,
  data: Record<string, unknown>
): Promise<NeonQueryResult> {
  const keys = Object.keys(data);
  const cols = keys.join(", ");

  // Parameterised values — avoids the SQL injection risk of the old string concat
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map((k) => data[k]);

  const updateClause = keys
    .filter((k) => k !== "id")
    .map((k, i) => `${k} = $${keys.indexOf(k) + 1}`)
    .join(", ");

  const sql = data.id
    ? `INSERT INTO ${table} (${cols}) VALUES (${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${updateClause}`
    : `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`;

  try {
    const result = await getPool().query(sql, values);
    return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount ?? 0 };
  } catch (err) {
    console.error("[neon] upsert error:", err);
    return { rows: [], rowCount: 0 };
  }
}

export interface NeonQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

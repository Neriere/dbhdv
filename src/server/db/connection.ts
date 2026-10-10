import { EventEmitter } from "events";
import { createClient, type Client } from "@libsql/client";

export const marketEvents = new EventEmitter();
marketEvents.setMaxListeners(100);

export function resolveDbUrl(): string {
  const customUrl =
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    process.env.DATABASE_URL ||
    process.env.TURSO_URL;
  if (customUrl && customUrl.trim()) {
    return customUrl.trim();
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "file:/tmp/local.db";
  }
  return "file:local.db";
}

export function resolveDbAuthToken(): string | undefined {
  const token =
    process.env.TURSO_AUTH_TOKEN ||
    process.env.LIBSQL_AUTH_TOKEN ||
    process.env.DATABASE_AUTH_TOKEN ||
    process.env.TURSO_TOKEN;
  return token && token.trim() ? token.trim() : undefined;
}

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.DB_SLOW_QUERY_THRESHOLD_MS || 150);

function wrapWithSlowQueryLogger(client: Client): Client {
  const origExecute = client.execute.bind(client);
  const origBatch = client.batch.bind(client);

  client.execute = async (stmt: any) => {
    const start = Date.now();
    try {
      return await origExecute(stmt);
    } finally {
      const duration = Date.now() - start;
      if (duration >= SLOW_QUERY_THRESHOLD_MS) {
        const sql = typeof stmt === "string" ? stmt : stmt?.sql || JSON.stringify(stmt);
        console.warn(`[DB SLOW QUERY] ${duration}ms - ${sql.slice(0, 120)}`);
      }
    }
  };

  client.batch = async (stmts: any[], mode?: any) => {
    const start = Date.now();
    try {
      return await origBatch(stmts, mode);
    } finally {
      const duration = Date.now() - start;
      if (duration >= SLOW_QUERY_THRESHOLD_MS) {
        console.warn(`[DB SLOW BATCH] ${duration}ms - ${stmts.length} statements`);
      }
    }
  };

  return client;
}

export function createResilientDbClient(): Client {
  const url = resolveDbUrl();
  const authToken = resolveDbAuthToken();

  try {
    const rawClient = createClient({ url, authToken });
    return wrapWithSlowQueryLogger(rawClient);
  } catch (err) {
    console.warn("[Database] Failed to initialize LibSQL client, falling back to mock:", err);
  }

  // Safe fallback mock client for serverless environments when remote Turso is omitted
  const emptyResult = { columns: [], columnTypes: [], rows: [], rowsAffected: 0, lastInsertRowid: undefined };
  return {
    execute: async () => emptyResult,
    executeMultiple: async () => {},
    batch: async (stmts: any[]) => (stmts || []).map(() => emptyResult),
    transaction: async () => ({} as any),
    close: () => {},
    closed: false,
    protocol: "http",
  } as unknown as Client;
}

export const database: Client = createResilientDbClient();
export type { Client };

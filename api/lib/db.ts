import { createClient as createWebClient, Client } from "@libsql/client/web";

function resolveDbUrl(): string {
  return (
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    process.env.DATABASE_URL ||
    process.env.TURSO_URL ||
    ""
  ).trim();
}

function resolveDbAuthToken(): string | undefined {
  const token =
    process.env.TURSO_AUTH_TOKEN ||
    process.env.LIBSQL_AUTH_TOKEN ||
    process.env.DATABASE_AUTH_TOKEN ||
    process.env.TURSO_TOKEN;
  return token && token.trim() ? token.trim() : undefined;
}

export function getDbClient(): Client {
  const url = resolveDbUrl();
  const authToken = resolveDbAuthToken();

  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("libsql://")) {
    try {
      return createWebClient({ url, authToken });
    } catch (err) {
      console.warn("[Database] Failed to create web LibSQL client:", err);
    }
  }

  // Fallback mock client
  return {
    execute: async () => ({ columns: [], rows: [], rowsAffected: 0, lastInsertRowid: undefined }),
    executeMultiple: async () => {},
    batch: async () => [],
    transaction: async () => ({} as any),
    close: () => {},
    closed: false,
    protocol: "http",
  } as unknown as Client;
}

export const SERVER_SLUG_MAP: Record<string, number> = {
  draconiros: 1,
  talok: 2,
  dakart: 3,
  boune: 4,
  crail: 5,
  eratz: 6,
  galgarion: 7,
  henual: 8,
  imagiro: 9,
  orukam: 10,
  tylezia: 11,
};

export function resolveServerProfileId(serverName?: string): { profileId: number; profileName: string } {
  if (!serverName || typeof serverName !== "string" || !serverName.trim()) {
    return { profileId: 1, profileName: "Draconiros" };
  }
  const clean = serverName.trim().toLowerCase().replace(/[\s\-_]/g, "");
  const pid = SERVER_SLUG_MAP[clean] || 1;
  const name = serverName.trim();
  return { profileId: pid, profileName: name.charAt(0).toUpperCase() + name.slice(1) };
}

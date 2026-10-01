import { database, initDB } from "../localDataStore";

export const DEFAULT_COMMUNITY_TOKENS: Record<string, string> = {
  price_list: "jzn",
  inventory: "isb",
  storage: "hlp",
  sales_history: "kyo",
  active_listings: "ket",
};

export async function getCommunityTokensFromDb(): Promise<{
  tokens: Record<string, string>;
  last_calibrated: string;
}> {
  await initDB();
  const tokens = { ...DEFAULT_COMMUNITY_TOKENS };
  let lastCalibrated = "2026-10-01 15:39:00";

  try {
    const result = await database.execute("SELECT token_type, token_value, updated_at FROM dofus_tokens");
    if (result && result.rows && result.rows.length > 0) {
      for (const row of result.rows) {
        const type = String(row.token_type);
        const val = String(row.token_value);
        const upd = String(row.updated_at || "");
        if (type && val) {
          tokens[type] = val;
          if (upd && upd > lastCalibrated) {
            lastCalibrated = upd;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[TokenRepository] getCommunityTokensFromDb warning:", err);
  }

  return { tokens, last_calibrated: lastCalibrated };
}

export async function saveCommunityTokenInDb(tokenType: string, tokenValue: string): Promise<boolean> {
  await initDB();
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  try {
    await database.execute({
      sql: `INSERT INTO dofus_tokens (token_type, token_value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(token_type) DO UPDATE SET
              token_value = excluded.token_value,
              updated_at = excluded.updated_at`,
      args: [tokenType, tokenValue, now],
    });
    return true;
  } catch (err) {
    console.warn("[TokenRepository] saveCommunityTokenInDb warning:", err);
    return false;
  }
}

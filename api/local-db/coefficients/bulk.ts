const SERVER_MAP: Record<string, number> = {
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

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    let profileId = Number(body?.profileId || 0);

    if (!profileId) {
      const serverParam = (body?.serverSlug || body?.server || "").trim().toLowerCase();
      profileId = SERVER_MAP[serverParam] || 1;
    }

    const dbUrl = (
      process.env.TURSO_DATABASE_URL ||
      process.env.LIBSQL_URL ||
      process.env.DATABASE_URL ||
      ""
    )
      .trim()
      .replace(/^libsql:\/\//, "https://");
    const dbToken = (
      process.env.TURSO_AUTH_TOKEN ||
      process.env.LIBSQL_AUTH_TOKEN ||
      process.env.DATABASE_AUTH_TOKEN ||
      ""
    ).trim();

    if (dbUrl && entries.length > 0) {
      const endpoint = dbUrl.endsWith("/v2/pipeline")
        ? dbUrl
        : `${dbUrl}/v2/pipeline`;

      const requests: any[] = [];
      const now = Date.now();

      for (const entry of entries) {
        const itemId = Number(entry.itemId);
        const coefficient = Number(entry.coefficient);
        const updatedAt = Number(entry.updatedAt || now);

        if (itemId > 0 && !isNaN(coefficient)) {
          requests.push({
            type: "execute",
            stmt: {
              sql: `INSERT INTO profile_coefficients (profile_id, item_id, coefficient, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(profile_id, item_id) DO UPDATE SET
                      coefficient = excluded.coefficient,
                      updated_at = excluded.updated_at`,
              args: [
                { type: "integer", value: String(profileId) },
                { type: "integer", value: String(itemId) },
                { type: "integer", value: String(coefficient) },
                { type: "integer", value: String(updatedAt) },
              ],
            },
          });
        }
      }

      if (requests.length > 0) {
        // Chunk requests to avoid payload limits
        const CHUNK_SIZE = 100;
        for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
          const chunk = requests.slice(i, i + CHUNK_SIZE);
          await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${dbToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [...chunk, { type: "close" }],
            }),
          }).catch((err) => console.warn("[Turso Bulk Coeff Error]:", err));
        }
      }
    }

    return res.status(200).json({
      success: true,
      profileId,
      updatedCount: entries.length,
    });
  } catch (error: any) {
    console.error("[Bulk Coefficients Error]:", error);
    return res.status(200).json({
      success: false,
      error: error.message || "Failed to bulk save coefficients",
    });
  }
}

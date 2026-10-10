import fs from "fs";
import path from "path";

export const DEFAULT_COMMUNITY_TOKENS: Record<string, string> = {
  price_list: "jzs",
  quotations: "ire",
  inventory: "isb",
  storage: "hlp",
  sales_history: "kyo",
  active_listings: "ket",
};

function getTursoClient() {
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

  const endpoint = dbUrl
    ? dbUrl.endsWith("/v2/pipeline")
      ? dbUrl
      : `${dbUrl}/v2/pipeline`
    : "";
  return { dbUrl, dbToken, endpoint };
}

async function queryTurso(endpoint: string, dbToken: string, requests: any[]) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dbToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [...requests, { type: "close" }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Turso HTTP error ${res.status}`);
  }
  return await res.json();
}

async function getCommunityTokensFromDb(): Promise<{
  tokens: Record<string, string>;
  last_calibrated: string;
}> {
  const tokens = { ...DEFAULT_COMMUNITY_TOKENS };
  let lastCalibrated = "2026-10-01 15:39:00";

  const { endpoint, dbToken } = getTursoClient();
  if (!endpoint) return { tokens, last_calibrated: lastCalibrated };

  try {
    const data = await queryTurso(endpoint, dbToken, [
      {
        type: "execute",
        stmt: {
          sql: "SELECT token_type, token_value, updated_at FROM dofus_tokens",
        },
      },
    ]);

    const result = data?.results?.[0]?.response?.result;
    if (result?.rows) {
      for (const row of result.rows) {
        const type = String(row[0]?.value ?? row[0] ?? "");
        const val = String(row[1]?.value ?? row[1] ?? "");
        const upd = String(row[2]?.value ?? row[2] ?? "");
        if (type && val) {
          tokens[type] = val;
          if (upd && upd > lastCalibrated) {
            lastCalibrated = upd;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[API Tokens] getCommunityTokensFromDb warning:", err);
  }

  return { tokens, last_calibrated: lastCalibrated };
}

async function saveCommunityTokenInDb(tokenType: string, tokenValue: string): Promise<boolean> {
  const { endpoint, dbToken } = getTursoClient();
  if (!endpoint) return false;

  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  try {
    await queryTurso(endpoint, dbToken, [
      {
        type: "execute",
        stmt: {
          sql: `INSERT INTO dofus_tokens (token_type, token_value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(token_type) DO UPDATE SET
                  token_value = excluded.token_value,
                  updated_at = excluded.updated_at`,
          args: [
            { type: "text", value: tokenType },
            { type: "text", value: tokenValue },
            { type: "text", value: now },
          ],
        },
      },
    ]);
    return true;
  } catch (err) {
    console.warn("[API Tokens] saveCommunityTokenInDb warning:", err);
    return false;
  }
}

// Ubicaciones de busqueda del archivo keymap.json
function resolveKeymapPath(): string {
  const candidates = [
    path.join(process.cwd(), "sniffer", "config", "keymap.json"),
    path.join(process.cwd(), "scripts", "keymap.json"),
    path.join(process.cwd(), "keymap.json"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return candidates[0];
}

export default async function handler(req: any, res: any) {
  // Configurar CORS para permitir consultas desde clientes y scripts locales
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const keymapPath = resolveKeymapPath();

    if (req.method === "GET") {
      let tokens: Record<string, string> = { ...DEFAULT_COMMUNITY_TOKENS };
      let lastCalibrated = "2026-10-01 15:39:00";
      let source = "default_seed";

      try {
        const dbData = await getCommunityTokensFromDb();
        tokens = { ...tokens, ...dbData.tokens };
        if (dbData.last_calibrated) {
          lastCalibrated = dbData.last_calibrated;
          source = "turso_database";
        }
      } catch (dbErr) {
        console.warn("[API Tokens] Advertencia consultando base de datos:", dbErr);
      }

      try {
        if (fs.existsSync(keymapPath)) {
          const raw = JSON.parse(fs.readFileSync(keymapPath, "utf-8"));
          tokens = {
            price_list: raw.price_list || raw.current_token || tokens.price_list,
            quotations: raw.quotations || tokens.quotations || "ire",
            inventory: raw.inventory || tokens.inventory,
            storage: raw.storage || tokens.storage,
            sales_history: raw.sales_history || tokens.sales_history,
            active_listings: raw.active_listings || tokens.active_listings,
          };
          if (raw.last_calibrated && raw.last_calibrated > lastCalibrated) {
            lastCalibrated = raw.last_calibrated;
          }
          if (source === "default_seed") {
            source = "local_keymap";
          }
        }
      } catch (err) {
        console.warn("[API Tokens] Advertencia leyendo keymap local:", err);
      }

      return res.status(200).json({
        success: true,
        version: "3.6.0",
        tokens,
        last_calibrated: lastCalibrated,
        status: "active",
        source,
      });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { token_type, token_value } = body || {};

      if (!token_type || !token_value) {
        return res.status(400).json({
          success: false,
          error: "Campos requeridos: 'token_type' y 'token_value'",
        });
      }

      // Validacion de seguridad de formato de token (alfanumerico, 2-12 caracteres)
      if (!/^[a-zA-Z0-9_]{2,12}$/.test(token_value)) {
        return res.status(400).json({
          success: false,
          error: "Formato de token invalido (debe ser alfanumerico entre 2 y 12 caracteres)",
        });
      }

      const validTypes = ["price_list", "quotations", "inventory", "storage", "sales_history", "active_listings"];
      if (!validTypes.includes(token_type)) {
        return res.status(400).json({
          success: false,
          error: `Tipo de token no valido. Debe ser uno de: ${validTypes.join(", ")}`,
        });
      }

      // 1. Guardar en base de datos Turso / LibSQL
      let dbSaved = false;
      try {
        dbSaved = await saveCommunityTokenInDb(token_type, token_value);
      } catch (dbErr) {
        console.warn("[API Tokens] No se pudo guardar en base de datos:", dbErr);
      }

      // 2. Guardar en keymap local de disco si es accesible
      let km: Record<string, any> = { ...DEFAULT_COMMUNITY_TOKENS };
      try {
        if (fs.existsSync(keymapPath)) {
          km = JSON.parse(fs.readFileSync(keymapPath, "utf-8"));
        }
      } catch {}

      km[token_type] = token_value;
      if (token_type === "price_list") km["current_token"] = token_value;
      km["last_calibrated"] = new Date().toISOString().replace("T", " ").substring(0, 19);

      try {
        const dir = path.dirname(keymapPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(keymapPath, JSON.stringify(km, null, 2), "utf-8");
      } catch (fsErr) {
        // En Vercel serverless de solo lectura, la base de datos es la fuente de verdad
      }

      return res.status(200).json({
        success: true,
        message: `Token '${token_type}' actualizado correctamente a '${token_value}'.`,
        db_persisted: dbSaved,
        tokens: km,
      });
    }

    return res.status(405).json({ error: "Metodo no permitido" });
  } catch (err: any) {
    console.error("[API Tokens] Fallback error:", err);
    return res.status(200).json({
      success: true,
      version: "3.6.0",
      tokens: DEFAULT_COMMUNITY_TOKENS,
      last_calibrated: "2026-10-01 15:39:00",
      status: "active",
      source: "fallback_seed",
    });
  }
}

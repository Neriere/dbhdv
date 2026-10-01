import fs from "fs";
import path from "path";
import {
  DEFAULT_COMMUNITY_TOKENS,
  getCommunityTokensFromDb,
  saveCommunityTokenInDb,
} from "../src/server/localDataStore";

// Ubicaciones de busqueda del archivo keymap.json
function resolveKeymapPath(): string {
  const candidates = [
    path.join(process.cwd(), "sniffer", "config", "keymap.json"),
    path.join(process.cwd(), "scripts", "keymap.json"),
    path.join(process.cwd(), "keymap.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
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

    if (fs.existsSync(keymapPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(keymapPath, "utf-8"));
        tokens = {
          price_list: raw.price_list || raw.current_token || tokens.price_list,
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
      } catch (err) {
        console.warn("[API Tokens] Advertencia leyendo keymap local:", err);
      }
    }

    return res.json({
      success: true,
      version: "3.6.0",
      tokens,
      last_calibrated: lastCalibrated,
      status: "active",
      source,
    });
  }

  if (req.method === "POST") {
    try {
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

      const validTypes = ["price_list", "inventory", "storage", "sales_history", "active_listings"];
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
      if (fs.existsSync(keymapPath)) {
        try {
          km = JSON.parse(fs.readFileSync(keymapPath, "utf-8"));
        } catch {}
      }

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

      return res.json({
        success: true,
        message: `Token '${token_type}' actualizado correctamente a '${token_value}'.`,
        db_persisted: dbSaved,
        tokens: km,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Error procesando actualizacion de token",
      });
    }
  }

  return res.status(405).json({ error: "Metodo no permitido" });
}

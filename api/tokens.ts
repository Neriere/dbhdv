import type { Request, Response } from "express";
import fs from "fs";
import path from "path";

// Ubicaciones de búsqueda del archivo keymap.json
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

// Fallback con los tokens verificados actuales (Dofus Unity 3.6)
const DEFAULT_TOKENS: Record<string, string | null> = {
  price_list: "jzn",
  inventory: "isb",
  storage: "hlp",
  sales_history: "kyo",
};

export default async function handler(req: any, res: any) {
  // Configurar CORS para permitir consultas desde clientes locales
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const keymapPath = resolveKeymapPath();

  if (req.method === "GET") {
    let tokens = { ...DEFAULT_TOKENS };
    let lastCalibrated = "2026-09-30 00:36:45";

    if (fs.existsSync(keymapPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(keymapPath, "utf-8"));
        tokens = {
          price_list: raw.price_list || raw.current_token || DEFAULT_TOKENS.price_list,
          inventory: raw.inventory || DEFAULT_TOKENS.inventory,
          storage: raw.storage || DEFAULT_TOKENS.storage,
          sales_history: raw.sales_history || null,
        };
        lastCalibrated = raw.last_calibrated || lastCalibrated;
      } catch (err) {
        console.warn("[API Tokens] Error leyendo keymap local:", err);
      }
    }

    return res.json({
      success: true,
      version: "3.6.0",
      tokens,
      last_calibrated: lastCalibrated,
      status: "active",
      source: fs.existsSync(keymapPath) ? "verified_storage" : "default_seed",
    });
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { token_type, token_value, admin_key } = body || {};

      if (!token_type || !token_value) {
        return res.status(400).json({
          success: false,
          error: "Campos requeridos: 'token_type' y 'token_value'",
        });
      }

      // Validación de seguridad de formato de token (alfanumérico, 2-12 caracteres)
      if (!/^[a-zA-Z0-9_]{2,12}$/.test(token_value)) {
        return res.status(400).json({
          success: false,
          error: "Formato de token inválido (debe ser alfanumérico entre 2 y 12 caracteres)",
        });
      }

      const validTypes = ["price_list", "inventory", "storage", "sales_history"];
      if (!validTypes.includes(token_type)) {
        return res.status(400).json({
          success: false,
          error: `Tipo de token no válido. Debe ser uno de: ${validTypes.join(", ")}`,
        });
      }

      // Cargar keymap actual o inicializar
      let km: Record<string, any> = { ...DEFAULT_TOKENS };
      if (fs.existsSync(keymapPath)) {
        try {
          km = JSON.parse(fs.readFileSync(keymapPath, "utf-8"));
        } catch {}
      }

      km[token_type] = token_value;
      if (token_type === "price_list") km["current_token"] = token_value;
      km["last_calibrated"] = new Date().toISOString().replace("T", " ").substring(0, 19);

      // Guardar de vuelta
      const dir = path.dirname(keymapPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(keymapPath, JSON.stringify(km, null, 2), "utf-8");

      return res.json({
        success: true,
        message: `Token '${token_type}' actualizado correctamente a '${token_value}'.`,
        tokens: km,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Error procesando actualización de token",
      });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}

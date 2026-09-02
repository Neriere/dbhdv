import { ingestBatchPrices } from "../lib/marketPriceCalculator";

function verifySnifferAuth(req: any): boolean {
  const secret =
    process.env.MARKET_SNIFFER_SECRET || process.env.SNIFFER_SECRET;
  if (!secret || secret.trim() === "") {
    return true; // No secret configured -> open access
  }
  const cleanSecret = secret.trim();
  const headerKey =
    req.headers["x-api-key"] ||
    req.headers["x-market-sniffer-secret"] ||
    (typeof req.headers["authorization"] === "string"
      ? req.headers["authorization"].replace(/^Bearer\s+/i, "")
      : undefined) ||
    req.query?.key ||
    req.query?.api_key;
  return typeof headerKey === "string" && headerKey.trim() === cleanSecret;
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    if (!verifySnifferAuth(req)) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Clave de API inválida o ausente en cabecera 'x-api-key'.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const items = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body)
        ? body
        : [];

    if (items.length === 0) {
      return res.status(400).json({ error: "Se requiere un array de items" });
    }

    const result = await ingestBatchPrices(items);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Market Sniffer Batch API Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: error.message || "Error al procesar el lote de precios del mercadillo",
    });
  }
}

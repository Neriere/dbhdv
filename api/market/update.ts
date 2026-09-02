import { ingestSinglePrice } from "../lib/marketPriceCalculator";

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

    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!payload || typeof payload !== "object") {
      return res
        .status(400)
        .json({ error: "Cuerpo de solicitud JSON requerido" });
    }

    const result = await ingestSinglePrice(payload);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Market Sniffer API Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: error.message || "Error al procesar el precio del mercadillo",
    });
  }
}

import { getDecompressedDictionary } from "./items-dictionary";

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Content-Disposition", "attachment; filename=items_db.json");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=1800");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const dict = getDecompressedDictionary();
    return res.status(200).send(JSON.stringify(dict, null, 2));
  } catch (error: any) {
    console.error("[API market/download-items-db Error]:", error);
    return res.status(500).json({ error: "Error al generar items_db.json" });
  }
}

import { Router, type Response } from "express";
import { verifySnifferAuth } from "../middleware/auth";
import {
  getProfileIdByServerNameOrSlug,
  bulkSetItemSalesVolume,
  correctPricesAgainstSalesVolume,
  processAndIngestMarketPrice,
  processAndIngestMarketPricesBatch,
  getItemsCatalog,
  getItemsDictionary,
  getLatestMarketPricesDelta,
  marketEvents,
} from "../localDataStore";

const router = Router();

// ----------------------------------------------------------------------------
// Market Ingestion (Single item / sales volume)
// ----------------------------------------------------------------------------
router.post(["/market/update", "/market-prices/ingest"], async (req, res) => {
  try {
    if (!verifySnifferAuth(req)) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Clave de API inválida o ausente en cabecera 'x-api-key'.",
      });
    }

    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res
        .status(400)
        .json({ error: "Cuerpo de solicitud JSON requerido" });
    }

    // Si la solicitud es de volúmenes de venta / cotizaciones
    const rawSalesVolume = payload?.salesVolume || payload?.sales_volume;
    if (rawSalesVolume && typeof rawSalesVolume === "object" && (!payload.item_id && !payload.itemId && !payload.prices && !payload.precios)) {
      const cleanServer = typeof payload.server === "string" ? payload.server.slice(0, 60) : "";
      const { profileId, profileName } = await getProfileIdByServerNameOrSlug(cleanServer);
      const entries = Object.entries(rawSalesVolume);
      const volumesToSave: Record<number, any> = {};
      for (const [idStr, sv] of entries) {
        const sId = Number(idStr);
        if (sId > 0 && sv && typeof sv === "object") {
          volumesToSave[sId] = sv;
        }
      }

      const bulkResult = await bulkSetItemSalesVolume(volumesToSave, profileId);
      const correctedPrices = await correctPricesAgainstSalesVolume(profileId, volumesToSave);

      return res.json({
        success: true,
        updated_sales_volume: bulkResult.count,
        profile_id: profileId,
        server: profileName,
        corrected_prices: correctedPrices,
      });
    }

    const result = await processAndIngestMarketPrice(payload);
    res.json(result);
  } catch (error: any) {
    console.error("[Market Sniffer API Error]:", error);
    res.status(500).json({
      error: error.message || "Error al procesar el precio del mercadillo",
    });
  }
});

// ----------------------------------------------------------------------------
// Market Batch Ingestion
// ----------------------------------------------------------------------------
router.post("/market/batch-update", async (req, res) => {
  try {
    if (!verifySnifferAuth(req)) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Clave de API inválida o ausente en cabecera 'x-api-key'.",
      });
    }

    const items = Array.isArray(req.body?.items)
      ? req.body.items
      : Array.isArray(req.body)
        ? req.body
        : [];

    if (items.length === 0) {
      return res.status(400).json({ error: "Se requiere un array de items" });
    }

    const result = await processAndIngestMarketPricesBatch(items);
    res.json(result);
  } catch (error: any) {
    console.error("[Market Sniffer Batch API Error]:", error);
    res.status(500).json({
      error:
        error.message || "Error al procesar el lote de precios del mercadillo",
    });
  }
});

// ----------------------------------------------------------------------------
// Items Dictionary & Catalog
// ----------------------------------------------------------------------------
router.get("/market/items-dictionary", async (req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=1800");
    if (req.query.v === "2" || req.query.rich === "1") {
      const catalog = await getItemsCatalog();
      res.json(catalog);
    } else {
      const dict = await getItemsDictionary();
      res.json(dict);
    }
  } catch (error: any) {
    console.error("[Items Dictionary API Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({});
  }
});

router.get("/market/download-items-db", async (_req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Disposition", "attachment; filename=items_db.json");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=1800");
    const catalog = await getItemsCatalog();
    res.send(JSON.stringify(catalog, null, 2));
  } catch (error: any) {
    console.error("[Download Items DB Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({});
  }
});

// ----------------------------------------------------------------------------
// Latest Prices Delta
// ----------------------------------------------------------------------------
router.get("/market/latest-prices", async (req, res) => {
  try {
    const serverParam = (req.query.server as string) || "";
    const profileIdParam = req.query.profileId
      ? Number(req.query.profileId)
      : 0;
    const sinceParam = req.query.since ? Number(req.query.since) : 0;

    let targetProfileId = profileIdParam;
    if (!targetProfileId) {
      const { profileId } = await getProfileIdByServerNameOrSlug(serverParam);
      targetProfileId = profileId;
    }

    const result = await getLatestMarketPricesDelta(
      targetProfileId,
      sinceParam,
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      success: true,
      profile_id: targetProfileId,
      ...result,
    });
  } catch (error: any) {
    console.error("[Market Latest Prices API Error]:", error);
    res.status(500).json({
      error: error.message || "Error al obtener precios recientes",
    });
  }
});

// ----------------------------------------------------------------------------
// Realtime SSE Live Stream
// ----------------------------------------------------------------------------
const liveSseClients = new Set<Response>();

marketEvents.on("price_update", (data) => {
  const payload = JSON.stringify({
    type: "price_update",
    ...data,
  });
  for (const client of Array.from(liveSseClients)) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      liveSseClients.delete(client);
    }
  }
});

marketEvents.on("batch_updated", (data) => {
  const payload = JSON.stringify({
    type: "batch_updated",
    ...data,
  });
  for (const client of Array.from(liveSseClients)) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      liveSseClients.delete(client);
    }
  }
});

marketEvents.on("volume_update", (data) => {
  const payload = JSON.stringify({
    type: "volume_update",
    ...data,
  });
  for (const client of Array.from(liveSseClients)) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      liveSseClients.delete(client);
    }
  }
});

marketEvents.on("batch_volume_updated", (data) => {
  const payload = JSON.stringify({
    type: "batch_volume_updated",
    ...data,
  });
  for (const client of Array.from(liveSseClients)) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      liveSseClients.delete(client);
    }
  }
});

router.get("/market/live-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders?.();

  res.write(
    `data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`
  );

  liveSseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      liveSseClients.delete(res);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    liveSseClients.delete(res);
  });
});

export default router;

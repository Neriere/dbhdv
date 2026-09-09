import express from "express";
import compression from "compression";
import path from "path";
import {
  changeActivePriceProfile,
  deleteAllStoredPrices,
  fetchAndStoreCategoryItems,
  getAutomaticSyncState,
  getBootstrapData,
  getDatabaseFilePath,
  getOrFetchItemById,
  getPriceProfileState,
  getOrFetchRecipeByResultId,
  importAllDofusData,
  overwritePrices,
  resolveMissingNames,
  searchAndStoreItems,
  setItemPrice,
  updateAutomaticSyncSettings,
  initDB,
  database,
  getItemStatsFromDb,
  getSyncStatus,
  resetSyncStatus,
  exportFullDatabaseJSON,
  importFullDatabaseJSON,
  seedDatabaseFromBundle,
  seedStepInit,
  seedStepItems,
  seedStepRecipes,
  seedStepFinalize,
  importChunkInit,
  importChunkItems,
  importChunkRecipes,
  importChunkFinalize,
  analyzeDofusbookBuild,
  getPriceHistory,
  getItemPriceHistory,
  revertPriceHistoryEntry,
  clearPriceHistory,
  getProfileCoefficients,
  setItemCoefficient,
  bulkSaveProfileCoefficients,
  processAndIngestMarketPrice,
  processAndIngestMarketPricesBatch,
  getItemsDictionary,
  getItemsCatalog,
  getLatestMarketPricesDelta,
  getProfileIdByServerNameOrSlug,
  marketEvents,
} from "./localDataStore";
import {
  getDofocusGlobalSyncState,
  startHourlyDofocusSync,
  syncAllServersFromDofocus,
  syncSingleServerFromDofocus,
} from "./dofocusBackgroundSync";



const DOFUSDB_BASE_URL = "https://api.dofusdb.fr";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[CRITICAL ERROR] Missing required env var: ${name}`);
    return "missing-env-var";
  }
  return value;
}

const app = express();

initDB()
  .then(() => {
    console.log("[Database] Turso schemas initialized.");
    startHourlyDofocusSync();
  })
  .catch((e) =>
    console.error("[Database Error] Failed to initialize Turso:", e),
  );

const PORT = Number(process.env.PORT || process.env.APP_PORT || 3000);
const HOST = process.env.APP_HOST || "0.0.0.0";

app.use(compression() as unknown as express.RequestHandler);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "DofusDB API Proxy & Explorer Server" });
});

app.get("/api/local-db/bootstrap", async (req, res) => {
  try {
    res.setHeader(
      "Cache-Control",
      "public, max-age=5, s-maxage=30, stale-while-revalidate=300",
    );
    const profileIdParam = Number(req.query.profileId);
    if (profileIdParam && !Number.isNaN(profileIdParam) && profileIdParam > 0) {
      await changeActivePriceProfile(profileIdParam);
    }
    const data = await getBootstrapData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to load bootstrap data" });
  }
});

app.get("/api/local-db/meta", async (req, res) => {
  try {
    const bootstrap = await getBootstrapData();
    res.json({
      databasePath: getDatabaseFilePath(),
      totalItems: bootstrap.items.length,
      totalRecipes: Object.keys(bootstrap.recipes).length,
      totalPricedItems: Object.keys(bootstrap.prices).length,
      syncStatus: bootstrap.syncStatus,
      syncSettings: bootstrap.syncSettings,
      priceProfiles: bootstrap.priceProfiles,
      activePriceProfileId: bootstrap.activePriceProfileId,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load meta data" });
  }
});

app.get("/api/local-db/sync-status", async (req, res) => {
  try {
    const status = await getSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to load sync status" });
  }
});

app.post("/api/local-db/reset-sync-status", async (req, res) => {
  try {
    const status = await resetSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to reset sync status" });
  }
});

app.post("/api/local-db/seed-step/init", async (req, res) => {
  try {
    const result = await seedStepInit();
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Init seed step failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/seed-step/items", async (req, res) => {
  try {
    const chunkIndex = Number(req.body?.chunkIndex) || 0;
    const chunkSize = Number(req.body?.chunkSize) || 400;
    const result = await seedStepItems(chunkIndex, chunkSize);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Items seed step failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/seed-step/recipes", async (req, res) => {
  try {
    const chunkIndex = Number(req.body?.chunkIndex) || 0;
    const chunkSize = Number(req.body?.chunkSize) || 400;
    const result = await seedStepRecipes(chunkIndex, chunkSize);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recipes seed step failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/seed-step/finalize", async (req, res) => {
  try {
    const result = await seedStepFinalize();
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Finalize seed step failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-chunk/init", async (req, res) => {
  try {
    await importChunkInit();
    res.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import chunk init failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-chunk/items", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const result = await importChunkItems(items);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import chunk items failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-chunk/recipes", async (req, res) => {
  try {
    const recipes = Array.isArray(req.body?.recipes) ? req.body.recipes : [];
    const result = await importChunkRecipes(recipes);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import chunk recipes failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-chunk/finalize", async (req, res) => {
  try {
    const result = await importChunkFinalize();
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import chunk finalize failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/fast-seed", async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const data = await seedDatabaseFromBundle(force);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fast seed failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import", async (req, res) => {
  try {
    const imported = await importAllDofusData();
    res.json(imported);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Local DB import failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/items/resolve-names", async (req, res) => {
  try {
    const itemIds = Array.isArray(req.body?.itemIds)
      ? req.body.itemIds.map((v: unknown) => Number(v)).filter(Boolean)
      : [];
    if (itemIds.length === 0)
      return res.status(400).json({ error: "itemIds is required" });

    const updatedItems = await resolveMissingNames(itemIds);
    res.json({ updatedItems });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve item names";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/items/:id", async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!itemId) return res.status(400).json({ error: "Invalid item id" });

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
    const item = await getOrFetchItemById(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    res.json(item);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch item";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/item-stats/:id", async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!itemId) return res.status(400).json({ error: "Invalid item id" });

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
    const stats = await getItemStatsFromDb(itemId);
    res.json({ itemId, stats });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch item stats";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/recipes/:resultId", async (req, res) => {
  try {
    const resultId = Number(req.params.resultId);
    if (!resultId) return res.status(400).json({ error: "Invalid result id" });

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
    const recipe = await getOrFetchRecipeByResultId(resultId);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });

    res.json(recipe);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch recipe";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/search-items", async (req, res) => {
  try {
    const searchTerm = String(req.query.term || "");
    const items = await searchAndStoreItems(searchTerm);
    res.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Item search failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/category-items", async (req, res) => {
  try {
    const typeIds = Array.isArray(req.body?.typeIds)
      ? req.body.typeIds.map((v: unknown) => Number(v)).filter(Boolean)
      : [];
    if (typeIds.length === 0)
      return res.status(400).json({ error: "typeIds is required" });

    const items = await fetchAndStoreCategoryItems(typeIds);
    res.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Category fetch failed";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/price-profiles", async (req, res) => {
  try {
    const state = await getPriceProfileState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch price profiles" });
  }
});

app.put("/api/local-db/price-profiles/active", async (req, res) => {
  try {
    const profileId = Number(req.body?.profileId);
    if (!profileId)
      return res.status(400).json({ error: "profileId is required" });

    const state = await changeActivePriceProfile(profileId);
    res.json(state);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Active profile update failed";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/export-database", (req, res) => {
  res.download(getDatabaseFilePath(), "dofus-local.db");
});

app.get("/api/local-db/export-json", async (req, res) => {
  try {
    const data = await exportFullDatabaseJSON();
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=dofus_database_backup_${new Date().toISOString().slice(0, 10)}.json`,
    );
    res.setHeader("Content-Type", "application/json");
    res.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export JSON database";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-json", async (req, res) => {
  try {
    const imported = await importFullDatabaseJSON(req.body);
    res.json(imported);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import JSON database";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/sync-settings", async (req, res) => {
  try {
    const state = await getAutomaticSyncState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sync settings" });
  }
});

app.put("/api/local-db/sync-settings", async (req, res) => {
  try {
    const enabled = req.body?.enabled !== false;
    const intervalDays = Number(req.body?.intervalDays) || 30;
    const state = await updateAutomaticSyncSettings({ enabled, intervalDays });
    res.json(state);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sync settings update failed";
    res.status(500).json({ error: message });
  }
});

app.put("/api/local-db/prices/:itemId", async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const price = Number(req.body?.price);
    const profileId = Number(req.body?.profileId) || undefined;
    if (!itemId || Number.isNaN(price)) {
      return res
        .status(400)
        .json({ error: "Valid itemId and price are required" });
    }

    const prices = await setItemPrice(itemId, price, profileId);
    const profileState = await getPriceProfileState();
    res.json({
      prices: prices.prices,
      priceUpdatedAt: prices.priceUpdatedAt,
      activePriceProfileId: profileState.activePriceProfileId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Price update failed";
    res.status(500).json({ error: message });
  }
});

app.put("/api/local-db/prices", async (req, res) => {
  try {
    const prices = req.body?.prices;
    const profileId = Number(req.body?.profileId) || undefined;
    if (!prices || typeof prices !== "object" || Array.isArray(prices)) {
      return res.status(400).json({ error: "prices object is required" });
    }

    const updatedPrices = await overwritePrices(
      Object.fromEntries(
        Object.entries(prices).map(([itemId, price]) => [
          Number(itemId),
          Number(price),
        ]),
      ),
      profileId,
    );
    const profileState = await getPriceProfileState();
    res.json({
      prices: updatedPrices.prices,
      priceUpdatedAt: updatedPrices.priceUpdatedAt,
      activePriceProfileId: profileState.activePriceProfileId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bulk price update failed";
    res.status(500).json({ error: message });
  }
});

app.delete("/api/local-db/prices", async (req, res) => {
  try {
    const profileId = Number(req.body?.profileId) || undefined;
    const prices = await deleteAllStoredPrices(profileId);
    const profileState = await getPriceProfileState();
    res.json({
      prices: prices.prices,
      priceUpdatedAt: prices.priceUpdatedAt,
      activePriceProfileId: profileState.activePriceProfileId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clear prices";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/price-history", async (req, res) => {
  try {
    const profileId = req.query.profileId
      ? Number(req.query.profileId)
      : undefined;
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const search = req.query.search ? String(req.query.search) : undefined;
    const filter = req.query.filter as
      | "all"
      | "increased"
      | "decreased"
      | undefined;

    const result = await getPriceHistory({
      profileId,
      itemId,
      limit,
      offset,
      search,
      filter,
    });
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch price history";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/price-history/item/:id", async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!itemId) return res.status(400).json({ error: "Invalid item ID" });
    const profileId = req.query.profileId
      ? Number(req.query.profileId)
      : undefined;

    const result = await getItemPriceHistory(itemId, profileId);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch item price history";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/price-history/revert", async (req, res) => {
  try {
    const historyId = Number(req.body?.historyId);
    if (!historyId) {
      return res.status(400).json({ error: "historyId is required" });
    }
    const result = await revertPriceHistoryEntry(historyId);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revert price";
    res.status(500).json({ error: message });
  }
});

app.delete("/api/local-db/price-history", async (req, res) => {
  try {
    const profileId = req.body?.profileId
      ? Number(req.body?.profileId)
      : undefined;
    const itemId = req.body?.itemId ? Number(req.body?.itemId) : undefined;
    const result = await clearPriceHistory(profileId, itemId);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clear price history";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/coefficients", async (req, res) => {
  try {
    const profileId = req.query.profileId
      ? Number(req.query.profileId)
      : undefined;
    const result = await getProfileCoefficients(profileId);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch coefficients";
    res.status(500).json({ error: message });
  }
});

app.put("/api/local-db/coefficients/:itemId", async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const coefficient = Number(req.body?.coefficient);
    let profileId = req.body?.profileId
      ? Number(req.body?.profileId)
      : undefined;
    const updatedAt = req.body?.updatedAt
      ? Number(req.body?.updatedAt)
      : undefined;
    const isManual = req.body?.isManual !== false;

    if (!profileId && (req.body?.serverSlug || req.body?.server)) {
      const slugOrName = req.body.serverSlug || req.body.server;
      const match = await getProfileIdByServerNameOrSlug(slugOrName);
      if (match) profileId = match.profileId;
    }

    if (!itemId || Number.isNaN(coefficient)) {
      return res
        .status(400)
        .json({ error: "Valid itemId and coefficient are required" });
    }
    const result = await setItemCoefficient(
      itemId,
      coefficient,
      profileId,
      updatedAt,
      isManual,
    );
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save coefficient";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/coefficients/bulk", async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    let profileId = req.body?.profileId
      ? Number(req.body?.profileId)
      : undefined;
    if (!profileId && (req.body?.serverSlug || req.body?.server)) {
      const slugOrName = req.body.serverSlug || req.body.server;
      const match = await getProfileIdByServerNameOrSlug(slugOrName);
      if (match) profileId = match.profileId;
    }
    const isManualBatch = Boolean(req.body?.isManual);
    const result = await bulkSaveProfileCoefficients(entries, profileId, isManualBatch);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to bulk save coefficients";
    res.status(500).json({ error: message });
  }
});

// DoFocus Automated Background Sync Status & Trigger
app.get("/api/dofocus/sync-all-status", (req, res) => {
  res.json(getDofocusGlobalSyncState());
});

app.post("/api/dofocus/sync-all", async (req, res) => {
  void syncAllServersFromDofocus(true);
  res.json({
    status: "started",
    message: "Sincronización de todos los servidores iniciada en segundo plano",
  });
});

app.post("/api/dofocus/sync-server", async (req, res) => {
  try {
    const serverName = String(req.body?.server || req.body?.serverName || "Draconiros");
    const result = await syncSingleServerFromDofocus(serverName);
    if (!result.success) {
      return res.status(500).json({ error: result.error || "Error al sincronizar con DoFocus" });
    }
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync server coefficients";
    res.status(500).json({ error: message });
  }
});

// ----------------------------------------------------------------------------
// Market Sniffer Ingestion Endpoints (Standalone Python / Packet Scapy Sync)
// ----------------------------------------------------------------------------

function verifySnifferAuth(req: express.Request): boolean {
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
    req.query.key ||
    req.query.api_key;
  return typeof headerKey === "string" && headerKey.trim() === cleanSecret;
}

app.post(
  ["/api/market/update", "/api/market-prices/ingest"],
  async (req, res) => {
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

      const result = await processAndIngestMarketPrice(payload);
      res.json(result);
    } catch (error: any) {
      console.error("[Market Sniffer API Error]:", error);
      res.status(500).json({
        error: error.message || "Error al procesar el precio del mercadillo",
      });
    }
  },
);

app.post("/api/market/batch-update", async (req, res) => {
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

app.get("/api/market/items-dictionary", async (req, res) => {
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

app.get("/api/market/download-items-db", async (req, res) => {
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

app.get("/api/market/latest-prices", async (req, res) => {
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

const liveSseClients = new Set<express.Response>();

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

app.get("/api/market/live-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders?.();

  // Send initial connection confirmation
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

app.get("/api/market/sniffer-script", (req, res) => {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.secure ? "https" : "http");
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.get("host") ||
    "localhost:3000";
  const baseUrl = `${proto}://${host}`;
  const batchApiUrl = `${baseUrl}/api/market/batch-update`;
  const updateApiUrl = `${baseUrl}/api/market/update`;
  const dictUrl = `${baseUrl}/api/market/items-dictionary`;
  const server = (req.query.server as string) || "Draconiros";
  const secretKey = (process.env.MARKET_SNIFFER_SECRET || "").trim();

  const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY -> MERCADILLO ULTRA-FAST LIVE SNIFFER (HIGH PERFORMANCE)
===============================================================================
  - Búfer Asíncrono Multihilo: captura de paquetes sin latencia ni cuellos de botella.
  - Base de Datos Local (items_db.json): resolución de nombres en 0.001 ms (sin llamadas a DofusDB).
  - Micro-Batching con HTTP Keep-Alive hacia tu servidor Turso/Vercel.
  
  Dependencias requeridas:
    pip install scapy requests

  Ejecutar como Administrador:
    python dofus_sniffer.py
===============================================================================
"""

import os
import sys
import re
import time
import json
import queue
import argparse
import threading
import traceback
import subprocess
import urllib.request
from datetime import datetime

# UTF-8 y Line-Buffering en Windows + Desactivar QuickEdit Mode para evitar pausas al hacer clic en la consola
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

LOG_FILE = "sniffer.log"

class SessionPacketLogger:
    def __init__(self, log_path=LOG_FILE, server_name=None, current_token=None):
        self.log_path = log_path
        self.lock = threading.Lock()
        self.packet_count = 0
        self.max_size_bytes = 3 * 1024 * 1024
        srv = server_name or globals().get("SERVER_NAME", "Desconocido")
        tok = current_token or globals().get("CURRENT_TOKEN", "jzn")
        header_lines = [
            "=" * 80,
            "  DOFUS UNITY SNIFFER -> REGISTRO DE PAQUETES (SESION ACTIVA)",
            f"  Inicio de sesion : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"  Servidor destino : {srv}",
            f"  Token calibrado  : '{tok}'",
            "  (Este log se reinicia al abrir el sniffer y registra los paquetes inspeccionados)",
            "=" * 80,
            "",
            "",
        ]
        try:
            with open(self.log_path, "w", encoding="utf-8") as f:
                f.write("\\n".join(header_lines))
        except Exception:
            pass

    def log_packet(self, item_id, item_name, is_equip, raw_ladders, offer_prices, resolved_prices, hex_summary, api_result=""):
        with self.lock:
            self.packet_count += 1
            now = datetime.now().strftime("%H:%M:%S")
            cat_label = "EQUIPABLE" if is_equip else "RECURSO"
            lines = [
                "=" * 80,
                f"[{now}] PAQUETE #{self.packet_count} | [{cat_label}] {item_name} (#{item_id})",
                f"  Payload Hex (64b)              : {hex_summary}",
                f"  Ladders brutos decodificados   : {raw_ladders}",
            ]

            if is_equip:
                raw_offers = [int(p) for p in (resolved_prices if isinstance(resolved_prices, list) else (offer_prices if offer_prices else [])) if isinstance(p, (int, float)) and p >= 50]
                sorted_offers = sorted(raw_offers)
                count = len(sorted_offers)
                lines.append(f"  Total ofertas capturadas       : {count} oferta(s)")
                lines.append(f"  LISTA COMPLETA DE PRECIOS      : {sorted_offers}")
                if count > 0:
                    min_p = sorted_offers[0]
                    max_p = sorted_offers[-1]
                    med_p = sorted_offers[count // 2]
                    avg_p = round(sum(sorted_offers) / count)
                    lines.append(f"  Estadísticas de mercado        : Mín: {min_p:,} k | Mediana: {med_p:,} k | Media: {avg_p:,} k | Máx: {max_p:,} k")
            else:
                if isinstance(resolved_prices, dict):
                    p1 = resolved_prices.get("1", 0)
                    p10 = resolved_prices.get("10", 0)
                    p100 = resolved_prices.get("100", 0)
                    p1000 = resolved_prices.get("1000", 0)
                    lines.append(f"  Lotes asignados                : x1: {p1:,} k | x10: {p10:,} k | x100: {p100:,} k | x1000: {p1000:,} k")
                    u_parts = []
                    if p1 > 0: u_parts.append(f"x1: {p1:,} k/u")
                    if p10 > 0: u_parts.append(f"x10: {round(p10/10):,} k/u")
                    if p100 > 0: u_parts.append(f"x100: {round(p100/100):,} k/u")
                    if p1000 > 0: u_parts.append(f"x1000: {round(p1000/1000):,} k/u")
                    if u_parts:
                        lines.append(f"  Precios unitarios por lote     : {' | '.join(u_parts)}")

            lines.append(f"  Precios enviados a API / BD    : {resolved_prices}")
            if api_result:
                lines.append(f"  Respuesta API / DB             : {api_result}")
            lines.append("=" * 80)
            lines.append("")

            try:
                # Evitar expansión infinita: si supera 3MB, reiniciar conservando aviso
                if os.path.exists(self.log_path) and os.path.getsize(self.log_path) > self.max_size_bytes:
                    with open(self.log_path, "w", encoding="utf-8") as f:
                        f.write(f"=== LOG ROTADO (Sesion activa continua - {now}) ===\\n\\n")

                with open(self.log_path, "a", encoding="utf-8") as f:
                    f.write("\\n".join(lines) + "\\n")
            except Exception:
                pass

def is_admin():
    if sys.platform != "win32":
        return os.geteuid() == 0 if hasattr(os, "geteuid") else True
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def check_and_elevate_admin():
    if sys.platform == "win32" and not is_admin():
        print("[UAC] Solicitando permisos de Administrador...")
        try:
            import ctypes
            script_path = os.path.abspath(sys.argv[0])
            params = f'"{script_path}" ' + " ".join([f'"{a}"' for a in sys.argv[1:]])
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
            if int(ret) > 32:
                sys.exit(0)
            else:
                print("[Aviso] Permisos de Administrador no concedidos.")
        except Exception as e:
            print(f"[Error UAC]: {e}")

check_and_elevate_admin()

def ensure_dependencies():
    packages = []
    try:
        import requests
    except ImportError:
        packages.append("requests")
    try:
        import scapy
    except ImportError:
        packages.append("scapy")

    if packages:
        print(f"[Instalador] Instalando dependencias: {', '.join(packages)}")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", *packages])
        except Exception as e:
            print(f"[Error] No se pudieron instalar dependencias: {e}")
            input("\\nPresiona Enter para salir...")
            sys.exit(1)

ensure_dependencies()

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
try:
    from scapy.all import sniff, TCP, Raw
except Exception as e:
    print("\\n" + "=" * 70)
    print(" [CONTROLADOR DE RED NPCAP REQUERIDO EN WINDOWS]")
    print(f" Detalle: {e}")
    print("=" * 70)
    print(" Para capturar paquetes de red en Windows:")
    print(" 1. Descarga el instalador gratuito de Npcap:")
    print("    https://npcap.com/#download")
    print(" 2. Durante la instalacion MARCA la casilla:")
    print("    'Install Npcap in WinPcap API-compatible Mode'")
    print("=" * 70)
    input("\\nPresiona Enter para salir...")
    sys.exit(1)

# Argumentos de línea de comandos para permitir cambiar el servidor dinámicamente
parser = argparse.ArgumentParser(description="Dofus Unity Market Sniffer")
parser.add_argument("--server", type=str, default="${server}", help="Nombre del servidor Dofus")
parser.add_argument("--token", type=str, default=None, help="Token de 3 letras de Ankama (ej: jzn, kde, kbt)")
parser.add_argument("--no-auto-detect", action="store_true", help="Desactiva la auto-detección de tokens rotados")
cli_args, _ = parser.parse_known_args()

# ==================== CONFIGURACIÓN ====================
API_BATCH_URL = "${batchApiUrl}"
API_UPDATE_URL = "${updateApiUrl}"
API_DICT_URL = "${dictUrl}"
API_SECRET_KEY = "${secretKey}"
SERVER_NAME = (cli_args.server or "${server}").strip()
DOFUS_PORTS = "tcp port 5555"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
LOCAL_DB_FILE = os.path.join(SCRIPT_DIR, "items_db.json")
KEYMAP_FILE = os.path.join(SCRIPT_DIR, "keymap.json")

def load_calibrated_token():
    if cli_args.token:
        return cli_args.token.strip().lower()
    if os.path.exists(KEYMAP_FILE):
        try:
            with open(KEYMAP_FILE, "r", encoding="utf-8") as f:
                km = json.load(f)
                tok = km.get("current_token") or km.get("price_list")
                if tok and isinstance(tok, str) and tok.strip():
                    return tok.strip().lower()
        except Exception:
            pass
    return "jzn"

CURRENT_TOKEN = load_calibrated_token()
packet_logger = SessionPacketLogger(LOG_FILE, server_name=SERVER_NAME, current_token=CURRENT_TOKEN)
# =======================================================

# Diccionario nativo integrado con las 105 Runas oficiales de Dofus (resolución 0ms sin esperas)
DEFAULT_RUNES_DB = {
    "1519": "Runa Fu", "1521": "Runa Sa", "1522": "Runa Inte", "1523": "Runa Vi", "1524": "Runa Agi", "1525": "Runa Sue",
    "1545": "Runa Bu Fu", "1546": "Runa Bu Sa", "1547": "Runa Bu Inte", "1548": "Runa Bu Vi", "1549": "Runa Bu Agi", "1550": "Runa Bu Sue",
    "1551": "Runa Su Fu", "1552": "Runa Su Sa", "1553": "Runa Su Inte", "1554": "Runa Su Vi", "1555": "Runa Su Agi", "1556": "Runa Su Sue",
    "1557": "Runa Ga PA", "1558": "Runa Ga PM", "7433": "Runa Cri", "7434": "Runa Cu", "7435": "Runa Da", "7436": "Runa Pot",
    "7437": "Runa Da Reen", "7438": "Runa Al", "7442": "Runa Invo", "7443": "Runa Pod", "7444": "Runa Bu Pod", "7445": "Runa Su Pod",
    "7446": "Runa Da Tram", "7447": "Runa Por Tram", "7448": "Runa Ini", "7449": "Runa Bu Ini", "7450": "Runa Su Ini",
    "7451": "Runa Prospe", "7452": "Runa Re Fuego", "7453": "Runa Re Aire", "7454": "Runa Re Agua", "7455": "Runa Re Tierra",
    "7456": "Runa Re Neutral", "7457": "Runa Re Fuego Por", "7458": "Runa Re Aire Por", "7459": "Runa Re Tierra Por",
    "7460": "Runa Re Neutral Por", "7508": "Runa de firma", "7560": "Runa Re Agua Por", "10057": "Runa de caza",
    "10613": "Runa Bu Da Tram", "10615": "Runa Bu Por Tram", "10616": "Runa Su Por Tram", "10618": "Runa Bu Pot",
    "10619": "Runa Su Pot", "10662": "Runa Bu Prospe", "11637": "Runa Hui", "11638": "Runa Bu Hui", "11639": "Runa Pla",
    "11640": "Runa Bu Pla", "11641": "Runa Re PA", "11642": "Runa Bu Re PA", "11643": "Runa Re PM", "11644": "Runa Bu Re PM",
    "11645": "Runa Ret PA", "11646": "Runa Bu Ret PA", "11647": "Runa Ret PM", "11648": "Runa Bu Ret PM", "11649": "Runa Da Emp",
    "11650": "Runa Bu Da Emp", "11651": "Runa Re Emp", "11652": "Runa Bu Re Emp", "11653": "Runa Da Cri", "11654": "Runa Bu Da Cri",
    "11655": "Runa Re Cri", "11656": "Runa Bu Re Cri", "11657": "Runa Da Tierra", "11658": "Runa Bu Da Tierra",
    "11659": "Runa Da Fuego", "11660": "Runa Bu Da Fuego", "11661": "Runa Da Agua", "11662": "Runa Bu Da Agua",
    "11663": "Runa Da Aire", "11664": "Runa Bu Da Aire", "11665": "Runa Da Neutral", "11666": "Runa Bu Da Neutral",
    "18719": "Runa Da Por CC", "18720": "Runa Da Por Di", "18721": "Runa Da Por Ar", "18722": "Runa Da Por He",
    "18723": "Runa Re Por CC", "18724": "Runa Re Por Di", "19337": "Runa Bu Cu", "19338": "Runa Bu Re Aire",
    "19339": "Runa Bu Re Agua", "19340": "Runa Bu Re Fuego", "19341": "Runa Bu Re Neutral", "19342": "Runa Bu Re Tierra",
    "29683": "Runa Su Re Emp", "29684": "Runa Su Da Emp", "30695": "Runa Su Re Tierra", "30696": "Runa Su Re Neutral",
    "30697": "Runa Su Re Fuego", "30698": "Runa Su Re Agua", "30699": "Runa Su Re Cri", "30700": "Runa Su Re Aire",
    "30942": "Runa Bu Da Reen"
}

ITEMS_DB = dict(DEFAULT_RUNES_DB)
EQUIPMENT_IDS = set()
packet_queue = queue.Queue(maxsize=2000)

# Configurar sesión HTTP robusta con keep-alive y reintentos automáticos
http_session = requests.Session()
retries = Retry(
    total=3,
    backoff_factor=0.3,
    status_forcelist=[500, 502, 503, 504],
    raise_on_status=False
)
adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=20)
http_session.mount("http://", adapter)
http_session.mount("https://", adapter)

def is_item_equipment(item_id):
    s_id = str(item_id)
    return s_id in EQUIPMENT_IDS or item_id in EQUIPMENT_IDS

def load_or_download_items_db(force=False):
    global ITEMS_DB, EQUIPMENT_IDS
    need_download = force or not os.path.exists(LOCAL_DB_FILE) or os.path.getsize(LOCAL_DB_FILE) < 100
    if not need_download:
        try:
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict) and "items" in loaded:
                ITEMS_DB.update(loaded["items"])
                if "equipmentIds" in loaded and isinstance(loaded["equipmentIds"], list):
                    EQUIPMENT_IDS.update(str(x) for x in loaded["equipmentIds"])
            elif isinstance(loaded, dict):
                ITEMS_DB.update(loaded)
            ITEMS_DB.update(DEFAULT_RUNES_DB)

            # Sanitizar colisiones corruptas históricas
            corrupt_keys = [k for k, v in ITEMS_DB.items() if v == "Puré pic-feil" and k not in ("35089", "666")]
            for k in corrupt_keys:
                del ITEMS_DB[k]

            if "1550" not in ITEMS_DB or len(EQUIPMENT_IDS) == 0:
                need_download = True
            else:
                print(f"[DB Local] Cargados {len(ITEMS_DB):,} nombres ({len(EQUIPMENT_IDS):,} equipables) desde items_db.json")
                return
        except Exception:
            need_download = True

    print(f"[DB Local] Descargando base de datos actualizada desde el servidor ({API_DICT_URL}?v=2)...")
    try:
        r = http_session.get(API_DICT_URL + "?v=2", timeout=15.0)
        if r.status_code == 200:
            downloaded = r.json()
            if isinstance(downloaded, dict) and "items" in downloaded:
                ITEMS_DB.update(downloaded["items"])
                if "equipmentIds" in downloaded and isinstance(downloaded["equipmentIds"], list):
                    EQUIPMENT_IDS.update(str(x) for x in downloaded["equipmentIds"])
            elif isinstance(downloaded, dict):
                ITEMS_DB.update(downloaded)
            ITEMS_DB.update(DEFAULT_RUNES_DB)

            # Sanitizar colisiones corruptas
            corrupt_keys = [k for k, v in ITEMS_DB.items() if v == "Puré pic-feil" and k not in ("35089", "666")]
            for k in corrupt_keys:
                del ITEMS_DB[k]

            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump({"items": ITEMS_DB, "equipmentIds": list(EQUIPMENT_IDS)}, f, ensure_ascii=False)
            print(f"[DB Local] OK Base de datos guardada ({len(ITEMS_DB):,} objetos, {len(EQUIPMENT_IDS):,} equipables listos en memoria).")
        else:
            print(f"[DB Local] Error HTTP {r.status_code} al descargar base de items.")
    except Exception as e:
        print(f"[DB Local] Advertencia de descarga: {e}. Se usarán las runas y base en memoria.")

def get_item_name(item_id):
    if not item_id:
        return "Objeto"
    s_id = str(item_id)
    if s_id in ITEMS_DB:
        val = ITEMS_DB[s_id]
        if val == "Puré pic-feil" and s_id not in ("35089", "666"):
            del ITEMS_DB[s_id]
        else:
            return val
    if s_id in DEFAULT_RUNES_DB:
        ITEMS_DB[s_id] = DEFAULT_RUNES_DB[s_id]
        return DEFAULT_RUNES_DB[s_id]
    if item_id in ITEMS_DB:
        return ITEMS_DB[item_id]
    # Auto-resolución en vivo desde DofusDB con query exacto por ID
    try:
        r = http_session.get(f"https://api.dofusdb.fr/items?id={item_id}&lang=es", timeout=2.0)
        if r.status_code == 200:
            res_json = r.json()
            items_list = res_json.get("data", [])
            if items_list and len(items_list) > 0:
                first_item = items_list[0]
                if str(first_item.get("id")) == s_id:
                    n = first_item.get("name")
                    name_val = n.get("es") or n.get("fr") or n.get("en") if isinstance(n, dict) else (n if isinstance(n, str) else "")
                    if name_val and name_val.strip():
                        clean_n = name_val.strip()
                        if clean_n.lower() == "puré pic-feil" and s_id not in ("35089", "666"):
                            return f"Objeto #{item_id}"
                        ITEMS_DB[s_id] = clean_n
                        type_id = first_item.get("typeId") or (first_item.get("type", {}).get("id") if isinstance(first_item.get("type"), dict) else 0)
                        if type_id in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23, 81, 82, 90, 97, 120, 121, 151, 169, 170, 187, 188, 189, 190, 196, 207, 220, 333):
                            EQUIPMENT_IDS.add(s_id)
                        return clean_n
    except Exception:
        pass
    return f"Objeto #{item_id}"

def decode_varint(buf, off):
    val, shift, read = 0, 0, 0
    while off + read < len(buf):
        b = buf[off + read]
        read += 1
        val |= (b & 0x7F) << shift
        if (b & 0x80) == 0:
            break
        shift += 7
    return val, read

def decode_packed_varints(buf):
    vals = []
    off = 0
    while off < len(buf):
        v, r = decode_varint(buf, off)
        if r == 0:
            break
        off += r
        vals.append(v)
    return vals

def is_valid_submessage(b):
    if not b or len(b) < 2:
        return False
    off = 0
    valid_fields = 0
    while off < len(b):
        v, r = decode_varint(b, off)
        if r == 0:
            return False
        off += r
        wtype = v & 7
        fnum = v >> 3
        if fnum == 0 or wtype not in (0, 1, 2, 5):
            return False
        if wtype == 0:
            _, r2 = decode_varint(b, off)
            if r2 == 0:
                return False
            off += r2
            valid_fields += 1
        elif wtype == 2:
            l_val, r2 = decode_varint(b, off)
            if r2 == 0 or off + r2 + l_val > len(b):
                return False
            off += r2 + l_val
            valid_fields += 1
        elif wtype == 1:
            off += 8
            if off > len(b):
                return False
            valid_fields += 1
        elif wtype == 5:
            off += 4
            if off > len(b):
                return False
            valid_fields += 1
        else:
            return False
    return valid_fields >= 1 and off == len(b)

def extract_market_universal(buf):
    """Inspecciona recursivamente el mensaje Protobuf discriminando submensajes de arreglos de precios"""
    item_id = 0
    ladders = []
    offer_prices = []

    def walk(b, depth=0):
        nonlocal item_id
        off = 0
        while off < len(b):
            tag, r = decode_varint(b, off)
            if r == 0:
                break
            off += r
            fnum = tag >> 3
            wtype = tag & 7

            if wtype == 0:
                v, r = decode_varint(b, off)
                off += r
                # Solo los niveles principales definen el ID real del objeto
                if depth <= 1:
                    if fnum in (1, 2) and (10 <= v <= 100000):
                        if item_id == 0 or (str(item_id) not in ITEMS_DB and str(v) in ITEMS_DB):
                            item_id = v
                    elif fnum == 5 and (10 <= v <= 100000) and item_id == 0:
                        item_id = v

                # En ofertas individuales (depth == 1): varints de precios de ofertas unitarias (fnum in (2, 3, 4), >= 500)
                # Nunca capturar a depth == 2 donde residen estadísticas de efectos (PA, PM, Sab, Fo) ni fnum == 5 (ID de lote)
                if depth == 1 and fnum in (2, 3, 4) and 500 <= v <= 2_000_000_000 and v != item_id:
                    offer_prices.append(v)

            elif wtype == 2:
                length, r = decode_varint(b, off)
                off += r
                if off + length > len(b):
                    break
                data = b[off:off + length]
                off += length

                if is_valid_submessage(data):
                    # Es una sub-estructura (oferta individual o contenedor de efectos), inspeccionar recursivamente
                    if depth < 3:
                        walk(data, depth + 1)
                else:
                    # Es un arreglo packed de varints (precios por lotes x1, x10, x100, x1000)
                    if depth <= 1:
                        p_ints = decode_packed_varints(data)
                        if 1 <= len(p_ints) <= 100 and all(p >= 0 for p in p_ints) and any(p > 10 for p in p_ints):
                            ladders.append((fnum, p_ints))

            elif wtype == 1:
                off += 8
            elif wtype == 5:
                off += 4
            else:
                break

    walk(buf)
    return item_id, ladders, offer_prices

def clean_ladder(raw_list):
    cl = [int(p) for p in raw_list if p is not None]
    if not cl:
        return []

    # 1. Prefijo de conteo exacto de Dofus Unity (len == count + 1)
    # ej: [4, p1, p10, p100, p1000] -> len 5 == 4 + 1
    # ej: [3, p1, p10, p100] -> len 4 == 3 + 1
    # ej: [2, p1, p10] -> len 3 == 2 + 1
    # ej: [1, p1] -> len 2 == 1 + 1
    # ej: [5, ...] -> len 6 == 5 + 1
    # ej: [6, ...] -> len 7 == 6 + 1
    if len(cl) > 1 and 1 <= cl[0] <= 10 and len(cl) == cl[0] + 1:
        return cl[1:]

    # 2. Si la lista tiene longitud 5 (ej: [6, 1370, 13486, 135900, 1398990])
    # donde cl[0] es SuperTypeId/TypeId/Categoría (como 6=Consumibles/Esquíritu, 4=Pergamino)
    # y los 4 siguientes son los lotes reales x1, x10, x100, x1000
    if len(cl) == 5 and cl[0] <= 100:
        if cl[0] <= 20 or (cl[1] > 0 and cl[2] >= cl[1]):
            return cl[1:]

    # 3. Si cl[0] es un conteo/tipo pequeño (1 <= cl[0] <= 10) y cl[1] es un precio real (>= 20)
    if len(cl) > 1 and 1 <= cl[0] <= 10 and cl[1] >= 20:
        return cl[1:]

    # 4. Verificación de ratio anómalo: si 1 <= cl[0] <= 50 y cl[1] / max(1, cl[0]) > 40
    # (en Dofus ningún lote 10 cuesta 40 veces más que el lote 1)
    if len(cl) > 1 and 1 <= cl[0] <= 50 and cl[1] > 0 and (cl[1] / max(1, cl[0])) > 40:
        return cl[1:]

    return cl

def process_ladders(ladders, offer_prices=None, item_id=0):
    if isinstance(offer_prices, (int, str)) and item_id == 0:
        item_id = int(offer_prices)
        offer_prices = []
    if offer_prices is None:
        offer_prices = []

    is_known_equip = is_item_equipment(item_id)

    # Filtrar ladders válidas descartando TypeIDs/Categorías aisladas (ej: [6] o [4])
    valid_ladders = []
    for fnum, pl in ladders:
        cl = clean_ladder(pl)
        non_zero = [p for p in cl if p > 0]
        if len(non_zero) == 1 and non_zero[0] <= 10:
            continue
        if any(p > 0 for p in cl):
            valid_ladders.append((fnum, cl))

    # Detección estructural de equipables en Dofus Unity:
    # A) Está en el catálogo EQUIPMENT_IDS, O
    # B) Hay 2 o más tuplas de ofertas reales (los recursos NUNCA tienen múltiples ofertas en mercadillo)
    is_multi_gear_offers = len(valid_ladders) >= 2

    if is_known_equip or is_multi_gear_offers:
        # Los equipables se venden por unidad o apilados en lotes (x1, x10, x100, x1000) si tienen estadísticas idénticas.
        # Se extraen los precios unitarios reales para cada oferta:
        if valid_ladders:
            unit_prices = []
            for _, pl in valid_ladders:
                if not pl:
                    continue
                if len(pl) >= 1 and pl[0] and pl[0] >= 50:
                    unit_prices.append(int(pl[0]))
                if len(pl) >= 2 and pl[1] and pl[1] >= 50:
                    unit_prices.append(int(round(pl[1] / 10.0)))
                if len(pl) >= 3 and pl[2] and pl[2] >= 50:
                    unit_prices.append(int(round(pl[2] / 100.0)))
                if len(pl) >= 4 and pl[3] and pl[3] >= 50:
                    unit_prices.append(int(round(pl[3] / 1000.0)))
            valid_prices = sorted(unit_prices)
        else:
            valid_prices = sorted([int(p) for p in offer_prices if p >= 50])

        if valid_prices:
            return "equipable", valid_prices
        return "equipable", []

    # 2. Si no es equipable, es un recurso. En Dofus Unity los recursos vienen en una única tupla de lotes.
    if valid_ladders:
        return "recurso", valid_ladders[0][1]

    return "desconocido", []


def parse_market_message(buf):
    """Decodifica UNICAMENTE paquetes que contienen el token calibrado (ej: jzn)"""
    try:
        t_bytes = CURRENT_TOKEN.encode('ascii')
        if t_bytes not in buf:
            return None, None, [], {}

        pos = 0
        while True:
            found = buf.find(t_bytes, pos)
            if found == -1:
                break
            tok_end = found + len(t_bytes)
            pos = tok_end

            off_12 = buf.find(b"\x12", tok_end, tok_end + 25)
            if off_12 == -1:
                payload = buf[tok_end:]
            else:
                off = off_12 + 1
                if off >= len(buf):
                    continue
                payload_len, br = decode_varint(buf, off)
                off += br
                payload = buf[off:off + payload_len]

            item_id, ladders, offer_prices = extract_market_universal(payload)
            if item_id and item_id >= 10:
                item_type, prices = process_ladders(ladders, offer_prices, item_id)
                if prices:
                    debug_info = {
                        "ladders": [(fn, list(pl)) for fn, pl in ladders],
                        "offers": list(offer_prices),
                    }
                    return item_id, item_type, prices, debug_info
    except Exception:
        pass
    return None, None, [], {}

def async_worker():
    """Hilo en segundo plano: envía los precios por lotes sin frenar el sniffer"""
    headers = {"Content-Type": "application/json"}
    if API_SECRET_KEY:
        headers["x-api-key"] = API_SECRET_KEY

    while True:
        items_batch = []
        try:
            # Esperar el primer item de manera reactiva (150ms timeout)
            first_item = packet_queue.get(timeout=0.15)
            items_batch.append(first_item)
            packet_queue.task_done()

            # Micro-batching ultra-rápido (40ms)
            start_collect = time.time()
            while len(items_batch) < 35 and (time.time() - start_collect) < 0.04:
                try:
                    next_item = packet_queue.get_nowait()
                    items_batch.append(next_item)
                    packet_queue.task_done()
                except queue.Empty:
                    break
        except queue.Empty:
            continue
        except Exception:
            continue

        if not items_batch:
            continue

        now_str = datetime.now().strftime("%H:%M:%S")

        # Enriquecer los datos en segundo plano (para no congelar la captura de Scapy)
        prepared_items = []
        for raw in items_batch:
            iid = raw["item_id"]
            name = get_item_name(iid)
            is_equip = raw["is_equipment"]
            prices = raw["prices"]

            body = {
                "item_id": iid,
                "item_name": name,
                "type": "equipable" if is_equip else "recurso",
                "server": raw["server"],
                "source": "sniffer",
            }
            if is_equip:
                body["precios"] = [int(p) for p in prices if p >= 50]
            else:
                clean_p = clean_ladder(prices)
                p1 = clean_p[0] if len(clean_p) > 0 else 0
                p10 = clean_p[1] if len(clean_p) > 1 else 0
                p100 = clean_p[2] if len(clean_p) > 2 else 0
                p1000 = clean_p[3] if len(clean_p) > 3 else 0

                body["precios"] = {
                    "1": int(p1),
                    "10": int(p10),
                    "100": int(p100),
                    "1000": int(p1000),
                }
            prepared_items.append((body, raw))

        try:
            if len(prepared_items) == 1:
                # Envío individual
                item, raw = prepared_items[0]
                res = http_session.post(API_UPDATE_URL, json=item, headers=headers, timeout=5.0)
                api_log_msg = ""
                if res.status_code == 200:
                    data = res.json()
                    c_price = data.get("calculated_price", 0)
                    resp_type = data.get("type", item.get("type", "desconocido"))
                    outlier_note = ""
                    if data.get("filtered_outliers", 0) > 0:
                        outlier_note = f" (Filtro {data['filtered_outliers']} cebo/outlier)"
                    print(f"[{now_str}]  [{resp_type.upper()}] {item['item_name']} (#{item['item_id']}) -> {c_price:,} k (Guardado{outlier_note})", flush=True)
                    api_log_msg = f"OK 200 | Precio: {c_price:,} k{outlier_note}"
                else:
                    print(f"[{now_str}]  Error {res.status_code}: {res.text}", flush=True)
                    api_log_msg = f"Error {res.status_code}: {res.text}"

                # Registro forense en sniffer.log para la sesión activa
                packet_logger.log_packet(
                    item_id=item["item_id"],
                    item_name=item["item_name"],
                    is_equip=item["type"] == "equipable",
                    raw_ladders=raw.get("raw_debug", {}).get("ladders", []),
                    offer_prices=raw.get("raw_debug", {}).get("offers", []),
                    resolved_prices=item["precios"],
                    hex_summary=raw.get("hex_summary", ""),
                    api_result=api_log_msg,
                )
            else:
                # Envío en Lote (Batch)
                items_only = [p[0] for p in prepared_items]
                res = http_session.post(API_BATCH_URL, json={"items": items_only}, headers=headers, timeout=8.0)
                batch_msg = ""
                if res.status_code == 200:
                    data = res.json()
                    tot = data.get("total_processed", len(items_only))
                    print(f"[{now_str}]  [LOTE PROCESADO] {tot} objetos sincronizados con Turso", flush=True)
                    batch_msg = f"OK 200 | Lote de {tot} items procesado"
                else:
                    print(f"[{now_str}]  Error de lote {res.status_code}: {res.text}", flush=True)
                    batch_msg = f"Error {res.status_code}: {res.text}"

                for item, raw in prepared_items:
                    packet_logger.log_packet(
                        item_id=item["item_id"],
                        item_name=item["item_name"],
                        is_equip=item["type"] == "equipable",
                        raw_ladders=raw.get("raw_debug", {}).get("ladders", []),
                        offer_prices=raw.get("raw_debug", {}).get("offers", []),
                        resolved_prices=item["precios"],
                        hex_summary=raw.get("hex_summary", ""),
                        api_result=batch_msg,
                    )
        except requests.exceptions.RequestException as req_err:
            try:
                time.sleep(0.3)
                items_only = [p[0] for p in prepared_items]
                if len(items_only) == 1:
                    http_session.post(API_UPDATE_URL, json=items_only[0], headers=headers, timeout=6.0)
                else:
                    http_session.post(API_BATCH_URL, json={"items": items_only}, headers=headers, timeout=10.0)
            except Exception:
                pass
        except Exception as e:
            print(f"[{now_str}] [Aviso]: {e}", flush=True)

def process_packet(pkt):
    try:
        if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
            return
        # Ignorar paquetes que salen del cliente hacia el servidor
        if pkt[TCP].sport != 5555 and pkt[TCP].dport == 5555:
            return

        payload = bytes(pkt[Raw].load)

        item_id, item_type, prices, debug_info = parse_market_message(payload)
        if item_id and prices:
            is_equipment = item_type == "equipable" or is_item_equipment(item_id) or len(prices) > 4
            raw_entry = {
                "item_id": item_id,
                "is_equipment": is_equipment,
                "prices": prices,
                "server": SERVER_NAME,
                "raw_debug": debug_info,
                "hex_summary": payload[:48].hex(),
            }
            try:
                packet_queue.put_nowait(raw_entry)
            except queue.Full:
                pass
    except Exception:
        pass

def main():
    print("=" * 70, flush=True)
    print("      DOFUS UNITY -> MERCADILLO LIVE SNIFFER (MODO ESTRICTO)", flush=True)
    print(f"  Servidor Destino : {SERVER_NAME}", flush=True)
    print(f"  Token Calibrado  : '{CURRENT_TOKEN}' (filtrado estricto, sin basura)", flush=True)
    print(f"  Base de Datos    : Turso / LibSQL Cloud", flush=True)
    print("=" * 70, flush=True)

    # 1. Cargar o descargar diccionario local en RAM
    load_or_download_items_db()

    # 2. Iniciar Worker en segundo plano
    worker_thread = threading.Thread(target=async_worker, daemon=True)
    worker_thread.start()

    print("\\n Escuchando paquetes en tiempo real...", flush=True)
    print("Abre el mercadillo en Dofus Unity e inspecciona los objetos.", flush=True)
    print("Presiona Ctrl+C para salir.\\n", flush=True)

    try:
        sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
    except KeyboardInterrupt:
        print("\\n\\nSincronizador detenido por el usuario.", flush=True)
    except Exception as e:
        print(f"\\n[Error Sniffer]: {e}", flush=True)
        traceback.print_exc()
        input("\\nPresiona Enter para cerrar...")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\\n[ERROR CRITICO NO CONTROLADO]: {e}", flush=True)
        traceback.print_exc()
        input("\\nPresiona Enter para cerrar...")
`;

  res.setHeader("Content-Disposition", `attachment; filename=dofus_sniffer.py`);
  res.setHeader("Content-Type", "text/x-python; charset=utf-8");
  res.send(scriptContent);
});

app.get("/api/market/calibrator-script", (req, res) => {
  const calibratorContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY -> CALIBRADOR GUIADO DE TOKEN DE MERCADILLO
===============================================================================
  Herramienta de diagnostico y auto-calibracion de tokens para Dofus Unity.
  Te pide el objeto objetivo (por defecto Cristal liquido o Cristal plegable),
  espera el clic exacto en ese objeto, muestra los precios reales,
  guarda keymap.json y SE CIERRA INMEDIATAMENTE para evitar sobrescrituras.
===============================================================================
"""

import sys
import os
import json
import re
import urllib.request
import urllib.parse

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from scapy.all import sniff, TCP, Raw
except ImportError:
    print("[Error] Se requiere scapy. Ejecuta: pip install scapy")
    input("\\nPresiona Enter para salir...")
    sys.exit(1)

PRESETS = {
    "1": ("Cristal liquido", 23902),
    "2": ("Cristal plegable", 23903),
    "3": ("Trigo", 289),
    "4": ("Hierro", 311),
}

def get_item_name_from_api(item_id):
    try:
        url = f"https://api.dofusdb.fr/items/{item_id}?$select[]=name"
        req = urllib.request.Request(url, headers={"User-Agent": "DofusSniffer/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            d = json.loads(resp.read().decode("utf-8"))
            return (
                d.get("name", {}).get("es")
                or d.get("name", {}).get("fr")
                or d.get("name", {}).get("en")
            )
    except Exception:
        return None

def resolve_target_item():
    print("=" * 70)
    print("  CALIBRADOR DE TOKEN DE MERCADILLO (Dofus Unity)")
    print("=" * 70)
    print("Selecciona el recurso con el que calibraras para evitar falsos positivos:")
    print("  [1] Cristal liquido (ID: 23902)  <- Recomendado")
    print("  [2] Cristal plegable (ID: 23903)")
    print("  [3] Trigo (ID: 289)")
    print("  [4] Hierro (ID: 311)")
    print("  [O escribe directamente el ID o nombre de cualquier otro recurso]")
    print("-" * 70)

    try:
        choice = input("Opcion [1-4 o ID] (Presiona Enter para 'Cristal liquido'): ").strip()
    except (EOFError, KeyboardInterrupt):
        choice = "1"

    if not choice or choice == "1":
        return PRESETS["1"]
    if choice in PRESETS:
        return PRESETS[choice]

    if choice.isdigit():
        target_id = int(choice)
        name = get_item_name_from_api(target_id) or f"Objeto #{target_id}"
        return (name, target_id)

    print(f"Buscando '{choice}' en la base de datos de Dofus...")
    try:
        query = urllib.parse.quote(choice)
        url = f"https://api.dofusdb.fr/items?$select[]=id&$select[]=name&name.es[$regex]={query}&$limit=1"
        req = urllib.request.Request(url, headers={"User-Agent": "DofusSniffer/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            items = data.get("data", [])
            if items:
                it = items[0]
                n = it.get("name", {}).get("es") or choice
                return (n, it["id"])
    except Exception:
        pass

    print("No se encontro, usando Cristal liquido por defecto.")
    return PRESETS["1"]

TARGET_NAME, TARGET_ID = resolve_target_item()

print("\\n" + "=" * 70)
print(f"  OBJETIVO FIJADO: '{TARGET_NAME}' (ID: {TARGET_ID})")
print(f"  ACCION: Abre el mercadillo en Dofus Unity y HAZ CLIC EN '{TARGET_NAME}'.")
print("   (El script esperara pacientemente y solo respondera a este objeto)")
print("=" * 70 + "\\n")

def decode_varint(buf, off):
    val, shift, read = 0, 0, 0
    while off + read < len(buf):
        b = buf[off + read]
        read += 1
        val |= (b & 0x7F) << shift
        if (b & 0x80) == 0:
            break
        shift += 7
    return val, read

def decode_packed_varints(buf):
    vals = []
    off = 0
    while off < len(buf):
        v, r = decode_varint(buf, off)
        if r == 0:
            break
        off += r
        vals.append(v)
    return vals

def is_item_equipment(item_id):
    return item_id in (2469, 2425)

def is_valid_submessage(b):
    if not b or len(b) < 2:
        return False
    off = 0
    valid_fields = 0
    while off < len(b):
        v, r = decode_varint(b, off)
        if r == 0:
            return False
        off += r
        wtype = v & 7
        fnum = v >> 3
        if fnum == 0 or wtype not in (0, 1, 2, 5):
            return False
        if wtype == 0:
            _, r2 = decode_varint(b, off)
            if r2 == 0:
                return False
            off += r2
            valid_fields += 1
        elif wtype == 2:
            l_val, r2 = decode_varint(b, off)
            if r2 == 0 or off + r2 + l_val > len(b):
                return False
            off += r2 + l_val
            valid_fields += 1
        elif wtype == 1:
            off += 8
            if off > len(b):
                return False
            valid_fields += 1
        elif wtype == 5:
            off += 4
            if off > len(b):
                return False
            valid_fields += 1
        else:
            return False
    return valid_fields >= 1 and off == len(b)

def extract_market_universal(buf):
    item_id = 0
    ladders = []
    offer_prices = []

    def walk(b, depth=0):
        nonlocal item_id
        off = 0
        while off < len(b):
            tag, r = decode_varint(b, off)
            if r == 0:
                break
            off += r
            fnum = tag >> 3
            wtype = tag & 7

            if wtype == 0:
                v, r = decode_varint(b, off)
                off += r
                if depth <= 1:
                    if fnum in (1, 2) and (10 <= v <= 100000):
                        item_id = v
                    elif fnum == 5 and (10 <= v <= 100000) and item_id == 0:
                        item_id = v

                if depth == 1 and fnum in (2, 3, 4) and 500 <= v <= 2_000_000_000 and v != item_id:
                    offer_prices.append(v)

            elif wtype == 2:
                length, r = decode_varint(b, off)
                off += r
                if off + length > len(b):
                    break
                data = b[off:off + length]
                off += length

                if is_valid_submessage(data):
                    if depth < 3:
                        walk(data, depth + 1)
                else:
                    if depth <= 1:
                        p_ints = decode_packed_varints(data)
                        if 1 <= len(p_ints) <= 100 and all(p >= 0 for p in p_ints) and any(p > 10 for p in p_ints):
                            ladders.append((fnum, p_ints))

            elif wtype == 1:
                off += 8
            elif wtype == 5:
                off += 4
            else:
                break

    walk(buf)
    return item_id, ladders, offer_prices

def clean_ladder(raw_list):
    cl = [int(p) for p in raw_list if p is not None]
    if not cl:
        return []

    if len(cl) > 1 and 1 <= cl[0] <= 10 and len(cl) == cl[0] + 1:
        return cl[1:]

    if len(cl) == 5 and cl[0] <= 100:
        if cl[0] <= 20 or (cl[1] > 0 and cl[2] >= cl[1]):
            return cl[1:]

    if len(cl) > 1 and 1 <= cl[0] <= 10 and cl[1] >= 20:
        return cl[1:]

    if len(cl) > 1 and 1 <= cl[0] <= 50 and cl[1] > 0 and (cl[1] / max(1, cl[0])) > 40:
        return cl[1:]

    return cl

def process_ladders(ladders, offer_prices=None, item_id=0):
    if isinstance(offer_prices, (int, str)) and item_id == 0:
        item_id = int(offer_prices)
        offer_prices = []
    if offer_prices is None:
        offer_prices = []

    is_known_equip = is_item_equipment(item_id)

    valid_ladders = []
    for fnum, pl in ladders:
        cl = clean_ladder(pl)
        non_zero = [p for p in cl if p > 0]
        if len(non_zero) == 1 and non_zero[0] <= 10:
            continue
        if any(p > 0 for p in cl):
            valid_ladders.append((fnum, cl))

    is_multi_gear_offers = len(valid_ladders) >= 2

    if is_known_equip or is_multi_gear_offers:
        if valid_ladders:
            unit_prices = []
            for _, pl in valid_ladders:
                if not pl:
                    continue
                if len(pl) >= 1 and pl[0] and pl[0] >= 50:
                    unit_prices.append(int(pl[0]))
                if len(pl) >= 2 and pl[1] and pl[1] >= 50:
                    unit_prices.append(int(round(pl[1] / 10.0)))
                if len(pl) >= 3 and pl[2] and pl[2] >= 50:
                    unit_prices.append(int(round(pl[2] / 100.0)))
                if len(pl) >= 4 and pl[3] and pl[3] >= 50:
                    unit_prices.append(int(round(pl[3] / 1000.0)))
            valid_prices = sorted(unit_prices)
        else:
            valid_prices = sorted([int(p) for p in offer_prices if p >= 50])

        if valid_prices:
            return "equipable", valid_prices
        return "equipable", []

    if valid_ladders:
        return "recurso", valid_ladders[0][1]

    return "desconocido", []

def process_pkt(pkt):
    if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
        return

    if pkt[TCP].sport != 5555:
        return

    payload = bytes(pkt[Raw].load)
    matches = list(re.finditer(rb"type\\.ankama\\.com/([a-zA-Z0-9]{3})", payload))
    if not matches:
        return

    for m in matches:
        token = m.group(1).decode('ascii')
        token_end = m.end()

        off_12 = payload.find(bytes([0x12]), token_end, token_end + 15)
        if off_12 == -1:
            msg_bytes = payload[token_end:]
        else:
            msg_len, r = decode_varint(payload, off_12 + 1)
            msg_bytes = payload[off_12 + 1 + r : off_12 + 1 + r + msg_len]

        item_id, ladders, offer_prices = extract_market_universal(msg_bytes)

        if item_id != TARGET_ID:
            continue

        item_type, prices = process_ladders(ladders, offer_prices, item_id)
        if not prices:
            continue

        print("\\n" + "=" * 70)
        print("  PAQUETE DEL OBJETIVO IDENTIFICADO!")
        print(f"  Token detectado    : '{token}'")
        print(f"  Objeto             : {TARGET_NAME} (ID: {TARGET_ID})")
        print(f"  Tipo               : {item_type.upper()}")

        if item_type == "recurso":
            p1 = f"{prices[0]:,} k" if len(prices) > 0 else "0 k"
            p10 = f"{prices[1]:,} k" if len(prices) > 1 else "0 k"
            p100 = f"{prices[2]:,} k" if len(prices) > 2 else "0 k"
            p1000 = f"{prices[3]:,} k" if len(prices) > 3 else "0 k"
            print(f"  Escalera de precios: x1 = {p1} | x10 = {p10} | x100 = {p100} | x1000 = {p1000}")
        else:
            formatted = [f"{p:,} k" for p in prices[:6]]
            print(f"  Precios de venta   : {', '.join(formatted)}")

        print("=" * 70)
        print(f"  TOKEN OFICIAL VERIFICADO!: '{token}'")

        keymap_data = {
            "price_list": token,
            "_comentario": f"Calibrado con {TARGET_NAME} (ID {TARGET_ID})"
        }
        try:
            with open("keymap.json", "w", encoding="utf-8") as f:
                json.dump(keymap_data, f, indent=2)
            print("  Archivo 'keymap.json' creado y fijado exitosamente.")
        except Exception as e:
            print(f"Error guardando keymap.json: {e}")

        print("\\n  CALIBRACION COMPLETADA AL 100%!")
        print("Ya puedes arrancar tu sniffer principal con la opcion 1 del archivo .bat")
        print("=" * 70)

        os._exit(0)

print(f"  Escuchando trafico del juego... Haz clic en '{TARGET_NAME}' en el mercadillo...")
sniff(filter="tcp port 5555", prn=process_pkt, store=False)
`;

  res.setHeader("Content-Disposition", `attachment; filename=calibrar_token.py`);
  res.setHeader("Content-Type", "text/x-python; charset=utf-8");
  res.send(calibratorContent);
});

app.get("/api/market/download-bat", (req, res) => {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.secure ? "https" : "http");
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.get("host") ||
    "localhost:3000";
  const baseUrl = `${proto}://${host}`;
  const server = (req.query.server as string) || "Draconiros";

  const snifferScriptUrl = `${baseUrl}/api/market/sniffer-script?server=${encodeURIComponent(server)}`;
  const calibratorScriptUrl = `${baseUrl}/api/market/calibrator-script`;
  const itemsDbDownloadUrl = `${baseUrl}/api/market/download-items-db`;

  const batContent = `@echo off
chcp 65001 >nul
title Dofus Unity - Sincronizador y Calibrador de Mercadillo (${server})
cd /d "%~dp0"

:: Forzar salida inmediata en tiempo real sin almacenamiento en búfer
set PYTHONUNBUFFERED=1

echo ===================================================================
echo       DOFUS UNITY - SINCRONIZADOR DE MERCADILLO
echo       Servidor: ${server}
echo ===================================================================
echo.

echo [1/3] Descargando dofus_sniffer.py...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${snifferScriptUrl}" -o "dofus_sniffer.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${snifferScriptUrl}' -OutFile 'dofus_sniffer.py' -UseBasicParsing } catch { Write-Host $_.Exception.Message; exit 1 }"
)
if not exist "dofus_sniffer.py" (
    echo [Error] No se pudo descargar dofus_sniffer.py.
    goto :error
)

echo [2/3] Descargando calibrar_token.py...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${calibratorScriptUrl}" -o "calibrar_token.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${calibratorScriptUrl}' -OutFile 'calibrar_token.py' -UseBasicParsing } catch { }"
)

echo [3/3] Verificando items_db.json...
if not exist "items_db.json" (
    where curl >nul 2>&1
    if %errorlevel% equ 0 (
        curl -fsSL "${itemsDbDownloadUrl}" -o "items_db.json"
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${itemsDbDownloadUrl}' -OutFile 'items_db.json' -UseBasicParsing } catch { }"
    )
)

echo.
echo ===================================================================
echo  Selecciona una opcion:
echo ===================================================================
echo  [1] Iniciar Sniffer de Mercadillo
echo  [2] Calibrar Token
echo  [3] Salir
echo ===================================================================
set /p opt="Opcion [1-3] (Presiona ENTER para Iniciar Sniffer): "
if "%opt%"=="" set opt=1
if "%opt%"=="1" goto :run_sniffer
if "%opt%"=="2" goto :run_calibrator
if "%opt%"=="3" goto :fin
goto :run_sniffer

:run_sniffer
echo.
echo ===================================================================
echo  Iniciando Sniffer de Mercadillo...
echo ===================================================================
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 -u dofus_sniffer.py --server "${server}"
    goto :fin
)
where python >nul 2>&1
if %errorlevel% equ 0 (
    python -u dofus_sniffer.py --server "${server}"
    goto :fin
)
where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 -u dofus_sniffer.py --server "${server}"
    goto :fin
)
goto :no_python

:run_calibrator
echo.
echo ===================================================================
echo  Iniciando Calibrador de Token...
echo ===================================================================
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 -u calibrar_token.py
    goto :fin
)
where python >nul 2>&1
if %errorlevel% equ 0 (
    python -u calibrar_token.py
    goto :fin
)
where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 -u calibrar_token.py
    goto :fin
)
goto :no_python

:no_python
echo.
echo ===================================================================
echo  [ERROR] No se ha detectado Python en tu sistema.
echo ===================================================================
echo  1. Descarga Python gratis desde: https://www.python.org/downloads/
echo  2. IMPORTANTE: En el instalador marca la casilla:
echo     [X] "Add Python to PATH"
echo ===================================================================
goto :fin

:error
echo.
echo ===================================================================
echo  El proceso se detuvo por un error de descarga.
echo ===================================================================

:fin
echo.
echo ===================================================================
echo  Proceso finalizado.
echo ===================================================================
pause
`;

  const safeFilename = `sincronizar_mercadillo_${server.toLowerCase().replace(/[^a-z0-9]/g, "_")}.bat`;
  const crlfBat = batContent.replace(/\r?\n/g, "\r\n");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeFilename}"`,
  );
  res.setHeader("Content-Type", "application/x-bat; charset=utf-8");
  res.send(crlfBat);
});

app.get("/api/market/download-py", (req, res) => {
  const server = (req.query.server as string) || "Draconiros";
  res.redirect(
    `/api/market/sniffer-script?server=${encodeURIComponent(server)}`,
  );
});

app.get("/api/dofusdb/proxy/*", async (req, res) => {
  try {
    const params = req.params as Record<string, string>;
    const endpointPath = params[0] || "";
    const queryString = new URLSearchParams(
      req.query as Record<string, string>,
    ).toString();
    const targetUrl = `${DOFUSDB_BASE_URL}/${endpointPath}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(targetUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DofusDB-Explorer-App/1.0",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `DofusDB API returned status ${response.status}`,
        details: errorText,
        targetUrl,
      });
    }

    const data = await response.json();
    res.json({ success: true, targetUrl, queryExecuted: req.query, data });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to communicate with DofusDB API",
      message: err.message,
    });
  }
});

app.get("/api/dofusdb/items", async (req, res) => {
  try {
    const params = new URLSearchParams();
    const lang = (req.query.lang as string) || "es";
    params.append("lang", lang);
    params.append("$limit", (req.query.$limit as string) || "20");
    if (req.query.$skip) params.append("$skip", req.query.$skip as string);

    if (req.query.typeId) {
      if (Array.isArray(req.query.typeId)) {
        req.query.typeId.forEach((t) =>
          params.append("typeId[$in][]", String(t)),
        );
      } else {
        params.append("typeId", req.query.typeId as string);
      }
    }
    if (req.query.search)
      params.append(`name.${lang}[$search]`, req.query.search as string);
    if (req.query.minLevel)
      params.append("level[$gte]", req.query.minLevel as string);
    if (req.query.maxLevel)
      params.append("level[$lte]", req.query.maxLevel as string);
    if (req.query.equipmentOnly === "true")
      params.append("type.superCategoryId", "1");

    const targetUrl = `${DOFUSDB_BASE_URL}/items?${params.toString()}`;
    const response = await fetch(targetUrl);
    if (!response.ok)
      return res
        .status(response.status)
        .json({ error: "Failed to fetch items from DofusDB" });

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dofusdb/items/:id", async (req, res) => {
  try {
    const itemId = req.params.id;
    const lang = (req.query.lang as string) || "es";

    const [itemRes, recipeRes] = await Promise.all([
      fetch(`${DOFUSDB_BASE_URL}/items/${itemId}?lang=${lang}`),
      fetch(`${DOFUSDB_BASE_URL}/recipes?resultId=${itemId}&lang=${lang}`),
    ]);

    if (!itemRes.ok)
      return res
        .status(itemRes.status)
        .json({ error: "Item not found in DofusDB" });

    const item = await itemRes.json();
    let recipe = null;
    if (recipeRes.ok) {
      const recipeData = await recipeRes.json();
      if (recipeData.data && recipeData.data.length > 0)
        recipe = recipeData.data[0];
    }

    res.json({ item, recipe });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dofusdb/item-types", async (req, res) => {
  try {
    const lang = (req.query.lang as string) || "es";
    const response = await fetch(
      `${DOFUSDB_BASE_URL}/item-types?lang=${lang}&$limit=100&$sort[name.${lang}]=1`,
    );
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dofusdb/effects", async (req, res) => {
  try {
    const lang = (req.query.lang as string) || "es";
    const response = await fetch(
      `${DOFUSDB_BASE_URL}/effects?lang=${lang}&$limit=150`,
    );
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Dofusbook Build Analysis Endpoint
// ----------------------------------------------------------------------------
app.post("/api/dofusbook/analyze", async (req, res) => {
  try {
    const {
      url,
      excludeDofus = true,
      excludeTrophies = false,
      profileId,
    } = req.body;
    if (!url || typeof url !== "string" || !url.trim()) {
      return res
        .status(400)
        .json({
          error: "Debes ingresar un enlace o código de Dofusbook válido.",
        });
    }

    const analysis = await analyzeDofusbookBuild(url.trim(), {
      excludeDofus: Boolean(excludeDofus),
      excludeTrophies: Boolean(excludeTrophies),
      profileId: profileId ? Number(profileId) : undefined,
    });

    res.json(analysis);
  } catch (err: any) {
    console.error("[Dofusbook Analyze Error]:", err);
    res
      .status(500)
      .json({
        error: err.message || "Error analizando el build de Dofusbook.",
      });
  }
});

app.get("/api/dofusbook/analyze", async (req, res) => {
  try {
    const url = req.query.url as string;
    const excludeDofus = req.query.excludeDofus !== "false";
    const excludeTrophies = req.query.excludeTrophies === "true";
    const profileId = req.query.profileId
      ? Number(req.query.profileId)
      : undefined;

    if (!url || !url.trim()) {
      return res.status(400).json({ error: "Parámetro url es requerido." });
    }

    const analysis = await analyzeDofusbookBuild(url.trim(), {
      excludeDofus,
      excludeTrophies,
      profileId,
    });

    res.json(analysis);
  } catch (err: any) {
    console.error("[Dofusbook Analyze Error]:", err);
    res
      .status(500)
      .json({
        error: err.message || "Error analizando el build de Dofusbook.",
      });
  }
});

// ----------------------------------------------------------------------------
// DoFocus Coefficients & Brisage Integration Endpoints
// ----------------------------------------------------------------------------
const DOFOCUS_BASE_URL = "https://dofocus.fr/api";
const DOFOCUS_HEADERS = {
  "X-Dofocus-Client": "web",
  Referer: "https://dofocus.fr/",
  Origin: "https://dofocus.fr",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

// In-memory caches for DoFocus responses
let cachedServers: { data: any[]; timestamp: number } | null = null;
const cachedCoefficientsByServer = new Map<
  string,
  { data: any[]; timestamp: number }
>();

const DOFOCUS_SERVER_NAME_MAP: Record<string, string> = {
  draconiros: "Draconiros",
  kourial: "Kourial",
  mikhal: "Mikhal",
  dakal: "Dakal",
  brial: "Brial",
  rafal: "Rafal",
  salar: "Salar",
  "tal-kasha": "TalKasha",
  talkasha: "TalKasha",
  "tal kasha": "TalKasha",
  hellmina: "HellMina",
  "hell-mina": "HellMina",
  "hell mina": "HellMina",
  imagiro: "Imagiro",
  oruka: "Orukam",
  orukam: "Orukam",
  tylezia: "Tylezia",
  ombre: "Ombre",
  sombra: "Ombre",
  shadow: "Ombre",
};

function normalizeDofocusServer(input: string): string {
  if (!input) return "Draconiros";
  const clean = input.trim().toLowerCase();
  if (DOFOCUS_SERVER_NAME_MAP[clean]) return DOFOCUS_SERVER_NAME_MAP[clean];

  // Prefix matching for variants (e.g. "Dakal 1", "dakal-2", "Tal Kasha (Multicuenta)")
  if (clean.startsWith("draconiros")) return "Draconiros";
  if (clean.startsWith("dakal")) return "Dakal";
  if (clean.startsWith("mikhal")) return "Mikhal";
  if (clean.startsWith("brial")) return "Brial";
  if (clean.startsWith("rafal")) return "Rafal";
  if (clean.startsWith("kourial")) return "Kourial";
  if (clean.startsWith("salar")) return "Salar";
  if (clean.startsWith("tal")) return "TalKasha";
  if (clean.startsWith("hell")) return "HellMina";
  if (clean.startsWith("imagiro")) return "Imagiro";
  if (clean.startsWith("oruk")) return "Orukam";
  if (clean.startsWith("tyle")) return "Tylezia";
  if (clean.startsWith("ombr") || clean.startsWith("sombr") || clean.startsWith("shadow")) return "Ombre";

  return input;
}

app.get("/api/dofocus/servers", async (req, res) => {
  try {
    const now = Date.now();
    if (cachedServers && now - cachedServers.timestamp < 10 * 60 * 1000) {
      return res.json(cachedServers.data);
    }

    const response = await fetch(`${DOFOCUS_BASE_URL}/servers`, {
      headers: DOFOCUS_HEADERS,
    });

    if (!response.ok) {
      // Fallback default servers list if DoFocus is slow
      const fallbackServers = [
        { _id: "draconiros", name: "Draconiros" },
        { _id: "kourial", name: "Kourial" },
        { _id: "mikhal", name: "Mikhal" },
        { _id: "dakal", name: "Dakal" },
        { _id: "brial", name: "Brial" },
        { _id: "rafal", name: "Rafal" },
        { _id: "salar", name: "Salar" },
        { _id: "talkasha", name: "TalKasha" },
        { _id: "hellmina", name: "HellMina" },
        { _id: "imagiro", name: "Imagiro" },
        { _id: "orukam", name: "Orukam" },
        { _id: "tylezia", name: "Tylezia" },
        { _id: "ombre", name: "Ombre" },
      ];
      return res.json(fallbackServers);
    }

    const data = await response.json();
    cachedServers = { data, timestamp: now };
    res.json(data);
  } catch (err: any) {
    console.error("[DoFocus Servers Error]:", err);
    res
      .status(500)
      .json({
        error: err.message || "Error al consultar servidores de DoFocus",
      });
  }
});

app.get("/api/dofocus/coefficients/:serverName", async (req, res) => {
  try {
    const rawServerName = req.params.serverName || "Draconiros";
    const serverName = normalizeDofocusServer(rawServerName);
    const forceRefresh = req.query.refresh === "true";
    const now = Date.now();

    const cached = cachedCoefficientsByServer.get(serverName.toLowerCase());
    if (!forceRefresh && cached && now - cached.timestamp < 3 * 60 * 1000) {
      return res.json({
        server: serverName,
        total: cached.data.length,
        coefficients: cached.data,
        cached: true,
        timestamp: cached.timestamp,
      });
    }

    const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
    const response = await fetch(targetUrl, {
      headers: DOFOCUS_HEADERS,
    });

    if (!response.ok) {
      throw new Error(
        `DoFocus respondió con status ${response.status}: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as Array<{
      itemId: number;
      coefficient: number;
      dateUpdated?: string;
    }>;
    cachedCoefficientsByServer.set(serverName.toLowerCase(), {
      data,
      timestamp: now,
    });

    res.json({
      server: serverName,
      total: data.length,
      coefficients: data,
      cached: false,
      timestamp: now,
    });
  } catch (err: any) {
    console.error(
      `[DoFocus Coefficients Error for ${req.params.serverName}]:`,
      err,
    );
    res
      .status(500)
      .json({
        error: err.message || "Error al sincronizar coeficientes de DoFocus",
      });
  }
});

app.get("/api/dofocus/item/:itemId", async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const rawServer = (req.query.server as string) || "Draconiros";
    const serverName = normalizeDofocusServer(rawServer);

    if (!itemId) {
      return res.status(400).json({ error: "Item ID inválido" });
    }

    // Try to get from server-level cache first
    const cached = cachedCoefficientsByServer.get(serverName.toLowerCase());
    if (cached) {
      const match = cached.data.find((c) => c.itemId === itemId);
      if (match) {
        return res.json({
          itemId,
          server: serverName,
          coefficient: match.coefficient,
          dateUpdated: match.dateUpdated,
          source: "server_cache",
        });
      }
    }

    // Otherwise fetch coefficients for server
    const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
    const response = await fetch(targetUrl, {
      headers: DOFOCUS_HEADERS,
    });

    if (response.ok) {
      const list = (await response.json()) as Array<{
        itemId: number;
        coefficient: number;
        dateUpdated?: string;
      }>;
      cachedCoefficientsByServer.set(serverName.toLowerCase(), {
        data: list,
        timestamp: Date.now(),
      });
      const match = list.find((c) => c.itemId === itemId);
      if (match) {
        return res.json({
          itemId,
          server: serverName,
          coefficient: match.coefficient,
          dateUpdated: match.dateUpdated,
          source: "dofocus_live",
        });
      }
    }

    res.json({
      itemId,
      server: serverName,
      coefficient: 100,
      dateUpdated: null,
      source: "default",
    });
  } catch (err: any) {
    console.error(`[DoFocus Item Error]:`, err);
    res
      .status(500)
      .json({
        error: err.message || "Error al consultar coeficiente en DoFocus",
      });
  }
});

export { app };
export default function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}



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
  getProfileSalesVolume,
  setItemSalesVolume,
  bulkSetItemSalesVolume,
  correctPricesAgainstSalesVolume,
  processAndIngestMarketPrice,
  processAndIngestMarketPricesBatch,
  getItemsDictionary,
  getItemsCatalog,
  getLatestMarketPricesDelta,
  getProfileIdByServerNameOrSlug,
  getActivePriceProfileId,
  marketEvents,
} from "./localDataStore";
import snifferScriptHandler from "../../api/market/sniffer-script";
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
    const updatedAt = req.body?.updatedAt ? Number(req.body.updatedAt) : Date.now();
    if (!itemId || Number.isNaN(price)) {
      return res
        .status(400)
        .json({ error: "Valid itemId and price are required" });
    }

    const prices = await setItemPrice(itemId, price, profileId, "manual", updatedAt);
    const profileState = await getPriceProfileState();
    const effectivePid = profileId || profileState.activePriceProfileId;

    // Broadcast in real-time to all connected players via SSE
    marketEvents.emit("price_update", {
      profileId: effectivePid,
      itemId,
      price,
      updatedAt: prices.priceUpdatedAt[itemId] || updatedAt,
    });

    res.json({
      prices: prices.prices,
      priceUpdatedAt: prices.priceUpdatedAt,
      activePriceProfileId: profileState.activePriceProfileId,
      applied: prices.applied,
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

// Sales Volume & Rotation Endpoints
app.get("/api/local-db/sales-volume", async (req, res) => {
  try {
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
    const salesVolume = await getProfileSalesVolume(profileId);
    res.json({ salesVolume });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales volume";
    res.status(500).json({ error: message });
  }
});

app.put("/api/local-db/sales-volume/:itemId", async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const volume = req.body?.volume;
    const profileId = req.body?.profileId ? Number(req.body?.profileId) : undefined;
    const updatedAt = req.body?.updatedAt ? Number(req.body?.updatedAt) : Date.now();

    if (!itemId || !volume || typeof volume !== "object") {
      return res.status(400).json({ error: "Valid itemId and volume object are required" });
    }

    const result = await setItemSalesVolume(itemId, volume, profileId, updatedAt);
    const pid = profileId || (await getActivePriceProfileId());
    const corrected = await correctPricesAgainstSalesVolume(pid, { [itemId]: volume });
    res.json({ ...result, corrected_prices: corrected });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save sales volume";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/sales-volume/bulk", async (req, res) => {
  try {
    const volumes = req.body?.volumes;
    const profileId = req.body?.profileId ? Number(req.body?.profileId) : undefined;

    if (!volumes || typeof volumes !== "object") {
      return res.status(400).json({ error: "volumes dictionary is required" });
    }

    const result = await bulkSetItemSalesVolume(volumes, profileId);
    const pid = profileId || (await getActivePriceProfileId());
    const corrected = await correctPricesAgainstSalesVolume(pid, volumes);
    res.json({ ...result, corrected_prices: corrected });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to bulk save sales volume";
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

app.get("/api/market/sniffer-script", snifferScriptHandler);

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



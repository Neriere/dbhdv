import { Router } from "express";
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
  getPriceHistory,
  getItemPriceHistory,
  getLatestPriceChanges,
  revertPriceHistoryEntry,
  clearPriceHistory,
  getProfileCoefficients,
  setItemCoefficient,
  bulkSaveProfileCoefficients,
  getProfileSalesVolume,
  setItemSalesVolume,
  bulkSetItemSalesVolume,
  correctPricesAgainstSalesVolume,
  getProfileIdByServerNameOrSlug,
  getActivePriceProfileId,
  marketEvents,
} from "../localDataStore";

const router = Router();

function parseFlexibleTimestamp(val: unknown): number {
  if (!val) return Date.now();
  if (typeof val === "number" && !isNaN(val)) return val;
  const str = String(val).trim();
  if (!str) return Date.now();
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    return num < 1e11 ? num * 1000 : num;
  }
  const dmyMatch = str.match(
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes, seconds).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const now = Date.now();
  if (/< 1 (?:d|día|dia|day)/i.test(str)) return now - 12 * 60 * 60 * 1000;
  if (/< 3 (?:d|día|dia|day)/i.test(str)) return now - 2 * 24 * 60 * 60 * 1000;
  if (/< 1 (?:sem|semaine|week|w)/i.test(str)) return now - 5 * 24 * 60 * 60 * 1000;
  if (/< 1 (?:mes|mois|month|m)/i.test(str)) return now - 15 * 24 * 60 * 60 * 1000;
  if (/> 1 (?:mes|mois|month|m)/i.test(str)) return now - 45 * 24 * 60 * 60 * 1000;
  if (/^(?:hoy|today)$/i.test(str)) return now - 4 * 60 * 60 * 1000;
  if (/^(?:ayer|yesterday)$/i.test(str)) return now - 24 * 60 * 60 * 1000;

  const standard = Date.parse(str);
  if (!isNaN(standard) && standard > 0) return standard;
  return Date.now();
}

// ----------------------------------------------------------------------------
// Bootstrap & Metadata
// ----------------------------------------------------------------------------
router.get("/local-db/bootstrap", async (req, res) => {
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

router.get("/local-db/meta", async (_req, res) => {
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

// ----------------------------------------------------------------------------
// Sync Status & Settings
// ----------------------------------------------------------------------------
router.get("/local-db/sync-status", async (_req, res) => {
  try {
    const status = await getSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to load sync status" });
  }
});

router.post("/local-db/reset-sync-status", async (_req, res) => {
  try {
    const status = await resetSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to reset sync status" });
  }
});

router.get("/local-db/sync-settings", async (_req, res) => {
  try {
    const state = await getAutomaticSyncState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sync settings" });
  }
});

router.put("/local-db/sync-settings", async (req, res) => {
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

// ----------------------------------------------------------------------------
// Seeding & Chunks
// ----------------------------------------------------------------------------
router.post("/local-db/seed-step/init", async (_req, res) => {
  try {
    const result = await seedStepInit();
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Init seed step failed";
    res.status(500).json({ error: message });
  }
});

router.post("/local-db/seed-step/items", async (req, res) => {
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

router.post("/local-db/seed-step/recipes", async (req, res) => {
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

router.post("/local-db/seed-step/finalize", async (_req, res) => {
  try {
    const result = await seedStepFinalize();
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Finalize seed step failed";
    res.status(500).json({ error: message });
  }
});

router.post("/local-db/import-chunk/init", async (_req, res) => {
  try {
    await importChunkInit();
    res.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import chunk init failed";
    res.status(500).json({ error: message });
  }
});

router.post("/local-db/import-chunk/items", async (req, res) => {
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

router.post("/local-db/import-chunk/recipes", async (req, res) => {
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

router.post("/local-db/import-chunk/finalize", async (_req, res) => {
  try {
    const result = await importChunkFinalize();
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import chunk finalize failed";
    res.status(500).json({ error: message });
  }
});

router.post("/local-db/fast-seed", async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const data = await seedDatabaseFromBundle(force);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fast seed failed";
    res.status(500).json({ error: message });
  }
});

router.post("/local-db/import", async (_req, res) => {
  try {
    const imported = await importAllDofusData();
    res.json(imported);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Local DB import failed";
    res.status(500).json({ error: message });
  }
});

// ----------------------------------------------------------------------------
// Items & Recipes
// ----------------------------------------------------------------------------
router.post("/local-db/items/resolve-names", async (req, res) => {
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

router.get("/local-db/items/:id", async (req, res) => {
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

router.get("/local-db/item-stats/:id", async (req, res) => {
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

router.get("/local-db/recipes/:resultId", async (req, res) => {
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

router.get("/local-db/search-items", async (req, res) => {
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

router.post("/local-db/category-items", async (req, res) => {
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

// ----------------------------------------------------------------------------
// Price Profiles
// ----------------------------------------------------------------------------
router.get("/local-db/price-profiles", async (_req, res) => {
  try {
    const state = await getPriceProfileState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch price profiles" });
  }
});

router.put("/local-db/price-profiles/active", async (req, res) => {
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

// ----------------------------------------------------------------------------
// DB Export / Import
// ----------------------------------------------------------------------------
router.get("/local-db/export-database", (_req, res) => {
  res.download(getDatabaseFilePath(), "dofus-local.db");
});

router.get("/local-db/export-json", async (_req, res) => {
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

router.post("/local-db/import-json", async (req, res) => {
  try {
    const imported = await importFullDatabaseJSON(req.body);
    res.json(imported);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import JSON database";
    res.status(500).json({ error: message });
  }
});

// ----------------------------------------------------------------------------
// Prices CRUD
// ----------------------------------------------------------------------------
router.put("/local-db/prices/:itemId", async (req, res) => {
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

router.put("/local-db/prices", async (req, res) => {
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

router.delete("/local-db/prices", async (req, res) => {
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

// ----------------------------------------------------------------------------
// Price History
// ----------------------------------------------------------------------------
router.get("/local-db/price-history", async (req, res) => {
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

router.get("/local-db/price-history/item/:id", async (req, res) => {
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

router.get("/local-db/price-history/latest-changes", async (req, res) => {
  try {
    const profileId = req.query.profileId
      ? Number(req.query.profileId)
      : undefined;
    const result = await getLatestPriceChanges(profileId);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch latest price changes";
    res.status(500).json({ error: message });
  }
});

router.post("/local-db/price-history/revert", async (req, res) => {
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

router.delete("/local-db/price-history", async (req, res) => {
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

// ----------------------------------------------------------------------------
// Coefficients
// ----------------------------------------------------------------------------
router.get("/local-db/coefficients", async (req, res) => {
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

router.put("/local-db/coefficients/:itemId", async (req, res) => {
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

router.post("/local-db/coefficients/bulk", async (req, res) => {
  try {
    const rawList = Array.isArray(req.body)
      ? req.body
      : (Array.isArray(req.body?.entries)
          ? req.body.entries
          : (Array.isArray(req.body?.coefficients) ? req.body.coefficients : []));

    const entries = rawList
      .filter((e: any) => e && (e.itemId || e.id))
      .map((e: any) => ({
        itemId: Number(e.itemId || e.id),
        coefficient: Number(e.coefficient ?? e.coeff ?? 100),
        updatedAt: parseFlexibleTimestamp(e.exactDate || e.updatedAt || e.dateUpdated),
        isManual: Boolean(e.isManual),
      }));

    let profileId = req.body?.profileId
      ? Number(req.body?.profileId)
      : undefined;
    if (!profileId && (req.body?.serverSlug || req.body?.server)) {
      const slugOrName = req.body.serverSlug || req.body.server;
      const match = await getProfileIdByServerNameOrSlug(slugOrName);
      if (match) profileId = match.profileId;
    }
    const isManualBatch = Boolean(req.body?.isManual);
    const forceOverwriteManual = Boolean(req.body?.forceOverwriteManual || req.body?.isImport || !req.body?.protectManual);
    const result = await bulkSaveProfileCoefficients(entries, profileId, isManualBatch, forceOverwriteManual);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to bulk save coefficients";
    res.status(500).json({ error: message });
  }
});

// ----------------------------------------------------------------------------
// Sales Volume
// ----------------------------------------------------------------------------
router.get("/local-db/sales-volume", async (req, res) => {
  try {
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
    const salesVolume = await getProfileSalesVolume(profileId);
    res.json({ salesVolume });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales volume";
    res.status(500).json({ error: message });
  }
});

router.put("/local-db/sales-volume/:itemId", async (req, res) => {
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

router.post("/local-db/sales-volume/bulk", async (req, res) => {
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

export default router;

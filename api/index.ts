import express from "express";
import compression from "compression";
import path from "path";
import basicAuth from "express-basic-auth";
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
} from "../src/server/localDataStore.js";

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
  .then(() => console.log("[Database] Turso schemas initialized."))
  .catch((e) =>
    console.error("[Database Error] Failed to initialize Turso:", e),
  );

const PORT = Number(process.env.PORT || process.env.APP_PORT || 3000);
const HOST = process.env.APP_HOST || "0.0.0.0";
const BASIC_AUTH_USER = process.env.APP_BASIC_AUTH_USER;
const BASIC_AUTH_PASSWORD = process.env.APP_BASIC_AUTH_PASSWORD;
const BASIC_AUTH_REALM =
  process.env.APP_BASIC_AUTH_REALM || "Acceso Privado DofusDB";

app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "DofusDB API Proxy & Explorer Server" });
});

if (
  BASIC_AUTH_USER &&
  BASIC_AUTH_PASSWORD &&
  BASIC_AUTH_USER.trim() !== "" &&
  BASIC_AUTH_PASSWORD.trim() !== "" &&
  BASIC_AUTH_USER !== "missing-env-var" &&
  BASIC_AUTH_PASSWORD !== "missing-env-var"
) {
  app.use(
    basicAuth({
      users: { [BASIC_AUTH_USER]: BASIC_AUTH_PASSWORD },
      challenge: true,
      realm: BASIC_AUTH_REALM,
    }),
  );
}

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
    const message = error instanceof Error ? error.message : "Init seed step failed";
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
    const message = error instanceof Error ? error.message : "Items seed step failed";
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
    const message = error instanceof Error ? error.message : "Recipes seed step failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/seed-step/finalize", async (req, res) => {
  try {
    const result = await seedStepFinalize();
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finalize seed step failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-chunk/init", async (req, res) => {
  try {
    await importChunkInit();
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import chunk init failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-chunk/items", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const result = await importChunkItems(items);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import chunk items failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-chunk/recipes", async (req, res) => {
  try {
    const recipes = Array.isArray(req.body?.recipes) ? req.body.recipes : [];
    const result = await importChunkRecipes(recipes);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import chunk recipes failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-chunk/finalize", async (req, res) => {
  try {
    const result = await importChunkFinalize();
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import chunk finalize failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/fast-seed", async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const data = await seedDatabaseFromBundle(force);
    res.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fast seed failed";
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

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
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

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
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

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
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
    res.setHeader("Content-Disposition", `attachment; filename=dofus_database_backup_${new Date().toISOString().slice(0, 10)}.json`);
    res.setHeader("Content-Type", "application/json");
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export JSON database";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/import-json", async (req, res) => {
  try {
    const imported = await importFullDatabaseJSON(req.body);
    res.json(imported);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import JSON database";
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
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const search = req.query.search ? String(req.query.search) : undefined;
    const filter = req.query.filter as 'all' | 'increased' | 'decreased' | undefined;

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
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;

    const result = await getItemPriceHistory(itemId, profileId);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch item price history";
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
    const profileId = req.body?.profileId ? Number(req.body?.profileId) : undefined;
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
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
    const result = await getProfileCoefficients(profileId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch coefficients";
    res.status(500).json({ error: message });
  }
});

app.put("/api/local-db/coefficients/:itemId", async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const coefficient = Number(req.body?.coefficient);
    const profileId = req.body?.profileId ? Number(req.body?.profileId) : undefined;
    const updatedAt = req.body?.updatedAt ? Number(req.body?.updatedAt) : undefined;
    if (!itemId || Number.isNaN(coefficient)) {
      return res.status(400).json({ error: "Valid itemId and coefficient are required" });
    }
    const result = await setItemCoefficient(itemId, coefficient, profileId, updatedAt);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save coefficient";
    res.status(500).json({ error: message });
  }
});

app.post("/api/local-db/coefficients/bulk", async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const profileId = req.body?.profileId ? Number(req.body?.profileId) : undefined;
    const result = await bulkSaveProfileCoefficients(entries, profileId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to bulk save coefficients";
    res.status(500).json({ error: message });
  }
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
    const { url, excludeDofus = true, excludeTrophies = false, profileId } = req.body;
    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({ error: "Debes ingresar un enlace o código de Dofusbook válido." });
    }

    const analysis = await analyzeDofusbookBuild(url.trim(), {
      excludeDofus: Boolean(excludeDofus),
      excludeTrophies: Boolean(excludeTrophies),
      profileId: profileId ? Number(profileId) : undefined,
    });

    res.json(analysis);
  } catch (err: any) {
    console.error("[Dofusbook Analyze Error]:", err);
    res.status(500).json({ error: err.message || "Error analizando el build de Dofusbook." });
  }
});

app.get("/api/dofusbook/analyze", async (req, res) => {
  try {
    const url = req.query.url as string;
    const excludeDofus = req.query.excludeDofus !== "false";
    const excludeTrophies = req.query.excludeTrophies === "true";
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;

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
    res.status(500).json({ error: err.message || "Error analizando el build de Dofusbook." });
  }
});

// ----------------------------------------------------------------------------
// DoFocus Coefficients & Brisage Integration Endpoints
// ----------------------------------------------------------------------------
const DOFOCUS_BASE_URL = "https://dofocus.fr/api";
const DOFOCUS_HEADERS = {
  "X-Dofocus-Client": "web",
  "Referer": "https://dofocus.fr/",
  "Origin": "https://dofocus.fr",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
};

// In-memory caches for DoFocus responses
let cachedServers: { data: any[]; timestamp: number } | null = null;
const cachedCoefficientsByServer = new Map<string, { data: any[]; timestamp: number }>();

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
};

function normalizeDofocusServer(input: string): string {
  if (!input) return "Draconiros";
  const clean = input.trim().toLowerCase();
  return DOFOCUS_SERVER_NAME_MAP[clean] || input;
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
      ];
      return res.json(fallbackServers);
    }

    const data = await response.json();
    cachedServers = { data, timestamp: now };
    res.json(data);
  } catch (err: any) {
    console.error("[DoFocus Servers Error]:", err);
    res.status(500).json({ error: err.message || "Error al consultar servidores de DoFocus" });
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
      throw new Error(`DoFocus respondió con status ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Array<{ itemId: number; coefficient: number; dateUpdated?: string }>;
    cachedCoefficientsByServer.set(serverName.toLowerCase(), { data, timestamp: now });

    res.json({
      server: serverName,
      total: data.length,
      coefficients: data,
      cached: false,
      timestamp: now,
    });
  } catch (err: any) {
    console.error(`[DoFocus Coefficients Error for ${req.params.serverName}]:`, err);
    res.status(500).json({ error: err.message || "Error al sincronizar coeficientes de DoFocus" });
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
      const list = (await response.json()) as Array<{ itemId: number; coefficient: number; dateUpdated?: string }>;
      cachedCoefficientsByServer.set(serverName.toLowerCase(), { data: list, timestamp: Date.now() });
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
    res.status(500).json({ error: err.message || "Error al consultar coeficiente en DoFocus" });
  }
});

export default app;

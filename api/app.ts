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
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "DofusDB API Proxy & Explorer Server" });
});

if (
  BASIC_AUTH_USER &&
  BASIC_AUTH_PASSWORD &&
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

app.post("/api/local-db/import", async (req, res) => {
  try {
    try {
      await database.execute("DELETE FROM recipes");
    } catch (e) {}
    try {
      await database.execute("DELETE FROM items");
    } catch (e) {}
    try {
      await database.execute(
        "DELETE FROM servers WHERE name NOT IN ('Draconiros', 'Mikhal', 'Tal Kasha')",
      );
    } catch (e) {}

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

    const item = await getOrFetchItemById(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    res.json(item);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch item";
    res.status(500).json({ error: message });
  }
});

app.get("/api/local-db/recipes/:resultId", async (req, res) => {
  try {
    const resultId = Number(req.params.resultId);
    if (!resultId) return res.status(400).json({ error: "Invalid result id" });

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
      activePriceProfileId: profileState.activePriceProfileId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clear prices";
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

export default app;

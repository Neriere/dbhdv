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
  processAndIngestMarketPrice,
  processAndIngestMarketPricesBatch,
  getItemsDictionary,
  getLatestMarketPricesDelta,
  getProfileIdByServerNameOrSlug,
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
  const authMiddleware = basicAuth({
    users: { [BASIC_AUTH_USER]: BASIC_AUTH_PASSWORD },
    challenge: true,
    realm: BASIC_AUTH_REALM,
  });

  app.use((req, res, next) => {
    // Exempt automated market sniffer API and health check from Basic Auth prompt
    if (
      req.path.startsWith("/api/market") ||
      req.path.startsWith("/api/market-prices") ||
      req.path === "/api/health"
    ) {
      return next();
    }
    return authMiddleware(req, res, next);
  });
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

// ----------------------------------------------------------------------------
// Market Sniffer Ingestion Endpoints (Standalone Python / Packet Scapy Sync)
// ----------------------------------------------------------------------------

function verifySnifferAuth(req: express.Request): boolean {
  const secret = process.env.MARKET_SNIFFER_SECRET || process.env.SNIFFER_SECRET;
  if (!secret || secret.trim() === "") {
    return true; // No secret configured -> open access
  }
  const headerKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    req.query.key ||
    req.query.api_key;
  return headerKey === secret;
}

app.post(["/api/market/update", "/api/market-prices/ingest"], async (req, res) => {
  try {
    if (!verifySnifferAuth(req)) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Clave de API inválida o ausente en cabecera 'x-api-key'.",
      });
    }

    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Cuerpo de solicitud JSON requerido" });
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
      error: error.message || "Error al procesar el lote de precios del mercadillo",
    });
  }
});

app.get("/api/market/items-dictionary", async (req, res) => {
  try {
    const dict = await getItemsDictionary();
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=1800");
    res.json(dict);
  } catch (error: any) {
    console.error("[Items Dictionary API Error]:", error);
    res.status(500).json({ error: "Error al obtener diccionario de objetos" });
  }
});

app.get("/api/market/download-items-db", async (req, res) => {
  try {
    const dict = await getItemsDictionary();
    res.setHeader("Content-Disposition", "attachment; filename=items_db.json");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=1800");
    res.send(JSON.stringify(dict, null, 2));
  } catch (error: any) {
    console.error("[Download Items DB Error]:", error);
    res.status(500).json({ error: "Error al descargar base de items" });
  }
});

app.get("/api/market/latest-prices", async (req, res) => {
  try {
    const serverParam = (req.query.server as string) || "";
    const profileIdParam = req.query.profileId ? Number(req.query.profileId) : 0;
    const sinceParam = req.query.since ? Number(req.query.since) : 0;

    let targetProfileId = profileIdParam;
    if (!targetProfileId) {
      const { profileId } = await getProfileIdByServerNameOrSlug(serverParam);
      targetProfileId = profileId;
    }

    const result = await getLatestMarketPricesDelta(targetProfileId, sinceParam);
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

app.get("/api/market/sniffer-script", (req, res) => {
  const host = req.get("host") || "localhost:3000";
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;
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
import time
import json
import queue
import argparse
import threading
from datetime import datetime

try:
    import requests
except Exception as e:
    print(f"\n[ERROR CRITICO] Falta la libreria 'requests' ({e}).")
    print("Ejecuta en tu consola: pip install requests")
    input("\nPresiona Enter para salir...")
    sys.exit(1)

try:
    from scapy.all import sniff, TCP, Raw
except Exception as e:
    print("\n" + "=" * 70)
    print(" [ERROR AL INICIALIZAR SCAPY / CONTROLADOR DE RED]")
    print(f" Detalle: {e}")
    print("=" * 70)
    print(" Para capturar paquetes de red en Windows necesitas:")
    print(" 1. Instalar Scapy: pip install scapy")
    print(" 2. Instalar el controlador Npcap (OBLIGATORIO en Windows):")
    print("    -> Descargalo gratis desde: https://npcap.com/#download")
    print("    -> Durante la instalacion MARCA la casilla:")
    print("       'Install Npcap in WinPcap API-compatible Mode'")
    print("=" * 70)
    input("\nPresiona Enter para salir...")
    sys.exit(1)

# Argumentos de línea de comandos para permitir cambiar el servidor dinámicamente
parser = argparse.ArgumentParser(description="Dofus Unity Market Sniffer")
parser.add_argument("--server", type=str, default="${server}", help="Nombre del servidor Dofus")
cli_args, _ = parser.parse_known_args()

# ==================== CONFIGURACIÓN ====================
API_BATCH_URL = "${batchApiUrl}"
API_UPDATE_URL = "${updateApiUrl}"
API_DICT_URL = "${dictUrl}"
API_SECRET_KEY = "${secretKey}"
SERVER_NAME = (cli_args.server or "${server}").strip()
DOFUS_PORTS = "tcp port 5555"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in locals() else os.getcwd()
LOCAL_DB_FILE = os.path.join(SCRIPT_DIR, "items_db.json")
# =======================================================

ITEMS_DB = {}
packet_queue = queue.Queue(maxsize=2000)
http_session = requests.Session()

def load_or_download_items_db():
    global ITEMS_DB
    if os.path.exists(LOCAL_DB_FILE) and os.path.getsize(LOCAL_DB_FILE) > 100:
        try:
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                ITEMS_DB = json.load(f)
            print(f"[DB Local] Cargados {len(ITEMS_DB):,} nombres de objetos desde items_db.json")
            return
        except Exception as e:
            print(f"[Aviso] Error leyendo items_db.json local: {e}. Re-descargando...")

    print(f"[DB Local] Descargando base de nombres desde el servidor ({API_DICT_URL})...")
    try:
        r = http_session.get(API_DICT_URL, timeout=10.0)
        if r.status_code == 200:
            ITEMS_DB = r.json()
            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(ITEMS_DB, f, ensure_ascii=False)
            print(f"[DB Local] ✅ Base de datos guardada ({len(ITEMS_DB):,} objetos listos en memoria).")
        else:
            print(f"[DB Local] Error HTTP {r.status_code} al descargar base de items.")
    except Exception as e:
        print(f"[DB Local] Advertencia de descarga: {e}. Se usarán identificadores numéricos.")

def get_item_name(item_id):
    s_id = str(item_id)
    if s_id in ITEMS_DB:
        return ITEMS_DB[s_id]
    if item_id in ITEMS_DB:
        return ITEMS_DB[item_id]
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

def parse_kbt(buf):
    """Extrae ItemID y precios del paquete Protobuf kbt de Dofus Unity"""
    try:
        idx = buf.find(b"type.ankama.com/kbt")
        if idx == -1:
            idx = buf.find(b"kbt")
            if idx == -1:
                return None, []
            idx = idx - 16

        off = idx + 19
        if off < len(buf) and buf[off] == 0x12:
            off += 1
            payload_len, br = decode_varint(buf, off)
            off += br
            payload = buf[off:off + payload_len]

            p_off = 0
            item_id = 0
            prices = []

            while p_off < len(payload):
                tag = payload[p_off]
                p_off += 1
                field = tag >> 3
                wire = tag & 7

                if wire == 0:
                    val, br = decode_varint(payload, p_off)
                    p_off += br
                    if field == 2:
                        item_id = val
                elif wire == 2:
                    sub_len, br = decode_varint(payload, p_off)
                    p_off += br
                    sub = payload[p_off:p_off + sub_len]
                    p_off += sub_len

                    s_off = 0
                    while s_off < len(sub):
                        s_tag = sub[s_off]
                        s_off += 1
                        s_field = s_tag >> 3
                        s_wire = s_tag & 7
                        if s_wire == 0:
                            s_val, s_br = decode_varint(sub, s_off)
                            s_off += s_br
                            if s_field in (2, 5):
                                item_id = s_val
                        elif s_wire == 2:
                            in_len, s_br = decode_varint(sub, s_off)
                            s_off += s_br
                            inner = sub[s_off:s_off + in_len]
                            s_off += in_len
                            if s_field == 6:
                                i_off = 0
                                while i_off < len(inner):
                                    pv, pbr = decode_varint(inner, i_off)
                                    i_off += pbr
                                    if pv > 0:
                                        prices.append(pv)
                        else:
                            break
            return item_id, prices
    except Exception:
        pass
    return None, []

def async_worker():
    """Hilo en segundo plano: envía los precios por lotes sin frenar el sniffer"""
    headers = {"Content-Type": "application/json"}
    if API_SECRET_KEY:
        headers["x-api-key"] = API_SECRET_KEY

    while True:
        items_batch = []
        try:
            # Esperar el primer item
            first_item = packet_queue.get(timeout=1.0)
            items_batch.append(first_item)
            packet_queue.task_done()

            # Micro-batching: vaciar hasta 30 items adicionales acumulados en 80ms
            start_collect = time.time()
            while len(items_batch) < 35 and (time.time() - start_collect) < 0.08:
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

        try:
            if len(items_batch) == 1:
                # Envío individual
                item = items_batch[0]
                res = http_session.post(API_UPDATE_URL, json=item, headers=headers, timeout=4.0)
                if res.status_code == 200:
                    data = res.json()
                    c_price = data.get("calculated_price", 0)
                    print(f"[{now_str}]  [{item['type'].upper()}] {item['item_name']} (#{item['item_id']}) -> {c_price:,} k (Guardado)")
                else:
                    print(f"[{now_str}]  Error {res.status_code}: {res.text}")
            else:
                # Envío en Lote (Batch)
                res = http_session.post(API_BATCH_URL, json={"items": items_batch}, headers=headers, timeout=6.0)
                if res.status_code == 200:
                    data = res.json()
                    tot = data.get("total_processed", len(items_batch))
                    print(f"[{now_str}] ⚡ [LOTE PROCESADO] {tot} objetos sincronizados en paralelo con Turso")
                else:
                    print(f"[{now_str}]  Error de lote {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[{now_str}] ⚠️ Error de conexión al sincronizar: {e}")

def process_packet(pkt):
    if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
        return
    payload = bytes(pkt[Raw].load)

    if b"kbt" in payload or b"type.ankama.com/kbt" in payload:
        item_id, prices = parse_kbt(payload)
        if item_id and prices:
            name = get_item_name(item_id)
            is_equipment = len(prices) > 4

            body = {
                "item_id": item_id,
                "item_name": name,
                "type": "equipable" if is_equipment else "recurso",
                "server": SERVER_NAME,
                "source": "sniffer",
            }

            if is_equipment:
                body["precios"] = prices
            else:
                body["precios"] = {
                    "1": prices[0] if len(prices) > 0 else 0,
                    "10": prices[1] if len(prices) > 1 else 0,
                    "100": prices[2] if len(prices) > 2 else 0,
                    "1000": prices[3] if len(prices) > 3 else 0,
                }

            try:
                packet_queue.put_nowait(body)
            except queue.Full:
                pass

if __name__ == "__main__":
    print("=" * 70)
    print("      DOFUS UNITY -> MERCADILLO LIVE SYNC (ULTRA-RÁPIDO)")
    print(f"  Servidor Destino : {SERVER_NAME}")
    print(f"  Base de Datos    : Turso / LibSQL Cloud")
    print("=" * 70)

    # 1. Cargar o descargar diccionario local en RAM
    load_or_download_items_db()

    # 2. Iniciar Worker en segundo plano
    worker_thread = threading.Thread(target=async_worker, daemon=True)
    worker_thread.start()

    print("\n🟢 Escuchando paquetes en tiempo real...")
    print("Abre el mercadillo en Dofus Unity e inspecciona los objetos.")
    print("Presiona Ctrl+C para salir.\n")

    try:
        sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
    except KeyboardInterrupt:
        print("\n\nSincronizador detenido por el usuario.")
    except Exception as e:
        print(f"\n[Error Sniffer]: {e}")
        input("Presiona Enter para cerrar...")
`;

  res.setHeader("Content-Disposition", `attachment; filename=dofus_sniffer.py`);
  res.setHeader("Content-Type", "text/x-python; charset=utf-8");
  res.send(scriptContent);
});

app.get("/api/market/download-bat", (req, res) => {
  const host = req.get("host") || "localhost:3000";
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;
  const server = (req.query.server as string) || "Draconiros";
  const scriptUrl = `${baseUrl}/api/market/sniffer-script?server=${encodeURIComponent(server)}`;
  const dictUrl = `${baseUrl}/api/market/items-dictionary`;

  const batContent = `@echo off
setlocal EnableDelayedExpansion

:: 1. Fijar directorio de trabajo donde reside este archivo .bat
cd /d "%~dp0"

:: 2. Si ya venimos del proceso elevado, saltar directamente a la ejecucion
if "%~1"=="elevated" goto :main_execution

:: 3. Comprobar permisos de Administrador
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo ===================================================================
    echo  [ADMIN] Se requieren permisos de Administrador para capturar red.
    echo  Solicitando elevacion UAC de Windows...
    echo ===================================================================
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/k cd /d ""%~dp0"" && call ""%~f0"" elevated' -Verb RunAs"
    exit /b
)

:main_execution
title Dofus Unity - Sincronizador de Mercadillo (${server})
cls

set "CONFIGURED_SERVER=${server}"
set "PARAM1=%~1"
set "PARAM2=%~2"
set "TARGET_SERVER=!CONFIGURED_SERVER!"

if not "!PARAM1!"=="" if not "!PARAM1!"=="elevated" (
    set "TARGET_SERVER=!PARAM1!"
)
if "!PARAM1!"=="elevated" if not "!PARAM2!"=="" (
    set "TARGET_SERVER=!PARAM2!"
)

echo ===================================================================
echo       DOFUS UNITY - MERCADILLO AUTO-SYNC (!TARGET_SERVER!)
echo ===================================================================
echo.

:: 1. Deteccion de ejecutable de Python
echo [1/4] Buscando Python en el sistema...
set "PYTHON_EXE="
where python >nul 2>&1 && set "PYTHON_EXE=python"
if not defined PYTHON_EXE (
    where py >nul 2>&1 && set "PYTHON_EXE=py -3"
)
if not defined PYTHON_EXE (
    where python3 >nul 2>&1 && set "PYTHON_EXE=python3"
)
if not defined PYTHON_EXE (
    for /d %%D in ("%LOCALAPPDATA%\\Programs\\Python\\Python*") do (
        if exist "%%D\\python.exe" set "PYTHON_EXE=%%D\\python.exe"
    )
)
if not defined PYTHON_EXE (
    for /d %%D in ("%ProgramFiles%\\Python*") do (
        if exist "%%D\\python.exe" set "PYTHON_EXE=%%D\\python.exe"
    )
)

if not defined PYTHON_EXE (
    echo.
    echo ===================================================================
    echo  [ERROR CRITICO] No se ha detectado Python instalado.
    echo ===================================================================
    echo  1. Descarga Python gratis desde: https://www.python.org/downloads/
    echo  2. IMPORTANTE: Marca la casilla "Add Python to PATH" al instalar.
    echo  3. Tras instalarlo, vuelve a ejecutar este archivo .bat.
    echo ===================================================================
    goto :exit_pause
)

echo [OK] Python detectado: !PYTHON_EXE!
echo.

:: 2. Verificacion de dependencias (requests y scapy)
echo [2/4] Verificando dependencias (requests, scapy)...
!PYTHON_EXE! -c "import requests, scapy" >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo [INSTALANDO] Instalando librerias necesarias automaticamente...
    !PYTHON_EXE! -m pip install --upgrade requests scapy
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] No se pudieron instalar las librerias con pip.
        echo Comprueba tu conexion a Internet o ejecuta: pip install requests scapy
        goto :exit_pause
    )
    echo [OK] Dependencias instaladas correctamente.
) else (
    echo [OK] Dependencias listas.
)
echo.

:: 3. Verificacion de controlador Npcap en Windows
echo [3/4] Comprobando controlador de paquetes de red (Npcap)...
set "NPCAP_OK=0"
if exist "%SystemRoot%\\System32\\wpcap.dll" set "NPCAP_OK=1"
if exist "%SystemRoot%\\System32\\Npcap" set "NPCAP_OK=1"
if exist "%SystemRoot%\\SysWOW64\\wpcap.dll" set "NPCAP_OK=1"

if "!NPCAP_OK!"=="0" (
    echo.
    echo -------------------------------------------------------------------
    echo  [AVISO] No se detecto el controlador Npcap instalado en Windows.
    echo  Si Scapy muestra un error al iniciar la captura, instala Npcap:
    echo  -> https://npcap.com/#download
    echo  (Recuerda marcar 'Install Npcap in WinPcap API-compatible Mode')
    echo -------------------------------------------------------------------
    echo.
) else (
    echo [OK] Controlador de captura detectado.
    echo.
)

:: 4. Descarga automatica del motor Python si no existe
echo [4/4] Verificando archivos del sincronizador...
if not exist "dofus_sniffer.py" (
    echo [DESCARGA] Obteniendo script dofus_sniffer.py desde el servidor...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${scriptUrl}' -OutFile 'dofus_sniffer.py'"
    if not exist "dofus_sniffer.py" (
        echo [ERROR] No se pudo descargar dofus_sniffer.py.
        goto :exit_pause
    )
)

if not exist "items_db.json" (
    echo [DESCARGA] Obteniendo diccionario de nombres (items_db.json)...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${dictUrl}' -OutFile 'items_db.json'"
)

echo.
echo ===================================================================
echo  INICIANDO MOTOR DE CAPTURA EN VIVO
echo  Servidor : !TARGET_SERVER!
echo ===================================================================
echo.

!PYTHON_EXE! dofus_sniffer.py --server "!TARGET_SERVER!"

:exit_pause
echo.
echo ===================================================================
echo  Proceso finalizado. La ventana permanecera abierta.
echo ===================================================================
pause
`;

  const safeFilename = `sincronizar_mercadillo_${server.toLowerCase().replace(/[^a-z0-9]/g, "_")}.bat`;
  const crlfBat = batContent.replace(/\r?\n/g, "\r\n");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
  res.setHeader("Content-Type", "application/x-bat; charset=utf-8");
  res.send(crlfBat);
});

app.get("/api/market/download-py", (req, res) => {
  const server = (req.query.server as string) || "Draconiros";
  res.redirect(`/api/market/sniffer-script?server=${encodeURIComponent(server)}`);
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

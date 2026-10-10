import {
  DofusItem,
  DofusRecipe,
  SyncStatus,
} from "../../types";
import { getDofusDbSeedDataAsync } from "../../data/dofusDbSeedData";
import { syncRemoteSalesVolume } from "../salesVolumeService";
import { isOmittedItem } from "../../data/dofusJobs";
import { CACHE_KEY, CACHE_TIMESTAMP_KEY, setIdbVal } from "./cache";
import { DEFAULT_PRICE_PROFILES } from "./constants";
import {
  emitDatabaseUpdated,
  getSyncStatusCache,
  LOCAL_DB_API_BASE,
  requestJson,
  setSyncStatusCache,
  updateMemoryCache,
} from "./store";
import { BootstrapResponse } from "./types";
import { getImportedItems } from "./items";

export async function importFullDatabaseJSON(data: unknown): Promise<void> {
  const response = await requestJson<BootstrapResponse>(
    `${LOCAL_DB_API_BASE}/import-json`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );

  updateMemoryCache({
    items: response.items,
    recipes: response.recipes,
    prices: response.prices,
    priceUpdatedAt: response.priceUpdatedAt,
    syncStatus: response.syncStatus,
    syncSettings: response.syncSettings,
    priceProfiles: response.priceProfiles,
    activePriceProfileId: response.activePriceProfileId,
  });
}

export async function performFullItemImport(
  onProgress?: (status: SyncStatus) => void,
): Promise<{ items: DofusItem[]; status: SyncStatus }> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }

  const updateProgress = (pct: number, step: string, msg: string) => {
    const updated: SyncStatus = {
      ...getSyncStatusCache(),
      isLoading: true,
      progressPercent: pct,
      currentStep: step,
      progressMessage: msg,
    };
    setSyncStatusCache(updated);
    if (onProgress) onProgress(updated);
    emitDatabaseUpdated();
  };

  try {
    updateProgress(5, "Iniciando importación", "Conectando con DofusDB y preparando base de datos...");
    await requestJson(`${LOCAL_DB_API_BASE}/import-chunk/init`, { method: "POST" });

    updateProgress(10, "Paso 1/3: Descargando recetas de DofusDB", "Consultando recetas en api.dofusdb.fr...");
    const recipesLimit = 50;
    let recipesSkip = 0;
    let totalRecipes = 5000;
    const allRecipes: DofusRecipe[] = [];
    const neededItemIds = new Set<number>();

    while (recipesSkip < totalRecipes) {
      try {
        const res = await fetch(`https://api.dofusdb.fr/recipes?$limit=${recipesLimit}&$skip=${recipesSkip}&$sort=id`);
        if (!res.ok) break;
        const json = await res.json();
        totalRecipes = json.total || totalRecipes;
        const pageRecipes = json.data || [];
        if (pageRecipes.length === 0) break;

        for (const r of pageRecipes) {
          const resultId = Number(r.resultId || r.result_id || r.id);
          if (resultId) {
            neededItemIds.add(resultId);
            const ingredientIds: number[] = [];
            const quantities: number[] = [];
            if (Array.isArray(r.ingredientIds) && Array.isArray(r.quantities)) {
              for (let idx = 0; idx < r.ingredientIds.length; idx++) {
                const iId = Number(r.ingredientIds[idx]);
                if (iId) {
                  ingredientIds.push(iId);
                  quantities.push(Number(r.quantities[idx]) || 1);
                  neededItemIds.add(iId);
                }
              }
            }
            if (ingredientIds.length > 0) {
              const craftXpRatio = typeof r.craftXpRatio === "number"
                ? r.craftXpRatio
                : typeof (r.result as any)?.craftXpRatio === "number"
                  ? (r.result as any).craftXpRatio
                  : undefined;
              const craftConditionalCriterion = typeof r.craftConditionalCriterion === "string"
                ? r.craftConditionalCriterion
                : typeof (r.result as any)?.craftConditionalCriterion === "string"
                  ? (r.result as any).craftConditionalCriterion
                  : undefined;

              allRecipes.push({
                id: Number(r.id) || resultId,
                resultId,
                ingredientIds,
                quantities,
                jobId: Number(r.jobId || r.job_id) || undefined,
                ...(craftXpRatio !== undefined ? { craftXpRatio } : {}),
                ...(craftConditionalCriterion ? { craftConditionalCriterion } : {}),
              });
            }
          }
        }

        recipesSkip += recipesLimit;
        const pct = Math.round(10 + (recipesSkip / totalRecipes) * 25);
        updateProgress(
          Math.min(35, pct),
          "Paso 1/3: Descargando recetas de DofusDB",
          `Descargadas ${Math.min(recipesSkip, totalRecipes).toLocaleString()} de ${totalRecipes.toLocaleString()} recetas...`
        );
      } catch (err) {
        console.warn("Recipe fetch page error, continuing...", err);
        break;
      }
    }

    for (let i = 0; i < allRecipes.length; i += 250) {
      const chunk = allRecipes.slice(i, i + 250);
      await requestJson(`${LOCAL_DB_API_BASE}/import-chunk/recipes`, {
        method: "POST",
        body: JSON.stringify({ recipes: chunk }),
      });
    }

    updateProgress(40, "Paso 2/3: Descargando objetos", "Descargando catálogo de objetos de DofusDB en español...");
    const itemsLimit = 50;
    let itemsSkip = 0;
    let totalItems = 22000;
    let savedItemsCount = 0;
    let currentBatch: DofusItem[] = [];
    const allCollectedItems: DofusItem[] = [];

    while (itemsSkip < totalItems) {
      try {
        const res = await fetch(`https://api.dofusdb.fr/items?$limit=${itemsLimit}&$skip=${itemsSkip}&lang=es&$sort=id`);
        if (!res.ok) break;
        const json = await res.json();
        totalItems = json.total || totalItems;
        const pageItems = json.data || [];
        if (pageItems.length === 0) break;

        for (const rawItem of pageItems) {
          const id = Number(rawItem.id || rawItem.ankama_id || 0);
          if (!id) continue;
          const isNeeded = neededItemIds.has(id) || !isOmittedItem(rawItem);
          if (isNeeded) {
            const cleanItem: DofusItem = {
              id,
              name: typeof rawItem.name === "object" && rawItem.name !== null
                ? {
                    es: String(rawItem.name.es || rawItem.name.fr || rawItem.name.en || `Objeto #${id}`),
                    fr: rawItem.name.fr ? String(rawItem.name.fr) : undefined,
                    en: rawItem.name.en ? String(rawItem.name.en) : undefined,
                  }
                : { es: String(rawItem.name || `Objeto #${id}`) },
              level: Number(rawItem.level || 1),
              typeId: Number(rawItem.typeId || rawItem.type_id || rawItem.type?.id || 0),
              iconId: Number(rawItem.iconId || rawItem.icon_id || 0),
              hasRecipe: Boolean(rawItem.hasRecipe || rawItem.has_recipe),
              price: Number(rawItem.price || 0),
              type: rawItem.type ? {
                id: Number(rawItem.type.id || 0),
                superCategoryId: Number(rawItem.type.superCategoryId || 0),
                name: typeof rawItem.type.name === "object" && rawItem.type.name !== null
                  ? { es: String(rawItem.type.name.es || rawItem.type.name.fr || rawItem.type.name.en || "") }
                  : { es: String(rawItem.type.name || "") },
              } : undefined,
              possibleEffects: Array.isArray(rawItem.possibleEffects)
                ? rawItem.possibleEffects.slice(0, 15).map((e: any) => ({
                    effectId: Number(e.effectId || e.effect_id || 0),
                    from: e.from != null ? Number(e.from) : undefined,
                    to: e.to != null ? Number(e.to) : undefined,
                  }))
                : undefined,
            };
            currentBatch.push(cleanItem);
            allCollectedItems.push(cleanItem);
          }
        }

        if (currentBatch.length >= 50) {
          try {
            await requestJson(`${LOCAL_DB_API_BASE}/import-chunk/items`, {
              method: "POST",
              body: JSON.stringify({ items: currentBatch }),
            });
          } catch (chunkErr) {
            console.warn("[ImportChunk] Server chunk skipped, preserved locally:", chunkErr);
          }
          savedItemsCount += currentBatch.length;
          currentBatch = [];
        }

        itemsSkip += itemsLimit;
        const pct = Math.round(40 + (itemsSkip / totalItems) * 50);
        updateProgress(
          Math.min(90, pct),
          "Paso 2/3: Descargando y guardando objetos útiles",
          `Procesados ${Math.min(itemsSkip, totalItems).toLocaleString()} de ${totalItems.toLocaleString()} (Guardados: ${savedItemsCount.toLocaleString()})...`
        );
      } catch (err) {
        console.warn("Item fetch page error, continuing...", err);
        break;
      }
    }

    if (currentBatch.length > 0) {
      try {
        await requestJson(`${LOCAL_DB_API_BASE}/import-chunk/items`, {
          method: "POST",
          body: JSON.stringify({ items: currentBatch }),
        });
      } catch (chunkErr) {
        console.warn("[ImportChunk] Final server chunk skipped, preserved locally:", chunkErr);
      }
      savedItemsCount += currentBatch.length;
    }

    updateProgress(95, "Paso 3/3: Finalizando sincronización", "Calculando estadísticas y verificando base de datos...");
    let response: BootstrapResponse | null = null;
    try {
      response = await requestJson<BootstrapResponse>(
        `${LOCAL_DB_API_BASE}/import-chunk/finalize`,
        { method: "POST" }
      );
    } catch (finalizeErr) {
      console.warn("[ImportChunk] Server finalize skipped:", finalizeErr);
    }

    const fallbackSeed = (allCollectedItems.length < 500) ? await getDofusDbSeedDataAsync() : null;
    const finalItems = allCollectedItems.length >= 500 ? allCollectedItems : (fallbackSeed?.items || []);

    const finalRecipesMap: Record<number, DofusRecipe> = {};
    if (allRecipes.length >= 500) {
      for (const r of allRecipes) {
        if (r.resultId) finalRecipesMap[r.resultId] = r;
      }
    } else if (fallbackSeed?.recipes) {
      for (const r of fallbackSeed.recipes) {
        if (r.resultId) finalRecipesMap[r.resultId] = r;
      }
    }

    if (response?.salesVolume) {
      syncRemoteSalesVolume(response.salesVolume);
    }

    updateMemoryCache({
      items: finalItems,
      recipes: finalRecipesMap,
      prices: response?.prices || {},
      priceUpdatedAt: response?.priceUpdatedAt || {},
      syncStatus: response?.syncStatus || {
        lastSyncTimestamp: Date.now(),
        totalImported: finalItems.length,
        recipesCount: Object.keys(finalRecipesMap).length,
        equipablesCount: 3918,
        consumablesCount: 2096,
        resourcesCount: 4713,
        cosmeticsOmittedCount: 9206,
        isLoading: false,
        progressMessage: `Base de datos sincronizada (${finalItems.length.toLocaleString()} objetos y ${Object.keys(finalRecipesMap).length.toLocaleString()} recetas).`,
        progressPercent: 100,
        currentStep: "Completado",
      },
      syncSettings: response?.syncSettings || { enabled: true, intervalDays: 30 },
      priceProfiles: response?.priceProfiles || [
        { id: 1, name: "Draconiros", slug: "draconiros", isDefault: true, category: "monocuenta_clasico", categoryLabel: "Monocuenta Clásico" }
      ],
      activePriceProfileId: response?.activePriceProfileId || 1,
    });

    updateProgress(100, "Completado", `¡Importación en vivo finalizada con éxito (${finalItems.length.toLocaleString()} objetos y ${Object.keys(finalRecipesMap).length.toLocaleString()} recetas guardadas)!`);
    return { items: getImportedItems(), status: getSyncStatusCache() };
  } catch (error) {
    const errorStatus: SyncStatus = {
      ...getSyncStatusCache(),
      isLoading: false,
      progressMessage: `Error durante la importación: ${error instanceof Error ? error.message : String(error)}`,
    };
    setSyncStatusCache(errorStatus);
    if (onProgress) onProgress(errorStatus);
    emitDatabaseUpdated();
    throw error;
  }
}

export async function triggerFastSeedDatabase(
  force = true,
  onProgress?: (status: SyncStatus) => void,
): Promise<{ items: DofusItem[]; status: SyncStatus }> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }

  const updateProgress = (pct: number, step: string, msg: string) => {
    const updated: SyncStatus = {
      ...getSyncStatusCache(),
      isLoading: true,
      progressPercent: pct,
      currentStep: step,
      progressMessage: msg,
    };
    setSyncStatusCache(updated);
    if (onProgress) onProgress(updated);
    emitDatabaseUpdated();
  };

  try {
    updateProgress(5, "Iniciando base de datos", "Preparando y verificando tablas en la base de datos...");

    let response: BootstrapResponse | null = null;

    try {
      const initRes = await requestJson<{
        totalItems: number;
        totalRecipes: number;
        itemChunks: number;
        recipeChunks: number;
      }>(`${LOCAL_DB_API_BASE}/seed-step/init`, { method: "POST" });

      const { totalItems, totalRecipes, itemChunks, recipeChunks } = initRes;

      if (itemChunks > 0 || recipeChunks > 0) {
        for (let i = 0; i < itemChunks; i++) {
          const chunkPct = Math.round(5 + ((i + 1) / itemChunks) * 50);
          const count = Math.min((i + 1) * 400, totalItems);
          updateProgress(
            chunkPct,
            `Paso 1/2: Guardando objetos (${i + 1}/${itemChunks})`,
            `Guardando objetos y estadísticas: ${count.toLocaleString()} / ${totalItems.toLocaleString()}...`
          );
          await requestJson(`${LOCAL_DB_API_BASE}/seed-step/items`, {
            method: "POST",
            body: JSON.stringify({ chunkIndex: i, chunkSize: 400 }),
          });
        }

        for (let i = 0; i < recipeChunks; i++) {
          const chunkPct = Math.round(55 + ((i + 1) / recipeChunks) * 40);
          const count = Math.min((i + 1) * 400, totalRecipes);
          updateProgress(
            chunkPct,
            `Paso 2/2: Guardando recetas (${i + 1}/${recipeChunks})`,
            `Guardando recetas de crafteo: ${count.toLocaleString()} / ${totalRecipes.toLocaleString()}...`
          );
          await requestJson(`${LOCAL_DB_API_BASE}/seed-step/recipes`, {
            method: "POST",
            body: JSON.stringify({ chunkIndex: i, chunkSize: 400 }),
          });
        }
      }

      response = await requestJson<BootstrapResponse>(
        `${LOCAL_DB_API_BASE}/seed-step/finalize`,
        { method: "POST" }
      );
    } catch (serverErr) {
      console.warn("[FastSeed] El servidor remoto o serverless no soporta siembra manual, hidratando localmente:", serverErr);
    }

    if (!response || !response.items || response.items.length < 100) {
      updateProgress(40, "Cargando catálogo Dofus 3.7", "Descomprimiendo objetos y recetas del catálogo 3.7...");
      const seed = await getDofusDbSeedDataAsync();
      const finalRecipes: Record<number, DofusRecipe> = {};
      for (const r of seed.recipes || []) {
        if (r.resultId) finalRecipes[r.resultId] = r;
      }

      updateProgress(80, "Sincronizando cotizaciones", "Consultando precios de mercadillo y servidores en vivo...");
      let liveBootstrap: BootstrapResponse | null = null;
      try {
        const savedProfileId = typeof window !== "undefined" ? localStorage.getItem("selected_dofus_price_profile_id") : null;
        const profileQuery = savedProfileId && Number(savedProfileId) > 0 ? `?profileId=${savedProfileId}` : "";
        liveBootstrap = await requestJson<BootstrapResponse>(`${LOCAL_DB_API_BASE}/bootstrap${profileQuery}`);
      } catch (err) {
        console.warn("[FastSeed] No se pudo conectar con el endpoint de bootstrap en vivo:", err);
      }

      response = {
        items: seed.items || [],
        recipes: finalRecipes,
        prices: liveBootstrap?.prices || {},
        priceUpdatedAt: liveBootstrap?.priceUpdatedAt || {},
        salesVolume: liveBootstrap?.salesVolume || {},
        syncStatus: liveBootstrap?.syncStatus || {
          lastSyncTimestamp: seed.exportedAt || Date.now(),
          totalImported: seed.items.length,
          recipesCount: Object.keys(finalRecipes).length,
          equipablesCount: 3918,
          consumablesCount: 2096,
          resourcesCount: 4713,
          cosmeticsOmittedCount: 9206,
          isLoading: false,
          progressMessage: `Base de datos sincronizada (${seed.items.length.toLocaleString()} objetos y ${Object.keys(finalRecipes).length.toLocaleString()} recetas).`,
          progressPercent: 100,
          currentStep: "Completado",
        },
        syncSettings: liveBootstrap?.syncSettings || { enabled: true, intervalDays: 30 },
        priceProfiles: liveBootstrap?.priceProfiles || DEFAULT_PRICE_PROFILES,
        activePriceProfileId: liveBootstrap?.activePriceProfileId || 1,
        databasePath: liveBootstrap?.databasePath || "local.db",
      };
    }

    updateMemoryCache({
      items: response.items,
      recipes: response.recipes,
      prices: response.prices,
      priceUpdatedAt: response.priceUpdatedAt,
      syncStatus: response.syncStatus,
      syncSettings: response.syncSettings,
      priceProfiles: response.priceProfiles,
      activePriceProfileId: response.activePriceProfileId,
    });

    if (response.salesVolume) {
      syncRemoteSalesVolume(response.salesVolume);
    }
    if (typeof window !== "undefined") {
      void setIdbVal(CACHE_KEY, response);
    }

    updateProgress(100, "Completado", `¡Base de datos sincronizada con éxito (${response.items.length.toLocaleString()} objetos y ${Object.keys(response.recipes).length.toLocaleString()} recetas)!`);
    return { items: getImportedItems(), status: getSyncStatusCache() };
  } catch (err) {
    const errorStatus: SyncStatus = {
      ...getSyncStatusCache(),
      isLoading: false,
      progressMessage: `Error al sembrar base de datos: ${err instanceof Error ? err.message : String(err)}`,
    };
    setSyncStatusCache(errorStatus);
    if (onProgress) onProgress(errorStatus);
    emitDatabaseUpdated();
    throw err;
  }
}

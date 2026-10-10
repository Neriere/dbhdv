import { database } from "../connection";
import { parseJsonValue, getLocalizedText, cleanEffects, fetchJson } from "../helpers";
import { isOmittedItem } from "../../../data/dofusJobs";
import { DOFUS_BASE_RUNES, extractItemStats } from "../../../data/dofusRuneWeights";
import { CRAFTABLE_RUNES } from "../../../data/craftableRunesData";
import { ALL_DOFUS_RUNES } from "../../../data/dofusAllRunesDict";
import { PRESET_CRAFTABLE_ITEMS } from "../../../data/presetCraftableItems";
import { getDofusDbSeedData } from "../../../data/dofusDbSeedData";
import { buildItemsDictionary } from "../../../data/itemsDictionaryData";
import { DOFUS_EQUIPMENT_TYPE_IDS } from "../priceCalculator";
import { ensureDefaultPriceProfile } from "../serverProfiles";
import type { DofusItem, DofusRecipe, SyncStatus } from "../../../types";
import type { BootstrapData } from "../types";
import {
  invalidateServerBootstrapCache,
  buildBootstrapData,
  setSyncStatus,
  getDefaultSyncStatus,
} from "./sync";

const DOFUS_API_BASE = "https://api.dofusdb.fr";

const SERVER_KNOWN_ITEMS: Record<number, Partial<DofusItem>> = {
  17994: {
    id: 17994,
    level: 200,
    typeId: 41,
    iconId: 179940,
    name: { es: "Lapa", fr: "Bernique", en: "Limpet" },
    type: { id: 41, superCategoryId: 9, name: { es: "Pescado", fr: "Poisson", en: "Fish" } },
  },
};

export function normalizeSpanishItem(rawInput: Record<string, unknown>): DofusItem {
  if (!rawInput) {
    return {
      id: 0,
      level: 1,
      typeId: 0,
      iconId: 0,
      name: { es: "Desconocido", fr: "Inconnu", en: "Unknown" },
      type: { id: 0, superCategoryId: 0, name: { es: "Desconocido", fr: "Inconnu", en: "Unknown" } },
      hasRecipe: false,
    };
  }

  let rawItem = rawInput;
  if (Array.isArray(rawInput.data) && rawInput.data.length > 0) {
    rawItem = rawInput.data[0] as Record<string, unknown>;
  } else if (rawInput.item && typeof rawInput.item === "object") {
    rawItem = rawInput.item as Record<string, unknown>;
  }

  const extractedId = Number(
    rawItem.ankama_id ??
      rawItem.ankamaId ??
      rawItem.id ??
      rawItem.m_id ??
      rawItem._id ??
      0,
  );

  const known = SERVER_KNOWN_ITEMS[extractedId];

  const rawName = rawItem.name ?? rawItem.title;
  let spanishName = getLocalizedText(rawName, "");
  if (!spanishName || spanishName.startsWith("Objeto #")) {
    if (known && typeof known.name === "object" && known.name?.es) {
      spanishName = known.name.es;
    } else {
      spanishName = `Objeto #${extractedId}`;
    }
  }

  const rawType = (rawItem.type ?? {}) as Record<string, unknown>;
  const typeId = Number(
    rawItem.typeId ?? rawItem.type_id ?? rawType.id ?? rawType.ankamaId ?? known?.typeId ?? 0,
  );
  let typeName = getLocalizedText(
    rawType.name ?? rawItem.typeName ?? rawItem.type_name ?? "",
    "",
  );
  if (!typeName && known?.type?.name && typeof known.type.name === "object" && known.type.name.es) {
    typeName = known.type.name.es;
  }
  const superCategoryId = Number(
    rawType.superCategoryId ?? rawType.super_category_id ?? known?.type?.superCategoryId ?? 0,
  );

  const superTypeId = Number(
    rawItem.superTypeId ??
      rawItem.super_type_id ??
      rawType.superTypeId ??
      rawType.super_type_id ??
      (rawType.superType as any)?.id ??
      0,
  );

  const iconId = Number(rawItem.iconId ?? rawItem.icon_id ?? known?.iconId ?? 0);

  const possibleEffects = cleanEffects(rawItem.possibleEffects);
  const effects = cleanEffects(rawItem.effects);

  const rawCraftRatio =
    typeof rawItem.craftXpRatio === "number"
      ? rawItem.craftXpRatio
      : typeof (rawItem as any).craft_xp_ratio === "number"
        ? (rawItem as any).craft_xp_ratio
        : typeof rawType.craftXpRatio === "number"
          ? rawType.craftXpRatio
          : undefined;

  const normalizedCraftXpRatio =
    rawCraftRatio !== undefined && rawCraftRatio >= 0
      ? rawCraftRatio > 10
        ? rawCraftRatio / 100
        : rawCraftRatio
      : undefined;

  const cleanItem: DofusItem = {
    id: extractedId,
    level: Number(rawItem.level ?? known?.level ?? 1),
    typeId,
    iconId,
    superTypeId: superTypeId || undefined,
    exchangeable: rawItem.exchangeable !== false,
    usable: Boolean(rawItem.usable),
    name: {
      es: spanishName,
      fr: getLocalizedText(
        rawName && typeof rawName === "object"
          ? (rawName as Record<string, unknown>).fr
          : known?.name && typeof known.name === "object" ? known.name.fr : "",
        spanishName,
      ),
      en: getLocalizedText(
        rawName && typeof rawName === "object"
          ? (rawName as Record<string, unknown>).en
          : known?.name && typeof known.name === "object" ? known.name.en : "",
        spanishName,
      ),
    },
    type: {
      id: typeId,
      superCategoryId,
      superTypeId: superTypeId || undefined,
      name: { es: typeName, fr: typeName, en: typeName },
    },
    hasRecipe: Boolean(rawItem.hasRecipe || (rawItem as any).recipe || (rawItem as any).craft),
    isIngredient: Boolean((rawItem as any).isIngredient),
    price: typeof rawItem.price === "number" ? rawItem.price : undefined,
    ...(normalizedCraftXpRatio !== undefined ? { craftXpRatio: normalizedCraftXpRatio } : {}),
    ...(typeof rawItem.craftConditionalCriterion === "string" && rawItem.craftConditionalCriterion
      ? { craftConditionalCriterion: rawItem.craftConditionalCriterion }
      : typeof (rawItem as any).craft_conditional_criterion === "string" && (rawItem as any).craft_conditional_criterion
        ? { craftConditionalCriterion: (rawItem as any).craft_conditional_criterion }
        : {}),
    ...(typeof rawItem.craftVisibleCriterion === "string" && rawItem.craftVisibleCriterion
      ? { craftVisibleCriterion: rawItem.craftVisibleCriterion }
      : {}),
    ...(typeof rawItem.craftFeasibleCriterion === "string" && rawItem.craftFeasibleCriterion
      ? { craftFeasibleCriterion: rawItem.craftFeasibleCriterion }
      : {}),
    ...(possibleEffects ? { possibleEffects } : {}),
    ...(effects ? { effects } : {}),
  } as DofusItem;

  return cleanItem;
}

export function normalizeRecipe(
  rawRecipe: Record<string, unknown>,
): DofusRecipe | null {
  const resultId = Number(
    rawRecipe.resultId ?? rawRecipe.result_id ?? rawRecipe.id ?? 0,
  );
  if (!resultId) return null;
  const ingredientIds: number[] = [];
  const quantities: number[] = [];

  if (
    Array.isArray(rawRecipe.ingredientIds) &&
    Array.isArray(rawRecipe.quantities)
  ) {
    for (let index = 0; index < rawRecipe.ingredientIds.length; index += 1) {
      const ingredientId = Number(rawRecipe.ingredientIds[index]);
      if (!ingredientId) continue;
      ingredientIds.push(ingredientId);
      quantities.push(Number(rawRecipe.quantities[index]) || 1);
    }
  } else if (Array.isArray(rawRecipe.ingredients)) {
    for (const ingredient of rawRecipe.ingredients) {
      if (!ingredient || typeof ingredient !== "object") continue;
      const normalizedIngredient = ingredient as Record<string, unknown>;
      const ingredientId = Number(
        normalizedIngredient.id ??
          normalizedIngredient.item_id ??
          normalizedIngredient.itemId ??
          normalizedIngredient.ankama_id ??
          0,
      );
      if (!ingredientId) continue;
      ingredientIds.push(ingredientId);
      quantities.push(
        Number(
          normalizedIngredient.quantity ??
            normalizedIngredient.qty ??
            normalizedIngredient.amount ??
            1,
        ) || 1,
      );
    }
  }

  if (ingredientIds.length === 0) return null;
  const extractedJobId = Number(
    rawRecipe.jobId ??
      rawRecipe.job_id ??
      (rawRecipe.job as Record<string, unknown> | undefined)?.id ??
      0,
  );
  const craftXpRatio = typeof rawRecipe.craftXpRatio === "number"
    ? rawRecipe.craftXpRatio
    : typeof (rawRecipe.result as any)?.craftXpRatio === "number"
      ? (rawRecipe.result as any).craftXpRatio
      : undefined;
  const craftConditionalCriterion = typeof rawRecipe.craftConditionalCriterion === "string"
    ? rawRecipe.craftConditionalCriterion
    : typeof (rawRecipe.result as any)?.craftConditionalCriterion === "string"
      ? (rawRecipe.result as any).craftConditionalCriterion
      : undefined;

  return {
    id: Number(rawRecipe.id) || resultId,
    resultId,
    ingredientIds,
    quantities,
    jobId: extractedJobId > 0 ? extractedJobId : undefined,
    ...(craftXpRatio !== undefined ? { craftXpRatio } : {}),
    ...(craftConditionalCriterion ? { craftConditionalCriterion } : {}),
  };
}

export function getStaticItemById(itemId: number): DofusItem | null {
  if (!itemId || itemId <= 0) return null;

  const baseRune = DOFUS_BASE_RUNES.find((r) => r.id === itemId);
  if (baseRune) {
    return {
      id: baseRune.id,
      level: 1,
      typeId: 78,
      iconId: baseRune.iconId || 78000,
      name: {
        es: baseRune.name,
        fr: baseRune.nameFr || baseRune.name,
        en: baseRune.nameEn || baseRune.name,
      },
      type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
      hasRecipe: false,
    };
  }

  const craftable = CRAFTABLE_RUNES.find((r) => r.id === itemId);
  if (craftable) {
    return {
      id: craftable.id,
      level: craftable.level || 1,
      typeId: 78,
      iconId: craftable.iconId || 78000,
      name: {
        es: craftable.name.es,
        fr: craftable.name.fr,
        en: craftable.name.en,
      },
      type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
      hasRecipe: true,
    };
  }

  const preset = PRESET_CRAFTABLE_ITEMS.find((p) => p.id === itemId);
  if (preset) {
    return preset as DofusItem;
  }

  const known = SERVER_KNOWN_ITEMS[itemId];
  if (known && known.name?.es) {
    return normalizeSpanishItem(known as any);
  }

  return null;
}

export async function ensureRunesInDatabase(): Promise<void> {
  try {
    const allRuneItems: DofusItem[] = [];
    const allRuneRecipes: DofusRecipe[] = [];

    for (const baseRune of DOFUS_BASE_RUNES) {
      allRuneItems.push({
        id: baseRune.id,
        level: 1,
        typeId: 78,
        iconId: baseRune.iconId || 78000,
        name: {
          es: baseRune.name,
          fr: baseRune.nameFr || baseRune.name,
          en: baseRune.nameEn || baseRune.name,
        },
        type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
        hasRecipe: false,
      });
    }

    for (const craftable of CRAFTABLE_RUNES) {
      allRuneItems.push({
        id: craftable.id,
        level: craftable.level || 1,
        typeId: 78,
        iconId: craftable.iconId || 78000,
        name: {
          es: craftable.name.es,
          fr: craftable.name.fr,
          en: craftable.name.en,
        },
        type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
        hasRecipe: true,
      });
      if (craftable.recipeData) {
        allRuneRecipes.push(craftable.recipeData);
      }
    }

    for (const rune of ALL_DOFUS_RUNES) {
      if (!allRuneItems.some((i) => i.id === rune.id)) {
        allRuneItems.push({
          id: rune.id,
          level: rune.level || 1,
          typeId: 78,
          iconId: rune.iconId || 78000,
          name: {
            es: rune.name.es,
            fr: rune.name.fr,
            en: rune.name.en,
          },
          type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
          hasRecipe: false,
        });
      }
    }

    if (allRuneItems.length > 0) {
      await upsertItems(allRuneItems);
    }
    if (allRuneRecipes.length > 0) {
      await upsertRecipes(allRuneRecipes);
    }
  } catch (err) {
    console.warn("[Database] Error ensuring runes in database:", err);
  }
}

export async function syncItemStats(items: DofusItem[]): Promise<void> {
  const statements: Array<{ sql: string; args: any[] }> = [];
  const now = Date.now();
  const crushableItems = items.filter(
    (item) =>
      item &&
      item.id &&
      (item.type?.superCategoryId === 1 ||
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 81].includes(
          item.typeId || item.type?.id || 0,
        )),
  );
  if (crushableItems.length === 0) return;

  for (const item of crushableItems) {
    const stats = extractItemStats(item);
    if (!stats || stats.length === 0) continue;

    stats.forEach((st, idx) => {
      statements.push({
        sql: `INSERT OR REPLACE INTO item_stats (item_id, rune_id, stat_order, characteristic_id, effect_id, rune_name, rune_weight, stat_min, stat_max, stat_avg, formatted_text, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          item.id,
          st.rune.id,
          idx,
          Number((st.effect as any)?.characteristic ?? st.rune.characteristicId ?? 0),
          Number((st.effect as any)?.effectId ?? st.rune.effectIds[0] ?? 0),
          st.rune.name,
          st.rune.unitWeight,
          st.statMin,
          st.statMax,
          st.statAvg,
          st.formattedText,
          now,
        ],
      });
    });
  }

  for (let i = 0; i < statements.length; i += 250) {
    await database.batch(statements.slice(i, i + 250), "write");
  }
}

export async function upsertItems(items: DofusItem[]): Promise<void> {
  const filtered = items.filter((item) => item && item.id > 0);
  if (filtered.length === 0) return;
  const now = Date.now();
  const statements = filtered.map((item) => ({
    sql: `INSERT INTO items (id, level, type_id, super_category_id, icon_id, name_es, has_recipe, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET level = excluded.level, type_id = excluded.type_id, super_category_id = excluded.super_category_id, icon_id = excluded.icon_id, name_es = excluded.name_es, has_recipe = excluded.has_recipe, payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    args: [
      item.id,
      item.level || 1,
      item.typeId || item.type?.id || 0,
      item.type?.superCategoryId || 0,
      item.iconId || 0,
      item.name?.es || "",
      item.hasRecipe ? 1 : 0,
      JSON.stringify(item),
      now,
    ],
  }));
  for (let i = 0; i < statements.length; i += 250)
    await database.batch(statements.slice(i, i + 250), "write");

  await syncItemStats(filtered);
}

export async function replaceAllItems(items: DofusItem[]): Promise<void> {
  const filtered = items.filter((item) => item && item.id > 0 && !isOmittedItem(item as any));
  await database.execute("DELETE FROM items");
  await database.execute("DELETE FROM item_stats");
  await upsertItems(filtered);
}

export async function updateRecipeIngredients(recipes: DofusRecipe[]): Promise<void> {
  const statements = [];
  for (const recipe of recipes) {
    if (!recipe.ingredientIds || !recipe.quantities) continue;
    for (let i = 0; i < recipe.ingredientIds.length; i += 1) {
      const ingId = recipe.ingredientIds[i];
      const qty = recipe.quantities[i] || 1;
      if (!ingId) continue;
      statements.push({
        sql: `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?) ON CONFLICT(recipe_id, ingredient_id) DO UPDATE SET quantity = excluded.quantity`,
        args: [recipe.resultId, ingId, qty],
      });
    }
  }
  for (let i = 0; i < statements.length; i += 250) {
    await database.batch(statements.slice(i, i + 250), "write");
  }
}

export async function upsertRecipes(recipes: DofusRecipe[]): Promise<void> {
  const now = Date.now();
  const statements = recipes.map((recipe) => ({
    sql: `INSERT INTO recipes (result_id, job_id, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(result_id) DO UPDATE SET job_id = excluded.job_id, payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    args: [recipe.resultId, recipe.jobId ?? null, JSON.stringify(recipe), now],
  }));
  for (let i = 0; i < statements.length; i += 250)
    await database.batch(statements.slice(i, i + 250), "write");

  await updateRecipeIngredients(recipes);

  const resultIds = recipes.map((r) => r.resultId).filter(Boolean);
  if (resultIds.length > 0) {
    for (let i = 0; i < resultIds.length; i += 250) {
      const chunk = resultIds.slice(i, i + 250);
      const placeholders = chunk.map(() => "?").join(",");
      await database.execute({
        sql: `UPDATE items SET has_recipe = 1 WHERE id IN (${placeholders})`,
        args: chunk,
      });
    }
  }
}

export async function replaceAllRecipes(recipes: DofusRecipe[]): Promise<void> {
  await database.execute("DELETE FROM recipes");
  await database.execute("DELETE FROM recipe_ingredients");
  await upsertRecipes(recipes);
  await database.execute("UPDATE items SET has_recipe = 0 WHERE id NOT IN (SELECT result_id FROM recipes)");
}

export async function getItemStatsFromDb(itemId: number) {
  const result = await database.execute({
    sql: "SELECT rune_id, stat_order, characteristic_id, effect_id, rune_name, rune_weight, stat_min, stat_max, stat_avg, formatted_text FROM item_stats WHERE item_id = ? ORDER BY stat_order ASC",
    args: [itemId],
  });
  return result.rows.map((row) => ({
    runeId: Number(row.rune_id),
    statOrder: Number(row.stat_order),
    characteristicId: Number(row.characteristic_id),
    effectId: Number(row.effect_id),
    runeName: String(row.rune_name),
    runeWeight: Number(row.rune_weight),
    statMin: Number(row.stat_min),
    statMax: Number(row.stat_max),
    statAvg: Number(row.stat_avg),
    formattedText: String(row.formatted_text),
  }));
}

export async function getStoredItemById(itemId: number) {
  const result = await database.execute({
    sql: "SELECT payload_json FROM items WHERE id = ?",
    args: [itemId],
  });
  return result.rows[0]
    ? parseJsonValue<DofusItem>(result.rows[0].payload_json as string)
    : null;
}

export async function getOrFetchItemById(itemId: number) {
  const stored = await getStoredItemById(itemId);
  if (stored && stored.name?.es && !stored.name.es.startsWith("Objeto #") && !stored.name.es.startsWith("Item #"))
    return stored;

  const staticItem = getStaticItemById(itemId);
  if (staticItem && staticItem.name?.es && !staticItem.name.es.startsWith("Objeto #")) {
    await upsertItems([staticItem]);
    return staticItem;
  }

  try {
    const queryRes = await fetchJson<{ data?: Record<string, unknown>[] }>(
      `${DOFUS_API_BASE}/items?id=${itemId}&lang=es`,
    );
    if (queryRes.data && queryRes.data.length > 0) {
      const normalized = normalizeSpanishItem(queryRes.data[0]);
      if (
        normalized.id === itemId &&
        normalized.name?.es &&
        !normalized.name.es.startsWith("Objeto #")
      ) {
        await upsertItems([normalized]);
        return normalized;
      }
    }
  } catch (e) {
    console.warn(`Error al consultar item remoto ${itemId}:`, e);
  }

  if (SERVER_KNOWN_ITEMS[itemId]) {
    const known = normalizeSpanishItem(SERVER_KNOWN_ITEMS[itemId] as any);
    await upsertItems([known]);
    return known;
  }

  return stored;
}

export async function getStoredRecipeByResultId(resultId: number) {
  const result = await database.execute({
    sql: "SELECT payload_json FROM recipes WHERE result_id = ?",
    args: [resultId],
  });
  return result.rows[0]
    ? parseJsonValue<DofusRecipe>(result.rows[0].payload_json as string)
    : null;
}

export async function getOrFetchRecipeByResultId(resultId: number) {
  const stored = await getStoredRecipeByResultId(resultId);
  if (stored) return stored;

  try {
    const itemCheck = await database.execute({
      sql: "SELECT has_recipe FROM items WHERE id = ?",
      args: [resultId],
    });
    if (itemCheck.rows.length > 0 && Number(itemCheck.rows[0].has_recipe) === 0) {
      return null;
    }
  } catch {
    // Ignore if table or column missing
  }

  try {
    const res = await fetchJson<{ data?: Record<string, unknown>[] }>(
      `${DOFUS_API_BASE}/recipes?resultId=${resultId}`,
    );
    if (res.data && res.data.length > 0) {
      const normalized = normalizeRecipe(res.data[0]);
      if (normalized && normalized.resultId === resultId) {
        await upsertRecipes([normalized]);
        return normalized;
      }
    }
  } catch (e) {
    console.warn(`Error al consultar receta remota para objeto ${resultId}:`, e);
  }

  return stored;
}

export async function resolveMissingNames(itemIds: number[]) {
  if (!itemIds || itemIds.length === 0) return [];
  const uniqueIds = Array.from(new Set(itemIds)).filter((id) => Number(id) > 0);
  const resolved: DofusItem[] = [];
  const chunkSize = 15;

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((id) => getOrFetchItemById(id)),
    );
    for (const res of results) {
      if (res.status === "fulfilled" && res.value && res.value.name?.es && !res.value.name.es.startsWith("Objeto #")) {
        resolved.push(res.value);
      }
    }
  }

  if (resolved.length > 0) {
    invalidateServerBootstrapCache();
  }

  return resolved;
}

export async function getAllItems(): Promise<DofusItem[]> {
  const result = await database.execute(
    "SELECT payload_json FROM items ORDER BY name_es COLLATE NOCASE ASC, id ASC",
  );
  return result.rows
    .map((row) => parseJsonValue<DofusItem>(row.payload_json as string))
    .filter((item) => item && item.id > 0 && !isOmittedItem(item as any));
}

export async function getAllRecipes(): Promise<Record<number, DofusRecipe>> {
  const result = await database.execute(
    "SELECT payload_json FROM recipes ORDER BY result_id ASC",
  );
  const recipes: Record<number, DofusRecipe> = {};
  for (const row of result.rows) {
    const recipe = parseJsonValue<DofusRecipe>(row.payload_json as string);
    recipes[recipe.resultId] = recipe;
  }
  return recipes;
}

export async function getItemsDictionary(): Promise<Record<string, string>> {
  const dict = { ...buildItemsDictionary() };
  try {
    const result = await database.execute("SELECT id, name_es FROM items WHERE name_es != '' LIMIT 30000");
    if (result && Array.isArray(result.rows)) {
      for (const row of result.rows) {
        const id = String(row.id);
        const name = String(row.name_es || "").trim();
        if (name && !name.startsWith("Objeto #") && !name.startsWith("Item #")) {
          dict[id] = name;
        }
      }
    }
  } catch (err) {
    // Safe fallback if DB is not initialized
  }
  return dict;
}

export async function getItemsCatalog(): Promise<{
  items: Record<string, string>;
  equipmentIds: number[];
}> {
  const dict = await getItemsDictionary();
  const eqIds: number[] = [];
  try {
    const result = await database.execute("SELECT id, type_id FROM items LIMIT 30000");
    if (result && Array.isArray(result.rows)) {
      for (const row of result.rows) {
        const id = Number(row.id);
        const typeId = Number(row.type_id);
        if (id > 0 && DOFUS_EQUIPMENT_TYPE_IDS.has(typeId)) {
          eqIds.push(id);
        }
      }
    }
  } catch (err) {
    // Safe fallback
  }
  return {
    items: dict,
    equipmentIds: eqIds,
  };
}

export async function searchAndStoreItems(searchTerm: string) {
  const term = searchTerm.trim();
  if (!term || term.length < 2) return await getAllItems();
  const params = new URLSearchParams({ $limit: "40", lang: "es" });
  if (!Number.isNaN(Number(term))) params.append("id", term);
  else params.append("name[$like]", term);
  const res = await fetchJson<{ data?: Record<string, unknown>[] }>(
    `${DOFUS_API_BASE}/items?${params.toString()}`,
  );
  const items = (res.data ?? [])
    .map(normalizeSpanishItem)
    .filter((i) => i.id && !isOmittedItem(i));
  if (items.length > 0) await upsertItems(items);
  return await getAllItems();
}

export async function fetchAndStoreCategoryItems(typeIds: number[]) {
  if (typeIds.length === 0) return await getAllItems();
  const params = new URLSearchParams({ $limit: "100", lang: "es" });
  for (const tid of typeIds) params.append("typeId[$in]", String(tid));
  const res = await fetchJson<{ data?: Record<string, unknown>[] }>(
    `${DOFUS_API_BASE}/items?${params.toString()}`,
  );
  const items = (res.data ?? [])
    .map(normalizeSpanishItem)
    .filter((i) => i.id && !isOmittedItem(i));
  if (items.length > 0) await upsertItems(items);
  return await getAllItems();
}

export async function seedStepInit(): Promise<{ totalItems: number; totalRecipes: number; itemChunks: number; recipeChunks: number }> {
  invalidateServerBootstrapCache();
  const seedData = getDofusDbSeedData();
  const totalItems = seedData.items?.length || 0;
  const totalRecipes = seedData.recipes?.length || 0;
  const chunkSize = 400;

  await database.execute("DELETE FROM items");
  await database.execute("DELETE FROM item_stats");
  await database.execute("DELETE FROM recipes");
  await database.execute("DELETE FROM recipe_ingredients");

  const status: SyncStatus = {
    ...getDefaultSyncStatus(),
    isLoading: true,
    progressPercent: 5,
    currentStep: "Iniciando siembra de base de datos en Turso...",
    progressMessage: `Preparando carga de ${totalItems.toLocaleString()} objetos y ${totalRecipes.toLocaleString()} recetas...`,
    totalSteps: 4,
    currentStepIndex: 1,
  };
  await setSyncStatus(status);

  return {
    totalItems,
    totalRecipes,
    itemChunks: Math.ceil(totalItems / chunkSize),
    recipeChunks: Math.ceil(totalRecipes / chunkSize),
  };
}

export async function seedStepItems(chunkIndex: number, chunkSize = 400): Promise<{ chunkIndex: number; processed: number; totalItems: number }> {
  const seedData = getDofusDbSeedData();
  const allItems = (seedData.items || []).filter((i) => !isOmittedItem(i as any));
  const start = chunkIndex * chunkSize;
  const chunk = allItems.slice(start, start + chunkSize);

  if (chunk.length > 0) {
    await upsertItems(chunk);
  }

  return {
    chunkIndex,
    processed: Math.min(start + chunk.length, allItems.length),
    totalItems: allItems.length,
  };
}

export async function seedStepRecipes(chunkIndex: number, chunkSize = 400): Promise<{ chunkIndex: number; processed: number; totalRecipes: number }> {
  const seedData = getDofusDbSeedData();
  const allRecipes = seedData.recipes || [];
  const start = chunkIndex * chunkSize;
  const chunk = allRecipes.slice(start, start + chunkSize);

  if (chunk.length > 0) {
    await upsertRecipes(chunk);
  }

  return {
    chunkIndex,
    processed: Math.min(start + chunk.length, allRecipes.length),
    totalRecipes: allRecipes.length,
  };
}

export async function seedStepFinalize(): Promise<BootstrapData> {
  const seedData = getDofusDbSeedData();
  const items = seedData.items || [];
  const recipes = seedData.recipes || [];

  let equipablesCount = 0;
  let consumablesCount = 0;
  let resourcesCount = 0;

  for (const item of items) {
    const superCategoryId = item.type?.superCategoryId ?? 0;
    const typeId = item.typeId || item.type?.id || 0;

    if (
      superCategoryId === 1 ||
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 81].includes(typeId)
    ) {
      equipablesCount += 1;
    } else if ([33, 37, 38, 42, 43, 68, 69, 104, 219].includes(typeId)) {
      consumablesCount += 1;
    } else {
      resourcesCount += 1;
    }
  }

  await database.execute("UPDATE items SET has_recipe = 1 WHERE id IN (SELECT result_id FROM recipes)");

  const status: SyncStatus = {
    lastSyncTimestamp: seedData.exportedAt || Date.now(),
    totalImported: items.length,
    recipesCount: recipes.length,
    equipablesCount,
    consumablesCount,
    resourcesCount,
    cosmeticsOmittedCount: 11986,
    isLoading: false,
    progressMessage: `Base de datos en Turso poblada con éxito (${items.length.toLocaleString()} objetos y ${recipes.length.toLocaleString()} recetas).`,
    progressPercent: 100,
    currentStep: "Completado",
    totalSteps: 4,
    currentStepIndex: 4,
  };

  await setSyncStatus(status);
  await ensureDefaultPriceProfile();
  invalidateServerBootstrapCache();

  return await buildBootstrapData();
}

export async function importChunkInit(): Promise<void> {
  invalidateServerBootstrapCache();
  await database.execute("DELETE FROM items");
  await database.execute("DELETE FROM item_stats");
  await database.execute("DELETE FROM recipes");
  await database.execute("DELETE FROM recipe_ingredients");
  const status: SyncStatus = {
    ...getDefaultSyncStatus(),
    isLoading: true,
    progressPercent: 5,
    currentStep: "Iniciando importación desde DofusDB...",
    progressMessage: "Limpiando base previa en Turso...",
  };
  await setSyncStatus(status);
}

export async function importChunkItems(items: DofusItem[]): Promise<{ count: number }> {
  if (items && items.length > 0) {
    const validItems = items
      .map((i) => normalizeSpanishItem(i as any))
      .filter((i) => i.id > 0 && !isOmittedItem(i as any));
    if (validItems.length > 0) {
      await upsertItems(validItems);
    }
    return { count: validItems.length };
  }
  return { count: 0 };
}

export async function importChunkRecipes(recipes: DofusRecipe[]): Promise<{ count: number }> {
  if (recipes && recipes.length > 0) {
    const validRecipes: DofusRecipe[] = [];
    for (const r of recipes) {
      const norm = normalizeRecipe(r as any);
      if (norm) validRecipes.push(norm);
    }
    if (validRecipes.length > 0) {
      await upsertRecipes(validRecipes);
    }
  }
  return { count: recipes?.length || 0 };
}

export async function importChunkFinalize(): Promise<BootstrapData> {
  await database.execute("UPDATE items SET has_recipe = 1 WHERE id IN (SELECT result_id FROM recipes)");
  
  const countItemsRes = await database.execute("SELECT COUNT(*) as cnt FROM items");
  const countRecipesRes = await database.execute("SELECT COUNT(*) as cnt FROM recipes");
  const totalItems = Number(countItemsRes.rows[0]?.cnt ?? 0);
  const totalRecipes = Number(countRecipesRes.rows[0]?.cnt ?? 0);

  const status: SyncStatus = {
    lastSyncTimestamp: Date.now(),
    totalImported: totalItems,
    recipesCount: totalRecipes,
    equipablesCount: 0,
    consumablesCount: 0,
    resourcesCount: 0,
    cosmeticsOmittedCount: 0,
    isLoading: false,
    progressMessage: `Importación en vivo finalizada con éxito (${totalItems.toLocaleString()} objetos y ${totalRecipes.toLocaleString()} recetas).`,
    progressPercent: 100,
    currentStep: "Completado",
  };
  await setSyncStatus(status);
  await ensureDefaultPriceProfile();
  invalidateServerBootstrapCache();
  return await buildBootstrapData();
}

export async function seedDatabaseFromBundle(force = false): Promise<BootstrapData> {
  const countRes = await database.execute("SELECT COUNT(*) as cnt FROM items");
  const itemsCount = Number(countRes.rows[0]?.cnt ?? 0);
  if (itemsCount > 100 && !force) {
    return buildBootstrapData();
  }

  console.log("[Database] Seeding database from bundled Dofus dataset...");
  const seedData = getDofusDbSeedData();

  if (seedData && Array.isArray(seedData.items) && seedData.items.length > 0) {
    const items = seedData.items;
    const recipes = Array.isArray(seedData.recipes) ? seedData.recipes : [];

    await replaceAllItems(items);
    await replaceAllRecipes(recipes);

    let equipablesCount = 0;
    let consumablesCount = 0;
    let resourcesCount = 0;

    for (const item of items) {
      const superCategoryId = item.type?.superCategoryId ?? 0;
      const typeId = item.typeId || item.type?.id || 0;

      if (
        superCategoryId === 1 ||
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 81].includes(typeId)
      ) {
        equipablesCount += 1;
      } else if ([33, 37, 38, 42, 43, 68, 69, 104, 219].includes(typeId)) {
        consumablesCount += 1;
      } else {
        resourcesCount += 1;
      }
    }

    const status: SyncStatus = {
      lastSyncTimestamp: seedData.exportedAt || Date.now(),
      totalImported: items.length,
      recipesCount: recipes.length,
      equipablesCount,
      consumablesCount,
      resourcesCount,
      cosmeticsOmittedCount: 11986,
      isLoading: false,
      progressMessage: `Base de datos sincronizada con éxito (${items.length.toLocaleString()} objetos y ${recipes.length.toLocaleString()} recetas).`,
      progressPercent: 100,
      currentStep: "Completado",
      totalSteps: 3,
      currentStepIndex: 3,
    };
    await setSyncStatus(status);
    await ensureDefaultPriceProfile();
    invalidateServerBootstrapCache();
    console.log(`[Database] Seeding complete: ${items.length} items, ${recipes.length} recipes persisted.`);
  }

  return buildBootstrapData();
}

import { DofusItem, DofusRecipe } from "../../types";
import {
  getJobForItem,
  isClassItem,
  isCosmeticItem,
  isCrushableJob,
  isDofusItem,
  isOmittedItem,
  isPetItem,
  isQuestOrZeroXpCraft,
} from "../../data/dofusJobs";
import { ALL_PRESET_ITEMS, presetItemMap } from "./constants";
import { STATIC_ITEMS_DICT } from "../../data/staticItemsDict";
import { ALL_DOFUS_RUNES_DICT } from "../../data/dofusAllRunesDict";
import { SUPPLEMENTARY_ITEMS_DICT } from "../../data/supplementaryItemsDict";
import { extractItemStats } from "../../data/dofusRuneWeights";
import { CraftableItem } from "./types";
import {
  getCachedCraftableSnapshot,
  getCachedCrushableSnapshot,
  getIsDbInitialized,
  getRecipesCache,
  setCachedCraftableSnapshot,
  setCachedCrushableSnapshot,
} from "./store";
import { getImportedItems } from "./items";

let initDbTrigger: (() => Promise<unknown>) | null = null;
export function setCraftSnapshotsInitDbTrigger(fn: () => Promise<unknown>): void {
  initDbTrigger = fn;
}

function ensureInitialized(): void {
  if (!getIsDbInitialized() && initDbTrigger) {
    void initDbTrigger();
  }
}

export function getCraftableItemsSnapshot(): CraftableItem[] {
  const importedItems = getImportedItems();
  if (importedItems.length === 0) {
    return ALL_PRESET_ITEMS;
  }

  const cachedCraftableSnapshot = getCachedCraftableSnapshot();
  if (
    cachedCraftableSnapshot &&
    cachedCraftableSnapshot.length > ALL_PRESET_ITEMS.length
  ) {
    return cachedCraftableSnapshot;
  }

  ensureInitialized();
  const storedRecipes = getRecipesCache();
  const importedMap = new Map<number, DofusItem>();
  importedItems.forEach((item) => importedMap.set(item.id, item));

  const resultList: CraftableItem[] = [];
  const processedResultIds = new Set<number>();

  for (const [resultIdStr, recipe] of Object.entries(storedRecipes)) {
    const resultId = Number(resultIdStr);
    if (!resultId || !recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
      continue;
    }

    processedResultIds.add(resultId);
    const existingItem = importedMap.get(resultId);
    const presetItem = presetItemMap.get(resultId);
    const itemToUse = existingItem || presetItem;

    if (itemToUse && (isCosmeticItem(itemToUse as any) || isDofusItem(itemToUse as any) || isClassItem(itemToUse as any) || isOmittedItem(itemToUse as any) || isQuestOrZeroXpCraft(itemToUse as any, recipe))) {
      continue;
    }

    const job = getJobForItem(itemToUse || { id: resultId, typeId: 0 }, recipe);
    if (job.jobId === 0) {
      continue;
    }

    if (itemToUse) {
      const mergedEffects = [
        ...(itemToUse.effects && itemToUse.effects.length > 0 ? itemToUse.effects : []),
        ...(itemToUse.possibleEffects && itemToUse.possibleEffects.length > 0 ? itemToUse.possibleEffects : []),
        ...(presetItem?.effects || []),
        ...(presetItem?.possibleEffects || []),
      ];

      resultList.push({
        ...itemToUse,
        possibleEffects: mergedEffects.length > 0 ? mergedEffects : (presetItem?.possibleEffects || presetItem?.effects || []),
        effects: mergedEffects.length > 0 ? mergedEffects : (presetItem?.effects || presetItem?.possibleEffects || []),
        jobId: job.jobId,
        jobNameEs: job.jobNameEs,
        defaultMarketSalePrice: itemToUse.price || presetItem?.defaultMarketSalePrice || 0,
        recipeData: recipe,
      });
      continue;
    }

    const sId = String(resultId);
    const knownName =
      STATIC_ITEMS_DICT[sId] ||
      ALL_DOFUS_RUNES_DICT[sId] ||
      SUPPLEMENTARY_ITEMS_DICT[sId] ||
      "";
    const resolvedName = knownName || `Objeto #${resultId}`;

    if (
      isClassItem({ id: resultId, name: resolvedName }) ||
      isOmittedItem({ id: resultId, name: resolvedName }) ||
      isQuestOrZeroXpCraft({ id: resultId, name: resolvedName }, recipe)
    ) {
      continue;
    }

    resultList.push({
      id: resultId,
      level: 1,
      name: {
        es: resolvedName,
        fr: resolvedName,
        en: resolvedName,
      },
      typeId: 0,
      iconId: resultId,
      jobId: job.jobId,
      jobNameEs: job.jobNameEs,
      defaultMarketSalePrice: 0,
      recipeData: recipe,
    });
  }

  for (const item of importedItems) {
    if (processedResultIds.has(item.id) || isOmittedItem(item) || isDofusItem(item) || isQuestOrZeroXpCraft(item)) {
      continue;
    }

    const rawRecipe =
      (
        item as DofusItem & {
          recipe?: DofusRecipe;
          craft?: DofusRecipe;
          recipes?: DofusRecipe[] | DofusRecipe;
        }
      ).recipe ??
      (item as DofusItem & { craft?: DofusRecipe }).craft ??
      (Array.isArray((item as DofusItem & { recipes?: DofusRecipe[] }).recipes)
        ? (item as DofusItem & { recipes?: DofusRecipe[] }).recipes?.[0]
        : (item as DofusItem & { recipes?: DofusRecipe }).recipes);

    if (!rawRecipe) {
      continue;
    }

    processedResultIds.add(item.id);
    const job = getJobForItem(item, rawRecipe);
    if (job.jobId === 0) {
      continue;
    }

    const presetItem = presetItemMap.get(item.id);
    const mergedEffects = [
      ...(item.effects && item.effects.length > 0 ? item.effects : []),
      ...(item.possibleEffects && item.possibleEffects.length > 0 ? item.possibleEffects : []),
      ...(presetItem?.effects || []),
      ...(presetItem?.possibleEffects || []),
    ];

    resultList.push({
      ...item,
      possibleEffects: mergedEffects.length > 0 ? mergedEffects : (presetItem?.possibleEffects || presetItem?.effects || []),
      effects: mergedEffects.length > 0 ? mergedEffects : (presetItem?.effects || presetItem?.possibleEffects || []),
      jobId: job.jobId,
      jobNameEs: job.jobNameEs,
      defaultMarketSalePrice: item.price || presetItem?.defaultMarketSalePrice || 0,
      recipeData: rawRecipe,
    });
  }

  for (const preset of ALL_PRESET_ITEMS) {
    if (processedResultIds.has(preset.id)) {
      continue;
    }

    const job = getJobForItem(preset, preset.recipeData);
    resultList.push({
      ...preset,
      jobId: job.jobId,
      jobNameEs: job.jobNameEs,
    });
  }

  setCachedCraftableSnapshot(resultList);
  return resultList;
}

export function getCrushableItemsSnapshot(): CraftableItem[] {
  const cachedCrushable = getCachedCrushableSnapshot();
  if (cachedCrushable) {
    return cachedCrushable;
  }

  const allCraftable = getCraftableItemsSnapshot();
  const crushables = allCraftable.filter((item) => {
    if (isOmittedItem(item) || isClassItem(item) || isPetItem(item)) return false;
    if (!isCrushableJob(item.jobId)) return false;
    const stats = extractItemStats(item);
    return stats.length > 0;
  });

  setCachedCrushableSnapshot(crushables);
  return crushables;
}

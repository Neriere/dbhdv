import {
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  RecipeTreeNode,
} from "../../types";
import { KNOWN_SPECIAL_INGREDIENTS } from "./constants";
import { calculateItemCrushing } from "../../data/dofusRuneWeights";
import { getOptimizedIngredientCost, isBycResource } from "../bycCostService";
import { CraftableItem, CraftStrategyMode } from "./types";
import {
  getActivePriceProfileIdCache,
  getCraftCostMemo,
  getIngredientToRecipesIndex,
  getIsDbInitialized,
  getLowestDetectedPriceMemo,
  getPricesCache,
  getRecipesCache,
  getRecipeTreeMapCache,
  LOCAL_DB_API_BASE,
  rebuildIngredientReverseIndex,
  requestJson,
  updateMemoryCache,
} from "./store";
import { fetchItemDetailsById } from "./items";
import { getStoredMarketPrices } from "./prices";
import { getCraftableItemsSnapshot } from "./craftSnapshots";

export * from "./craftSnapshots";

let initDbTrigger: (() => Promise<unknown>) | null = null;
export function setRecipesInitDbTrigger(fn: () => Promise<unknown>): void {
  initDbTrigger = fn;
}

function ensureInitialized(): void {
  if (!getIsDbInitialized() && initDbTrigger) {
    void initDbTrigger();
  }
}

export function getStoredRecipes(): Record<number, DofusRecipe> {
  ensureInitialized();
  return getRecipesCache();
}

export function getRecipeByResultId(resultId: number): DofusRecipe | undefined {
  return getRecipesCache()[resultId];
}

export async function fetchRecipeByResultId(
  resultId: number,
): Promise<DofusRecipe | null> {
  const recipesCache = getRecipesCache();
  if (recipesCache[resultId]) {
    return recipesCache[resultId];
  }

  try {
    const recipe = await requestJson<DofusRecipe>(
      `${LOCAL_DB_API_BASE}/recipes/${resultId}`,
    );
    if (recipe) {
      updateMemoryCache({
        recipes: { ...recipesCache, [resultId]: recipe },
      });
      return recipe;
    }
    return null;
  } catch {
    return null;
  }
}

export function calculateSubCraftCost(
  itemId: number,
  marketPrices: MarketPriceMap = getStoredMarketPrices(),
  recipes: Record<number, DofusRecipe> = getStoredRecipes(),
  visited: Set<number> = new Set(),
): number {
  if (visited.has(itemId)) {
    return marketPrices[itemId] || 0;
  }

  const recipe = recipes[itemId];
  if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
    return 0;
  }

  visited.add(itemId);
  let subCraftCost = 0;
  let hasCalculableCost = false;

  for (let i = 0; i < recipe.ingredientIds.length; i++) {
    const ingId = recipe.ingredientIds[i];
    const qty = recipe.quantities?.[i] || 1;
    const directPrice = marketPrices[ingId] || 0;
    const childCraftCost = calculateSubCraftCost(
      ingId,
      marketPrices,
      recipes,
      new Set(visited),
    );

    let bestPrice = directPrice;
    if (childCraftCost > 0 && directPrice > 0) {
      bestPrice = Math.min(directPrice, childCraftCost);
    } else if (childCraftCost > 0) {
      bestPrice = childCraftCost;
    }

    if (bestPrice > 0) {
      hasCalculableCost = true;
      subCraftCost += bestPrice * qty;
    }
  }

  return hasCalculableCost && subCraftCost > 0 ? subCraftCost : 0;
}

export function getLowestDetectedPrice(
  itemId: number,
  marketPrices: MarketPriceMap = getStoredMarketPrices(),
  recipes: Record<number, DofusRecipe> = getStoredRecipes(),
  visited: Set<number> = new Set()
): number {
  const lowestDetectedPriceMemo = getLowestDetectedPriceMemo();
  const pricesCache = getPricesCache();
  const recipesCache = getRecipesCache();

  const isDefaultContext =
    visited.size === 0 &&
    (marketPrices === pricesCache || !marketPrices) &&
    (recipes === recipesCache || !recipes);

  if (isDefaultContext) {
    const cached = lowestDetectedPriceMemo.get(itemId);
    if (cached !== undefined) {
      return cached;
    }
  }

  const directBuyPrice = marketPrices[itemId] || 0;
  if (visited.has(itemId)) {
    return directBuyPrice;
  }

  const recipe = recipes[itemId];
  if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
    if (isDefaultContext) lowestDetectedPriceMemo.set(itemId, directBuyPrice);
    return directBuyPrice;
  }

  visited.add(itemId);
  const subCraftCost = calculateSubCraftCost(
    itemId,
    marketPrices,
    recipes,
    new Set(visited),
  );

  let finalLowest = directBuyPrice;
  if (directBuyPrice > 0 && subCraftCost > 0) {
    finalLowest = Math.min(directBuyPrice, subCraftCost);
  } else if (subCraftCost > 0) {
    finalLowest = subCraftCost;
  }

  if (isDefaultContext) {
    lowestDetectedPriceMemo.set(itemId, finalLowest);
  }

  return finalLowest;
}

export function calculateItemCraftCost(itemId: number): number {
  const craftCostMemo = getCraftCostMemo();
  const cached = craftCostMemo.get(itemId);
  if (cached !== undefined) {
    return cached;
  }

  const recipes = getRecipesCache();
  const prices = getPricesCache();
  const recipe = recipes[itemId];
  if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
    craftCostMemo.set(itemId, 0);
    return 0;
  }

  let total = 0;
  for (let i = 0; i < recipe.ingredientIds.length; i++) {
    const ingId = recipe.ingredientIds[i];
    const qty = recipe.quantities?.[i] || 1;
    const ingPrice = getLowestDetectedPrice(ingId, prices, recipes);
    total += ingPrice * qty;
  }

  craftCostMemo.set(itemId, total);
  return total;
}

export function calculateEstimatedRunesValue(item: DofusItem): number {
  try {
    const crushing = calculateItemCrushing(item, 100, null, getPricesCache(), 0);
    return crushing.bestFocusOption?.totalKamasValue || crushing.totalKamasValue || 0;
  } catch {
    return 0;
  }
}

export function getRecipesUsingIngredient(ingredientId: number): CraftableItem[] {
  const ingredientToRecipesIndex = getIngredientToRecipesIndex();
  if (ingredientToRecipesIndex.size === 0) {
    rebuildIngredientReverseIndex();
  }
  const resultIds = ingredientToRecipesIndex.get(ingredientId);
  if (!resultIds || resultIds.size === 0) return [];

  const allCraftable = getCraftableItemsSnapshot();
  const resultMap = new Map<number, CraftableItem>();
  for (const item of allCraftable) {
    if (resultIds.has(item.id)) {
      resultMap.set(item.id, item);
    }
  }
  return Array.from(resultMap.values());
}

export async function buildRecipeTree(
  itemId: number,
  quantityNeeded: number = 1,
  currentDepth: number = 0,
  maxDepth: number = 3,
  visitedIds: Set<number> = new Set(),
  marketPrices: MarketPriceMap = getStoredMarketPrices(),
): Promise<RecipeTreeNode | null> {
  if (visitedIds.has(itemId) || currentDepth > maxDepth) {
    return null;
  }

  const recipeTreeMapCache = getRecipeTreeMapCache();
  const activeProfileId = getActivePriceProfileIdCache();
  const cacheKey = currentDepth === 0 ? `${itemId}_${quantityNeeded}_${maxDepth}_${activeProfileId}` : null;
  if (cacheKey && recipeTreeMapCache.has(cacheKey)) {
    return JSON.parse(JSON.stringify(recipeTreeMapCache.get(cacheKey)!));
  }

  const item = await fetchItemDetailsById(itemId);
  if (!item) {
    return null;
  }

  const isCraftableByFlag = item.hasRecipe;
  let recipe: DofusRecipe | null = null;
  if (isCraftableByFlag !== false) {
    recipe = await fetchRecipeByResultId(itemId);
  }

  const isCraftable = !!recipe && recipe.ingredientIds.length > 0;
  const currentPrice = marketPrices[itemId] || item.price || 0;

  const node: RecipeTreeNode = {
    itemId,
    quantity: quantityNeeded,
    item,
    recipe: recipe || undefined,
    subIngredients: undefined,
    isCraftable,
    marketPrice: currentPrice,
    decision: isCraftable ? "craft" : "buy",
  };

  if (!isCraftable || !recipe) {
    if (cacheKey) {
      recipeTreeMapCache.set(cacheKey, JSON.parse(JSON.stringify(node)));
    }
    return node;
  }

  visitedIds.add(itemId);
  const subIngredients: RecipeTreeNode[] = [];

  for (let index = 0; index < recipe.ingredientIds.length; index += 1) {
    const ingredientId = recipe.ingredientIds[index];
    const ingredientQuantity = (recipe.quantities[index] || 1) * quantityNeeded;

    const childNode = await buildRecipeTree(
      ingredientId,
      ingredientQuantity,
      currentDepth + 1,
      maxDepth,
      new Set(visitedIds),
      marketPrices,
    );

    if (childNode) {
      subIngredients.push(childNode);
      continue;
    }

    const fallbackItem = await fetchItemDetailsById(ingredientId);
    const knownFallback = KNOWN_SPECIAL_INGREDIENTS[ingredientId];
    subIngredients.push({
      itemId: ingredientId,
      quantity: ingredientQuantity,
      item: fallbackItem || {
        id: ingredientId,
        name: {
          es:
            (typeof knownFallback?.name === "object"
              ? knownFallback?.name?.es
              : (knownFallback?.name as string)) ||
            `Ingrediente #${ingredientId}`,
        },
        level: knownFallback?.level || 1,
        typeId: knownFallback?.typeId || 0,
        iconId: knownFallback?.iconId || ingredientId,
      },
      isCraftable: false,
      marketPrice: marketPrices[ingredientId] || 0,
      decision: "buy",
    });
  }

  node.subIngredients = subIngredients;
  if (cacheKey) {
    recipeTreeMapCache.set(cacheKey, JSON.parse(JSON.stringify(node)));
  }
  return node;
}

export function calculateTreeCraftCost(
  node: RecipeTreeNode,
  strategy: CraftStrategyMode,
  marketPrices: MarketPriceMap,
  bycMethods?: Record<number, "direct" | "fragments" | "map">
): number {
  if (
    !node.subIngredients ||
    node.subIngredients.length === 0 ||
    !node.isCraftable
  ) {
    if (isBycResource(node.itemId)) {
      const preferredMethod = bycMethods?.[node.itemId];
      const bycOpt = getOptimizedIngredientCost(node.itemId, marketPrices, preferredMethod);
      return bycOpt.cost * node.quantity;
    }
    const singlePrice = marketPrices[node.itemId] || node.marketPrice || 0;
    return singlePrice * node.quantity;
  }

  if (strategy === "direct_buy") {
    return node.subIngredients.reduce((total, child) => {
      let childPrice = marketPrices[child.itemId] || child.marketPrice || 0;
      if (childPrice === 0 && child.isCraftable && child.subIngredients && child.subIngredients.length > 0) {
        const childSubCost = calculateTreeCraftCost(child, "direct_buy", marketPrices, bycMethods);
        if (childSubCost > 0) {
          return total + childSubCost;
        }
      }
      return total + childPrice * child.quantity;
    }, 0);
  }

  if (strategy === "full_subcraft") {
    return node.subIngredients.reduce((total, child) => {
      return (
        total + calculateTreeCraftCost(child, "full_subcraft", marketPrices, bycMethods)
      );
    }, 0);
  }

  if (strategy === "auto_optimal") {
    return node.subIngredients.reduce((total, child) => {
      if (isBycResource(child.itemId)) {
        const preferredMethod = bycMethods?.[child.itemId];
        const bycOpt = getOptimizedIngredientCost(child.itemId, marketPrices, preferredMethod);
        return total + bycOpt.cost * child.quantity;
      }

      const childBuyPrice =
        (marketPrices[child.itemId] || child.marketPrice || 0) * child.quantity;

      if (
        !child.isCraftable ||
        !child.subIngredients ||
        child.subIngredients.length === 0
      ) {
        return total + childBuyPrice;
      }

      const childCraftCost = calculateTreeCraftCost(
        child,
        "auto_optimal",
        marketPrices,
        bycMethods
      );

      let bestCost = childBuyPrice;
      if (childBuyPrice > 0 && childCraftCost > 0) {
        bestCost = Math.min(childBuyPrice, childCraftCost);
      } else if (childCraftCost > 0) {
        bestCost = childCraftCost;
      }

      return total + bestCost;
    }, 0);
  }

  return node.subIngredients.reduce((total, child) => {
    if (child.decision === "buy" || !child.isCraftable) {
      if (isBycResource(child.itemId)) {
        const preferredMethod = bycMethods?.[child.itemId];
        const bycOpt = getOptimizedIngredientCost(child.itemId, marketPrices, preferredMethod);
        return total + bycOpt.cost * child.quantity;
      }

      let childPrice = marketPrices[child.itemId] || child.marketPrice || 0;
      if (childPrice === 0 && child.isCraftable && child.subIngredients && child.subIngredients.length > 0) {
        const childHybridCost = calculateTreeCraftCost(child, "custom_hybrid", marketPrices, bycMethods);
        if (childHybridCost > 0) {
          return total + childHybridCost;
        }
      }
      return total + childPrice * child.quantity;
    }

    return total + calculateTreeCraftCost(child, "custom_hybrid", marketPrices, bycMethods);
  }, 0);
}

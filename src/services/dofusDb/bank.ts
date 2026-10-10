import {
  BankInventoryItem,
  MarketPriceMap,
  ReverseCraftAnalysis,
  ReverseCraftIngredientStatus,
} from "../../types";
import { safeLocalStorageSet } from "./cache";
import { getItemById, getItemName } from "./items";
import { getCraftableItemsSnapshot, getRecipeByResultId } from "./recipes";
import { getStoredItemPrice } from "./prices";

export type { BankInventoryItem };

const BANK_INVENTORY_STORAGE_KEY = "dofus_bank_inventory_v1";

export function getStoredBankInventory(): BankInventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BANK_INVENTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      const id = Number(entry.itemId);
      return {
        itemId: id,
        quantity: Math.max(1, Number(entry.quantity) || 1),
        item: getItemById(id) || entry.item,
        addedAt: Number(entry.addedAt) || Date.now(),
      };
    });
  } catch {
    return [];
  }
}

export function saveBankInventory(items: BankInventoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    safeLocalStorageSet(BANK_INVENTORY_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("dofus_bank_inventory_updated"));
  } catch (err) {
    console.warn("Error guardando inventario de banco en localStorage:", err);
  }
}

export function addOrUpdateBankItem(itemId: number, quantity: number): BankInventoryItem[] {
  const current = getStoredBankInventory();
  const index = current.findIndex((i) => i.itemId === itemId);
  const resolvedItem = getItemById(itemId) || undefined;

  if (index >= 0) {
    current[index].quantity += quantity;
    if (!current[index].item && resolvedItem) {
      current[index].item = resolvedItem;
    }
  } else {
    current.push({
      itemId,
      quantity: Math.max(1, quantity),
      item: resolvedItem,
      addedAt: Date.now(),
    });
  }

  saveBankInventory(current);
  return current;
}

export function setBankItemQuantity(itemId: number, quantity: number): BankInventoryItem[] {
  let current = getStoredBankInventory();
  if (quantity <= 0) {
    current = current.filter((i) => i.itemId !== itemId);
  } else {
    const index = current.findIndex((i) => i.itemId === itemId);
    if (index >= 0) {
      current[index].quantity = Math.floor(quantity);
    } else {
      const resolvedItem = getItemById(itemId) || undefined;
      current.push({
        itemId,
        quantity: Math.floor(quantity),
        item: resolvedItem,
        addedAt: Date.now(),
      });
    }
  }

  saveBankInventory(current);
  return current;
}

export function removeBankItem(itemId: number): BankInventoryItem[] {
  const current = getStoredBankInventory().filter((i) => i.itemId !== itemId);
  saveBankInventory(current);
  return current;
}

export function clearBankInventory(): void {
  saveBankInventory([]);
}

export function calculateReverseCraftsFromBank(
  bankInventory: BankInventoryItem[],
  marketPrices: MarketPriceMap = {},
  options: {
    minLevel?: number;
    maxLevel?: number;
    jobId?: number | "all";
    onlyFullyCraftable?: boolean;
    searchTerm?: string;
  } = {}
): ReverseCraftAnalysis[] {
  if (!bankInventory || bankInventory.length === 0) {
    return [];
  }

  const bankMap = new Map<number, number>();
  for (const b of bankInventory) {
    if (b.quantity > 0) {
      bankMap.set(b.itemId, (bankMap.get(b.itemId) || 0) + b.quantity);
    }
  }

  if (bankMap.size === 0) {
    return [];
  }

  const allRecipesSnapshot = getCraftableItemsSnapshot();
  const results: ReverseCraftAnalysis[] = [];

  const minLvl = typeof options.minLevel === "number" ? options.minLevel : 1;
  const maxLvl = typeof options.maxLevel === "number" ? options.maxLevel : 200;
  const filterJob = options.jobId && options.jobId !== "all" ? options.jobId : null;
  const searchFilter = (options.searchTerm || "").toLowerCase().trim();

  for (const item of allRecipesSnapshot) {
    if (item.level < minLvl || item.level > maxLvl) continue;
    if (filterJob && item.jobId !== filterJob) continue;

    const recipe = item.recipeData || getRecipeByResultId(item.id);
    if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) continue;

    let hasMatchingBankIngredient = false;
    for (let i = 0; i < recipe.ingredientIds.length; i++) {
      if (bankMap.has(recipe.ingredientIds[i])) {
        hasMatchingBankIngredient = true;
        break;
      }
    }
    if (!hasMatchingBankIngredient) {
      continue;
    }

    if (searchFilter) {
      const name = getItemName(item).toLowerCase();
      if (!name.includes(searchFilter)) continue;
    }

    let hasAtLeastOneBankIngredient = false;
    let availableIngredientsCount = 0;
    const totalIngredientsCount = recipe.ingredientIds.length;
    let bankMaterialsValue = 0;
    let missingMaterialsCost = 0;
    let totalCraftCost = 0;
    let isFullyCraftable = true;
    let possibleCraftBatches = Infinity;

    const ingredientsStatus: ReverseCraftIngredientStatus[] = [];

    for (let i = 0; i < recipe.ingredientIds.length; i++) {
      const ingId = recipe.ingredientIds[i];
      const required = recipe.quantities[i] || 1;
      const inBank = bankMap.get(ingId) || 0;
      const unitPrice = marketPrices[ingId] || getStoredItemPrice(ingId) || 0;
      const ingItem = getItemById(ingId);
      const ingName = getItemName(ingItem || { id: ingId });
      const ingIcon = ingItem?.iconId || ingId;

      const missing = Math.max(0, required - inBank);
      const isFullyAvailable = inBank >= required;
      const ingMissingCost = missing * unitPrice;
      const ingBankCost = Math.min(required, inBank) * unitPrice;

      if (inBank > 0) {
        hasAtLeastOneBankIngredient = true;
        availableIngredientsCount++;
      }
      if (!isFullyAvailable) {
        isFullyCraftable = false;
      }

      const batchesWithThisIng = Math.floor(inBank / required);
      if (batchesWithThisIng < possibleCraftBatches) {
        possibleCraftBatches = batchesWithThisIng;
      }

      bankMaterialsValue += ingBankCost;
      missingMaterialsCost += ingMissingCost;
      totalCraftCost += required * unitPrice;

      ingredientsStatus.push({
        itemId: ingId,
        itemName: ingName,
        itemIconId: ingIcon,
        required,
        inBank,
        missing,
        unitPrice,
        missingCost: ingMissingCost,
        isFullyAvailable,
      });
    }

    if (options.onlyFullyCraftable && !isFullyCraftable) {
      continue;
    }

    if (!hasAtLeastOneBankIngredient) {
      continue;
    }

    const maxCraftableWithBank = isFullyCraftable && isFinite(possibleCraftBatches) ? possibleCraftBatches : 0;
    const materialsCoveragePercent = totalIngredientsCount > 0
      ? Math.round((availableIngredientsCount / totalIngredientsCount) * 100)
      : 0;

    const marketSalePrice = marketPrices[item.id] || getStoredItemPrice(item.id) || item.defaultMarketSalePrice || (totalCraftCost * 1.3);
    const netProfit = marketSalePrice - totalCraftCost;
    const roi = totalCraftCost > 0 ? ((netProfit / totalCraftCost) * 100) : 0;

    results.push({
      item,
      recipe,
      jobId: item.jobId,
      jobNameEs: item.jobNameEs,
      totalCraftCost,
      marketSalePrice,
      netProfit,
      roi,
      maxCraftableWithBank,
      materialsCoveragePercent,
      availableIngredientsCount,
      totalIngredientsCount,
      bankMaterialsValue,
      missingMaterialsCost,
      ingredientsStatus,
      isFullyCraftable,
    });
  }

  return results;
}

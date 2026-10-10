import {
  ConsolidatedIngredient,
  DofusbookBuildAnalysis,
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  ShoppingListItem,
} from "../../types";
import { safeLocalStorageSet } from "./cache";
import { getItemById } from "./items";
import { getRecipeByResultId } from "./recipes";
import { getActivePriceProfileId, getStoredItemPrice } from "./prices";
import { requestJson } from "./store";

const SHOPPING_LIST_KEY = "dofus_shopping_list_items_v1";

export function getShoppingList(): ShoppingListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHOPPING_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveShoppingList(items: ShoppingListItem[]): void {
  if (typeof window === "undefined") return;
  try {
    safeLocalStorageSet(SHOPPING_LIST_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("dofus_shopping_list_updated"));
  } catch {
    // Ignore storage write errors
  }
}

export function addToShoppingList(
  item: DofusItem,
  quantity = 1,
  recipe?: DofusRecipe
): ShoppingListItem[] {
  const current = getShoppingList();
  const existingIndex = current.findIndex((i) => i.itemId === item.id);
  const resolvedRecipe = recipe || getRecipeByResultId(item.id) || undefined;

  if (existingIndex >= 0) {
    current[existingIndex].targetQuantity += quantity;
    if (!current[existingIndex].recipe && resolvedRecipe) {
      current[existingIndex].recipe = resolvedRecipe;
    }
  } else {
    current.push({
      itemId: item.id,
      item,
      recipe: resolvedRecipe,
      targetQuantity: Math.max(1, quantity),
      addedAt: Date.now(),
    });
  }

  saveShoppingList(current);
  return current;
}

export function addToShoppingListById(
  itemId: number,
  quantity = 1,
  parentResultId?: number
): ShoppingListItem[] {
  const existing = getItemById(itemId);
  const resolvedItem: DofusItem = existing || {
    id: itemId,
    name: { es: `Objeto #${itemId}` },
    level: 1,
    typeId: 0,
    iconId: itemId,
    type: { id: 0, superCategoryId: 0, name: { es: "Recurso" } },
  };
  const parentRecipe = parentResultId ? getRecipeByResultId(parentResultId) : undefined;
  return addToShoppingList(resolvedItem, quantity, parentRecipe);
}

export function updateShoppingListItemQuantity(
  itemId: number,
  quantity: number
): ShoppingListItem[] {
  const current = getShoppingList();
  const index = current.findIndex((i) => i.itemId === itemId);
  if (index >= 0) {
    if (quantity <= 0) {
      current.splice(index, 1);
    } else {
      current[index].targetQuantity = Math.floor(quantity);
    }
    saveShoppingList(current);
  }
  return current;
}

export function removeFromShoppingList(itemId: number): ShoppingListItem[] {
  const current = getShoppingList().filter((i) => i.itemId !== itemId);
  saveShoppingList(current);
  return current;
}

export function clearShoppingList(): void {
  saveShoppingList([]);
}

export function getConsolidatedShoppingIngredients(
  shoppingList: ShoppingListItem[],
  marketPrices: MarketPriceMap = {}
): ConsolidatedIngredient[] {
  const map = new Map<number, ConsolidatedIngredient>();

  for (const entry of shoppingList) {
    const recipe = entry.recipe || getRecipeByResultId(entry.itemId);
    const batchQty = Math.max(1, entry.targetQuantity);

    if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
      const directId = entry.itemId;
      const directItem = entry.item || getItemById(directId) || undefined;
      const unitPrice = marketPrices[directId] || getStoredItemPrice(directId) || 0;

      const existing = map.get(directId);
      if (existing) {
        existing.totalQuantityRequired += batchQty;
        existing.totalPrice = existing.totalQuantityRequired * existing.unitPrice;
      } else {
        map.set(directId, {
          itemId: directId,
          item: directItem,
          totalQuantityRequired: batchQty,
          unitPrice,
          totalPrice: batchQty * unitPrice,
          isChecked: false,
        });
      }
      continue;
    }

    for (let i = 0; i < recipe.ingredientIds.length; i++) {
      const ingId = recipe.ingredientIds[i];
      const ingQty = (recipe.quantities[i] || 1) * batchQty;
      const ingItem = getItemById(ingId) || undefined;
      const unitPrice = marketPrices[ingId] || getStoredItemPrice(ingId) || 0;

      const existing = map.get(ingId);
      if (existing) {
        existing.totalQuantityRequired += ingQty;
        existing.totalPrice = existing.totalQuantityRequired * existing.unitPrice;
      } else {
        map.set(ingId, {
          itemId: ingId,
          item: ingItem,
          totalQuantityRequired: ingQty,
          unitPrice,
          totalPrice: ingQty * unitPrice,
          isChecked: false,
        });
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.totalPrice || 0) - (a.totalPrice || 0)
  );
}

export async function fetchDofusbookAnalysis(
  urlOrCode: string,
  options: {
    excludeDofus?: boolean;
    excludeTrophies?: boolean;
    profileId?: number;
  } = {}
): Promise<DofusbookBuildAnalysis> {
  const profileId = options.profileId || getActivePriceProfileId();
  const excludeDofus = options.excludeDofus !== false;
  const excludeTrophies = options.excludeTrophies === true;

  const response = await requestJson<DofusbookBuildAnalysis>("/api/dofusbook/analyze", {
    method: "POST",
    body: JSON.stringify({
      url: urlOrCode.trim(),
      excludeDofus,
      excludeTrophies,
      profileId,
    }),
  });

  return response;
}

export function addDofusbookItemsToShoppingList(
  items: Array<{ item: DofusItem; recipe?: DofusRecipe | null; quantity?: number }>
): ShoppingListItem[] {
  const current = getShoppingList();
  
  for (const entry of items) {
    if (!entry.item || entry.item.id <= 0) continue;
    const qty = entry.quantity || 1;
    const existingIndex = current.findIndex((i) => i.itemId === entry.item.id);
    const resolvedRecipe = entry.recipe || getRecipeByResultId(entry.item.id) || undefined;

    if (existingIndex >= 0) {
      current[existingIndex].targetQuantity += qty;
      if (!current[existingIndex].recipe && resolvedRecipe) {
        current[existingIndex].recipe = resolvedRecipe;
      }
    } else {
      current.push({
        itemId: entry.item.id,
        item: entry.item,
        recipe: resolvedRecipe,
        targetQuantity: Math.max(1, qty),
        addedAt: Date.now(),
      });
    }
  }

  saveShoppingList(current);
  return current;
}

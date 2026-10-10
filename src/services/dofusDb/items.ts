import { DofusItem } from "../../types";
import { isOmittedItem } from "../../data/dofusJobs";
import { ALL_DOFUS_RUNES_BY_ID, ALL_DOFUS_RUNES_DICT } from "../../data/dofusAllRunesDict";
import { STATIC_ITEMS_DICT } from "../../data/staticItemsDict";
import { SUPPLEMENTARY_ITEMS_DICT } from "../../data/supplementaryItemsDict";
import { PRESET_CRAFTABLE_ITEMS } from "../../data/presetCraftableItems";
import {
  ALL_PRESET_ITEMS,
  KNOWN_SPECIAL_INGREDIENTS,
  presetItemMap,
  TYPE_NAME_MAP,
} from "./constants";
import {
  getItemsCache,
  getIsDbInitialized,
  LOCAL_DB_API_BASE,
  requestJson,
  updateMemoryCache,
} from "./store";

let initDbTrigger: (() => Promise<unknown>) | null = null;
export function setInitDbTrigger(fn: () => Promise<unknown>): void {
  initDbTrigger = fn;
}

function ensureInitialized(): void {
  if (!getIsDbInitialized() && initDbTrigger) {
    void initDbTrigger();
  }
}

export function getItemName(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "Objeto sin nombre";
  }

  const typedItem = item as {
    id?: number;
    title?: string;
    name?: string | { es?: string; fr?: string; en?: string };
  };

  if (typedItem.id && ALL_DOFUS_RUNES_BY_ID[typedItem.id]) {
    const rune = ALL_DOFUS_RUNES_BY_ID[typedItem.id];
    if (
      !typedItem.name ||
      (typeof typedItem.name === "object" &&
        (!typedItem.name.es || typedItem.name.es.startsWith("Objeto #") || typedItem.name.es.startsWith("Ingrediente #"))) ||
      (typeof typedItem.name === "string" &&
        (typedItem.name.startsWith("Objeto #") || typedItem.name.startsWith("Ingrediente #")))
    ) {
      return rune.name.es || `Objeto #${typedItem.id}`;
    }
  }

  if (typedItem.id && KNOWN_SPECIAL_INGREDIENTS[typedItem.id]) {
    const known = KNOWN_SPECIAL_INGREDIENTS[typedItem.id];
    if (
      !typedItem.name ||
      (typeof typedItem.name === "object" &&
        (!typedItem.name.es || typedItem.name.es.startsWith("Objeto #") || typedItem.name.es.startsWith("Ingrediente #"))) ||
      (typeof typedItem.name === "string" &&
        (typedItem.name.startsWith("Objeto #") || typedItem.name.startsWith("Ingrediente #")))
    ) {
      return (
        (typeof known.name === "object" ? known.name?.es : (known.name as string)) ||
        `Objeto #${typedItem.id}`
      );
    }
  }

  if (typedItem.id) {
    const sId = String(typedItem.id);
    const staticName =
      STATIC_ITEMS_DICT[sId] ||
      ALL_DOFUS_RUNES_DICT[sId] ||
      SUPPLEMENTARY_ITEMS_DICT[sId];
    if (staticName) {
      if (
        !typedItem.name ||
        (typeof typedItem.name === "object" &&
          (!typedItem.name.es || typedItem.name.es.startsWith("Objeto #") || typedItem.name.es.startsWith("Ingrediente #"))) ||
        (typeof typedItem.name === "string" &&
          (typedItem.name.startsWith("Objeto #") || typedItem.name.startsWith("Ingrediente #")))
      ) {
        return staticName;
      }
    }
  }

  if (typeof typedItem.name === "string") {
    return typedItem.name;
  }

  if (typedItem.name && typeof typedItem.name === "object") {
    const candidate =
      typedItem.name.es ||
      typedItem.name.fr ||
      typedItem.name.en;
    if (candidate && !candidate.startsWith("Objeto #") && !candidate.startsWith("Item #")) {
      return candidate;
    }
  }

  if (typeof typedItem.title === "string" && typedItem.title) {
    return typedItem.title;
  }

  if (typedItem.id) {
    const sId = String(typedItem.id);
    const staticName =
      STATIC_ITEMS_DICT[sId] ||
      ALL_DOFUS_RUNES_DICT[sId] ||
      SUPPLEMENTARY_ITEMS_DICT[sId];
    if (staticName) {
      return staticName;
    }
  }

  return `Objeto #${typedItem.id || ""}`;
}

export function getItemTypeName(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "";
  }

  const typedItem = item as {
    typeId?: number;
    type?: {
      id?: number;
      name?: string | { es?: string; fr?: string; en?: string };
    };
  };

  if (typedItem.type?.name) {
    if (typeof typedItem.type.name === "string") {
      return typedItem.type.name;
    }
    return (
      typedItem.type.name.es ||
      typedItem.type.name.fr ||
      typedItem.type.name.en ||
      ""
    );
  }

  const typeId = typedItem.typeId || typedItem.type?.id;
  if (typeId && TYPE_NAME_MAP[typeId]) {
    return TYPE_NAME_MAP[typeId];
  }

  return "";
}

export function getItemIconUrl(item: unknown): string {
  const items = getItemsCache();
  if (typeof item === "number") {
    if (KNOWN_SPECIAL_INGREDIENTS[item]?.iconId) {
      const known = KNOWN_SPECIAL_INGREDIENTS[item]!;
      const name = (typeof known.name === "string" ? known.name : known.name?.es || "").toLowerCase();
      if (
        name.includes("fragmento de mapa") ||
        name.includes("fragment de carte") ||
        name.includes("map fragment") ||
        known.typeId === 175
      ) {
        return "https://api.dofusdb.fr/img/items/77042.png";
      }
      if (name.startsWith("mapa de") || name.startsWith("mapa del") || known.typeId === 174) {
        return "https://api.dofusdb.fr/img/items/77041.png";
      }
      return `https://api.dofusdb.fr/img/items/${known.iconId}.png`;
    }

    const found = items.find((i) => i.id === item);
    if (found) {
      const name = (typeof found.name === "string" ? found.name : found.name?.es || "").toLowerCase();
      const typeId = found.typeId || found.type?.id;
      if (
        name.includes("fragmento de mapa") ||
        name.includes("fragment de carte") ||
        name.includes("map fragment") ||
        typeId === 175
      ) {
        return "https://api.dofusdb.fr/img/items/77042.png";
      }
      if (name.startsWith("mapa de") || name.startsWith("mapa del") || name.startsWith("tarjeta de") || (typeId === 174 && !name.includes("tabla"))) {
        return "https://api.dofusdb.fr/img/items/77041.png";
      }
      const iconId = found.iconId || (found as any).icon_id || item;
      return `https://api.dofusdb.fr/img/items/${iconId}.png`;
    }

    return `https://api.dofusdb.fr/img/items/${item}.png`;
  }

  if (!item || typeof item !== "object") {
    return "https://api.dofusdb.fr/img/items/0.png";
  }

  const typed = item as {
    iconId?: number;
    icon_id?: number;
    id?: number;
    typeId?: number;
    type?: { id?: number };
    name?: string | { es?: string; fr?: string; en?: string };
    img?: string;
  };

  const nameStr = (
    typeof typed.name === "string" ? typed.name : typed.name?.es || ""
  ).toLowerCase();
  const itemTypeId = typed.typeId || typed.type?.id;

  if (
    nameStr.includes("fragmento de mapa") ||
    nameStr.includes("fragment de carte") ||
    nameStr.includes("map fragment") ||
    (itemTypeId === 175 && !nameStr.includes("tabla"))
  ) {
    return "https://api.dofusdb.fr/img/items/77042.png";
  }
  if (
    nameStr.startsWith("mapa de") ||
    nameStr.startsWith("mapa del") ||
    nameStr.startsWith("tarjeta de") ||
    nameStr.startsWith("carte du") ||
    nameStr.startsWith("carte d'") ||
    (itemTypeId === 174 && !nameStr.includes("tabla"))
  ) {
    return "https://api.dofusdb.fr/img/items/77041.png";
  }

  if (typeof typed.img === "string" && typed.img.startsWith("http")) {
    return typed.img;
  }

  let iconId = typed.iconId || typed.icon_id;
  if (!iconId && typed.id && KNOWN_SPECIAL_INGREDIENTS[typed.id]?.iconId) {
    iconId = KNOWN_SPECIAL_INGREDIENTS[typed.id]!.iconId;
  }

  if (!iconId && typed.id && items.length > 0) {
    const found = items.find((i) => i.id === typed.id);
    if (found) {
      iconId = found.iconId || (found as any).icon_id;
    }
  }

  if (!iconId) {
    iconId = typed.id || 0;
  }

  return `https://api.dofusdb.fr/img/items/${iconId}.png`;
}

export function getItemFallbackIconUrl(item: unknown): string {
  const items = getItemsCache();
  if (!item || typeof item !== "object") {
    return "https://api.dofusdb.fr/img/items/0.png";
  }

  const typed = item as {
    id?: number;
    iconId?: number;
    icon_id?: number;
    name?: string | { es?: string; fr?: string; en?: string };
  };
  const nameStr =
    typeof typed.name === "string" ? typed.name : typed.name?.es || "";
  if (nameStr.toLowerCase().startsWith("fragmento de mapa")) {
    return `https://api.dofusdb.fr/img/items/15309.png`;
  }
  if (
    nameStr.toLowerCase().startsWith("mapa de ") ||
    nameStr.toLowerCase().startsWith("mapa del ")
  ) {
    return `https://api.dofusdb.fr/img/items/15308.png`;
  }

  let iconId = typed.iconId || typed.icon_id;
  if (!iconId && typed.id && KNOWN_SPECIAL_INGREDIENTS[typed.id]?.iconId) {
    iconId = KNOWN_SPECIAL_INGREDIENTS[typed.id]!.iconId;
  }

  if (!iconId && typed.id && items.length > 0) {
    const found = items.find((i) => i.id === typed.id);
    if (found) {
      iconId = found.iconId || (found as any).icon_id;
    }
  }

  const finalId = typed.id || iconId || 0;
  return `https://api.dofusdb.fr/img/items/${finalId}.png`;
}

export function getImportedItems(): DofusItem[] {
  ensureInitialized();
  return getItemsCache();
}

export function getAllLocalItems(): DofusItem[] {
  ensureInitialized();
  const items = getItemsCache();
  if (items.length > 0) {
    return items.filter((item) => !isOmittedItem(item));
  }
  return PRESET_CRAFTABLE_ITEMS.filter((item) => !isOmittedItem(item));
}

export function getItemById(id: number): DofusItem | undefined {
  const items = getItemsCache();
  if (items.length > 0) {
    const found = items.find((i) => i.id === id);
    if (found) return found;
  }
  return presetItemMap.get(id);
}

export function searchAllItems(query: string, limit = 20): DofusItem[] {
  if (!query || !query.trim()) return [];
  const normalizedQuery = query.toLowerCase().trim();
  const numericId = parseInt(normalizedQuery, 10);
  const results: DofusItem[] = [];
  const seenIds = new Set<number>();

  // 1. Exact ID match if numeric
  if (!isNaN(numericId) && numericId > 0) {
    const itemById = getItemById(numericId);
    if (itemById) {
      results.push(itemById);
      seenIds.add(itemById.id);
    }
  }

  // 2. Search in PRESET_CRAFTABLE_ITEMS
  for (const item of ALL_PRESET_ITEMS) {
    if (results.length >= limit) break;
    if (seenIds.has(item.id)) continue;
    const name = getItemName(item).toLowerCase();
    if (name.includes(normalizedQuery)) {
      results.push(item);
      seenIds.add(item.id);
    }
  }

  // 3. Search in KNOWN_SPECIAL_INGREDIENTS
  for (const [idStr, raw] of Object.entries(KNOWN_SPECIAL_INGREDIENTS)) {
    if (results.length >= limit) break;
    const id = Number(idStr);
    if (seenIds.has(id)) continue;
    const name = (typeof raw.name === "object" ? raw.name?.es || "" : (raw.name as string) || "").toLowerCase();
    if (name.includes(normalizedQuery)) {
      const resolved = getItemById(id);
      if (resolved) {
        results.push(resolved);
        seenIds.add(id);
      }
    }
  }

  // 4. Search in itemsMemoryCache
  for (const item of getItemsCache()) {
    if (results.length >= limit) break;
    if (seenIds.has(item.id)) continue;
    const name = getItemName(item).toLowerCase();
    if (name.includes(normalizedQuery)) {
      results.push(item);
      seenIds.add(item.id);
    }
  }

  return results;
}

export async function fetchItemDetailsById(
  itemId: number,
): Promise<DofusItem | null> {
  const items = getItemsCache();
  const known = KNOWN_SPECIAL_INGREDIENTS[itemId];
  const localItem = items.find((item) => item.id === itemId);
  if (
    localItem &&
    localItem.name?.es &&
    !localItem.name.es.startsWith("Objeto #") &&
    !localItem.name.es.startsWith("Ingrediente #")
  ) {
    return localItem;
  }

  if (known) {
    const knownItem: DofusItem = {
      id: itemId,
      level: known.level || 1,
      typeId: known.typeId || 0,
      iconId: known.iconId || itemId,
      name: {
        es: typeof known.name === "object" ? known.name?.es || "" : known.name || "",
        fr: typeof known.name === "object" ? known.name?.fr || "" : "",
        en: typeof known.name === "object" ? known.name?.en || "" : "",
      },
      type: (known.type as any) || { id: known.typeId || 0, superCategoryId: 0, name: { es: "", fr: "", en: "" } },
    };

    if (!localItem) {
      updateMemoryCache({ items: [...items, knownItem] });
    }
  }

  try {
    const item = await requestJson<DofusItem>(
      `${LOCAL_DB_API_BASE}/items/${itemId}`,
    );
    if (item && item.id) {
      const nextItems = [...getItemsCache()];
      const currentIndex = nextItems.findIndex((entry) => entry.id === item.id);
      if (currentIndex >= 0) {
        nextItems[currentIndex] = item;
      } else {
        nextItems.push(item);
      }
      updateMemoryCache({ items: nextItems });
      return item;
    }
  } catch {
    // Fallback to memory / known item
  }

  if (known) {
    return {
      id: itemId,
      level: known.level || 1,
      typeId: known.typeId || 0,
      iconId: known.iconId || itemId,
      name: {
        es: typeof known.name === "object" ? known.name?.es || "" : known.name || "",
        fr: typeof known.name === "object" ? known.name?.fr || "" : "",
        en: typeof known.name === "object" ? known.name?.en || "" : "",
      },
      type: (known.type as any) || { id: known.typeId || 0, superCategoryId: 0, name: { es: "", fr: "", en: "" } },
    };
  }

  return localItem || null;
}

let isResolvingMissingNames = false;

export async function resolveMissingItemNamesInBatch(
  itemIds: number[],
): Promise<DofusItem[]> {
  if (!itemIds || itemIds.length === 0 || isResolvingMissingNames) return [];

  const items = getItemsCache();
  const idsToResolve = itemIds.filter((itemId) => {
    const cachedItem = items.find((item) => item.id === itemId);
    if (!cachedItem) return true;
    const name = getItemName(cachedItem);
    return !name || name.startsWith("Objeto #");
  });

  if (idsToResolve.length === 0) return [];

  isResolvingMissingNames = true;
  try {
    const response = await requestJson<{ items?: DofusItem[]; updatedItems?: DofusItem[] }>(
      `${LOCAL_DB_API_BASE}/items/batch-resolve`,
      {
        method: "POST",
        body: JSON.stringify({ itemIds: idsToResolve }),
      },
    );
    const resolvedItems = response.updatedItems || response.items || [];
    if (resolvedItems.length > 0) {
      updateMemoryCache({ items: resolvedItems });
    }
    return resolvedItems;
  } catch (error) {
    console.warn("Error resolviendo nombres de ítems en lote:", error);
    return [];
  } finally {
    isResolvingMissingNames = false;
  }
}

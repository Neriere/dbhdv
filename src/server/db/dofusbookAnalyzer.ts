import { DofusItem, DofusRecipe } from "../../types";
import {
  database,
  getOrFetchItemById,
  getOrFetchRecipeByResultId,
  upsertItems,
  getActivePriceProfileId,
} from "../localDataStore";

const DOFUS_API_BASE = "https://api.dofusdb.fr";

interface DofusbookRawItem {
  rawName: string;
}

const CATEGORY_NAMES_TO_IGNORE = new Set([
  "boucliers", "bouclier", "bottes", "botte", "prysmaradites", "prismaradites", "prysmaradite", "prismaradite",
  "anneaux", "anneau", "montiliers", "montilier", "chapeaux", "chapeau", "sombreros", "sombrero",
  "trophees", "trophee", "trophées", "trophée", "trofeos", "trofeo", "familiers", "familier", "mascotas", "mascota", "mascoturas",
  "ceintures", "ceinture", "cinturons", "cinturón", "cinturon",
  "volkornes", "volkorne", "vuelocerontes", "vueloceronte", 
  "dragodindes", "dragodinde", "dragopavos", "dragopavo",
  "muldos", "muldo", "mulaguas", "mulagua",
  "amulettes", "amulette", "amuletos", "amuleto",
  "dofus", "capes", "cape", "capas",
  "haches", "hache", "hachas", "hacha",
  "faux", "guadañas", "guadaña",
  "pioches", "pioche", "picos", "pico",
  "marteaux", "marteau", "martillos", "martillo",
  "pelles", "pelle", "palas", "pala",
  "dagues", "dague", "dagas", "daga",
  "arcs", "arc", "arcos", "arco",
  "epees", "epee", "épées", "épée", "espadas", "espada",
  "batons", "baton", "bâtons", "bâton", "bastones", "baston",
  "baguettes", "baguette", "varitas", "varita",
  "lances", "lance", "lanzas", "lanza",
  "armes", "arme", "armas", "arma",
  "dofusbook", "logo", "nobody", "banner", "icon", "icone", "avatar", "profil", "dofus-stuffer", "equipement",
  "air", "feu", "eau", "terre", "neutre", "pv", "pa", "pm", "po", "cc", "so", "pu", "vi", "sa", "fo", "in", "ch", "ag"
]);

function getSlotNameByTypeId(typeId: number, currentCounts: Record<string, number>): string {
  switch (typeId) {
    case 1:
      return "Amuleto";
    case 9: {
      const ringCount = (currentCounts["Anillo"] || 0) + 1;
      currentCounts["Anillo"] = ringCount;
      return `Anillo ${ringCount}`;
    }
    case 10:
      return "Cinturón";
    case 11:
      return "Botas";
    case 16:
      return "Sombrero";
    case 17:
      return "Capa";
    case 82:
      return "Escudo";
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 19:
    case 21:
    case 22:
    case 114:
    case 183:
      return "Arma";
    case 18:
    case 121:
    case 122:
    case 123:
      return "Mascota / Montura";
    case 23: {
      const dofusCount = (currentCounts["Dofus"] || 0) + 1;
      currentCounts["Dofus"] = dofusCount;
      return `Dofus ${dofusCount}`;
    }
    case 151:
    case 271: {
      const trophyCount = (currentCounts["Trofeo"] || 0) + 1;
      currentCounts["Trofeo"] = trophyCount;
      return `Trofeo ${trophyCount}`;
    }
    case 217:
      return "Prismaradita";
    default:
      return "Equipamiento";
  }
}

async function findItemByNameOrId(nameOrId: string | number): Promise<DofusItem | null> {
  const isNumeric = typeof nameOrId === "number" || (/^\d+$/.test(String(nameOrId).trim()) && Number(nameOrId) < 1000000);
  if (typeof nameOrId === "number") {
    const item = await getOrFetchItemById(nameOrId);
    if (item) return item;
  }

  const queryName = String(nameOrId).replace(/^Image \d+:\s*/i, "").trim();
  if (!queryName || queryName.length < 2) return null;

  if (CATEGORY_NAMES_TO_IGNORE.has(queryName.toLowerCase()) || /^image \d+$/i.test(queryName)) {
    return null;
  }

  try {
    const localMatch = await database.execute({
      sql: `SELECT payload_json FROM items 
            WHERE LOWER(name_es) = LOWER(?) 
               OR payload_json LIKE ? 
               OR payload_json LIKE ?
            ORDER BY has_recipe DESC, level DESC
            LIMIT 1`,
      args: [
        queryName,
        `%"fr":"${queryName}"%`,
        `%"es":"${queryName}"%`
      ]
    });

    if (localMatch.rows.length > 0 && localMatch.rows[0].payload_json) {
      return JSON.parse(localMatch.rows[0].payload_json as string) as DofusItem;
    }

    const searchUrl = `${DOFUS_API_BASE}/items?name.fr=${encodeURIComponent(queryName)}&lang=es&$limit=5`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        const exact = data.data.find(
          (it: any) =>
            it.name?.fr?.toLowerCase() === queryName.toLowerCase() ||
            it.name?.es?.toLowerCase() === queryName.toLowerCase()
        ) || data.data[0];
        
        const remoteItem = exact as DofusItem;
        await upsertItems([remoteItem]);
        return remoteItem;
      }
    }

    const searchEsUrl = `${DOFUS_API_BASE}/items?name.es=${encodeURIComponent(queryName)}&lang=es&$limit=5`;
    const resEs = await fetch(searchEsUrl);
    if (resEs.ok) {
      const dataEs = await resEs.json();
      if (Array.isArray(dataEs.data) && dataEs.data.length > 0) {
        const exactEs = dataEs.data.find(
          (it: any) =>
            it.name?.es?.toLowerCase() === queryName.toLowerCase() ||
            it.name?.fr?.toLowerCase() === queryName.toLowerCase()
        ) || dataEs.data[0];
        
        const remoteItem = exactEs as DofusItem;
        await upsertItems([remoteItem]);
        return remoteItem;
      }
    }

    const fuzzyMatch = await database.execute({
      sql: `SELECT payload_json FROM items 
            WHERE name_es LIKE ? 
               OR payload_json LIKE ?
            LIMIT 1`,
      args: [`%${queryName}%`, `%${queryName}%`]
    });

    if (fuzzyMatch.rows.length > 0 && fuzzyMatch.rows[0].payload_json) {
      return JSON.parse(fuzzyMatch.rows[0].payload_json as string) as DofusItem;
    }
  } catch (err) {
    console.warn(`[findItemByNameOrId] Error searching for "${nameOrId}":`, err);
  }

  return null;
}

export async function analyzeDofusbookBuild(
  rawInput: string,
  options: {
    excludeDofus?: boolean;
    excludeTrophies?: boolean;
    profileId?: number;
  } = {}
) {
  const { excludeDofus = true, excludeTrophies = false, profileId } = options;
  const targetProfileId = profileId || (await getActivePriceProfileId());

  let targetUrl = rawInput.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    if (targetUrl.includes("dofusbook.net") || targetUrl.includes("d-bk.net")) {
      targetUrl = "https://" + targetUrl;
    } else if (/^[a-zA-Z0-9_-]+$/.test(targetUrl)) {
      targetUrl = `https://d-bk.net/fr/d/${targetUrl}`;
    } else {
      targetUrl = "https://" + targetUrl;
    }
  }

  let resolvedUrl = targetUrl;
  try {
    const headRes = await fetch(targetUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    const loc = headRes.headers.get("location");
    if (loc) {
      resolvedUrl = loc.startsWith("http")
        ? loc
        : new URL(loc, targetUrl).toString();
    }
  } catch (e: any) {
    console.warn("Redirect check failed, using targetUrl:", e.message);
  }

  if (resolvedUrl.includes("dofusbook.net/fr/equipement/") && !resolvedUrl.includes("/desktop/")) {
    resolvedUrl = resolvedUrl.replace("dofusbook.net/fr/equipement/", "dofusbook.net/desktop/fr/equipement/");
  }

  const jinaUrl = `https://r.jina.ai/${resolvedUrl}`;
  let markdown = "";
  try {
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DofusDBApp/1.0)",
        Accept: "text/plain, text/markdown",
      },
    });
    if (jinaRes.ok) {
      markdown = await jinaRes.text();
    }
  } catch (err: any) {
    console.warn("Jina fetch error:", err.message);
  }

  if (!markdown || markdown.includes("Attention Required! | Cloudflare")) {
    try {
      const directRes = await fetch(resolvedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });
      if (directRes.ok) {
        markdown = await directRes.text();
      }
    } catch (e: any) {
      console.warn("Direct fetch error:", e.message);
    }
  }

  if (!markdown) {
    throw new Error(
      "No se pudo cargar la información del enlace de Dofusbook. Verifica que el enlace sea público y correcto."
    );
  }

  const titleMatch =
    markdown.match(/Stuff de ([^\n!]+)/i) ||
    markdown.match(/Title:\s*([^\n]+)/i);
  const buildName = titleMatch ? titleMatch[1].trim() : "Build Dofusbook";

  const lvlMatch =
    markdown.match(/Niveau\s+(\d+)/i) ||
    markdown.match(/Niv\.\s*Stuff.*?(\d+)/i) ||
    markdown.match(/Niv\.\s*(\d+)/i);
  const buildLevel = lvlMatch ? parseInt(lvlMatch[1], 10) : undefined;

  const slotMatches = [
    ...markdown.matchAll(
      /!\[(?:Image \d+:\s*)?([^\]]*)\]\(https:\/\/(?:www\.)?(?:dofusbook\.net|d-bk\.net)\/static\/dist\/items\/(\d+)-70\.webp\)/gi
    ),
  ];

  const rawItems: DofusbookRawItem[] = [];

  for (const match of slotMatches) {
    let rawName = (match[1] || "").replace(/^Image \d+:\s*/i, "").trim();
    if (!rawName) continue;
    if (/^Image \d+$/i.test(rawName)) continue;
    if (CATEGORY_NAMES_TO_IGNORE.has(rawName.toLowerCase())) continue;

    const lower = rawName.toLowerCase();
    const currentCount = rawItems.filter((i) => i.rawName.toLowerCase() === lower).length;
    if (currentCount < 2 && rawItems.length < 16) {
      rawItems.push({ rawName });
    }
  }

  if (rawItems.length === 0) {
    const stufferBlockMatch = markdown.match(
      /(?:Niv\.\s*Stuff|Niveau\s*\d+)[\s\S]*?(?:Do Neutre|Do Terre|Dommages|\* \* \*|$)/i
    );
    const block = stufferBlockMatch ? stufferBlockMatch[0] : markdown;

    const altMatches = [
      ...block.matchAll(
        /!\[(?:Image \d+:\s*)?([^\]]+)\]\(https:\/\/(?:www\.)?(?:dofusbook\.net|d-bk\.net)\/static\/dist\/items\/(\d+)[^\)]*\)/gi
      ),
    ];

    for (const m of altMatches) {
      const fullUrl = m[0];
      if (fullUrl.includes("-50.webp")) continue;

      let name = (m[1] || "").replace(/^Image \d+:\s*/i, "").trim();
      if (!name || /^Image \d+$/i.test(name)) continue;
      if (CATEGORY_NAMES_TO_IGNORE.has(name.toLowerCase())) continue;

      const lower = name.toLowerCase();
      const currentCount = rawItems.filter((i) => i.rawName.toLowerCase() === lower).length;
      if (currentCount < 2 && rawItems.length < 16) {
        rawItems.push({ rawName: name });
      }
    }
  }

  const pricesResult = await database.execute({
    sql: "SELECT item_id, price FROM profile_prices WHERE profile_id = ?",
    args: [targetProfileId],
  });
  const pricesMap: Record<number, number> = {};
  for (const row of pricesResult.rows) {
    pricesMap[Number(row.item_id)] = Number(row.price) || 0;
  }

  const slotCounts: Record<string, number> = {};
  const analyzedItems: any[] = [];
  const consolidatedIngredientsMap = new Map<number, any>();

  let totalCraftCost = 0;
  let totalMarketPrice = 0;
  let totalOptimalCost = 0;
  let craftablePiecesCount = 0;
  let excludedDofusCount = 0;
  let excludedTrophiesCount = 0;

  for (const raw of rawItems) {
    const item = await findItemByNameOrId(raw.rawName);
    const itemId = item?.id || 0;
    const typeId = item?.typeId || item?.type?.id || 0;
    const typeName = (item?.type?.name?.es || "").toLowerCase();
    const itemNameEs = (item?.name?.es || "").toLowerCase();
    const itemNameFr = (item?.name?.fr || raw.rawName).toLowerCase();

    const isDofus =
      typeId === 23 ||
      typeName.includes("dofus") ||
      itemNameEs.includes("dofus") ||
      itemNameFr.includes("dofus");

    const isTrophy =
      typeId === 151 ||
      typeId === 271 ||
      typeName.includes("trofeo") ||
      itemNameEs.includes("trofeo") ||
      itemNameFr.includes("trophée");

    const isPrysmaradite = typeId === 217;

    const slotName = item
      ? getSlotNameByTypeId(typeId, slotCounts)
      : "Equipamiento";

    let recipe: DofusRecipe | null = null;
    if (itemId > 0) {
      recipe = await getOrFetchRecipeByResultId(itemId);
    }

    const isCraftable = !!(
      recipe &&
      recipe.ingredientIds &&
      recipe.ingredientIds.length > 0
    );

    const ingredientsBreakdown: any[] = [];
    let craftCost = 0;
    let missingIngredientsCount = 0;

    if (isCraftable && recipe) {
      for (let i = 0; i < recipe.ingredientIds.length; i++) {
        const ingId = recipe.ingredientIds[i];
        const ingQty = recipe.quantities[i] || 1;
        const ingItem = await getOrFetchItemById(ingId);
        const unitPrice = pricesMap[ingId] || 0;
        const ingTotalPrice = unitPrice * ingQty;

        if (unitPrice === 0) {
          missingIngredientsCount++;
        }

        craftCost += ingTotalPrice;

        ingredientsBreakdown.push({
          id: ingId,
          name: ingItem?.name?.es || ingItem?.name?.fr || `Ingrediente #${ingId}`,
          nameFr: ingItem?.name?.fr,
          quantity: ingQty,
          unitPrice,
          totalPrice: ingTotalPrice,
          iconId: ingItem?.iconId || ingId,
        });

        const isExcluded =
          (isDofus && excludeDofus) || (isTrophy && excludeTrophies);
        if (!isExcluded) {
          const existing = consolidatedIngredientsMap.get(ingId);
          if (existing) {
            existing.totalQuantityRequired += ingQty;
            existing.totalPrice = existing.totalQuantityRequired * existing.unitPrice;
          } else {
            consolidatedIngredientsMap.set(ingId, {
              itemId: ingId,
              item: ingItem || undefined,
              totalQuantityRequired: ingQty,
              unitPrice,
              totalPrice: ingTotalPrice,
              isChecked: false,
            });
          }
        }
      }
    }

    const marketPrice = itemId > 0 ? pricesMap[itemId] || 0 : 0;

    let cheaperOption:
      | "craft"
      | "buy"
      | "equal"
      | "no_recipe"
      | "dofus_excluded" = "no_recipe";
    let savings = 0;

    if (isDofus && excludeDofus) {
      cheaperOption = "dofus_excluded";
      excludedDofusCount++;
    } else if (isTrophy && excludeTrophies) {
      cheaperOption = "no_recipe";
      excludedTrophiesCount++;
    } else {
      if (isCraftable) craftablePiecesCount++;

      if (isCraftable && craftCost > 0 && marketPrice > 0) {
        if (craftCost < marketPrice) {
          cheaperOption = "craft";
          savings = marketPrice - craftCost;
        } else if (marketPrice < craftCost) {
          cheaperOption = "buy";
          savings = craftCost - marketPrice;
        } else {
          cheaperOption = "equal";
          savings = 0;
        }
      } else if (isCraftable && craftCost > 0) {
        cheaperOption = "craft";
      } else if (marketPrice > 0) {
        cheaperOption = "buy";
      } else {
        cheaperOption = isCraftable ? "craft" : "no_recipe";
      }

      if (craftCost > 0) {
        totalCraftCost += craftCost;
      } else if (marketPrice > 0) {
        totalCraftCost += marketPrice;
      }

      if (marketPrice > 0) {
        totalMarketPrice += marketPrice;
      } else if (craftCost > 0) {
        totalMarketPrice += craftCost;
      }

      const optimalPieceCost =
        craftCost > 0 && marketPrice > 0
          ? Math.min(craftCost, marketPrice)
          : craftCost > 0
          ? craftCost
          : marketPrice;

      totalOptimalCost += optimalPieceCost;
    }

    analyzedItems.push({
      id: itemId,
      slotName,
      rawName: raw.rawName,
      item,
      recipe,
      craftCost,
      marketPrice,
      isDofus,
      isTrophy,
      isPrysmaradite,
      isCraftable,
      cheaperOption,
      savings,
      missingIngredientsCount,
      ingredientsBreakdown,
      userChoice: cheaperOption === "buy" ? "buy" : "craft",
    });
  }

  const totalSavings = Math.max(
    0,
    Math.max(totalCraftCost, totalMarketPrice) - totalOptimalCost
  );

  const consolidatedIngredients = Array.from(
    consolidatedIngredientsMap.values()
  ).sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0));

  return {
    url: targetUrl,
    resolvedUrl,
    buildName,
    buildLevel,
    items: analyzedItems,
    totals: {
      totalCraftCost,
      totalMarketPrice,
      totalOptimalCost,
      totalSavings,
      craftablePiecesCount,
      excludedDofusCount,
      excludedTrophiesCount,
      totalPieces: analyzedItems.length,
    },
    consolidatedIngredients,
  };
}

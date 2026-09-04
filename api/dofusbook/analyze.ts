export const config = {
  maxDuration: 60,
};

const CATEGORY_NAMES_TO_IGNORE = new Set([
  "amulette", "amulettes", "amulet", "amulets", "amuleto", "amuletos",
  "anneau", "anneaux", "ring", "rings", "anillo", "anillos",
  "ceinture", "ceintures", "belt", "belts", "cinturon", "cinturón", "cinturones",
  "bottes", "botte", "boots", "boot", "bota", "botas",
  "chapeau", "chapeaux", "hat", "hats", "sombrero", "sombreros",
  "cape", "capes", "cloak", "cloaks", "capas",
  "bouclier", "boucliers", "shield", "shields", "escudo", "escudos",
  "dofus", "trophees", "trophee", "trophy", "trophies", "trofeo", "trofeos",
  "prysmaradites", "prysmaradite", "prismaradita", "prismaraditas",
  "familier", "familiers", "pet", "pets", "mascota", "mascotas",
  "montilier", "montiliers", "petsmount", "petsmounts", "mascotura", "mascoturas",
  "dragodinde", "dragodindes", "dragoturkey", "dragoturkeys", "dragopavo", "dragopavos",
  "muldo", "muldos", "seemyool", "seemyools",
  "volkorne", "volkornes", "rhineetle", "rhineetles", "vuelkorne", "vuelkornes",
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

// In-memory caches for the serverless function lifecycle
const itemCache = new Map<number, Promise<any>>();
const nameCache = new Map<string, Promise<any>>();
const recipeCache = new Map<number, Promise<any>>();

async function getDofusDbItemById(id: number): Promise<any> {
  if (!id || id <= 0) return null;
  if (itemCache.has(id)) return itemCache.get(id);

  const p = (async () => {
    try {
      const res = await fetch(`https://api.dofusdb.fr/items/${id}?lang=es`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; DofusDBApp/1.0)" },
      });
      if (res.ok) {
        const json = await res.json();
        return json || null;
      }
    } catch {
      // Ignored
    }
    return null;
  })();

  itemCache.set(id, p);
  return p;
}

async function findDofusDbItemByName(rawName: string): Promise<any> {
  const query = rawName.replace(/^Image \d+:\s*/i, "").trim();
  if (!query || query.length < 2) return null;
  if (CATEGORY_NAMES_TO_IGNORE.has(query.toLowerCase())) return null;

  const key = query.toLowerCase();
  if (nameCache.has(key)) return nameCache.get(key);

  const p = (async () => {
    try {
      // 1. Search by French name (exact first)
      const resFr = await fetch(
        `https://api.dofusdb.fr/items?name.fr=${encodeURIComponent(query)}&lang=es&$limit=5`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; DofusDBApp/1.0)" } }
      );
      if (resFr.ok) {
        const dataFr = await resFr.json();
        if (Array.isArray(dataFr.data) && dataFr.data.length > 0) {
          const exact = dataFr.data.find(
            (it: any) =>
              it.name?.fr?.toLowerCase() === query.toLowerCase() ||
              it.name?.es?.toLowerCase() === query.toLowerCase()
          ) || dataFr.data[0];
          if (exact) return exact;
        }
      }

      // 2. Search by Spanish name
      const resEs = await fetch(
        `https://api.dofusdb.fr/items?name.es=${encodeURIComponent(query)}&lang=es&$limit=5`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; DofusDBApp/1.0)" } }
      );
      if (resEs.ok) {
        const dataEs = await resEs.json();
        if (Array.isArray(dataEs.data) && dataEs.data.length > 0) {
          const exactEs = dataEs.data.find(
            (it: any) =>
              it.name?.es?.toLowerCase() === query.toLowerCase() ||
              it.name?.fr?.toLowerCase() === query.toLowerCase()
          ) || dataEs.data[0];
          if (exactEs) return exactEs;
        }
      }
    } catch {
      // Ignored
    }
    return null;
  })();

  nameCache.set(key, p);
  return p;
}

async function getDofusDbRecipeByResultId(itemId: number): Promise<any> {
  if (!itemId || itemId <= 0) return null;
  if (recipeCache.has(itemId)) return recipeCache.get(itemId);

  const p = (async () => {
    try {
      const res = await fetch(`https://api.dofusdb.fr/recipes?resultId=${itemId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; DofusDBApp/1.0)" },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          return json.data[0];
        }
        if (json && json.resultId) {
          return json;
        }
      }
    } catch {
      // Ignored
    }
    return null;
  })();

  recipeCache.set(itemId, p);
  return p;
}

async function fetchTursoPrices(profileId: number): Promise<Record<number, number>> {
  const dbUrl = (
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    process.env.DATABASE_URL ||
    process.env.TURSO_URL ||
    ""
  )
    .trim()
    .replace(/^libsql:\/\//, "https://");
  const dbToken = (
    process.env.TURSO_AUTH_TOKEN ||
    process.env.LIBSQL_AUTH_TOKEN ||
    process.env.DATABASE_AUTH_TOKEN ||
    process.env.TURSO_TOKEN ||
    ""
  ).trim();

  const prices: Record<number, number> = {};
  if (!dbUrl) return prices;

  try {
    const endpoint = dbUrl.endsWith("/v2/pipeline")
      ? dbUrl
      : `${dbUrl}/v2/pipeline`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dbToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            type: "execute",
            stmt: {
              sql: "SELECT item_id, price FROM profile_prices WHERE profile_id = ?",
              args: [{ type: "integer", value: String(profileId) }],
            },
          },
          { type: "close" },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rows = data?.results?.[0]?.response?.result?.rows || [];
      for (const row of rows) {
        const id = Number(row[0]?.value);
        const price = Number(row[1]?.value);
        if (id && price) {
          prices[id] = price;
        }
      }
    }
  } catch (err) {
    console.warn("[Turso prices query error]:", err);
  }

  return prices;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let url = "";
    let excludeDofus = true;
    let excludeTrophies = false;
    let profileId: number = 1;

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      url = body.url;
      if (body.excludeDofus !== undefined) {
        excludeDofus = Boolean(body.excludeDofus);
      }
      if (body.excludeTrophies !== undefined) {
        excludeTrophies = Boolean(body.excludeTrophies);
      }
      if (body.profileId) {
        profileId = Number(body.profileId) || 1;
      }
    } else if (req.method === "GET") {
      url = req.query?.url as string;
      if (req.query?.excludeDofus !== undefined) {
        excludeDofus = req.query.excludeDofus !== "false";
      }
      if (req.query?.excludeTrophies !== undefined) {
        excludeTrophies = req.query.excludeTrophies === "true";
      }
      if (req.query?.profileId) {
        profileId = Number(req.query.profileId) || 1;
      }
    } else {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        error: "Debes ingresar un enlace o código de Dofusbook válido.",
      });
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      if (targetUrl.includes("dofusbook.net") || targetUrl.includes("d-bk.net")) {
        targetUrl = "https://" + targetUrl;
      } else if (/^[a-zA-Z0-9_-]+$/.test(targetUrl)) {
        targetUrl = `https://d-bk.net/fr/d/${targetUrl}`;
      } else {
        targetUrl = "https://" + targetUrl;
      }
    }

    // Follow short-link redirects (e.g. d-bk.net -> dofusbook.net/desktop/...)
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
      console.warn("Redirect check error:", e?.message);
    }

    if (
      resolvedUrl.includes("dofusbook.net/fr/equipement/") &&
      !resolvedUrl.includes("/desktop/")
    ) {
      resolvedUrl = resolvedUrl.replace(
        "dofusbook.net/fr/equipement/",
        "dofusbook.net/desktop/fr/equipement/"
      );
    }

    // Fetch markdown content via Jina Reader proxy with timeout
    const jinaUrl = `https://r.jina.ai/${resolvedUrl}`;
    let markdown = "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const jinaRes = await fetch(jinaUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DofusDBApp/1.0)",
          Accept: "text/plain, text/markdown",
        },
        signal: controller.signal,
      });
      if (jinaRes.ok) {
        markdown = await jinaRes.text();
      }
    } catch (err: any) {
      console.warn("Jina fetch error:", err?.message);
    } finally {
      clearTimeout(timeoutId);
    }

    // Fallback: If Jina failed or returned Cloudflare block, try direct fetch
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
        console.warn("Direct fetch error:", e?.message);
      }
    }

    if (!markdown) {
      return res.status(400).json({
        error:
          "No se pudo cargar la información del enlace de Dofusbook. Verifica que el enlace sea público y correcto.",
      });
    }

    // 1. Extract build metadata
    const titleMatch =
      markdown.match(/Stuff de ([^\n!]+)/i) ||
      markdown.match(/Title:\s*([^\n]+)/i);
    const buildName = titleMatch ? titleMatch[1].trim() : "Build Dofusbook";

    const lvlMatch =
      markdown.match(/Niveau\s+(\d+)/i) ||
      markdown.match(/Niv\.\s*Stuff.*?(\d+)/i) ||
      markdown.match(/Niv\.\s*(\d+)/i);
    const buildLevel = lvlMatch ? parseInt(lvlMatch[1], 10) : undefined;

    // 2. Extract ONLY equipped slot items (-70.webp in the equipment stuffer grid)
    const slotMatches = [
      ...markdown.matchAll(
        /!\[(?:Image \d+:\s*)?([^\]]*)\]\(https:\/\/(?:www\.)?(?:dofusbook\.net|d-bk\.net)\/static\/dist\/items\/(\d+)-70\.webp\)/gi
      ),
    ];

    interface RawSlot {
      rawName: string;
    }

    const rawItems: RawSlot[] = [];

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

    // Fallback: If 0 items matched with -70.webp, extract from equipment block
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

    if (rawItems.length === 0) {
      return res.status(400).json({
        error:
          "No se encontraron piezas de equipamiento en este enlace de Dofusbook. Asegúrate de que el set tenga objetos equipados y sea público.",
      });
    }

    // 3. Parallel fetch: Turso prices and DofusDB items
    const [pricesMap, resolvedItems] = await Promise.all([
      fetchTursoPrices(profileId),
      Promise.all(rawItems.map((raw) => findDofusDbItemByName(raw.rawName))),
    ]);

    // 4. Parallel fetch recipes for all resolved items
    const recipes = await Promise.all(
      resolvedItems.map((item) =>
        item?.id ? getDofusDbRecipeByResultId(item.id) : Promise.resolve(null)
      )
    );

    // 5. Collect all ingredient IDs and fetch their item info in parallel
    const allIngredientIds = new Set<number>();
    for (const recipe of recipes) {
      if (recipe?.ingredientIds && Array.isArray(recipe.ingredientIds)) {
        for (const ingId of recipe.ingredientIds) {
          if (ingId > 0) allIngredientIds.add(ingId);
        }
      }
    }

    const ingredientItemsList = await Promise.all(
      Array.from(allIngredientIds).map((id) => getDofusDbItemById(id))
    );
    const ingredientItemsMap = new Map<number, any>();
    for (const ingItem of ingredientItemsList) {
      if (ingItem?.id) {
        ingredientItemsMap.set(ingItem.id, ingItem);
      }
    }

    // 6. Calculate breakdown, craft costs, market prices, and totals
    const slotCounts: Record<string, number> = {};
    const analyzedItems: any[] = [];
    const consolidatedIngredientsMap = new Map<number, any>();

    let totalCraftCost = 0;
    let totalMarketPrice = 0;
    let totalOptimalCost = 0;
    let craftablePiecesCount = 0;
    let excludedDofusCount = 0;
    let excludedTrophiesCount = 0;

    for (let index = 0; index < rawItems.length; index++) {
      const raw = rawItems[index];
      const item = resolvedItems[index];
      const recipe = recipes[index];

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
          const ingQty = recipe.quantities?.[i] || 1;
          const ingItem = ingredientItemsMap.get(ingId);
          const unitPrice = pricesMap[ingId] || 0;
          const ingTotalPrice = unitPrice * ingQty;

          if (unitPrice === 0) {
            missingIngredientsCount++;
          }

          craftCost += ingTotalPrice;

          ingredientsBreakdown.push({
            id: ingId,
            name:
              ingItem?.name?.es ||
              ingItem?.name?.fr ||
              `Ingrediente #${ingId}`,
            nameFr: ingItem?.name?.fr,
            quantity: ingQty,
            unitPrice,
            totalPrice: ingTotalPrice,
            iconId: ingItem?.iconId || ingId,
          });

          // Consolidate materials if piece is crafted
          const isExcluded =
            (isDofus && excludeDofus) || (isTrophy && excludeTrophies);
          if (!isExcluded) {
            const existing = consolidatedIngredientsMap.get(ingId);
            if (existing) {
              existing.totalQuantityRequired += ingQty;
              existing.totalPrice =
                existing.totalQuantityRequired * existing.unitPrice;
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
        item: item || null,
        recipe: recipe || null,
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

    return res.status(200).json({
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
    });
  } catch (err: any) {
    console.error("[Dofusbook Analyze API Error]:", err);
    return res.status(500).json({
      error: err.message || "Error analizando el build de Dofusbook.",
    });
  }
}

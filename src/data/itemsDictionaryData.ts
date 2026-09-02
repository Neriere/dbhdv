import { DOFUS_BASE_RUNES } from "./dofusRuneWeights";
import { CRAFTABLE_RUNES } from "./craftableRunesData";
import { PRESET_CRAFTABLE_ITEMS } from "./presetCraftableItems";
import { getDofusDbSeedData } from "./dofusDbSeedData";
import bycGeneratedDb from "./bycGeneratedDb.json";

let cachedDictionary: Record<string, string> | null = null;

export function buildItemsDictionary(): Record<string, string> {
  if (cachedDictionary && Object.keys(cachedDictionary).length > 1000) {
    return cachedDictionary;
  }

  const dict: Record<string, string> = {};

  try {
    // 1. All base runes (all official Dofus runes)
    if (Array.isArray(DOFUS_BASE_RUNES)) {
      for (const rune of DOFUS_BASE_RUNES) {
        if (rune && rune.id && rune.name) {
          dict[String(rune.id)] = rune.name;
        }
      }
    }

    // 2. All craftable runes (Bu, Su, Pa, Ra variants)
    if (Array.isArray(CRAFTABLE_RUNES)) {
      for (const rune of CRAFTABLE_RUNES) {
        if (rune && rune.id && rune.name?.es) {
          dict[String(rune.id)] = rune.name.es;
        }
      }
    }

    // 3. Preset items
    if (Array.isArray(PRESET_CRAFTABLE_ITEMS)) {
      for (const preset of PRESET_CRAFTABLE_ITEMS) {
        if (preset && preset.id && preset.name?.es) {
          dict[String(preset.id)] = preset.name.es;
        }
      }
    }

    // 4. Seed data from bundle
    try {
      const seedData = getDofusDbSeedData();
      if (seedData && Array.isArray(seedData.items)) {
        for (const item of seedData.items) {
          if (
            item &&
            item.id &&
            item.name?.es &&
            !item.name.es.startsWith("Objeto #") &&
            !item.name.es.startsWith("Item #")
          ) {
            dict[String(item.id)] = item.name.es;
          }
        }
      }
    } catch (e) {
      console.warn("[buildItemsDictionary] Seed data warning:", e);
    }

    // 5. ByC hunts, maps, fragments and items
    if (Array.isArray(bycGeneratedDb)) {
      for (const hunt of bycGeneratedDb as any[]) {
        if (hunt?.mapItem?.id && hunt?.mapItem?.name) {
          dict[String(hunt.mapItem.id)] = hunt.mapItem.name;
        }
        if (Array.isArray(hunt?.fragments)) {
          for (const f of hunt.fragments) {
            if (f?.id && f?.name) {
              dict[String(f.id)] = f.name;
            }
          }
        }
        if (hunt?.resource?.id && hunt?.resource?.name) {
          dict[String(hunt.resource.id)] = hunt.resource.name;
        }
        if (Array.isArray(hunt?.equipments)) {
          for (const eq of hunt.equipments) {
            if (eq?.id && eq?.name) {
              dict[String(eq.id)] = eq.name;
            }
            if (Array.isArray(eq?.recipeIngredients)) {
              for (const ing of eq.recipeIngredients) {
                if (ing?.id && ing?.name) {
                  dict[String(ing.id)] = ing.name;
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[buildItemsDictionary] Error building dictionary:", err);
  }

  cachedDictionary = dict;
  return dict;
}

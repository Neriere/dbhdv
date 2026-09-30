import fs from 'fs';
import path from 'path';
import { getDofusDbSeedDataAsync } from '../src/data/dofusDbSeedData';
import { PRESET_CRAFTABLE_ITEMS } from '../src/data/presetCraftableItems';
import { CRAFTABLE_RUNES } from '../src/data/craftableRunesData';

async function main() {
  console.log('Cargando seed data y recetas...');
  const seed = await getDofusDbSeedDataAsync();
  const ingredientIds = new Set<number>();

  if (seed.recipes) {
    for (const r of seed.recipes) {
      if (r.ingredientIds) {
        for (const id of r.ingredientIds) {
          if (typeof id === 'number' && id > 0) {
            ingredientIds.add(id);
          }
        }
      }
    }
  }

  for (const item of PRESET_CRAFTABLE_ITEMS) {
    if (item.recipeData?.ingredientIds) {
      for (const id of item.recipeData.ingredientIds) {
        if (typeof id === 'number' && id > 0) {
          ingredientIds.add(id);
        }
      }
    }
  }

  for (const rune of CRAFTABLE_RUNES) {
    if (rune.recipeData?.ingredientIds) {
      for (const id of rune.recipeData.ingredientIds) {
        if (typeof id === 'number' && id > 0) {
          ingredientIds.add(id);
        }
      }
    }
  }

  const sortedIds = Array.from(ingredientIds).sort((a, b) => a - b);
  console.log(`Total de IDs de ingredientes únicos encontrados: ${sortedIds.length}`);

  const snifferConfigDir = path.resolve(process.cwd(), 'sniffer', 'config');
  if (!fs.existsSync(snifferConfigDir)) {
    fs.mkdirSync(snifferConfigDir, { recursive: true });
  }

  const snifferTarget = path.join(snifferConfigDir, 'craft_ingredients_ids.json');
  fs.writeFileSync(snifferTarget, JSON.stringify(sortedIds, null, 2), 'utf-8');
  console.log(`Guardado en: ${snifferTarget}`);

  const srcTarget = path.resolve(process.cwd(), 'src', 'data', 'craftIngredientsIds.json');
  fs.writeFileSync(srcTarget, JSON.stringify(sortedIds, null, 2), 'utf-8');
  console.log(`Guardado en: ${srcTarget}`);
}

main().catch((err) => {
  console.error('Error extrayendo ingredientes:', err);
  process.exit(1);
});

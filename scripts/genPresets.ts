import { createClient } from '@libsql/client';
import * as fs from 'fs';

const db = createClient({ url: 'file:local.db' });

async function generateAccuratePresets() {
  const itemIds = [
    // Joyero (16)
    2469, // Gelanillo (Lv 60)
    8469, // Talismán de Roble Blando (Lv 138)
    8470, // Anillo de Roble Blando (Lv 139)
    8454, // Guante de la Rata Blanca (Lv 101)
    8453, // Collar de la Rata Blanca (Lv 102)
    9464, // Kralamansion (Lv 194)
    12113, // Alianza golosona (Lv 198)
    7249, // Alianza Airedala (Lv 57)
    7253, // Amuleto Airedala (Lv 62)

    // Sastre (27)
    7143, // Solomonk (Lv 118)
    8474, // Sombrero de Roble Blando (Lv 145)
    8472, // Capa gastada de Roble Blando (Lv 142)
    8451, // Cubrecabezas de la Rata Blanca (Lv 105)
    8452, // Capa de la Rata Blanca (Lv 102)
    8442, // Máscara de la Rata Negra (Lv 102)
    8443, // Capa de la Rata Negra (Lv 105)
    7229, // Sombrero Airedala (Lv 64)
    7233, // Capa Airedala (Lv 65)

    // Zapatero (15)
    8471, // Chanclas de domingo de Roble Blando (Lv 136)
    8473, // Tanga otoñal de Roble Blando (Lv 141)
    8455, // Cinturón de la Rata Blanca (Lv 102)
    8456, // Botas de la Rata Blanca (Lv 99)
    8447, // Cinturón de la Rata Negra (Lv 101)
    8446, // Botas de la Rata Negra (Lv 101)
    7241, // Cinturón Airedala (Lv 70)
    7245, // Geta de Airedala (Lv 57)

    // Herrero (11)
    15493, // Dagas de Sramvil (Lv 200)
    8450, // Ropera de la Rata Blanca (Lv 109)
    8444, // Dagas de la Rata Negra (Lv 108)
    12115, // Espada golosona (Lv 199)

    // Escultor (13)
    180, // La Varita del Limbo (Lv 105)
    6495, // Varita de Roble Blando (Lv 171)
    11749, // Bastón Pauls (Lv 188)

    // Fabricante (60)
    18661, // Escudo Airedala (Lv 65)
    18670, // Escudo de Capitán Amakna (Lv 200)
    19598, // Escudo de Solar (Lv 200)
  ];

  const presets: any[] = [];

  for (const id of itemIds) {
    const itemRes = await db.execute({ sql: 'SELECT payload_json FROM items WHERE id = ?', args: [id] });
    const recipeRes = await db.execute({ sql: 'SELECT payload_json FROM recipes WHERE result_id = ?', args: [id] });
    if (itemRes.rows.length === 0) continue;

    const item = JSON.parse(itemRes.rows[0].payload_json as string);
    const recipe = recipeRes.rows.length > 0 ? JSON.parse(recipeRes.rows[0].payload_json as string) : null;

    let jobId = 0;
    let jobNameEs = 'Artesano';
    if (recipe && recipe.jobId) {
      jobId = recipe.jobId;
    } else {
      const typeId = item.typeId || item.type?.id || 0;
      if ([1, 9].includes(typeId)) { jobId = 16; jobNameEs = 'Joyero'; }
      else if ([16, 17].includes(typeId)) { jobId = 27; jobNameEs = 'Sastre'; }
      else if ([10, 11].includes(typeId)) { jobId = 15; jobNameEs = 'Zapatero'; }
      else if ([5, 6, 7, 8].includes(typeId)) { jobId = 11; jobNameEs = 'Herrero'; }
      else if ([2, 3, 4].includes(typeId)) { jobId = 13; jobNameEs = 'Escultor'; }
      else if ([82].includes(typeId)) { jobId = 60; jobNameEs = 'Fabricante'; }
    }

    if (jobId === 16) jobNameEs = 'Joyero';
    else if (jobId === 27) jobNameEs = 'Sastre';
    else if (jobId === 15) jobNameEs = 'Zapatero';
    else if (jobId === 11) jobNameEs = 'Herrero';
    else if (jobId === 13) jobNameEs = 'Escultor';
    else if (jobId === 60) jobNameEs = 'Fabricante';

    presets.push({
      id: item.id,
      name: item.name || { es: item.name_es || ('Objeto #' + item.id) },
      description: item.description || { es: '' },
      level: item.level || 1,
      typeId: item.typeId || (item.type ? item.type.id : 0),
      type: item.type || { id: item.typeId || 0, name: { es: '' } },
      iconId: item.iconId || item.id,
      jobId,
      jobNameEs,
      defaultMarketSalePrice: item.price || (item.level ? item.level * 1500 : 50000),
      possibleEffects: item.possibleEffects || item.effects || [],
      recipeData: recipe || { id: item.id, resultId: item.id, ingredientIds: [], quantities: [] },
    });
  }

  const fileContent = `import { DofusItem, DofusRecipe } from "../types.js";

export interface PresetCraftableItem extends DofusItem {
  jobId: number;
  jobNameEs: string;
  defaultMarketSalePrice: number;
  recipeData: DofusRecipe;
}

export const DEFAULT_INGREDIENT_PRICES: Record<number, number> = {
  14659: 35000,
  7035: 450,
  757: 250,
  368: 180,
  369: 190,
  2436: 1200,
  2437: 4500,
  2242: 8900,
  370: 320,
  2241: 7500,
  6488: 85000,
  6489: 12000,
  6490: 95000,
  8399: 14000,
  8401: 18000,
  8404: 22000,
  14921: 45000,
  15271: 65000,
  16123: 15000,
  8486: 18000,
  8485: 19000,
  8812: 120000,
  8813: 140000,
};

export const PRESET_CRAFTABLE_ITEMS: PresetCraftableItem[] = ` + JSON.stringify(presets, null, 2) + `;\n`;

  fs.writeFileSync('src/data/presetCraftableItems.ts', fileContent, 'utf8');
  console.log('Saved presetCraftableItems.ts with ' + presets.length + ' authentic items');
}

generateAccuratePresets();

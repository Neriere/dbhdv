const fs = require('fs');
const zlib = require('zlib');

const seedFileContent = fs.readFileSync('./src/data/dofusDbSeedData.ts', 'utf-8');
const match = seedFileContent.match(/const COMPRESSED_SEED = "([^"]+)";/);
if (!match) {
  console.error('COMPRESSED_SEED not found!');
  process.exit(1);
}
const compressedBase64 = match[1];
const buffer = Buffer.from(compressedBase64, 'base64');
const decompressed = zlib.gunzipSync(buffer).toString('utf-8');
const seedData = JSON.parse(decompressed);

const dict = {};

// 1. Base runes
try {
  const runesWeightsContent = fs.readFileSync('./src/data/dofusRuneWeights.ts', 'utf-8');
  const runeMatches = runesWeightsContent.matchAll(/{\s*id:\s*(\d+),\s*name:\s*"([^"]+)"/g);
  for (const m of runeMatches) {
    dict[m[1]] = m[2];
  }
} catch (e) {
  console.warn('Runes extraction warning:', e);
}

// 2. Preset items
try {
  const presetsContent = fs.readFileSync('./src/data/presetCraftableItems.ts', 'utf-8');
  const presetMatches = presetsContent.matchAll(/id:\s*(\d+),\s*name:\s*\{\s*es:\s*"([^"]+)"/g);
  for (const m of presetMatches) {
    dict[m[1]] = m[2];
  }
} catch (e) {
  console.warn('Presets extraction warning:', e);
}

// 3. Seed items
if (seedData && Array.isArray(seedData.items)) {
  for (const item of seedData.items) {
    if (item && item.id && item.name && item.name.es && !item.name.es.startsWith('Objeto #') && !item.name.es.startsWith('Item #')) {
      dict[String(item.id)] = item.name.es;
    }
  }
}

// 4. ByC Generated DB
try {
  const byc = JSON.parse(fs.readFileSync('./src/data/bycGeneratedDb.json', 'utf-8'));
  if (Array.isArray(byc)) {
    for (const h of byc) {
      if (h.mapItem && h.mapItem.id && h.mapItem.name) dict[String(h.mapItem.id)] = h.mapItem.name;
      if (Array.isArray(h.fragments)) {
        for (const f of h.fragments) {
          if (f.id && f.name) dict[String(f.id)] = f.name;
        }
      }
      if (h.resource && h.resource.id && h.resource.name) dict[String(h.resource.id)] = h.resource.name;
      if (Array.isArray(h.equipments)) {
        for (const eq of h.equipments) {
          if (eq.id && eq.name) dict[String(eq.id)] = eq.name;
          if (Array.isArray(eq.recipeIngredients)) {
            for (const ing of eq.recipeIngredients) {
              if (ing.id && ing.name) dict[String(ing.id)] = ing.name;
            }
          }
        }
      }
    }
  }
} catch (e) {
  console.warn('ByC extraction warning:', e);
}

console.log('Total dictionary entries:', Object.keys(dict).length);
fs.writeFileSync('./src/data/staticItemsDictionary.json', JSON.stringify(dict, null, 2), 'utf-8');
console.log('Successfully wrote ./src/data/staticItemsDictionary.json');

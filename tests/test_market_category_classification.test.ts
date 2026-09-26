import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_CRAFTABLE_ITEMS } from '../src/data/presetCraftableItems.js';

export type MarketItemCategory = 'equipment' | 'consumables' | 'resources';

// Classification function to test
export function getItemMarketCategory(item: {
  id?: number;
  jobId?: number;
  typeId?: number;
  type?: { id?: number; superCategoryId?: number; name?: any };
  name?: any;
}): MarketItemCategory | null {
  const jobId = item.jobId || 0;
  const typeId = Number(item.typeId || item.type?.id || 0);
  const superCatId = Number((item as any).superCategoryId || item.type?.superCategoryId || 0);

  const rawName = (
    typeof item.name === 'object'
      ? (item.name?.es || item.name?.fr || item.name?.en || '')
      : String(item.name || '')
  ).toLowerCase();

  const rawTypeName = (
    typeof item.type?.name === 'object'
      ? (item.type?.name?.es || item.type?.name?.fr || '')
      : String(item.type?.name || '')
  ).toLowerCase();

  // 1. Excluir Forjamagia / Runas (tienen su propio mercadillo de runas)
  if (
    typeId === 78 ||
    (item as any).itemCategory === 'rune' ||
    rawTypeName.includes('runa') ||
    rawTypeName.includes('rune') ||
    rawName.startsWith('runa ') ||
    rawName.startsWith('rune ')
  ) {
    return null;
  }

  // 2. Minero (Job 24) y Leñador (Job 2):
  // Aleaciones de minero, piedras pulidas, tablas, concentrados y sustratos de leñador -> Recursos
  if (jobId === 24 || jobId === 2) {
    return 'resources';
  }

  // 3. Campesino (Job 28):
  // Harinas y Aceites -> Recursos.
  // Panes -> Consumibles.
  if (jobId === 28) {
    if (
      typeId === 88 || typeId === 89 || typeId === 37 || // Harinas
      typeId === 60 || typeId === 58 || typeId === 129 || // Aceites
      rawTypeName.includes('harina') || rawTypeName.includes('farine') ||
      rawTypeName.includes('aceite') || rawTypeName.includes('huile') ||
      rawName.includes('harina') || rawName.includes('farine') ||
      rawName.includes('aceite') || rawName.includes('huile')
    ) {
      return 'resources';
    }
    return 'consumables';
  }

  // 4. Alquimista (Job 26):
  // Únicamente las 5 pócimas principales de alta demanda en HDV Recursos:
  // - Pócima de firma (y desmarcar)
  // - Pócima de envejecimiento
  // - Pócima mineral
  // - Pócima de ganduleo
  // - Pócima de alteración
  // Se excluyen tinturas, esencias de mazmorra y otras pócimas secundarias.
  if (jobId === 26) {
    // 5 pócimas principales de recursos
    const isMainResourcePotion =
      /\b(firma|desmarcar|envejecimiento|vieillesse|mineral|minérale|ganduleo|paresse|alteraci[oó]n|altération)\b/i.test(rawName);

    if (isMainResourcePotion) {
      return 'resources';
    }

    // Pócimas bebibles consumibles de alta rotación (vida, energía, recuerdo, bonta, brakmar)
    const isConsumablePotion =
      /\b(curaci[oó]n|vida|soin|vie|energ[íi]a|[eé]nergie|recuerdo|rappel|bonta|brakmar|mini de curaci[oó]n|gueto)\b/i.test(rawName);

    if (isConsumablePotion) {
      return 'consumables';
    }

    // Las demás pócimas menores de alquimista (tinturas, esencias, o pócimas sin rotación) no se incluyen
    return null;
  }

  // 5. Cazador (41) y Pescador (36): Consumibles
  if (jobId === 41 || jobId === 36) {
    return 'consumables';
  }

  // 6. Manitas / Bricoleur (Job 65): Llaves -> Consumibles
  if (jobId === 65) {
    return 'consumables';
  }

  // 7. Equipamiento: Joyero (16), Sastre (27), Zapatero (15), Herrero (11), Escultor (13), Fabricante (60)
  const EQUIPMENT_JOB_IDS = new Set([16, 27, 15, 11, 13, 60]);
  if (EQUIPMENT_JOB_IDS.has(jobId) || superCatId === 1) {
    return 'equipment';
  }

  if (superCatId === 2) return 'consumables';
  if (superCatId === 3) return 'resources';

  return null;
}

test('Runas de forjamagia son excluidas de HDV Recursos (retornan null)', () => {
  const runeItem1 = { id: 7500, name: { es: 'Runa Fo' }, typeId: 78, type: { name: 'Runa' } };
  const runeItem2 = { id: 7501, name: { es: 'Runa Pa Vi' }, typeId: 78 };
  const runeItem3 = { id: 7502, name: { es: 'Runa Ra Ine' }, itemCategory: 'rune' };

  assert.equal(getItemMarketCategory(runeItem1), null, 'Runa Fo no debe ir a recursos');
  assert.equal(getItemMarketCategory(runeItem2), null, 'Runa Pa Vi no debe ir a recursos');
  assert.equal(getItemMarketCategory(runeItem3), null, 'Runa Ra Ine no debe ir a recursos');
});

test('Tinturas y esencias de mazmorra son excluidas de HDV Recursos (retornan null)', () => {
  const dye = { id: 2011, name: { es: 'Tintura mágica sombría' }, jobId: 26, typeId: 70 };
  const essence = { id: 2012, name: { es: 'Esencia de Jalató Real' }, jobId: 26, typeId: 167 };
  const essenceByText = { id: 2013, name: { es: 'Esencia de Kardorim' }, jobId: 26, typeId: 26 };

  assert.equal(getItemMarketCategory(dye), null, 'Tinturas deben excluirse');
  assert.equal(getItemMarketCategory(essence), null, 'Esencias deben excluirse');
  assert.equal(getItemMarketCategory(essenceByText), null, 'Esencias por nombre deben excluirse');
});

test('Pócimas secundarias (metal precioso, virutas, disolvente, chapucero, torpeza) son excluidas (retornan null)', () => {
  const metalPotion = { id: 2020, name: { es: 'Pócima de metal precioso' }, jobId: 26, typeId: 26 };
  const woodPotion = { id: 2021, name: { es: 'Pócima de virutas de madera' }, jobId: 26, typeId: 26 };
  const solvent = { id: 2022, name: { es: 'Disolvente' }, jobId: 26, typeId: 26 };
  const handymanPotion = { id: 2023, name: { es: 'Pócima de chapucero' }, jobId: 26, typeId: 26 };
  const clumsinessPotion = { id: 2024, name: { es: 'Pócima de torpeza' }, jobId: 26, typeId: 26 };

  assert.equal(getItemMarketCategory(metalPotion), null, 'Pócima de metal no debe ir a recursos');
  assert.equal(getItemMarketCategory(woodPotion), null, 'Pócima de virutas no debe ir a recursos');
  assert.equal(getItemMarketCategory(solvent), null, 'Disolvente no debe ir a recursos');
  assert.equal(getItemMarketCategory(handymanPotion), null, 'Pócima de chapucero no debe ir a recursos');
  assert.equal(getItemMarketCategory(clumsinessPotion), null, 'Pócima de torpeza no debe ir a recursos');
});

test('Las 5 pócimas principales solicitadas son las únicas que van a HDV Recursos', () => {
  const agingPotion = { id: 2006, name: { es: 'Pócima de envejecimiento' }, jobId: 26, typeId: 26 };
  const idlePotion = { id: 2007, name: { es: 'Pócima de ganduleo' }, jobId: 26, typeId: 26 };
  const signPotion = { id: 2008, name: { es: 'Pócima de firma' }, jobId: 26, typeId: 26 };
  const mineralPotion = { id: 2009, name: { es: 'Pócima mineral' }, jobId: 26, typeId: 26 };
  const altPotion = { id: 2010, name: { es: 'Pócima de alteración' }, jobId: 26, typeId: 26 };
  const unmarkPotion = { id: 2011, name: { es: 'Pócima de desmarcar' }, jobId: 26, typeId: 26 };

  assert.equal(getItemMarketCategory(agingPotion), 'resources', 'Envejecimiento debe ser recursos');
  assert.equal(getItemMarketCategory(idlePotion), 'resources', 'Ganduleo debe ser recursos');
  assert.equal(getItemMarketCategory(signPotion), 'resources', 'Firma debe ser recursos');
  assert.equal(getItemMarketCategory(mineralPotion), 'resources', 'Mineral debe ser recursos');
  assert.equal(getItemMarketCategory(altPotion), 'resources', 'Alteración debe ser recursos');
  assert.equal(getItemMarketCategory(unmarkPotion), 'resources', 'Desmarcar debe ser recursos');
});

test('Minero craftables are classified as resources', () => {
  const minerItems = PRESET_CRAFTABLE_ITEMS.filter(i => i.jobId === 24);
  for (const item of minerItems) {
    assert.equal(getItemMarketCategory(item), 'resources', `${item.name.es} should be resources`);
  }
});

test('Leñador craftables are classified as resources', () => {
  const lumberItems = PRESET_CRAFTABLE_ITEMS.filter(i => i.jobId === 2);
  for (const item of lumberItems) {
    assert.equal(getItemMarketCategory(item), 'resources', `${item.name.es} should be resources`);
  }
});

test('Campesino harinas y aceites are resources, panes are consumables', () => {
  const farmerItems = PRESET_CRAFTABLE_ITEMS.filter(i => i.jobId === 28);
  for (const item of farmerItems) {
    const name = (item.name.es || '').toLowerCase();
    const cat = getItemMarketCategory(item);
    if (name.includes('harina') || name.includes('aceite')) {
      assert.equal(cat, 'resources', `${item.name.es} should be resources`);
    } else if (name.includes('pan') || name.includes('brioche')) {
      assert.equal(cat, 'consumables', `${item.name.es} should be consumables`);
    }
  }
});

test('Equipamiento items (Sastre, Joyero, Zapatero, Herrero, Escultor, Fabricante) are classified as equipment', () => {
  const equipJobs = [16, 27, 15, 11, 13, 60];
  const equipItems = PRESET_CRAFTABLE_ITEMS.filter(i => equipJobs.includes(i.jobId)).slice(0, 50);
  for (const item of equipItems) {
    assert.equal(getItemMarketCategory(item), 'equipment', `${item.name.es} should be equipment`);
  }
});

test('Mock items test for all 3 market categories', () => {
  // Consumibles
  const bread = { id: 1001, name: { es: 'Pan de los campos' }, jobId: 28, typeId: 33 };
  const meat = { id: 1002, name: { es: 'Carne de jalató asada' }, jobId: 41, typeId: 150 };
  const fish = { id: 1003, name: { es: 'Trucha rellena' }, jobId: 36, typeId: 135 };
  const potionHeal = { id: 1004, name: { es: 'Pócima de curación' }, jobId: 26, typeId: 26 };
  const potionRecall = { id: 1005, name: { es: 'Pócima de recuerdo' }, jobId: 26, typeId: 26 };
  const key = { id: 1006, name: { es: 'Llave de la Mazmorra de los Jalatos' }, jobId: 65, typeId: 98 };

  assert.equal(getItemMarketCategory(bread), 'consumables');
  assert.equal(getItemMarketCategory(meat), 'consumables');
  assert.equal(getItemMarketCategory(fish), 'consumables');
  assert.equal(getItemMarketCategory(potionHeal), 'consumables');
  assert.equal(getItemMarketCategory(potionRecall), 'consumables');
  assert.equal(getItemMarketCategory(key), 'consumables');

  // Recursos
  const alloy = { id: 2001, name: { es: 'Bakelita' }, jobId: 24, typeId: 40 };
  const plank = { id: 2002, name: { es: 'Tabla de roble' }, jobId: 2, typeId: 95 };
  const substrate = { id: 2003, name: { es: 'Sustrato de bosque' }, jobId: 2, typeId: 185 };
  const flour = { id: 2004, name: { es: 'Harina de trigo' }, jobId: 28, typeId: 37 };
  const oil = { id: 2005, name: { es: 'Aceite de sésamo' }, jobId: 28, typeId: 58 };

  assert.equal(getItemMarketCategory(alloy), 'resources');
  assert.equal(getItemMarketCategory(plank), 'resources');
  assert.equal(getItemMarketCategory(substrate), 'resources');
  assert.equal(getItemMarketCategory(flour), 'resources');
  assert.equal(getItemMarketCategory(oil), 'resources');

  // Equipos
  const hat = { id: 3001, name: { es: 'Gelanillo' }, jobId: 16, typeId: 9 };
  const cape = { id: 3002, name: { es: 'Capa Veloz' }, jobId: 27, typeId: 17 };
  const sword = { id: 3003, name: { es: 'Espada de Yopuka' }, jobId: 11, typeId: 6 };
  const shield = { id: 3004, name: { es: 'Escudo de Bonta' }, jobId: 60, typeId: 82 };

  assert.equal(getItemMarketCategory(hat), 'equipment');
  assert.equal(getItemMarketCategory(cape), 'equipment');
  assert.equal(getItemMarketCategory(sword), 'equipment');
  assert.equal(getItemMarketCategory(shield), 'equipment');
});

import { PresetCraftableItem } from '../../data/presetCraftableItems';
import {
  BatchBreakdown,
  MarketCategory,
  StoredPlannerConfig,
  CONFIG_STORAGE_KEY,
} from './types';

export function calculateBatchBreakdown(units: number): BatchBreakdown {
  if (units <= 0) return { lots100: 0, lots10: 0, lots1: 0, totalSlots: 0 };
  const lots100 = Math.floor(units / 100);
  const rem100 = units % 100;
  const lots10 = Math.floor(rem100 / 10);
  const lots1 = rem100 % 10;
  // En Dofus, cada lote puesto a la venta ocupa 1 slot en HDV
  const totalSlots = lots100 + lots10 + (lots1 > 0 ? 1 : 0);
  return { lots100, lots10, lots1, totalSlots };
}

/**
 * Clasificación precisa de objetos en los 3 Mercadillos independientes de Dofus:
 * 1. Mercadillo de Equipamiento (Equipables individuales - 1 slot por unidad)
 * 2. Mercadillo de Consumibles (Panes, carnes, pescados, llaves y pociones bebibles - Lotes x1, x10, x100)
 * 3. Mercadillo de Recursos (Aleaciones, tablas, concentrados, harinas, aceites y pociones de oficio - Lotes x1, x10, x100)
 * Nota: El Mercadillo de Criaturas (filtros/extractos) está explícitamente excluido.
 */
export function getItemMarketCategory(item: {
  id?: number;
  jobId?: number;
  typeId?: number;
  type?: { id?: number; superCategoryId?: number; name?: any };
  name?: any;
}): MarketCategory | null {
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

  // 1. Excluir Forjamagia / Runas (tienen su propio mercadillo de runas, no van en HDV Recursos)
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
  // Harinas y Aceites van al Mercadillo de Recursos.
  // Panes van al Mercadillo de Consumibles.
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
  // Se excluyen tinturas, esencias de mazmorra y otras pócimas secundarias sin demanda masiva.
  if (jobId === 26) {
    const isMainResourcePotion =
      /\b(firma|desmarcar|envejecimiento|vieillesse|mineral|minérale|ganduleo|paresse|alteraci[oó]n|altération)\b/i.test(rawName);

    if (isMainResourcePotion) {
      return 'resources';
    }

    // Pócimas bebibles consumibles de alta rotación (vida, curación, energía, recuerdo, bonta, brakmar)
    const isConsumablePotion =
      /\b(curaci[oó]n|vida|soin|vie|energ[íi]a|[eé]nergie|recuerdo|rappel|bonta|brakmar|mini de curaci[oó]n|gueto)\b/i.test(rawName);

    if (isConsumablePotion) {
      return 'consumables';
    }

    // Las demás pócimas menores de alquimista (tinturas, esencias, virutas, torpeza, etc.) no se incluyen
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

  // 7. Oficios de equipamiento: Joyero (16), Sastre (27), Zapatero (15), Herrero (11), Escultor (13), Fabricante (60)
  const EQUIPMENT_JOB_IDS = new Set([16, 27, 15, 11, 13, 60]);
  if (EQUIPMENT_JOB_IDS.has(jobId) || superCatId === 1) {
    return 'equipment';
  }

  if (superCatId === 2) return 'consumables';
  if (superCatId === 3) return 'resources';

  return null;
}

export function isItemStackable(item: PresetCraftableItem): boolean {
  const cat = getItemMarketCategory(item);
  return cat === 'consumables' || cat === 'resources';
}

export function calculateItemSlots(isStackable: boolean, units: number): number {
  if (units <= 0) return 0;
  if (!isStackable) {
    // Equipables ocupan 1 slot por cada unidad individual en HDV
    return units;
  }
  // Consumibles / recursos se venden en lotes (1, 10 o 100)
  return calculateBatchBreakdown(units).totalSlots;
}

export function getStoredPlannerConfig(): Partial<StoredPlannerConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[DailyCraftPlanner] Error leyendo configuración de localStorage:', e);
    return {};
  }
}

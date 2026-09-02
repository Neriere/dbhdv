import {
  BankInventoryItem,
  DofusTheme,
  MarketPriceMap,
  PriceProfile,
  PriceUpdatedAtMap,
  ShoppingListItem,
} from '../types';
import {
  getActivePriceProfile,
  getShoppingList,
  getStoredBankInventory,
  getStoredMarketPrices,
  getPriceProfiles,
  getStoredPriceUpdatedAt,
  getStoredTheme,
  saveAllMarketPrices,
  saveBankInventory,
  saveShoppingList,
  setStoredTheme,
} from './dofusDbService';
import {
  getStoredSalesVolumeMap,
  saveItemSalesVolume,
  ItemSalesVolume,
} from './salesVolumeService';

export interface DbhdvBackupData {
  version: number;
  appName: string;
  exportedAt: string;
  data: {
    activePriceProfileId?: number;
    profiles?: PriceProfile[];
    prices?: MarketPriceMap;
    priceUpdatedAt?: PriceUpdatedAtMap;
    bankInventory?: BankInventoryItem[];
    shoppingList?: ShoppingListItem[];
    crushingCoefficients?: Record<string, Record<number, number>>;
    crushingTimestamps?: Record<string, Record<number, number>>;
    salesVolumeMap?: Record<number, ItemSalesVolume>;
    theme?: DofusTheme;
    customSettings?: Record<string, unknown>;
  };
}

export interface BackupImportSummary {
  success: boolean;
  pricesCount: number;
  bankItemsCount: number;
  shoppingItemsCount: number;
  coefficientsCount: number;
  salesVolumeCount: number;
  profilesCount: number;
  message: string;
}

/**
 * Recopila todos los datos del usuario en un objeto JSON completo para exportación.
 */
export function generateBackupData(): DbhdvBackupData {
  const activeProfile = getActivePriceProfile();
  const profiles = getPriceProfiles();
  const prices = getStoredMarketPrices();
  const priceUpdatedAt = getStoredPriceUpdatedAt();
  const bankInventory = getStoredBankInventory();
  const shoppingList = getShoppingList();
  const salesVolumeMap = getStoredSalesVolumeMap();
  const theme = getStoredTheme();

  // Extract all crushing coefficients from localStorage
  const crushingCoefficients: Record<string, Record<number, number>> = {};
  const crushingTimestamps: Record<string, Record<number, number>> = {};

  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('dofus_crushing_coeff_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            crushingCoefficients[key] = JSON.parse(raw);
          }
        } catch {}
      } else if (key.startsWith('dofus_crushing_ts_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            crushingTimestamps[key] = JSON.parse(raw);
          }
        } catch {}
      }
    }
  }

  // Custom persistent settings (sebuscalin, sand rose, etc.)
  const customSettings: Record<string, unknown> = {};
  if (typeof window !== 'undefined') {
    const sebus = localStorage.getItem('dofus_sebuscalin_unit_price_v1');
    if (sebus) customSettings.sebuscalinPrice = Number(sebus);
  }

  return {
    version: 1,
    appName: 'DBHDV',
    exportedAt: new Date().toISOString(),
    data: {
      activePriceProfileId: activeProfile?.id,
      profiles,
      prices,
      priceUpdatedAt,
      bankInventory,
      shoppingList,
      crushingCoefficients,
      crushingTimestamps,
      salesVolumeMap,
      theme,
      customSettings,
    },
  };
}

/**
 * Descarga el archivo de backup JSON en el navegador.
 */
export function downloadBackupFile(): void {
  const backup = generateBackupData();
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `dbhdv_backup_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Importa y restaura una copia de seguridad JSON.
 * @param jsonString Contenido JSON a importar
 * @param mode 'merge' para combinar con datos existentes o 'replace' para sobreescribir
 */
export async function importBackupJSON(
  jsonString: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<BackupImportSummary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('El archivo proporcionado no es un JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Formato de copia de seguridad no válido.');
  }

  const backup = parsed as DbhdvBackupData;
  const data = backup.data || (backup as unknown as DbhdvBackupData['data']);

  let pricesCount = 0;
  let bankItemsCount = 0;
  let shoppingItemsCount = 0;
  let coefficientsCount = 0;
  let salesVolumeCount = 0;
  let profilesCount = 0;

  // 1. Restore Prices
  if (data.prices && typeof data.prices === 'object') {
    const pricesMap: MarketPriceMap = {};
    for (const [idStr, price] of Object.entries(data.prices)) {
      const id = Number(idStr);
      const numPrice = Number(price);
      if (id > 0 && !isNaN(numPrice) && numPrice >= 0) {
        pricesMap[id] = numPrice;
        pricesCount++;
      }
    }

    if (mode === 'replace') {
      await saveAllMarketPrices(pricesMap);
    } else {
      const currentPrices = getStoredMarketPrices();
      await saveAllMarketPrices({ ...currentPrices, ...pricesMap });
    }
  }

  // 2. Restore Bank Inventory
  if (Array.isArray(data.bankInventory)) {
    if (mode === 'replace') {
      saveBankInventory(data.bankInventory);
      bankItemsCount = data.bankInventory.length;
    } else {
      const currentBank = getStoredBankInventory();
      const mergedMap: Record<number, BankInventoryItem> = {};
      for (const item of currentBank) {
        mergedMap[item.itemId] = { ...item };
      }
      for (const item of data.bankInventory) {
        if (!item?.itemId) continue;
        if (mergedMap[item.itemId]) {
          mergedMap[item.itemId].quantity += item.quantity || 1;
        } else {
          mergedMap[item.itemId] = { ...item };
        }
      }
      const mergedList = Object.values(mergedMap);
      saveBankInventory(mergedList);
      bankItemsCount = mergedList.length;
    }
  }

  // 3. Restore Shopping List
  if (Array.isArray(data.shoppingList)) {
    if (mode === 'replace') {
      saveShoppingList(data.shoppingList);
      shoppingItemsCount = data.shoppingList.length;
    } else {
      const currentList = getShoppingList();
      const map: Record<number, ShoppingListItem> = {};
      for (const item of currentList) {
        map[item.itemId] = { ...item };
      }
      for (const item of data.shoppingList) {
        if (!item?.itemId) continue;
        if (map[item.itemId]) {
          map[item.itemId].targetQuantity = Math.max(
            map[item.itemId].targetQuantity,
            item.targetQuantity || 1
          );
        } else {
          map[item.itemId] = { ...item };
        }
      }
      const merged = Object.values(map);
      saveShoppingList(merged);
      shoppingItemsCount = merged.length;
    }
  }

  // 4. Restore Crushing Coefficients
  if (data.crushingCoefficients && typeof data.crushingCoefficients === 'object') {
    if (typeof window !== 'undefined') {
      for (const [key, coeffMap] of Object.entries(data.crushingCoefficients)) {
        if (!key.startsWith('dofus_crushing_coeff_') || !coeffMap) continue;
        try {
          if (mode === 'replace') {
            localStorage.setItem(key, JSON.stringify(coeffMap));
            coefficientsCount += Object.keys(coeffMap).length;
          } else {
            const raw = localStorage.getItem(key);
            const current = raw ? JSON.parse(raw) : {};
            const merged = { ...current, ...coeffMap };
            localStorage.setItem(key, JSON.stringify(merged));
            coefficientsCount += Object.keys(coeffMap).length;
          }
        } catch {}
      }

      if (data.crushingTimestamps && typeof data.crushingTimestamps === 'object') {
        for (const [key, tsMap] of Object.entries(data.crushingTimestamps)) {
          if (!key.startsWith('dofus_crushing_ts_') || !tsMap) continue;
          try {
            localStorage.setItem(key, JSON.stringify(tsMap));
          } catch {}
        }
      }

      window.dispatchEvent(
        new CustomEvent('dofus_coefficients_updated', {
          detail: { bulk: true, imported: true },
        })
      );
    }
  }

  // 5. Restore Sales Volume
  if (data.salesVolumeMap && typeof data.salesVolumeMap === 'object') {
    for (const [idStr, volume] of Object.entries(data.salesVolumeMap)) {
      const id = Number(idStr);
      if (id > 0 && volume) {
        saveItemSalesVolume(id, volume);
        salesVolumeCount++;
      }
    }
  }

  // 6. Restore Theme & Custom Settings
  if (data.theme) {
    setStoredTheme(data.theme);
  }

  if (data.customSettings && typeof data.customSettings === 'object') {
    if (typeof window !== 'undefined') {
      if (typeof data.customSettings.sebuscalinPrice === 'number') {
        localStorage.setItem(
          'dofus_sebuscalin_unit_price_v1',
          String(data.customSettings.sebuscalinPrice)
        );
      }
    }
  }

  if (Array.isArray(data.profiles)) {
    profilesCount = data.profiles.length;
  }

  // Trigger full application state reload notifications
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dofus_database_updated'));
    window.dispatchEvent(new CustomEvent('dofus_prices_updated'));
    window.dispatchEvent(new CustomEvent('dofus_bank_inventory_updated'));
    window.dispatchEvent(new CustomEvent('dofus_shopping_list_updated'));
  }

  return {
    success: true,
    pricesCount,
    bankItemsCount,
    shoppingItemsCount,
    coefficientsCount,
    salesVolumeCount,
    profilesCount,
    message: `Restaurados con éxito: ${pricesCount} precios, ${bankItemsCount} ítems en banco, ${coefficientsCount} coeficientes de rompedora.`,
  };
}

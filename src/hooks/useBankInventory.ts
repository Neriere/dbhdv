import { useState, useEffect, useCallback, useMemo } from 'react';
import { BankInventoryItem } from '../types';
import {
  getStoredBankInventory,
  saveBankInventory,
  addOrUpdateBankItem,
  removeBankItem,
  clearBankInventory,
} from '../services/dofusDbService';

export interface UseBankInventoryReturn {
  bankInventory: BankInventoryItem[];
  bankQtyMap: Record<number, number>;
  getBankQty: (itemId: number) => number;
  updateBankItem: (itemId: number, quantity: number) => void;
  removeBankItem: (itemId: number) => void;
  saveInventory: (items: BankInventoryItem[]) => void;
  clearInventory: () => void;
}

/**
 * Hook centralizado y reactivo para acceder y gestionar el inventario del banco de Dofus.
 * Sincroniza automáticamente los cambios entre todas las pantallas de la aplicación.
 */
export function useBankInventory(): UseBankInventoryReturn {
  const [bankInventory, setBankInventory] = useState<BankInventoryItem[]>(() =>
    getStoredBankInventory()
  );

  useEffect(() => {
    const handleInventoryUpdated = () => {
      setBankInventory([...getStoredBankInventory()]);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('dofus_bank_inventory_updated', handleInventoryUpdated);
      window.addEventListener('dofus_database_updated', handleInventoryUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dofus_bank_inventory_updated', handleInventoryUpdated);
        window.removeEventListener('dofus_database_updated', handleInventoryUpdated);
      }
    };
  }, []);

  const bankQtyMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const item of bankInventory) {
      map[item.itemId] = (map[item.itemId] || 0) + item.quantity;
    }
    return map;
  }, [bankInventory]);

  const getBankQty = useCallback(
    (itemId: number): number => {
      return bankQtyMap[itemId] || 0;
    },
    [bankQtyMap]
  );

  const updateBankItem = useCallback((itemId: number, quantity: number) => {
    const updated = addOrUpdateBankItem(itemId, quantity);
    setBankInventory([...updated]);
  }, []);

  const handleRemoveBankItem = useCallback((itemId: number) => {
    const updated = removeBankItem(itemId);
    setBankInventory([...updated]);
  }, []);

  const handleSaveInventory = useCallback((items: BankInventoryItem[]) => {
    saveBankInventory(items);
    setBankInventory([...items]);
  }, []);

  const handleClearInventory = useCallback(() => {
    clearBankInventory();
    setBankInventory([]);
  }, []);

  return useMemo(
    () => ({
      bankInventory,
      bankQtyMap,
      getBankQty,
      updateBankItem,
      removeBankItem: handleRemoveBankItem,
      saveInventory: handleSaveInventory,
      clearInventory: handleClearInventory,
    }),
    [
      bankInventory,
      bankQtyMap,
      getBankQty,
      updateBankItem,
      handleRemoveBankItem,
      handleSaveInventory,
      handleClearInventory,
    ]
  );
}

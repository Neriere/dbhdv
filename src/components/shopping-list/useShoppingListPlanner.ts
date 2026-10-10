import { useState, useEffect, useMemo } from "react";
import { ShoppingListItem } from "../../types";
import {
  getShoppingList,
  updateShoppingListItemQuantity,
  removeFromShoppingList,
  clearShoppingList,
  getConsolidatedShoppingIngredients,
} from "../../services/dofusDbService";
import { useMarketPrices } from "../../hooks/useMarketPrices";
import { ConsolidatedShoppingIngredientWithChecked } from "./types";

export const useShoppingListPlanner = (onOpenQuickSearch?: () => void) => {
  const [items, setItems] = useState<ShoppingListItem[]>(getShoppingList());
  const { marketPrices, updatePrice } = useMarketPrices();
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [qtyInputs, setQtyInputs] = useState<Record<number, string>>({});

  const refreshList = () => {
    setItems(getShoppingList());
  };

  const handleOpenSearch = () => {
    if (onOpenQuickSearch) {
      onOpenQuickSearch();
    } else {
      setIsSearchModalOpen(true);
    }
  };

  useEffect(() => {
    window.addEventListener("dofus_shopping_list_updated", refreshList);
    return () => {
      window.removeEventListener("dofus_shopping_list_updated", refreshList);
    };
  }, []);

  const consolidatedIngredients: ConsolidatedShoppingIngredientWithChecked[] = useMemo(() => {
    const ings = getConsolidatedShoppingIngredients(items, marketPrices);
    return ings.map((ing) => ({
      ...ing,
      isChecked: Boolean(checkedMap[ing.itemId]),
    }));
  }, [items, marketPrices, checkedMap]);

  const totalCost = useMemo(() => {
    return consolidatedIngredients.reduce((acc, curr) => acc + curr.totalPrice, 0);
  }, [consolidatedIngredients]);

  const pendingCost = useMemo(() => {
    return consolidatedIngredients
      .filter((ing) => !ing.isChecked)
      .reduce((acc, curr) => acc + curr.totalPrice, 0);
  }, [consolidatedIngredients]);

  const unpricedCount = useMemo(() => {
    return consolidatedIngredients.filter((ing) => !ing.unitPrice || ing.unitPrice <= 0).length;
  }, [consolidatedIngredients]);

  const toggleChecked = (itemId: number) => {
    setCheckedMap((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSetExactQty = (itemId: number, qty: number) => {
    const validQty = Math.max(1, Math.min(99999, Math.floor(qty)));
    updateShoppingListItemQuantity(itemId, validQty);
    setQtyInputs((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    refreshList();
  };

  const handleUpdateQty = (itemId: number, delta: number) => {
    const existing = items.find((i) => i.itemId === itemId);
    if (!existing) return;
    const currentVal =
      qtyInputs[itemId] !== undefined
        ? parseInt(qtyInputs[itemId], 10) || existing.targetQuantity
        : existing.targetQuantity;
    const newQty = Math.max(1, currentVal + delta);
    handleSetExactQty(itemId, newQty);
  };

  const handleQtyInputChange = (itemId: number, val: string) => {
    const digitsOnly = val.replace(/[^0-9]/g, "");
    setQtyInputs((prev) => ({
      ...prev,
      [itemId]: digitsOnly,
    }));

    const num = parseInt(digitsOnly, 10);
    if (!isNaN(num) && num > 0 && num <= 99999) {
      updateShoppingListItemQuantity(itemId, num);
      refreshList();
    }
  };

  const handleCommitQty = (itemId: number) => {
    const rawVal = qtyInputs[itemId];
    if (rawVal === undefined) return;
    const num = parseInt(rawVal, 10);
    if (!isNaN(num) && num > 0) {
      handleSetExactQty(itemId, num);
    } else {
      const existing = items.find((i) => i.itemId === itemId);
      handleSetExactQty(itemId, existing ? existing.targetQuantity : 1);
    }
  };

  const handleCancelQty = (itemId: number) => {
    setQtyInputs((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    refreshList();
  };

  const handleSetAllQuantities = (qty: number) => {
    items.forEach((it) => {
      updateShoppingListItemQuantity(it.itemId, qty);
    });
    setQtyInputs({});
    refreshList();
  };

  const handleSaveInlinePrice = async (itemId: number) => {
    const num = Number(editPriceValue.replace(/[^0-9]/g, ""));
    if (!Number.isNaN(num) && num >= 0) {
      await updatePrice(itemId, num);
    }
    setEditingPriceId(null);
    setEditPriceValue("");
  };

  const handleCopyChatFormat = () => {
    if (consolidatedIngredients.length === 0) return;

    const lines = consolidatedIngredients.map(
      (ing) => `${ing.totalQuantityRequired}x ${ing.item?.name?.es || `Objeto #${ing.itemId}`}`
    );
    const text = `Lista de compra Dofus (${items.length} recetas):\n${lines.join(", ")}\nCosto total: ${totalCost.toLocaleString("es-ES")} K`;

    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearList = () => {
    if (confirm("¿Vaciar toda la lista de compras?")) {
      clearShoppingList();
      setCheckedMap({});
      refreshList();
    }
  };

  const handleRemoveItem = (itemId: number) => {
    removeFromShoppingList(itemId);
    refreshList();
  };

  return {
    items,
    consolidatedIngredients,
    totalCost,
    pendingCost,
    unpricedCount,
    qtyInputs,
    checkedMap,
    copied,
    editingPriceId,
    editPriceValue,
    isSearchModalOpen,
    setIsSearchModalOpen,
    setEditingPriceId,
    setEditPriceValue,
    toggleChecked,
    handleOpenSearch,
    handleSetExactQty,
    handleUpdateQty,
    handleQtyInputChange,
    handleCommitQty,
    handleCancelQty,
    handleSetAllQuantities,
    handleSaveInlinePrice,
    handleCopyChatFormat,
    handleClearList,
    handleRemoveItem,
  };
};

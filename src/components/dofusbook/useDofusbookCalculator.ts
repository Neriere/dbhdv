import { useState, useEffect, useMemo } from 'react';
import {
  DofusbookBuildAnalysis,
  ConsolidatedIngredient,
} from '../../types';
import {
  fetchDofusbookAnalysis,
  getActivePriceProfileId,
  saveMarketPrice,
  addDofusbookItemsToShoppingList,
  getItemById,
} from '../../services/dofusDbService';
import {
  DofusbookSetCalculatorProps,
  DofusbookFilterStatus,
  MaterialsFilter,
  ActiveTabSection,
  DofusbookComputedData,
  ProcessedDofusbookItem,
} from './types';
import {
  loadSavedDofusbookSession,
  saveDofusbookSession,
  buildSummaryClipboardText,
} from './utils';

export function useDofusbookCalculator({
  onNavigateToShopping,
}: DofusbookSetCalculatorProps = {}) {
  const savedSession = useMemo(() => loadSavedDofusbookSession(), []);

  const [urlInput, setUrlInput] = useState(() => savedSession?.urlInput || '');
  const [excludeDofus, setExcludeDofus] = useState(() => savedSession?.excludeDofus ?? true);
  const [excludeTrophies, setExcludeTrophies] = useState(() => savedSession?.excludeTrophies ?? false);
  const [activeProfileId, setActiveProfileId] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DofusbookBuildAnalysis | null>(() => savedSession?.analysis ?? null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [shoppingAddedToast, setShoppingAddedToast] = useState(false);
  const [activeTabSection, setActiveTabSection] = useState<ActiveTabSection>(
    () => savedSession?.activeTabSection ?? 'comparison'
  );
  const [showOnlyCraftable, setShowOnlyCraftable] = useState(
    () => savedSession?.showOnlyCraftable ?? false
  );
  const [filterStatus, setFilterStatus] = useState<DofusbookFilterStatus>(
    () => savedSession?.filterStatus ?? 'all'
  );
  const [editingPriceItemId, setEditingPriceItemId] = useState<number | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState<string>('');

  // Item ownership and exclusion state: itemKey -> boolean
  const [ownedItemKeys, setOwnedItemKeys] = useState<Record<string, boolean>>(
    () => savedSession?.ownedItemKeys ?? {}
  );
  const [removedItemKeys, setRemovedItemKeys] = useState<Record<string, boolean>>(
    () => savedSession?.removedItemKeys ?? {}
  );

  // Materials obtained state (temporary per set session)
  const [obtainedMaterialIds, setObtainedMaterialIds] = useState<Record<number, boolean>>(
    () => savedSession?.obtainedMaterialIds ?? {}
  );
  const [materialsFilter, setMaterialsFilter] = useState<MaterialsFilter>(
    () => savedSession?.materialsFilter ?? 'needed'
  );

  // Sync to localStorage on any state change
  useEffect(() => {
    if (analysis || urlInput) {
      saveDofusbookSession({
        urlInput,
        excludeDofus,
        excludeTrophies,
        analysis,
        ownedItemKeys,
        removedItemKeys,
        activeTabSection,
        showOnlyCraftable,
        filterStatus,
        obtainedMaterialIds,
        materialsFilter,
      });
    } else {
      saveDofusbookSession(null);
    }
  }, [
    urlInput,
    excludeDofus,
    excludeTrophies,
    analysis,
    ownedItemKeys,
    removedItemKeys,
    activeTabSection,
    showOnlyCraftable,
    filterStatus,
    obtainedMaterialIds,
    materialsFilter,
  ]);

  useEffect(() => {
    const handleDatabaseUpdated = () => {
      const newActiveProfileId = getActivePriceProfileId();
      setActiveProfileId((prevProfileId) => {
        if (prevProfileId !== newActiveProfileId) {
          if (analysis && (urlInput || analysis.url)) {
            fetchDofusbookAnalysis(urlInput || analysis.url, {
              excludeDofus,
              excludeTrophies,
              profileId: newActiveProfileId,
            })
              .then((data) => setAnalysis(data))
              .catch((err) => console.warn('Error re-fetching for updated profile:', err));
          }
          return newActiveProfileId;
        }
        return prevProfileId;
      });
    };

    setActiveProfileId(getActivePriceProfileId());
    window.addEventListener('dofus_database_updated', handleDatabaseUpdated);

    return () => {
      window.removeEventListener('dofus_database_updated', handleDatabaseUpdated);
    };
  }, [analysis, urlInput, excludeDofus, excludeTrophies]);

  const handleAnalyze = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || urlInput).trim();
    if (!targetUrl) {
      setError('Por favor ingresa un enlace de Dofusbook o código de build.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const data = await fetchDofusbookAnalysis(targetUrl, {
        excludeDofus,
        excludeTrophies,
        profileId: activeProfileId,
      });
      setAnalysis(data);
      setOwnedItemKeys({});
      setRemovedItemKeys({});
      setObtainedMaterialIds({});
      if (overrideUrl) {
        setUrlInput(overrideUrl);
      }
    } catch (err: any) {
      setError(
        err.message ||
          'Error al analizar el enlace de Dofusbook. Asegúrate de que el set sea público.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExcludeDofus = async () => {
    const nextVal = !excludeDofus;
    setExcludeDofus(nextVal);
    if (analysis && (urlInput || analysis.url)) {
      try {
        setIsLoading(true);
        const data = await fetchDofusbookAnalysis(urlInput || analysis.url, {
          excludeDofus: nextVal,
          excludeTrophies,
          profileId: activeProfileId,
        });
        setAnalysis(data);
      } catch (err) {
        console.warn(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleExcludeTrophies = async () => {
    const nextVal = !excludeTrophies;
    setExcludeTrophies(nextVal);
    if (analysis && (urlInput || analysis.url)) {
      try {
        setIsLoading(true);
        const data = await fetchDofusbookAnalysis(urlInput || analysis.url, {
          excludeDofus,
          excludeTrophies: nextVal,
          profileId: activeProfileId,
        });
        setAnalysis(data);
      } catch (err) {
        console.warn(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleItemExpand = (key: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAllRecipes = (itemsToExpand: ProcessedDofusbookItem[]) => {
    const next: Record<string, boolean> = {};
    itemsToExpand.forEach((it, idx) => {
      const itemKey = it.key || `${it.slotName}-${it.id || idx}`;
      if (it.ingredientsBreakdown.length > 0) {
        next[itemKey] = true;
      }
    });
    setExpandedItems(next);
  };

  const collapseAllRecipes = () => {
    setExpandedItems({});
  };

  const toggleItemOwned = (key: string) => {
    setOwnedItemKeys((prev) => {
      const isCurrentlyOwned = !!prev[key];
      const next = { ...prev };
      if (isCurrentlyOwned) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });

    if (removedItemKeys[key]) {
      setRemovedItemKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const toggleItemRemoved = (key: string) => {
    setRemovedItemKeys((prev) => {
      const isCurrentlyRemoved = !!prev[key];
      const next = { ...prev };
      if (isCurrentlyRemoved) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });

    if (ownedItemKeys[key]) {
      setOwnedItemKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const restoreItem = (key: string) => {
    setRemovedItemKeys((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const restoreAllRemoved = () => {
    setRemovedItemKeys({});
  };

  const removeOwnedItems = () => {
    if (!analysis) return;
    const newRemoved = { ...removedItemKeys };
    const newOwned = { ...ownedItemKeys };
    analysis.items.forEach((it, idx) => {
      const key = `${it.slotName}-${it.id || idx}`;
      if (ownedItemKeys[key]) {
        newRemoved[key] = true;
        delete newOwned[key];
      }
    });
    setRemovedItemKeys(newRemoved);
    setOwnedItemKeys(newOwned);
  };

  const markAllAsOwned = () => {
    if (!analysis) return;
    const newOwned: Record<string, boolean> = {};
    analysis.items.forEach((it, idx) => {
      const key = `${it.slotName}-${it.id || idx}`;
      if (!removedItemKeys[key]) {
        newOwned[key] = true;
      }
    });
    setOwnedItemKeys(newOwned);
  };

  const resetAllStatuses = () => {
    setOwnedItemKeys({});
    setRemovedItemKeys({});
    setObtainedMaterialIds({});
  };

  const toggleMaterialObtained = (itemId: number) => {
    setObtainedMaterialIds((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = true;
      }
      return next;
    });
  };

  const markAllMaterialsAsObtained = () => {
    if (!analysis) return;
    const next: Record<number, boolean> = {};
    computedData.consolidatedIngredients.forEach((mat) => {
      next[mat.itemId] = true;
    });
    setObtainedMaterialIds(next);
  };

  const resetObtainedMaterials = () => {
    setObtainedMaterialIds({});
  };

  const handleClearSet = () => {
    setAnalysis(null);
    setUrlInput('');
    setOwnedItemKeys({});
    setRemovedItemKeys({});
    setObtainedMaterialIds({});
    setMaterialsFilter('needed');
    setError(null);
    saveDofusbookSession(null);
  };

  const handleSavePrice = async (itemId: number, price: number) => {
    try {
      await saveMarketPrice(itemId, price);
      if (analysis) {
        setAnalysis((prev) => {
          if (!prev) return prev;
          const updatedItems = prev.items.map((it) => {
            if (it.id === itemId) {
              const marketPrice = price;
              let cheaperOption = it.cheaperOption;
              let savings = 0;
              if (it.isCraftable && it.craftCost > 0 && marketPrice > 0) {
                if (it.craftCost < marketPrice) {
                  cheaperOption = 'craft';
                  savings = marketPrice - it.craftCost;
                } else if (marketPrice < it.craftCost) {
                  cheaperOption = 'buy';
                  savings = it.craftCost - marketPrice;
                } else {
                  cheaperOption = 'equal';
                }
              }
              return { ...it, marketPrice, cheaperOption, savings };
            }

            const ingIdx = it.ingredientsBreakdown.findIndex((ing) => ing.id === itemId);
            if (ingIdx >= 0) {
              const updatedIngredients = it.ingredientsBreakdown.map((ing) =>
                ing.id === itemId
                  ? { ...ing, unitPrice: price, totalPrice: ing.quantity * price }
                  : ing
              );
              const craftCost = updatedIngredients.reduce((sum, ing) => sum + ing.totalPrice, 0);
              let cheaperOption = it.cheaperOption;
              let savings = 0;
              if (it.isCraftable && craftCost > 0 && it.marketPrice > 0) {
                if (craftCost < it.marketPrice) {
                  cheaperOption = 'craft';
                  savings = it.marketPrice - craftCost;
                } else if (it.marketPrice < craftCost) {
                  cheaperOption = 'buy';
                  savings = craftCost - it.marketPrice;
                } else {
                  cheaperOption = 'equal';
                }
              }
              return {
                ...it,
                ingredientsBreakdown: updatedIngredients,
                craftCost,
                cheaperOption,
                savings,
              };
            }

            return it;
          });

          return {
            ...prev,
            items: updatedItems,
          };
        });
      }
    } catch (err) {
      console.error('Error saving price:', err);
    } finally {
      setEditingPriceItemId(null);
    }
  };

  // Recomputed Totals, Progress, and Consolidated Ingredients dynamically
  const computedData = useMemo<DofusbookComputedData>(() => {
    if (!analysis) {
      return {
        items: [],
        totals: {
          totalCraftCost: 0,
          totalMarketPrice: 0,
          totalOptimalCost: 0,
          totalSavings: 0,
          craftablePiecesCount: 0,
          excludedDofusCount: 0,
          excludedTrophiesCount: 0,
          totalPieces: 0,
        },
        consolidatedIngredients: [],
        neededIngredients: [],
        obtainedIngredients: [],
        totalAllMaterialsCost: 0,
        totalNeededMaterialsCost: 0,
        totalObtainedMaterialsCost: 0,
        materialsProgressPercent: 0,
        ownedCount: 0,
        removedCount: 0,
        neededCount: 0,
        activePiecesCount: 0,
        progressPercent: 0,
      };
    }

    let totalCraftCost = 0;
    let totalMarketPrice = 0;
    let totalOptimalCost = 0;
    let craftablePiecesCount = 0;
    let excludedDofusCount = 0;
    let excludedTrophiesCount = 0;
    let ownedCount = 0;
    let removedCount = 0;
    let neededCount = 0;

    const activeConsolidatedMap = new Map<number, ConsolidatedIngredient>();

    const processedItems: ProcessedDofusbookItem[] = analysis.items.map((it, idx) => {
      const key = `${it.slotName}-${it.id || idx}`;
      const isOwned = !!ownedItemKeys[key];
      const isRemoved = !!removedItemKeys[key];
      const isDofusExcluded = it.isDofus && excludeDofus;
      const isTrophyExcluded = it.isTrophy && excludeTrophies;

      if (it.isDofus && excludeDofus) excludedDofusCount++;
      if (it.isTrophy && excludeTrophies) excludedTrophiesCount++;

      if (isRemoved) {
        removedCount++;
      } else if (isOwned) {
        ownedCount++;
      } else {
        neededCount++;
      }

      const isPayable = !isRemoved && !isOwned && !isDofusExcluded && !isTrophyExcluded;

      if (isPayable) {
        if (it.isCraftable) craftablePiecesCount++;

        if (it.craftCost > 0) totalCraftCost += it.craftCost;
        else if (it.marketPrice > 0) totalCraftCost += it.marketPrice;

        if (it.marketPrice > 0) totalMarketPrice += it.marketPrice;
        else if (it.craftCost > 0) totalMarketPrice += it.craftCost;

        const opt =
          it.craftCost > 0 && it.marketPrice > 0
            ? Math.min(it.craftCost, it.marketPrice)
            : it.craftCost > 0
            ? it.craftCost
            : it.marketPrice;
        totalOptimalCost += opt;

        if (it.isCraftable && it.ingredientsBreakdown.length > 0) {
          for (const ing of it.ingredientsBreakdown) {
            const existing = activeConsolidatedMap.get(ing.id);
            if (existing) {
              existing.totalQuantityRequired += ing.quantity;
              existing.totalPrice += ing.totalPrice;
            } else {
              activeConsolidatedMap.set(ing.id, {
                itemId: ing.id,
                totalQuantityRequired: ing.quantity,
                unitPrice: ing.unitPrice,
                totalPrice: ing.totalPrice,
                item: getItemById(ing.id),
              });
            }
          }
        }
      }

      return {
        ...it,
        key,
        isOwned,
        isRemoved,
        isPayable,
      };
    });

    const totalSavings = Math.max(0, Math.max(totalCraftCost, totalMarketPrice) - totalOptimalCost);
    const activePiecesCount = analysis.items.length - removedCount;
    const progressPercent = activePiecesCount > 0 ? Math.round((ownedCount / activePiecesCount) * 100) : 0;

    const consolidatedIngredients = Array.from(activeConsolidatedMap.values())
      .map((mat) => ({
        ...mat,
        isObtained: !!obtainedMaterialIds[mat.itemId],
      }))
      .sort((a, b) => b.totalPrice - a.totalPrice);

    const neededIngredients = consolidatedIngredients.filter((mat) => !mat.isObtained);
    const obtainedIngredients = consolidatedIngredients.filter((mat) => mat.isObtained);

    const totalAllMaterialsCost = consolidatedIngredients.reduce((sum, m) => sum + m.totalPrice, 0);
    const totalNeededMaterialsCost = neededIngredients.reduce((sum, m) => sum + m.totalPrice, 0);
    const totalObtainedMaterialsCost = obtainedIngredients.reduce((sum, m) => sum + m.totalPrice, 0);
    const materialsProgressPercent =
      consolidatedIngredients.length > 0
        ? Math.round((obtainedIngredients.length / consolidatedIngredients.length) * 100)
        : 0;

    return {
      items: processedItems,
      totals: {
        totalCraftCost,
        totalMarketPrice,
        totalOptimalCost,
        totalSavings,
        craftablePiecesCount,
        excludedDofusCount,
        excludedTrophiesCount,
        totalPieces: analysis.items.length,
      },
      consolidatedIngredients,
      neededIngredients,
      obtainedIngredients,
      totalAllMaterialsCost,
      totalNeededMaterialsCost,
      totalObtainedMaterialsCost,
      materialsProgressPercent,
      ownedCount,
      removedCount,
      neededCount,
      activePiecesCount,
      progressPercent,
    };
  }, [analysis, ownedItemKeys, removedItemKeys, obtainedMaterialIds, excludeDofus, excludeTrophies]);

  const handleSendToShoppingList = () => {
    if (!analysis) return;

    const itemsToAdd = computedData.items
      .filter((it) => {
        if (!it.item) return false;
        if (it.isOwned || it.isRemoved) return false;
        if (it.isDofus && excludeDofus) return false;
        if (it.isTrophy && excludeTrophies) return false;
        return it.isCraftable && it.cheaperOption === 'craft';
      })
      .map((it) => ({
        item: it.item!,
        recipe: it.recipe,
        quantity: 1,
      }));

    if (itemsToAdd.length === 0) {
      const fallbackToAdd = computedData.items
        .filter((it) => it.item && it.isCraftable && !it.isOwned && !it.isRemoved)
        .map((it) => ({
          item: it.item!,
          recipe: it.recipe,
          quantity: 1,
        }));
      if (fallbackToAdd.length > 0) {
        addDofusbookItemsToShoppingList(fallbackToAdd);
      }
    } else {
      addDofusbookItemsToShoppingList(itemsToAdd);
    }

    setShoppingAddedToast(true);
    setTimeout(() => setShoppingAddedToast(false), 3500);
  };

  const handleCopySummary = () => {
    if (!analysis) return;
    const text = buildSummaryClipboardText(analysis, computedData);
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const filteredItems = useMemo(() => {
    return computedData.items.filter((it) => {
      if (showOnlyCraftable && !it.isCraftable) return false;
      if (filterStatus === 'needed') {
        return !it.isOwned && !it.isRemoved;
      }
      if (filterStatus === 'owned') {
        return it.isOwned;
      }
      if (filterStatus === 'removed') {
        return it.isRemoved;
      }
      return !it.isRemoved;
    });
  }, [computedData.items, showOnlyCraftable, filterStatus]);

  return {
    urlInput,
    setUrlInput,
    excludeDofus,
    excludeTrophies,
    isLoading,
    error,
    analysis,
    expandedItems,
    copiedSummary,
    shoppingAddedToast,
    activeTabSection,
    setActiveTabSection,
    showOnlyCraftable,
    setShowOnlyCraftable,
    filterStatus,
    setFilterStatus,
    editingPriceItemId,
    setEditingPriceItemId,
    tempPriceInput,
    setTempPriceInput,
    ownedItemKeys,
    removedItemKeys,
    obtainedMaterialIds,
    materialsFilter,
    setMaterialsFilter,
    computedData,
    filteredItems,
    handleAnalyze,
    toggleExcludeDofus,
    toggleExcludeTrophies,
    toggleItemExpand,
    expandAllRecipes: () => expandAllRecipes(filteredItems),
    collapseAllRecipes,
    toggleItemOwned,
    toggleItemRemoved,
    restoreItem,
    restoreAllRemoved,
    removeOwnedItems,
    markAllAsOwned,
    resetAllStatuses,
    toggleMaterialObtained,
    markAllMaterialsAsObtained,
    resetObtainedMaterials,
    handleClearSet,
    handleSavePrice,
    handleSendToShoppingList,
    handleCopySummary,
    onNavigateToShopping,
  };
}

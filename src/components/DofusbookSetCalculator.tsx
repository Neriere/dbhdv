import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Link as LinkIcon,
  Search,
  ExternalLink,
  Coins,
  Hammer,
  ShoppingCart,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Info,
  Shield,
  Layers,
  Wrench,
  Zap,
  Tag,
  EyeOff,
  Eye,
  SlidersHorizontal,
  Package,
  Trash2,
  RotateCcw,
  PackageCheck,
  CheckCheck,
  X,
  FilePlus,
  Filter,
  CheckSquare,
  Square,
  FolderOpen,
  FolderClosed,
} from 'lucide-react';
import {
  DofusbookBuildAnalysis,
  DofusbookEquipmentItem,
  DofusItem,
  ConsolidatedIngredient,
} from '../types';
import {
  fetchDofusbookAnalysis,
  getActivePriceProfileId,
  saveMarketPrice,
  addDofusbookItemsToShoppingList,
  getItemIconUrl,
  getItemFallbackIconUrl,
  getItemById,
} from '../services/dofusDbService';
import { SafeImage } from './SafeImage';
import { formatKamas } from '../utils/kamaFormatters';

interface DofusbookSetCalculatorProps {
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onNavigateToShopping?: () => void;
}

const DOFUSBOOK_SESSION_STORAGE_KEY = 'dofus_dofusbook_cached_session_v1';

interface DofusbookSavedSession {
  urlInput: string;
  excludeDofus: boolean;
  excludeTrophies: boolean;
  analysis: DofusbookBuildAnalysis | null;
  ownedItemKeys: Record<string, boolean>;
  removedItemKeys: Record<string, boolean>;
  activeTabSection: 'comparison' | 'materials';
  showOnlyCraftable: boolean;
  filterStatus: 'all' | 'needed' | 'owned' | 'removed';
  obtainedMaterialIds?: Record<number, boolean>;
  materialsFilter?: 'needed' | 'obtained' | 'all';
}

function loadSavedDofusbookSession(): DofusbookSavedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DOFUSBOOK_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Error loading cached Dofusbook session:', e);
    return null;
  }
}

export const DofusbookSetCalculator: React.FC<DofusbookSetCalculatorProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onNavigateToShopping,
}) => {
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
  const [activeTabSection, setActiveTabSection] = useState<'comparison' | 'materials'>(
    () => savedSession?.activeTabSection ?? 'comparison'
  );
  const [showOnlyCraftable, setShowOnlyCraftable] = useState(
    () => savedSession?.showOnlyCraftable ?? false
  );
  const [filterStatus, setFilterStatus] = useState<'all' | 'needed' | 'owned' | 'removed'>(
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
  const [materialsFilter, setMaterialsFilter] = useState<'needed' | 'obtained' | 'all'>(
    () => savedSession?.materialsFilter ?? 'needed'
  );

  // Sync to localStorage on any state change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (analysis || urlInput) {
        const stateToSave: DofusbookSavedSession = {
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
        };
        localStorage.setItem(DOFUSBOOK_SESSION_STORAGE_KEY, JSON.stringify(stateToSave));
      } else {
        localStorage.removeItem(DOFUSBOOK_SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Error saving Dofusbook session to localStorage:', e);
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
          // If we have an active analysis, refresh it with the new profile prices
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
      // Reset item custom statuses on new build
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

  const expandAllRecipes = () => {
    const next: Record<string, boolean> = {};
    filteredItems.forEach((it, idx) => {
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

  // Ownership & Removal actions
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

    // If it was marked as removed, restore it
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

    // If it was marked as owned, un-own it
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DOFUSBOOK_SESSION_STORAGE_KEY);
    }
  };

  const handleSavePrice = async (itemId: number, price: number) => {
    try {
      await saveMarketPrice(itemId, price);
      // Update price locally in analysis
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

            // Also check if it was an ingredient in any recipe
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
  const computedData = useMemo(() => {
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
        consolidatedIngredients: [] as (ConsolidatedIngredient & { isObtained?: boolean })[],
        neededIngredients: [] as (ConsolidatedIngredient & { isObtained?: boolean })[],
        obtainedIngredients: [] as (ConsolidatedIngredient & { isObtained?: boolean })[],
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

    const processedItems = analysis.items.map((it, idx) => {
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

      // Payable if needed (not removed, not owned, not excluded)
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

        // Consolidate ingredients for needed items that have recipe
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

    // Send only craftable items in the build that are NOT owned, NOT removed, and NOT excluded
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
      // If none marked strictly as cheaper craft, add all needed items that have recipes
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

    const lines = [
      `=== ANÁLISIS DE SET DOFUSBOOK ===`,
      `Set: ${analysis.buildName} ${analysis.buildLevel ? `(Nivel ${analysis.buildLevel})` : ''}`,
      `Enlace: ${analysis.url}`,
      `Progreso: ${computedData.ownedCount} de ${computedData.activePiecesCount} piezas obtenidas (${computedData.progressPercent}%)`,
      ``,
      `RESUMEN DE COSTES PENDIENTES:`,
      `- Total Compra Directa (HDV): ${formatKamas(computedData.totals.totalMarketPrice)}`,
      `- Total Coste Crafteo: ${formatKamas(computedData.totals.totalCraftCost)}`,
      `- Total Estrategia Óptima: ${formatKamas(computedData.totals.totalOptimalCost)}`,
      `- Ahorro Estimado: ${formatKamas(computedData.totals.totalSavings)}`,
      ``,
      `DETALLE POR PIEZA:`,
    ];

    computedData.items.forEach((it) => {
      const name = it.item?.name?.es || it.rawName;
      if (it.isRemoved) {
        lines.push(`* [DESCARTADO] ${it.slotName}: ${name} (Eliminado del cálculo)`);
        return;
      }
      if (it.isOwned) {
        lines.push(`* [✓ YA OBTENIDO] ${it.slotName}: ${name} (En posesión - 0 K pendientes)`);
        return;
      }
      const craft = it.craftCost > 0 ? `${formatKamas(it.craftCost)}` : 'Sin precio';
      const hdv = it.marketPrice > 0 ? `${formatKamas(it.marketPrice)}` : 'Sin precio';
      const verdict =
        it.cheaperOption === 'craft'
          ? `[CRAFTEAR - Ahorras ${formatKamas(it.savings)}]`
          : it.cheaperOption === 'buy'
          ? `[COMPRAR - Ahorras ${formatKamas(it.savings)}]`
          : it.cheaperOption === 'dofus_excluded'
          ? `[DOFUS EXCLUIDO]`
          : `[-]`;

      lines.push(
        `* ${it.slotName}: ${name} (Lvl ${it.item?.level || '?'}) | Crafteo: ${craft} | HDV: ${hdv} ${verdict}`
      );
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const filteredItems = computedData.items.filter((it) => {
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
    // 'all': Show only active pieces
    return !it.isRemoved;
  });

  return (
    <div className="space-y-5 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Estimado de set de <span className="text-amber-400">Dofusbook</span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              Coloca el enlace para desglosar el costo y marca los objetos que ya posees o deseas descartar
            </p>
          </div>
        </div>

        {/* Input & Options Form */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <LinkIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="Pega el enlace de Dofusbook (ej: https://d-bk.net/fr/d/10s7V o código 10s7V)..."
                className="w-full pl-10 pr-24 py-2.5 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-amber-500 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-xl outline-none transition-all shadow-inner font-mono"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => setUrlInput('')}
                  className="absolute inset-y-0 right-16 pr-2 flex items-center text-xs text-slate-500 hover:text-slate-300"
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                      setUrlInput(text);
                      handleAnalyze(text);
                    }
                  } catch {}
                }}
                className="absolute inset-y-1.5 right-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700/60"
                title="Pegar del portapapeles"
              >
                Pegar
              </button>
            </div>

            <button
              onClick={() => handleAnalyze()}
              disabled={isLoading || !urlInput.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analizando Set...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Analizar Set</span>
                </>
              )}
            </button>
          </div>

          {/* Toggles Row */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-1 text-xs">
            {/* Exclude Dofus toggle (Active by default) */}
            <button
              type="button"
              onClick={toggleExcludeDofus}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold text-xs transition-all cursor-pointer ${
                excludeDofus
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Excluir los Dofus del cálculo de precio del set"
            >
              {excludeDofus ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
              <span>Excluir Dofus</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
                {excludeDofus ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Exclude Trophies toggle */}
            <button
              type="button"
              onClick={toggleExcludeTrophies}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold text-xs transition-all cursor-pointer ${
                excludeTrophies
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Excluir trofeos del cálculo"
            >
              <span>Excluir Trofeos</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-700 text-slate-300 font-mono">
                {excludeTrophies ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">No se pudo cargar el set:</span>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Analysis Results View */}
      {analysis && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Build Info & Progress Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shrink-0">
                  <Shield className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-white">{analysis.buildName}</h3>
                    {analysis.buildLevel && (
                      <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-md">
                        Nivel {analysis.buildLevel}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-medium rounded-md border border-slate-700">
                      {analysis.items.length} piezas en build
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="truncate max-w-xs font-mono">{analysis.url}</span>
                    {analysis.resolvedUrl && (
                      <a
                        href={analysis.resolvedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Ver en Dofusbook</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Build Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleClearSet}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                  title="Limpiar el set actual y cargar otro"
                >
                  <X className="w-3 h-3 text-rose-400" />
                  <span>Nuevo Set</span>
                </button>

                {computedData.ownedCount > 0 && (
                  <button
                    type="button"
                    onClick={removeOwnedItems}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                    title="Eliminar de la sección todas las piezas ya obtenidas"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>Eliminar obtenidas ({computedData.ownedCount})</span>
                  </button>
                )}

                {computedData.ownedCount > 0 || computedData.removedCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetAllStatuses}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                    title="Reiniciar todos los objetos a pendientes"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reiniciar estados</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={markAllAsOwned}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                    title="Marcar todas las piezas como ya obtenidas"
                  >
                    <CheckCheck className="w-3 h-3 text-emerald-400" />
                    <span>Marcar todo obtenido</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer shadow-sm"
                  title="Copiar resumen con costes pendientes al portapapeles"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copiar Resumen</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendToShoppingList}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  title="Añadir ingredientes de piezas pendientes a la lista de compras"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Enviar Materiales Pendientes a Compras</span>
                </button>
              </div>
            </div>

            {/* Set Progression Bar */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-emerald-400" />
                    Progreso del Set:
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {computedData.ownedCount} de {computedData.activePiecesCount} piezas listas
                  </span>
                  {computedData.removedCount > 0 && (
                    <span className="text-slate-500 text-[11px]">
                      ({computedData.removedCount} descartada{computedData.removedCount > 1 ? 's' : ''})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">
                    Faltan:{' '}
                    <strong className="text-amber-400 font-mono font-bold">
                      {computedData.neededCount} piezas
                    </strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs border border-emerald-500/30">
                    {computedData.progressPercent}%
                  </span>
                </div>
              </div>

              {/* Visual Progress Track */}
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                  style={{ width: `${computedData.progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Set Completed Banner */}
            {computedData.activePiecesCount > 0 && computedData.neededCount === 0 && (
              <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-emerald-950/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-white flex items-center gap-2">
                      ¡Set Completado al 100%!
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-normal">
                        Todas las piezas obtenidas
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      Has terminado de conseguir todo lo necesario para este set. Puedes limpiar la sección para comenzar con otro set.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleClearSet}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Limpiar Sección y Cargar Nuevo Set</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toast Notification */}
          {shoppingAddedToast && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 p-3 rounded-xl flex items-center justify-between text-emerald-300 text-xs shadow-lg animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>¡Materiales de las piezas pendientes añadidos al Planificador de Compras con éxito!</span>
              </div>
              {onNavigateToShopping && (
                <button
                  type="button"
                  onClick={onNavigateToShopping}
                  className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-black rounded-lg text-[11px] hover:bg-emerald-400 transition-colors"
                >
                  Ver Lista
                </button>
              )}
            </div>
          )}

          {/* Financial KPI Summary Cards (Calculated on Pending Pieces) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Direct Market Buy Total */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-sky-400" />
                  Compra Directa (HDV)
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  {computedData.neededCount} pendientes
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                {formatKamas(computedData.totals.totalMarketPrice)}
              </div>
              <p className="text-[11px] text-slate-400">
                Coste si compras en mercadillo todas las piezas que aún te faltan.
              </p>
            </div>

            {/* Crafting Cost Total */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5 text-amber-400" />
                  Coste de Crafteo
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  {computedData.totals.craftablePiecesCount} crafteables
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono tracking-tight">
                {formatKamas(computedData.totals.totalCraftCost)}
              </div>
              <p className="text-[11px] text-slate-400">
                Coste de materiales para fabricar las piezas que te faltan.
              </p>
            </div>

            {/* Optimal Strategy Mix */}
            <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-1 shadow-md">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  Mix Óptimo Pendiente
                </span>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Recomendado
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono tracking-tight">
                {formatKamas(computedData.totals.totalOptimalCost)}
              </div>
              <p className="text-[11px] text-slate-400">
                Presupuesto real para completar tu set combinando crafteo y compra.
              </p>
            </div>

            {/* Savings Total */}
            <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-1 shadow-md">
              <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                  Ahorro Máximo
                </span>
                <span className="text-[10px] uppercase font-bold text-amber-500">
                  {computedData.totals.totalMarketPrice > 0
                    ? `${Math.round(
                        (computedData.totals.totalSavings /
                          Math.max(1, computedData.totals.totalMarketPrice)) *
                          100
                      )}%`
                    : '0%'}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
                +{formatKamas(computedData.totals.totalSavings)}
              </div>
              <p className="text-[11px] text-slate-400">
                Kamas ahorradas optimizando cada pieza pendiente individualmente.
              </p>
            </div>
          </div>

          {/* Tab Navigation & Status Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTabSection('comparison')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTabSection === 'comparison'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Desglose por Pieza ({computedData.activePiecesCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTabSection('materials')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTabSection === 'materials'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Materiales Requeridos ({computedData.consolidatedIngredients.length})</span>
              </button>
            </div>

            {/* Sub-Filters for Piezas */}
            {activeTabSection === 'comparison' && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Segmented Buttons */}
                <div className="bg-slate-950 border border-slate-800 p-0.5 rounded-xl flex items-center text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      filterStatus === 'all'
                        ? 'bg-slate-800 text-white font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos ({computedData.activePiecesCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterStatus('needed')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      filterStatus === 'needed'
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                        : 'text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    <span>Pendientes</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                      {computedData.neededCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterStatus('owned')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      filterStatus === 'owned'
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-400 hover:text-emerald-400'
                    }`}
                  >
                    <span>Obtenidos</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      {computedData.ownedCount}
                    </span>
                  </button>

                  {computedData.removedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterStatus('removed')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                        filterStatus === 'removed'
                          ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                          : 'text-slate-400 hover:text-rose-400'
                      }`}
                    >
                      <span>Descartados</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                        {computedData.removedCount}
                      </span>
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-1">
                  <input
                    type="checkbox"
                    checked={showOnlyCraftable}
                    onChange={(e) => setShowOnlyCraftable(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Solo con receta</span>
                </label>
              </div>
            )}
          </div>

          {/* Banner if items are removed */}
          {computedData.removedCount > 0 && filterStatus !== 'removed' && (
            <div className="bg-slate-950 border border-slate-800/80 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  Hay <strong>{computedData.removedCount} pieza(s)</strong> eliminadas/descartadas de la sección.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterStatus('removed')}
                  className="text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Ver descartadas
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={restoreAllRemoved}
                  className="text-slate-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar todas</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: Comparison Table */}
          {activeTabSection === 'comparison' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {/* Quick Table Subheader Controls */}
              {filteredItems.some((it) => it.ingredientsBreakdown.length > 0) && (
                <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Recetas de fabricación del set:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={expandAllRecipes}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Desplegar todas las listas de materiales de cada objeto"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>Desplegar todas las recetas</span>
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllRecipes}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Plegar todas las recetas"
                    >
                      <FolderClosed className="w-3.5 h-3.5" />
                      <span>Plegar todas</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-3 sm:px-4">Ranura / Objeto</th>
                      <th className="py-3 px-3 text-center">Nivel / Tipo</th>
                      <th className="py-3 px-3 text-right">Coste Crafteo</th>
                      <th className="py-3 px-3 text-right">Precio HDV</th>
                      <th className="py-3 px-3 text-center">Estado / Veredicto</th>
                      <th className="py-3 px-3 text-center">Ahorro</th>
                      <th className="py-3 px-3 text-center">Gestión & Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto py-2">
                            <PackageCheck className="w-8 h-8 text-slate-600" />
                            <p className="font-semibold text-slate-300 text-sm">
                              {computedData.activePiecesCount === 0
                                ? 'Has eliminado o descartado todas las piezas de este set.'
                                : filterStatus === 'needed' && computedData.neededCount === 0
                                ? '¡Felicidades! Ya has obtenido todas las piezas activas del set.'
                                : 'No hay piezas que coincidan con el filtro seleccionado.'}
                            </p>
                            {computedData.removedCount > 0 && (
                              <button
                                type="button"
                                onClick={restoreAllRemoved}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 mt-2 cursor-pointer border border-slate-700"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restaurar {computedData.removedCount} piezas descartadas</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((it, idx) => {
                        const itemKey = it.key || `${it.slotName}-${it.id || idx}`;
                        const isExpanded = !!expandedItems[itemKey];
                        const isEditingPrice = editingPriceItemId === it.id;
                        const isOwned = it.isOwned;
                        const isRemoved = it.isRemoved;

                        return (
                          <React.Fragment key={itemKey}>
                            <tr
                              className={`transition-colors group ${
                                isOwned
                                  ? 'bg-emerald-950/20 border-l-4 border-l-emerald-500 hover:bg-emerald-950/30'
                                  : isRemoved
                                  ? 'bg-rose-950/10 border-l-4 border-l-rose-500/50 opacity-60 hover:bg-rose-950/20'
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Slot & Item Name */}
                              <td className="py-3 px-3 sm:px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner relative">
                                    {it.item ? (
                                      <SafeImage
                                        src={getItemIconUrl(it.item)}
                                        fallbackSrc={getItemFallbackIconUrl(it.item)}
                                        alt={it.item.name?.es || it.rawName}
                                        className="w-8 h-8 object-contain"
                                      />
                                    ) : (
                                      <Shield className="w-4 h-4 text-slate-500" />
                                    )}

                                    {isOwned && (
                                      <div className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                                        {it.slotName}
                                      </span>
                                      {it.isDofus && (
                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          DOFUS
                                        </span>
                                      )}
                                      {it.isTrophy && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                          TROFEO
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={`font-bold text-xs sm:text-sm transition-colors ${
                                        isOwned
                                          ? 'text-emerald-300'
                                          : isRemoved
                                          ? 'text-slate-400 line-through'
                                          : 'text-white group-hover:text-amber-300'
                                      }`}
                                    >
                                      {it.item?.name?.es || it.rawName}
                                    </div>
                                    {it.item?.name?.fr && it.item.name.fr !== it.item.name.es && (
                                      <div className="text-[11px] text-slate-500 font-normal truncate">
                                        FR: {it.item.name.fr}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Level / Type */}
                              <td className="py-3 px-3 text-center">
                                <div className="font-bold text-slate-200">
                                  {it.item?.level ? `Nv. ${it.item.level}` : '-'}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[110px] mx-auto">
                                  {it.item?.type?.name?.es || '-'}
                                </div>
                              </td>

                              {/* Craft Cost */}
                              <td className="py-3 px-3 text-right font-mono">
                                {isOwned ? (
                                  <div className="space-y-0.5">
                                    <span className="text-slate-500 line-through text-xs block">
                                      {formatKamas(it.craftCost)}
                                    </span>
                                    <span className="text-emerald-400 text-[11px] font-bold">0 K (Obtenido)</span>
                                  </div>
                                ) : isRemoved ? (
                                  <span className="text-slate-600 text-xs italic">Descartado</span>
                                ) : it.isCraftable && it.craftCost > 0 ? (
                                  <div className="space-y-0.5">
                                    <div className="font-black text-amber-300">
                                      {formatKamas(it.craftCost)}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleItemExpand(itemKey)}
                                      className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-0.5 ml-auto font-sans font-semibold cursor-pointer"
                                    >
                                      <span>{it.ingredientsBreakdown.length} mats</span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3 h-3" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                ) : it.isCraftable ? (
                                  <span className="text-slate-500 text-xs italic">Faltan precios</span>
                                ) : (
                                  <span className="text-slate-600 text-xs">Sin receta</span>
                                )}
                              </td>

                              {/* Market HDV Price (Editable) */}
                              <td className="py-3 px-3 text-right font-mono">
                                {isOwned ? (
                                  <div className="space-y-0.5">
                                    <span className="text-slate-500 line-through text-xs block">
                                      {formatKamas(it.marketPrice)}
                                    </span>
                                    <span className="text-emerald-400 text-[11px] font-bold">0 K (Obtenido)</span>
                                  </div>
                                ) : isRemoved ? (
                                  <span className="text-slate-600 text-xs italic">Descartado</span>
                                ) : isEditingPrice ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      value={tempPriceInput}
                                      onChange={(e) => setTempPriceInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSavePrice(it.id, Number(tempPriceInput) || 0);
                                        } else if (e.key === 'Escape') {
                                          setEditingPriceItemId(null);
                                        }
                                      }}
                                      autoFocus
                                      className="w-24 px-1.5 py-0.5 bg-slate-950 border border-amber-500 text-right text-xs rounded text-amber-300 font-mono outline-none"
                                    />
                                    <button
                                      onClick={() =>
                                        handleSavePrice(it.id, Number(tempPriceInput) || 0)
                                      }
                                      className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => {
                                      if (it.id > 0) {
                                        setEditingPriceItemId(it.id);
                                        setTempPriceInput(String(it.marketPrice || ''));
                                      }
                                    }}
                                    className="group/price cursor-pointer"
                                    title="Haz clic para modificar el precio de mercado"
                                  >
                                    {it.marketPrice > 0 ? (
                                      <div className="font-bold text-slate-200 group-hover/price:text-amber-400 transition-colors flex items-center justify-end gap-1">
                                        <span>{formatKamas(it.marketPrice)}</span>
                                        <Tag className="w-2.5 h-2.5 opacity-0 group-hover/price:opacity-100 text-slate-500" />
                                      </div>
                                    ) : (
                                      <span className="text-slate-500 text-xs italic group-hover/price:text-amber-400">
                                        + Añadir precio
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Verdict / Status */}
                              <td className="py-3 px-3 text-center">
                                {isOwned ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs shadow-sm">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    YA OBTENIDO
                                  </span>
                                ) : isRemoved ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs">
                                    <Trash2 className="w-3 h-3 text-rose-400" />
                                    DESCARTADO
                                  </span>
                                ) : it.cheaperOption === 'craft' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-xs">
                                    <Hammer className="w-3 h-3" />
                                    Craftear
                                  </span>
                                ) : it.cheaperOption === 'buy' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-black text-xs">
                                    <ShoppingCart className="w-3 h-3" />
                                    Comprar HDV
                                  </span>
                                ) : it.cheaperOption === 'equal' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-xs">
                                    Mismo precio
                                  </span>
                                ) : it.cheaperOption === 'dofus_excluded' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300/80 font-semibold text-xs">
                                    Dofus (Excluido)
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-xs">Comprar</span>
                                )}
                              </td>

                              {/* Savings */}
                              <td className="py-3 px-3 text-center font-mono">
                                {isOwned || isRemoved ? (
                                  <span className="text-slate-600 text-xs">-</span>
                                ) : it.savings > 0 ? (
                                  <span className="text-emerald-400 font-black text-xs">
                                    +{formatKamas(it.savings)}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">-</span>
                                )}
                              </td>

                              {/* Actions / Management Buttons */}
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* TOGGLE YA OBTENIDO BUTTON */}
                                  <button
                                    type="button"
                                    onClick={() => toggleItemOwned(itemKey)}
                                    className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                      isOwned
                                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-sm shadow-emerald-500/20'
                                        : 'bg-slate-800 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30 border border-slate-700'
                                    }`}
                                    title={isOwned ? 'Marcar como pendiente (Clic para desmarcar)' : 'Marcar como ya obtenido (Coste 0 K)'}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="hidden xl:inline text-[11px]">
                                      {isOwned ? 'Obtenido' : 'Tengo'}
                                    </span>
                                  </button>

                                  {/* TOGGLE ELIMINAR / DESCARTAR BUTTON */}
                                  {isRemoved ? (
                                    <button
                                      type="button"
                                      onClick={() => restoreItem(itemKey)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 cursor-pointer flex items-center gap-1 text-[11px]"
                                      title="Restaurar objeto al cálculo del set"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                      <span className="hidden xl:inline">Restaurar</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => toggleItemRemoved(itemKey)}
                                      className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                                      title="Eliminar objeto de la consideración del costo del set"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Calculator links */}
                                  {it.item && onSelectRecipeForCalculator && it.isCraftable && !isRemoved && (
                                    <button
                                      type="button"
                                      onClick={() => onSelectRecipeForCalculator(it.item!)}
                                      className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                                      title="Abrir en Calculadora de Recetas"
                                    >
                                      <Wrench className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {it.item && onSelectForCrushing && !isRemoved && (
                                    <button
                                      type="button"
                                      onClick={() => onSelectForCrushing(it.item!)}
                                      className="p-1.5 bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                                      title="Calcular brisage en Rompedora"
                                    >
                                      <Zap className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Ingredient Breakdown Row */}
                            {isExpanded && it.ingredientsBreakdown.length > 0 && !isRemoved && (
                              <tr className="bg-slate-950/60 border-b border-slate-800/80">
                                <td colSpan={7} className="py-3 px-4 sm:px-6">
                                  <div className="space-y-2">
                                    <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <Hammer className="w-3.5 h-3.5" />
                                        <span>Materiales para {it.item?.name?.es || it.rawName}:</span>
                                      </div>
                                      {isOwned && (
                                        <span className="text-[11px] text-emerald-400 font-semibold">
                                          ✓ Objeto obtenido (no se requieren estos materiales)
                                        </span>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                      {it.ingredientsBreakdown.map((ing) => {
                                        const isEditingThisIng = editingPriceItemId === ing.id;
                                        const isIngObtained = !!obtainedMaterialIds[ing.id];

                                        return (
                                          <div
                                            key={ing.id}
                                            className={`rounded-xl p-2 flex items-center justify-between gap-2 transition-colors border ${
                                              isIngObtained
                                                ? 'bg-emerald-950/30 border-emerald-500/30 hover:border-emerald-500/50'
                                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 p-0.5 flex items-center justify-center shrink-0">
                                                <SafeImage
                                                  src={getItemIconUrl({ id: ing.id, iconId: ing.iconId })}
                                                  fallbackSrc={getItemFallbackIconUrl({ id: ing.id, iconId: ing.iconId })}
                                                  alt={ing.name}
                                                  className="w-6 h-6 object-contain"
                                                />
                                              </div>
                                              <div className="min-w-0">
                                                <div className="font-semibold text-slate-200 text-xs truncate flex items-center gap-1">
                                                  <span className="truncate">{ing.name}</span>
                                                  {isIngObtained && (
                                                    <span className="text-[9px] text-emerald-400 font-bold px-1 rounded bg-emerald-500/20 shrink-0">
                                                      ✓ Tengo
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                  Cant: <strong className="text-amber-300 font-mono">x{ing.quantity}</strong>
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => toggleMaterialObtained(ing.id)}
                                                className={`p-1 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors border ${
                                                  isIngObtained
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30'
                                                }`}
                                                title={
                                                  isIngObtained
                                                    ? 'Material marcado como obtenido (Clic para desmarcar)'
                                                    : 'Marcar recurso como ya obtenido'
                                                }
                                              >
                                                <CheckCircle2 className="w-3 h-3" />
                                              </button>

                                              <div className="text-right font-mono">
                                                {isEditingThisIng ? (
                                                  <div className="flex items-center gap-1">
                                                    <input
                                                      type="number"
                                                      value={tempPriceInput}
                                                      onChange={(e) => setTempPriceInput(e.target.value)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          handleSavePrice(ing.id, Number(tempPriceInput) || 0);
                                                        } else if (e.key === 'Escape') {
                                                          setEditingPriceItemId(null);
                                                        }
                                                      }}
                                                      autoFocus
                                                      placeholder="Precio u."
                                                      className="w-16 px-1 py-0.5 bg-slate-950 border border-amber-500 text-right text-[11px] rounded text-amber-300 font-mono outline-none"
                                                    />
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSavePrice(ing.id, Number(tempPriceInput) || 0)}
                                                      className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 cursor-pointer"
                                                      title="Guardar precio"
                                                    >
                                                      <Check className="w-2.5 h-2.5" />
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingPriceItemId(ing.id);
                                                      setTempPriceInput(String(ing.unitPrice || ''));
                                                    }}
                                                    className="group/ingprice text-right block cursor-pointer"
                                                    title="Haz clic para editar el precio de este recurso"
                                                  >
                                                    <div className={`text-xs font-bold ${
                                                      isIngObtained
                                                        ? 'text-emerald-400/90 line-through group-hover/ingprice:text-emerald-300'
                                                        : 'text-slate-300 group-hover/ingprice:text-amber-300'
                                                    }`}>
                                                      {ing.totalPrice > 0 ? formatKamas(ing.totalPrice) : '-'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 group-hover/ingprice:text-amber-400 flex items-center justify-end gap-0.5">
                                                      <span>{ing.unitPrice > 0 ? `${formatKamas(ing.unitPrice)} u.` : 'Sin precio'}</span>
                                                      <Tag className="w-2 h-2 opacity-0 group-hover/ingprice:opacity-100" />
                                                    </div>
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Consolidated Ingredients Shopping List */}
          {activeTabSection === 'materials' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-400" />
                    Lista de Materiales Requeridos ({computedData.consolidatedIngredients.length} recursos)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Marca los recursos que ya tienes para restar su coste del total requerido y mantener el foco en lo que realmente te falta.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {computedData.obtainedIngredients.length > 0 && (
                    <button
                      type="button"
                      onClick={resetObtainedMaterials}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                      title="Desmarcar todos los recursos obtenidos"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Limpiar Obtenidos</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSendToShoppingList}
                    disabled={computedData.neededIngredients.length === 0}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Enviar Faltantes a Compras</span>
                  </button>
                </div>
              </div>

              {/* Materials Progress & Filter Subtabs */}
              {computedData.consolidatedIngredients.length > 0 && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-400">Ver:</span>
                      <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setMaterialsFilter('needed')}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                            materialsFilter === 'needed'
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>Faltantes</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                            materialsFilter === 'needed' ? 'bg-amber-600/40 text-slate-950' : 'bg-slate-800 text-amber-400'
                          }`}>
                            {computedData.neededIngredients.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMaterialsFilter('obtained')}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                            materialsFilter === 'obtained'
                              ? 'bg-emerald-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>Ya Obtenidos</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                            materialsFilter === 'obtained' ? 'bg-emerald-600/40 text-slate-950' : 'bg-slate-800 text-emerald-400'
                          }`}>
                            {computedData.obtainedIngredients.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMaterialsFilter('all')}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                            materialsFilter === 'all'
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>Todos</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                            materialsFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {computedData.consolidatedIngredients.length}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Cost summary badges */}
                    <div className="flex items-center gap-3 text-xs">
                      <div className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                        <span className="text-slate-400 mr-1.5">Gasto restante:</span>
                        <strong className="text-amber-400 font-mono font-bold">
                          {formatKamas(computedData.totalNeededMaterialsCost)}
                        </strong>
                      </div>
                      {computedData.obtainedIngredients.length > 0 && (
                        <div className="bg-slate-900 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          <span className="text-slate-400 mr-1.5">Ahorrado (tienes):</span>
                          <strong className="text-emerald-400 font-mono font-bold">
                            {formatKamas(computedData.totalObtainedMaterialsCost)}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                      <span>Progreso de recolección de materiales</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        {computedData.obtainedIngredients.length} de {computedData.consolidatedIngredients.length} ({computedData.materialsProgressPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${computedData.materialsProgressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {computedData.consolidatedIngredients.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {computedData.ownedCount > 0 && computedData.neededCount === 0 ? (
                    <div className="space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                      <p className="font-bold text-emerald-300 text-sm">¡Tienes todas las piezas del set obtenidas!</p>
                      <p className="text-slate-400">No requieres comprar ningún material adicional.</p>
                    </div>
                  ) : (
                    'No hay materiales requeridos o las piezas pendientes no tienen recetas registradas.'
                  )}
                </div>
              ) : (
                (() => {
                  const displayList =
                    materialsFilter === 'needed'
                      ? computedData.neededIngredients
                      : materialsFilter === 'obtained'
                      ? computedData.obtainedIngredients
                      : computedData.consolidatedIngredients;

                  if (displayList.length === 0) {
                    return (
                      <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs space-y-2">
                        {materialsFilter === 'needed' ? (
                          <>
                            <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                            <p className="font-bold text-emerald-300">¡Has marcado todos los recursos como obtenidos!</p>
                            <p className="text-slate-500">No te falta ningún material de las piezas pendientes.</p>
                          </>
                        ) : materialsFilter === 'obtained' ? (
                          <>
                            <Package className="w-7 h-7 text-slate-600 mx-auto" />
                            <p className="font-semibold text-slate-400">No has marcado ningún material como obtenido aún.</p>
                            <p className="text-slate-500">Haz clic en el botón de check "✓" de los materiales que ya tengas.</p>
                          </>
                        ) : (
                          <p>No hay materiales disponibles.</p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {displayList.map((mat) => {
                        const isEditingThisMat = editingPriceItemId === mat.itemId;
                        const isMatObtained = !!mat.isObtained;

                        return (
                          <div
                            key={mat.itemId}
                            className={`border rounded-xl p-2.5 flex items-center justify-between gap-2 transition-all ${
                              isMatObtained
                                ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 p-0.5 flex items-center justify-center shrink-0">
                                {mat.item ? (
                                  <SafeImage
                                    src={getItemIconUrl(mat.item)}
                                    fallbackSrc={getItemFallbackIconUrl(mat.item)}
                                    alt={mat.item.name?.es || `Ingrediente #${mat.itemId}`}
                                    className="w-7 h-7 object-contain"
                                  />
                                ) : (
                                  <Package className="w-3.5 h-3.5 text-slate-500" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-200 text-xs truncate flex items-center gap-1">
                                  <span className="truncate">{mat.item?.name?.es || `Ingrediente #${mat.itemId}`}</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Total: <strong className="text-amber-300 font-mono">x{mat.totalQuantityRequired.toLocaleString()}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleMaterialObtained(mat.itemId)}
                                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                                  isMatObtained
                                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/35'
                                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30'
                                }`}
                                title={
                                  isMatObtained
                                    ? 'Material obtenido (Clic para mover a pendientes)'
                                    : 'Marcar como ya obtenido (resta del cálculo)'
                                }
                              >
                                <CheckCircle2 className={`w-3.5 h-3.5 ${isMatObtained ? 'text-emerald-400' : 'text-slate-500'}`} />
                              </button>

                              <div className="text-right font-mono">
                                {isEditingThisMat ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={tempPriceInput}
                                      onChange={(e) => setTempPriceInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSavePrice(mat.itemId, Number(tempPriceInput) || 0);
                                        } else if (e.key === 'Escape') {
                                          setEditingPriceItemId(null);
                                        }
                                      }}
                                      autoFocus
                                      placeholder="Precio u."
                                      className="w-18 px-1.5 py-0.5 bg-slate-900 border border-amber-500 text-right text-xs rounded text-amber-300 font-mono outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSavePrice(mat.itemId, Number(tempPriceInput) || 0)}
                                      className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 cursor-pointer"
                                      title="Guardar precio"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPriceItemId(mat.itemId);
                                      setTempPriceInput(String(mat.unitPrice || ''));
                                    }}
                                    className="group/matprice text-right block cursor-pointer"
                                    title="Haz clic para editar el precio de este recurso"
                                  >
                                    <div className={`text-xs font-black ${
                                      isMatObtained
                                        ? 'text-emerald-400/80 line-through group-hover/matprice:text-emerald-300'
                                        : 'text-amber-400 group-hover/matprice:text-amber-300'
                                    }`}>
                                      {mat.totalPrice > 0 ? formatKamas(mat.totalPrice) : '-'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 group-hover/matprice:text-amber-400 flex items-center justify-end gap-1">
                                      <span>{mat.unitPrice > 0 ? `${formatKamas(mat.unitPrice)} u.` : 'Sin precio'}</span>
                                      <Tag className="w-2.5 h-2.5 opacity-0 group-hover/matprice:opacity-100 text-slate-500" />
                                    </div>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

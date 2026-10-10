import { useState, useMemo, useEffect } from 'react';
import { useUserJobs } from '../../hooks/useUserJobs';
import { useMarketPrices } from '../../hooks/useMarketPrices';
import { useBankInventory } from '../../hooks/useBankInventory';
import { useSalesHistory } from '../../hooks/useSalesHistory';
import { ItemSoldStats } from '../../services/salesHistoryService';
import { PresetCraftableItem, DEFAULT_INGREDIENT_PRICES } from '../../data/presetCraftableItems';
import {
  getCraftableItemsSnapshot,
  addToShoppingList,
  getItemName,
} from '../../services/dofusDbService';
import { isOmittedItem, isClassItem } from '../../data/dofusJobs';
import {
  getStoredSalesVolumeMap,
  fetchAndSyncSalesVolume,
  SalesVolumeMap,
} from '../../services/salesVolumeService';
import { copyItemNameToClipboard } from '../../utils/clipboardUtils';
import {
  DailyCraftPlannerProps,
  OptimizationMode,
  MarketChannel,
  PlannedCraftItem,
  PostedCraftItem,
  StoredPlannerConfig,
  CONFIG_STORAGE_KEY,
  POSTED_STORAGE_KEY,
} from './types';
import {
  calculateItemSlots,
  getStoredPlannerConfig,
} from './utils';
import {
  evaluateCandidatePool,
  solvePlannedCrafts,
  calculateMaterialsSummary,
} from './solver';

export function useDailyPlanner({
  onSelectRecipeForCalculator,
  onNavigateToShopping,
}: DailyCraftPlannerProps) {
  const [budget, setBudget] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.budget === 'number' && saved.budget > 0 ? saved.budget : 10_000_000;
  });
  const [budgetInput, setBudgetInput] = useState<string>(() => {
    const saved = getStoredPlannerConfig();
    return saved.budgetInput || (saved.budget ? String(saved.budget) : '10000000');
  });
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>(() => {
    const saved = getStoredPlannerConfig();
    return saved.optimizationMode || 'balanced';
  });
  const [marketChannel, setMarketChannel] = useState<MarketChannel>(() => {
    const saved = getStoredPlannerConfig();
    return saved.marketChannel || 'multichannel';
  });
  const [targetDays, setTargetDays] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.targetDays === 'number' ? saved.targetDays : 1.0;
  });
  const [maxEquipSlots, setMaxEquipSlots] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.maxEquipSlots === 'number' ? saved.maxEquipSlots : 150;
  });
  const [maxConsumableSlots, setMaxConsumableSlots] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.maxConsumableSlots === 'number' ? saved.maxConsumableSlots : 100;
  });
  const [maxResourceSlots, setMaxResourceSlots] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.maxResourceSlots === 'number' ? saved.maxResourceSlots : 100;
  });
  const [maxBudgetShare, setMaxBudgetShare] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.maxBudgetShare === 'number' && saved.maxBudgetShare > 0 ? saved.maxBudgetShare : 0.20;
  });
  const [maxMarketShare, setMaxMarketShare] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.maxMarketShare === 'number' ? saved.maxMarketShare : 0.10;
  });
  const [onlyMyJobs, setOnlyMyJobs] = useState<boolean>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.onlyMyJobs === 'boolean' ? saved.onlyMyJobs : true;
  });
  const [requireSalesHistory, setRequireSalesHistory] = useState<boolean>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.requireSalesHistory === 'boolean' ? saved.requireSalesHistory : true;
  });
  const [filterOutliers, setFilterOutliers] = useState<boolean>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.filterOutliers === 'boolean' ? saved.filterOutliers : true;
  });
  const [selectedJobFilter, setSelectedJobFilter] = useState<number | 'all'>(() => {
    const saved = getStoredPlannerConfig();
    return saved.selectedJobFilter !== undefined ? saved.selectedJobFilter : 'all';
  });
  const [minRoiFilter, setMinRoiFilter] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.minRoiFilter === 'number' ? saved.minRoiFilter : 15;
  });
  const [minDailySales, setMinDailySales] = useState<number>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.minDailySales === 'number' ? saved.minDailySales : 0;
  });
  const [excludedItemIds, setExcludedItemIds] = useState<Set<number>>(() => {
    const saved = getStoredPlannerConfig();
    return Array.isArray(saved.excludedItemIds) ? new Set(saved.excludedItemIds) : new Set();
  });
  const [manualUnitsOverride, setManualUnitsOverride] = useState<Record<number, number>>(() => {
    const saved = getStoredPlannerConfig();
    return saved.manualUnitsOverride && typeof saved.manualUnitsOverride === 'object' ? saved.manualUnitsOverride : {};
  });
  const [isJobsModalOpen, setIsJobsModalOpen] = useState(false);
  const [copiedItemNameId, setCopiedItemNameId] = useState<number | null>(null);
  const [addedAllNotice, setAddedAllNotice] = useState(false);
  const [showMaterialsDrawer, setShowMaterialsDrawer] = useState<boolean>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.showMaterialsDrawer === 'boolean' ? saved.showMaterialsDrawer : false;
  });
  const [copiedMaterialsNotice, setCopiedMaterialsNotice] = useState<boolean>(false);
  const [recentSalesOnly, setRecentSalesOnly] = useState<boolean>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.recentSalesOnly === 'boolean' ? saved.recentSalesOnly : true;
  });
  const [useBankResources, setUseBankResources] = useState<boolean>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.useBankResources === 'boolean' ? saved.useBankResources : true;
  });
  const [avoidAlreadyListed, setAvoidAlreadyListed] = useState<boolean>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.avoidAlreadyListed === 'boolean' ? saved.avoidAlreadyListed : true;
  });

  const { bankQtyMap, updateBankItem } = useBankInventory();
  const [postedCrafts, setPostedCrafts] = useState<PostedCraftItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(POSTED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showPostedDrawer, setShowPostedDrawer] = useState<boolean>(() => {
    const saved = getStoredPlannerConfig();
    return typeof saved.showPostedDrawer === 'boolean' ? saved.showPostedDrawer : true;
  });
  const [justPostedNotice, setJustPostedNotice] = useState<string | null>(null);

  // Sales History & Active Listings Integration
  const { soldStats, activeSummary } = useSalesHistory();
  const [plannerMainTab, setPlannerMainTab] = useState<'craft_planner' | 'sales_analytics'>('craft_planner');

  const soldStatsMap = useMemo(() => {
    const map = new Map<number, ItemSoldStats>();
    soldStats.forEach((s) => map.set(s.itemId, s));
    return map;
  }, [soldStats]);

  const handleSelectRecipeById = (itemId: number) => {
    const snapshot = getCraftableItemsSnapshot() as PresetCraftableItem[];
    const found = snapshot.find((i) => i.id === itemId);
    if (found) {
      onSelectRecipeForCalculator(found);
    }
  };

  // Persistir configuración en localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cfg: StoredPlannerConfig = {
        budget,
        budgetInput,
        maxBudgetShare,
        optimizationMode,
        marketChannel,
        targetDays,
        maxEquipSlots,
        maxConsumableSlots,
        maxResourceSlots,
        maxMarketShare,
        onlyMyJobs,
        requireSalesHistory,
        recentSalesOnly,
        filterOutliers,
        selectedJobFilter,
        minRoiFilter,
        minDailySales,
        excludedItemIds: Array.from(excludedItemIds),
        manualUnitsOverride,
        showPostedDrawer,
        showMaterialsDrawer,
        useBankResources,
        avoidAlreadyListed,
      };
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {
      console.warn('[DailyCraftPlanner] Error guardando configuración en localStorage:', e);
    }
  }, [
    budget,
    budgetInput,
    maxBudgetShare,
    optimizationMode,
    marketChannel,
    targetDays,
    maxEquipSlots,
    maxConsumableSlots,
    maxResourceSlots,
    maxMarketShare,
    onlyMyJobs,
    requireSalesHistory,
    recentSalesOnly,
    filterOutliers,
    selectedJobFilter,
    minRoiFilter,
    minDailySales,
    excludedItemIds,
    manualUnitsOverride,
    showPostedDrawer,
    showMaterialsDrawer,
    useBankResources,
    avoidAlreadyListed,
  ]);

  // Persistir objetos ya puestos en HDV en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(POSTED_STORAGE_KEY, JSON.stringify(postedCrafts));
      } catch (e) {
        console.warn('[DailyCraftPlanner] Error guardando postedCrafts:', e);
      }
    }
  }, [postedCrafts]);

  // Resumen acumulado de los objetos ya puestos en venta en mercadillos
  const postedSummary = useMemo(() => {
    const totalCost = postedCrafts.reduce((acc, c) => acc + c.totalCraftCost, 0);
    const totalProfit = postedCrafts.reduce((acc, c) => acc + c.totalNetProfit, 0);
    const totalUnits = postedCrafts.reduce((acc, c) => acc + c.units, 0);
    const equipSlots = postedCrafts
      .filter((c) => c.marketCategory === 'equipment')
      .reduce((acc, c) => acc + c.estimatedSlots, 0);
    const consumableSlots = postedCrafts
      .filter((c) => c.marketCategory === 'consumables')
      .reduce((acc, c) => acc + c.estimatedSlots, 0);
    const resourceSlots = postedCrafts
      .filter((c) => c.marketCategory === 'resources')
      .reduce((acc, c) => acc + c.estimatedSlots, 0);
    const totalSlots = equipSlots + consumableSlots + resourceSlots;

    return {
      totalCost,
      totalProfit,
      totalUnits,
      equipSlots,
      consumableSlots,
      resourceSlots,
      totalSlots,
      count: postedCrafts.length,
    };
  }, [postedCrafts]);

  const postedItemIds = useMemo(() => new Set(postedCrafts.map((c) => c.itemId)), [postedCrafts]);
  const effectiveBudget = Math.max(0, budget);

  const { settings: userJobSettings, canCraft } = useUserJobs();
  const { marketPrices: basePrices } = useMarketPrices();
  const [salesVolumeMap, setSalesVolumeMap] = useState<SalesVolumeMap>(() => getStoredSalesVolumeMap());

  useEffect(() => {
    fetchAndSyncSalesVolume()
      .then((remoteMap) => {
        if (remoteMap && Object.keys(remoteMap).length > 0) {
          setSalesVolumeMap(remoteMap);
        }
      })
      .catch((err) => {
        console.warn('[DailyCraftPlanner] Error sincronizando volúmenes:', err);
      });

    const handleSalesVolumeUpdate = () => {
      setSalesVolumeMap(getStoredSalesVolumeMap());
    };

    window.addEventListener('dofus_sales_volume_updated', handleSalesVolumeUpdate);
    window.addEventListener('dofus_database_updated', handleSalesVolumeUpdate);

    return () => {
      window.removeEventListener('dofus_sales_volume_updated', handleSalesVolumeUpdate);
      window.removeEventListener('dofus_database_updated', handleSalesVolumeUpdate);
    };
  }, []);

  const marketPrices = useMemo(
    () => ({ ...DEFAULT_INGREDIENT_PRICES, ...basePrices }),
    [basePrices]
  );

  const allCraftableItems: PresetCraftableItem[] = useMemo(() => {
    const raw = getCraftableItemsSnapshot() as PresetCraftableItem[];
    return raw.filter((item) => !isOmittedItem(item) && !isClassItem(item));
  }, []);

  const handleBudgetChange = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, '');
    setBudgetInput(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 0) {
      setBudget(num);
    }
  };

  const handleApplyPresetBudget = (val: number) => {
    setBudget(val);
    setBudgetInput(String(val));
  };

  // 1. Filtrar candidatos válidos y calcular rentabilidad unitaria
  const candidatePool = useMemo(() => {
    return evaluateCandidatePool({
      allCraftableItems,
      excludedItemIds,
      postedItemIds,
      marketChannel,
      selectedJobFilter,
      userJobSettings,
      canCraft,
      onlyMyJobs,
      marketPrices,
      budget,
      maxBudgetShare,
      salesVolumeMap,
      requireSalesHistory,
      recentSalesOnly,
      minDailySales,
      filterOutliers,
      minRoiFilter,
      optimizationMode,
      avoidAlreadyListed,
      activeSummary,
      soldStatsMap,
    });
  }, [
    allCraftableItems,
    excludedItemIds,
    postedItemIds,
    selectedJobFilter,
    onlyMyJobs,
    userJobSettings,
    canCraft,
    marketPrices,
    budget,
    maxBudgetShare,
    minRoiFilter,
    minDailySales,
    requireSalesHistory,
    recentSalesOnly,
    filterOutliers,
    marketChannel,
    salesVolumeMap,
    optimizationMode,
    avoidAlreadyListed,
    activeSummary,
    soldStatsMap,
  ]);

  // 2. Algoritmo de Asignación de Presupuesto y Slots
  const plannedCrafts = useMemo(() => {
    return solvePlannedCrafts({
      effectiveBudget,
      budget,
      candidatePool,
      marketChannel,
      maxEquipSlots,
      maxConsumableSlots,
      maxResourceSlots,
      postedSummary,
      manualUnitsOverride,
      targetDays,
      maxBudgetShare,
      maxMarketShare,
    });
  }, [
    budget,
    effectiveBudget,
    postedSummary,
    maxEquipSlots,
    maxConsumableSlots,
    maxResourceSlots,
    marketChannel,
    candidatePool,
    targetDays,
    maxBudgetShare,
    maxMarketShare,
    manualUnitsOverride,
  ]);

  // Resumen de KPIs y Métricas de Liquidez
  const summary = useMemo(() => {
    const totalCost = plannedCrafts.reduce((acc, curr) => acc + curr.totalCraftCost, 0);
    const totalProfit = plannedCrafts.reduce((acc, curr) => acc + curr.totalNetProfit, 0);
    const equipSlotsUsed = plannedCrafts
      .filter((c) => c.marketCategory === 'equipment')
      .reduce((acc, curr) => acc + curr.estimatedSlots, 0);
    const consumableSlotsUsed = plannedCrafts
      .filter((c) => c.marketCategory === 'consumables')
      .reduce((acc, curr) => acc + curr.estimatedSlots, 0);
    const resourceSlotsUsed = plannedCrafts
      .filter((c) => c.marketCategory === 'resources')
      .reduce((acc, curr) => acc + curr.estimatedSlots, 0);
    const totalSlots = equipSlotsUsed + consumableSlotsUsed + resourceSlotsUsed;
    const totalUnits = plannedCrafts.reduce((acc, curr) => acc + curr.recommendedUnits, 0);
    const grandTotalCost = totalCost + postedSummary.totalCost;
    const grandTotalProfit = totalProfit + postedSummary.totalProfit;
    const overallRoi = grandTotalCost > 0 ? (grandTotalProfit / grandTotalCost) * 100 : 0;
    const totalInvestedWithPosted = grandTotalCost;
    const budgetUsedPercent = budget > 0 ? (totalInvestedWithPosted / budget) * 100 : 0;

    const dailyInflow = plannedCrafts.reduce((acc, c) => {
      if (c.avgDailySales > 0) {
        const unitsPerDay = Math.min(c.recommendedUnits, c.avgDailySales);
        return acc + unitsPerDay * (c.salePriceUnit - c.saleTaxUnit);
      }
      return acc;
    }, 0);

    const paybackDays = (totalCost > 0 && dailyInflow > 0) ? (totalCost / dailyInflow) : null;
    const paybackHours = paybackDays !== null ? Math.round(paybackDays * 24) : null;

    return {
      totalCost,
      totalProfit,
      equipSlotsUsed,
      consumableSlotsUsed,
      resourceSlotsUsed,
      totalSlots,
      totalUnits,
      recipeCount: plannedCrafts.length,
      overallRoi,
      budgetUsedPercent,
      remainingBudget: Math.max(0, budget - totalInvestedWithPosted),
      dailyInflow,
      paybackDays,
      paybackHours,
    };
  }, [plannedCrafts, budget, postedSummary]);

  // Desglose de Materiales Agregados & Cuellos de Botella con soporte para Mi Banco
  const materialsSummary = useMemo(() => {
    return calculateMaterialsSummary(
      plannedCrafts,
      marketPrices,
      useBankResources,
      bankQtyMap
    );
  }, [plannedCrafts, marketPrices, useBankResources, bankQtyMap]);

  const handleCopyMaterialsList = () => {
    if (!materialsSummary) return;
    const lines = [
      `🛒 LISTA DE COMPRAS - PLAN CRAFTEO DOFUS (${plannedCrafts.length} recetas, ${summary.totalUnits} unidades)`,
      `Presupuesto total: ${summary.totalCost.toLocaleString('es-ES')} K | Ganancia neta: +${summary.totalProfit.toLocaleString('es-ES')} K (+${summary.overallRoi.toFixed(0)}% ROI)`,
      ...(useBankResources && materialsSummary.totalBankSavings > 0
        ? [`🏦 Ahorro Mi Banco: -${materialsSummary.totalBankSavings.toLocaleString('es-ES')} K | A comprar en HDV: ~${materialsSummary.effectiveCostAfterBank.toLocaleString('es-ES')} K`]
        : []),
      '',
      '--- MATERIALES NECESARIOS ---',
      ...materialsSummary.list.map((m) => {
        const share = materialsSummary.grandTotalCost > 0 ? ((m.totalCost / materialsSummary.grandTotalCost) * 100).toFixed(0) : '0';
        const bankInfo = useBankResources && m.coveredByBankQty > 0
          ? ` [Faltan: ${m.neededToBuyQty.toLocaleString('es-ES')}u, Banco: ${m.coveredByBankQty.toLocaleString('es-ES')}u]`
          : '';
        return `• ${m.totalQty.toLocaleString('es-ES')}x ${m.name} (~${m.totalCost.toLocaleString('es-ES')} K, ${share}%)${bankInfo}`;
      }),
      '',
      `Copiado desde Calculadora HDV Dofus`
    ];
    copyItemNameToClipboard(lines.join('\n'));
    setCopiedMaterialsNotice(true);
    setTimeout(() => setCopiedMaterialsNotice(false), 2000);
  };

  const handleAddAllToShoppingList = () => {
    if (plannedCrafts.length === 0) return;

    plannedCrafts.forEach((craft) => {
      addToShoppingList(craft.item, craft.recommendedUnits);
    });

    setAddedAllNotice(true);
    setTimeout(() => setAddedAllNotice(false), 2500);

    if (onNavigateToShopping) {
      setTimeout(() => {
        onNavigateToShopping();
      }, 700);
    }
  };

  const handleDiscardItem = (itemId: number) => {
    setExcludedItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    setManualUnitsOverride((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleAdjustUnits = (itemId: number, delta: number) => {
    const existing = plannedCrafts.find((c) => c.item.id === itemId);
    const current = manualUnitsOverride[itemId] ?? existing?.recommendedUnits ?? 1;
    const nextVal = Math.max(1, current + delta);
    setManualUnitsOverride((prev) => ({
      ...prev,
      [itemId]: nextVal,
    }));
  };

  const handleCopyName = (id: number, name: string) => {
    void copyItemNameToClipboard(name);
    setCopiedItemNameId(id);
    setTimeout(() => setCopiedItemNameId(null), 1500);
  };

  const handleMarkAsPosted = (craft: PlannedCraftItem) => {
    const manualQty = manualUnitsOverride[craft.item.id];
    const units = manualQty !== undefined ? Math.max(1, manualQty) : craft.recommendedUnits;
    const cost = units * craft.craftCostUnit;
    const profit = units * craft.netProfitUnit;
    const slots = calculateItemSlots(craft.isStackable, units);
    const itemName = getItemName(craft.item);

    const deductedBankMaterials: Record<number, number> = {};
    let totalItemsDeducted = 0;
    let bankKamasSaved = 0;

    if (useBankResources && craft.item.recipeData?.ingredientIds) {
      craft.item.recipeData.ingredientIds.forEach((ingId, idx) => {
        const qtyPerCraft = craft.item.recipeData!.quantities[idx] || 1;
        const totalNeeded = qtyPerCraft * units;
        const availableInBank = bankQtyMap[ingId] || 0;
        const toDeduct = Math.min(availableInBank, totalNeeded);

        if (toDeduct > 0) {
          deductedBankMaterials[ingId] = toDeduct;
          totalItemsDeducted += toDeduct;
          const price = marketPrices[ingId] || 0;
          bankKamasSaved += toDeduct * price;
          updateBankItem(ingId, Math.max(0, availableInBank - toDeduct));
        }
      });
    }

    const kamasSpent = Math.max(0, cost - bankKamasSaved);

    const newPosted: PostedCraftItem = {
      itemId: craft.item.id,
      item: craft.item,
      jobName: craft.jobName,
      jobId: craft.jobId,
      userJobLevel: craft.userJobLevel,
      marketCategory: craft.marketCategory,
      isStackable: craft.isStackable,
      units,
      craftCostUnit: craft.craftCostUnit,
      totalCraftCost: cost,
      spentKamas: kamasSpent,
      salePriceUnit: craft.salePriceUnit,
      saleTaxUnit: craft.saleTaxUnit,
      netProfitUnit: craft.netProfitUnit,
      totalNetProfit: profit,
      roiPercent: craft.roiPercent,
      estimatedSlots: slots,
      postedAt: Date.now(),
      deductedBankMaterials: Object.keys(deductedBankMaterials).length > 0 ? deductedBankMaterials : undefined,
    };

    setPostedCrafts((prev) => [...prev.filter((p) => p.itemId !== craft.item.id), newPosted]);
    setManualUnitsOverride((prev) => {
      const next = { ...prev };
      delete next[craft.item.id];
      return next;
    });

    setBudget((prev) => {
      const next = Math.max(0, prev - kamasSpent);
      setBudgetInput(String(next));
      return next;
    });

    const bankMsg = totalItemsDeducted > 0
      ? ` | 🏦 -${totalItemsDeducted} recursos de Mi Banco (ahorro: ~${bankKamasSaved.toLocaleString('es-ES')} K)`
      : '';
    setJustPostedNotice(`"${itemName}" puesto en HDV (${units}x, -${kamasSpent.toLocaleString('es-ES')} K de tus kamas actuales)${bankMsg}`);
    setTimeout(() => {
      setJustPostedNotice(null);
    }, 4000);
  };

  const handleUndoPosted = (itemId: number) => {
    const craftToUndo = postedCrafts.find((c) => c.itemId === itemId);
    if (craftToUndo) {
      if (craftToUndo.deductedBankMaterials) {
        Object.entries(craftToUndo.deductedBankMaterials).forEach(([idStr, qty]) => {
          const ingId = Number(idStr);
          const currentInBank = bankQtyMap[ingId] || 0;
          updateBankItem(ingId, currentInBank + qty);
        });
      }
      const restoredKamas = typeof craftToUndo.spentKamas === 'number'
        ? craftToUndo.spentKamas
        : craftToUndo.totalCraftCost;
      setBudget((prev) => {
        const next = prev + restoredKamas;
        setBudgetInput(String(next));
        return next;
      });
      setPostedCrafts((prev) => prev.filter((c) => c.itemId !== itemId));
    }
  };

  const handleClearAllPosted = () => {
    if (postedCrafts.length === 0) return;
    if (window.confirm('¿Deseas reiniciar la lista de objetos puestos en HDV, restaurar los recursos descontados a Mi Banco y recuperar las kamas gastadas en tus kamas actuales?')) {
      let totalRestoredKamas = 0;
      for (const craft of postedCrafts) {
        if (craft.deductedBankMaterials) {
          Object.entries(craft.deductedBankMaterials).forEach(([idStr, qty]) => {
            const ingId = Number(idStr);
            const currentInBank = bankQtyMap[ingId] || 0;
            updateBankItem(ingId, currentInBank + qty);
          });
        }
        totalRestoredKamas += typeof craft.spentKamas === 'number'
          ? craft.spentKamas
          : craft.totalCraftCost;
      }
      setBudget((prev) => {
        const next = prev + totalRestoredKamas;
        setBudgetInput(String(next));
        return next;
      });
      setPostedCrafts([]);
    }
  };

  const handleResetAllFilters = () => {
    if (window.confirm('¿Deseas restablecer todos los filtros y presupuesto a los valores por defecto?')) {
      setBudget(10_000_000);
      setBudgetInput('10000000');
      setMaxBudgetShare(0.20);
      setOptimizationMode('balanced');
      setMarketChannel('multichannel');
      setTargetDays(1.0);
      setMaxEquipSlots(150);
      setMaxConsumableSlots(100);
      setMaxResourceSlots(100);
      setMaxMarketShare(0.10);
      setOnlyMyJobs(true);
      setRequireSalesHistory(true);
      setRecentSalesOnly(true);
      setFilterOutliers(true);
      setSelectedJobFilter('all');
      setMinRoiFilter(15);
      setMinDailySales(0);
      setExcludedItemIds(new Set());
      setManualUnitsOverride({});
      try {
        localStorage.removeItem(CONFIG_STORAGE_KEY);
      } catch (e) {
        console.warn('[DailyCraftPlanner] Error borrando configuración guardada:', e);
      }
    }
  };

  return {
    budget,
    budgetInput,
    handleBudgetChange,
    handleApplyPresetBudget,
    optimizationMode,
    setOptimizationMode,
    marketChannel,
    setMarketChannel,
    targetDays,
    setTargetDays,
    maxEquipSlots,
    setMaxEquipSlots,
    maxConsumableSlots,
    setMaxConsumableSlots,
    maxResourceSlots,
    setMaxResourceSlots,
    maxBudgetShare,
    setMaxBudgetShare,
    maxMarketShare,
    setMaxMarketShare,
    onlyMyJobs,
    setOnlyMyJobs,
    requireSalesHistory,
    setRequireSalesHistory,
    recentSalesOnly,
    setRecentSalesOnly,
    filterOutliers,
    setFilterOutliers,
    selectedJobFilter,
    setSelectedJobFilter,
    minRoiFilter,
    setMinRoiFilter,
    minDailySales,
    setMinDailySales,
    excludedItemIds,
    setExcludedItemIds,
    manualUnitsOverride,
    handleAdjustUnits,
    isJobsModalOpen,
    setIsJobsModalOpen,
    copiedItemNameId,
    handleCopyName,
    addedAllNotice,
    handleAddAllToShoppingList,
    showMaterialsDrawer,
    setShowMaterialsDrawer,
    copiedMaterialsNotice,
    handleCopyMaterialsList,
    useBankResources,
    setUseBankResources,
    avoidAlreadyListed,
    setAvoidAlreadyListed,
    bankQtyMap,
    postedCrafts,
    postedSummary,
    showPostedDrawer,
    setShowPostedDrawer,
    justPostedNotice,
    soldStats,
    activeSummary,
    soldStatsMap,
    plannerMainTab,
    setPlannerMainTab,
    plannedCrafts,
    summary,
    materialsSummary,
    handleDiscardItem,
    handleMarkAsPosted,
    handleUndoPosted,
    handleClearAllPosted,
    handleResetAllFilters,
    handleSelectRecipeById,
    marketPrices,
  };
}

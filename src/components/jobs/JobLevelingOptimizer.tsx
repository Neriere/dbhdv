import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Hammer,
  Search,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  ShoppingCart,
  Zap,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Coins,
  Shield,
  Gem,
  Scissors,
  Footprints,
  Sword,
  Wand2,
  Wrench,
  Heart,
  FlaskConical,
  Wheat,
  Drumstick,
  Axe,
  Pickaxe,
  Fish,
  SlidersHorizontal,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  ListFilter,
} from "lucide-react";
import {
  SUPPORTED_JOBS,
  JobOptimizerStrategy,
  SelectedCraftEntry,
  ConsolidatedMaterial,
  JobPlanState,
  JobPlanPhase,
  LevelTier,
  calculateLevelTiers,
  generateOptimizedPhases,
  appendNextPhaseToPlan,
  levelToXp,
  xpToLevel,
  getNextMilestoneLevel,
  calculateLevelProgressionPercent,
  getCraftXpByJobLevel,
  calculateOptimizedCraftCost,
  recalculateSelectedCraftsSequence,
  consolidateMaterialsNeeded,
  calculateSummary,
  generateAutoOptimizedCrafts,
  simulateCraftBatch,
  simulateCraftsUntilLevel,
  getStoredJobPlanV2,
  saveStoredJobPlanV2,
  clearStoredJobPlanV2,
} from "../../services/jobLevelingService";
import { useUserJobs } from "../../hooks/useUserJobs";
import {
  getCraftableItemsSnapshot,
  getStoredMarketPrices,
  getStoredItemPrice,
  getItemIconUrl,
  getItemFallbackIconUrl,
  addToShoppingListById,
  CraftableItem,
} from "../../services/dofusDbService";
import {
  getStoredSalesVolumeMap,
  analyzeSalesVolume,
  ItemSalesVolume,
} from "../../services/salesVolumeService";
import { DofusRecipe } from "../../types";

const ICON_MAP: Record<string, React.ElementType> = {
  FlaskConical,
  Wheat,
  Drumstick,
  Axe,
  Pickaxe,
  Fish,
  Gem,
  Scissors,
  Footprints,
  Sword,
  Wand2,
  Shield,
  Wrench,
  Heart,
};

interface JobLevelingOptimizerProps {
  initialJobId?: number;
  onNavigateToShopping?: () => void;
}

export const JobLevelingOptimizer: React.FC<JobLevelingOptimizerProps> = ({
  initialJobId,
  onNavigateToShopping,
}) => {
  const { jobLevels } = useUserJobs();

  // ── 1. Estado de Oficio y Configuración ────────────────────
  const [jobId, setJobId] = useState<number>(() => {
    if (initialJobId && SUPPORTED_JOBS.some((j) => j.id === initialJobId)) {
      return initialJobId;
    }
    const saved = getStoredJobPlanV2();
    if (saved?.jobId && SUPPORTED_JOBS.some((j) => j.id === saved.jobId)) {
      return saved.jobId;
    }
    return 16; // Joyero por defecto
  });

  const selectedJob = useMemo(
    () => SUPPORTED_JOBS.find((j) => j.id === jobId) || SUPPORTED_JOBS[0],
    [jobId]
  );

  const userSavedLevel = jobLevels[jobId] || 1;

  const [startingLevel, setStartingLevel] = useState<number>(() => {
    const saved = getStoredJobPlanV2();
    if (saved && saved.jobId === jobId) return saved.startingLevel;
    return userSavedLevel;
  });

  const [targetLevel, setTargetLevel] = useState<number>(() => {
    const saved = getStoredJobPlanV2();
    if (saved?.targetLevel && saved.jobId === jobId) return saved.targetLevel;
    return userSavedLevel < 200 ? getNextMilestoneLevel(userSavedLevel) : 200;
  });

  const [startingXp, setStartingXp] = useState<number>(() => {
    const saved = getStoredJobPlanV2();
    if (saved && saved.jobId === jobId) return saved.startingXp;
    return levelToXp(userSavedLevel);
  });

  const [xpMultiplier, setXpMultiplier] = useState<number>(() => {
    const saved = getStoredJobPlanV2();
    return saved?.xpMultiplier ?? 1.0;
  });

  const [isBoostedServer, setIsBoostedServer] = useState<boolean>(() => {
    const saved = getStoredJobPlanV2();
    return saved?.isBoostedServer ?? false;
  });

  // ── 2. Estado de Estrategia de Auto-Optimización ───────────
  const [strategy, setStrategy] = useState<JobOptimizerStrategy>(() => {
    const saved = getStoredJobPlanV2();
    return saved?.strategy ?? "low_budget";
  });

  const [maxDailyAbsorptionRatio, setMaxDailyAbsorptionRatio] = useState<number>(() => {
    const saved = getStoredJobPlanV2();
    return saved?.maxDailyAbsorptionRatio ?? 3.0;
  });

  const [excludeByc, setExcludeByc] = useState<boolean>(() => {
    const saved = getStoredJobPlanV2();
    return saved?.excludeByc ?? true;
  });

  const [excludePebbles, setExcludePebbles] = useState<boolean>(() => {
    const saved = getStoredJobPlanV2();
    return saved?.excludePebbles ?? false;
  });

  const [maxCostPerCraft, setMaxCostPerCraft] = useState<number>(() => {
    const saved = getStoredJobPlanV2();
    return saved?.maxCostPerCraft ?? 0;
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ── 3. Fases Estructuradas y Crafteos ───────────────────────
  const [phases, setPhases] = useState<JobPlanPhase[]>(() => {
    const saved = getStoredJobPlanV2();
    if (saved?.phases && saved.jobId === jobId) return saved.phases;
    return [];
  });

  const [selectedCrafts, setSelectedCrafts] = useState<SelectedCraftEntry[]>(() => {
    const saved = getStoredJobPlanV2();
    if (saved && saved.jobId === jobId) return saved.selectedCrafts || [];
    return [];
  });

  const [viewMode, setViewMode] = useState<"phases" | "unified">("phases");
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});

  // ── 4. Estado de UI y Búsqueda ─────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [recipeCategoryFilter, setRecipeCategoryFilter] = useState<"all" | "consumables" | "equipment">("all");
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [shoppingNotification, setShoppingNotification] = useState<string | null>(null);

  // ── Recalcular XP dinámico y nivel alcanzado ───────────────
  const { updatedSelectedCrafts, actualXp, actualLevel } = useMemo(() => {
    const crafts = selectedCrafts.map((c) => ({
      recipe: c.recipe,
      item: c.item,
      amount: c.amount,
    }));

    const result = recalculateSelectedCraftsSequence(
      startingXp,
      crafts,
      xpMultiplier,
      isBoostedServer
    );

    return {
      updatedSelectedCrafts: result.updatedEntries,
      actualXp: result.finalXp,
      actualLevel: result.finalLevel,
    };
  }, [startingXp, selectedCrafts, xpMultiplier, isBoostedServer]);

  // Materiales consolidados necesarios para todos los crafteos
  const materialsNeeded = useMemo(
    () => consolidateMaterialsNeeded(updatedSelectedCrafts),
    [updatedSelectedCrafts]
  );

  // Resumen financiero global
  const totalXpGained = Math.max(0, actualXp - startingXp);
  const planSummary = useMemo(
    () => calculateSummary(updatedSelectedCrafts, totalXpGained),
    [updatedSelectedCrafts, totalXpGained]
  );

  // Guardar en localStorage automáticamente
  useEffect(() => {
    const state: JobPlanState = {
      jobId,
      jobNameEs: selectedJob.nameEs,
      startingLevel,
      startingXp,
      targetLevel,
      targetXp: levelToXp(targetLevel),
      actualLevel,
      actualXp,
      totalXpGained,
      xpMultiplier,
      isBoostedServer,
      strategy,
      maxDailyAbsorptionRatio,
      excludeByc,
      excludePebbles,
      maxCostPerCraft,
      phases,
      selectedCrafts: updatedSelectedCrafts,
      materialsNeeded,
      summary: planSummary,
      lastUpdated: Date.now(),
    };
    saveStoredJobPlanV2(state);
  }, [
    jobId,
    selectedJob.nameEs,
    startingLevel,
    startingXp,
    targetLevel,
    actualLevel,
    actualXp,
    totalXpGained,
    xpMultiplier,
    isBoostedServer,
    strategy,
    maxDailyAbsorptionRatio,
    excludeByc,
    excludePebbles,
    maxCostPerCraft,
    phases,
    updatedSelectedCrafts,
    materialsNeeded,
    planSummary,
  ]);

  // Cambiar nivel inicial (sincroniza XP y targetLevel si es necesario)
  const handleStartingLevelChange = (lvl: number) => {
    const cleanLvl = Math.max(1, Math.min(200, lvl));
    setStartingLevel(cleanLvl);
    setStartingXp(levelToXp(cleanLvl));
    if (cleanLvl >= targetLevel) {
      setTargetLevel(cleanLvl < 200 ? getNextMilestoneLevel(cleanLvl) : 200);
    }
  };

  // Cambiar Nivel Objetivo
  const handleTargetLevelChange = (lvl: number) => {
    const cleanLvl = Math.max(startingLevel + 1, Math.min(200, lvl));
    setTargetLevel(cleanLvl);
  };

  const handleSetTargetNextMilestone = () => {
    setTargetLevel(getNextMilestoneLevel(startingLevel));
  };

  const handleSetTargetPlusTen = () => {
    setTargetLevel(Math.min(200, targetLevel + 10));
  };

  const handleSetTarget100 = () => {
    setTargetLevel(100);
  };

  const handleSetTarget200 = () => {
    setTargetLevel(200);
  };

  // Cambiar XP inicial (sincroniza Nivel)
  const handleStartingXpChange = (xp: number) => {
    const cleanXp = Math.max(0, xp);
    setStartingXp(cleanXp);
    const derivedLevel = xpToLevel(cleanXp);
    setStartingLevel(derivedLevel);
    if (derivedLevel >= targetLevel) {
      setTargetLevel(derivedLevel < 200 ? getNextMilestoneLevel(derivedLevel) : 200);
    }
  };

  // Cambiar de oficio
  const handleSelectJob = (newJobId: number) => {
    setJobId(newJobId);
    const userLvl = jobLevels[newJobId] || 1;

    const saved = getStoredJobPlanV2();
    if (saved && saved.jobId === newJobId) {
      setStartingLevel(saved.startingLevel);
      setStartingXp(saved.startingXp);
      setTargetLevel(saved.targetLevel || (userLvl < 200 ? getNextMilestoneLevel(userLvl) : 200));
      setXpMultiplier(saved.xpMultiplier);
      setIsBoostedServer(saved.isBoostedServer);
      setStrategy(saved.strategy);
      setPhases(saved.phases || []);
      setSelectedCrafts(saved.selectedCrafts || []);
    } else {
      setStartingLevel(userLvl);
      setStartingXp(levelToXp(userLvl));
      setTargetLevel(userLvl < 200 ? getNextMilestoneLevel(userLvl) : 200);
      setPhases([]);
      setSelectedCrafts([]);
    }
  };

  // ── Auto-Optimización Inteligente con Fases ────────────────
  const handleAutoOptimize = (customTarget?: number) => {
    const goal = customTarget ?? targetLevel;
    if (startingLevel >= goal) return;

    const newPhases = generateOptimizedPhases({
      jobId,
      startingLevel,
      targetLevel: goal,
      strategy,
      xpMultiplier,
      isBoostedServer,
      maxDailyAbsorptionRatio,
      excludeByc,
      excludePebbles,
      maxCostPerCraft,
    });

    setPhases(newPhases);
    setSelectedCrafts(newPhases.flatMap((p) => p.crafts));
  };

  // Apilar siguiente fase decadal (+10 niveles)
  const handleAppendNextPhase = () => {
    if (actualLevel >= 200) return;
    const res = appendNextPhaseToPlan(phases, {
      jobId,
      strategy,
      xpMultiplier,
      isBoostedServer,
      maxDailyAbsorptionRatio,
      excludeByc,
      excludePebbles,
      maxCostPerCraft,
    });

    setPhases(res.updatedPhases);
    setTargetLevel(res.nextTargetLevel);
    setSelectedCrafts(res.updatedPhases.flatMap((p) => p.crafts));
  };

  // ── Manejo de crafteos dentro de una fase específica ────────
  const handlePhaseQuantityChange = (phaseIndex: number, itemId: number, newAmount: number) => {
    const cleanAmount = Math.max(0, Math.min(99999, Math.floor(newAmount)));

    setPhases((prevPhases) => {
      const nextPhases = prevPhases.map((phase) => {
        if (phase.phaseIndex !== phaseIndex) return phase;

        const updatedCrafts = phase.crafts
          .map((c) => (c.item.id === itemId ? { ...c, amount: cleanAmount } : c))
          .filter((c) => c.amount > 0);

        const recalculated = recalculateSelectedCraftsSequence(
          phase.startXp,
          updatedCrafts.map((c) => ({ recipe: c.recipe, item: c.item, amount: c.amount })),
          xpMultiplier,
          isBoostedServer
        );

        const craftsWithPhase = recalculated.updatedEntries.map((c) => ({
          ...c,
          phaseIndex: phase.phaseIndex,
        }));

        let inv = 0;
        let rev = 0;
        let xpG = 0;
        for (const c of craftsWithPhase) {
          inv += c.totalCraftCost;
          rev += c.totalNetSale;
          xpG += c.xpGained;
        }

        return {
          ...phase,
          crafts: craftsWithPhase,
          totalInvestment: inv,
          totalNetRevenue: rev,
          netProfitOrLoss: rev - inv,
          xpGained: xpG,
        };
      });

      setSelectedCrafts(nextPhases.flatMap((p) => p.crafts));
      return nextPhases;
    });
  };

  const handlePhaseRemoveCraft = (phaseIndex: number, itemId: number) => {
    handlePhaseQuantityChange(phaseIndex, itemId, 0);
  };

  const handleRemovePhase = (phaseIndex: number) => {
    setPhases((prevPhases) => {
      const filtered = prevPhases
        .filter((p) => p.phaseIndex !== phaseIndex)
        .map((p, idx) => ({
          ...p,
          phaseIndex: idx + 1,
          crafts: p.crafts.map((c) => ({ ...c, phaseIndex: idx + 1 })),
        }));
      setSelectedCrafts(filtered.flatMap((p) => p.crafts));
      return filtered;
    });
  };

  const togglePhaseAccordion = (phaseIndex: number) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseIndex]: prev[phaseIndex] === false ? true : false,
    }));
  };

  // ── Acciones de Crafteo Rápidas desde el Catálogo ───────────

  // Añadir +1 unidad de una receta
  const handleAddOne = (recipe: DofusRecipe, item: CraftableItem) => {
    if (phases.length === 0) {
      const nextM = getNextMilestoneLevel(actualLevel);
      const phaseStartXp = actualXp;
      const phaseTargetXp = levelToXp(nextM);

      const sim = simulateCraftBatch(phaseStartXp, item.level || 1, 1, xpMultiplier, isBoostedServer);
      const recalculated = recalculateSelectedCraftsSequence(
        phaseStartXp,
        [{ recipe, item, amount: 1 }],
        xpMultiplier,
        isBoostedServer
      );

      const entry = recalculated.updatedEntries[0];
      const newPhase: JobPlanPhase = {
        phaseIndex: 1,
        fromLevel: actualLevel,
        toLevel: nextM,
        startXp: phaseStartXp,
        targetXp: phaseTargetXp,
        requiredXp: phaseTargetXp - phaseStartXp,
        xpGained: entry?.xpGained || sim.totalXpEarned,
        crafts: recalculated.updatedEntries.map((c) => ({ ...c, phaseIndex: 1 })),
        totalInvestment: entry?.totalCraftCost || 0,
        totalNetRevenue: entry?.totalNetSale || 0,
        netProfitOrLoss: (entry?.totalNetSale || 0) - (entry?.totalCraftCost || 0),
      };

      setPhases([newPhase]);
      setSelectedCrafts(newPhase.crafts);
      return;
    }

    const lastPhase = phases[phases.length - 1];
    const existingAmount = lastPhase.crafts.find((c) => c.item.id === item.id)?.amount || 0;
    handlePhaseQuantityChange(lastPhase.phaseIndex, item.id, existingAmount + 1);
  };

  // Añadir crafteos hasta alcanzar un nivel objetivo
  const handleAddUntilLevel = (recipe: DofusRecipe, item: CraftableItem, targetLvl: number) => {
    if (actualLevel >= targetLvl) return;

    if (targetLvl === 200) {
      setTargetLevel(200);
      handleAutoOptimize(200);
      return;
    }

    const sim = simulateCraftsUntilLevel(
      actualXp,
      item.level || 1,
      targetLvl,
      xpMultiplier,
      isBoostedServer
    );

    if (sim.amountNeeded <= 0) return;

    if (phases.length === 0) {
      const phaseStartXp = actualXp;
      const phaseTargetXp = levelToXp(targetLvl);
      const recalculated = recalculateSelectedCraftsSequence(
        phaseStartXp,
        [{ recipe, item, amount: sim.amountNeeded }],
        xpMultiplier,
        isBoostedServer
      );

      const entry = recalculated.updatedEntries[0];
      const newPhase: JobPlanPhase = {
        phaseIndex: 1,
        fromLevel: actualLevel,
        toLevel: targetLvl,
        startXp: phaseStartXp,
        targetXp: phaseTargetXp,
        requiredXp: phaseTargetXp - phaseStartXp,
        xpGained: entry?.xpGained || sim.totalXpEarned,
        crafts: recalculated.updatedEntries.map((c) => ({ ...c, phaseIndex: 1 })),
        totalInvestment: entry?.totalCraftCost || 0,
        totalNetRevenue: entry?.totalNetSale || 0,
        netProfitOrLoss: (entry?.totalNetSale || 0) - (entry?.totalCraftCost || 0),
      };

      setPhases([newPhase]);
      setSelectedCrafts(newPhase.crafts);
      return;
    }

    const lastPhase = phases[phases.length - 1];
    const existingAmount = lastPhase.crafts.find((c) => c.item.id === item.id)?.amount || 0;
    handlePhaseQuantityChange(lastPhase.phaseIndex, item.id, existingAmount + sim.amountNeeded);
  };

  // Cambiar cantidad en modo vista unificada
  const handleQuantityChange = (itemId: number, newAmount: number) => {
    const cleanAmount = Math.max(0, Math.min(99999, Math.floor(newAmount)));
    if (cleanAmount === 0) {
      handleRemoveCraft(itemId);
      return;
    }
    setSelectedCrafts((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, amount: cleanAmount } : c))
    );
  };

  // Eliminar un crafteo en modo unificado
  const handleRemoveCraft = (itemId: number) => {
    setSelectedCrafts((prev) => prev.filter((c) => c.item.id !== itemId));
    setPhases((prevPhases) =>
      prevPhases.map((p) => ({
        ...p,
        crafts: p.crafts.filter((c) => c.item.id !== itemId),
      }))
    );
  };

  // Limpiar todo el plan
  const handleClearPlan = () => {
    setPhases([]);
    setSelectedCrafts([]);
    clearStoredJobPlanV2();
  };

  // Guardar plan actual como punto de partida
  const handleSaveAsStarting = () => {
    setStartingXp(actualXp);
    setStartingLevel(actualLevel);
    setTargetLevel(actualLevel < 200 ? getNextMilestoneLevel(actualLevel) : 200);
    setPhases([]);
    setSelectedCrafts([]);
  };

  // Añadir todos los materiales necesarios a la Lista de Compras
  const handleExportToShoppingList = () => {
    if (materialsNeeded.length === 0) return;

    let addedCount = 0;
    for (const mat of materialsNeeded) {
      if (mat.quantity > 0) {
        addToShoppingListById(mat.itemId, mat.quantity);
        addedCount++;
      }
    }

    setShoppingNotification(`¡Se enviaron ${addedCount} ingredientes a la Lista de Compras!`);
    setTimeout(() => setShoppingNotification(null), 4000);
  };

  // Copiar resumen con fases al portapapeles
  const handleCopySummary = () => {
    if (updatedSelectedCrafts.length === 0) return;

    let text = `📦 PLAN DE SUBIDA DE OFICIO: ${selectedJob.nameEs.toUpperCase()} (${startingLevel} -> ${actualLevel} [Meta: ${targetLevel}])\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• Inversión Total : ${planSummary.totalInvestment.toLocaleString()} k\n`;
    text += `• Retorno Total   : ${planSummary.totalNetRevenue.toLocaleString()} k${
      planSummary.totalSebuscalines && planSummary.totalSebuscalines > 0
        ? ` (HDV: ${(planSummary.totalNetRevenue - (planSummary.totalSebuscalinesValue || 0)).toLocaleString()} k + Sebuscalines: +${planSummary.totalSebuscalinesValue?.toLocaleString()} k [${planSummary.totalSebuscalines} Sebus])`
        : ""
    }\n`;
    text += `• Balance Neto    : ${planSummary.netProfitOrLoss >= 0 ? "+" : ""}${planSummary.netProfitOrLoss.toLocaleString()} k\n`;
    text += `• Total Crafteos  : ${planSummary.totalCrafts} objetos\n`;
    text += `• Eficiencia      : ${planSummary.globalKamasPerXp.toFixed(2)} k/xp\n\n`;

    if (phases.length > 0) {
      phases.forEach((p) => {
        text += `[Fase ${p.phaseIndex}: Niveles ${p.fromLevel} -> ${p.toLevel}] (+${p.xpGained.toLocaleString()} XP | Coste: ${p.totalInvestment.toLocaleString()} k)\n`;
        p.crafts.forEach((c) => {
          const sebusText = c.totalSebuscalines > 0 ? ` (+${c.totalSebuscalines} Sebus)` : "";
          text += `  - ${c.amount}x ${c.item.name?.es || c.item.name} (Lvl ${c.item.level}) | +${c.xpGained.toLocaleString()} XP | ${c.totalCraftCost.toLocaleString()} k${sebusText}\n`;
        });
        text += `\n`;
      });
    } else {
      updatedSelectedCrafts.forEach((c) => {
        const sebusText = c.totalSebuscalines > 0 ? ` (+${c.totalSebuscalines} Sebus)` : "";
        text += `  - ${c.amount}x ${c.item.name?.es || c.item.name} (Lvl ${c.item.level}) | +${c.xpGained.toLocaleString()} XP | ${c.totalCraftCost.toLocaleString()} k${sebusText}\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  // ── Catálogo de Recetas para la Tabla Inferior ─────────────
  const allJobRecipes = useMemo(() => {
    const snapshot = getCraftableItemsSnapshot();
    const pricesMap = getStoredMarketPrices();
    const salesMap = getStoredSalesVolumeMap();

    return snapshot
      .filter((item) => item.jobId === jobId && item.recipeData?.ingredientIds?.length)
      .map((item) => {
        const itemLevel = item.level || 1;
        const recipe = item.recipeData!;
        const costInfo = calculateOptimizedCraftCost(recipe, pricesMap);
        const marketPrice = pricesMap[item.id] || getStoredItemPrice(item.id) || 0;
        const netSale = Math.floor(marketPrice * 0.98);
        const totalRevenue = netSale + costInfo.sebuscalinesValue;
        const profit = totalRevenue - costInfo.cost;
        const xpAtCurrent = getCraftXpByJobLevel(itemLevel, actualLevel, xpMultiplier, 1.0, isBoostedServer);

        const volumeData = salesMap[item.id] as ItemSalesVolume | undefined;
        const salesAnalysis = analyzeSalesVolume(marketPrice, volumeData);

        const isEquip =
          item.type?.superCategoryId === 1 || item.type?.superCategoryId === 2;

        return {
          item,
          recipe,
          level: itemLevel,
          craftCost: costInfo.cost,
          marketPrice,
          netSale,
          totalRevenue,
          profit,
          sebuscalinesEarned: costInfo.sebuscalinesEarned,
          sebuscalinesValue: costInfo.sebuscalinesValue,
          xpAtCurrent,
          avgDailySales: salesAnalysis.avgDailySales || 0,
          turnoverRating: salesAnalysis.turnoverRating,
          requiresByc: costInfo.requiresByc,
          requiresPebbles: costInfo.requiresPebbles,
          isEquip,
          name: typeof item.name === "object" ? item.name.es : String(item.name || `Objeto #${item.id}`),
        };
      })
      .sort((a, b) => b.level - a.level);
  }, [jobId, actualLevel, xpMultiplier, isBoostedServer]);

  // Filtrado del catálogo
  const filteredRecipes = useMemo(() => {
    let list = allJobRecipes;

    if (recipeCategoryFilter === "consumables") {
      list = list.filter((r) => !r.isEquip);
    } else if (recipeCategoryFilter === "equipment") {
      list = list.filter((r) => r.isEquip);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || String(r.level).includes(q));
    }

    return list;
  }, [allJobRecipes, recipeCategoryFilter, searchQuery]);

  const nextMilestone = getNextMilestoneLevel(actualLevel);
  const progressPercent = calculateLevelProgressionPercent(actualXp);

  return (
    <div className="space-y-5 pb-16">
      {/* ══════════════════════════════════════════════════════ */}
      {/* 1. BARRA SUPERIOR DE PARÁMETROS (CON NIVEL OBJETIVO)   */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-start">
          {/* Job Select */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Oficio
            </label>
            <select
              value={jobId}
              onChange={(e) => handleSelectJob(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
            >
              {SUPPORTED_JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nameEs} (Lvl {jobLevels[j.id] || 1})
                </option>
              ))}
            </select>
          </div>

          {/* Level Start Input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Nivel de Inicio
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={200}
                value={startingLevel}
                onChange={(e) => handleStartingLevelChange(Number(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                onClick={() => handleStartingLevelChange(userSavedLevel)}
                title="Cargar nivel guardado de mi perfil"
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Target Level Input (NIVEL OBJETIVO CON BOTONES RÁPIDOS) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-amber-400">
                Nivel Objetivo
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Meta</span>
            </div>
            <input
              type="number"
              min={startingLevel + 1}
              max={200}
              value={targetLevel}
              onChange={(e) => handleTargetLevelChange(Number(e.target.value) || (startingLevel + 1))}
              className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400 font-mono"
            />
            <div className="flex items-center gap-1 mt-1.5">
              <button
                onClick={handleSetTargetNextMilestone}
                className="flex-1 py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
                title="Fijar siguiente hito decadal"
              >
                +Hito
              </button>
              <button
                onClick={handleSetTargetPlusTen}
                className="flex-1 py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
                title="+10 niveles"
              >
                +10
              </button>
              <button
                onClick={handleSetTarget100}
                className="flex-1 py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
                title="Fijar nivel 100"
              >
                100
              </button>
              <button
                onClick={handleSetTarget200}
                className="flex-1 py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
                title="Fijar nivel 200"
              >
                200
              </button>
            </div>
          </div>

          {/* Experience Points Input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Puntos de Experiencia (XP)
            </label>
            <input
              type="number"
              min={0}
              max={398000}
              value={startingXp}
              onChange={(e) => handleStartingXpChange(Number(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* XP Coefficient */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Coeficiente de XP
            </label>
            <select
              value={xpMultiplier}
              onChange={(e) => setXpMultiplier(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value={1.0}>100% (Normal)</option>
              <option value={1.25}>125% (+25%)</option>
              <option value={1.5}>150% (+50% Bonus Pack)</option>
              <option value={2.0}>200% (+100% Almanax)</option>
              <option value={3.0}>300% (Temporis / 3x)</option>
            </select>
          </div>

          {/* Epic Server Bonus / Boosted */}
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
              <input
                type="checkbox"
                checked={isBoostedServer}
                onChange={(e) => setIsBoostedServer(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Bonus servidor épico / x3</span>
            </label>
          </div>
        </div>

        {/* Barra de Filtros y Estrategias */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Estrategia:</span>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as JobOptimizerStrategy)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-medium focus:outline-none"
            >
              <option value="low_budget">💸 Mínimo Gasto de Bolsillo (Low Cost)</option>
              <option value="profit">💰 Máxima Rentabilidad (Reventa HDV)</option>
              <option value="high_turnover">🌊 Alta Rotación y Liquidez</option>
              <option value="fastest">⚡ Ultrarrápido (Menos Crafteos)</option>
              <option value="consumables_only">🌿 Solo Consumibles / Componentes</option>
              <option value="crush_runes">♻️ Rompe-Runas (Machacado)</option>
            </select>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Filtros avanzados</span>
            </button>
          </div>

          {/* Botón Destacado Auto-Optimizar hacia Nivel Objetivo */}
          <button
            onClick={() => handleAutoOptimize()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto-Optimizar Ruta ({startingLevel} &rarr; {targetLevel})</span>
          </button>
        </div>

        {/* Panel Desplegable de Filtros Avanzados */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs animate-fade-in">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeByc}
                onChange={(e) => setExcludeByc(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Excluir recetas de Busca y Captura (ByC)</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={excludePebbles}
                onChange={(e) => setExcludePebbles(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Excluir recetas con Guijarros de Koliseo</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 shrink-0">Límite ventas diarias:</span>
              <select
                value={maxDailyAbsorptionRatio}
                onChange={(e) => setMaxDailyAbsorptionRatio(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
              >
                <option value={1.0}>1x ventas diarias</option>
                <option value={2.0}>2x ventas diarias</option>
                <option value={3.0}>3x ventas diarias (Recomendado)</option>
                <option value={4.0}>4x ventas diarias (Flexible)</option>
                <option value={999}>Sin límite de ventas</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* 2. BARRA DE PROGRESO Y ACCIONES                       */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
        {/* Nivel y XP Ganada */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-center sm:text-left">
          <div className="text-base sm:text-lg font-bold text-white flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span>Level: {startingLevel}</span>
            {startingLevel !== actualLevel && (
              <>
                <span className="text-amber-400 font-extrabold">&rarr; {actualLevel}</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  (+{totalXpGained.toLocaleString()} xp)
                </span>
              </>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono">
              Meta: Nvl {targetLevel}
            </span>
          </div>

          {/* Acciones de la barra */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleSaveAsStarting}
              className="px-3 py-1 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-md transition"
              title="Guardar nivel alcanzado como nuevo punto de inicio"
            >
              SAVE
            </button>
            <button
              onClick={handleClearPlan}
              className="px-3 py-1 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded-md transition"
              title="Limpiar crafteos seleccionados y fases"
            >
              DELETE
            </button>
            <button
              onClick={handleCopySummary}
              className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition"
              title="Copiar plan al portapapeles"
            >
              {copiedNotification ? "¡COPIADO!" : "SHARE"}
            </button>
          </div>
        </div>

        {/* Barra azul de progreso */}
        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div
            className="bg-sky-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
            title={`${progressPercent}% (${actualXp.toLocaleString()} / ${levelToXp(actualLevel + 1).toLocaleString()} XP)`}
          />
        </div>

        {/* Mini KPIs Económicos */}
        {updatedSelectedCrafts.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 bg-slate-950/60 rounded-lg">
                <span className="text-slate-500 block text-[10px]">INVERSIÓN TOTAL</span>
                <span className="text-slate-200 font-bold">{planSummary.totalInvestment.toLocaleString()} k</span>
              </div>
              <div className="p-2 bg-slate-950/60 rounded-lg">
                <span className="text-slate-500 block text-[10px]">
                  RETORNO {planSummary.totalSebuscalines && planSummary.totalSebuscalines > 0 ? "TOTAL (HDV + ByC)" : "HDV (-2%)"}
                </span>
                <span className="text-slate-200 font-bold">{planSummary.totalNetRevenue.toLocaleString()} k</span>
              </div>
              <div className="p-2 bg-slate-950/60 rounded-lg">
                <span className="text-slate-500 block text-[10px]">BALANCE NETO</span>
                <span className={`font-bold ${planSummary.netProfitOrLoss >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {planSummary.netProfitOrLoss >= 0 ? "+" : ""}{planSummary.netProfitOrLoss.toLocaleString()} k
                </span>
              </div>
              <div className="p-2 bg-slate-950/60 rounded-lg">
                <span className="text-slate-500 block text-[10px]">EFICIENCIA GLOBAL</span>
                <span className="text-slate-300 font-bold">{planSummary.globalKamasPerXp.toFixed(2)} k/xp</span>
              </div>
            </div>

            {/* Pill informativo de Sebuscalines de Cacerías ByC */}
            {planSummary.totalSebuscalines !== undefined && planSummary.totalSebuscalines > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-amber-300">
                  <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Botín de Sebuscalines incluido:</strong> +{planSummary.totalSebuscalines.toLocaleString()} Sebuscalines de cofres ByC
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-400">
                  +{planSummary.totalSebuscalinesValue?.toLocaleString()} k de retorno
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alerta de notificación al añadir a compras */}
      {shoppingNotification && (
        <div className="flex items-center justify-between p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{shoppingNotification}</span>
          </div>
          {onNavigateToShopping && (
            <button
              onClick={onNavigateToShopping}
              className="text-xs font-semibold underline hover:text-emerald-200"
            >
              Ir a Compras &rarr;
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 3. CRAFTEOS SELECCIONADOS CON FASES Y TABS DE VISTA    */}
      {/* ══════════════════════════════════════════════════════ */}
      {(phases.length > 0 || updatedSelectedCrafts.length > 0) && (
        <div className="space-y-3">
          {/* Selector de Vistas y Botón de Apilar Fase */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("phases")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === "phases"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Plan por Fases ({phases.length})</span>
              </button>

              <button
                onClick={() => setViewMode("unified")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === "unified"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Vista Unificada ({updatedSelectedCrafts.length})</span>
              </button>
            </div>

            {actualLevel < 200 && (
              <button
                onClick={handleAppendNextPhase}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition"
                title="Apilar siguiente fase (+10 niveles)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Apilar Siguiente Fase ({actualLevel} &rarr; {getNextMilestoneLevel(actualLevel)})</span>
              </button>
            )}
          </div>

          {/* VISTA 1: PLAN POR FASES ESTRUCTURADAS */}
          {viewMode === "phases" ? (
            <div className="space-y-3">
              {phases.length === 0 ? (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
                  <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-300 font-semibold text-sm">No hay fases generadas aún.</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Haz clic en &quot;Auto-Optimizar Ruta ({startingLevel} &rarr; {targetLevel})&quot; o añade recetas desde el catálogo inferior.
                  </p>
                </div>
              ) : (
                phases.map((phase) => {
                  const isExpanded = expandedPhases[phase.phaseIndex] !== false;
                  const isComplete = phase.xpGained >= phase.requiredXp;

                  return (
                    <div
                      key={phase.phaseIndex}
                      className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm"
                    >
                      {/* Cabecera de la Fase */}
                      <div
                        onClick={() => togglePhaseAccordion(phase.phaseIndex)}
                        className="p-3.5 bg-slate-950/70 hover:bg-slate-850 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 transition select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center font-mono">
                            #{phase.phaseIndex}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <span>Fase {phase.phaseIndex}: Niveles {phase.fromLevel} &rarr; {phase.toLevel}</span>
                              {isComplete ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-[10px] font-semibold flex items-center gap-1 font-sans">
                                  <Check className="w-3 h-3" />
                                  Alcanzado
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-500/40 text-amber-400 text-[10px] font-semibold font-sans">
                                  En progreso
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              XP: +{phase.xpGained.toLocaleString()} / {phase.requiredXp.toLocaleString()} XP
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="text-right">
                            <span className="text-slate-500 block text-[10px]">INVERSIÓN</span>
                            <span className="text-slate-200 font-semibold">{phase.totalInvestment.toLocaleString()} k</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block text-[10px]">BALANCE</span>
                            <span className={`font-semibold ${phase.netProfitOrLoss >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                              {phase.netProfitOrLoss >= 0 ? "+" : ""}{phase.netProfitOrLoss.toLocaleString()} k
                            </span>
                          </div>
                          {phase.totalSebuscalines !== undefined && phase.totalSebuscalines > 0 ? (
                            <div className="hidden sm:block text-right" title="Sebuscalines generados por cacerías en esta fase">
                              <span className="text-amber-500/80 block text-[10px]">SEBUSCALINES</span>
                              <span className="text-amber-300 font-semibold">+{phase.totalSebuscalines.toLocaleString()}</span>
                            </div>
                          ) : null}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhase(phase.phaseIndex);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                            title="Eliminar esta fase"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Contenido de la Fase (Tabla de Crafteos) */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                                <th className="py-2.5 px-4 font-medium">Item</th>
                                <th className="py-2.5 px-3 font-medium text-center">Level</th>
                                <th className="py-2.5 px-3 font-medium text-center">Quantity</th>
                                <th className="py-2.5 px-3 font-medium text-right">XP earned</th>
                                <th className="py-2.5 px-4 font-medium">Ingredients</th>
                                <th className="py-2.5 px-3 font-medium text-right">Inversión</th>
                                <th className="py-2.5 px-3 font-medium text-right">Balance</th>
                                <th className="py-2.5 px-3 font-medium text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono">
                              {phase.crafts.map((c) => {
                                const resolvedName = typeof c.item.name === "object" ? c.item.name?.es || "" : String(c.item.name || `Objeto #${c.item.id}`);

                                return (
                                  <tr key={c.item.id} className="hover:bg-slate-850/50 transition">
                                    <td className="py-2.5 px-4 font-sans">
                                      <div className="flex items-center gap-2.5">
                                        <div className="relative shrink-0">
                                          <img
                                            src={getItemIconUrl({ id: c.item.id, iconId: c.item.iconId })}
                                            alt={resolvedName}
                                            className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 object-contain p-0.5"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).src = getItemFallbackIconUrl(c.item);
                                            }}
                                          />
                                          <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 bg-slate-900 border border-slate-700 text-white font-bold text-[10px] rounded font-mono shadow">
                                            {c.amount}
                                          </span>
                                        </div>
                                        <div>
                                          <div className="font-bold text-white text-xs">
                                            {resolvedName}
                                          </div>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] text-slate-500 font-mono">
                                              ID #{c.item.id}
                                            </span>
                                            {c.totalSebuscalines > 0 && (
                                              <span
                                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 font-mono font-medium"
                                                title={`Cofre de cacería: +${c.sebuscalinesPerCraft} Sebuscalines por craft (+${c.totalSebuscalinesValue.toLocaleString()} k de retorno total)`}
                                              >
                                                🪙 +{c.totalSebuscalines.toLocaleString()} Sebus (+{c.totalSebuscalinesValue.toLocaleString()} k)
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="py-2.5 px-3 text-center text-slate-300 font-bold">
                                      {c.item.level}
                                    </td>

                                    <td className="py-2.5 px-3 text-center font-sans">
                                      <input
                                        type="number"
                                        min={1}
                                        value={c.amount}
                                        onChange={(e) => handlePhaseQuantityChange(phase.phaseIndex, c.item.id, Number(e.target.value) || 1)}
                                        className="w-16 text-center bg-slate-950 border border-slate-700 rounded py-1 px-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 font-mono"
                                      />
                                    </td>

                                    <td className="py-2.5 px-3 text-right font-bold text-sky-400">
                                      +{c.xpGained.toLocaleString()}
                                    </td>

                                    <td className="py-2.5 px-4 font-sans">
                                      <div className="flex flex-wrap items-center gap-1 max-w-sm">
                                        {c.recipe?.ingredientIds?.map((ingId, idx) => {
                                          const qty = (c.recipe?.quantities?.[idx] || 1) * c.amount;
                                          return (
                                            <div
                                              key={ingId}
                                              className="relative group shrink-0"
                                              title={`Ingrediente #${ingId} x${qty}`}
                                            >
                                              <img
                                                src={getItemIconUrl(ingId)}
                                                alt={`Ing #${ingId}`}
                                                className="w-7 h-7 rounded bg-slate-950 border border-slate-800 object-contain p-0.5"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: ingId });
                                                }}
                                              />
                                              <span className="absolute -top-1 -right-1 px-1 bg-black/85 text-[8px] font-bold text-amber-300 rounded font-mono shadow">
                                                {qty}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </td>

                                    <td className="py-2.5 px-3 text-right text-slate-300">
                                      {c.totalCraftCost.toLocaleString()} k
                                    </td>

                                    <td className={`py-2.5 px-3 text-right font-semibold ${c.totalProfit >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                      <div>
                                        {c.totalProfit >= 0 ? "+" : ""}
                                        {c.totalProfit.toLocaleString()} k
                                      </div>
                                      {c.totalSebuscalines > 0 && (
                                        <div className="text-[9px] font-normal text-amber-400/90 font-mono" title="Desglose: HDV + Sebuscalines">
                                          (HDV: +{c.totalNetSale.toLocaleString()} k | ByC: +{c.totalSebuscalinesValue.toLocaleString()} k)
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-2.5 px-3 text-center">
                                      <button
                                        onClick={() => handlePhaseRemoveCraft(phase.phaseIndex, c.item.id)}
                                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                                        title="Eliminar este crafteo de la fase"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* VISTA 2: VISTA UNIFICADA (ESTILO DOFUSDB CON BADGE DE FASE) */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                      <th className="py-3 px-4 font-medium">Item</th>
                      <th className="py-3 px-3 font-medium text-center">Level</th>
                      <th className="py-3 px-3 font-medium text-center">Quantity</th>
                      <th className="py-3 px-3 font-medium text-right">XP earned</th>
                      <th className="py-3 px-4 font-medium">Ingredients</th>
                      <th className="py-3 px-3 font-medium text-right">Inversión</th>
                      <th className="py-3 px-3 font-medium text-right">Balance</th>
                      <th className="py-3 px-3 font-medium text-center">Fase</th>
                      <th className="py-3 px-3 font-medium text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {updatedSelectedCrafts.map((c) => {
                      const resolvedName = typeof c.item.name === "object" ? c.item.name?.es || "" : String(c.item.name || `Objeto #${c.item.id}`);

                      return (
                        <tr key={`${c.phaseIndex || 1}-${c.item.id}`} className="hover:bg-slate-850/50 transition">
                          <td className="py-3 px-4 font-sans">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <img
                                  src={getItemIconUrl({ id: c.item.id, iconId: c.item.iconId })}
                                  alt={resolvedName}
                                  className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 object-contain p-0.5"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = getItemFallbackIconUrl(c.item);
                                  }}
                                />
                                <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 bg-slate-900/90 border border-slate-700 text-white font-bold text-[10px] rounded font-mono shadow">
                                  {c.amount}
                                </span>
                              </div>
                              <div>
                                <div className="font-bold text-white text-sm">
                                  {resolvedName}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    ID #{c.item.id}
                                  </span>
                                  {c.totalSebuscalines > 0 && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 font-mono font-medium"
                                      title={`Cofre de cacería: +${c.sebuscalinesPerCraft} Sebuscalines por craft (+${c.totalSebuscalinesValue.toLocaleString()} k de retorno total)`}
                                    >
                                      🪙 +{c.totalSebuscalines.toLocaleString()} Sebus (+{c.totalSebuscalinesValue.toLocaleString()} k)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center text-slate-300 font-bold">
                            {c.item.level}
                          </td>

                          <td className="py-3 px-3 text-center font-sans">
                            <input
                              type="number"
                              min={1}
                              value={c.amount}
                              onChange={(e) => handleQuantityChange(c.item.id, Number(e.target.value) || 1)}
                              className="w-16 text-center bg-slate-950 border border-slate-700 rounded py-1 px-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-sky-400">
                            +{c.xpGained.toLocaleString()}
                          </td>

                          <td className="py-3 px-4 font-sans">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
                              {c.recipe?.ingredientIds?.map((ingId, idx) => {
                                const qty = (c.recipe?.quantities?.[idx] || 1) * c.amount;
                                return (
                                  <div
                                    key={ingId}
                                    className="relative group shrink-0"
                                    title={`Ingrediente #${ingId} x${qty}`}
                                  >
                                    <img
                                      src={getItemIconUrl(ingId)}
                                      alt={`Ing #${ingId}`}
                                      className="w-8 h-8 rounded bg-slate-950 border border-slate-800 object-contain p-0.5"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: ingId });
                                      }}
                                    />
                                    <span className="absolute -top-1 -right-1 px-1 bg-black/85 text-[9px] font-bold text-amber-300 rounded font-mono shadow">
                                      {qty}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right text-slate-300">
                            {c.totalCraftCost.toLocaleString()} k
                          </td>

                          <td
                            className={`py-3 px-3 text-right font-semibold ${
                              c.totalProfit >= 0 ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            <div>
                              {c.totalProfit >= 0 ? "+" : ""}
                              {c.totalProfit.toLocaleString()} k
                            </div>
                            {c.totalSebuscalines > 0 && (
                              <div className="text-[9px] font-normal text-amber-400/90 font-mono" title="Desglose: HDV + Sebuscalines">
                                (HDV: +{c.totalNetSale.toLocaleString()} k | ByC: +{c.totalSebuscalinesValue.toLocaleString()} k)
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-bold font-mono">
                              Fase {c.phaseIndex || 1}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleRemoveCraft(c.item.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                              title="Eliminar este crafteo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* LIST OF ALL NECESSARY OBJECTS (DIRECTAMENTE DEBAJO)    */}
          {/* ══════════════════════════════════════════════════════ */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                List of all necessary objects ({materialsNeeded.length} ingredientes requeridos):
              </div>

              <button
                onClick={handleExportToShoppingList}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Añadir a Lista de Compras</span>
              </button>
            </div>

            {/* Cuadrícula de iconos con cantidades totales */}
            <div className="flex flex-wrap gap-2 pt-1">
              {materialsNeeded.map((mat) => (
                <div
                  key={mat.itemId}
                  className="relative group shrink-0"
                  title={`${mat.name}: ${mat.quantity.toLocaleString()} u (~${mat.totalCost.toLocaleString()} k)${mat.sebuscalinesEarned ? ` | Genera +${mat.sebuscalinesEarned.toLocaleString()} Sebuscalines (+${mat.sebuscalinesValue?.toLocaleString()} k)` : ""}`}
                >
                  <img
                    src={getItemIconUrl({ id: mat.itemId, iconId: mat.iconId })}
                    alt={mat.name}
                    className={`w-10 h-10 rounded-lg bg-slate-900 border object-contain p-1 ${
                      mat.isByc ? "border-amber-500/60 ring-1 ring-amber-500/30" : "border-slate-700"
                    }`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: mat.itemId });
                    }}
                  />
                  <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 bg-slate-950 border border-slate-700 text-amber-300 font-bold text-[10px] rounded font-mono shadow">
                    {mat.quantity.toLocaleString()}
                  </span>
                  {mat.isByc && (
                    <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-amber-950 border border-amber-500/50 text-[8px] font-bold text-amber-400 rounded">
                      ByC
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Info box de Botín ByC en materiales si aplica */}
            {planSummary.totalSebuscalines !== undefined && planSummary.totalSebuscalines > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Botín por Cacerías ByC:</strong> Al realizar las búsquedas y capturas para obtener los recursos ByC vía fragmentos/mapa, recibes un botín adicional de <strong>+{planSummary.totalSebuscalines.toLocaleString()} Sebuscalines</strong> (+{planSummary.totalSebuscalinesValue?.toLocaleString()} k de retorno según el precio configurado en Mapas & ByC).
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 4. RECIPES CATALOG (CATÁLOGO INFERIOR EXACTO A DOFUSDB) */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3 p-4">
        {/* Encabezado del catálogo y buscador */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">Recipes</span> ({filteredRecipes.length})
            </h2>

            {/* Filtros de categoría */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setRecipeCategoryFilter("all")}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  recipeCategoryFilter === "all"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setRecipeCategoryFilter("consumables")}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  recipeCategoryFilter === "consumables"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Consumibles/Componentes
              </button>
              <button
                onClick={() => setRecipeCategoryFilter("equipment")}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  recipeCategoryFilter === "equipment"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Equipables
              </button>
            </div>
          </div>

          {/* Buscador de recetas */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Tabla de Recetas */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 font-medium">Item</th>
                <th className="py-2.5 font-medium text-center">Level</th>
                <th className="py-2.5 font-medium text-center">XP</th>
                <th className="py-2.5 font-medium">Ingredients</th>
                <th className="py-2.5 font-medium text-right">Coste</th>
                <th className="py-2.5 font-medium text-right">Balance</th>
                <th className="py-2.5 font-medium text-center">Ventas</th>
                <th className="py-2.5 font-medium text-right pr-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredRecipes.slice(0, 100).map((r) => {
                const canCraftForLevel = actualLevel >= r.level && actualLevel <= r.level + 100;

                return (
                  <tr
                    key={r.item.id}
                    className={`hover:bg-slate-850/50 transition ${
                      !canCraftForLevel ? "opacity-35" : ""
                    }`}
                  >
                    {/* Item */}
                    <td className="py-2.5 font-sans">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getItemIconUrl({ id: r.item.id, iconId: r.item.iconId })}
                          alt={r.name}
                          className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 object-contain p-0.5 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getItemFallbackIconUrl(r.item);
                          }}
                        />
                        <div>
                          <div className="font-semibold text-slate-200">{r.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-500 font-mono">#{r.item.id}</span>
                            {r.sebuscalinesEarned > 0 && (
                              <span
                                className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] text-amber-300 font-mono"
                                title={`Genera +${r.sebuscalinesEarned} Sebuscalines (+${r.sebuscalinesValue.toLocaleString()} k de retorno por unidad)`}
                              >
                                🪙 +{r.sebuscalinesEarned} Sebus
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Level */}
                    <td className="py-2.5 text-center text-slate-300 font-bold">{r.level}</td>

                    {/* XP otorgada en tu nivel actual */}
                    <td className="py-2.5 text-center text-sky-400 font-bold">
                      {r.xpAtCurrent > 0 ? r.xpAtCurrent.toLocaleString() : "0"}
                    </td>

                    {/* Ingredients (miniaturas con cantidades por craft) */}
                    <td className="py-2.5 font-sans">
                      <div className="flex flex-wrap items-center gap-1 max-w-sm">
                        {r.recipe.ingredientIds?.map((ingId, idx) => {
                          const qty = r.recipe.quantities?.[idx] || 1;
                          return (
                            <div
                              key={ingId}
                              className="relative group shrink-0"
                              title={`Ingrediente #${ingId} x${qty}`}
                            >
                              <img
                                src={getItemIconUrl(ingId)}
                                alt={`Ing #${ingId}`}
                                className="w-7 h-7 rounded bg-slate-950 border border-slate-800 object-contain p-0.5"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: ingId });
                                }}
                              />
                              <span className="absolute -top-1 -right-1 px-1 bg-black/80 text-[8px] font-bold text-amber-300 rounded font-mono shadow">
                                {qty}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    {/* Coste */}
                    <td className="py-2.5 text-right text-slate-300">
                      {r.craftCost.toLocaleString()} k
                    </td>

                    {/* Balance */}
                    <td
                      className={`py-2.5 text-right font-semibold ${
                        r.profit >= 0 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      <div>
                        {r.profit >= 0 ? "+" : ""}
                        {r.profit.toLocaleString()} k
                      </div>
                      {r.sebuscalinesEarned > 0 && (
                        <div className="text-[9px] font-normal text-amber-400/90 font-mono" title="HDV + Sebuscalines">
                          (HDV: +{r.netSale.toLocaleString()} k | ByC: +{r.sebuscalinesValue.toLocaleString()} k)
                        </div>
                      )}
                    </td>

                    {/* Ventas diarias */}
                    <td className="py-2.5 text-center font-sans">
                      {r.avgDailySales > 0 ? (
                        <span className="text-slate-300 font-mono text-[11px]">
                          {r.avgDailySales.toFixed(1)}/d
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px]">Sin ventas</span>
                      )}
                    </td>

                    {/* Botones de acción verdes (igual que DofusDB) */}
                    <td className="py-2.5 text-right pr-2 font-sans">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Botón +1 */}
                        <button
                          onClick={() => handleAddOne(r.recipe, r.item)}
                          className="px-2.5 py-1 rounded bg-lime-600 hover:bg-lime-500 text-white text-xs font-bold shadow transition"
                          title="Añadir 1 crafteo"
                        >
                          +1
                        </button>

                        {/* Botón -> Siguiente Hito (ej. ->190) */}
                        {actualLevel < nextMilestone && r.xpAtCurrent > 0 && (
                          <button
                            onClick={() => handleAddUntilLevel(r.recipe, r.item, nextMilestone)}
                            className="px-2.5 py-1 rounded bg-lime-600 hover:bg-lime-500 text-white text-xs font-bold shadow transition"
                            title={`Añadir crafteos hasta el nivel ${nextMilestone}`}
                          >
                            -&gt;{nextMilestone}
                          </button>
                        )}

                        {/* Botón -> 200 */}
                        {actualLevel < 200 && r.xpAtCurrent > 0 && (
                          <button
                            onClick={() => handleAddUntilLevel(r.recipe, r.item, 200)}
                            className="px-2.5 py-1 rounded bg-lime-600 hover:bg-lime-500 text-white text-xs font-bold shadow transition"
                            title="Añadir crafteos hasta el nivel 200"
                          >
                            -&gt;200
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

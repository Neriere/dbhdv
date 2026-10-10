import { useState, useEffect, useMemo } from 'react';
import {
  SUPPORTED_JOBS,
  JobOptimizerStrategy,
  SelectedCraftEntry,
  JobPlanState,
  JobPlanPhase,
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
  simulateCraftBatch,
  simulateCraftsUntilLevel,
  getStoredJobPlanV2,
  saveStoredJobPlanV2,
  clearStoredJobPlanV2,
  isQuestOrZeroXpCraft,
  getItemCraftXpRatio,
} from '../../../services/jobLevelingService';
import { useUserJobs } from '../../../hooks/useUserJobs';
import {
  getCraftableItemsSnapshot,
  getStoredMarketPrices,
  getStoredItemPrice,
  addToShoppingListById,
  CraftableItem,
} from '../../../services/dofusDbService';
import {
  getStoredSalesVolumeMap,
  analyzeSalesVolume,
  ItemSalesVolume,
} from '../../../services/salesVolumeService';
import { DofusRecipe } from '../../../types';
import { CatalogRecipeItem, JobLevelingOptimizerProps } from './types';

export function useJobLevelingOptimizer({
  initialJobId,
}: JobLevelingOptimizerProps = {}) {
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
    if (saved?.strategy === 'mixed') return 'mixed_budget';
    return saved?.strategy ?? 'mixed_budget';
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
    if (saved?.phases && saved.jobId === jobId) {
      return saved.phases
        .map((p) => ({
          ...p,
          crafts: (p.crafts || []).filter((c) => !isQuestOrZeroXpCraft(c.item, c.recipe)),
        }))
        .filter((p) => p.crafts.length > 0);
    }
    return [];
  });

  const [selectedCrafts, setSelectedCrafts] = useState<SelectedCraftEntry[]>(() => {
    const saved = getStoredJobPlanV2();
    if (saved && saved.jobId === jobId) {
      return (saved.selectedCrafts || []).filter((c) => !isQuestOrZeroXpCraft(c.item, c.recipe));
    }
    return [];
  });

  const [viewMode, setViewMode] = useState<'phases' | 'unified'>('phases');
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});

  // ── 4. Estado de UI y Búsqueda ─────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [recipeCategoryFilter, setRecipeCategoryFilter] = useState<'all' | 'consumables' | 'equipment'>('all');
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
      startingXp,
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
  const handlePhaseQuantityChange = (
    phaseIndex: number,
    itemId: number,
    newAmount: number,
    destination?: 'sell' | 'crush',
    itemObj?: CraftableItem,
    recipeObj?: DofusRecipe
  ) => {
    const cleanAmount = Math.max(0, Math.min(99999, Math.floor(newAmount)));

    setPhases((prevPhases) => {
      const nextPhases = prevPhases.map((phase) => {
        if (phase.phaseIndex !== phaseIndex) return phase;

        const exists = phase.crafts.some(
          (c) => c.item.id === itemId && (c.destination || 'sell') === (destination || 'sell')
        );

        let rawCrafts: Array<{
          recipe: DofusRecipe;
          item: CraftableItem;
          amount: number;
          destination?: 'sell' | 'crush';
        }>;

        if (exists) {
          rawCrafts = phase.crafts
            .map((c) =>
              c.item.id === itemId && (c.destination || 'sell') === (destination || 'sell')
                ? { recipe: c.recipe, item: c.item, amount: cleanAmount, destination: c.destination }
                : { recipe: c.recipe, item: c.item, amount: c.amount, destination: c.destination }
            )
            .filter((c) => c.amount > 0);
        } else if (cleanAmount > 0 && recipeObj && itemObj) {
          rawCrafts = [
            ...phase.crafts.map((c) => ({
              recipe: c.recipe,
              item: c.item,
              amount: c.amount,
              destination: c.destination,
            })),
            {
              recipe: recipeObj,
              item: itemObj,
              amount: cleanAmount,
              destination: destination || 'sell',
            },
          ];
        } else {
          return phase;
        }

        const recalculated = recalculateSelectedCraftsSequence(
          phase.startXp,
          rawCrafts,
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
        let sebus = 0;
        let sebusVal = 0;
        for (const c of craftsWithPhase) {
          inv += c.totalCraftCost;
          rev += (c.totalRevenue ?? (c.totalNetSale + (c.totalSebuscalinesValue || 0)));
          sebus += (c.totalSebuscalines || 0);
          sebusVal += (c.totalSebuscalinesValue || 0);
          xpG += c.xpGained;
        }

        return {
          ...phase,
          crafts: craftsWithPhase,
          totalInvestment: inv,
          totalNetRevenue: rev,
          totalSebuscalines: sebus,
          totalSebuscalinesValue: sebusVal,
          netProfitOrLoss: rev - inv,
          xpGained: xpG,
        };
      });

      setSelectedCrafts(nextPhases.flatMap((p) => p.crafts));
      return nextPhases;
    });
  };

  const handlePhaseRemoveCraft = (
    phaseIndex: number,
    itemId: number,
    destination?: 'sell' | 'crush'
  ) => {
    handlePhaseQuantityChange(phaseIndex, itemId, 0, destination);
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
  const handleAddOne = (recipe: DofusRecipe, item: CraftableItem) => {
    if (phases.length === 0) {
      const nextM = getNextMilestoneLevel(actualLevel);
      const phaseStartXp = actualXp;
      const phaseTargetXp = levelToXp(nextM);

      const itemRatio = getItemCraftXpRatio(item, recipe);

      const sim = simulateCraftBatch(phaseStartXp, item.level || 1, 1, xpMultiplier, isBoostedServer, itemRatio);
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
    const existingEntry = lastPhase.crafts.find((c) => c.item.id === item.id);
    const existingAmount = existingEntry?.amount || 0;
    handlePhaseQuantityChange(
      lastPhase.phaseIndex,
      item.id,
      existingAmount + 1,
      existingEntry?.destination || 'sell',
      item,
      recipe
    );
  };

  const handleAddUntilLevel = (recipe: DofusRecipe, item: CraftableItem, targetLvl: number) => {
    if (actualLevel >= targetLvl) return;

    if (targetLvl === 200) {
      setTargetLevel(200);
      handleAutoOptimize(200);
      return;
    }

    const itemRatio = getItemCraftXpRatio(item, recipe);

    const sim = simulateCraftsUntilLevel(
      actualXp,
      item.level || 1,
      targetLvl,
      xpMultiplier,
      isBoostedServer,
      itemRatio
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
    const existingEntry = lastPhase.crafts.find((c) => c.item.id === item.id);
    const existingAmount = existingEntry?.amount || 0;
    handlePhaseQuantityChange(
      lastPhase.phaseIndex,
      item.id,
      existingAmount + sim.amountNeeded,
      existingEntry?.destination || 'sell',
      item,
      recipe
    );
  };

  const handleQuantityChange = (itemId: number, newAmount: number, destination?: 'sell' | 'crush') => {
    const cleanAmount = Math.max(0, Math.min(99999, Math.floor(newAmount)));
    if (cleanAmount === 0) {
      handleRemoveCraft(itemId, destination);
      return;
    }
    setSelectedCrafts((prev) =>
      prev.map((c) =>
        c.item.id === itemId && (c.destination || 'sell') === (destination || 'sell')
          ? { ...c, amount: cleanAmount }
          : c
      )
    );
    if (phases.length > 0) {
      const targetPhase = phases.find((p) =>
        p.crafts.some((c) => c.item.id === itemId && (c.destination || 'sell') === (destination || 'sell'))
      );
      if (targetPhase) {
        handlePhaseQuantityChange(targetPhase.phaseIndex, itemId, cleanAmount, destination);
      }
    }
  };

  const handleRemoveCraft = (itemId: number, destination?: 'sell' | 'crush') => {
    setSelectedCrafts((prev) =>
      prev.filter(
        (c) => !(c.item.id === itemId && (c.destination || 'sell') === (destination || 'sell'))
      )
    );
    setPhases((prevPhases) =>
      prevPhases.map((p) => ({
        ...p,
        crafts: p.crafts.filter(
          (c) => !(c.item.id === itemId && (c.destination || 'sell') === (destination || 'sell'))
        ),
      }))
    );
  };

  const handleClearPlan = () => {
    setPhases([]);
    setSelectedCrafts([]);
    clearStoredJobPlanV2();
  };

  const handleSaveAsStarting = () => {
    setStartingXp(actualXp);
    setStartingLevel(actualLevel);
    setTargetLevel(actualLevel < 200 ? getNextMilestoneLevel(actualLevel) : 200);
    setPhases([]);
    setSelectedCrafts([]);
  };

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

  const handleCopySummary = () => {
    if (updatedSelectedCrafts.length === 0) return;

    let text = `📦 PLAN DE SUBIDA DE OFICIO: ${selectedJob.nameEs.toUpperCase()} (${startingLevel} -> ${actualLevel} [Meta: ${targetLevel}])\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• Inversión Total : ${planSummary.totalInvestment.toLocaleString()} k\n`;
    text += `• Retorno Total   : ${planSummary.totalNetRevenue.toLocaleString()} k${
      planSummary.totalSebuscalines && planSummary.totalSebuscalines > 0
        ? ` (HDV: ${(planSummary.totalNetRevenue - (planSummary.totalSebuscalinesValue || 0)).toLocaleString()} k + Sebuscalines: +${planSummary.totalSebuscalinesValue?.toLocaleString()} k [${planSummary.totalSebuscalines} Sebus])`
        : ''
    }\n`;
    text += `• Balance Neto    : ${planSummary.netProfitOrLoss >= 0 ? '+' : ''}${planSummary.netProfitOrLoss.toLocaleString()} k\n`;
    text += `• Total Crafteos  : ${planSummary.totalCrafts} objetos\n`;
    text += `• Eficiencia      : ${planSummary.globalKamasPerXp.toFixed(2)} k/xp\n\n`;

    if (phases.length > 0) {
      phases.forEach((p) => {
        text += `[Fase ${p.phaseIndex}: Niveles ${p.fromLevel} -> ${p.toLevel}] (+${p.xpGained.toLocaleString()} XP | Coste: ${p.totalInvestment.toLocaleString()} k)\n`;
        p.crafts.forEach((c) => {
          const sebusText = c.totalSebuscalines > 0 ? ` (+${c.totalSebuscalines} Sebus)` : '';
          const destTag = c.destination === 'crush' ? ' [♻️ Romper Runas]' : ' [🛒 Venta HDV]';
          text += `  - ${c.amount}x ${c.item.name?.es || c.item.name} (Lvl ${c.item.level})${destTag} | +${c.xpGained.toLocaleString()} XP | ${c.totalCraftCost.toLocaleString()} k${sebusText}\n`;
        });
        text += `\n`;
      });
    } else {
      updatedSelectedCrafts.forEach((c) => {
        const sebusText = c.totalSebuscalines > 0 ? ` (+${c.totalSebuscalines} Sebus)` : '';
        const destTag = c.destination === 'crush' ? ' [♻️ Romper Runas]' : ' [🛒 Venta HDV]';
        text += `  - ${c.amount}x ${c.item.name?.es || c.item.name} (Lvl ${c.item.level})${destTag} | +${c.xpGained.toLocaleString()} XP | ${c.totalCraftCost.toLocaleString()} k${sebusText}\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  // ── Catálogo de Recetas para la Tabla Inferior ─────────────
  const allJobRecipes = useMemo<CatalogRecipeItem[]>(() => {
    const snapshot = getCraftableItemsSnapshot();
    const pricesMap = getStoredMarketPrices();
    const salesMap = getStoredSalesVolumeMap();

    return snapshot
      .filter((item) => {
        if (item.jobId !== jobId || !item.recipeData?.ingredientIds?.length) return false;
        if (isQuestOrZeroXpCraft(item, item.recipeData)) return false;
        return true;
      })
      .map((item) => {
        const itemLevel = item.level || 1;
        const recipe = item.recipeData!;
        const costInfo = calculateOptimizedCraftCost(recipe, pricesMap);
        const marketPrice = pricesMap[item.id] || getStoredItemPrice(item.id) || 0;
        const netSale = Math.floor(marketPrice * 0.98);
        const totalRevenue = netSale + costInfo.sebuscalinesValue;
        const profit = totalRevenue - costInfo.cost;
        const xpRatio = getItemCraftXpRatio(item, recipe);
        const xpAtCurrent = getCraftXpByJobLevel(itemLevel, actualLevel, xpMultiplier, xpRatio, isBoostedServer);

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
          name: typeof item.name === 'object' ? item.name.es : String(item.name || `Objeto #${item.id}`),
        };
      })
      .sort((a, b) => b.level - a.level);
  }, [jobId, actualLevel, xpMultiplier, isBoostedServer]);

  // Filtrado del catálogo
  const filteredRecipes = useMemo(() => {
    let list = allJobRecipes;

    if (recipeCategoryFilter === 'consumables') {
      list = list.filter((r) => !r.isEquip);
    } else if (recipeCategoryFilter === 'equipment') {
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

  return {
    jobId,
    jobLevels,
    selectedJob,
    userSavedLevel,
    startingLevel,
    targetLevel,
    startingXp,
    xpMultiplier,
    isBoostedServer,
    strategy,
    setStrategy,
    maxDailyAbsorptionRatio,
    setMaxDailyAbsorptionRatio,
    excludeByc,
    setExcludeByc,
    excludePebbles,
    setExcludePebbles,
    maxCostPerCraft,
    setMaxCostPerCraft,
    showAdvancedFilters,
    setShowAdvancedFilters,
    phases,
    selectedCrafts,
    viewMode,
    setViewMode,
    expandedPhases,
    searchQuery,
    setSearchQuery,
    recipeCategoryFilter,
    setRecipeCategoryFilter,
    copiedNotification,
    shoppingNotification,
    updatedSelectedCrafts,
    actualXp,
    actualLevel,
    materialsNeeded,
    totalXpGained,
    planSummary,
    allJobRecipes,
    filteredRecipes,
    nextMilestone,
    progressPercent,
    handleStartingLevelChange,
    handleTargetLevelChange,
    handleSetTargetNextMilestone,
    handleSetTargetPlusTen,
    handleSetTarget100,
    handleSetTarget200,
    handleStartingXpChange,
    handleSelectJob,
    setXpMultiplier,
    setIsBoostedServer,
    handleAutoOptimize,
    handleAppendNextPhase,
    handlePhaseQuantityChange,
    handlePhaseRemoveCraft,
    handleRemovePhase,
    togglePhaseAccordion,
    handleAddOne,
    handleAddUntilLevel,
    handleQuantityChange,
    handleRemoveCraft,
    handleClearPlan,
    handleSaveAsStarting,
    handleExportToShoppingList,
    handleCopySummary,
  };
}

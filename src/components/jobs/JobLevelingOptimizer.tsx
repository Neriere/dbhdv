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
} from "lucide-react";
import {
  SUPPORTED_JOBS,
  JobOptimizerStrategy,
  SelectedCraftEntry,
  ConsolidatedMaterial,
  JobPlanState,
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
    return saved?.excludeByc ?? true; // Excluir ByC por defecto para evitar costes de criminales
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

  // ── 3. Lista de Crafteos Seleccionados (Selected Crafts) ───
  const [selectedCrafts, setSelectedCrafts] = useState<SelectedCraftEntry[]>(() => {
    const saved = getStoredJobPlanV2();
    if (saved && saved.jobId === jobId) return saved.selectedCrafts || [];
    return [];
  });

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
    updatedSelectedCrafts,
    materialsNeeded,
    planSummary,
  ]);

  // Cambiar nivel inicial (sincroniza XP)
  const handleStartingLevelChange = (lvl: number) => {
    const cleanLvl = Math.max(1, Math.min(200, lvl));
    setStartingLevel(cleanLvl);
    setStartingXp(levelToXp(cleanLvl));
  };

  // Cambiar XP inicial (sincroniza Nivel)
  const handleStartingXpChange = (xp: number) => {
    const cleanXp = Math.max(0, xp);
    setStartingXp(cleanXp);
    setStartingLevel(xpToLevel(cleanXp));
  };

  // Cambiar de oficio
  const handleSelectJob = (newJobId: number) => {
    setJobId(newJobId);
    const userLvl = jobLevels[newJobId] || 1;

    const saved = getStoredJobPlanV2();
    if (saved && saved.jobId === newJobId) {
      setStartingLevel(saved.startingLevel);
      setStartingXp(saved.startingXp);
      setXpMultiplier(saved.xpMultiplier);
      setIsBoostedServer(saved.isBoostedServer);
      setStrategy(saved.strategy);
      setSelectedCrafts(saved.selectedCrafts);
    } else {
      setStartingLevel(userLvl);
      setStartingXp(levelToXp(userLvl));
      setSelectedCrafts([]);
    }
  };

  // ── Acciones de Crafteo (Idénticas a DofusDB) ──────────────

  // Añadir +1 unidad de una receta
  const handleAddOne = (recipe: DofusRecipe, item: CraftableItem) => {
    setSelectedCrafts((prev) => {
      const existingIdx = prev.findIndex((c) => c.item.id === item.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          amount: copy[existingIdx].amount + 1,
        };
        return copy;
      }
      return [
        {
          recipe,
          item,
          amount: 1,
          xpGained: 0,
          craftCostUnit: 0,
          totalCraftCost: 0,
          marketPriceUnit: 0,
          netSaleUnit: 0,
          totalNetSale: 0,
          profitUnit: 0,
          totalProfit: 0,
          avgDailySales: 0,
          turnoverRating: null,
          daysToSell: null,
          requiresByc: false,
          requiresPebbles: false,
        },
        ...prev,
      ];
    });
  };

  // Añadir crafteos hasta alcanzar un nivel objetivo (ej. -> 190 o -> 200)
  const handleAddUntilLevel = (recipe: DofusRecipe, item: CraftableItem, targetLvl: number) => {
    if (actualLevel >= targetLvl) return;

    // Simular exactamente cuántos se necesitan a partir del actualXp
    const sim = simulateCraftsUntilLevel(
      actualXp,
      item.level || 1,
      targetLvl,
      xpMultiplier,
      isBoostedServer
    );

    if (sim.amountNeeded <= 0) return;

    setSelectedCrafts((prev) => {
      const existingIdx = prev.findIndex((c) => c.item.id === item.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          amount: copy[existingIdx].amount + sim.amountNeeded,
        };
        return copy;
      }
      return [
        {
          recipe,
          item,
          amount: sim.amountNeeded,
          xpGained: 0,
          craftCostUnit: 0,
          totalCraftCost: 0,
          marketPriceUnit: 0,
          netSaleUnit: 0,
          totalNetSale: 0,
          profitUnit: 0,
          totalProfit: 0,
          avgDailySales: 0,
          turnoverRating: null,
          daysToSell: null,
          requiresByc: false,
          requiresPebbles: false,
        },
        ...prev,
      ];
    });
  };

  // Cambiar cantidad de un crafteo seleccionado
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

  // Eliminar un crafteo del plan
  const handleRemoveCraft = (itemId: number) => {
    setSelectedCrafts((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  // Limpiar todo el plan
  const handleClearPlan = () => {
    setSelectedCrafts([]);
    clearStoredJobPlanV2();
  };

  // Guardar plan actual como punto de partida (startingXp = actualXp)
  const handleSaveAsStarting = () => {
    setStartingXp(actualXp);
    setStartingLevel(actualLevel);
    setSelectedCrafts([]);
  };

  // ── Auto-Optimización Inteligente ──────────────────────────
  const handleAutoOptimize = () => {
    const nextTarget = actualLevel < 200 ? getNextMilestoneLevel(actualLevel) : 200;
    const optimized = generateAutoOptimizedCrafts({
      jobId,
      startingLevel: actualLevel,
      targetLevel: nextTarget,
      strategy,
      xpMultiplier,
      isBoostedServer,
      maxDailyAbsorptionRatio,
      excludeByc,
      excludePebbles,
      maxCostPerCraft,
    });

    if (optimized.length > 0) {
      setSelectedCrafts((prev) => [...prev, ...optimized]);
    }
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

  // Copiar resumen de texto al portapapeles
  const handleCopySummary = () => {
    if (updatedSelectedCrafts.length === 0) return;

    let text = `📦 PLAN DE SUBIDA DE OFICIO: ${selectedJob.nameEs.toUpperCase()} (${startingLevel} -> ${actualLevel})\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• Inversión Total : ${planSummary.totalInvestment.toLocaleString()} k\n`;
    text += `• Retorno HDV     : ${planSummary.totalNetRevenue.toLocaleString()} k\n`;
    text += `• Balance Neto    : ${planSummary.netProfitOrLoss >= 0 ? "+" : ""}${planSummary.netProfitOrLoss.toLocaleString()} k\n`;
    text += `• Total Crafteos  : ${planSummary.totalCrafts} objetos\n`;
    text += `• Eficiencia      : ${planSummary.globalKamasPerXp.toFixed(2)} k/xp\n\n`;
    text += `CRAFTEOS:\n`;

    updatedSelectedCrafts.forEach((c) => {
      text += `  - ${c.amount}x ${c.item.name?.es || c.item.name} (Lvl ${c.item.level}) | +${c.xpGained.toLocaleString()} XP | Coste: ${c.totalCraftCost.toLocaleString()} k\n`;
    });

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
        const profit = netSale - costInfo.cost;
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
          profit,
          xpAtCurrent,
          avgDailySales: salesAnalysis.avgDailySales || 0,
          turnoverRating: salesAnalysis.turnoverRating,
          requiresByc: costInfo.requiresByc,
          requiresPebbles: costInfo.requiresPebbles,
          isEquip,
          name: typeof item.name === "object" ? item.name.es : String(item.name || `Objeto #${item.id}`),
        };
      })
      .sort((a, b) => b.level - a.level); // Mayor nivel a menor por defecto (igual que DofusDB)
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
      {/* 1. BARRA SUPERIOR DE PARÁMETROS (ESTILO DOFUSDB)      */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
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

          {/* Level Input */}
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
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition"
              >
                <RotateCcw className="w-4 h-4" />
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
            <span className="text-slate-400 font-medium">Estrategia de Auto-Optimizar:</span>
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

          {/* Botón Destacado Auto-Optimizar */}
          <button
            onClick={handleAutoOptimize}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto-Optimizar Ruta ({strategy === "low_budget" ? "Mínimo Gasto" : "Rentable"})</span>
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
      {/* 2. BARRA DE PROGRESO Y ACCIONES (ESTILO DOFUSDB)       */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
        {/* Nivel y XP Ganada */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-center sm:text-left">
          <div className="text-base sm:text-lg font-bold text-white flex items-center justify-center sm:justify-start gap-2">
            <span>Level: {startingLevel}</span>
            {startingLevel !== actualLevel && (
              <>
                <span className="text-amber-400 font-extrabold">&rarr; {actualLevel}</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  (+{totalXpGained.toLocaleString()} xp)
                </span>
              </>
            )}
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
              title="Limpiar crafteos seleccionados"
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

        {/* Barra azul de progreso (exacta a DofusDB) */}
        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div
            className="bg-sky-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
            title={`${progressPercent}% (${actualXp.toLocaleString()} / ${levelToXp(actualLevel + 1).toLocaleString()} XP)`}
          />
        </div>

        {/* Mini KPIs Económicos añadidos por DBHDV */}
        {updatedSelectedCrafts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
            <div className="p-2 bg-slate-950/60 rounded-lg">
              <span className="text-slate-500 block text-[10px]">INVERSIÓN TOTAL</span>
              <span className="text-slate-200 font-bold">{planSummary.totalInvestment.toLocaleString()} k</span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded-lg">
              <span className="text-slate-500 block text-[10px]">RETORNO HDV (-2%)</span>
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
      {/* 3. TABLA DE CRAFTEOS SELECCIONADOS (SELECTED CRAFTS)   */}
      {/* ══════════════════════════════════════════════════════ */}
      {updatedSelectedCrafts.length > 0 && (
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
                  <th className="py-3 px-3 font-medium text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {updatedSelectedCrafts.map((c) => {
                  const resolvedName = typeof c.item.name === "object" ? c.item.name?.es || "" : String(c.item.name || `Objeto #${c.item.id}`);

                  return (
                    <tr key={c.item.id} className="hover:bg-slate-850/50 transition">
                      {/* Item con badge de cantidad encima del icono (igual que DofusDB) */}
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
                            <div className="text-[10px] text-slate-500 font-mono">
                              ID #{c.item.id}
                            </div>
                          </div>
                        </div>
                      </td>

                    {/* Level */}
                    <td className="py-3 px-3 text-center text-slate-300 font-bold">
                      {c.item.level}
                    </td>

                    {/* Quantity editable */}
                    <td className="py-3 px-3 text-center font-sans">
                      <input
                        type="number"
                        min={1}
                        value={c.amount}
                        onChange={(e) => handleQuantityChange(c.item.id, Number(e.target.value) || 1)}
                        className="w-16 text-center bg-slate-950 border border-slate-700 rounded py-1 px-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </td>

                    {/* XP earned (con decaimiento exacto acumulado) */}
                    <td className="py-3 px-3 text-right font-bold text-sky-400">
                      +{c.xpGained.toLocaleString()}
                    </td>

                    {/* Ingredients (miniaturas con cantidades multiplicadas) */}
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

                    {/* Inversión en Kamas */}
                    <td className="py-3 px-3 text-right text-slate-300">
                      {c.totalCraftCost.toLocaleString()} k
                    </td>

                    {/* Balance Neto */}
                    <td
                      className={`py-3 px-3 text-right font-semibold ${
                        c.totalProfit >= 0 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {c.totalProfit >= 0 ? "+" : ""}
                      {c.totalProfit.toLocaleString()} k
                    </td>

                    {/* Trash Button */}
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

          {/* ══════════════════════════════════════════════════════ */}
          {/* LIST OF ALL NECESSARY OBJECTS (DIRECTAMENTE DEBAJO)    */}
          {/* ══════════════════════════════════════════════════════ */}
          <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
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

            {/* Cuadrícula de iconos con cantidades totales (idéntica a DofusDB) */}
            <div className="flex flex-wrap gap-2 pt-1">
              {materialsNeeded.map((mat) => (
                <div
                  key={mat.itemId}
                  className="relative group shrink-0"
                  title={`${mat.name}: ${mat.quantity.toLocaleString()} u (~${mat.totalCost.toLocaleString()} k)`}
                >
                  <img
                    src={getItemIconUrl({ id: mat.itemId, iconId: mat.iconId })}
                    alt={mat.name}
                    className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 object-contain p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: mat.itemId });
                    }}
                  />
                  <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 bg-slate-950 border border-slate-700 text-amber-300 font-bold text-[10px] rounded font-mono shadow">
                    {mat.quantity.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
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
                          <div className="text-[10px] text-slate-500 font-mono">#{r.item.id}</div>
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
                      {r.profit >= 0 ? "+" : ""}
                      {r.profit.toLocaleString()} k
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

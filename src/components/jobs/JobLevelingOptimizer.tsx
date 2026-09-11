import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Hammer,
  Sparkles,
  TrendingUp,
  Coins,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Copy,
  Check,
  Search,
  Zap,
  Clock,
  Layers,
  Info,
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
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  SUPPORTED_JOBS,
  JobOptimizerMode,
  JobLevelingPlan,
  TierPlanResult,
  CraftPlanItem,
  ConsolidatedIngredient,
  levelToXp,
  xpToLevel,
  getCraftXpByJobLevel,
  getNextMilestoneLevel,
  calculateLevelTiers,
  generateOptimizedJobPlan,
  appendNextTierToPlan,
  consolidateIngredients,
  calculatePlanSummary,
  getStoredJobPlan,
  saveStoredJobPlan,
} from "../../services/jobLevelingService";
import { useUserJobs } from "../../hooks/useUserJobs";
import {
  getCraftableItemsSnapshot,
  getStoredMarketPrices,
  calculateItemCraftCost,
  getStoredItemPrice,
  getItemIconUrl,
  getItemFallbackIconUrl,
  addToShoppingListById,
} from "../../services/dofusDbService";
import {
  getStoredSalesVolumeMap,
  analyzeSalesVolume,
  ItemSalesVolume,
} from "../../services/salesVolumeService";

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

  // ── Selección de Oficio ────────────────────────────────────
  const [selectedJobId, setSelectedJobId] = useState<number>(() => {
    if (initialJobId && SUPPORTED_JOBS.some((j) => j.id === initialJobId)) {
      return initialJobId;
    }
    const saved = getStoredJobPlan();
    if (saved?.jobId && SUPPORTED_JOBS.some((j) => j.id === saved.jobId)) {
      return saved.jobId;
    }
    return 16; // Joyero por defecto
  });

  const selectedJob = useMemo(
    () => SUPPORTED_JOBS.find((j) => j.id === selectedJobId) || SUPPORTED_JOBS[0],
    [selectedJobId]
  );

  // ── Parámetros de Planificación ────────────────────────────
  const userSavedLevel = jobLevels[selectedJobId] || 1;

  const [startingLevel, setStartingLevel] = useState<number>(() => {
    const saved = getStoredJobPlan();
    if (saved && saved.jobId === selectedJobId) return saved.startingLevel;
    return userSavedLevel;
  });

  const [targetLevel, setTargetLevel] = useState<number>(() => {
    const saved = getStoredJobPlan();
    if (saved && saved.jobId === selectedJobId) return saved.targetLevel;
    return getNextMilestoneLevel(userSavedLevel);
  });

  const [xpMultiplier, setXpMultiplier] = useState<number>(() => {
    const saved = getStoredJobPlan();
    return saved?.xpMultiplier ?? 1.0;
  });

  const [mode, setMode] = useState<JobOptimizerMode>(() => {
    const saved = getStoredJobPlan();
    return saved?.mode ?? "cheapest";
  });

  const [maxDailyAbsorptionRatio, setMaxDailyAbsorptionRatio] = useState<number>(() => {
    const saved = getStoredJobPlan();
    return saved?.maxDailyAbsorptionRatio ?? 3.0;
  });

  const [skipItemsWithNoSales, setSkipItemsWithNoSales] = useState<boolean>(() => {
    const saved = getStoredJobPlan();
    return saved?.skipItemsWithNoSales ?? false;
  });

  // ── Estado del Plan ───────────────────────────────────────
  const [plan, setPlan] = useState<JobLevelingPlan | null>(() => {
    const saved = getStoredJobPlan();
    if (saved && saved.jobId === selectedJobId) return saved;
    return null;
  });

  const [activeTab, setActiveTab] = useState<"tiers" | "ingredients" | "explorer">("tiers");
  const [expandedTiers, setExpandedTiers] = useState<Record<number, boolean>>({});
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [shoppingNotification, setShoppingNotification] = useState<string | null>(null);

  // ── Explorador de Recetas ─────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // Al cambiar de oficio, recargar o inicializar valores
  const handleSelectJob = (jobId: number) => {
    setSelectedJobId(jobId);
    const newLvl = jobLevels[jobId] || 1;
    setStartingLevel(newLvl);
    const nextMilestone = getNextMilestoneLevel(newLvl);
    setTargetLevel(nextMilestone);

    // Si ya existe un plan guardado para este oficio, cargarlo
    const saved = getStoredJobPlan();
    if (saved && saved.jobId === jobId) {
      setPlan(saved);
      setStartingLevel(saved.startingLevel);
      setTargetLevel(saved.targetLevel);
      setXpMultiplier(saved.xpMultiplier);
      setMode(saved.mode);
      setMaxDailyAbsorptionRatio(saved.maxDailyAbsorptionRatio);
      setSkipItemsWithNoSales(saved.skipItemsWithNoSales);
    } else {
      // Generar nuevo plan inicial automático para el siguiente hito
      const newPlan = generateOptimizedJobPlan({
        jobId,
        startingLevel: newLvl,
        targetLevel: nextMilestone,
        xpMultiplier,
        mode,
        maxDailyAbsorptionRatio,
        skipItemsWithNoSales,
      });
      setPlan(newPlan);
    }
  };

  // Generar o recalcular plan completo
  const handleCalculatePlan = useCallback(() => {
    const newPlan = generateOptimizedJobPlan({
      jobId: selectedJobId,
      startingLevel,
      targetLevel,
      xpMultiplier,
      mode,
      maxDailyAbsorptionRatio,
      skipItemsWithNoSales,
    });
    setPlan(newPlan);

    // Expandir el primer tramo por defecto
    if (newPlan.tiers.length > 0) {
      setExpandedTiers({ [newPlan.tiers[0].tier.tierIndex]: true });
    }
  }, [
    selectedJobId,
    startingLevel,
    targetLevel,
    xpMultiplier,
    mode,
    maxDailyAbsorptionRatio,
    skipItemsWithNoSales,
  ]);

  // Si no hay plan al montar, generar uno
  useEffect(() => {
    if (!plan) {
      handleCalculatePlan();
    }
  }, [handleCalculatePlan, plan]);

  // Apilar el siguiente tramo decadal (+ Añadir siguiente tramo)
  const handleAppendNextTier = () => {
    if (!plan) return;
    const updated = appendNextTierToPlan(plan);
    setPlan(updated);
    setTargetLevel(updated.targetLevel);
    // Expandir el nuevo tramo agregado
    const lastTier = updated.tiers[updated.tiers.length - 1];
    if (lastTier) {
      setExpandedTiers((prev) => ({ ...prev, [lastTier.tier.tierIndex]: true }));
    }
  };

  // Acciones rápidas de nivel objetivo
  const handleQuickTarget = (type: "milestone" | "plus10" | "lvl100" | "lvl200") => {
    let newTarget = targetLevel;
    if (type === "milestone") {
      newTarget = getNextMilestoneLevel(targetLevel);
    } else if (type === "plus10") {
      newTarget = Math.min(200, targetLevel + 10);
    } else if (type === "lvl100") {
      newTarget = 100;
    } else if (type === "lvl200") {
      newTarget = 200;
    }

    setTargetLevel(newTarget);
    const newPlan = generateOptimizedJobPlan({
      jobId: selectedJobId,
      startingLevel,
      targetLevel: newTarget,
      xpMultiplier,
      mode,
      maxDailyAbsorptionRatio,
      skipItemsWithNoSales,
    });
    setPlan(newPlan);
  };

  // Modificar cantidad de un objeto dentro de un tramo
  const handleItemQuantityChange = (
    tierIndex: number,
    itemId: number,
    delta: number,
    absoluteVal?: number
  ) => {
    if (!plan) return;

    const newTiers = plan.tiers.map((t) => {
      if (t.tier.tierIndex !== tierIndex) return t;

      const updatedItems = t.items
        .map((item) => {
          if (item.itemId !== itemId) return item;
          const newAmount = absoluteVal !== undefined ? absoluteVal : Math.max(0, item.amount + delta);
          if (newAmount === 0) return null;

          const totalXp = newAmount * item.xpPerCraft;
          const totalCost = newAmount * item.craftCostUnit;
          const totalNetSale = newAmount * item.netSaleUnit;
          const totalProfit = newAmount * item.profitUnit;

          return {
            ...item,
            amount: newAmount,
            totalXpGained: totalXp,
            totalCraftCost: totalCost,
            totalNetSale: totalNetSale,
            totalProfit: totalProfit,
          };
        })
        .filter((i): i is CraftPlanItem => i !== null);

      const totalCost = updatedItems.reduce((sum, i) => sum + i.totalCraftCost, 0);
      const totalNetRevenue = updatedItems.reduce((sum, i) => sum + i.totalNetSale, 0);
      const netProfitOrLoss = totalNetRevenue - totalCost;
      const totalCrafts = updatedItems.reduce((sum, i) => sum + i.amount, 0);
      const xpGained = updatedItems.reduce((sum, i) => sum + i.totalXpGained, 0);
      const kamasPerXp = xpGained > 0 ? (totalCost - totalNetRevenue) / xpGained : 0;

      return {
        ...t,
        items: updatedItems,
        totalCost,
        totalNetRevenue,
        netProfitOrLoss,
        totalCrafts,
        xpGained,
        kamasPerXp,
        isComplete: xpGained >= t.tier.requiredXp,
      };
    });

    const consolidatedIngredients = consolidateIngredients(newTiers);
    const summary = calculatePlanSummary(newTiers);
    const totalXpGained = newTiers.reduce((sum, t) => sum + t.xpGained, 0);

    const updatedPlan: JobLevelingPlan = {
      ...plan,
      tiers: newTiers,
      consolidatedIngredients,
      summary,
      totalXpGained,
      lastUpdated: Date.now(),
    };

    setPlan(updatedPlan);
    saveStoredJobPlan(updatedPlan);
  };

  // Añadir todas las materias primas a la Lista de Compras
  const handleExportToShoppingList = () => {
    if (!plan || plan.consolidatedIngredients.length === 0) return;

    let addedCount = 0;
    for (const ing of plan.consolidatedIngredients) {
      if (ing.quantity > 0) {
        addToShoppingListById(ing.itemId, ing.quantity);
        addedCount++;
      }
    }

    setShoppingNotification(`¡Se agregaron ${addedCount} ingredientes a la Lista de Compras!`);
    setTimeout(() => setShoppingNotification(null), 4000);
  };

  // Copiar resumen de texto al portapapeles
  const handleCopySummary = () => {
    if (!plan) return;

    let text = `📦 PLAN DE SUBIDA DE OFICIO: ${plan.jobNameEs.toUpperCase()} (${plan.startingLevel} -> ${plan.targetLevel})\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• Inversión Total : ${plan.summary.totalInvestment.toLocaleString()} k\n`;
    text += `• Retorno HDV     : ${plan.summary.totalNetRevenue.toLocaleString()} k\n`;
    text += `• Balance Neto    : ${plan.summary.netProfitOrLoss >= 0 ? "+" : ""}${plan.summary.netProfitOrLoss.toLocaleString()} k\n`;
    text += `• Total Crafteos  : ${plan.summary.totalCrafts} objetos\n`;
    text += `• Eficiencia      : ${plan.summary.globalKamasPerXp.toFixed(2)} k/xp\n\n`;

    plan.tiers.forEach((t) => {
      text += `[Fase ${t.tier.tierIndex}: Niveles ${t.tier.fromLevel} -> ${t.tier.toLevel}] (${t.xpGained.toLocaleString()} / ${t.tier.requiredXp.toLocaleString()} XP)\n`;
      t.items.forEach((item) => {
        text += `  - ${item.amount}x ${item.name} (Lvl ${item.level}) | Ganancia/Pérdida: ${item.totalProfit >= 0 ? "+" : ""}${item.totalProfit.toLocaleString()} k\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  // Toggle de colapso de tramo
  const toggleTierAccordion = (tierIndex: number) => {
    setExpandedTiers((prev) => ({ ...prev, [tierIndex]: !prev[tierIndex] }));
  };

  // ── Recetas para el Catálogo Explorador ────────────────────
  const allJobRecipes = useMemo(() => {
    const snapshot = getCraftableItemsSnapshot();
    const pricesMap = getStoredMarketPrices();
    const salesMap = getStoredSalesVolumeMap();

    return snapshot
      .filter((item) => item.jobId === selectedJobId && item.recipeData?.ingredientIds?.length)
      .map((item) => {
        const itemLevel = item.level || 1;
        const craftCost = calculateItemCraftCost(item.id);
        const marketPrice = pricesMap[item.id] || getStoredItemPrice(item.id) || 0;
        const netSale = Math.floor(marketPrice * 0.98);
        const profit = netSale - craftCost;
        const netCost = craftCost - netSale;
        const xpAtCurrent = getCraftXpByJobLevel(itemLevel, startingLevel, xpMultiplier);
        const kamasPerXp = xpAtCurrent > 0 ? netCost / xpAtCurrent : 0;

        const volumeData = salesMap[item.id] as ItemSalesVolume | undefined;
        const salesAnalysis = analyzeSalesVolume(marketPrice, volumeData);

        return {
          item,
          recipe: item.recipeData!,
          level: itemLevel,
          craftCost,
          marketPrice,
          netSale,
          profit,
          netCost,
          xpAtCurrent,
          kamasPerXp,
          avgDailySales: salesAnalysis.avgDailySales || 0,
          turnoverRating: salesAnalysis.turnoverRating,
          name: typeof item.name === "object" ? item.name.es : String(item.name || `Objeto #${item.id}`),
        };
      })
      .sort((a, b) => a.level - b.level);
  }, [selectedJobId, startingLevel, xpMultiplier]);

  const filteredExplorerRecipes = useMemo(() => {
    if (!searchQuery.trim()) return allJobRecipes;
    const q = searchQuery.toLowerCase().trim();
    return allJobRecipes.filter(
      (r) => r.name.toLowerCase().includes(q) || String(r.level).includes(q)
    );
  }, [allJobRecipes, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Encabezado & Título ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Hammer className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Optimizador de Subida de Oficios
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                  100% Client-Side
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Calcula la ruta más barata o rentable por XP (1 a 200) diversificando por rotación de ventas.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones de exportación y resúmenes */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
            title="Copiar resumen del plan"
          >
            {copiedNotification ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copiar Plan</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportToShoppingList}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold shadow-lg shadow-amber-500/20 transition"
            title="Exportar todos los ingredientes a la Lista de Compras"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Añadir a Compras</span>
          </button>
        </div>
      </div>

      {/* Alerta de notificación al añadir a compras */}
      {shoppingNotification && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{shoppingNotification}</span>
          </div>
          {onNavigateToShopping && (
            <button
              onClick={onNavigateToShopping}
              className="text-xs font-semibold underline hover:text-emerald-200 transition"
            >
              Ir a Compras &rarr;
            </button>
          )}
        </div>
      )}

      {/* ── Selector de Oficios (14 oficios) ──────────────────── */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Selecciona un Oficio (Recolección &amp; Crafteo):
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {SUPPORTED_JOBS.map((job) => {
            const isSelected = job.id === selectedJobId;
            const IconComponent = ICON_MAP[job.icon] || Hammer;
            const userLvl = jobLevels[job.id] || 1;

            return (
              <button
                key={job.id}
                onClick={() => handleSelectJob(job.id)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10"
                    : "bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    isSelected
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{job.nameEs}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Lvl {userLvl}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Barra de Configuración y Stacking ─────────────────── */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Nivel Inicial */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Nivel Actual ({selectedJob.nameEs})
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={199}
                value={startingLevel}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(199, Number(e.target.value) || 1));
                  setStartingLevel(val);
                  if (val >= targetLevel) setTargetLevel(getNextMilestoneLevel(val));
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                onClick={() => setStartingLevel(userSavedLevel)}
                title="Cargar nivel guardado de mi perfil"
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Nivel Objetivo */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Nivel Objetivo (hasta 200)
            </label>
            <input
              type="number"
              min={startingLevel + 1}
              max={200}
              value={targetLevel}
              onChange={(e) => {
                const val = Math.max(startingLevel + 1, Math.min(200, Number(e.target.value) || 2));
                setTargetLevel(val);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Multiplicador de XP */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Multiplicador de XP
            </label>
            <select
              value={xpMultiplier}
              onChange={(e) => setXpMultiplier(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value={1.0}>1.0x (Normal)</option>
              <option value={1.25}>1.25x (+25%)</option>
              <option value={1.5}>1.5x (+50% Bonus Pack)</option>
              <option value={2.0}>2.0x (+100% Almanax)</option>
              <option value={3.0}>3.0x (Servidor Temporis / 3x)</option>
            </select>
          </div>

          {/* Modo de Optimización */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Estrategia de Ruta
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as JobOptimizerMode)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="cheapest">💰 Menor Pérdida / Más Barato</option>
              <option value="high_turnover">🌊 Alta Rotación (Venta Rápida)</option>
              <option value="fastest">⚡ Más Rápido (Menos Crafteos)</option>
            </select>
          </div>

          {/* Límite de Rotación Diaria */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Límite de Ventas Diarias
            </label>
            <select
              value={maxDailyAbsorptionRatio}
              onChange={(e) => setMaxDailyAbsorptionRatio(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value={1.0}>1x ventas diarias (Conservador)</option>
              <option value={2.0}>2x ventas diarias (Moderado)</option>
              <option value={3.0}>3x ventas diarias (Recomendado)</option>
              <option value={4.0}>4x ventas diarias (Flexible)</option>
              <option value={999}>Sin límites (Ignorar demanda)</option>
            </select>
          </div>
        </div>

        {/* Acciones Rápidas de Stacking */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Stacking rápido:</span>
            <button
              onClick={() => handleQuickTarget("milestone")}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              &rarr; Siguiente Hito ({getNextMilestoneLevel(targetLevel)})
            </button>
            <button
              onClick={() => handleQuickTarget("plus10")}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              +10 Niveles
            </button>
            <button
              onClick={() => handleQuickTarget("lvl100")}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              Hasta Nivel 100
            </button>
            <button
              onClick={() => handleQuickTarget("lvl200")}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              Hasta Nivel 200
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={skipItemsWithNoSales}
                onChange={(e) => setSkipItemsWithNoSales(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Omitir objetos sin ventas registradas</span>
            </label>

            <button
              onClick={handleCalculatePlan}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Calcular Ruta</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Banner de Resumen Global (KPIs) ──────────────────── */}
      {plan && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Progreso de Nivel */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>Progresión</span>
              <span className="text-amber-400 font-bold">
                {plan.startingLevel} &rarr; {plan.targetLevel}
              </span>
            </div>
            <div className="text-base font-bold text-white font-mono">
              +{plan.totalXpRequired.toLocaleString()} XP
            </div>
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    plan.totalXpRequired > 0
                      ? Math.round((plan.totalXpGained / plan.totalXpRequired) * 100)
                      : 100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Inversión Requerida */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-medium text-slate-400 mb-1">Inversión Ingredientes</div>
            <div className="text-base font-bold text-slate-200 font-mono">
              {plan.summary.totalInvestment.toLocaleString()}{" "}
              <span className="text-xs text-amber-400 font-normal">k</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Coste total de compra</div>
          </div>

          {/* Retorno Estimado HDV */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-medium text-slate-400 mb-1">Retorno Venta HDV</div>
            <div className="text-base font-bold text-slate-200 font-mono">
              {plan.summary.totalNetRevenue.toLocaleString()}{" "}
              <span className="text-xs text-amber-400 font-normal">k</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Neto (-2% tasa de venta)</div>
          </div>

          {/* Balance Neto */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-medium text-slate-400 mb-1">Balance Neto</div>
            <div
              className={`text-base font-bold font-mono ${
                plan.summary.netProfitOrLoss >= 0 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {plan.summary.netProfitOrLoss >= 0 ? "+" : ""}
              {plan.summary.netProfitOrLoss.toLocaleString()}{" "}
              <span className="text-xs font-normal">k</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {plan.summary.globalKamasPerXp.toFixed(2)} k por XP
            </div>
          </div>

          {/* Total de Crafteos */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-medium text-slate-400 mb-1">Total de Crafteos</div>
            <div className="text-base font-bold text-white font-mono">
              {plan.summary.totalCrafts}{" "}
              <span className="text-xs text-slate-400 font-normal">recetas</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              En {plan.tiers.length} tramos apilados
            </div>
          </div>

          {/* Tiempo Estimado de Venta */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="text-[11px] font-medium text-slate-400 mb-1">Venta Estimada</div>
            <div className="text-base font-bold text-slate-300 font-mono">
              ~{plan.summary.estimatedDaysToSell}{" "}
              <span className="text-xs text-slate-400 font-normal">días</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Según volumen diario</div>
          </div>
        </div>
      )}

      {/* ── Pestañas Principales ─────────────────────────────── */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("tiers")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "tiers"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Plan por Tramos Apilados ({plan?.tiers.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("ingredients")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "ingredients"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Lista Consolidada ({plan?.consolidatedIngredients.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("explorer")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "explorer"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Catálogo de Recetas ({allJobRecipes.length})</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* PESTAÑA 1: PLAN POR TRAMOS APILADOS                    */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "tiers" && plan && (
        <div className="space-y-4">
          {plan.tiers.map((t) => {
            const isExpanded = expandedTiers[t.tier.tierIndex] !== false;

            return (
              <div
                key={t.tier.tierIndex}
                className="border border-slate-800 bg-slate-900/60 rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                {/* Cabecera del Tramo (Acordeón) */}
                <div
                  onClick={() => toggleTierAccordion(t.tier.tierIndex)}
                  className="p-4 bg-slate-900 hover:bg-slate-850 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-mono">
                      #{t.tier.tierIndex}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2 text-base">
                        Fase {t.tier.tierIndex}: Niveles {t.tier.fromLevel} &rarr; {t.tier.toLevel}
                        {t.isComplete ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            XP Completa
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Falta XP ({Math.max(0, t.tier.requiredXp - t.xpGained).toLocaleString()})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {t.xpGained.toLocaleString()} / {t.tier.requiredXp.toLocaleString()} XP requerida en este tramo
                      </div>
                    </div>
                  </div>

                  {/* Resumen del tramo */}
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-slate-400">Inversión:</span>{" "}
                      <span className="text-slate-200 font-semibold">{t.totalCost.toLocaleString()} k</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">Retorno:</span>{" "}
                      <span className="text-slate-200 font-semibold">{t.totalNetRevenue.toLocaleString()} k</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">Balance:</span>{" "}
                      <span
                        className={`font-semibold ${
                          t.netProfitOrLoss >= 0 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {t.netProfitOrLoss >= 0 ? "+" : ""}
                        {t.netProfitOrLoss.toLocaleString()} k
                      </span>
                    </div>

                    <div className="text-slate-400 pl-2">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Contenido de Recetas del Tramo */}
                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {t.items.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-500">
                        No hay objetos asignados a este tramo. Usa el Catálogo de Recetas para añadir crafteos.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="pb-2 font-medium">Objeto</th>
                              <th className="pb-2 font-medium text-center">Nivel</th>
                              <th className="pb-2 font-medium text-center">Cantidad</th>
                              <th className="pb-2 font-medium text-right">XP / Craft</th>
                              <th className="pb-2 font-medium text-right">Total XP</th>
                              <th className="pb-2 font-medium text-right">Coste Crafteo</th>
                              <th className="pb-2 font-medium text-right">Venta Neta</th>
                              <th className="pb-2 font-medium text-right">Balance Total</th>
                              <th className="pb-2 font-medium text-right">k / XP</th>
                              <th className="pb-2 font-medium text-center">Rotación</th>
                              <th className="pb-2 font-medium text-center">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {t.items.map((item) => (
                              <tr key={item.itemId} className="hover:bg-slate-850/50 transition">
                                {/* Objeto */}
                                <td className="py-2.5 font-sans">
                                  <div className="flex items-center gap-2.5">
                                    <img
                                      src={getItemIconUrl({ id: item.itemId, iconId: item.iconId })}
                                      alt={item.name}
                                      className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 object-contain p-0.5 shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: item.itemId, iconId: item.iconId });
                                      }}
                                    />
                                    <div>
                                      <div className="font-semibold text-slate-200">{item.name}</div>
                                      <div className="text-[10px] text-slate-500 font-mono">
                                        ID #{item.itemId}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Nivel */}
                                <td className="py-2.5 text-center text-slate-300">{item.level}</td>

                                {/* Cantidad con botones de ajuste */}
                                <td className="py-2.5 text-center font-sans">
                                  <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
                                    <button
                                      onClick={() => handleItemQuantityChange(t.tier.tierIndex, item.itemId, -1)}
                                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.amount}
                                      onChange={(e) => {
                                        const val = Math.max(1, Number(e.target.value) || 1);
                                        handleItemQuantityChange(t.tier.tierIndex, item.itemId, 0, val);
                                      }}
                                      className="w-12 text-center bg-transparent text-xs font-bold text-white focus:outline-none font-mono"
                                    />
                                    <button
                                      onClick={() => handleItemQuantityChange(t.tier.tierIndex, item.itemId, 1)}
                                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>

                                {/* XP por Craft */}
                                <td className="py-2.5 text-right text-slate-300">
                                  +{item.xpPerCraft.toLocaleString()}
                                </td>

                                {/* Total XP */}
                                <td className="py-2.5 text-right text-amber-400 font-semibold">
                                  +{item.totalXpGained.toLocaleString()}
                                </td>

                                {/* Coste Crafteo */}
                                <td className="py-2.5 text-right text-slate-300">
                                  {item.totalCraftCost.toLocaleString()} k
                                </td>

                                {/* Venta Neta */}
                                <td className="py-2.5 text-right text-slate-300">
                                  {item.totalNetSale.toLocaleString()} k
                                </td>

                                {/* Balance Neto */}
                                <td
                                  className={`py-2.5 text-right font-semibold ${
                                    item.totalProfit >= 0 ? "text-emerald-400" : "text-amber-400"
                                  }`}
                                >
                                  {item.totalProfit >= 0 ? "+" : ""}
                                  {item.totalProfit.toLocaleString()} k
                                </td>

                                {/* Kamas por XP */}
                                <td className="py-2.5 text-right text-slate-400">
                                  {item.kamasPerXp.toFixed(2)}
                                </td>

                                {/* Rotación */}
                                <td className="py-2.5 text-center font-sans">
                                  {item.avgDailySales > 0 ? (
                                    <div className="inline-flex items-center gap-1 text-[11px]">
                                      <span className="font-mono text-slate-300">
                                        {item.avgDailySales.toFixed(1)}/d
                                      </span>
                                      {item.turnoverRating === "alta" && (
                                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="Alta rotación" />
                                      )}
                                      {item.turnoverRating === "media" && (
                                        <span className="w-2 h-2 rounded-full bg-amber-400" title="Media rotación" />
                                      )}
                                      {item.turnoverRating === "baja" && (
                                        <span className="w-2 h-2 rounded-full bg-slate-500" title="Baja rotación" />
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-600 text-[10px]">Sin ventas</span>
                                  )}
                                </td>

                                {/* Borrar */}
                                <td className="py-2.5 text-center">
                                  <button
                                    onClick={() => handleItemQuantityChange(t.tier.tierIndex, item.itemId, 0, 0)}
                                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                                    title="Quitar este crafteo del tramo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Botón para Apilar el Siguiente Tramo */}
          {plan.targetLevel < 200 && (
            <div className="pt-2 text-center">
              <button
                onClick={handleAppendNextTier}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-semibold text-sm border border-slate-700 shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>
                  Apilar Siguiente Tramo ({plan.targetLevel} &rarr; {getNextMilestoneLevel(plan.targetLevel)})
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* PESTAÑA 2: LISTA DE INGREDIENTES CONSOLIDADA           */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "ingredients" && plan && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <div>
              <h3 className="text-base font-bold text-white">
                Materiales Totales de Todos los Tramos Activos
              </h3>
              <p className="text-xs text-slate-400">
                Lista consolidada para comprar en mercadillo o retirar de tu banco.
              </p>
            </div>
            <button
              onClick={handleExportToShoppingList}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Enviar Todos a Lista de Compras</span>
            </button>
          </div>

          <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 font-medium">Ingrediente</th>
                  <th className="pb-2 font-medium text-right">Cantidad Necesaria</th>
                  <th className="pb-2 font-medium text-right">Precio Unitario</th>
                  <th className="pb-2 font-medium text-right">Coste Total Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {plan.consolidatedIngredients.map((ing) => (
                  <tr key={ing.itemId} className="hover:bg-slate-850/50 transition">
                    <td className="py-2.5 font-sans">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getItemIconUrl({ id: ing.itemId, iconId: ing.iconId })}
                          alt={ing.name}
                          className="w-7 h-7 rounded-md bg-slate-950 border border-slate-800 object-contain p-0.5 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: ing.itemId, iconId: ing.iconId });
                          }}
                        />
                        <div>
                          <div className="font-semibold text-slate-200">{ing.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">#{ing.itemId}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 text-right font-bold text-amber-400">
                      {ing.quantity.toLocaleString()} u
                    </td>

                    <td className="py-2.5 text-right text-slate-300">
                      {ing.unitPrice.toLocaleString()} k
                    </td>

                    <td className="py-2.5 text-right font-semibold text-slate-200">
                      {ing.totalCost.toLocaleString()} k
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* PESTAÑA 3: CATÁLOGO EXPLORADOR DE RECETAS              */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "explorer" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <div>
              <h3 className="text-base font-bold text-white">
                Recetas de {selectedJob.nameEs} (Calculadas dinámicamente para tu nivel)
              </h3>
              <p className="text-xs text-slate-400">
                Observa el decaimiento de XP y rentabilidad de cada receta según tu nivel actual ({startingLevel}).
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre o nivel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 font-medium">Objeto</th>
                  <th className="pb-2 font-medium text-center">Nivel Receta</th>
                  <th className="pb-2 font-medium text-right">XP Actual ({startingLevel})</th>
                  <th className="pb-2 font-medium text-right">Coste Crafteo</th>
                  <th className="pb-2 font-medium text-right">Venta Neta HDV</th>
                  <th className="pb-2 font-medium text-right">Balance Unitario</th>
                  <th className="pb-2 font-medium text-right">k / XP</th>
                  <th className="pb-2 font-medium text-center">Rotación Diaria</th>
                  <th className="pb-2 font-medium text-center">Añadir al Tramo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredExplorerRecipes.map((r) => {
                  const isAvailable = startingLevel >= r.level && startingLevel <= r.level + 100;

                  return (
                    <tr
                      key={r.item.id}
                      className={`hover:bg-slate-850/50 transition ${
                        !isAvailable ? "opacity-40" : ""
                      }`}
                    >
                      {/* Objeto */}
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

                      {/* Nivel */}
                      <td className="py-2.5 text-center text-slate-300">{r.level}</td>

                      {/* XP en nivel actual */}
                      <td className="py-2.5 text-right font-bold text-amber-400">
                        {r.xpAtCurrent > 0 ? `+${r.xpAtCurrent.toLocaleString()}` : "0 XP"}
                      </td>

                      {/* Coste */}
                      <td className="py-2.5 text-right text-slate-300">
                        {r.craftCost.toLocaleString()} k
                      </td>

                      {/* Venta Neta */}
                      <td className="py-2.5 text-right text-slate-300">
                        {r.netSale.toLocaleString()} k
                      </td>

                      {/* Balance Unitario */}
                      <td
                        className={`py-2.5 text-right font-semibold ${
                          r.profit >= 0 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {r.profit >= 0 ? "+" : ""}
                        {r.profit.toLocaleString()} k
                      </td>

                      {/* k / XP */}
                      <td className="py-2.5 text-right text-slate-400">
                        {r.xpAtCurrent > 0 ? r.kamasPerXp.toFixed(2) : "-"}
                      </td>

                      {/* Rotación */}
                      <td className="py-2.5 text-center font-sans">
                        {r.avgDailySales > 0 ? (
                          <div className="inline-flex items-center gap-1 text-[11px]">
                            <span className="font-mono text-slate-300">{r.avgDailySales.toFixed(1)}/d</span>
                            {r.turnoverRating === "alta" && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Alta rotación" />
                            )}
                            {r.turnoverRating === "media" && (
                              <span className="w-2 h-2 rounded-full bg-amber-400" title="Media rotación" />
                            )}
                            {r.turnoverRating === "baja" && (
                              <span className="w-2 h-2 rounded-full bg-slate-500" title="Baja rotación" />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px]">Sin ventas</span>
                        )}
                      </td>

                      {/* Botones de Acción */}
                      <td className="py-2.5 text-center font-sans">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              if (!plan || plan.tiers.length === 0) return;
                              const targetTier = plan.tiers[0];
                              handleItemQuantityChange(targetTier.tier.tierIndex, r.item.id, 1);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                            title="Añadir 1 crafteo a la Fase 1"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => {
                              if (!plan || plan.tiers.length === 0) return;
                              const targetTier = plan.tiers[0];
                              handleItemQuantityChange(targetTier.tier.tierIndex, r.item.id, 10);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                            title="Añadir 10 crafteos a la Fase 1"
                          >
                            +10
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

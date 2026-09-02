import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Vault,
  Package,
  Sparkles,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DofusItem,
  ReverseCraftAnalysis,
} from "../types";
import {
  calculateReverseCraftsFromBank,
  getStoredItemPrice,
  getItemName,
  addToShoppingListById,
} from "../services/dofusDbService";
import { useMarketPrices } from "../hooks/useMarketPrices";
import { useBankInventory } from "../hooks/useBankInventory";
import { BankCatalogFilters } from "./bank/BankCatalogFilters";
import { BankItemDrawer } from "./bank/BankItemDrawer";
import { ReverseCraftCard } from "./bank/ReverseCraftCard";

interface BankCraftingViewProps {
  onSelectRecipeForCalculator: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onNavigateToShopping?: () => void;
}

export const BankCraftingView: React.FC<BankCraftingViewProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onNavigateToShopping,
}) => {
  const { marketPrices } = useMarketPrices();
  const {
    bankInventory: bankItems,
    updateBankItem,
    removeBankItem: deleteBankItem,
    saveInventory,
    clearInventory,
  } = useBankInventory();

  const [activeSubTab, setActiveSubTab] = useState<"crafts" | "inventory">("crafts");

  // Reverse Craft Filters
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");
  const [onlyFullyCraftable, setOnlyFullyCraftable] = useState(false);
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(200);
  const [craftSearchQuery, setCraftSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "profit_roi" | "smart_score" | "roi_profit" | "fully_craftable" | "coverage" | "missingCost" | "level"
  >("profit_roi");
  const [expandedCrafts, setExpandedCrafts] = useState<Record<number, boolean>>({});

  // Calculation State
  const [rawCraftResults, setRawCraftResults] = useState<ReverseCraftAnalysis[]>([]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<number | null>(null);

  // Pagination State for Craft Opportunities
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);

  // Notifications / Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Bank Stats Summary
  const bankStats = useMemo(() => {
    let totalUnits = 0;
    let totalKamasValue = 0;

    bankItems.forEach((b) => {
      totalUnits += b.quantity;
      const unitPrice = marketPrices[b.itemId] || getStoredItemPrice(b.itemId) || 0;
      totalKamasValue += b.quantity * unitPrice;
    });

    return {
      uniqueResources: bankItems.length,
      totalUnits,
      totalKamasValue,
    };
  }, [bankItems, marketPrices]);

  const handleAddToBank = (item: DofusItem, qty: number) => {
    updateBankItem(item.id, qty);
    showToast(`Se agregaron ${qty}x ${getItemName(item)} al banco`);
  };

  const handleUpdateQuantity = (itemId: number, newQty: number) => {
    updateBankItem(itemId, newQty);
  };

  const handleRemoveItem = (itemId: number, name: string) => {
    deleteBankItem(itemId);
    showToast(`Se eliminó ${name} del banco`, "info");
  };

  const handleClearBank = () => {
    if (window.confirm("¿Seguro que deseas vaciar todos los recursos de tu banco?")) {
      clearInventory();
      setRawCraftResults([]);
      setHasCalculated(false);
      showToast("Banco vaciado correctamente", "info");
    }
  };

  const handleExportBank = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bankItems, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dofus_banco_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBank = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (Array.isArray(parsed)) {
          saveInventory(parsed);
          showToast(`¡Se importaron ${parsed.length} recursos al banco!`);
        }
      } catch (err) {
        alert("El archivo JSON no tiene un formato válido");
      }
    };
    reader.readAsText(file);
  };

  const handleCalculateCrafts = async () => {
    if (bankItems.length === 0) {
      alert("Agrega recursos a tu banco primero para poder calcular recetas.");
      return;
    }

    setIsCalculating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const results = calculateReverseCraftsFromBank(bankItems, marketPrices);
      setRawCraftResults(results);
      setHasCalculated(true);
      setLastCalculatedAt(Date.now());
      setCurrentPage(1);
    } catch (error) {
      console.error("Error calculando crafteos:", error);
      alert("Hubo un error al calcular las recetas.");
    } finally {
      setIsCalculating(false);
    }
  };

  const toggleExpand = (itemId: number) => {
    setExpandedCrafts((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleAddMissingToShoppingList = (craft: ReverseCraftAnalysis) => {
    let addedCount = 0;
    craft.ingredientsStatus.forEach((ing) => {
      if (!ing.isFullyAvailable && ing.missing > 0) {
        addToShoppingListById(ing.itemId, ing.missing);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      showToast(`¡Añadidos ${addedCount} ingredientes faltantes a la Lista de Compras!`);
      if (onNavigateToShopping) {
        setTimeout(() => onNavigateToShopping(), 400);
      }
    }
  };

  // Filter and Sort Opportunities
  const filteredAndSortedOpportunities = useMemo(() => {
    return rawCraftResults
      .filter((craft) => {
        if (selectedJobId !== "all" && craft.jobId !== selectedJobId) return false;
        if (onlyFullyCraftable && !craft.isFullyCraftable) return false;
        if (craft.item.level < minLevel || craft.item.level > maxLevel) return false;

        if (craftSearchQuery.trim()) {
          const q = craftSearchQuery.toLowerCase();
          const name = getItemName(craft.item).toLowerCase();
          const job = (craft.jobNameEs || "").toLowerCase();
          if (!name.includes(q) && !job.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "profit_roi") {
          if (b.netProfit !== a.netProfit) return b.netProfit - a.netProfit;
          return b.roi - a.roi;
        }
        if (sortBy === "smart_score") {
          const scoreA = a.missingMaterialsCost > 0 ? a.netProfit / a.missingMaterialsCost : a.netProfit * 2;
          const scoreB = b.missingMaterialsCost > 0 ? b.netProfit / b.missingMaterialsCost : b.netProfit * 2;
          return scoreB - scoreA;
        }
        if (sortBy === "roi_profit") {
          if (b.roi !== a.roi) return b.roi - a.roi;
          return b.netProfit - a.netProfit;
        }
        if (sortBy === "fully_craftable") {
          if (a.isFullyCraftable !== b.isFullyCraftable) return a.isFullyCraftable ? -1 : 1;
          return b.netProfit - a.netProfit;
        }
        if (sortBy === "coverage") {
          return b.materialsCoveragePercent - a.materialsCoveragePercent;
        }
        if (sortBy === "missingCost") {
          return a.missingMaterialsCost - b.missingMaterialsCost;
        }
        if (sortBy === "level") {
          return b.item.level - a.item.level;
        }
        return 0;
      });
  }, [
    rawCraftResults,
    selectedJobId,
    onlyFullyCraftable,
    minLevel,
    maxLevel,
    craftSearchQuery,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedOpportunities.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedOpportunities = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedOpportunities.slice(start, start + pageSize);
  }, [filteredAndSortedOpportunities, safeCurrentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Header Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <Vault className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Mi Banco & Crafteo Inverso
              </h1>
              <p className="text-xs text-slate-400">
                Calcula al instante qué recetas puedes craftear con tus recursos en banco y cuáles te generan mayor ganancia neta.
              </p>
            </div>
          </div>

          {/* Quick Bank Summary Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Recursos</span>
              <span className="text-base sm:text-lg font-bold text-slate-100">
                {bankStats.uniqueResources.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Unidades</span>
              <span className="text-base sm:text-lg font-bold text-amber-400">
                {bankStats.totalUnits.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Valor Banco</span>
              <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                {bankStats.totalKamasValue.toLocaleString()} K
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog & Filter Toolbar */}
      <BankCatalogFilters
        activeSubTab={activeSubTab}
        onSubTabChange={setActiveSubTab}
        bankItemsCount={bankItems.length}
        craftsCount={filteredAndSortedOpportunities.length}
        selectedJobId={selectedJobId}
        onSelectJobId={setSelectedJobId}
        craftSearchQuery={craftSearchQuery}
        onCraftSearchQueryChange={setCraftSearchQuery}
        onlyFullyCraftable={onlyFullyCraftable}
        onOnlyFullyCraftableChange={setOnlyFullyCraftable}
        minLevel={minLevel}
        maxLevel={maxLevel}
        onLevelRangeChange={(min, max) => {
          setMinLevel(min);
          setMaxLevel(max);
        }}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        isCalculating={isCalculating}
        hasCalculated={hasCalculated}
        lastCalculatedAt={lastCalculatedAt}
        onCalculate={handleCalculateCrafts}
      />

      {/* Sub-Tab 1: Reverse Craft Finder */}
      {activeSubTab === "crafts" && (
        <div className="space-y-4">
          {!hasCalculated ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-200">
                  Listo para analizar recetas con los recursos de tu banco
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {bankItems.length > 0
                    ? `Tienes ${bankItems.length} recursos registrados. Haz clic en "Escanear Oportunidades" para calcular las mejores opciones ordenadas por beneficio y ROI.`
                    : "Tu banco está vacío. Añade algunos recursos en la pestaña 'Inventario del Banco' para comenzar."}
                </p>
              </div>
              {bankItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleCalculateCrafts}
                  disabled={isCalculating}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xl transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  Escanear Oportunidades
                </button>
              )}
            </div>
          ) : filteredAndSortedOpportunities.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <Package className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">
                No hay recetas que coincidan con los filtros actuales
              </h3>
              <p className="text-xs text-slate-500">
                Prueba desmarcar "100% Fabricables Ahora" o cambiar de oficio/nivel.
              </p>
            </div>
          ) : (
            <>
              {/* Pagination Top Controls Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-400 shadow-sm">
                <span>
                  Mostrando <strong>{(safeCurrentPage - 1) * pageSize + 1}</strong> -{" "}
                  <strong>{Math.min(safeCurrentPage * pageSize, filteredAndSortedOpportunities.length)}</strong> de{" "}
                  <strong>{filteredAndSortedOpportunities.length}</strong> oportunidades
                </span>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>Por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={safeCurrentPage === 1}
                      className="p-1 rounded bg-slate-950 hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
                      title="Primera página"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="p-1 rounded bg-slate-950 hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-mono font-bold text-slate-200">
                      {safeCurrentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="p-1 rounded bg-slate-950 hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
                      title="Página siguiente"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safeCurrentPage === totalPages}
                      className="p-1 rounded bg-slate-950 hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
                      title="Última página"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Opportunities List */}
              <div className="grid grid-cols-1 gap-3.5">
                {paginatedOpportunities.map((craft) => (
                  <ReverseCraftCard
                    key={craft.item.id}
                    craft={craft}
                    isExpanded={Boolean(expandedCrafts[craft.item.id])}
                    onToggleExpand={() => toggleExpand(craft.item.id)}
                    onSelectRecipeForCalculator={onSelectRecipeForCalculator}
                    onSelectForCrushing={onSelectForCrushing}
                    onAddMissingToShoppingList={handleAddMissingToShoppingList}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Bank Inventory List */}
      {activeSubTab === "inventory" && (
        <BankItemDrawer
          bankItems={bankItems}
          marketPrices={marketPrices}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onAddCustomItem={handleAddToBank}
          onExportBank={handleExportBank}
          onImportBank={handleImportBank}
          onClearBank={handleClearBank}
          onSearchRecipesWithItem={(name) => {
            setCraftSearchQuery(name);
            setActiveSubTab("crafts");
          }}
        />
      )}
    </div>
  );
};

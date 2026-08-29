import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Vault,
  Search,
  Plus,
  Trash2,
  TrendingUp,
  Sparkles,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Download,
  Upload,
  ArrowUpDown,
  Zap,
  Info,
  Check,
  Percent,
  Wallet,
  Coins,
  Loader2,
  Map as MapIcon,
  FlaskConical,
  Sword,
  Pickaxe,
  Wheat,
  Drumstick,
  Fish,
  Axe,
  Shield,
  Scissors,
  Wand2,
  Gem,
  Footprints,
  Wrench,
  Heart,
} from "lucide-react";
import {
  DofusItem,
  BankInventoryItem,
  ReverseCraftAnalysis,
  MarketPriceMap,
} from "../types";
import {
  getStoredBankInventory,
  saveBankInventory,
  addOrUpdateBankItem,
  setBankItemQuantity,
  removeBankItem,
  clearBankInventory,
  calculateReverseCraftsFromBank,
  getAllStoredPrices,
  getStoredItemPrice,
  searchAllItems,
  getItemName,
  getItemIconUrl,
  addToShoppingListById,
} from "../services/dofusDbService";
import { DOFUS_JOBS } from "../data/dofusJobs";
import { SafeImage } from "./SafeImage";

interface BankCraftingViewProps {
  onSelectRecipeForCalculator: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onNavigateToShopping?: () => void;
}

const JOB_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Wrench,
  Shield,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  Heart,
  Sparkles,
  Map: MapIcon,
};

export const BankCraftingView: React.FC<BankCraftingViewProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onNavigateToShopping,
}) => {
  // State
  const [bankItems, setBankItems] = useState<BankInventoryItem[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [activeSubTab, setActiveSubTab] = useState<"crafts" | "inventory">("crafts");

  // Add Item to Bank Inputs
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DofusItem[]>([]);
  const [selectedAddItem, setSelectedAddItem] = useState<DofusItem | null>(null);
  const [addQuantity, setAddQuantity] = useState<number>(100);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

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

  // Calculation State (Manual on-demand trigger as requested by user)
  const [rawCraftResults, setRawCraftResults] = useState<ReverseCraftAnalysis[]>([]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<number | null>(null);

  // Pagination State for Craft Opportunities
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);

  // Pagination State for Bank Inventory
  const [inventoryPage, setInventoryPage] = useState<number>(1);
  const [inventoryPageSize, setInventoryPageSize] = useState<number>(24);

  // Bank Inventory Filter
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventorySort, setInventorySort] = useState<"value" | "quantity" | "name" | "recent">("value");

  // Notifications / Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Load Bank & Prices
  const loadData = () => {
    const items = getStoredBankInventory();
    setBankItems(items);
    setMarketPrices(getAllStoredPrices());
  };

  useEffect(() => {
    loadData();

    const handleBankUpdate = () => {
      const items = getStoredBankInventory();
      setBankItems(items);
    };

    const handlePricesUpdate = () => {
      setMarketPrices(getAllStoredPrices());
    };

    window.addEventListener("dofus_bank_inventory_updated", handleBankUpdate);
    window.addEventListener("dofus_database_updated", handlePricesUpdate);

    return () => {
      window.removeEventListener("dofus_bank_inventory_updated", handleBankUpdate);
      window.removeEventListener("dofus_database_updated", handlePricesUpdate);
    };
  }, []);

  // Handle Search for Adding item to bank
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      const results = searchAllItems(searchQuery, 12);
      setSearchResults(results);
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add Item to Bank Handler
  const handleAddToBank = () => {
    if (!selectedAddItem) return;
    const qty = Math.max(1, addQuantity);
    const updated = addOrUpdateBankItem(selectedAddItem.id, qty);
    setBankItems(updated);
    showToast(`Añadido: ${qty}x ${getItemName(selectedAddItem)} al banco`);
    setSelectedAddItem(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Quick Add Preset
  const handleQuickAdd = (presetQty: number) => {
    setAddQuantity((prev) => Math.max(1, prev + presetQty));
  };

  // Update Item Quantity in Bank
  const handleUpdateQuantity = (itemId: number, newQty: number) => {
    const updated = setBankItemQuantity(itemId, newQty);
    setBankItems(updated);
  };

  // Remove Item
  const handleRemoveItem = (itemId: number, itemName: string) => {
    const updated = removeBankItem(itemId);
    setBankItems(updated);
    showToast(`Eliminado ${itemName} del banco`, "info");
  };

  // Clear Bank
  const handleClearBank = () => {
    if (window.confirm("¿Seguro que deseas vaciar todos los recursos de tu banco? Esta acción es irreversible.")) {
      clearBankInventory();
      setBankItems([]);
      setRawCraftResults([]);
      setHasCalculated(false);
      showToast("Banco vaciado correctamente", "info");
    }
  };

  // Export Bank
  const handleExportBank = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bankItems, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dofus_banco_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Bank
  const handleImportBank = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            saveBankInventory(parsed);
            const items = getStoredBankInventory();
            setBankItems(items);
            showToast("¡Banco importado con éxito!");
          }
        } catch {
          alert("Error al importar el archivo JSON del banco");
        }
      };
    }
  };

  // Bank Total Valuation
  const bankStats = useMemo(() => {
    let totalItemsCount = 0;
    let totalEstimatedValue = 0;

    for (const b of bankItems) {
      totalItemsCount += b.quantity;
      const unitPrice = marketPrices[b.itemId] || getStoredItemPrice(b.itemId) || 0;
      totalEstimatedValue += b.quantity * unitPrice;
    }

    return {
      uniqueResources: bankItems.length,
      totalUnits: totalItemsCount,
      totalKamasValue: totalEstimatedValue,
    };
  }, [bankItems, marketPrices]);

  // Execute Analysis Function (explicit on-demand trigger)
  const handleCalculateCrafts = () => {
    if (bankItems.length === 0) {
      showToast("Tu banco está vacío. Agrega recursos primero.", "info");
      return;
    }

    setIsCalculating(true);

    // Run in short timeout to allow UI spinner rendering
    setTimeout(() => {
      const results = calculateReverseCraftsFromBank(bankItems, marketPrices, {
        jobId: selectedJobId,
        onlyFullyCraftable,
        minLevel,
        maxLevel,
        searchTerm: craftSearchQuery,
      });

      setRawCraftResults(results);
      setHasCalculated(true);
      setLastCalculatedAt(Date.now());
      setIsCalculating(false);
      setCurrentPage(1);

      showToast(`¡Análisis completado! Se encontraron ${results.length} equipables fabricables.`);
    }, 50);
  };

  // Filter and Sort Reverse Craft Opportunities
  const filteredAndSortedOpportunities = useMemo(() => {
    if (!hasCalculated) return [];

    let list = [...rawCraftResults];

    // Filter by Job
    if (selectedJobId !== "all") {
      list = list.filter((c) => c.jobId === selectedJobId);
    }

    // Filter by 100% craftable
    if (onlyFullyCraftable) {
      list = list.filter((c) => c.isFullyCraftable);
    }

    // Filter by level
    list = list.filter((c) => c.item.level >= minLevel && c.item.level <= maxLevel);

    // Filter by search name
    if (craftSearchQuery.trim()) {
      const q = craftSearchQuery.toLowerCase().trim();
      list = list.filter((c) => getItemName(c.item).toLowerCase().includes(q));
    }

    // Smart Sorting:
    // 1. "profit_roi" -> Mayor Ganancia Neta en Kamas primero, desempate por ROI %
    // 2. "smart_score" -> Score ponderado (Ganancia x log(10 + ROI))
    // 3. "roi_profit" -> Mayor ROI % primero, desempate por Kamas
    // 4. "fully_craftable" -> 100% crafteables arriba con mayor ganancia
    return list.sort((a, b) => {
      if (sortBy === "profit_roi") {
        if (b.netProfit !== a.netProfit) {
          return b.netProfit - a.netProfit;
        }
        return b.roi - a.roi;
      }

      if (sortBy === "smart_score") {
        const scoreA = (a.netProfit > 0 ? a.netProfit : a.netProfit * 2) * Math.log10(10 + Math.max(0, a.roi));
        const scoreB = (b.netProfit > 0 ? b.netProfit : b.netProfit * 2) * Math.log10(10 + Math.max(0, b.roi));
        return scoreB - scoreA;
      }

      if (sortBy === "roi_profit") {
        if (Math.abs(b.roi - a.roi) > 0.01) {
          return b.roi - a.roi;
        }
        return b.netProfit - a.netProfit;
      }

      if (sortBy === "fully_craftable") {
        const fullyA = a.isFullyCraftable ? 1 : 0;
        const fullyB = b.isFullyCraftable ? 1 : 0;
        if (fullyB !== fullyA) return fullyB - fullyA;
        return b.netProfit - a.netProfit;
      }

      if (sortBy === "coverage") {
        if (b.materialsCoveragePercent !== a.materialsCoveragePercent) {
          return b.materialsCoveragePercent - a.materialsCoveragePercent;
        }
        return b.netProfit - a.netProfit;
      }

      if (sortBy === "missingCost") {
        if (a.missingMaterialsCost !== b.missingMaterialsCost) {
          return a.missingMaterialsCost - b.missingMaterialsCost;
        }
        return b.netProfit - a.netProfit;
      }

      if (sortBy === "level") {
        if (b.item.level !== a.item.level) {
          return b.item.level - a.item.level;
        }
        return b.netProfit - a.netProfit;
      }

      return 0;
    });
  }, [
    rawCraftResults,
    hasCalculated,
    selectedJobId,
    onlyFullyCraftable,
    minLevel,
    maxLevel,
    craftSearchQuery,
    sortBy,
  ]);

  // Summary Metrics of current calculation
  const opportunitiesSummary = useMemo(() => {
    if (!hasCalculated || filteredAndSortedOpportunities.length === 0) {
      return {
        total: 0,
        profitableCount: 0,
        fullyCraftableCount: 0,
        maxProfitItem: null as ReverseCraftAnalysis | null,
        totalPotentialProfit: 0,
      };
    }

    let profitableCount = 0;
    let fullyCraftableCount = 0;
    let maxProfitItem = filteredAndSortedOpportunities[0] || null;
    let totalPotentialProfit = 0;

    for (const c of filteredAndSortedOpportunities) {
      if (c.netProfit > 0) {
        profitableCount++;
        totalPotentialProfit += c.netProfit;
      }
      if (c.isFullyCraftable) {
        fullyCraftableCount++;
      }
      if (!maxProfitItem || c.netProfit > maxProfitItem.netProfit) {
        maxProfitItem = c;
      }
    }

    return {
      total: filteredAndSortedOpportunities.length,
      profitableCount,
      fullyCraftableCount,
      maxProfitItem,
      totalPotentialProfit,
    };
  }, [hasCalculated, filteredAndSortedOpportunities]);

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedOpportunities.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedOpportunities = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedOpportunities.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedOpportunities, safeCurrentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(clamped);
    if (resultsContainerRef.current) {
      resultsContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Filtered & Paginated Bank Inventory List
  const filteredBankInventory = useMemo(() => {
    let list = [...bankItems];

    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase().trim();
      list = list.filter((item) => {
        const name = getItemName(item.item || { id: item.itemId }).toLowerCase();
        return name.includes(q);
      });
    }

    return list.sort((a, b) => {
      const nameA = getItemName(a.item || { id: a.itemId });
      const nameB = getItemName(b.item || { id: b.itemId });
      const priceA = marketPrices[a.itemId] || getStoredItemPrice(a.itemId) || 0;
      const priceB = marketPrices[b.itemId] || getStoredItemPrice(b.itemId) || 0;
      const valA = a.quantity * priceA;
      const valB = b.quantity * priceB;

      if (inventorySort === "value") return valB - valA;
      if (inventorySort === "quantity") return b.quantity - a.quantity;
      if (inventorySort === "name") return nameA.localeCompare(nameB);
      if (inventorySort === "recent") return (b.addedAt || 0) - (a.addedAt || 0);
      return 0;
    });
  }, [bankItems, inventorySearch, inventorySort, marketPrices]);

  const totalInventoryPages = Math.max(1, Math.ceil(filteredBankInventory.length / inventoryPageSize));
  const safeInventoryPage = Math.min(inventoryPage, totalInventoryPages);
  const paginatedInventory = useMemo(() => {
    const start = (safeInventoryPage - 1) * inventoryPageSize;
    return filteredBankInventory.slice(start, start + inventoryPageSize);
  }, [filteredBankInventory, safeInventoryPage, inventoryPageSize]);

  // Toggle Accordion for a recipe
  const toggleExpand = (itemId: number) => {
    setExpandedCrafts((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Add Missing Ingredients to Shopping List
  const handleAddMissingToShoppingList = (craft: ReverseCraftAnalysis) => {
    let addedCount = 0;
    for (const ing of craft.ingredientsStatus) {
      if (ing.missing > 0) {
        addToShoppingListById(ing.itemId, ing.missing, craft.item.id);
        addedCount++;
      }
    }
    if (addedCount > 0) {
      showToast(`¡Añadidos ${addedCount} ingredientes faltantes a tu Lista de Compras!`);
    } else {
      showToast("¡Ya tienes todos los materiales de esta receta en tu banco!", "info");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 shadow-2xl shadow-amber-950/50 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner & Valuation Cards */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Vault className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                  Mi Banco & Crafteo Inverso
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold tracking-wider">
                    Caché Ligero
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Registra solo los recursos que posees en tu banco y calcula qué equipables te generan la mayor ganancia de Kamas y ROI.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Bank Summary Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-xs text-slate-400 font-medium">Recursos en Banco</span>
              <span className="text-lg sm:text-xl font-bold text-slate-100">
                {bankStats.uniqueResources.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-xs text-slate-400 font-medium">Unidades Totales</span>
              <span className="text-lg sm:text-xl font-bold text-amber-400">
                {bankStats.totalUnits.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-xs text-slate-400 font-medium">Valor Estimado</span>
              <span className="text-lg sm:text-xl font-bold text-emerald-400 flex items-center gap-1">
                {bankStats.totalKamasValue.toLocaleString()}{" "}
                <span className="text-xs text-emerald-500/80">K</span>
              </span>
            </div>
          </div>
        </div>

        {/* Deposit / Add Item Section */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-400" />
            Depositar recurso en el banco personal
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="md:col-span-6 relative" ref={searchContainerRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar recurso por nombre o ID (ej. Trigo, Madera, Fragmento, Esquíritu)..."
                  value={selectedAddItem ? getItemName(selectedAddItem) : searchQuery}
                  onChange={(e) => {
                    setSelectedAddItem(null);
                    setSearchQuery(e.target.value);
                  }}
                  className="w-full pl-10 pr-20 py-2.5 bg-slate-950/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-all"
                />
                {selectedAddItem && (
                  <button
                    onClick={() => {
                      setSelectedAddItem(null);
                      setSearchQuery("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-2 py-0.5 rounded"
                  >
                    Cambiar
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {!selectedAddItem && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 divide-y divide-slate-800/80">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedAddItem(item);
                        setSearchResults([]);
                      }}
                      className="flex items-center gap-3 p-2.5 hover:bg-slate-800/80 cursor-pointer transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-700/60 flex items-center justify-center p-1 shrink-0">
                        <SafeImage
                          src={getItemIconUrl(item.iconId || item.id)}
                          alt={getItemName(item)}
                          className="w-7 h-7 object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {getItemName(item)}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span>Nivel {item.level}</span>
                          {item.type?.name?.es && <span>• {item.type.name.es}</span>}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-amber-400/90 font-medium">
                        {(marketPrices[item.id] || getStoredItemPrice(item.id) || 0).toLocaleString()} K
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity Input + Presets */}
            <div className="md:col-span-4 flex items-center gap-2">
              <div className="relative w-32 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="999999"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2.5 bg-slate-950/90 border border-slate-700/80 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-amber-500/80"
                  placeholder="Cantidad"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1">
                {[10, 100, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleQuickAdd(preset)}
                    className="px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="md:col-span-2">
              <button
                onClick={handleAddToBank}
                disabled={!selectedAddItem}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold text-sm shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab("crafts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeSubTab === "crafts"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            ¿Qué puedo craftear? {hasCalculated ? `(${filteredAndSortedOpportunities.length})` : ""}
          </button>
          <button
            onClick={() => setActiveSubTab("inventory")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeSubTab === "inventory"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Package className="w-4 h-4" />
            Inventario en Banco ({bankItems.length})
          </button>
        </div>

        {/* Bank Import/Export/Clear Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBank}
            disabled={bankItems.length === 0}
            title="Exportar inventario del banco a JSON"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-300 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>

          <label
            title="Importar inventario del banco desde JSON"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-300 cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar
            <input type="file" accept=".json" onChange={handleImportBank} className="hidden" />
          </label>

          <button
            onClick={handleClearBank}
            disabled={bankItems.length === 0}
            title="Vaciar banco"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-300 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Vaciar
          </button>
        </div>
      </div>

      {/* ---------------- SUB-TAB 1: REVERSE CRAFT FINDER ---------------- */}
      {activeSubTab === "crafts" && (
        <div className="space-y-5" ref={resultsContainerRef}>
          {/* Action Trigger Card (Click to calculate as requested) */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/20 border border-slate-800 p-4 sm:p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasCalculated ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hasCalculated ? "bg-emerald-500" : "bg-amber-500"}`} />
                </span>
                <h3 className="text-base font-bold text-slate-100">
                  {hasCalculated
                    ? `Análisis de Crafteos Activo (${opportunitiesSummary.total} equipables)`
                    : "Analizador de Oportunidades de Crafteo"}
                </h3>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                {hasCalculated
                  ? `Ordenado priorizando mayor ganancia neta en Kamas y mejor ROI. ${opportunitiesSummary.profitableCount} equipables rentables encontrados.`
                  : `Tienes ${bankItems.length} recursos guardados en tu banco. Haz clic en el botón para analizar todas las recetas de equipables que puedes craftear.`}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleCalculateCrafts}
                disabled={isCalculating || bankItems.length === 0}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Calculando Crafteos...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-slate-950 fill-current" />
                    <span>{hasCalculated ? "Recalcular Oportunidades" : "Calcular Crafteos Rentables"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar (Only after calculation) */}
          {hasCalculated && opportunitiesSummary.total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-center">
                <span className="text-xs text-slate-400 font-medium">Equipables Encontrados</span>
                <span className="text-lg font-bold text-slate-100">{opportunitiesSummary.total}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-center">
                <span className="text-xs text-slate-400 font-medium">Con Ganancia Neta</span>
                <span className="text-lg font-bold text-emerald-400">{opportunitiesSummary.profitableCount}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 flex flex-col justify-center">
                <span className="text-xs text-slate-400 font-medium">100% Crafteables (Sin compras)</span>
                <span className="text-lg font-bold text-amber-300">{opportunitiesSummary.fullyCraftableCount}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-500/30 flex flex-col justify-center">
                <span className="text-xs text-slate-400 font-medium">Mayor Ganancia Individual</span>
                <span className="text-lg font-bold text-purple-300 truncate">
                  {opportunitiesSummary.maxProfitItem
                    ? `+${opportunitiesSummary.maxProfitItem.netProfit.toLocaleString()} K`
                    : "0 K"}
                </span>
              </div>
            </div>
          )}

          {/* Filtering Bar */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Job Selector Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    setSelectedJobId("all");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedJobId === "all"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Todos los Oficios
                </button>

                {DOFUS_JOBS.map((job) => {
                  const IconComp = JOB_ICON_MAP[job.icon] || Wrench;
                  const isSelected = selectedJobId === job.id;
                  return (
                    <button
                      key={job.id}
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setCurrentPage(1);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-amber-500 text-slate-950 shadow"
                          : "bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span>{job.nameEs}</span>
                    </button>
                  );
                })}
              </div>

              {/* Fully Craftable Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 shrink-0 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={onlyFullyCraftable}
                  onChange={(e) => {
                    setOnlyFullyCraftable(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Solo 100% Crafteables (sin comprar)
                </span>
              </label>
            </div>

            {/* Level Range, Search & Sort */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-slate-800/80 items-center">
              {/* Search target recipe */}
              <div className="lg:col-span-4 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por objeto resultante..."
                  value={craftSearchQuery}
                  onChange={(e) => {
                    setCraftSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Level Range */}
              <div className="lg:col-span-3 flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700/80">
                <span className="text-xs font-medium text-slate-400 shrink-0">Nivel:</span>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={minLevel}
                  onChange={(e) => {
                    setMinLevel(Math.max(1, parseInt(e.target.value) || 1));
                    setCurrentPage(1);
                  }}
                  className="w-14 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono text-slate-100"
                />
                <span className="text-xs text-slate-500">-</span>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={maxLevel}
                  onChange={(e) => {
                    setMaxLevel(Math.min(200, parseInt(e.target.value) || 200));
                    setCurrentPage(1);
                  }}
                  className="w-14 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono text-slate-100"
                />
              </div>

              {/* Priority Sorting selector */}
              <div className="lg:col-span-5 flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-amber-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                >
                  <option value="profit_roi">Mayor Ganancia en Kamas (Kamas &gt; ROI)</option>
                  <option value="smart_score">Score de Rentabilidad (Equilibrio Kamas &amp; ROI)</option>
                  <option value="roi_profit">Mayor ROI % (ROI &gt; Kamas)</option>
                  <option value="fully_craftable">100% Crafteables primero (Sin comprar)</option>
                  <option value="coverage">Mayor % de Materiales en Banco</option>
                  <option value="missingCost">Menor gasto a comprar en mercadillo</option>
                  <option value="level">Mayor Nivel</option>
                </select>
              </div>
            </div>
          </div>

          {/* Not calculated banner */}
          {!hasCalculated ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-200">
                  Listo para analizar recetas con tu banco
                </h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  {bankItems.length > 0
                    ? `Tienes ${bankItems.length} recursos guardados. Haz clic en "Calcular Crafteos Rentables" para ver las mejores opciones ordenadas por ganancia de Kamas y ROI.`
                    : "Tu banco está vacío. Deposita algunos recursos arriba para descubrir qué equipables puedes craftear."}
                </p>
              </div>
              {bankItems.length > 0 && (
                <button
                  onClick={handleCalculateCrafts}
                  disabled={isCalculating}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-xl transition-all"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  Calcular Crafteos Rentables
                </button>
              )}
            </div>
          ) : filteredAndSortedOpportunities.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-300">
                No hay recetas que coincidan con los filtros actuales
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Prueba desmarcar "Solo 100% crafteables", cambiar de oficio o ampliar el rango de nivel.
              </p>
            </div>
          ) : (
            <>
              {/* Pagination Top Controls Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span>
                    Mostrando <strong>{(safeCurrentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(safeCurrentPage * pageSize, filteredAndSortedOpportunities.length)}</strong> de <strong>{filteredAndSortedOpportunities.length}</strong> oportunidades
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-1.5">
                    <span>Por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none"
                    >
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                    </select>
                  </div>

                  {/* Navigation Arrows */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={safeCurrentPage === 1}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                      title="Primera página"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePageChange(safeCurrentPage - 1)}
                      disabled={safeCurrentPage === 1}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-mono font-bold text-slate-200">
                      {safeCurrentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(safeCurrentPage + 1)}
                      disabled={safeCurrentPage === totalPages}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                      title="Página siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={safeCurrentPage === totalPages}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                      title="Última página"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Opportunities Results List */}
              <div className="grid grid-cols-1 gap-3.5">
                {paginatedOpportunities.map((craft) => {
                  const isExpanded = Boolean(expandedCrafts[craft.item.id]);
                  const isProfitable = craft.netProfit > 0;

                  return (
                    <div
                      key={craft.item.id}
                      className={`rounded-2xl border transition-all ${
                        craft.isFullyCraftable
                          ? "bg-slate-900/90 border-emerald-500/40 hover:border-emerald-500/70"
                          : isProfitable
                          ? "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                          : "bg-slate-900/50 border-slate-800/60 opacity-80"
                      } shadow-md overflow-hidden`}
                    >
                      {/* Header Row */}
                      <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        {/* Item Icon & Basic Info */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative w-14 h-14 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center p-1.5 shrink-0 shadow-inner">
                            <SafeImage
                              src={getItemIconUrl(craft.item.iconId || craft.item.id)}
                              alt={getItemName(craft.item)}
                              className="w-11 h-11 object-contain"
                            />
                            {craft.isFullyCraftable && (
                              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                className="text-base font-bold text-white hover:text-amber-400 cursor-pointer transition-colors"
                                onClick={() => onSelectRecipeForCalculator(craft.item)}
                              >
                                {getItemName(craft.item)}
                              </h3>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono font-medium">
                                Nv. {craft.item.level}
                              </span>
                              {craft.jobNameEs && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                                  {craft.jobNameEs}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Layers className="w-3.5 h-3.5 text-slate-500" />
                                Materiales en banco:{" "}
                                <strong
                                  className={
                                    craft.materialsCoveragePercent === 100
                                      ? "text-emerald-400"
                                      : "text-amber-400"
                                  }
                                >
                                  {craft.availableIngredientsCount}/{craft.totalIngredientsCount} ({craft.materialsCoveragePercent}%)
                                </strong>
                              </span>

                              {craft.maxCraftableWithBank > 0 && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                  ¡Puedes craftear {craft.maxCraftableWithBank}x sin comprar nada!
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Economics & Profit Metrics */}
                        <div className="flex items-center gap-4 sm:gap-6 flex-wrap lg:flex-nowrap justify-between w-full lg:w-auto">
                          {/* Cost breakdown */}
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Coste Compra Mercadillo</div>
                            <div
                              className={`text-sm font-mono font-bold ${
                                craft.missingMaterialsCost === 0 ? "text-emerald-400" : "text-slate-200"
                              }`}
                            >
                              {craft.missingMaterialsCost === 0
                                ? "0 K (Todo en banco)"
                                : `${craft.missingMaterialsCost.toLocaleString()} K`}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Ahorro banco: {craft.bankMaterialsValue.toLocaleString()} K
                            </div>
                          </div>

                          {/* Market Sale Price */}
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Venta Estimada Mercadillo</div>
                            <div className="text-sm font-mono font-bold text-amber-300">
                              {craft.marketSalePrice.toLocaleString()} K
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Coste Total: {craft.totalCraftCost.toLocaleString()} K
                            </div>
                          </div>

                          {/* Net Profit & ROI Pill (Highlighting Kamas + ROI) */}
                          <div className="text-right min-w-[130px] bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                            <div className="text-xs text-slate-400">Ganancia Neta</div>
                            <div
                              className={`text-base font-mono font-extrabold flex items-center justify-end gap-1 ${
                                isProfitable ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isProfitable ? "+" : ""}
                              {craft.netProfit.toLocaleString()} K
                            </div>
                            <div
                              className={`text-xs font-bold ${
                                isProfitable ? "text-emerald-500" : "text-rose-500"
                              }`}
                            >
                              ROI: {craft.roi > 0 ? "+" : ""}
                              {craft.roi.toFixed(1)}%
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpand(craft.item.id)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              title={isExpanded ? "Ocultar ingredientes" : "Ver ingredientes"}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            <button
                              onClick={() => onSelectRecipeForCalculator(craft.item)}
                              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all"
                              title="Abrir en Calculadora de Recetas"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Ver Receta</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Ingredients Accordion */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 bg-slate-950/80 border-t border-slate-800/80 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-amber-400" />
                              Desglose de Ingredientes de la Receta
                            </h4>

                            <div className="flex items-center gap-2">
                              {!craft.isFullyCraftable && (
                                <button
                                  onClick={() => handleAddMissingToShoppingList(craft)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all"
                                >
                                  <ShoppingCart className="w-3.5 h-3.5" />
                                  Añadir faltantes a Lista de Compras
                                </button>
                              )}

                              {onSelectForCrushing && (
                                <button
                                  onClick={() => onSelectForCrushing(craft.item)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                  Probar en Rompedora
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {craft.ingredientsStatus.map((ing) => (
                              <div
                                key={ing.itemId}
                                className={`p-3 rounded-xl border flex items-center gap-3 ${
                                  ing.isFullyAvailable
                                    ? "bg-emerald-950/20 border-emerald-500/30"
                                    : "bg-slate-900 border-slate-800"
                                }`}
                              >
                                <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-700/60 flex items-center justify-center p-1 shrink-0">
                                  <SafeImage
                                    src={getItemIconUrl(ing.itemIconId || ing.itemId)}
                                    alt={ing.itemName}
                                    className="w-7 h-7 object-contain"
                                  />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-slate-200 truncate">
                                    {ing.itemName}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    En banco:{" "}
                                    <strong
                                      className={
                                        ing.isFullyAvailable ? "text-emerald-400" : "text-amber-400"
                                      }
                                    >
                                      {ing.inBank}
                                    </strong>{" "}
                                    / Requerido: <strong>{ing.required}</strong>
                                  </div>
                                  {!ing.isFullyAvailable && (
                                    <div className="text-[11px] text-rose-400 font-medium">
                                      Faltan: {ing.missing} (Coste: {ing.missingCost.toLocaleString()} K)
                                    </div>
                                  )}
                                </div>

                                <div className="shrink-0">
                                  {ing.isFullyAvailable ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                      Listo
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                      Comprar
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    Página <strong>{safeCurrentPage}</strong> de <strong>{totalPages}</strong> ({filteredAndSortedOpportunities.length} oportunidades en total)
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={safeCurrentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-300"
                    >
                      Primera
                    </button>
                    <button
                      onClick={() => handlePageChange(safeCurrentPage - 1)}
                      disabled={safeCurrentPage === 1}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page Numbers Slice */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={p}>
                            {prev && p - prev > 1 && <span className="text-slate-600 px-1">...</span>}
                            <button
                              onClick={() => handlePageChange(p)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                p === safeCurrentPage
                                  ? "bg-amber-500 text-slate-950 shadow"
                                  : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      onClick={() => handlePageChange(safeCurrentPage + 1)}
                      disabled={safeCurrentPage === totalPages}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={safeCurrentPage === totalPages}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-300"
                    >
                      Última
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------- SUB-TAB 2: BANK INVENTORY LIST ---------------- */}
      {activeSubTab === "inventory" && (
        <div className="space-y-4">
          {/* Search & Sort Inventory */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar recursos en el banco..."
                value={inventorySearch}
                onChange={(e) => {
                  setInventorySearch(e.target.value);
                  setInventoryPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400 shrink-0">Ordenar por:</span>
              <select
                value={inventorySort}
                onChange={(e) => setInventorySort(e.target.value as any)}
                className="px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="value">Mayor Valor Total en Kamas</option>
                <option value="quantity">Mayor Cantidad de Unidades</option>
                <option value="name">Alfabético (A-Z)</option>
                <option value="recent">Añadidos Recientemente</option>
              </select>
            </div>
          </div>

          {/* Inventory Table / Grid */}
          {filteredBankInventory.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-2">
              <Vault className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-300">
                No hay recursos en el banco
              </h3>
              <p className="text-sm text-slate-500">
                Usa el buscador superior para agregar recursos y sus cantidades a tu banco.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {paginatedInventory.map((item) => {
                  const resolvedItem = item.item || { id: item.itemId };
                  const name = getItemName(resolvedItem);
                  const unitPrice = marketPrices[item.itemId] || getStoredItemPrice(item.itemId) || 0;
                  const totalValue = item.quantity * unitPrice;

                  return (
                    <div
                      key={item.itemId}
                      className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex flex-col justify-between gap-3 shadow transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center p-1.5 shrink-0">
                          <SafeImage
                            src={getItemIconUrl(('iconId' in resolvedItem && resolvedItem.iconId) ? resolvedItem.iconId : item.itemId)}
                            alt={name}
                            className="w-9 h-9 object-contain"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-100 truncate" title={name}>
                            {name}
                          </h4>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Unitario: <span className="font-mono text-amber-400/90">{unitPrice.toLocaleString()} K</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            Valor total:{" "}
                            <span className="font-mono font-bold text-emerald-400">
                              {totalValue.toLocaleString()} K
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.itemId, name)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Eliminar del banco"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quantity Edit Row */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <span className="text-xs text-slate-400 font-medium">Cantidad:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="999999"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateQuantity(
                                item.itemId,
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-right text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            onClick={() => {
                              setCraftSearchQuery(name);
                              setActiveSubTab("crafts");
                            }}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-[11px] font-semibold transition-colors"
                            title="Buscar recetas con este recurso"
                          >
                            Recetas
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inventory Pagination Controls */}
              {totalInventoryPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    Página <strong>{safeInventoryPage}</strong> de <strong>{totalInventoryPages}</strong> ({filteredBankInventory.length} recursos)
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setInventoryPage(1)}
                      disabled={safeInventoryPage === 1}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-300"
                    >
                      Primera
                    </button>
                    <button
                      onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                      disabled={safeInventoryPage === 1}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-xs font-mono font-bold text-slate-200">
                      {safeInventoryPage} / {totalInventoryPages}
                    </span>
                    <button
                      onClick={() => setInventoryPage((p) => Math.min(totalInventoryPages, p + 1))}
                      disabled={safeInventoryPage === totalInventoryPages}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setInventoryPage(totalInventoryPages)}
                      disabled={safeInventoryPage === totalInventoryPages}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-300"
                    >
                      Última
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

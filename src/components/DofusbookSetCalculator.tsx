import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  DofusbookBuildAnalysis,
  DofusbookEquipmentItem,
  DofusItem,
} from '../types';
import {
  fetchDofusbookAnalysis,
  getActivePriceProfileId,
  saveMarketPrice,
  addDofusbookItemsToShoppingList,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../services/dofusDbService';
import { SafeImage } from './SafeImage';
import { formatKamas } from '../utils/kamaFormatters';

interface DofusbookSetCalculatorProps {
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onNavigateToShopping?: () => void;
}

export const DofusbookSetCalculator: React.FC<DofusbookSetCalculatorProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onNavigateToShopping,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [excludeDofus, setExcludeDofus] = useState(true);
  const [excludeTrophies, setExcludeTrophies] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DofusbookBuildAnalysis | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [shoppingAddedToast, setShoppingAddedToast] = useState(false);
  const [activeTabSection, setActiveTabSection] = useState<'comparison' | 'materials'>('comparison');
  const [showOnlyCraftable, setShowOnlyCraftable] = useState(false);
  const [editingPriceItemId, setEditingPriceItemId] = useState<number | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState<string>('');

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

          // Recalculate totals
          let totalCraftCost = 0;
          let totalMarketPrice = 0;
          let totalOptimalCost = 0;

          for (const it of updatedItems) {
            const isExcluded = (it.isDofus && excludeDofus) || (it.isTrophy && excludeTrophies);
            if (!isExcluded) {
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
            }
          }

          const totalSavings = Math.max(
            0,
            Math.max(totalCraftCost, totalMarketPrice) - totalOptimalCost
          );

          const updatedConsolidated = prev.consolidatedIngredients.map((mat) => {
            if (mat.itemId === itemId) {
              const unitPrice = price;
              const totalPrice = mat.totalQuantityRequired * unitPrice;
              return { ...mat, unitPrice, totalPrice };
            }
            return mat;
          });

          return {
            ...prev,
            items: updatedItems,
            consolidatedIngredients: updatedConsolidated,
            totals: {
              ...prev.totals,
              totalCraftCost,
              totalMarketPrice,
              totalOptimalCost,
              totalSavings,
            },
          };
        });
      }
    } catch (err) {
      console.error('Error saving price:', err);
    } finally {
      setEditingPriceItemId(null);
    }
  };

  const handleSendToShoppingList = () => {
    if (!analysis) return;

    // Send all craftable items in the build
    const itemsToAdd = analysis.items
      .filter((it) => {
        if (!it.item) return false;
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
      // If none marked as craft, add all items that have recipes
      const fallbackToAdd = analysis.items
        .filter((it) => it.item && it.isCraftable)
        .map((it) => ({
          item: it.item!,
          recipe: it.recipe,
          quantity: 1,
        }));
      addDofusbookItemsToShoppingList(fallbackToAdd);
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
      ``,
      `RESUMEN DE COSTES:`,
      `- Total Compra Directa (HDV): ${formatKamas(analysis.totals.totalMarketPrice)}`,
      `- Total Coste Crafteo: ${formatKamas(analysis.totals.totalCraftCost)}`,
      `- Total Estrategia Óptima: ${formatKamas(analysis.totals.totalOptimalCost)}`,
      `- Ahorro Estimado: ${formatKamas(analysis.totals.totalSavings)}`,
      ``,
      `DETALLE POR PIEZA:`,
    ];

    analysis.items.forEach((it) => {
      const name = it.item?.name?.es || it.rawName;
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

  const filteredItems = analysis
    ? analysis.items.filter((it) => {
        if (showOnlyCraftable && !it.isCraftable) return false;
        return true;
      })
    : [];

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
              Coloca el enlace para desglosar el costo
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
          {/* Build Info Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md">
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
                    {analysis.items.length} piezas equipadas
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
                onClick={handleCopySummary}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer shadow-sm"
                title="Copiar resumen al portapapeles"
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
                title="Añadir ingredientes de piezas crafteables a la lista de compras"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Enviar Materiales a Compras</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {shoppingAddedToast && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 p-3 rounded-xl flex items-center justify-between text-emerald-300 text-xs shadow-lg animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>¡Materiales del set añadidos al Planificador de Compras con éxito!</span>
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

          {/* Financial KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Direct Market Buy Total */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-sky-400" />
                  Compra Directa (HDV)
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500">Todo en mercadillo</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                {formatKamas(analysis.totals.totalMarketPrice)}
              </div>
              <p className="text-[11px] text-slate-400">
                Coste total si compras todas las piezas terminadas en el mercadillo.
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
                  {analysis.totals.craftablePiecesCount} crafteables
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono tracking-tight">
                {formatKamas(analysis.totals.totalCraftCost)}
              </div>
              <p className="text-[11px] text-slate-400">
                Coste de los materiales requeridos para fabricar el equipamiento.
              </p>
            </div>

            {/* Optimal Strategy Mix */}
            <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-1 shadow-md">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  Mix Óptimo Inteligente
                </span>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Recomendado
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono tracking-tight">
                {formatKamas(analysis.totals.totalOptimalCost)}
              </div>
              <p className="text-[11px] text-slate-400">
                Crafteando cuando es más barato y comprando en HDV cuando conviene.
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
                  {analysis.totals.totalMarketPrice > 0
                    ? `${Math.round(
                        (analysis.totals.totalSavings /
                          Math.max(1, analysis.totals.totalMarketPrice)) *
                          100
                      )}%`
                    : '0%'}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
                +{formatKamas(analysis.totals.totalSavings)}
              </div>
              <p className="text-[11px] text-slate-400">
                Kamas que te ahorras optimizando cada pieza individualmente.
              </p>
            </div>
          </div>

          {/* Dofus Excluded Note Banner */}
          {excludeDofus && analysis.totals.excludedDofusCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl flex items-center gap-2.5 text-amber-300 text-xs">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Nota:</strong> Se detectaron{' '}
                <strong>{analysis.totals.excludedDofusCount} Dofus</strong> en el set. Por defecto sus
                precios <strong>no se han sumado al total</strong> (puedes activar su inclusión con el botón
                "Excluir Dofus").
              </span>
            </div>
          )}

          {/* Tab Navigation: Table vs Consolidated Materials */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
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
                <span>Desglose por Pieza ({analysis.items.length})</span>
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
                <span>Materiales Agregados ({analysis.consolidatedIngredients.length})</span>
              </button>
            </div>

            {/* Filter */}
            {activeTabSection === 'comparison' && (
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyCraftable}
                  onChange={(e) => setShowOnlyCraftable(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span>Solo piezas con receta</span>
              </label>
            )}
          </div>

          {/* TAB 1: Comparison Table */}
          {activeTabSection === 'comparison' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-3 sm:px-4">Ranura / Objeto</th>
                      <th className="py-3 px-3 text-center">Nivel / Tipo</th>
                      <th className="py-3 px-3 text-right">Coste Crafteo</th>
                      <th className="py-3 px-3 text-right">Precio HDV</th>
                      <th className="py-3 px-3 text-center">Veredicto</th>
                      <th className="py-3 px-3 text-center">Ahorro</th>
                      <th className="py-3 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredItems.map((it, idx) => {
                      const itemKey = `${it.slotName}-${it.id || idx}`;
                      const isExpanded = !!expandedItems[itemKey];
                      const isEditingPrice = editingPriceItemId === it.id;

                      return (
                        <React.Fragment key={itemKey}>
                          <tr className="hover:bg-slate-800/40 transition-colors group">
                            {/* Slot & Item Name */}
                            <td className="py-3 px-3 sm:px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner">
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
                                  <div className="font-bold text-white text-xs sm:text-sm group-hover:text-amber-300 transition-colors">
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
                              {it.isCraftable && it.craftCost > 0 ? (
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
                              {isEditingPrice ? (
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
                                    className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400"
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

                            {/* Verdict */}
                            <td className="py-3 px-3 text-center">
                              {it.cheaperOption === 'craft' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-xs">
                                  <Hammer className="w-3 h-3" />
                                  Craftear
                                </span>
                              )}
                              {it.cheaperOption === 'buy' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-black text-xs">
                                  <ShoppingCart className="w-3 h-3" />
                                  Comprar HDV
                                </span>
                              )}
                              {it.cheaperOption === 'equal' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-xs">
                                  Mismo precio
                                </span>
                              )}
                              {it.cheaperOption === 'dofus_excluded' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300/80 font-semibold text-xs">
                                  Dofus (Excluido)
                                </span>
                              )}
                              {it.cheaperOption === 'no_recipe' && (
                                <span className="text-slate-500 text-xs">Comprar</span>
                              )}
                            </td>

                            {/* Savings */}
                            <td className="py-3 px-3 text-center font-mono">
                              {it.savings > 0 ? (
                                <span className="text-emerald-400 font-black text-xs">
                                  +{formatKamas(it.savings)}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-xs">-</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {it.item && onSelectRecipeForCalculator && it.isCraftable && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectRecipeForCalculator(it.item!)}
                                    className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 rounded-lg transition-colors"
                                    title="Abrir en Calculadora de Recetas"
                                  >
                                    <Wrench className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {it.item && onSelectForCrushing && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectForCrushing(it.item!)}
                                    className="p-1.5 bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 rounded-lg transition-colors"
                                    title="Calcular brisage en Rompedora"
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Ingredient Breakdown Row */}
                          {isExpanded && it.ingredientsBreakdown.length > 0 && (
                            <tr className="bg-slate-950/60 border-b border-slate-800/80">
                              <td colSpan={7} className="py-3 px-4 sm:px-6">
                                <div className="space-y-2">
                                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                    <Hammer className="w-3.5 h-3.5" />
                                    <span>Materiales necesarios para {it.item?.name?.es || it.rawName}:</span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                    {it.ingredientsBreakdown.map((ing) => {
                                      const isEditingThisIng = editingPriceItemId === ing.id;

                                      return (
                                        <div
                                          key={ing.id}
                                          className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
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
                                              <div className="font-semibold text-slate-200 text-xs truncate">
                                                {ing.name}
                                              </div>
                                              <div className="text-[10px] text-slate-400">
                                                Cant: <strong className="text-amber-300 font-mono">x{ing.quantity}</strong>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="text-right font-mono shrink-0">
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
                                                <div className="text-xs font-bold text-slate-300 group-hover/ingprice:text-amber-300">
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
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Consolidated Ingredients Shopping List */}
          {activeTabSection === 'materials' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-400" />
                    Lista Consolidada de Materiales del Set
                  </h4>
                  <p className="text-xs text-slate-400">
                    Suma total de todos los recursos necesarios para fabricar las piezas del set analizado.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSendToShoppingList}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Enviar a Planificador de Compras</span>
                </button>
              </div>

              {analysis.consolidatedIngredients.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No hay materiales requeridos o las piezas no tienen recetas registradas.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {analysis.consolidatedIngredients.map((mat) => {
                    const isEditingThisMat = editingPriceItemId === mat.itemId;

                    return (
                      <div
                        key={mat.itemId}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
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
                            <div className="font-bold text-slate-200 text-xs truncate">
                              {mat.item?.name?.es || `Ingrediente #${mat.itemId}`}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Total: <strong className="text-amber-300 font-mono">x{mat.totalQuantityRequired.toLocaleString()}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
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
                              <div className="text-xs font-black text-amber-400 group-hover/matprice:text-amber-300">
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
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from "react";
import {
  Wrench,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  Map as MapIcon,
  Vault,
  CornerDownRight,
  GitBranch,
  CheckCircle2,
  Clock,
  History,
} from "lucide-react";
import { DofusItem, MarketPriceMap, RecipeTreeNode } from "../../types";
import {
  calculateTreeCraftCost,
  getItemFallbackIconUrl,
  getItemIconUrl,
  getItemName,
  formatRelativeTime,
  addOrUpdateBankItem,
} from "../../services/dofusDbService";
import {
  isBycResource,
  analyzeBycResourceCost,
  getOptimizedIngredientCost,
  BycResourceCostAnalysis,
} from "../../services/bycCostService";
import { SafeImage } from "../SafeImage";

// -----------------------------------------------------------------------------
// SUB-INGREDIENT ROW COMPONENT (EDITABLE PRICES FOR SUB-RECIPES)
// -----------------------------------------------------------------------------
export interface SubIngredientRowProps {
  sub: RecipeTreeNode;
  level?: number;
  parentName?: string;
  marketPrices: MarketPriceMap;
  priceUpdatedAt?: Record<number, number>;
  onPriceChange: (itemId: number, newPrice: number) => void;
  onOpenHistory?: (item: DofusItem) => void;
  forceExpandTrigger?: number;
  forceExpandValue?: boolean;
}

export const SubIngredientRow: React.FC<SubIngredientRowProps> = ({
  sub,
  level = 1,
  parentName,
  marketPrices,
  priceUpdatedAt = {},
  onPriceChange,
  onOpenHistory,
  forceExpandTrigger = 0,
  forceExpandValue = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentPrice = marketPrices[sub.itemId] || sub.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);

  useEffect(() => {
    if (forceExpandTrigger > 0) {
      setIsExpanded(forceExpandValue);
    }
  }, [forceExpandTrigger, forceExpandValue]);

  const displayPrice =
    draftPrice !== null ? draftPrice : currentPrice > 0 ? currentPrice : "";
  const subTotal = currentPrice * sub.quantity;
  const hasSubSubCraft =
    sub.isCraftable && sub.subIngredients && sub.subIngredients.length > 0;

  const subCraftCost = hasSubSubCraft
    ? calculateTreeCraftCost(sub, "full_subcraft", marketPrices)
    : subTotal;
  const directBuyCost = subTotal;
  const isSubCraftCheaper =
    hasSubSubCraft && currentPrice > 0 && subCraftCost < directBuyCost;
  const subSavings =
    hasSubSubCraft && currentPrice > 0
      ? Math.abs(directBuyCost - subCraftCost)
      : 0;

  const subName = getItemName(sub.item);

  const levelThemes = [
    {
      bg: "bg-slate-900/95",
      border: "border-amber-500/40 hover:border-amber-500/60",
      accent: "text-amber-400",
      badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      line: "border-l-2 border-amber-500/50",
      pill: "bg-amber-950/40 border-amber-500/30 text-amber-300",
    },
    {
      bg: "bg-slate-950/95",
      border: "border-indigo-500/40 hover:border-indigo-500/60",
      accent: "text-indigo-400",
      badgeBg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
      line: "border-l-2 border-indigo-500/50",
      pill: "bg-indigo-950/40 border-indigo-500/30 text-indigo-300",
    },
    {
      bg: "bg-slate-950/95",
      border: "border-sky-500/40 hover:border-sky-500/60",
      accent: "text-sky-400",
      badgeBg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      line: "border-l-2 border-sky-500/50",
      pill: "bg-sky-950/40 border-sky-500/30 text-sky-300",
    },
  ];
  const theme = levelThemes[Math.min(level - 1, levelThemes.length - 1)];

  return (
    <div
      className={`rounded-2xl p-3.5 space-y-2.5 shadow-lg transition-all border ${theme.bg} ${theme.border}`}
    >
      {parentName && (
        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
          <CornerDownRight className={`w-3 h-3 ${theme.accent}`} />
          <span>Ingrediente para fabricar</span>
          <strong className="text-slate-200">{parentName}</strong>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <SafeImage
            src={getItemIconUrl(sub.itemId)}
            fallbackSrc={getItemFallbackIconUrl()}
            alt={subName}
            className="w-8 h-8 rounded-lg object-contain bg-slate-950 p-0.5 border border-slate-700 shrink-0"
          />
          <div className="min-w-0">
            <span className="font-bold text-white text-xs block truncate">
              {subName}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {hasSubSubCraft ? (
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${theme.badgeBg}`}>
                  Sub-crafteo ({sub.subIngredients?.length})
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Recurso base
                </span>
              )}
            </div>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold font-mono text-xs shrink-0">
          x{sub.quantity}
        </span>
      </div>

      {/* Editable Sub-Ingredient Price */}
      <div className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span>Precio unitario:</span>
          {onOpenHistory && (
            <button
              type="button"
              onClick={() => onOpenHistory(sub.item)}
              className="p-1 rounded bg-slate-900 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-700 transition-colors cursor-pointer"
              title="Ver historial de precios"
            >
              <History className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={displayPrice}
            onChange={(e) => setDraftPrice(e.target.value)}
            onBlur={() => {
              if (draftPrice !== null) {
                const num = Number(draftPrice);
                if (!Number.isNaN(num) && num >= 0) {
                  onPriceChange(sub.itemId, num);
                }
                setDraftPrice(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (draftPrice !== null) {
                  const num = Number(draftPrice);
                  if (!Number.isNaN(num) && num >= 0) {
                    onPriceChange(sub.itemId, num);
                  }
                  setDraftPrice(null);
                }
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="0"
            className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-amber-300 font-mono font-bold text-xs focus:outline-none focus:border-amber-400"
          />
          <span className="text-[10px] text-slate-500 font-mono">K</span>
        </div>
      </div>

      {/* Subtotal & Nested tree support */}
      <div className="flex items-center justify-between text-xs font-mono pt-1">
        <span className="text-slate-400">Total ({sub.quantity}x):</span>
        <span className="text-emerald-400 font-bold">
          {(isSubCraftCheaper ? subCraftCost : directBuyCost).toLocaleString()} K
        </span>
      </div>

      {hasSubSubCraft && (
        <div className="pt-1.5 space-y-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold flex items-center justify-between hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-slate-300">
              <GitBranch className="w-3 h-3 text-amber-400" />
              <span>
                {isExpanded
                  ? `Plegar sub-crafteo`
                  : `Desplegar sub-crafteo (${sub.subIngredients?.length})`}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              {currentPrice > 0 && isSubCraftCheaper && !isExpanded && (
                <span className="text-[10px] text-emerald-300 font-bold font-mono">
                  Ahorras {subSavings.toLocaleString()} K
                </span>
              )}
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
          </button>

          {isExpanded && sub.subIngredients && (
            <div className="space-y-2 pl-2 border-l-2 border-amber-500/40 ml-1 pt-1">
              {sub.subIngredients.map((nestedSub) => (
                <SubIngredientRow
                  key={nestedSub.itemId}
                  sub={nestedSub}
                  level={level + 1}
                  parentName={subName}
                  marketPrices={marketPrices}
                  priceUpdatedAt={priceUpdatedAt}
                  onPriceChange={onPriceChange}
                  onOpenHistory={onOpenHistory}
                  forceExpandTrigger={forceExpandTrigger}
                  forceExpandValue={forceExpandValue}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// HORIZONTAL INGREDIENT CARD COMPONENT
// -----------------------------------------------------------------------------
export interface HorizontalIngredientCardProps {
  node: RecipeTreeNode;
  marketPrices: MarketPriceMap;
  priceUpdatedAt: Record<number, number>;
  onPriceChange: (itemId: number, newPrice: number) => void;
  onOpenHistory?: (item: DofusItem) => void;
  forceExpandTrigger?: number;
  forceExpandValue?: boolean;
}

export const HorizontalIngredientCard: React.FC<HorizontalIngredientCardProps> = ({
  node,
  marketPrices,
  priceUpdatedAt,
  onPriceChange,
  onOpenHistory,
  forceExpandTrigger = 0,
  forceExpandValue = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentPrice = marketPrices[node.itemId] || node.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);

  useEffect(() => {
    if (forceExpandTrigger > 0) {
      setIsExpanded(forceExpandValue);
    }
  }, [forceExpandTrigger, forceExpandValue]);

  const hasSubCraft =
    node.isCraftable && node.subIngredients && node.subIngredients.length > 0;
  const subCraftCost = hasSubCraft
    ? calculateTreeCraftCost(node, "full_subcraft", marketPrices)
    : currentPrice * node.quantity;
  const directBuyCost = currentPrice * node.quantity;
  const isSubcraftCheaper =
    hasSubCraft && currentPrice > 0 && subCraftCost < directBuyCost;
  const savings =
    hasSubCraft && currentPrice > 0
      ? Math.abs(directBuyCost - subCraftCost)
      : 0;

  const isByc = isBycResource(node.item.id);
  const [bycAnalysis, setBycAnalysis] = useState<BycResourceCostAnalysis | null>(null);
  const [selectedBycMethod, setSelectedBycMethod] = useState<"direct" | "fragments" | "map">("direct");

  useEffect(() => {
    if (isByc) {
      const res = analyzeBycResourceCost(node.item.id, marketPrices);
      setBycAnalysis(res);
      if (res) {
        if (res.isFragmentsCheaper) setSelectedBycMethod("fragments");
        else if (res.isMapCheaper) setSelectedBycMethod("map");
        else setSelectedBycMethod("direct");
      }
    }
  }, [isByc, node.item.id, marketPrices]);

  const optimalCostForIngredient = isByc
    ? getOptimizedIngredientCost(node.item.id, node.quantity, marketPrices)
    : hasSubCraft && currentPrice === 0
      ? subCraftCost
      : isSubcraftCheaper
        ? subCraftCost
        : directBuyCost;

  const handleInputChange = (val: string) => {
    setDraftPrice(val);
  };

  const handleInputBlurOrEnter = () => {
    if (draftPrice !== null) {
      const parsed = Number(draftPrice);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        onPriceChange(node.itemId, parsed);
      }
      setDraftPrice(null);
    }
  };

  const handleApplyBycMethod = (method: "direct" | "fragments" | "map") => {
    setSelectedBycMethod(method);
    if (!bycAnalysis) return;
    if (method === "fragments" && bycAnalysis.fragmentsPrice > 0) {
      onPriceChange(node.item.id, bycAnalysis.fragmentsPrice);
    } else if (method === "map" && bycAnalysis.mapPrice > 0) {
      onPriceChange(node.item.id, bycAnalysis.mapPrice);
    }
  };

  const itemName = getItemName(node.item);

  return (
    <div
      className={`rounded-2xl p-4 space-y-3 transition-all border shadow-lg ${
        isSubcraftCheaper
          ? "bg-slate-950/90 border-emerald-500/40 hover:border-emerald-500/60"
          : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <SafeImage
                src={getItemIconUrl(node.itemId)}
                fallbackSrc={getItemFallbackIconUrl()}
                alt={itemName}
                className="w-10 h-10 rounded-xl object-contain bg-slate-900 p-1 border border-slate-700 shadow-md"
              />
            </div>

            <div className="min-w-0">
              <span className="font-black text-white text-sm block truncate leading-tight">
                {itemName}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {hasSubCraft ? (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Wrench className="w-2.5 h-2.5" />
                    Sub-receta ({node.subIngredients?.length})
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Recurso base
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black font-mono text-xs shrink-0 shadow-sm">
            x{node.quantity}
          </span>
        </div>

        {/* Real-time Interactive Unit Price Editor */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <div className="flex items-center gap-1.5">
              <span>Precio Unitario:</span>
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => onOpenHistory(node.item)}
                  className="p-1 rounded bg-slate-950 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-800 transition-colors cursor-pointer"
                  title="Ver historial de precios"
                >
                  <History className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="font-mono font-bold text-amber-400">Kamas</span>
          </div>
          <input
            type="number"
            value={
              draftPrice !== null
                ? draftPrice
                : currentPrice > 0
                  ? currentPrice
                  : ""
            }
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlurOrEnter}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleInputBlurOrEnter();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="0"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-right text-amber-300 font-mono font-black text-base focus:outline-none focus:border-amber-400 transition-colors"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
              {priceUpdatedAt[node.itemId]
                ? formatRelativeTime(priceUpdatedAt[node.itemId])
                : "Sin fecha de precio"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-slate-800">
        {/* Total Cost for required quantity */}
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">
              Subtotal ({node.quantity}x):
            </span>
            {hasSubCraft && currentPrice === 0 && subCraftCost > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-sans font-bold">
                Sub-crafteo
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                addOrUpdateBankItem(node.item.id, node.quantity);
                window.dispatchEvent(new CustomEvent("dofus_bank_inventory_updated"));
              }}
              className="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-800 transition-colors text-[10px] font-sans flex items-center gap-1 cursor-pointer"
              title="Guardar esta cantidad en Mi Banco"
            >
              <Vault className="w-3 h-3 text-amber-400" />
              +Banco
            </button>
          </div>
          <span className="text-emerald-400 font-black text-base">
            {optimalCostForIngredient.toLocaleString()} K
          </span>
        </div>

        {/* ByC Legendary Hunt Acquisition Selector */}
        {isByc && bycAnalysis && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Obtención ByC ({bycAnalysis.hunt.monsterName})
              </span>
              {bycAnalysis.savingsVsDirect > 0 && selectedBycMethod !== "direct" && (
                <span className="text-emerald-400 font-bold font-mono text-[11px] bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                  Ahorro: -{(bycAnalysis.savingsVsDirect * node.quantity).toLocaleString()} K
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleApplyBycMethod("direct")}
                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                  selectedBycMethod === "direct"
                    ? "bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <span className="text-[10px] font-sans">HDV Recurso</span>
                <span className="font-mono text-xs mt-0.5 font-bold">
                  {bycAnalysis.directPrice > 0 ? `${bycAnalysis.directPrice.toLocaleString()} K` : "—"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyBycMethod("fragments")}
                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                  selectedBycMethod === "fragments"
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                } ${bycAnalysis.bestMethod === "fragments" ? "ring-1 ring-emerald-400/40" : ""}`}
              >
                <span className="text-[10px] font-sans flex items-center gap-1">
                  <Layers className="w-2.5 h-2.5 text-indigo-400" />
                  Fragmentos
                </span>
                <span className="font-mono text-xs mt-0.5 font-bold">
                  {bycAnalysis.fragmentsPrice > 0 ? `${bycAnalysis.fragmentsPrice.toLocaleString()} K` : "—"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyBycMethod("map")}
                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                  selectedBycMethod === "map"
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                } ${bycAnalysis.bestMethod === "map" ? "ring-1 ring-emerald-400/40" : ""}`}
              >
                <span className="text-[10px] font-sans flex items-center gap-1">
                  <MapIcon className="w-2.5 h-2.5 text-amber-400" />
                  Mapa Entero
                </span>
                <span className="font-mono text-xs mt-0.5 font-bold">
                  {bycAnalysis.mapPrice > 0 ? `${bycAnalysis.mapPrice.toLocaleString()} K` : "—"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Sub-crafting comparison & Toggle Tree */}
        {hasSubCraft && (
          <div className="pt-1.5 space-y-2.5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                {currentPrice > 0 ? (
                  isSubcraftCheaper ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-[11px] font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Más rentable craftear (-{(directBuyCost - subCraftCost).toLocaleString()} K)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 font-black text-[11px] font-mono">
                      Más rentable comprar listo {savings > 0 ? `(-${savings.toLocaleString()} K)` : ""}
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-[11px] font-mono">
                    Crafteo estimado: {subCraftCost.toLocaleString()} K
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div
                  className={`p-2 rounded-lg border ${
                    currentPrice > 0 && directBuyCost <= subCraftCost
                      ? "bg-sky-500/10 border-sky-500/40"
                      : "bg-slate-950 border-slate-800"
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block font-sans font-bold">
                    Comprar Listo:
                  </span>
                  <span className="font-black text-white text-xs">
                    {currentPrice > 0
                      ? `${directBuyCost.toLocaleString()} K`
                      : "Sin precio"}
                  </span>
                </div>
                <div
                  className={`p-2 rounded-lg border ${
                    currentPrice > 0 && subCraftCost < directBuyCost
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : "bg-slate-950 border-slate-800"
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block font-sans font-bold">
                    Craftear Sub-receta:
                  </span>
                  <span className="font-black text-emerald-400 text-xs">
                    {subCraftCost.toLocaleString()} K
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-sm ${
                isExpanded
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-amber-500/10"
                  : "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <GitBranch className={`w-3.5 h-3.5 ${isExpanded ? "text-amber-400" : "text-slate-400"}`} />
                <span>
                  {isExpanded
                    ? `Plegar sub-receta (${node.subIngredients?.length})`
                    : `Desplegar sub-receta (${node.subIngredients?.length})`}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                {currentPrice > 0 && isSubcraftCheaper && !isExpanded && (
                  <span className="text-[10px] text-emerald-300 font-mono font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    Ahorras {savings.toLocaleString()} K
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-amber-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {isExpanded && node.subIngredients && (
              <div className="space-y-2 pt-1 animate-fadeIn">
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs text-amber-300 font-bold">
                  <span className="flex items-center gap-1.5 truncate">
                    <CornerDownRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      Ingredientes para fabricar <strong>{itemName}</strong>:
                    </span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-400/80 shrink-0 ml-1">
                    x{node.quantity}
                  </span>
                </div>

                <div className="space-y-2 pl-2.5 border-l-2 border-amber-500/40 ml-1.5">
                  {node.subIngredients.map((sub) => (
                    <SubIngredientRow
                      key={sub.itemId}
                      sub={sub}
                      level={1}
                      parentName={itemName}
                      marketPrices={marketPrices}
                      priceUpdatedAt={priceUpdatedAt}
                      onPriceChange={onPriceChange}
                      onOpenHistory={onOpenHistory}
                      forceExpandTrigger={forceExpandTrigger}
                      forceExpandValue={forceExpandValue}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import {
  Check,
  Copy,
  Trash2,
  Minus,
  Plus,
  Shield,
  Package,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Vault,
  Tag,
  Clock,
  Zap,
  Wrench,
  ShoppingCart,
} from 'lucide-react';
import { SafeImage } from '../SafeImage';
import { KamaDisplay } from '../common/KamaDisplay';
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
  getItemName,
} from '../../services/dofusDbService';
import { PresetCraftableItem } from '../../data/presetCraftableItems';
import { ItemSoldStats } from '../../services/salesHistoryService';
import { PlannedCraftItem } from './types';

interface DailyPlannerItemCardProps {
  craft: PlannedCraftItem;
  budget: number;
  isCopied: boolean;
  onCopyName: (id: number, name: string) => void;
  onMarkAsPosted: (craft: PlannedCraftItem) => void;
  onDiscardItem: (id: number) => void;
  onAdjustUnits: (id: number, delta: number) => void;
  useBankResources: boolean;
  bankQtyMap: Record<number, number>;
  marketPrices: Record<number, number>;
  activeItemInfo?: { count: number; totalQty: number; timeLabel: string };
  soldItemInfo?: ItemSoldStats;
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
  onAddToCart: (item: PresetCraftableItem, units: number) => void;
}

export const DailyPlannerItemCard: React.FC<DailyPlannerItemCardProps> = ({
  craft,
  budget,
  isCopied,
  onCopyName,
  onMarkAsPosted,
  onDiscardItem,
  onAdjustUnits,
  useBankResources,
  bankQtyMap,
  marketPrices,
  activeItemInfo,
  soldItemInfo,
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onAddToCart,
}) => {
  const itemName = getItemName(craft.item);

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 shadow-md flex flex-col justify-between gap-2.5 transition-all relative overflow-hidden group">
      {/* Decorative badge */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />

      {/* Top: Header Info */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl p-1.5 shrink-0 flex items-center justify-center shadow-inner">
              <SafeImage
                src={getItemIconUrl(craft.item)}
                fallbackSrc={getItemFallbackIconUrl(craft.item)}
                alt={itemName}
                className="w-9 h-9 object-contain"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3
                  onClick={() => onCopyName(craft.item.id, itemName)}
                  className="font-bold text-white text-sm truncate hover:text-amber-300 transition-colors cursor-pointer"
                  title={`${itemName} (Clic para copiar nombre)`}
                >
                  {itemName}
                </h3>
                <button
                  type="button"
                  onClick={() => onCopyName(craft.item.id, itemName)}
                  className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                  title="Copiar nombre"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap mt-0.5">
                <span className="font-mono text-slate-300">Nv. {craft.item.level}</span>
                <span>•</span>
                <span className="text-amber-300/90 font-semibold">{craft.jobName}</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
                  Nv. {craft.userJobLevel}
                </span>
                {craft.activeInHdv && craft.activeInHdv.totalQty > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/35 text-[10px] font-bold text-sky-400"
                    title={`${craft.activeInHdv.totalQty} unidades activas (${craft.activeInHdv.lots} lote(s)) en HDV. Tiempo restante: ${craft.activeInHdv.timeLabel}`}
                  >
                    <Tag className="w-2.5 h-2.5 text-sky-400" />
                    <span>En HDV: {craft.activeInHdv.totalQty} u. ({craft.activeInHdv.timeLabel})</span>
                  </span>
                )}
                {soldItemInfo && soldItemInfo.totalUnitsSold > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-bold text-emerald-400"
                    title={`Has vendido personalmente ${soldItemInfo.totalUnitsSold} unidades de este ítem`}
                  >
                    <span>Tus ventas: {soldItemInfo.totalUnitsSold} u.</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: Ya puesto + Discard */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onMarkAsPosted(craft)}
              className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
              title="Marcar 'Ya puesto': descuenta los recursos de Mi Banco y el costo real de tus kamas actuales"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ya puesto</span>
            </button>

            <button
              type="button"
              onClick={() => onDiscardItem(craft.item.id)}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0 cursor-pointer"
              title="Descartar este objeto del plan y re-optimizar presupuesto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quantity Stepper & Badges */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Fabricar:</span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => onAdjustUnits(craft.item.id, -1)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                title="Restar 1 unidad"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-7 text-center font-mono font-black text-amber-300 text-xs">
                {craft.recommendedUnits}x
              </span>
              <button
                type="button"
                onClick={() => onAdjustUnits(craft.item.id, 1)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                title="Sumar 1 unidad"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* HDV Channel & Slots info badge */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap justify-end">
            {craft.marketCategory === 'equipment' ? (
              <span
                className="text-[10px] text-purple-300 font-sans px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 flex items-center gap-1"
                title="Mercadillo de Equipamiento (1 slot unitario por cada unidad)"
              >
                <Shield className="w-3 h-3 text-purple-400" />
                HDV Equipos ({craft.estimatedSlots}s)
              </span>
            ) : craft.marketCategory === 'consumables' ? (
              <span
                className="text-[10px] text-emerald-300 font-sans px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1"
                title={`Mercadillo de Consumibles (${craft.estimatedSlots} slots): lotes x1, x10, x100`}
              >
                <Package className="w-3 h-3 text-emerald-400" />
                HDV Consumibles ({craft.estimatedSlots}s)
              </span>
            ) : (
              <span
                className="text-[10px] text-amber-300 font-sans px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 flex items-center gap-1"
                title={`Mercadillo de Recursos (${craft.estimatedSlots} slots): lotes x1, x10, x100`}
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                HDV Recursos ({craft.estimatedSlots}s)
              </span>
            )}

            {craft.isStackable && craft.batchBreakdown && (
              <span
                className="text-[10px] text-slate-300 font-sans px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
                title={`Desglose en lotes puestos a la venta: ${craft.batchBreakdown.lots100 > 0 ? `${craft.batchBreakdown.lots100}x [100] ` : ''}${craft.batchBreakdown.lots10 > 0 ? `${craft.batchBreakdown.lots10}x [10] ` : ''}${craft.batchBreakdown.lots1 > 0 ? `${craft.batchBreakdown.lots1}x [1]` : ''}`}
              >
                {craft.batchBreakdown.lots100 > 0 ? `${craft.batchBreakdown.lots100}x100 ` : ''}
                {craft.batchBreakdown.lots10 > 0 ? `${craft.batchBreakdown.lots10}x10 ` : ''}
                {craft.batchBreakdown.lots1 > 0 ? `${craft.batchBreakdown.lots1}x1` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Outlier / Exomagueo Protection notice if applicable */}
        {craft.isOutlierPrice && (
          craft.originalSalePriceUnit !== craft.salePriceUnit ? (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="leading-tight">
                Precio protegido: calculando con mediana ({craft.salePriceUnit.toLocaleString('es-ES')} K)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-mono">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="leading-tight">
                Anomalía: +{((craft.outlierRatio - 1) * 100).toFixed(0)}% sobre mediana ({craft.referenceMedian?.toLocaleString('es-ES')} K)
              </span>
            </div>
          )
        )}

        {/* Breakdown Numbers */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/50 space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans">
              <span>Inversión Crafteo</span>
              <span className="text-amber-400 font-mono font-semibold">
                {budget > 0 ? `${((craft.totalCraftCost / budget) * 100).toFixed(0)}% ppto.` : ''}
              </span>
            </div>
            <div className="font-bold text-white">
              <KamaDisplay amount={craft.totalCraftCost} />
            </div>
            <span className="text-[10px] text-slate-500 block">
              Unit: {craft.craftCostUnit.toLocaleString('es-ES')} K {budget > 0 ? `(${((craft.craftCostUnit / budget) * 100).toFixed(1)}%)` : ''}
            </span>
          </div>

          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/50 space-y-0.5 text-right">
            <span className="text-[10px] text-emerald-400/90 font-sans block font-semibold">
              Beneficio Neto (+{craft.roiPercent.toFixed(0)}%)
            </span>
            <div className="font-bold text-emerald-400">
              +<KamaDisplay amount={craft.totalNetProfit} />
            </div>
            <span className="text-[10px] text-slate-500 block">
              Venta HDV: {craft.salePriceUnit.toLocaleString('es-ES')} K
            </span>
          </div>
        </div>

        {/* Cobertura de recursos en Mi Banco si está activo */}
        {useBankResources && craft.item.recipeData?.ingredientIds && (() => {
          let inBankCount = 0;
          let totalKamasCovered = 0;
          const totalIngredients = craft.item.recipeData.ingredientIds.length;

          craft.item.recipeData.ingredientIds.forEach((ingId, idx) => {
            const qtyPerCraft = craft.item.recipeData!.quantities[idx] || 1;
            const needed = qtyPerCraft * craft.recommendedUnits;
            const inBank = bankQtyMap[ingId] || 0;
            if (inBank > 0) {
              inBankCount++;
              const covered = Math.min(inBank, needed);
              const price = marketPrices[ingId] || 0;
              totalKamasCovered += covered * price;
            }
          });

          if (inBankCount === 0) return null;

          return (
            <div className="flex items-center justify-between text-[11px] bg-amber-500/10 border border-amber-500/25 rounded-xl px-2.5 py-1 text-amber-300">
              <span className="flex items-center gap-1 font-semibold">
                <Vault className="w-3.5 h-3.5 text-amber-400" />
                {inBankCount}/{totalIngredients} ingredientes en banco
              </span>
              <span className="font-mono text-[10px] text-amber-200 font-bold">
                Ahorro: ~{totalKamasCovered.toLocaleString('es-ES')} K
              </span>
            </div>
          );
        })()}

        {/* Personal Sales & Active HDV Listings Badges */}
        {(activeItemInfo || (soldItemInfo && soldItemInfo.totalUnitsSold > 0)) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {activeItemInfo && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-semibold"
                title={`Tienes ${activeItemInfo.totalQty} unidades de este objeto puestas en HDV actualmente. Expira en: ${activeItemInfo.timeLabel}`}
              >
                <Clock className="w-3 h-3 text-blue-400" />
                <span>{activeItemInfo.totalQty}x en HDV ({activeItemInfo.timeLabel})</span>
              </span>
            )}

            {soldItemInfo && soldItemInfo.totalUnitsSold > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold"
                title={`Has vendido ${soldItemInfo.totalUnitsSold} unidades en tu historial de ventas (~${soldItemInfo.totalKamas.toLocaleString('es-ES')} K totales)`}
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Vendido: {soldItemInfo.totalUnitsSold}x</span>
              </span>
            )}

            {soldItemInfo && soldItemInfo.expiredCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold"
                title={`Este ítem caducó ${soldItemInfo.expiredCount} vez(es) tras 28 días sin actualizar y regresó a tu banco`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>{soldItemInfo.expiredCount}x caducado</span>
              </span>
            )}
          </div>
        )}

        {/* Market Velocity & Cashflow Indicators */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-slate-800/40">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              Ventas diarias HDV:
            </span>
            {craft.hasSalesData && craft.avgDailySales > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-amber-300 font-mono flex items-center gap-1">
                  ~{craft.avgDailySales.toFixed(1)} uds/día
                  <span
                    className={`w-2 h-2 rounded-full ${
                      craft.turnoverRating === 'alta'
                        ? 'bg-emerald-400'
                        : craft.turnoverRating === 'media'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                    title={craft.turnoverLabel || ''}
                  />
                </span>
                {(craft.sales24h || craft.sales7d || craft.sales30d) ? (
                  <span
                    className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                    title={`Historial HDV: 24h: ${craft.sales24h ?? '-'} | 7d: ${craft.sales7d ?? '-'} | 30d: ${craft.sales30d ?? '-'}`}
                  >
                    {craft.sales24h ? `${craft.sales24h} (24h)` : craft.sales7d ? `${craft.sales7d} (7d)` : `${craft.sales30d} (30d)`}
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="text-rose-400/90 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 text-[10px]">
                Sin histórico HDV (tope seguro 1x)
              </span>
            )}
          </div>

          {craft.paybackHours !== null && (
            <div className="flex items-center justify-between text-[11px] bg-slate-950/40 px-2.5 py-1 rounded-xl border border-slate-800/40 font-mono">
              <span className="text-slate-400 flex items-center gap-1 font-sans">
                <Zap className="w-3 h-3 text-amber-400" />
                Retorno capital:
              </span>
              <span className="text-amber-300 font-bold">
                ~{craft.paybackHours}h ({craft.paybackDays?.toFixed(1)}d)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Action Buttons */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectRecipeForCalculator(craft.item)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
            title="Ver detalles de la receta y materiales"
          >
            <Wrench className="w-3 h-3 text-amber-400" />
            <span>Receta</span>
          </button>

          {craft.canCrush && onSelectForCrushing && (
            <button
              type="button"
              onClick={() => onSelectForCrushing(craft.item)}
              className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
              title="Simular en rompedora de runas"
            >
              <Zap className="w-3 h-3" />
              <span>Romper</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAddToCart(craft.item, craft.recommendedUnits)}
          className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
          title="Añadir esta cantidad a la lista de compras"
        >
          <ShoppingCart className="w-3 h-3" />
          <span>+ Carrito</span>
        </button>
      </div>
    </div>
  );
};

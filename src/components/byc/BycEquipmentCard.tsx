import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  BarChart2,
} from 'lucide-react';
import { LegendaryHuntInfo } from '../../data/legendaryHuntsData';
import { BycRelatedEquipment } from '../../data/bycEquipmentData';
import { getItemIconUrl } from '../../services/dofusDbService';
import {
  analyzeSalesVolume,
  ItemSalesVolume,
} from '../../services/salesVolumeService';
import { BycAcquisitionMethod, MARKET_TAX_RATE } from './types';

interface BycEquipmentCardProps {
  eq: BycRelatedEquipment;
  hunt: LegendaryHuntInfo;
  fragmentsTotalCost: number;
  wholeMapPrice: number;
  resourcePriceGross: number;
  resourceNetIncome: number;
  sebuscalinesValue: number;
  chestSebuscalines: number;
  optimalAcquisitionMethod: BycAcquisitionMethod;
  isExpanded: boolean;
  onToggleExpand: () => void;
  activeMethod: BycAcquisitionMethod;
  onSelectMethod: (method: BycAcquisitionMethod) => void;
  priceDrafts: Record<number, string>;
  onPriceDraftChange: (itemId: number, rawVal: string) => void;
  onPriceCommit: (itemId: number, rawVal: string) => void;
  salesVolume?: ItemSalesVolume;
  isVolumeModalOpen: boolean;
  onToggleVolumeModal: () => void;
  onUpdateVolume: (
    itemId: number,
    field: 'sales24h' | 'sales7d' | 'sales30d',
    val: string
  ) => void;
  getPrice: (itemId: number, defaultVal: number) => number;
  getBankQty: (itemId: number) => number;
  formatKamas: (val: number) => string;
}

export const BycEquipmentCard: React.FC<BycEquipmentCardProps> = ({
  eq,
  hunt,
  fragmentsTotalCost,
  wholeMapPrice,
  resourcePriceGross,
  resourceNetIncome,
  sebuscalinesValue,
  chestSebuscalines,
  optimalAcquisitionMethod,
  isExpanded,
  onToggleExpand,
  activeMethod,
  onSelectMethod,
  priceDrafts,
  onPriceDraftChange,
  onPriceCommit,
  salesVolume,
  isVolumeModalOpen,
  onToggleVolumeModal,
  onUpdateVolume,
  getPrice,
  getBankQty,
  formatKamas,
}) => {
  const salePriceGross = getPrice(eq.id, eq.defaultSalePrice);
  const saleIncomeNet = Math.round(salePriceGross * (1 - MARKET_TAX_RATE));

  // Calculate other ingredients cost (excluding ByC boss resource)
  const otherIngredients = eq.recipeIngredients.filter(
    (ing) => ing.id !== hunt.resource.id
  );
  const otherIngredientsCost = otherIngredients.reduce((acc, ing) => {
    const ingPrice = getPrice(ing.id, ing.defaultPrice);
    return acc + ingPrice * ing.quantity;
  }, 0);

  const resourceQtyNeeded = eq.resourceQuantityNeeded || 1;

  // --- CALCULATIONS FOR ALL 3 ACQUISITION CASES ---
  // Case 1: FRAGMENTOS
  const fragsBycCost = fragmentsTotalCost * resourceQtyNeeded;
  const fragsInvestment = otherIngredientsCost + fragsBycCost;
  const fragsSebuscalines = sebuscalinesValue * resourceQtyNeeded;
  const fragsRevenue = saleIncomeNet + fragsSebuscalines;
  const fragsProfitNet = fragsRevenue - fragsInvestment;
  const fragsRoi =
    fragsInvestment > 0 ? (fragsProfitNet / fragsInvestment) * 100 : 0;

  // Case 2: MAPA ENTERO
  const mapBycCost = wholeMapPrice * resourceQtyNeeded;
  const mapInvestment = otherIngredientsCost + mapBycCost;
  const mapSebuscalines = sebuscalinesValue * resourceQtyNeeded;
  const mapRevenue = saleIncomeNet + mapSebuscalines;
  const mapProfitNet = mapRevenue - mapInvestment;
  const mapRoi =
    mapInvestment > 0 ? (mapProfitNet / mapInvestment) * 100 : 0;

  // Case 3: COMPRA RECURSO EN HDV (0 Sebuscalines!)
  const hdvBycCost = resourcePriceGross * resourceQtyNeeded;
  const hdvInvestment = otherIngredientsCost + hdvBycCost;
  const hdvSebuscalines = 0;
  const hdvRevenue = saleIncomeNet;
  const hdvProfitNet = hdvRevenue - hdvInvestment;
  const hdvRoi =
    hdvInvestment > 0 ? (hdvProfitNet / hdvInvestment) * 100 : 0;

  // Active Case Metrics based on current user selection:
  let currentBycUnitCost = 0;
  let currentBycTotalCost = 0;
  let currentInvestment = 0;
  let currentSebuscalines = 0;
  let currentRevenue = 0;
  let currentProfitNet = 0;
  let currentRoi = 0;
  let currentMethodLabel = '';

  if (activeMethod === 'fragments') {
    currentBycUnitCost = fragmentsTotalCost;
    currentBycTotalCost = fragsBycCost;
    currentInvestment = fragsInvestment;
    currentSebuscalines = fragsSebuscalines;
    currentRevenue = fragsRevenue;
    currentProfitNet = fragsProfitNet;
    currentRoi = fragsRoi;
    currentMethodLabel = 'Fragmentos';
  } else if (activeMethod === 'map') {
    currentBycUnitCost = wholeMapPrice;
    currentBycTotalCost = mapBycCost;
    currentInvestment = mapInvestment;
    currentSebuscalines = mapSebuscalines;
    currentRevenue = mapRevenue;
    currentProfitNet = mapProfitNet;
    currentRoi = mapRoi;
    currentMethodLabel = 'Mapa Entero';
  } else {
    currentBycUnitCost = resourcePriceGross;
    currentBycTotalCost = hdvBycCost;
    currentInvestment = hdvInvestment;
    currentSebuscalines = 0;
    currentRevenue = hdvRevenue;
    currentProfitNet = hdvProfitNet;
    currentRoi = hdvRoi;
    currentMethodLabel = 'Recurso HDV';
  }

  // Added Value of Crafting vs Just Selling Raw Resource in HDV
  const addedValueVsRawSale =
    saleIncomeNet -
    otherIngredientsCost -
    resourceNetIncome * resourceQtyNeeded;

  // Sales Volume & Velocity Analysis for Equipment
  const eqSalesAnalysis = analyzeSalesVolume(salePriceGross, salesVolume);

  return (
    <div className="bg-slate-800/75 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition hover:border-slate-600">
      {/* Equipment Header Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
            <img
              src={getItemIconUrl(eq.id)}
              alt={eq.name}
              className="w-11 h-11 object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {eq.type}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-700 text-slate-200">
                Nv. {eq.level}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {eq.name}
              </h3>

              {/* Sales Volume / Turnover Badge */}
              {eqSalesAnalysis.hasData && eqSalesAnalysis.turnoverRating && (
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-bold border flex items-center gap-1 ${
                    eqSalesAnalysis.turnoverRating === 'alta'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                      : eqSalesAnalysis.turnoverRating === 'media'
                      ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <span>{eqSalesAnalysis.turnoverLabel}</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
              <span>
                Requiere {resourceQtyNeeded}x{' '}
                <strong className="text-amber-300">{hunt.resource.name}</strong>
              </span>
              <span className="text-slate-500">•</span>
              {addedValueVsRawSale > 0 ? (
                <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Craftear añade +{formatKamas(addedValueVsRawSale)} K frente a
                  solo vender el recurso crudo
                </span>
              ) : (
                <span className="text-amber-400 font-semibold bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/30">
                  Craftear rinde {formatKamas(Math.abs(addedValueVsRawSale))} K
                  menos que vender el recurso directo
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-start xl:justify-end">
          {/* Market Sale Price Box */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Venta Mercadillo:
              </span>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                Neto (-2%): {formatKamas(saleIncomeNet)} K
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 focus-within:border-amber-400">
              <input
                type="number"
                min="0"
                value={
                  priceDrafts[eq.id] !== undefined
                    ? priceDrafts[eq.id]
                    : salePriceGross > 0
                    ? salePriceGross
                    : ''
                }
                onChange={(e) => onPriceDraftChange(eq.id, e.target.value)}
                onBlur={(e) => onPriceCommit(eq.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    onPriceCommit(
                      eq.id,
                      (e.target as HTMLInputElement).value
                    );
                }}
                placeholder="0"
                className="w-28 bg-transparent text-right font-mono font-bold text-amber-300 text-sm sm:text-base focus:outline-none"
              />
              <span className="text-xs font-mono font-bold text-slate-400">
                K
              </span>
            </div>
          </div>

          {/* Total Materials Crafting Cost */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2 flex flex-col justify-center shadow-sm">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wide">
              Inversión Materiales
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-slate-100">
              {formatKamas(currentInvestment)} K
            </span>
          </div>

          {/* Total Profit from entire Loop */}
          <div
            className={`rounded-xl px-3.5 py-2 flex flex-col justify-center border shadow-sm ${
              currentProfitNet >= 0
                ? 'bg-emerald-950/50 border-emerald-500/50'
                : 'bg-rose-950/50 border-rose-500/50'
            }`}
          >
            <span
              className={`text-xs font-bold uppercase tracking-wide ${
                currentProfitNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {currentProfitNet >= 0
                ? 'Ganancia Total Ciclo'
                : 'Margen Pérdida'}
            </span>
            <span
              className={`text-sm sm:text-base font-black font-mono ${
                currentProfitNet >= 0 ? 'text-emerald-300' : 'text-rose-400'
              }`}
            >
              {currentProfitNet >= 0
                ? `+${formatKamas(currentProfitNet)}`
                : `-${formatKamas(Math.abs(currentProfitNet))}`}{' '}
              K{' '}
              <span className="text-xs font-bold">
                (
                {currentRoi >= 0
                  ? `+${currentRoi.toFixed(0)}%`
                  : `${currentRoi.toFixed(0)}%`}{' '}
                ROI)
              </span>
            </span>
          </div>

          {/* Toggle Sales Volume Drawer Button */}
          <button
            type="button"
            onClick={onToggleVolumeModal}
            className={`p-2.5 rounded-xl border transition ${
              isVolumeModalOpen || eqSalesAnalysis.hasData
                ? 'bg-indigo-950/50 border-indigo-500/60 text-indigo-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Registrar o ver volumen de ventas (24h, 7d, 30d)"
          >
            <BarChart2 className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleExpand}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
            title={isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Sales Volume Drawer (24h / 7d / 30d) */}
      {isVolumeModalOpen && (
        <div className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Registro de Ventas en Mercadillo (HDV)
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Ingresa las ventas registradas para estimar velocidad y precio
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Input: Últimas 24 horas */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">
                  Últimas 24h
                </span>
                <span className="text-[11px] text-slate-500">
                  Unidades vendidas
                </span>
              </div>
              <input
                type="number"
                min="0"
                value={
                  salesVolume?.sales24h !== undefined
                    ? salesVolume.sales24h
                    : ''
                }
                onChange={(e) =>
                  onUpdateVolume(eq.id, 'sales24h', e.target.value)
                }
                placeholder="—"
                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* Input: Últimos 7 días */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">
                  Últimos 7 días
                </span>
                <span className="text-[11px] text-slate-500">Total semana</span>
              </div>
              <input
                type="number"
                min="0"
                value={
                  salesVolume?.sales7d !== undefined ? salesVolume.sales7d : ''
                }
                onChange={(e) =>
                  onUpdateVolume(eq.id, 'sales7d', e.target.value)
                }
                placeholder="—"
                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* Input: Últimos 30 días */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">
                  Últimos 30 días
                </span>
                <span className="text-[11px] text-slate-500">Total mes</span>
              </div>
              <input
                type="number"
                min="0"
                value={
                  salesVolume?.sales30d !== undefined
                    ? salesVolume.sales30d
                    : ''
                }
                onChange={(e) =>
                  onUpdateVolume(eq.id, 'sales30d', e.target.value)
                }
                placeholder="—"
                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Estimates Output (Only when data exists) */}
          {eqSalesAnalysis.hasData ? (
            <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex flex-col">
                <span className="text-slate-400">Ritmo diario estimado:</span>
                <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                  ~{eqSalesAnalysis.avgDailySales} u/día
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-slate-400">
                  Tiempo de venta estimado:
                </span>
                <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                  {eqSalesAnalysis.daysToSell !== null
                    ? eqSalesAnalysis.daysToSell < 1
                      ? `< 24 horas`
                      : `~${Math.round(eqSalesAnalysis.daysToSell)} días`
                    : '—'}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-slate-400">
                  Precio sugerido de venta:
                </span>
                <span className="text-amber-300 font-bold font-mono text-sm mt-0.5">
                  {eqSalesAnalysis.suggestedPrice !== null
                    ? `${formatKamas(eqSalesAnalysis.suggestedPrice)} K`
                    : '—'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic pt-1">
              Sin datos de ventas ingresados aún. Los cálculos se actualizarán
              automáticamente al ingresar valores.
            </p>
          )}
        </div>
      )}

      {/* 3-Method Selection Pills & Comparison Bar */}
      <div className="bg-slate-900/90 border border-slate-750 rounded-xl p-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>
              Seleccionar método de obtención de {hunt.resource.name}:
            </span>
          </span>
          <span className="text-xs text-slate-400">
            Haz clic para alternar y recalcular el ciclo completo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Method 1: Fragmentos */}
          <button
            type="button"
            onClick={() => onSelectMethod('fragments')}
            className={`flex flex-col p-2.5 rounded-xl border text-left transition ${
              activeMethod === 'fragments'
                ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Fragmentos</span>
                {optimalAcquisitionMethod === 'fragments' && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold border border-amber-500/30">
                    Óptimo
                  </span>
                )}
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  fragsProfitNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {fragsProfitNet >= 0
                  ? `+${formatKamas(fragsProfitNet)}`
                  : `-${formatKamas(Math.abs(fragsProfitNet))}`}{' '}
                K
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Inv: {formatKamas(fragsInvestment)} K</span>
              <span className="text-emerald-300">
                +{formatKamas(fragsSebuscalines)} K Sebuscalines
              </span>
            </div>
          </button>

          {/* Method 2: Mapa Entero */}
          <button
            type="button"
            onClick={() => onSelectMethod('map')}
            className={`flex flex-col p-2.5 rounded-xl border text-left transition ${
              activeMethod === 'map'
                ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Mapa Entero</span>
                {optimalAcquisitionMethod === 'map' && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold border border-amber-500/30">
                    Óptimo
                  </span>
                )}
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  mapProfitNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {mapProfitNet >= 0
                  ? `+${formatKamas(mapProfitNet)}`
                  : `-${formatKamas(Math.abs(mapProfitNet))}`}{' '}
                K
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Inv: {formatKamas(mapInvestment)} K</span>
              <span className="text-emerald-300">
                +{formatKamas(mapSebuscalines)} K Sebuscalines
              </span>
            </div>
          </button>

          {/* Method 3: Compra Mercadillo */}
          <button
            type="button"
            onClick={() => onSelectMethod('hdv')}
            className={`flex flex-col p-2.5 rounded-xl border text-left transition ${
              activeMethod === 'hdv'
                ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Compra en mercadillo</span>
                {optimalAcquisitionMethod === 'hdv' && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold border border-amber-500/30">
                    Óptimo
                  </span>
                )}
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  hdvProfitNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {hdvProfitNet >= 0
                  ? `+${formatKamas(hdvProfitNet)}`
                  : `-${formatKamas(Math.abs(hdvProfitNet))}`}{' '}
                K
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Inv: {formatKamas(hdvInvestment)} K</span>
              <span className="text-slate-500 font-semibold">
                (0 Sebuscalines)
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Collapsible Details: Financial Breakdown + Ingredients */}
      {isExpanded && (
        <div className="pt-2 border-t border-slate-700/80 space-y-4">
          {/* Financial Math Summary Card for Active Method */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Resumen Financiero del Ciclo ({currentMethodLabel})</span>
              </span>
              <span className="text-xs text-slate-400">
                {activeMethod === 'hdv'
                  ? 'Comprando el recurso directo en mercadillo (sin cazar, sin Sebuscalines)'
                  : `Haciendo la cacería de ${hunt.monsterName} con ${currentMethodLabel} + crafteo`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Total Investment Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
                <span className="text-xs text-slate-400 uppercase font-bold">
                  1. Inversión Total
                </span>
                <div className="text-base sm:text-lg font-black font-mono text-slate-100">
                  {formatKamas(currentInvestment)} K
                </div>
                <div className="text-xs text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span>Otros ingredientes:</span>
                    <span className="font-mono text-slate-300">
                      {formatKamas(otherIngredientsCost)} K
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      {hunt.resource.name} ({currentMethodLabel}):
                    </span>
                    <span className="font-mono text-amber-300">
                      {formatKamas(currentBycTotalCost)} K
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Total Net Revenue Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
                <span className="text-xs text-slate-400 uppercase font-bold">
                  2. Ingresos Netos
                </span>
                <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
                  {formatKamas(currentRevenue)} K
                </div>
                <div className="text-xs text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span>Venta Equipo (Mercadillo -2%):</span>
                    <span className="font-mono text-slate-300">
                      {formatKamas(saleIncomeNet)} K
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      Sebuscalines ({chestSebuscalines * resourceQtyNeeded} u):
                    </span>
                    <span
                      className={`font-mono ${
                        currentSebuscalines > 0
                          ? 'text-emerald-300 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      +{formatKamas(currentSebuscalines)} K
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Pure Net Profit */}
              <div
                className={`border rounded-xl p-3 space-y-1 ${
                  currentProfitNet >= 0
                    ? 'bg-emerald-950/40 border-emerald-500/40'
                    : 'bg-rose-950/40 border-rose-500/40'
                }`}
              >
                <span
                  className={`text-xs uppercase font-bold ${
                    currentProfitNet >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  3. Ganancia Limpia (Beneficio)
                </span>
                <div
                  className={`text-base sm:text-lg font-black font-mono ${
                    currentProfitNet >= 0
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }`}
                >
                  {currentProfitNet >= 0
                    ? `+${formatKamas(currentProfitNet)}`
                    : `-${formatKamas(Math.abs(currentProfitNet))}`}{' '}
                  K
                </div>
                <div className="text-xs text-slate-300 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Retorno inversión (ROI):</span>
                  <span
                    className={`font-bold font-mono ${
                      currentRoi >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {currentRoi >= 0
                      ? `+${currentRoi.toFixed(0)}%`
                      : `${currentRoi.toFixed(0)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ingredients Breakdown */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300 flex-wrap gap-2">
              <span className="font-bold uppercase tracking-wider text-slate-200">
                Ingredientes de la Receta
              </span>
              <span className="text-xs sm:text-sm text-slate-400">
                Otros ingredientes:{' '}
                <strong className="text-slate-200 font-mono">
                  {formatKamas(otherIngredientsCost)} K
                </strong>{' '}
                + {hunt.resource.name} ({currentMethodLabel} x
                {resourceQtyNeeded}):{' '}
                <strong className="text-amber-300 font-mono">
                  {formatKamas(currentBycTotalCost)} K
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {eq.recipeIngredients.map((ing) => {
                const isBycResource = ing.id === hunt.resource.id;
                const ingUnitPrice = isBycResource
                  ? currentBycUnitCost
                  : getPrice(ing.id, ing.defaultPrice);
                const inBank = getBankQty(ing.id);

                return (
                  <div
                    key={ing.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      isBycResource
                        ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/30'
                        : inBank >= ing.quantity
                        ? 'bg-emerald-950/20 border-emerald-600/40'
                        : 'bg-slate-900/80 border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                          src={getItemIconUrl(ing.id)}
                          alt={ing.name}
                          className="w-7 h-7 object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate flex items-center gap-1.5 text-xs sm:text-sm">
                          <span>
                            {ing.quantity}x {ing.name}
                          </span>
                          {isBycResource && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                              {currentMethodLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          {isBycResource ? (
                            <span className="text-emerald-400 font-mono font-bold">
                              {formatKamas(ingUnitPrice)} K/u (
                              {currentMethodLabel})
                            </span>
                          ) : (
                            <span className="font-mono text-slate-300">
                              {formatKamas(ingUnitPrice)} K/u
                            </span>
                          )}
                          {inBank > 0 && (
                            <span className="text-emerald-400 font-bold">
                              ({inBank} banco)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {isBycResource ? (
                        <div className="px-2.5 py-1.5 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-right">
                          <span className="font-bold text-xs sm:text-sm font-mono text-emerald-300">
                            = {formatKamas(ingUnitPrice * ing.quantity)} K
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 focus-within:border-amber-400">
                            <input
                              type="number"
                              min="0"
                              value={
                                priceDrafts[ing.id] !== undefined
                                  ? priceDrafts[ing.id]
                                  : ingUnitPrice > 0
                                  ? ingUnitPrice
                                  : ''
                              }
                              onChange={(e) =>
                                onPriceDraftChange(ing.id, e.target.value)
                              }
                              onBlur={(e) =>
                                onPriceCommit(ing.id, e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  onPriceCommit(
                                    ing.id,
                                    (e.target as HTMLInputElement).value
                                  );
                              }}
                              placeholder="0"
                              className="w-18 bg-transparent text-right font-mono font-bold text-amber-300 text-xs sm:text-sm focus:outline-none"
                            />
                            <span className="text-xs text-slate-400 font-mono">
                              K
                            </span>
                          </div>
                          <span className="font-black text-slate-200 text-xs sm:text-sm font-mono min-w-[65px] text-right">
                            = {formatKamas(ingUnitPrice * ing.quantity)} K
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

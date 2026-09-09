import React, { useState } from "react";
import {
  Wrench,
  Search,
  Tag,
  Layers,
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Shield,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  Heart,
  Sparkles,
  Map as MapIcon,
  Coins,
  Activity,
  TrendingUp,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Clock,
  BadgePercent,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { DOFUS_JOBS } from "../../data/dofusJobs";

export const JOB_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
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

export type QuotationFilterType = "all" | "quoted" | "unquoted";

export interface RecipeCatalogFiltersProps {
  selectedJobId: number | "all";
  onSelectJobId: (id: number | "all") => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;

  // Level controls (direct manual entry + quick presets)
  minLevel: number | "";
  maxLevel: number | "";
  onMinLevelChange: (val: number | "") => void;
  onMaxLevelChange: (val: number | "") => void;
  onLevelRangeChange: (min: number, max: number) => void;

  // Quotation filters
  quotationFilter: QuotationFilterType;
  onQuotationFilterChange: (val: QuotationFilterType) => void;
  onlyProfitable: boolean;
  onOnlyProfitableChange: (val: boolean) => void;
  onlyFullyPricedIngredients: boolean;
  onOnlyFullyPricedIngredientsChange: (val: boolean) => void;

  // Sales velocity filters (decimal supported)
  minDailySales: number | "";
  onMinDailySalesChange: (val: number | "") => void;
  onlyWithSalesData: boolean;
  onOnlyWithSalesDataChange: (val: boolean) => void;

  // Profit and cost limits
  minProfit: number | "";
  onMinProfitChange: (val: number | "") => void;
  minRoi: number | "";
  onMinRoiChange: (val: number | "") => void;
  maxCraftCost: number | "";
  onMaxCraftCostChange: (val: number | "") => void;

  // Sorting
  sortBy: string;
  onSortByChange: (sort: string) => void;

  // Summary counts
  totalItemsCount: number;
  filteredItemsCount: number;
  quotedItemsCount: number;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export const RecipeCatalogFilters: React.FC<RecipeCatalogFiltersProps> = ({
  selectedJobId,
  onSelectJobId,
  searchTerm,
  onSearchTermChange,
  minLevel,
  maxLevel,
  onMinLevelChange,
  onMaxLevelChange,
  onLevelRangeChange,
  quotationFilter,
  onQuotationFilterChange,
  onlyProfitable,
  onOnlyProfitableChange,
  onlyFullyPricedIngredients,
  onOnlyFullyPricedIngredientsChange,
  minDailySales,
  onMinDailySalesChange,
  onlyWithSalesData,
  onOnlyWithSalesDataChange,
  minProfit,
  onMinProfitChange,
  minRoi,
  onMinRoiChange,
  maxCraftCost,
  onMaxCraftCostChange,
  sortBy,
  onSortByChange,
  totalItemsCount,
  filteredItemsCount,
  quotedItemsCount,
  onResetFilters,
  hasActiveFilters,
}) => {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showMarketGuide, setShowMarketGuide] = useState<boolean>(false);

  const velocityPresets = [
    { label: "Cualquiera", val: "" },
    { label: "≥ 0.2/d (~5d)", val: 0.2 },
    { label: "≥ 0.5/d (~2d)", val: 0.5 },
    { label: "≥ 1.0/d", val: 1.0 },
    { label: "≥ 2.0/d", val: 2.0 },
    { label: "≥ 3.0/d", val: 3.0 },
  ];

  return (
    <div className="space-y-4 w-full">
      {/* Job Selection Cards Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Wrench className="w-4 h-4 text-amber-400" />
            Selecciona un Oficio
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {selectedJobId === "all"
              ? `Mostrando todos (${DOFUS_JOBS.length} oficios)`
              : `Oficio: ${DOFUS_JOBS.find((j) => j.id === selectedJobId)?.nameEs || `ID #${selectedJobId}`}`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onSelectJobId("all")}
            className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
              selectedJobId === "all"
                ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 hover:bg-slate-900"
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">Todos ({DOFUS_JOBS.length})</span>
          </button>

          {DOFUS_JOBS.map((job) => {
            const isSelected = selectedJobId === job.id;
            const JobIcon = JOB_ICON_MAP[job.icon] || Wrench;
            return (
              <button
                type="button"
                key={job.id}
                onClick={() => onSelectJobId(job.id)}
                className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                    : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <JobIcon className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="truncate">{job.nameEs}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Filters Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
        {/* Header with Title and Counts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                Filtros y Estudio de Recetas
                <span className="text-xs text-amber-400 font-mono font-bold px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {filteredItemsCount} / {totalItemsCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Filtra por nivel exacto, estado de cotización y velocidad de ventas diarias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Market Study Guide Button */}
            <button
              type="button"
              onClick={() => setShowMarketGuide((v) => !v)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showMarketGuide
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title="Consejos y métricas de estudio de mercado para artesanos"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Estudio de Mercado</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Restablecer todos los filtros a sus valores predeterminados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* MARKET STUDY GUIDE ACCORDION */}
        {showMarketGuide && (
          <div className="bg-gradient-to-r from-amber-950/30 via-slate-950 to-sky-950/30 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <span className="font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>Guía Profesional: Cómo Seleccionar Recetas para Craftear</span>
              </span>
              <button
                type="button"
                onClick={() => setShowMarketGuide(false)}
                className="text-slate-400 hover:text-white"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300 text-[11px] leading-relaxed">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
                <strong className="text-white block font-bold flex items-center gap-1 text-xs">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  1. Velocidad de Venta vs ROI
                </strong>
                <p>
                  Un objeto con <strong className="text-emerald-400">100% de ROI</strong> que vende{" "}
                  <strong>0.05 al día</strong> (1 venta cada 20 días) estanca tu capital. Es preferible
                  un objeto con <strong>25% de ROI</strong> que vende <strong>2 al día</strong>:
                  reinviertes el dinero a diario con interés compuesto.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
                <strong className="text-white block font-bold flex items-center gap-1 text-xs">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  2. Flujo Diario (Ganancia × Ventas/Día)
                </strong>
                <p>
                  Usa el ordenamiento{" "}
                  <strong className="text-amber-300">"Mayor Flujo Diario Potencial"</strong>.
                  Multiplica tu ganancia neta por las ventas diarias para ver cuántas Kamas diarias te
                  aporta tener esa receta en el mercadillo.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
                <strong className="text-white block font-bold flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  3. Falsos Positivos de Ingredientes
                </strong>
                <p>
                  Si un ingrediente caro no tiene precio registrado (0 K), la receta parecerá
                  engañosamente ultra-rentable. Activa{" "}
                  <strong className="text-white">"100% Ingredientes Cotizados"</strong> para evitar
                  sorpresas al comprar los materiales.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PRIMARY FILTERS ROW 1: Search, Direct Levels, and Sorting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Search Box */}
          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              Buscar Objeto o Receta
            </label>
            <input
              type="text"
              placeholder="ej. Gelano, Cinto, Amuleto..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none font-medium text-xs"
            />
          </div>

          {/* 2. DIRECT LEVEL INPUTS (Min and Max written directly) */}
          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                Nivel (Directo)
              </span>
              <span className="text-[11px] font-mono text-slate-500">1 - 200</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="200"
                  placeholder="Min (1)"
                  value={minLevel}
                  onChange={(e) => {
                    const val = e.target.value;
                    onMinLevelChange(val === "" ? "" : Math.max(1, Math.min(200, Number(val))));
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-center text-white font-mono font-bold focus:border-amber-500 focus:outline-none text-xs"
                />
                <span className="absolute left-2 top-2 text-[10px] text-slate-500 font-sans pointer-events-none">
                  Min:
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="200"
                  placeholder="Max (200)"
                  value={maxLevel}
                  onChange={(e) => {
                    const val = e.target.value;
                    onMaxLevelChange(val === "" ? "" : Math.max(1, Math.min(200, Number(val))));
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-center text-white font-mono font-bold focus:border-amber-500 focus:outline-none text-xs"
                />
                <span className="absolute left-2 top-2 text-[10px] text-slate-500 font-sans pointer-events-none">
                  Max:
                </span>
              </div>
            </div>
          </div>

          {/* 3. Sorting By */}
          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Ordenar Por
            </label>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-500 focus:outline-none cursor-pointer text-xs"
            >
              <option value="daily_flow_desc">🌟 Mayor Flujo Diario (Ganancia × Ventas/Día)</option>
              <option value="profit_desc">💰 Mayor Ganancia Neta (Kamas)</option>
              <option value="roi_desc">📈 Mayor Rentabilidad (% ROI)</option>
              <option value="sales_velocity_desc">⚡ Mayor Velocidad de Venta (u/día)</option>
              <option value="cost_asc">📉 Menor Costo de Crafteo</option>
              <option value="cost_desc">🏷️ Mayor Costo de Crafteo</option>
              <option value="price_desc">💎 Mayor Precio de Venta HDV</option>
              <option value="level_desc">🔼 Nivel Descendente (200 → 1)</option>
              <option value="level_asc">🔽 Nivel Ascendente (1 → 200)</option>
              <option value="name">🔤 Nombre A-Z</option>
            </select>
          </div>

          {/* 4. Minimum Daily Sales (DECIMAL SUPPORTED) */}
          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                Mín. Ventas al Día
              </span>
              <span className="text-[11px] text-slate-500 font-mono">u/día (decimal)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="ej. 0.5 o 1 (Cualquiera)"
                value={minDailySales}
                onChange={(e) => {
                  const val = e.target.value;
                  onMinDailySalesChange(val === "" ? "" : Math.max(0, parseFloat(val)));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-sky-500 focus:outline-none text-xs"
              />
              <span className="absolute right-3 top-2 text-[11px] font-mono text-slate-500">
                u / día
              </span>
            </div>
          </div>
        </div>

        {/* PRIMARY FILTERS ROW 2: Quotation Status Toggle, Velocity Presets, & Quick Toggles */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1 border-t border-slate-800/80 items-center">
          {/* Quotation Status Selector (4 cols) */}
          <div className="lg:col-span-5 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
              Estado de Cotización de Venta (HDV)
            </span>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => onQuotationFilterChange("all")}
                className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer truncate ${
                  quotationFilter === "all"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Todas ({totalItemsCount})
              </button>

              <button
                type="button"
                onClick={() => onQuotationFilterChange("quoted")}
                className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1 truncate ${
                  quotationFilter === "quoted"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-emerald-400 hover:text-emerald-300"
                }`}
                title="Solo recetas con precio de venta HDV registrado"
              >
                <Coins className="w-3 h-3 shrink-0" />
                <span className="truncate">Cotizadas ({quotedItemsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => onQuotationFilterChange("unquoted")}
                className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1 truncate ${
                  quotationFilter === "unquoted"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-amber-400 hover:text-amber-300"
                }`}
                title="Recetas que aún no tienen precio de venta registrado"
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">Sin Cotizar</span>
              </button>
            </div>
          </div>

          {/* Quick Velocity Presets (4 cols) */}
          <div className="lg:col-span-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
              Filtro Rápido de Velocidad
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {velocityPresets.map((vp) => {
                const isActive =
                  (vp.val === "" && minDailySales === "") ||
                  (vp.val !== "" && minDailySales === vp.val);
                return (
                  <button
                    key={vp.label}
                    type="button"
                    onClick={() => onMinDailySalesChange(vp.val as any)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {vp.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core Boolean Toggles (3 cols) */}
          <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col gap-2 justify-center">
            <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white transition-colors select-none">
              <input
                type="checkbox"
                checked={onlyProfitable}
                onChange={(e) => onOnlyProfitableChange(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950 cursor-pointer"
              />
              <span className="font-bold text-emerald-400 text-xs">Solo Rentables (&gt;0 K)</span>
            </label>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-amber-400 text-xs font-bold transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Más Filtros (ROI, Costo...)</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ADVANCED ACCORDION: Min Profit, Min ROI, Max Craft Cost, Full Pricing Toggle */}
        {showAdvanced && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs animate-fadeIn">
            {/* Min Net Profit */}
            <div>
              <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
                <span>Ganancia Mín. (Kamas)</span>
                <span className="text-[11px] text-slate-500 font-mono">Neto</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={minProfit}
                  onChange={(e) =>
                    onMinProfitChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="0 K"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none text-xs"
                />
                <span className="absolute right-3 top-2 font-mono text-slate-500 text-xs">K</span>
              </div>
            </div>

            {/* Min ROI (%) */}
            <div>
              <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
                <span>ROI Mínimo (%)</span>
                <span className="text-[11px] text-slate-500 font-mono">Retorno</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={minRoi}
                  onChange={(e) =>
                    onMinRoiChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="ej. 20%"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none text-xs"
                />
                <span className="absolute right-3 top-2 font-mono text-slate-500 text-xs">%</span>
              </div>
            </div>

            {/* Max Craft Cost */}
            <div>
              <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
                <span>Costo Máx. Crafteo</span>
                <span className="text-[11px] text-slate-500 font-mono">Presupuesto</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={maxCraftCost}
                  onChange={(e) =>
                    onMaxCraftCostChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Sin límite"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none text-xs"
                />
                <span className="absolute right-3 top-2 font-mono text-slate-500 text-xs">K</span>
              </div>
            </div>

            {/* Checkboxes: Full ingredient prices & Only with sales data */}
            <div className="space-y-2 flex flex-col justify-center">
              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={onlyFullyPricedIngredients}
                  onChange={(e) => onOnlyFullyPricedIngredientsChange(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-300">
                  100% Ingredientes Cotizados
                </span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={onlyWithSalesData}
                  onChange={(e) => onOnlyWithSalesDataChange(e.target.checked)}
                  className="rounded border-slate-700 text-sky-500 focus:ring-0 bg-slate-900 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-300">
                  Solo con Historial de Ventas
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

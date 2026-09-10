import React, { useState, useEffect, useMemo } from 'react';
import {
  Scroll,
  Sparkles,
  TrendingUp,
  Gem,
  Coins,
  ArrowUpDown,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Flame,
  Shield,
  Zap,
  Activity,
  Award,
  Layers,
  Edit2,
  Check,
  X,
  PlusCircle,
  HelpCircle,
  Clock,
  BarChart2,
  RefreshCw,
  Briefcase
} from 'lucide-react';
import { useUserJobs } from '../hooks/useUserJobs';
import {
  CHARACTERISTIC_SCROLLS,
  CHARACTERISTIC_CONSUMABLES,
  CharacteristicScrollItem,
  CharacteristicConsumableItem
} from '../data/characteristicConsumablesData';
import {
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  saveMarketPrice,
  getItemIconUrl
} from '../services/dofusDbService';
import {
  getStoredSalesVolumeMap,
  saveItemSalesVolume
} from '../services/salesVolumeService';
import { MarketPriceMap, SalesVolumeMap } from '../types';

type MainTab = 'scrolls' | 'consumables';
type StatFilter = 'Todas' | 'Fuerza' | 'Vitalidad' | 'Sabiduría' | 'Inteligencia' | 'Suerte' | 'Agilidad';
type JobFilter = 'Todos' | 'Cazador' | 'Pescador' | 'Campesino' | 'Alquimista';
type SortFieldScroll = 'profitDaily' | 'ratio' | 'sales24h' | 'price' | 'name' | 'sebuscalines';

export const ConsumablesCharacteristicView: React.FC = () => {
  const { isEnabled: isUserJobsEnabled, canCraft } = useUserJobs();
  const [activeTab, setActiveTab] = useState<MainTab>('scrolls');
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [salesVolumes, setSalesVolumes] = useState<SalesVolumeMap>({});
  const [statFilter, setStatFilter] = useState<StatFilter>('Todas');
  const [jobFilter, setJobFilter] = useState<JobFilter>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [limitFilter, setLimitFilter] = useState<string>('todos'); // 'todos' | '25' | '50' | '80' | '100'
  
  // Edición rápida en línea (precios y ventas manuales)
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');
  const [editingSalesId, setEditingSalesId] = useState<number | null>(null);
  const [tempSalesValue, setTempSalesValue] = useState<string>('');

  // Ordenación de la tabla de pergaminos
  const [sortField, setSortField] = useState<SortFieldScroll>('profitDaily');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Simulador de canje de Sebuscalines
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [availableSebuscalines, setAvailableSebuscalines] = useState<number>(5000);
  const [simulationMode, setSimulationMode] = useState<'diversified' | 'max_profit'>('diversified');

  // Comparador de subida de stats en consumibles
  const [statToLevelUp, setStatToLevelUp] = useState<StatFilter>('Fuerza');

  // Cargar datos del mercado y volúmenes
  const refreshData = () => {
    setMarketPrices(getStoredMarketPrices());
    setSalesVolumes(getStoredSalesVolumeMap());
  };

  useEffect(() => {
    refreshData();

    const handlePricesUpdate = () => setMarketPrices(getStoredMarketPrices());
    const handleVolumeUpdate = () => setSalesVolumes(getStoredSalesVolumeMap());

    window.addEventListener('dofus_database_updated', handlePricesUpdate);
    window.addEventListener('dofus_prices_updated', handlePricesUpdate);
    window.addEventListener('dofus_profile_changed', handlePricesUpdate);
    window.addEventListener('dofus_sales_volume_updated', handleVolumeUpdate);

    return () => {
      window.removeEventListener('dofus_database_updated', handlePricesUpdate);
      window.removeEventListener('dofus_prices_updated', handlePricesUpdate);
      window.removeEventListener('dofus_profile_changed', handlePricesUpdate);
      window.removeEventListener('dofus_sales_volume_updated', handleVolumeUpdate);
    };
  }, []);

  // Guardar edición de precio
  const handleSavePrice = async (itemId: number) => {
    const num = parseInt(tempPriceValue.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 0) {
      await saveMarketPrice(itemId, num);
      setMarketPrices(prev => ({ ...prev, [itemId]: num }));
    }
    setEditingPriceId(null);
  };

  // Guardar edición de volumen diario manual
  const handleSaveSales = (itemId: number) => {
    const num = parseInt(tempSalesValue.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 0) {
      saveItemSalesVolume(itemId, {
        sales24h: num,
        avgDailySales: num,
        updatedAt: Date.now()
      });
      setSalesVolumes(getStoredSalesVolumeMap());
    }
    setEditingSalesId(null);
  };

  // Referencia fija de la Turmalina (ID: 15271)
  const tourmalineItem = CHARACTERISTIC_SCROLLS.find(s => s.id === 15271);
  const tourmalinePrice = marketPrices[15271] || 25000; // precio fallback
  const tourmalineRatio = tourmalinePrice / 200; // Kamas por Sebuscalín

  // Preparación y cálculo de pergaminos
  const processedScrolls = useMemo(() => {
    return CHARACTERISTIC_SCROLLS.map(scroll => {
      const price = marketPrices[scroll.id] || 0;
      const vol = salesVolumes[scroll.id];
      const sales24h = vol?.sales24h ?? 0;
      const sales7d = vol?.sales7d ?? 0;
      const avgDailySales = vol?.avgDailySales ?? (sales7d > 0 ? Math.round(sales7d / 7) : sales24h);
      
      // Kamas por Sebuscalín
      const ratio = scroll.sebuscalines > 0 && price > 0 ? Math.round(price / scroll.sebuscalines) : 0;
      
      // Diferencial vs Turmalina
      const vsTourmalinePct = tourmalineRatio > 0 && ratio > 0
        ? Math.round(((ratio - tourmalineRatio) / tourmalineRatio) * 100)
        : 0;

      // Estimación de profit diario: (Ventas diarias estimadas * Precio)
      // Si no hay ventas registradas aún, usamos un peso mínimo para no dejar a 0
      const effectiveDailySales = avgDailySales > 0 ? avgDailySales : (sales24h > 0 ? sales24h : 1);
      const profitDaily = price * effectiveDailySales;

      // Score de prioridad considerando K/Seb y velocidad
      let priorityScore = ratio * (1 + Math.log10(Math.max(1, effectiveDailySales)));
      if (scroll.isSpecial) {
        priorityScore *= 1.15; // bono por alta liquidez
      }

      return {
        ...scroll,
        price,
        sales24h,
        sales7d,
        avgDailySales,
        ratio,
        vsTourmalinePct,
        profitDaily,
        priorityScore
      };
    });
  }, [marketPrices, salesVolumes, tourmalineRatio]);

  // Filtrado y ordenación de pergaminos
  const filteredScrolls = useMemo(() => {
    let list = processedScrolls.filter(s => {
      if (statFilter !== 'Todas') {
        if (s.stat !== statFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.stat.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });

    list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'profitDaily') diff = b.profitDaily - a.profitDaily;
      else if (sortField === 'ratio') diff = b.ratio - a.ratio;
      else if (sortField === 'sales24h') diff = b.sales24h - a.sales24h;
      else if (sortField === 'price') diff = b.price - a.price;
      else if (sortField === 'sebuscalines') diff = a.sebuscalines - b.sebuscalines;
      else if (sortField === 'name') diff = a.name.localeCompare(b.name);
      return sortAsc ? -diff : diff;
    });

    return list;
  }, [processedScrolls, statFilter, searchQuery, sortField, sortAsc]);

  // Métricas destacadas (KPIs)
  const topProfitScroll = useMemo(() => {
    const list = processedScrolls.filter(s => !s.isSpecial && s.price > 0);
    return list.sort((a, b) => b.ratio - a.ratio)[0];
  }, [processedScrolls]);

  const topVolumeScroll = useMemo(() => {
    const list = processedScrolls.filter(s => !s.isSpecial && s.sales24h > 0);
    return list.sort((a, b) => b.sales24h - a.sales24h)[0];
  }, [processedScrolls]);

  const avgMarketRatio = useMemo(() => {
    const valid = processedScrolls.filter(s => s.ratio > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, curr) => acc + curr.ratio, 0);
    return Math.round(sum / valid.length);
  }, [processedScrolls]);

  // -------------------------------------------------------------
  // PESTAÑA 2: CONSUMIBLES DE OFICIOS
  // -------------------------------------------------------------
  const processedConsumables = useMemo(() => {
    return CHARACTERISTIC_CONSUMABLES.map(c => {
      const marketPrice = marketPrices[c.id] || 0;
      
      // Calcular coste de crafteo sumando ingredientes
      let craftCost = 0;
      let missingPrices = false;
      const ingredientsWithPrice = c.ingredients.map(ing => {
        const ingPrice = marketPrices[ing.id] || 0;
        if (ingPrice === 0) missingPrices = true;
        const totalCost = ingPrice * ing.quantity;
        craftCost += totalCost;
        return {
          ...ing,
          unitPrice: ingPrice,
          totalCost
        };
      });

      // Coste de adquisición recomendado (crafteo si es menor que precio mercadillo, o mercadillo directo)
      const effectiveCost = (craftCost > 0 && (marketPrice === 0 || craftCost < marketPrice))
        ? craftCost
        : (marketPrice > 0 ? marketPrice : craftCost);

      const costPerPoint = c.points > 0 ? Math.round(effectiveCost / c.points) : effectiveCost;

      // Pergamino equivalente según el tramo de stat
      let equivalentScrollTier: 'pequeño' | 'mediano' | 'grande' | 'potente' = 'pequeño';
      if (c.maxStatLimit <= 25) equivalentScrollTier = 'pequeño';
      else if (c.maxStatLimit <= 50) equivalentScrollTier = 'mediano';
      else if (c.maxStatLimit <= 80) equivalentScrollTier = 'grande';
      else equivalentScrollTier = 'potente';

      const equivScroll = CHARACTERISTIC_SCROLLS.find(s => s.stat === c.stat && s.tier === equivalentScrollTier);
      const equivScrollPrice = equivScroll ? (marketPrices[equivScroll.id] || 0) : 0;
      const equivScrollCostPerPoint = equivScroll ? (equivScroll.points > 0 ? Math.round(equivScrollPrice / equivScroll.points) : equivScrollPrice) : 0;

      // Ahorro porcentual vs pergamino
      const savingsVsScrollPct = (equivScrollCostPerPoint > 0 && costPerPoint > 0)
        ? Math.round(((equivScrollCostPerPoint - costPerPoint) / equivScrollCostPerPoint) * 100)
        : 0;

      return {
        ...c,
        marketPrice,
        craftCost,
        missingPrices,
        effectiveCost,
        costPerPoint,
        ingredientsWithPrice,
        equivalentScrollTier,
        equivScroll,
        equivScrollPrice,
        equivScrollCostPerPoint,
        savingsVsScrollPct
      };
    });
  }, [marketPrices]);

  const filteredConsumables = useMemo(() => {
    return processedConsumables.filter(c => {
      if (isUserJobsEnabled && !canCraft(c as any)) return false;
      if (statFilter !== 'Todas' && c.stat !== statFilter) return false;
      if (jobFilter !== 'Todos' && c.job !== jobFilter) return false;
      if (limitFilter !== 'todos') {
        const lim = parseInt(limitFilter, 10);
        if (c.maxStatLimit > lim) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesIng = c.ingredients.some(i => i.name.toLowerCase().includes(q));
        if (!matchesName && !matchesIng) return false;
      }
      return true;
    }).sort((a, b) => a.maxStatLimit - b.maxStatLimit || a.costPerPoint - b.costPerPoint);
  }, [processedConsumables, isUserJobsEnabled, canCraft, statFilter, jobFilter, limitFilter, searchQuery]);

  // Simulación de subida de stats (0 a 100) para la estadística seleccionada
  const statProgressionAnalysis = useMemo(() => {
    if (statToLevelUp === 'Todas') return null;

    // Pergaminos para esta estadística
    const pPeq = processedScrolls.find(s => s.stat === statToLevelUp && s.tier === 'pequeño');
    const pMed = processedScrolls.find(s => s.stat === statToLevelUp && s.tier === 'mediano');
    const pGra = processedScrolls.find(s => s.stat === statToLevelUp && s.tier === 'grande');
    const pPot = processedScrolls.find(s => s.stat === statToLevelUp && s.tier === 'potente');

    // Coste subiendo 100% con pergaminos:
    // 25 pequeños (0 a 25)
    // 25 medianos (25 a 50)
    // 30 grandes (50 a 80)
    // 10 potentes de 2 pts (80 a 100)
    const costScrollsOnly =
      (pPeq?.price || 0) * 25 +
      (pMed?.price || 0) * 25 +
      (pGra?.price || 0) * 30 +
      (pPot?.price || 0) * 10;

    // Consumibles disponibles para esta stat
    const statConsumables = processedConsumables
      .filter(c => c.stat === statToLevelUp)
      .sort((a, b) => a.maxStatLimit - b.maxStatLimit || a.costPerPoint - b.costPerPoint);

    // Encontrar el consumible más barato para cada tramo
    const bestConsumable0to25 = statConsumables.find(c => c.maxStatLimit >= 20);
    const bestConsumable25to50 = statConsumables.find(c => c.maxStatLimit >= 45);
    const bestConsumable50to80 = statConsumables.find(c => c.maxStatLimit >= 75);
    const bestConsumable80to100 = statConsumables.find(c => c.maxStatLimit >= 100);

    return {
      stat: statToLevelUp,
      costScrollsOnly,
      pPeq,
      pMed,
      pGra,
      pPot,
      bestConsumable0to25,
      bestConsumable25to50,
      bestConsumable50to80,
      bestConsumable80to100,
    };
  }, [statToLevelUp, processedScrolls, processedConsumables]);

  // Color de badge según estadística
  const getStatBadgeClass = (stat: string) => {
    switch (stat) {
      case 'Fuerza':
        return 'bg-amber-950/60 text-amber-300 border-amber-500/30';
      case 'Vitalidad':
        return 'bg-rose-950/60 text-rose-300 border-rose-500/30';
      case 'Sabiduría':
        return 'bg-purple-950/60 text-purple-300 border-purple-500/30';
      case 'Inteligencia':
        return 'bg-orange-950/60 text-orange-300 border-orange-500/30';
      case 'Suerte':
        return 'bg-sky-950/60 text-sky-300 border-sky-500/30';
      case 'Agilidad':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-teal-950/60 text-teal-300 border-teal-500/30';
    }
  };

  // Cálculo del simulador de sebuscalines
  const simulationResults = useMemo(() => {
    if (!isSimulatorOpen || availableSebuscalines <= 0) return null;

    let remainingSeb = availableSebuscalines;
    const plan: Array<{ scroll: typeof processedScrolls[0]; count: number; costSeb: number; estKamas: number }> = [];

    // Candidatos ordenados por profit / ratio
    const candidates = [...processedScrolls].filter(s => s.price > 0);

    if (simulationMode === 'diversified') {
      // Regla diversificada:
      // 1. Asignar un 25% a Turmalina si es posible (reserva de liquidez rápida)
      if (tourmalineItem && tourmalinePrice > 0 && remainingSeb >= 200) {
        const tourmalineSebTarget = Math.floor(availableSebuscalines * 0.25);
        const count = Math.max(1, Math.floor(tourmalineSebTarget / 200));
        const cost = count * 200;
        if (cost <= remainingSeb) {
          plan.push({
            scroll: processedScrolls.find(s => s.id === 15271)!,
            count,
            costSeb: cost,
            estKamas: count * tourmalinePrice
          });
          remainingSeb -= cost;
        }
      }

      // 2. Repartir el resto entre los 4 mejores pergaminos con límite por pergamino
      // para no saturar el mercado (tope de 10-15 unidades por pergamino según tier)
      const topScrolls = candidates
        .filter(s => !s.isSpecial && s.ratio >= tourmalineRatio * 0.95)
        .sort((a, b) => b.ratio - a.ratio);

      for (const s of topScrolls) {
        if (remainingSeb < s.sebuscalines) continue;
        const maxUnits = s.tier === 'potente' ? 4 : s.tier === 'grande' ? 8 : 15;
        const affordable = Math.floor(remainingSeb / s.sebuscalines);
        const count = Math.min(maxUnits, affordable);
        if (count > 0) {
          const cost = count * s.sebuscalines;
          plan.push({
            scroll: s,
            count,
            costSeb: cost,
            estKamas: count * s.price
          });
          remainingSeb -= cost;
        }
      }

      // 3. Con lo que quede, volcar en el mejor pergamino disponible
      if (remainingSeb > 0) {
        for (const s of candidates.sort((a, b) => b.ratio - a.ratio)) {
          if (remainingSeb >= s.sebuscalines) {
            const count = Math.floor(remainingSeb / s.sebuscalines);
            const cost = count * s.sebuscalines;
            const existing = plan.find(p => p.scroll.id === s.id);
            if (existing) {
              existing.count += count;
              existing.costSeb += cost;
              existing.estKamas += count * s.price;
            } else {
              plan.push({ scroll: s, count, costSeb: cost, estKamas: count * s.price });
            }
            remainingSeb -= cost;
          }
        }
      }
    } else {
      // Modo Max Profit puro: Todo al pergamino con mayor K/Seb
      const sortedByRatio = candidates.sort((a, b) => b.ratio - a.ratio);
      for (const s of sortedByRatio) {
        if (remainingSeb >= s.sebuscalines) {
          const count = Math.floor(remainingSeb / s.sebuscalines);
          const cost = count * s.sebuscalines;
          plan.push({ scroll: s, count, costSeb: cost, estKamas: count * s.price });
          remainingSeb -= cost;
        }
      }
    }

    const totalKamas = plan.reduce((acc, item) => acc + item.estKamas, 0);
    const spentSeb = availableSebuscalines - remainingSeb;
    const globalRatio = spentSeb > 0 ? Math.round(totalKamas / spentSeb) : 0;

    return {
      plan,
      spentSeb,
      remainingSeb,
      totalKamas,
      globalRatio
    };
  }, [isSimulatorOpen, availableSebuscalines, simulationMode, processedScrolls, tourmalinePrice, tourmalineRatio]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── HEADER SUPERIOR ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400">
              <Scroll className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
                Consumibles de Características & Pergaminos
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-medium">
                  Sebuscalines & Recolección
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Rentabilidad diaria de pergaminos, velocidad de mercado y análisis de consumibles de protectores de recursos
              </p>
            </div>
          </div>
        </div>

        {/* Selector de Pestaña Principal */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => { setActiveTab('scrolls'); setSearchQuery(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'scrolls'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Pergaminos & Sebuscalines</span>
            <span className="text-xs px-1.5 py-0.2 rounded bg-black/20 font-mono">25</span>
          </button>

          <button
            onClick={() => { setActiveTab('consumables'); setSearchQuery(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'consumables'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Consumibles de Oficios</span>
            <span className="text-xs px-1.5 py-0.2 rounded bg-black/20 font-mono">83</span>
          </button>
        </div>
      </div>

      {/* ── BARRA DE KPI SUPERIOR ────────────────────────────────────────── */}
      {activeTab === 'scrolls' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Top Profit Scroll */}
          <div className="bg-slate-900/80 border border-slate-800/80 hover:border-amber-500/40 rounded-xl p-4 transition-all shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Award className="w-4 h-4" /> Top Rentabilidad Hoy
              </span>
              <span className="font-mono text-emerald-400">
                +{topProfitScroll?.vsTourmalinePct || 0}% vs Turm.
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <img
                src={getItemIconUrl(topProfitScroll?.iconId || 0)}
                alt={topProfitScroll?.name}
                className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 object-contain"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-100 truncate">
                  {topProfitScroll?.name || 'Cargando...'}
                </div>
                <div className="text-lg font-black text-amber-400 font-mono">
                  {(topProfitScroll?.ratio || 0).toLocaleString()} <span className="text-xs text-slate-400 font-normal">K / Seb</span>
                </div>
              </div>
            </div>
          </div>

          {/* Turmalina Referencia */}
          <div className="bg-slate-900/80 border border-slate-800/80 hover:border-teal-500/40 rounded-xl p-4 transition-all shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-teal-400">
                <Gem className="w-4 h-4" /> Turmalina (Activo Seguro)
              </span>
              <span className="font-mono text-slate-400">200 Seb.</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <img
                src={getItemIconUrl(15271)}
                alt="Turmalina"
                className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 object-contain"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-100 truncate">
                  Turmalina
                </div>
                <div className="text-lg font-black text-teal-300 font-mono">
                  {Math.round(tourmalineRatio).toLocaleString()} <span className="text-xs text-slate-400 font-normal">K / Seb ({tourmalinePrice.toLocaleString()} K)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mayor Volumen 24h */}
          <div className="bg-slate-900/80 border border-slate-800/80 hover:border-sky-500/40 rounded-xl p-4 transition-all shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-sky-400">
                <Flame className="w-4 h-4" /> Mayor Rotación 24h
              </span>
              <span className="font-mono text-sky-300">
                {topVolumeScroll?.sales24h || 0} uds vendidas
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <img
                src={getItemIconUrl(topVolumeScroll?.iconId || 0)}
                alt={topVolumeScroll?.name}
                className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 object-contain"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-100 truncate">
                  {topVolumeScroll?.name || 'Sin datos recientes'}
                </div>
                <div className="text-lg font-black text-slate-200 font-mono">
                  {(topVolumeScroll?.price || 0).toLocaleString()} <span className="text-xs text-slate-400 font-normal">Kamas / ud</span>
                </div>
              </div>
            </div>
          </div>

          {/* Promedio de Mercado */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 transition-all shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-purple-400">
                <BarChart2 className="w-4 h-4" /> Promedio Mercado
              </span>
              <span className="font-mono text-slate-500">24 pergaminos</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-purple-300 font-mono">
                {avgMarketRatio.toLocaleString()} <span className="text-xs text-slate-400 font-normal">Kamas / Sebuscalín</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Vender por encima de esta cifra maximiza el rendimiento de tus sebuscalines
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── BARRA DE FILTROS Y CONTROLES ──────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Selector de Característica */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Stat:
            </span>
            {(['Todas', 'Fuerza', 'Vitalidad', 'Sabiduría', 'Inteligencia', 'Suerte', 'Agilidad'] as StatFilter[]).map(stat => (
              <button
                key={stat}
                onClick={() => setStatFilter(stat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  statFilter === stat
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {stat}
              </button>
            ))}
          </div>

          {/* Buscador de texto */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o ingrediente..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Filtros secundarios específicos de Consumibles */}
        {activeTab === 'consumables' && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800/60">
            {/* Oficio */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Oficio:
              </span>
              {(['Todos', 'Cazador', 'Pescador', 'Campesino', 'Alquimista'] as JobFilter[]).map(job => (
                <button
                  key={job}
                  onClick={() => setJobFilter(job)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                    jobFilter === job
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {job}
                </button>
              ))}
            </div>

            {/* Límite de Stat */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Límite de Stat:
              </span>
              {[
                { id: 'todos', label: 'Todos' },
                { id: '25', label: '≤ 25 (Pequeño)' },
                { id: '50', label: '≤ 50 (Mediano)' },
                { id: '80', label: '≤ 80 (Grande)' },
                { id: '100', label: '≤ 100 (Potente)' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setLimitFilter(opt.id)}
                  className={`px-2 py-0.8 rounded text-xs font-mono transition-all border ${
                    limitFilter === opt.id
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN SIMULADOR DE CANJE (DESPLEGABLE) ─────────────────────── */}
      {activeTab === 'scrolls' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setIsSimulatorOpen(prev => !prev)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
                  Simulador de Canje Inteligente por Sebuscalines
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Opcional
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reparte una bolsa de sebuscalines sin saturar el mercadillo ni desplomar los precios
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-xs font-semibold">{isSimulatorOpen ? 'Ocultar simulador' : 'Abrir simulador'}</span>
              {isSimulatorOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isSimulatorOpen && (
            <div className="p-5 border-t border-slate-800 bg-slate-950/60 space-y-4 animate-fadeIn">
              <div className="flex flex-wrap items-center gap-4 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Sebuscalines disponibles a canjear:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={20}
                      min={20}
                      value={availableSebuscalines}
                      onChange={e => setAvailableSebuscalines(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full pl-3 pr-24 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      Sebuscalines
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 block mb-1">Estrategia:</span>
                  <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                    <button
                      onClick={() => setSimulationMode('diversified')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        simulationMode === 'diversified'
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🛡️ Diversificado (Antidevaluación)
                    </button>
                    <button
                      onClick={() => setSimulationMode('max_profit')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        simulationMode === 'max_profit'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ⚡ Máxima Rentabilidad Pura
                    </button>
                  </div>
                </div>
              </div>

              {simulationResults && simulationResults.plan.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Total Kamas Estimadas:</div>
                      <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                        {simulationResults.totalKamas.toLocaleString()} K
                      </div>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Sebuscalines Utilizados:</div>
                      <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                        {simulationResults.spentSeb.toLocaleString()} / {availableSebuscalines.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Rendimiento Promedio Canje:</div>
                      <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
                        {simulationResults.globalRatio.toLocaleString()} K / Seb
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Ítem Recomendado</th>
                          <th className="py-2.5 px-3 text-center">Unidades</th>
                          <th className="py-2.5 px-3 text-right">Coste Seb.</th>
                          <th className="py-2.5 px-3 text-right">Precio Ud.</th>
                          <th className="py-2.5 px-3 text-right">Ratio K/Seb</th>
                          <th className="py-2.5 px-3 text-right font-bold text-emerald-400">Kamas Estimadas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {simulationResults.plan.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 font-sans flex items-center gap-2 text-slate-200">
                              <img
                                src={getItemIconUrl(item.scroll.iconId)}
                                alt={item.scroll.name}
                                className="w-6 h-6 object-contain"
                              />
                              <span className="font-semibold">{item.scroll.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border ${getStatBadgeClass(item.scroll.stat)}`}>
                                {item.scroll.stat}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-300">
                              {item.count}x
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">
                              {item.costSeb.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">
                              {item.scroll.price.toLocaleString()} K
                            </td>
                            <td className="py-2.5 px-3 text-right text-purple-300 font-bold">
                              {item.scroll.ratio.toLocaleString()} K/s
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                              {item.estKamas.toLocaleString()} K
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Ingresa una cantidad de sebuscalines para ver la distribución recomendada.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PESTAÑA 1: TABLA PRINCIPAL DE PERGAMINOS ──────────────────────── */}
      {activeTab === 'scrolls' && (
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-200">
                Ranking de Rentabilidad y Salida de Pergaminos
              </h2>
              <span className="text-xs text-slate-500 font-mono">({filteredScrolls.length} ítems)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5 text-amber-500" />
              <span>Haz clic en un precio o venta para editarlo directamente</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">
                    <button
                      onClick={() => { setSortField('name'); setSortAsc(!sortAsc); }}
                      className="flex items-center gap-1 hover:text-slate-200"
                    >
                      Pergamino / Recurso <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center">Stat & Límite</th>
                  <th className="py-3 px-3 text-right">
                    <button
                      onClick={() => { setSortField('sebuscalines'); setSortAsc(!sortAsc); }}
                      className="flex items-center gap-1 ml-auto hover:text-slate-200"
                    >
                      Coste Seb. <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      onClick={() => { setSortField('price'); setSortAsc(!sortAsc); }}
                      className="flex items-center gap-1 ml-auto hover:text-slate-200"
                    >
                      Precio Mercadillo <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      onClick={() => { setSortField('ratio'); setSortAsc(!sortAsc); }}
                      className="flex items-center gap-1 ml-auto text-amber-400 font-bold hover:text-amber-300"
                    >
                      Kamas / Seb. <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center">vs Turmalina</th>
                  <th className="py-3 px-3 text-center">
                    <button
                      onClick={() => { setSortField('sales24h'); setSortAsc(!sortAsc); }}
                      className="flex items-center gap-1 mx-auto hover:text-slate-200"
                    >
                      Ventas 24h / 7d <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      onClick={() => { setSortField('profitDaily'); setSortAsc(!sortAsc); }}
                      className="flex items-center gap-1 ml-auto text-emerald-400 font-bold hover:text-emerald-300"
                    >
                      Profit Diario Est. <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredScrolls.map((scroll, index) => {
                  const isTopRatio = topProfitScroll && scroll.id === topProfitScroll.id;
                  const isTopVolume = topVolumeScroll && scroll.id === topVolumeScroll.id;

                  return (
                    <tr
                      key={scroll.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        scroll.isSpecial ? 'bg-teal-950/20' : ''
                      }`}
                    >
                      {/* Ítem y nombre */}
                      <td className="py-3 px-4 flex items-center gap-3">
                        <span className="text-slate-600 font-mono text-[11px] w-5 text-right">
                          #{index + 1}
                        </span>
                        <img
                          src={getItemIconUrl(scroll.iconId)}
                          alt={scroll.name}
                          className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 object-contain"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                            {scroll.name}
                            {scroll.isSpecial && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                Especial
                              </span>
                            )}
                            {isTopRatio && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                🥇 Max K/Seb
                              </span>
                            )}
                            {isTopVolume && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                                ⚡ Max Salida
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 capitalize">
                            Tier: {scroll.tier} • ID: {scroll.id}
                          </div>
                        </div>
                      </td>

                      {/* Stat & Límite */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatBadgeClass(scroll.stat)}`}>
                          {scroll.stat} {scroll.maxStatLimit > 0 ? `(≤ ${scroll.maxStatLimit})` : ''}
                        </span>
                      </td>

                      {/* Coste Sebuscalines */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-300">
                        {scroll.sebuscalines.toLocaleString()} <span className="text-[10px] text-slate-500">Seb</span>
                      </td>

                      {/* Precio Mercadillo (Editable) */}
                      <td className="py-3 px-3 text-right">
                        {editingPriceId === scroll.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={tempPriceValue}
                              onChange={e => setTempPriceValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSavePrice(scroll.id);
                                if (e.key === 'Escape') setEditingPriceId(null);
                              }}
                              className="w-24 px-1.5 py-1 text-right rounded bg-slate-950 border border-amber-500 text-xs font-mono font-bold text-slate-100"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSavePrice(scroll.id)}
                              className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPriceId(null)}
                              className="p-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingPriceId(scroll.id);
                              setTempPriceValue(String(scroll.price || ''));
                            }}
                            className="cursor-pointer group flex items-center justify-end gap-1 text-slate-200 hover:text-amber-400 transition-colors"
                            title="Haz clic para modificar el precio"
                          >
                            <span className="font-mono font-bold">
                              {scroll.price > 0 ? `${scroll.price.toLocaleString()} K` : 'Sin precio'}
                            </span>
                            <Edit2 className="w-3 h-3 text-slate-600 group-hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* Ratio Kamas / Sebuscalín */}
                      <td className="py-3 px-3 text-right font-mono font-black text-sm">
                        <span className={
                          scroll.ratio >= tourmalineRatio * 1.1
                            ? 'text-emerald-400'
                            : scroll.ratio >= tourmalineRatio
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }>
                          {scroll.ratio.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">K/s</span>
                        </span>
                      </td>

                      {/* Comparativa vs Turmalina */}
                      <td className="py-3 px-3 text-center font-mono text-xs">
                        {scroll.isSpecial ? (
                          <span className="text-teal-400 font-bold">Referencia</span>
                        ) : scroll.vsTourmalinePct > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                            +{scroll.vsTourmalinePct}%
                          </span>
                        ) : scroll.vsTourmalinePct < 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                            {scroll.vsTourmalinePct}%
                          </span>
                        ) : (
                          <span className="text-slate-500">0%</span>
                        )}
                      </td>

                      {/* Ventas 24h / 7d (Editable) */}
                      <td className="py-3 px-3 text-center font-mono">
                        {editingSalesId === scroll.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              value={tempSalesValue}
                              onChange={e => setTempSalesValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveSales(scroll.id);
                                if (e.key === 'Escape') setEditingSalesId(null);
                              }}
                              className="w-16 px-1.5 py-1 text-center rounded bg-slate-950 border border-sky-500 text-xs font-mono font-bold text-slate-100"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveSales(scroll.id)}
                              className="p-1 rounded bg-emerald-500/20 text-emerald-400"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingSalesId(scroll.id);
                              setTempSalesValue(String(scroll.sales24h || scroll.avgDailySales || ''));
                            }}
                            className="cursor-pointer group flex items-center justify-center gap-1 hover:text-sky-400 transition-colors"
                            title="Ventas 24h / 7d registradas. Clic para ajustar estimación manual."
                          >
                            <span className="font-bold text-slate-300">
                              {scroll.sales24h}
                            </span>
                            <span className="text-slate-600">/</span>
                            <span className="text-slate-500 text-[11px]">
                              {scroll.sales7d}
                            </span>
                            <Edit2 className="w-2.5 h-2.5 text-slate-600 group-hover:text-sky-400 opacity-0 group-hover:opacity-100" />
                          </div>
                        )}
                      </td>

                      {/* Profit Diario Estimado */}
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-xs">
                        {scroll.profitDaily > 0 ? (
                          `${scroll.profitDaily.toLocaleString()} K`
                        ) : (
                          <span className="text-slate-600">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PESTAÑA 2: CONSUMIBLES DE OFICIOS DE RECOLECCIÓN ─────────────── */}
      {activeTab === 'consumables' && (
        <div className="space-y-6">
          {/* Comparador de Tramos (0 a 100 de stat) */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black text-slate-100">
                    Comparador de Vías: Pergaminos vs Consumibles de Oficio (0 a 100)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Evalúa si te conviene subir la característica con comida/pociones de protectores o con pergaminos
                  </p>
                </div>
              </div>

              {/* Selector de Stat a subir */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Característica:</span>
                <select
                  value={statToLevelUp}
                  onChange={e => setStatToLevelUp(e.target.value as StatFilter)}
                  className="bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  {(['Fuerza', 'Vitalidad', 'Sabiduría', 'Inteligencia', 'Suerte', 'Agilidad'] as StatFilter[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {statProgressionAnalysis && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
                {/* Tramo 0-25 */}
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 font-sans">Tramo 0 a 25</span>
                    <span className="text-[10px] text-slate-500">25 pts</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Perg. Pequeño:</span>
                      <span className="font-bold">{((statProgressionAnalysis.pPeq?.price || 0) * 25).toLocaleString()} K</span>
                    </div>
                    {statProgressionAnalysis.bestConsumable0to25 && (
                      <div className="flex justify-between text-emerald-400">
                        <span className="truncate max-w-[110px]" title={statProgressionAnalysis.bestConsumable0to25.name}>
                          {statProgressionAnalysis.bestConsumable0to25.name}:
                        </span>
                        <span className="font-bold">
                          {(statProgressionAnalysis.bestConsumable0to25.costPerPoint * 25).toLocaleString()} K
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tramo 25-50 */}
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 font-sans">Tramo 25 a 50</span>
                    <span className="text-[10px] text-slate-500">25 pts</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Perg. Mediano:</span>
                      <span className="font-bold">{((statProgressionAnalysis.pMed?.price || 0) * 25).toLocaleString()} K</span>
                    </div>
                    {statProgressionAnalysis.bestConsumable25to50 && (
                      <div className="flex justify-between text-emerald-400">
                        <span className="truncate max-w-[110px]" title={statProgressionAnalysis.bestConsumable25to50.name}>
                          {statProgressionAnalysis.bestConsumable25to50.name}:
                        </span>
                        <span className="font-bold">
                          {(statProgressionAnalysis.bestConsumable25to50.costPerPoint * 25).toLocaleString()} K
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tramo 50-80 */}
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 font-sans">Tramo 50 a 80</span>
                    <span className="text-[10px] text-slate-500">30 pts</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Perg. Grande:</span>
                      <span className="font-bold">{((statProgressionAnalysis.pGra?.price || 0) * 30).toLocaleString()} K</span>
                    </div>
                    {statProgressionAnalysis.bestConsumable50to80 && (
                      <div className="flex justify-between text-emerald-400">
                        <span className="truncate max-w-[110px]" title={statProgressionAnalysis.bestConsumable50to80.name}>
                          {statProgressionAnalysis.bestConsumable50to80.name}:
                        </span>
                        <span className="font-bold">
                          {(statProgressionAnalysis.bestConsumable50to80.costPerPoint * 30).toLocaleString()} K
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tramo 80-100 */}
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 font-sans">Tramo 80 a 100</span>
                    <span className="text-[10px] text-slate-500">20 pts</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Perg. Potente (x10):</span>
                      <span className="font-bold">{((statProgressionAnalysis.pPot?.price || 0) * 10).toLocaleString()} K</span>
                    </div>
                    {statProgressionAnalysis.bestConsumable80to100 && (
                      <div className="flex justify-between text-emerald-400">
                        <span className="truncate max-w-[110px]" title={statProgressionAnalysis.bestConsumable80to100.name}>
                          {statProgressionAnalysis.bestConsumable80to100.name}:
                        </span>
                        <span className="font-bold">
                          {(statProgressionAnalysis.bestConsumable80to100.costPerPoint * 20).toLocaleString()} K
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isUserJobsEnabled && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium">
              <Briefcase className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Filtro activo: Mostrando únicamente consumibles que tus oficios pueden recolectar y preparar.</span>
            </div>
          )}

          {/* Listado de los 83 Consumibles Verificados */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-200">
                  Consumibles de Recolección con Recursos Raros de Protectores
                </h2>
                <span className="text-xs text-slate-500 font-mono">({filteredConsumables.length} consumibles encontrados)</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Consumible</th>
                    <th className="py-3 px-3">Oficio</th>
                    <th className="py-3 px-3 text-center">Stat & Límite</th>
                    <th className="py-3 px-4">Ingredientes de la Receta</th>
                    <th className="py-3 px-3 text-right">Coste Crafteo</th>
                    <th className="py-3 px-3 text-right">Precio Mercado</th>
                    <th className="py-3 px-3 text-right font-bold text-emerald-400">Coste / Punto</th>
                    <th className="py-3 px-4 text-center">vs Pergamino Tramo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredConsumables.map((consumable) => {
                    return (
                      <tr key={consumable.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Consumible */}
                        <td className="py-3 px-4 flex items-center gap-3">
                          <img
                            src={getItemIconUrl(consumable.iconId)}
                            alt={consumable.name}
                            className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 object-contain"
                          />
                          <div>
                            <div className="font-bold text-slate-200 text-xs">{consumable.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Nivel {consumable.level} • ID: {consumable.id}
                            </div>
                          </div>
                        </td>

                        {/* Oficio */}
                        <td className="py-3 px-3 font-semibold text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                            {consumable.job}
                          </span>
                        </td>

                        {/* Stat & Límite */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatBadgeClass(consumable.stat)}`}>
                              +{consumable.points} {consumable.stat}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono font-medium">
                              {consumable.criterions ? consumable.criterions.toUpperCase() : `Hasta ${consumable.maxStatLimit}`}
                            </span>
                          </div>
                        </td>

                        {/* Ingredientes de la Receta */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-[340px]">
                            {consumable.ingredientsWithPrice.map((ing, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                                title={`${ing.name} (x${ing.quantity}) - Coste unitario: ${ing.unitPrice.toLocaleString()} K`}
                              >
                                <span className="font-bold text-amber-400">{ing.quantity}x</span>
                                <span className="truncate max-w-[110px]">{ing.name}</span>
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Coste Crafteo */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-300">
                          {consumable.craftCost > 0 ? (
                            `${consumable.craftCost.toLocaleString()} K`
                          ) : (
                            <span className="text-slate-600 font-normal">--</span>
                          )}
                        </td>

                        {/* Precio Mercado */}
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {consumable.marketPrice > 0 ? (
                            `${consumable.marketPrice.toLocaleString()} K`
                          ) : (
                            <span className="text-slate-600">--</span>
                          )}
                        </td>

                        {/* Coste por Punto */}
                        <td className="py-3 px-3 text-right font-mono font-black text-sm text-emerald-400">
                          {consumable.costPerPoint > 0 ? (
                            `${consumable.costPerPoint.toLocaleString()} K`
                          ) : (
                            <span className="text-slate-600">--</span>
                          )}
                        </td>

                        {/* Comparativa vs Pergamino */}
                        <td className="py-3 px-4 text-center font-mono text-xs">
                          {consumable.equivScrollCostPerPoint > 0 && consumable.costPerPoint > 0 ? (
                            consumable.savingsVsScrollPct > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                                Ahorras {consumable.savingsVsScrollPct}%
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                +{Math.abs(consumable.savingsVsScrollPct)}% vs perg.
                              </span>
                            )
                          ) : (
                            <span className="text-slate-600">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

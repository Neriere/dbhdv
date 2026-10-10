import { useState, useEffect, useMemo } from 'react';
import { useUserJobs } from '../../hooks/useUserJobs';
import {
  CHARACTERISTIC_SCROLLS,
  CHARACTERISTIC_CONSUMABLES,
  CharacteristicScrollItem,
} from '../../data/characteristicConsumablesData';
import {
  getStoredMarketPrices,
  saveMarketPrice,
} from '../../services/dofusDbService';
import {
  getStoredSalesVolumeMap,
  analyzeSalesVolume,
} from '../../services/salesVolumeService';
import { MarketPriceMap, SalesVolumeMap } from '../../types';
import {
  MainTab,
  StatFilter,
  JobFilter,
  SortFieldScroll,
  ProcessedScrollItem,
  ProcessedConsumableItem,
  SimulationResult,
} from './types';

export function useConsumablesView() {
  const { isEnabled: isUserJobsEnabled, canCraft } = useUserJobs();
  const [activeTab, setActiveTab] = useState<MainTab>('scrolls');
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [salesVolumes, setSalesVolumes] = useState<SalesVolumeMap>({});
  const [statFilter, setStatFilter] = useState<StatFilter>('Todas');
  const [jobFilter, setJobFilter] = useState<JobFilter>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [limitFilter, setLimitFilter] = useState<string>('todos');

  // Inline price editing & sales volume modal
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');
  const [scrollForSalesVolume, setScrollForSalesVolume] =
    useState<CharacteristicScrollItem | null>(null);

  // Sorting for scrolls table
  const [sortField, setSortField] = useState<SortFieldScroll>('profitDaily');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Sebuscalines simulator
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [availableSebuscalines, setAvailableSebuscalines] = useState<number>(5000);
  const [simulationMode, setSimulationMode] = useState<
    'diversified' | 'max_profit'
  >('diversified');

  // Stats comparison
  const [statToLevelUp, setStatToLevelUp] = useState<StatFilter>('Fuerza');

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

  const handleSavePrice = async (itemId: number) => {
    const num = parseInt(tempPriceValue.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 0) {
      await saveMarketPrice(itemId, num);
      setMarketPrices((prev) => ({ ...prev, [itemId]: num }));
    }
    setEditingPriceId(null);
  };

  const tourmalineItem = CHARACTERISTIC_SCROLLS.find((s) => s.id === 15271);
  const tourmalinePrice = marketPrices[15271] || 25000;
  const tourmalineRatio = tourmalinePrice / 200;

  // Processed scrolls
  const processedScrolls = useMemo<ProcessedScrollItem[]>(() => {
    return CHARACTERISTIC_SCROLLS.map((scroll) => {
      const price = marketPrices[scroll.id] || 0;
      const vol = salesVolumes[scroll.id];
      const analysis = analyzeSalesVolume(price, vol);
      const sales24h = analysis.sales24h;
      const sales7d = analysis.sales7d;
      const sales30d = analysis.sales30d;
      const avgDailySales = analysis.avgDailySales;

      const ratio =
        scroll.sebuscalines > 0 && price > 0
          ? Math.round(price / scroll.sebuscalines)
          : 0;

      const vsTourmalinePct =
        tourmalineRatio > 0 && ratio > 0
          ? Math.round(((ratio - tourmalineRatio) / tourmalineRatio) * 100)
          : 0;

      const profitDaily =
        avgDailySales > 0 ? Math.round(price * avgDailySales) : 0;

      const effectiveVelocity =
        avgDailySales > 0 ? avgDailySales : sales24h > 0 ? sales24h : 0.1;
      let priorityScore = ratio * (1 + Math.log10(Math.max(1, effectiveVelocity)));
      if (scroll.isSpecial) {
        priorityScore *= 1.15;
      }

      return {
        ...scroll,
        price,
        sales24h,
        sales7d,
        sales30d,
        avgDailySales,
        ratio,
        vsTourmalinePct,
        profitDaily,
        priorityScore,
      };
    });
  }, [marketPrices, salesVolumes, tourmalineRatio]);

  // Filtered scrolls
  const filteredScrolls = useMemo(() => {
    const list = processedScrolls.filter((s) => {
      if (statFilter !== 'Todas') {
        if (s.stat !== statFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.stat.toLowerCase().includes(q)
        ) {
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
      else if (sortField === 'avgDailySales')
        diff = b.avgDailySales - a.avgDailySales;
      else if (sortField === 'price') diff = b.price - a.price;
      else if (sortField === 'sebuscalines')
        diff = a.sebuscalines - b.sebuscalines;
      else if (sortField === 'name') diff = a.name.localeCompare(b.name);
      return sortAsc ? -diff : diff;
    });

    return list;
  }, [processedScrolls, statFilter, searchQuery, sortField, sortAsc]);

  // KPIs
  const topProfitScroll = useMemo(() => {
    const list = processedScrolls.filter((s) => !s.isSpecial && s.price > 0);
    return list.sort((a, b) => b.ratio - a.ratio)[0];
  }, [processedScrolls]);

  const topVolumeScroll = useMemo(() => {
    const list = processedScrolls.filter(
      (s) => !s.isSpecial && (s.sales24h > 0 || s.avgDailySales > 0)
    );
    return list.sort(
      (a, b) => (b.sales24h || b.avgDailySales) - (a.sales24h || a.avgDailySales)
    )[0];
  }, [processedScrolls]);

  const avgMarketRatio = useMemo(() => {
    const valid = processedScrolls.filter((s) => s.ratio > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, curr) => acc + curr.ratio, 0);
    return Math.round(sum / valid.length);
  }, [processedScrolls]);

  // Processed consumables
  const processedConsumables = useMemo<ProcessedConsumableItem[]>(() => {
    return CHARACTERISTIC_CONSUMABLES.map((c) => {
      const marketPrice = marketPrices[c.id] || 0;

      let craftCost = 0;
      let missingPrices = false;
      const ingredientsWithPrice = c.ingredients.map((ing) => {
        const ingPrice = marketPrices[ing.id] || 0;
        if (ingPrice === 0) missingPrices = true;
        const totalCost = ingPrice * ing.quantity;
        craftCost += totalCost;
        return {
          ...ing,
          unitPrice: ingPrice,
          totalCost,
        };
      });

      const effectiveCost =
        craftCost > 0 && (marketPrice === 0 || craftCost < marketPrice)
          ? craftCost
          : marketPrice > 0
          ? marketPrice
          : craftCost;

      const costPerPoint =
        c.points > 0 ? Math.round(effectiveCost / c.points) : effectiveCost;

      let equivalentScrollTier: 'pequeño' | 'mediano' | 'grande' | 'potente' =
        'pequeño';
      if (c.maxStatLimit <= 25) equivalentScrollTier = 'pequeño';
      else if (c.maxStatLimit <= 50) equivalentScrollTier = 'mediano';
      else if (c.maxStatLimit <= 80) equivalentScrollTier = 'grande';
      else equivalentScrollTier = 'potente';

      const equivScroll = CHARACTERISTIC_SCROLLS.find(
        (s) => s.stat === c.stat && s.tier === equivalentScrollTier
      );
      const equivScrollPrice = equivScroll
        ? marketPrices[equivScroll.id] || 0
        : 0;
      const equivScrollCostPerPoint = equivScroll
        ? equivScroll.points > 0
          ? Math.round(equivScrollPrice / equivScroll.points)
          : equivScrollPrice
        : 0;

      const savingsVsScrollPct =
        equivScrollCostPerPoint > 0 && costPerPoint > 0
          ? Math.round(
              ((equivScrollCostPerPoint - costPerPoint) /
                equivScrollCostPerPoint) *
                100
            )
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
        savingsVsScrollPct,
      };
    });
  }, [marketPrices]);

  const filteredConsumables = useMemo(() => {
    return processedConsumables
      .filter((c) => {
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
          const matchesIng = c.ingredients.some((i) =>
            i.name.toLowerCase().includes(q)
          );
          if (!matchesName && !matchesIng) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.maxStatLimit - b.maxStatLimit || a.costPerPoint - b.costPerPoint
      );
  }, [
    processedConsumables,
    isUserJobsEnabled,
    canCraft,
    statFilter,
    jobFilter,
    limitFilter,
    searchQuery,
  ]);

  // Stat progression analysis (0 to 100)
  const statProgressionAnalysis = useMemo(() => {
    if (statToLevelUp === 'Todas') return null;

    const pPeq = processedScrolls.find(
      (s) => s.stat === statToLevelUp && s.tier === 'pequeño'
    );
    const pMed = processedScrolls.find(
      (s) => s.stat === statToLevelUp && s.tier === 'mediano'
    );
    const pGra = processedScrolls.find(
      (s) => s.stat === statToLevelUp && s.tier === 'grande'
    );
    const pPot = processedScrolls.find(
      (s) => s.stat === statToLevelUp && s.tier === 'potente'
    );

    const costScrollsOnly =
      (pPeq?.price || 0) * 25 +
      (pMed?.price || 0) * 25 +
      (pGra?.price || 0) * 30 +
      (pPot?.price || 0) * 10;

    const statConsumables = processedConsumables
      .filter((c) => c.stat === statToLevelUp)
      .sort(
        (a, b) =>
          a.maxStatLimit - b.maxStatLimit || a.costPerPoint - b.costPerPoint
      );

    const bestConsumable0to25 = statConsumables.find(
      (c) => c.maxStatLimit >= 20
    );
    const bestConsumable25to50 = statConsumables.find(
      (c) => c.maxStatLimit >= 45
    );
    const bestConsumable50to80 = statConsumables.find(
      (c) => c.maxStatLimit >= 75
    );
    const bestConsumable80to100 = statConsumables.find(
      (c) => c.maxStatLimit >= 100
    );

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

  // Sebuscalines simulator results
  const simulationResults = useMemo<SimulationResult | null>(() => {
    if (!isSimulatorOpen || availableSebuscalines <= 0) return null;

    let remainingSeb = availableSebuscalines;
    const plan: SimulationResult['plan'] = [];

    const candidates = [...processedScrolls].filter((s) => s.price > 0);

    if (simulationMode === 'diversified') {
      if (tourmalineItem && tourmalinePrice > 0 && remainingSeb >= 200) {
        const tourmalineSebTarget = Math.floor(availableSebuscalines * 0.25);
        const count = Math.max(1, Math.floor(tourmalineSebTarget / 200));
        const cost = count * 200;
        if (cost <= remainingSeb) {
          plan.push({
            scroll: processedScrolls.find((s) => s.id === 15271)!,
            count,
            costSeb: cost,
            estKamas: count * tourmalinePrice,
          });
          remainingSeb -= cost;
        }
      }

      const topScrolls = candidates
        .filter((s) => !s.isSpecial && s.ratio >= tourmalineRatio * 0.95)
        .sort((a, b) => b.ratio - a.ratio);

      for (const s of topScrolls) {
        if (remainingSeb < s.sebuscalines) continue;
        const maxUnits =
          s.tier === 'potente' ? 4 : s.tier === 'grande' ? 8 : 15;
        const affordable = Math.floor(remainingSeb / s.sebuscalines);
        const count = Math.min(maxUnits, affordable);
        if (count > 0) {
          const cost = count * s.sebuscalines;
          plan.push({
            scroll: s,
            count,
            costSeb: cost,
            estKamas: count * s.price,
          });
          remainingSeb -= cost;
        }
      }

      if (remainingSeb > 0) {
        for (const s of candidates.sort((a, b) => b.ratio - a.ratio)) {
          if (remainingSeb >= s.sebuscalines) {
            const count = Math.floor(remainingSeb / s.sebuscalines);
            const cost = count * s.sebuscalines;
            const existing = plan.find((p) => p.scroll.id === s.id);
            if (existing) {
              existing.count += count;
              existing.costSeb += cost;
              existing.estKamas += count * s.price;
            } else {
              plan.push({
                scroll: s,
                count,
                costSeb: cost,
                estKamas: count * s.price,
              });
            }
            remainingSeb -= cost;
          }
        }
      }
    } else {
      const sortedByRatio = candidates.sort((a, b) => b.ratio - a.ratio);
      for (const s of sortedByRatio) {
        if (remainingSeb >= s.sebuscalines) {
          const count = Math.floor(remainingSeb / s.sebuscalines);
          const cost = count * s.sebuscalines;
          plan.push({
            scroll: s,
            count,
            costSeb: cost,
            estKamas: count * s.price,
          });
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
      globalRatio,
    };
  }, [
    isSimulatorOpen,
    availableSebuscalines,
    simulationMode,
    processedScrolls,
    tourmalineItem,
    tourmalinePrice,
    tourmalineRatio,
  ]);

  return {
    isUserJobsEnabled,
    activeTab,
    setActiveTab,
    marketPrices,
    salesVolumes,
    statFilter,
    setStatFilter,
    jobFilter,
    setJobFilter,
    searchQuery,
    setSearchQuery,
    limitFilter,
    setLimitFilter,
    editingPriceId,
    setEditingPriceId,
    tempPriceValue,
    setTempPriceValue,
    scrollForSalesVolume,
    setScrollForSalesVolume,
    sortField,
    setSortField,
    sortAsc,
    setSortAsc,
    isSimulatorOpen,
    setIsSimulatorOpen,
    availableSebuscalines,
    setAvailableSebuscalines,
    simulationMode,
    setSimulationMode,
    statToLevelUp,
    setStatToLevelUp,
    tourmalineItem,
    tourmalinePrice,
    tourmalineRatio,
    processedScrolls,
    filteredScrolls,
    topProfitScroll,
    topVolumeScroll,
    avgMarketRatio,
    processedConsumables,
    filteredConsumables,
    statProgressionAnalysis,
    simulationResults,
    handleSavePrice,
    refreshData,
  };
}

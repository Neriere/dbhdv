import { useState, useEffect, useMemo } from 'react';
import {
  LEGENDARY_HUNTS,
  LegendaryHuntInfo,
} from '../../data/legendaryHuntsData';
import { getRelatedEquipmentForHunt } from '../../data/bycEquipmentData';
import { addToShoppingListById } from '../../services/dofusDbService';
import { resolveServerSlug } from '../../data/dofusRuneWeights';
import { useMarketPrices } from '../../hooks/useMarketPrices';
import { useBankInventory } from '../../hooks/useBankInventory';
import {
  getStoredSebuscalinPrice,
  SEBUSCALIN_STORAGE_KEY,
} from '../../services/bycCostService';
import { CalculatedHunt, CalculatedBycEquipment } from './types';

export function useTreasureHuntCalculator() {
  const { marketPrices, updatePrice } = useMarketPrices();
  const { bankInventory, getBankQty } = useBankInventory();

  // Unit rate for Sebuscalines
  const [sebuscalinPrice, setSebuscalinPrice] = useState<number>(() => {
    return getStoredSebuscalinPrice();
  });

  useEffect(() => {
    const handleProfileChange = (e: any) => {
      const slug = e?.detail?.profile?.slug;
      const newPrice = getStoredSebuscalinPrice(slug);
      setSebuscalinPrice(newPrice);
      setTempSebuscalin(String(newPrice));
      setPriceDrafts({});
    };
    window.addEventListener('dofus_profile_changed', handleProfileChange);
    return () => {
      window.removeEventListener('dofus_profile_changed', handleProfileChange);
    };
  }, []);

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<
    | 'profit_desc'
    | 'craft_profit_desc'
    | 'roi_desc'
    | 'hunt_vs_buy'
    | 'sebuscalines_desc'
    | 'cost_asc'
    | 'level_desc'
  >('profit_desc');

  // Selected Hunt Modal for deep fragment management
  const [selectedHuntForDetail, setSelectedHuntForDetail] =
    useState<LegendaryHuntInfo | null>(null);

  // Active equipment tab per hunt
  const [selectedEquipmentTab, setSelectedEquipmentTab] = useState<
    Record<number, number>
  >({});

  // Direct Inline Price Drafts
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const handlePriceDraftChange = (itemId: number, rawVal: string) => {
    setPriceDrafts((prev) => ({ ...prev, [itemId]: rawVal }));
  };

  const handlePriceCommit = (itemId: number, rawVal: string) => {
    const parsed = Math.max(0, parseInt(rawVal.replace(/\D/g, ''), 10) || 0);
    void updatePrice(itemId, parsed);
    setPriceDrafts((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  // Rate config modal
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [tempSebuscalin, setTempSebuscalin] = useState(String(sebuscalinPrice));

  // Success toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveRates = () => {
    const s = Math.max(1, Number(tempSebuscalin) || 25);
    setSebuscalinPrice(s);

    if (typeof window !== 'undefined') {
      const slug = resolveServerSlug();
      localStorage.setItem(`dofus_sebuscalin_unit_price_${slug}`, String(s));
      localStorage.setItem(SEBUSCALIN_STORAGE_KEY, String(s));
    }
    setIsRatesModalOpen(false);
    showToast('¡Precio de Sebuscalines actualizado!');
  };

  // Helper to get effective price for an item
  const getPrice = (itemId: number, defaultFallback: number) => {
    if (typeof marketPrices[itemId] === 'number' && marketPrices[itemId] > 0) {
      return marketPrices[itemId];
    }
    return defaultFallback;
  };

  // Calculations for all hunts
  const calculatedHunts = useMemo<CalculatedHunt[]>(() => {
    return LEGENDARY_HUNTS.map((hunt) => {
      const wholeMapPrice = getPrice(
        hunt.mapItem.id,
        hunt.mapItem.defaultPrice
      );

      // Calculate fragments total cost
      let fragmentsTotal = 0;
      let bankFragmentsCount = 0;

      for (const fId of hunt.fragments.fragmentIds) {
        const fPrice = getPrice(fId, hunt.fragments.defaultUnitPrice);
        fragmentsTotal += fPrice;
        const inBank = getBankQty(fId);
        if (inBank > 0) {
          bankFragmentsCount++;
        }
      }

      // Best entry cost: is it cheaper to buy the full map or buy fragments?
      const isFragmentsCheaper = fragmentsTotal < wholeMapPrice;
      const bestEntryCost = Math.min(wholeMapPrice, fragmentsTotal);
      const entryMethodSavings = Math.abs(wholeMapPrice - fragmentsTotal);

      // Reward values
      const resourcePrice = getPrice(
        hunt.resource.id,
        hunt.resource.defaultPrice
      );
      const sebuscalinesValue = hunt.sebuscalines * sebuscalinPrice;

      const totalRewardValue = resourcePrice + sebuscalinesValue;
      const netProfit = totalRewardValue - bestEntryCost;
      const roiPercent =
        bestEntryCost > 0 ? (netProfit / bestEntryCost) * 100 : 0;

      // Comparison: Hunt vs Buy Resource directly in HDV
      const huntVsBuyBenefit = resourcePrice - bestEntryCost;

      // Calculate Related Craftable Equipment
      const relatedEquipments = getRelatedEquipmentForHunt(
        hunt.id,
        hunt.monsterName,
        hunt.monsterLevel,
        hunt.resource.id,
        hunt.resource.name
      );

      const calculatedEquipments: CalculatedBycEquipment[] =
        relatedEquipments.map((eq) => {
          const salePriceGross = getPrice(eq.id, eq.defaultSalePrice);
          const saleTax =
            salePriceGross > 0 ? Math.ceil(salePriceGross * 0.02) : 0;
          const salePriceNet = salePriceGross - saleTax;
          const resourceQtyNeeded = eq.resourceQuantityNeeded || 1;

          let otherIngredientsCost = 0;
          for (const ing of eq.recipeIngredients) {
            if (ing.id === hunt.resource.id) continue;
            const ingPrice = getPrice(ing.id, ing.defaultPrice);
            otherIngredientsCost += ingPrice * ing.quantity;
          }

          // Path A: Crafting via Hunt Loop
          const huntEntryCostForRecipe = bestEntryCost * resourceQtyNeeded;
          const totalInvestmentHunt =
            huntEntryCostForRecipe + otherIngredientsCost;
          const sebuscalinesBonus =
            hunt.sebuscalines * sebuscalinPrice * resourceQtyNeeded;
          const totalRevenueHunt = salePriceNet + sebuscalinesBonus;
          const netProfitHunt = totalRevenueHunt - totalInvestmentHunt;
          const roiHunt =
            totalInvestmentHunt > 0
              ? (netProfitHunt / totalInvestmentHunt) * 100
              : 0;

          // Path B: Crafting via Direct HDV Resource purchase
          const hdvResourceCostForRecipe = resourcePrice * resourceQtyNeeded;
          const totalInvestmentHdv =
            hdvResourceCostForRecipe + otherIngredientsCost;
          const netProfitHdv = salePriceNet - totalInvestmentHdv;
          const roiHdv =
            totalInvestmentHdv > 0
              ? (netProfitHdv / totalInvestmentHdv) * 100
              : 0;

          const optimalMethod: 'hunt' | 'hdv' =
            netProfitHunt >= netProfitHdv ? 'hunt' : 'hdv';
          const optimalNetProfit = Math.max(netProfitHunt, netProfitHdv);
          const optimalInvestment =
            optimalMethod === 'hunt' ? totalInvestmentHunt : totalInvestmentHdv;
          const optimalRoi =
            optimalInvestment > 0
              ? (optimalNetProfit / optimalInvestment) * 100
              : 0;

          // Value added vs raw resource sale in HDV (-2% tax)
          const resourceTax =
            resourcePrice > 0 ? Math.ceil(resourcePrice * 0.02) : 0;
          const resourceNetIncome = resourcePrice - resourceTax;
          const addedValueVsRawSale =
            salePriceNet -
            otherIngredientsCost -
            resourceNetIncome * resourceQtyNeeded;

          return {
            id: eq.id,
            name: eq.name,
            level: eq.level,
            type: eq.type,
            iconId: eq.iconId,
            salePriceGross,
            salePriceNet,
            resourceQtyNeeded,
            otherIngredientsCost,
            totalInvestmentHunt,
            totalRevenueHunt,
            netProfitHunt,
            roiHunt,
            totalInvestmentHdv,
            netProfitHdv,
            roiHdv,
            optimalMethod,
            optimalInvestment,
            optimalNetProfit,
            optimalRoi,
            addedValueVsRawSale,
            recipeIngredients: eq.recipeIngredients,
          };
        });

      const bestCraftEquipment =
        calculatedEquipments.length > 0
          ? [...calculatedEquipments].sort(
              (a, b) => b.optimalNetProfit - a.optimalNetProfit
            )[0]
          : null;

      return {
        ...hunt,
        wholeMapPrice,
        fragmentsTotal,
        isFragmentsCheaper,
        bestEntryCost,
        entryMethodSavings,
        resourcePrice,
        sebuscalinesValue,
        totalRewardValue,
        netProfit,
        roiPercent,
        huntVsBuyBenefit,
        bankFragmentsCount,
        hasMapInBank: getBankQty(hunt.mapItem.id) > 0,
        calculatedEquipments,
        bestCraftEquipment,
      };
    });
  }, [marketPrices, bankInventory, sebuscalinPrice]);

  // Filtered and sorted hunts
  const filteredHunts = useMemo(() => {
    return calculatedHunts
      .filter((h) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = h.monsterName.toLowerCase().includes(q);
          const matchResource = h.resource.name.toLowerCase().includes(q);
          const matchZone =
            h.zone.toLowerCase().includes(q) ||
            (h.subArea && h.subArea.toLowerCase().includes(q));
          const matchEquipment = h.calculatedEquipments.some((eq) =>
            eq.name.toLowerCase().includes(q)
          );
          if (!matchName && !matchResource && !matchZone && !matchEquipment)
            return false;
        }

        // Level filter
        if (levelFilter === '200' && h.monsterLevel !== 200) return false;
        if (
          levelFilter === '150-190' &&
          (h.monsterLevel < 150 || h.monsterLevel > 190)
        )
          return false;
        if (
          levelFilter === '100-140' &&
          (h.monsterLevel < 100 || h.monsterLevel > 140)
        )
          return false;
        if (
          levelFilter === '20-90' &&
          (h.monsterLevel < 20 || h.monsterLevel > 90)
        )
          return false;

        // Zone filter (Exact BYC Zones)
        if (zoneFilter !== 'all' && h.zone !== zoneFilter) return false;

        // Profitable only
        if (
          onlyProfitable &&
          h.netProfit <= 0 &&
          (!h.bestCraftEquipment || h.bestCraftEquipment.optimalNetProfit <= 0)
        )
          return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'profit_desc') return b.netProfit - a.netProfit;
        if (sortBy === 'craft_profit_desc') {
          const aProfit = a.bestCraftEquipment
            ? a.bestCraftEquipment.optimalNetProfit
            : -Infinity;
          const bProfit = b.bestCraftEquipment
            ? b.bestCraftEquipment.optimalNetProfit
            : -Infinity;
          return bProfit - aProfit;
        }
        if (sortBy === 'roi_desc') return b.roiPercent - a.roiPercent;
        if (sortBy === 'hunt_vs_buy')
          return b.huntVsBuyBenefit - a.huntVsBuyBenefit;
        if (sortBy === 'sebuscalines_desc')
          return b.sebuscalines - a.sebuscalines;
        if (sortBy === 'cost_asc') return a.bestEntryCost - b.bestEntryCost;
        if (sortBy === 'level_desc') return b.monsterLevel - a.monsterLevel;
        return 0;
      });
  }, [
    calculatedHunts,
    searchQuery,
    levelFilter,
    zoneFilter,
    onlyProfitable,
    sortBy,
  ]);

  // High-level metrics
  const totalHuntsCount = calculatedHunts.length;
  const profitableHuntsCount = calculatedHunts.filter(
    (h) =>
      h.netProfit > 0 ||
      (h.bestCraftEquipment && h.bestCraftEquipment.optimalNetProfit > 0)
  ).length;
  const highestProfitHunt = useMemo(() => {
    return [...calculatedHunts].sort((a, b) => b.netProfit - a.netProfit)[0];
  }, [calculatedHunts]);

  const handleAddFragmentsToShopping = (hunt: LegendaryHuntInfo) => {
    let count = 0;
    for (const fId of hunt.fragments.fragmentIds) {
      addToShoppingListById(fId, 1, hunt.mapItem.id);
      count++;
    }
    showToast(
      `Se han añadido los ${count} fragmentos de ${hunt.monsterName} a la Lista de Compras`
    );
  };

  const handleAddWholeMapToShopping = (hunt: LegendaryHuntInfo) => {
    addToShoppingListById(hunt.mapItem.id, 1);
    showToast(`Se ha añadido el ${hunt.mapItem.name} a la Lista de Compras`);
  };

  const handleAddEquipmentRecipeToShopping = (eq: CalculatedBycEquipment) => {
    let count = 0;
    for (const ing of eq.recipeIngredients) {
      addToShoppingListById(ing.id, ing.quantity, eq.id);
      count++;
    }
    showToast(
      `Se han añadido los ingredientes de ${eq.name} a la Lista de Compras`
    );
  };

  return {
    marketPrices,
    updatePrice,
    bankInventory,
    sebuscalinPrice,
    setSebuscalinPrice,
    searchQuery,
    setSearchQuery,
    levelFilter,
    setLevelFilter,
    zoneFilter,
    setZoneFilter,
    onlyProfitable,
    setOnlyProfitable,
    sortBy,
    setSortBy,
    selectedHuntForDetail,
    setSelectedHuntForDetail,
    selectedEquipmentTab,
    setSelectedEquipmentTab,
    priceDrafts,
    handlePriceDraftChange,
    handlePriceCommit,
    isRatesModalOpen,
    setIsRatesModalOpen,
    isExcelModalOpen,
    setIsExcelModalOpen,
    tempSebuscalin,
    setTempSebuscalin,
    toastMessage,
    showToast,
    handleSaveRates,
    calculatedHunts,
    filteredHunts,
    totalHuntsCount,
    profitableHuntsCount,
    highestProfitHunt,
    handleAddFragmentsToShopping,
    handleAddWholeMapToShopping,
    handleAddEquipmentRecipeToShopping,
  };
}

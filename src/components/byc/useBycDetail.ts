import React, { useState, useEffect, useMemo } from 'react';
import { useUserJobs } from '../../hooks/useUserJobs';
import { LegendaryHuntInfo, LEGENDARY_HUNTS } from '../../data/legendaryHuntsData';
import {
  getRelatedEquipmentForHunt,
  BycRelatedEquipment,
} from '../../data/bycEquipmentData';
import {
  saveMarketPrice,
  BankInventoryItem,
} from '../../services/dofusDbService';
import {
  getStoredSalesVolumeMap,
  saveItemSalesVolume,
  ItemSalesVolume,
} from '../../services/salesVolumeService';
import { BycAcquisitionMethod, MARKET_TAX_RATE } from './types';

interface UseBycDetailParams {
  hunt: LegendaryHuntInfo;
  marketPrices: Record<number, number>;
  bankInventory: BankInventoryItem[] | Record<number, number>;
  sebuscalinPrice: number;
  onPriceChange: (itemId: number, newPrice: number) => void;
}

export function useBycDetail({
  hunt,
  marketPrices,
  bankInventory,
  sebuscalinPrice,
  onPriceChange,
}: UseBycDetailParams) {
  const { isEnabled: isUserJobsEnabled, canCraft } = useUserJobs();

  // Direct Inline Price Drafts
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const handlePriceDraftChange = (itemId: number, rawVal: string) => {
    setPriceDrafts((prev) => ({ ...prev, [itemId]: rawVal }));
  };

  const handlePriceCommit = (itemId: number, rawVal: string) => {
    const num = Math.max(0, Number(rawVal.replace(/\D/g, '')) || 0);
    saveMarketPrice(itemId, num);
    onPriceChange(itemId, num);
    setPriceDrafts((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  // Search/filter for switching hunt quickly
  const [huntSearch, setHuntSearch] = useState('');
  const [isSwitchDropdownOpen, setIsSwitchDropdownOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Sales Volume Map (24h, 7d, 30d records)
  const [salesVolumeMap, setSalesVolumeMap] = useState<
    Record<number, ItemSalesVolume>
  >(() => {
    return getStoredSalesVolumeMap();
  });

  const [activeVolumeModalItemId, setActiveVolumeModalItemId] = useState<
    number | null
  >(null);

  useEffect(() => {
    const handleVolumeUpdated = () => {
      setSalesVolumeMap(getStoredSalesVolumeMap());
    };
    window.addEventListener('dofus_sales_volume_updated', handleVolumeUpdated);
    return () => {
      window.removeEventListener(
        'dofus_sales_volume_updated',
        handleVolumeUpdated
      );
    };
  }, []);

  const handleUpdateVolume = (
    itemId: number,
    field: 'sales24h' | 'sales7d' | 'sales30d',
    value: string
  ) => {
    const num =
      value === '' ? undefined : Math.max(0, parseInt(value, 10) || 0);
    const updated = saveItemSalesVolume(itemId, { [field]: num });
    setSalesVolumeMap({ ...updated });
  };

  // Expanded equipment recipes
  const [expandedEquipmentIds, setExpandedEquipmentIds] = useState<
    Record<number, boolean>
  >({});

  // Selected ByC acquisition method per equipment (default is optimal)
  const [selectedEquipmentMethod, setSelectedEquipmentMethod] = useState<
    Record<number, BycAcquisitionMethod>
  >({});

  const toggleEquipmentExpand = (id: number) => {
    setExpandedEquipmentIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to format currency
  const formatKamas = (val: number) => {
    return new Intl.NumberFormat('es-ES').format(Math.round(val));
  };

  // Helper to resolve bank quantity safely
  const getBankQty = (itemId: number): number => {
    if (Array.isArray(bankInventory)) {
      const found = bankInventory.find((b) => b.itemId === itemId);
      return found ? found.quantity : 0;
    }
    return (bankInventory as Record<number, number>)[itemId] || 0;
  };

  // Safe item price lookup
  const getPrice = (itemId: number, defaultVal: number) => {
    return marketPrices[itemId] !== undefined
      ? marketPrices[itemId]
      : defaultVal;
  };

  // Prices for this hunt
  const wholeMapPrice = getPrice(hunt.mapItem.id, hunt.mapItem.defaultPrice);
  const resourcePriceGross = getPrice(
    hunt.resource.id,
    hunt.resource.defaultPrice
  );
  // Net resource income after 2% HDV sales tax
  const resourceNetIncome = Math.round(
    resourcePriceGross * (1 - MARKET_TAX_RATE)
  );

  // Calculate fragments cost
  const fragmentPrices = hunt.fragments.fragmentIds.map((fragId) =>
    getPrice(fragId, hunt.fragments.defaultUnitPrice)
  );
  const fragmentsTotalCost = fragmentPrices.reduce((a, b) => a + b, 0);

  // Bank counts
  const fragmentsInBank = hunt.fragments.fragmentIds.map((id) =>
    getBankQty(id)
  );
  const totalFragmentsInBank = fragmentsInBank.reduce((a, b) => a + b, 0);
  const wholeMapsInBank = getBankQty(hunt.mapItem.id);
  const resourcesInBank = getBankQty(hunt.resource.id);

  // Sebuscalines rewards: Chest gives 50% of the mission reward
  const chestSebuscalines = hunt.chestSebuscalines || hunt.sebuscalines;
  const missionSebuscalines =
    hunt.missionSebuscalines || chestSebuscalines * 2;
  const sebuscalinesValue = chestSebuscalines * sebuscalinPrice;

  // Total gross and net returns for pure Hunting (Hunt & Sell raw items)
  const totalHuntGrossReturn = resourcePriceGross + sebuscalinesValue;
  // Net return considering 2% tax on selling the boss resource in HDV (Sebuscalines converted directly have no HDV tax)
  const totalHuntNetReturn = resourceNetIncome + sebuscalinesValue;

  // Profit for hunting via Whole Map
  const profitMapNet = totalHuntNetReturn - wholeMapPrice;
  const roiMap =
    wholeMapPrice > 0 ? (profitMapNet / wholeMapPrice) * 100 : 0;

  // Profit for hunting via Fragments
  const profitFragsNet = totalHuntNetReturn - fragmentsTotalCost;
  const roiFrags =
    fragmentsTotalCost > 0 ? (profitFragsNet / fragmentsTotalCost) * 100 : 0;

  // Best acquisition method for the resource
  // Effective unit cost = Total Investment - Sebuscalines (can be negative if chest pays for the map!)
  const effectiveCostViaMap = wholeMapPrice - sebuscalinesValue;
  const effectiveCostViaFrags = fragmentsTotalCost - sebuscalinesValue;
  const effectiveCostViaHdv = resourcePriceGross; // Buying directly from HDV costs the gross price (no tax on buying, no chest)

  const bestHuntMethod: 'fragments' | 'map' =
    fragmentsTotalCost <= wholeMapPrice ? 'fragments' : 'map';
  const bestHuntInvestment =
    bestHuntMethod === 'fragments' ? fragmentsTotalCost : wholeMapPrice;
  const bestHuntProfitNet =
    bestHuntMethod === 'fragments' ? profitFragsNet : profitMapNet;
  const bestHuntRoi = bestHuntMethod === 'fragments' ? roiFrags : roiMap;
  const bestHuntEffectiveUnitCost =
    bestHuntMethod === 'fragments'
      ? effectiveCostViaFrags
      : effectiveCostViaMap;

  // What is the absolute cheapest way to acquire the boss resource (for crafting)?
  let optimalAcquisitionMethod: BycAcquisitionMethod = 'fragments';
  let optimalUnitCostForCraft = effectiveCostViaFrags;

  if (effectiveCostViaMap < optimalUnitCostForCraft) {
    optimalAcquisitionMethod = 'map';
    optimalUnitCostForCraft = effectiveCostViaMap;
  }
  if (effectiveCostViaHdv < optimalUnitCostForCraft) {
    optimalAcquisitionMethod = 'hdv';
    optimalUnitCostForCraft = effectiveCostViaHdv;
  }

  // Related equipment list
  const rawRelatedEquipment: BycRelatedEquipment[] = useMemo(
    () =>
      getRelatedEquipmentForHunt(
        hunt.id,
        hunt.monsterName,
        hunt.monsterLevel,
        hunt.resource.id,
        hunt.resource.name,
        resourcePriceGross
      ),
    [
      hunt.id,
      hunt.monsterName,
      hunt.monsterLevel,
      hunt.resource.id,
      hunt.resource.name,
      resourcePriceGross,
    ]
  );

  const relatedEquipment = useMemo(() => {
    if (!isUserJobsEnabled) return rawRelatedEquipment;
    return rawRelatedEquipment.filter((eq) => canCraft(eq as any));
  }, [rawRelatedEquipment, isUserJobsEnabled, canCraft]);

  // Filtered hunts for quick search switch
  const filteredSwitchHunts = useMemo(
    () =>
      LEGENDARY_HUNTS.filter(
        (h) =>
          h.monsterName.toLowerCase().includes(huntSearch.toLowerCase()) ||
          h.zone.toLowerCase().includes(huntSearch.toLowerCase())
      ),
    [huntSearch]
  );

  return {
    isUserJobsEnabled,
    priceDrafts,
    handlePriceDraftChange,
    handlePriceCommit,
    huntSearch,
    setHuntSearch,
    isSwitchDropdownOpen,
    setIsSwitchDropdownOpen,
    isExcelModalOpen,
    setIsExcelModalOpen,
    salesVolumeMap,
    activeVolumeModalItemId,
    setActiveVolumeModalItemId,
    handleUpdateVolume,
    expandedEquipmentIds,
    toggleEquipmentExpand,
    selectedEquipmentMethod,
    setSelectedEquipmentMethod,
    formatKamas,
    getBankQty,
    getPrice,
    wholeMapPrice,
    resourcePriceGross,
    resourceNetIncome,
    fragmentPrices,
    fragmentsTotalCost,
    fragmentsInBank,
    totalFragmentsInBank,
    wholeMapsInBank,
    resourcesInBank,
    chestSebuscalines,
    missionSebuscalines,
    sebuscalinesValue,
    totalHuntGrossReturn,
    totalHuntNetReturn,
    profitMapNet,
    roiMap,
    profitFragsNet,
    roiFrags,
    effectiveCostViaMap,
    effectiveCostViaFrags,
    effectiveCostViaHdv,
    bestHuntMethod,
    bestHuntInvestment,
    bestHuntProfitNet,
    bestHuntRoi,
    bestHuntEffectiveUnitCost,
    optimalAcquisitionMethod,
    optimalUnitCostForCraft,
    relatedEquipment,
    filteredSwitchHunts,
  };
}

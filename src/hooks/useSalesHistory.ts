import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  SalesHistorySnapshot,
  ActiveListingsSnapshot,
  ItemSoldStats,
  HistorySummary,
  ActiveListingsSummary,
  getStoredSalesHistory,
  getStoredActiveListings,
  importSalesHistoryJSON as importHistoryService,
  importActiveListingsJSON as importListingsService,
  computeSoldStats,
  computeHistorySummary,
  computeActiveListingsSummary,
  clearSalesHistory as clearHistoryService,
  clearActiveListings as clearListingsService,
  deleteHistorySnapshot as deleteHistorySnapshotService,
  deleteListingsSnapshot as deleteListingsSnapshotService,
  ImportHistoryResult,
  ImportListingsResult,
} from '../services/salesHistoryService';

export function useSalesHistory() {
  const [salesHistory, setSalesHistory] = useState<SalesHistorySnapshot[]>(() => getStoredSalesHistory());
  const [activeListings, setActiveListings] = useState<ActiveListingsSnapshot[]>(() => getStoredActiveListings());

  const reload = useCallback(() => {
    setSalesHistory(getStoredSalesHistory());
    setActiveListings(getStoredActiveListings());
  }, []);

  useEffect(() => {
    const handleUpdate = () => reload();
    window.addEventListener('dofus_sales_history_updated', handleUpdate);
    return () => {
      window.removeEventListener('dofus_sales_history_updated', handleUpdate);
    };
  }, [reload]);

  const historySummary = useMemo<HistorySummary>(() => {
    return computeHistorySummary(salesHistory);
  }, [salesHistory]);

  const soldStats = useMemo<ItemSoldStats[]>(() => {
    return computeSoldStats(salesHistory);
  }, [salesHistory]);

  const activeSummary = useMemo<ActiveListingsSummary>(() => {
    return computeActiveListingsSummary(activeListings);
  }, [activeListings]);

  const importSalesHistory = useCallback((raw: unknown): ImportHistoryResult => {
    const res = importHistoryService(raw);
    reload();
    return res;
  }, [reload]);

  const importActiveListings = useCallback((raw: unknown): ImportListingsResult => {
    const res = importListingsService(raw);
    reload();
    return res;
  }, [reload]);

  const clearHistory = useCallback(() => {
    clearHistoryService();
    reload();
  }, [reload]);

  const clearListings = useCallback(() => {
    clearListingsService();
    reload();
  }, [reload]);

  const deleteHistory = useCallback((id: string) => {
    deleteHistorySnapshotService(id);
    reload();
  }, [reload]);

  const deleteListings = useCallback((id: string) => {
    deleteListingsSnapshotService(id);
    reload();
  }, [reload]);

  return {
    salesHistory,
    activeListings,
    historySummary,
    soldStats,
    activeSummary,
    importSalesHistory,
    importActiveListings,
    clearHistory,
    clearListings,
    deleteHistory,
    deleteListings,
    reload,
  };
}

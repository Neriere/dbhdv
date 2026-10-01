import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ActiveListingsData,
  getStoredActiveListings,
  saveActiveListings,
  getActiveListingsItemMap,
  extractAllActiveLots,
} from "../services/activeListingsService";

export function useActiveListings() {
  const [data, setData] = useState<ActiveListingsData | null>(() => getStoredActiveListings());

  const reload = useCallback(() => {
    setData(getStoredActiveListings());
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      setData(getStoredActiveListings());
    };
    window.addEventListener("active_listings_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("active_listings_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const lots = useMemo(() => extractAllActiveLots(data), [data]);
  const itemMap = useMemo(() => getActiveListingsItemMap(data), [data]);

  const updateListings = useCallback((newData: ActiveListingsData) => {
    saveActiveListings(newData);
    setData(newData);
  }, []);

  return {
    activeListingsData: data,
    lots,
    itemMap,
    totalLots: lots.length,
    updateListings,
    reload,
  };
}

import { useState, useEffect } from "react";
import { DofusItem, ItemPriceHistorySummary, PriceHistoryEntry } from "../../types";
import {
  fetchItemPriceHistory,
  revertPriceHistory,
  getActivePriceProfileId,
} from "../../services/dofusDbService";

export const useItemPriceHistory = (
  item: DofusItem | null,
  isOpen: boolean,
  profileId?: number,
  onPriceChanged?: () => void
) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ItemPriceHistorySummary | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !item) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const effectivePid = profileId || getActivePriceProfileId();
    fetchItemPriceHistory(item.id, effectivePid)
      .then((summary) => {
        if (isMounted) {
          setData(summary);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error fetching item price history:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item, profileId]);

  const handleRevert = async (entry: PriceHistoryEntry) => {
    if (revertingId || !item) return;
    try {
      setRevertingId(entry.id);
      await revertPriceHistory(entry.id);
      // Reload history
      const effectivePid = profileId || getActivePriceProfileId();
      const updated = await fetchItemPriceHistory(item.id, effectivePid);
      setData(updated);
      if (onPriceChanged) onPriceChanged();
    } catch (err) {
      console.error("Error al revertir precio:", err);
      alert("No se pudo revertir el precio.");
    } finally {
      setRevertingId(null);
    }
  };

  return {
    loading,
    data,
    revertingId,
    activePointIndex,
    setActivePointIndex,
    handleRevert,
  };
};

import { useState, useEffect, useRef } from 'react';
import { MarketPriceMap } from '../types';

/**
 * Hook to trigger a temporary visual highlight (destello) when one or more item prices
 * are updated in real-time (via sniffer, SSE, or background sync).
 */
export function useLivePriceFlash(itemIds: number | number[] | undefined | null) {
  const [isFlashing, setIsFlashing] = useState(false);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!itemIds) return;

    const idSet = new Set(Array.isArray(itemIds) ? itemIds : [itemIds]);
    if (idSet.size === 0) return;

    const handlePricesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{
        updatedPrices?: MarketPriceMap;
      }>;

      const updated = customEvent.detail?.updatedPrices;
      if (!updated) return;

      let matched = false;
      for (const id of idSet) {
        if (updated[id] !== undefined) {
          matched = true;
          break;
        }
      }

      if (matched) {
        setIsFlashing(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setIsFlashing(false);
        }, 1200);
      }
    };

    window.addEventListener('dofus_prices_updated', handlePricesUpdated);
    return () => {
      window.removeEventListener('dofus_prices_updated', handlePricesUpdated);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [itemIds]);

  return {
    isFlashing,
    flashClass: isFlashing
      ? 'bg-emerald-500/20 ring-1 ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all duration-300'
      : 'transition-all duration-700',
  };
}

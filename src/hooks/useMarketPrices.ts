import { useState, useEffect, useCallback, useMemo } from 'react';
import { MarketPriceMap, PriceProfile, PriceUpdatedAtMap } from '../types';
import {
  getStoredMarketPrices,
  getActivePriceProfile,
  getActivePriceProfileId,
  getStoredPriceUpdatedAt,
  saveMarketPrice,
  saveAllMarketPrices,
} from '../services/dofusDbService';

export interface UseMarketPricesReturn {
  marketPrices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  activeProfile: PriceProfile | null;
  activeProfileId: number;
  updatePrice: (itemId: number, price: number) => Promise<MarketPriceMap>;
  updateAllPrices: (newPrices: MarketPriceMap) => Promise<MarketPriceMap>;
  getPrice: (itemId: number, fallback?: number) => number;
  refreshPrices: () => void;
}

/**
 * Hook centralizado y reactivo para acceder y modificar precios de mercado en tiempo real.
 * Se actualiza automáticamente ante eventos del Sniffer, Gestor de Precios, importaciones y cambio de perfil.
 */
export function useMarketPrices(): UseMarketPricesReturn {
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>(() =>
    getStoredMarketPrices()
  );
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<PriceUpdatedAtMap>(() =>
    getStoredPriceUpdatedAt()
  );
  const [activeProfile, setActiveProfile] = useState<PriceProfile | null>(() =>
    getActivePriceProfile()
  );
  const [activeProfileId, setActiveProfileId] = useState<number>(() =>
    getActivePriceProfileId()
  );

  const refreshPrices = useCallback(() => {
    setMarketPrices({ ...getStoredMarketPrices() });
    setPriceUpdatedAt({ ...getStoredPriceUpdatedAt() });
    setActiveProfile(getActivePriceProfile());
    setActiveProfileId(getActivePriceProfileId());
  }, []);

  useEffect(() => {
    let lastPriceEventTime = 0;

    const handlePricesUpdated = (event?: Event) => {
      lastPriceEventTime = Date.now();
      const customEvent = event as CustomEvent<{
        updatedPrices?: MarketPriceMap;
        priceUpdatedAt?: PriceUpdatedAtMap;
      }>;
      if (customEvent?.detail?.updatedPrices) {
        setMarketPrices((prev) => ({
          ...prev,
          ...customEvent.detail.updatedPrices,
        }));
      } else {
        setMarketPrices({ ...getStoredMarketPrices() });
      }

      if (customEvent?.detail?.priceUpdatedAt) {
        setPriceUpdatedAt((prev) => ({
          ...prev,
          ...customEvent.detail.priceUpdatedAt,
        }));
      } else {
        setPriceUpdatedAt({ ...getStoredPriceUpdatedAt() });
      }
    };

    const handleDatabaseUpdated = () => {
      // If prices were just updated within 100ms by dofus_prices_updated, avoid redundant full refresh
      if (Date.now() - lastPriceEventTime < 100) return;
      refreshPrices();
    };

    const handleProfileChanged = (event?: Event) => {
      const customEvent = event as CustomEvent<{ profile?: PriceProfile }>;
      if (customEvent?.detail?.profile) {
        setActiveProfile(customEvent.detail.profile);
      } else {
        setActiveProfile(getActivePriceProfile());
      }
      setActiveProfileId(getActivePriceProfileId());
      setMarketPrices({ ...getStoredMarketPrices() });
      setPriceUpdatedAt({ ...getStoredPriceUpdatedAt() });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('dofus_prices_updated', handlePricesUpdated);
      window.addEventListener('dofus_database_updated', handleDatabaseUpdated);
      window.addEventListener('dofus_profile_changed', handleProfileChanged);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dofus_prices_updated', handlePricesUpdated);
        window.removeEventListener('dofus_database_updated', handleDatabaseUpdated);
        window.removeEventListener('dofus_profile_changed', handleProfileChanged);
      }
    };
  }, [refreshPrices]);

  const updatePrice = useCallback(async (itemId: number, price: number) => {
    const now = Date.now();
    setMarketPrices((prev) => ({ ...prev, [itemId]: price }));
    setPriceUpdatedAt((prev) => ({ ...prev, [itemId]: now }));
    const updated = await saveMarketPrice(itemId, price);
    return updated;
  }, []);

  const updateAllPrices = useCallback(async (newPrices: MarketPriceMap) => {
    const now = Date.now();
    const timestamps: PriceUpdatedAtMap = {};
    for (const id of Object.keys(newPrices)) {
      timestamps[Number(id)] = now;
    }
    setMarketPrices((prev) => ({ ...prev, ...newPrices }));
    setPriceUpdatedAt((prev) => ({ ...prev, ...timestamps }));
    const updated = await saveAllMarketPrices(newPrices);
    return updated;
  }, []);

  const getPrice = useCallback(
    (itemId: number, fallback = 0): number => {
      return marketPrices[itemId] ?? fallback;
    },
    [marketPrices]
  );

  return useMemo(
    () => ({
      marketPrices,
      priceUpdatedAt,
      activeProfile,
      activeProfileId,
      updatePrice,
      updateAllPrices,
      getPrice,
      refreshPrices,
    }),
    [marketPrices, priceUpdatedAt, activeProfile, activeProfileId, updatePrice, updateAllPrices, getPrice, refreshPrices]
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MarketPriceMap, PriceProfile } from '../types';
import {
  getStoredMarketPrices,
  getActivePriceProfile,
  saveMarketPrice,
  saveAllMarketPrices,
} from '../services/dofusDbService';

export interface UseMarketPricesReturn {
  marketPrices: MarketPriceMap;
  activeProfile: PriceProfile | null;
  updatePrice: (itemId: number, price: number) => Promise<MarketPriceMap>;
  updateAllPrices: (newPrices: MarketPriceMap) => Promise<MarketPriceMap>;
  getPrice: (itemId: number, fallback?: number) => number;
}

/**
 * Hook centralizado y reactivo para acceder y modificar precios de mercado en tiempo real.
 * Se actualiza automáticamente ante eventos del Sniffer, Gestor de Precios, importaciones y cambio de perfil.
 */
export function useMarketPrices(): UseMarketPricesReturn {
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>(() =>
    getStoredMarketPrices()
  );
  const [activeProfile, setActiveProfile] = useState<PriceProfile | null>(() =>
    getActivePriceProfile()
  );

  useEffect(() => {
    const handlePricesUpdated = (event?: Event) => {
      const customEvent = event as CustomEvent<{ updatedPrices?: MarketPriceMap }>;
      if (customEvent?.detail?.updatedPrices) {
        setMarketPrices((prev) => ({
          ...prev,
          ...customEvent.detail.updatedPrices,
        }));
      } else {
        setMarketPrices({ ...getStoredMarketPrices() });
      }
    };

    const handleDatabaseUpdated = () => {
      setMarketPrices({ ...getStoredMarketPrices() });
      setActiveProfile(getActivePriceProfile());
    };

    const handleProfileChanged = (event?: Event) => {
      const customEvent = event as CustomEvent<{ profile?: PriceProfile }>;
      if (customEvent?.detail?.profile) {
        setActiveProfile(customEvent.detail.profile);
      } else {
        setActiveProfile(getActivePriceProfile());
      }
      setMarketPrices({ ...getStoredMarketPrices() });
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
  }, []);

  const updatePrice = useCallback(async (itemId: number, price: number) => {
    const updated = await saveMarketPrice(itemId, price);
    setMarketPrices({ ...updated });
    return updated;
  }, []);

  const updateAllPrices = useCallback(async (newPrices: MarketPriceMap) => {
    const updated = await saveAllMarketPrices(newPrices);
    setMarketPrices({ ...updated });
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
      activeProfile,
      updatePrice,
      updateAllPrices,
      getPrice,
    }),
    [marketPrices, activeProfile, updatePrice, updateAllPrices, getPrice]
  );
}

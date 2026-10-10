import type {
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  PriceUpdatedAtMap,
  SalesVolumeMap,
  SyncStatus,
  SyncSettings,
  PriceProfile,
} from "../../types";

export type BootstrapData = {
  items: DofusItem[];
  recipes: Record<number, DofusRecipe>;
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  salesVolume?: SalesVolumeMap;
  coefficients?: Record<number, number>;
  coefficientUpdatedAt?: Record<number, number>;
  manualEdits?: Record<number, number>;
  syncStatus: SyncStatus;
  syncSettings: SyncSettings;
  priceProfiles: PriceProfile[];
  activePriceProfileId: number;
};

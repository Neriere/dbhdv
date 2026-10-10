import {
  BankInventoryItem,
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  PriceHistoryEntry,
  PriceProfile,
  PriceUpdatedAtMap,
  SalesVolumeMap,
  SyncSettings,
  SyncStatus,
} from "../../types";

export type { BankInventoryItem };

export interface CraftableItem extends DofusItem {
  jobId: number;
  jobNameEs: string;
  defaultCraftCost?: number;
  defaultMarketSalePrice?: number;
  recipeData?: DofusRecipe;
}

export type CraftStrategyMode =
  | "direct_buy"
  | "full_subcraft"
  | "auto_optimal"
  | "custom_hybrid";

export interface FetchPriceHistoryParams {
  profileId?: number;
  itemId?: number;
  limit?: number;
  offset?: number;
  search?: string;
  filter?: "all" | "increased" | "decreased";
}

export interface FetchPriceHistoryResponse {
  total: number;
  limit: number;
  offset: number;
  entries: PriceHistoryEntry[];
}

export type BootstrapResponse = {
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
  databasePath: string;
};

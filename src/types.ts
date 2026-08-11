// DofusDB Data Types

export interface DofusText {
  fr?: string;
  en?: string;
  es?: string;
  de?: string;
  pt?: string;
  [key: string]: string | undefined;
}

export interface DofusEffect {
  id: number;
  effectId: number;
  characteristic?: number;
  from?: number;
  to?: number;
  formatted?: string;
  characteristicName?: string;
  runeWeight?: number;
}

export interface DofusItemType {
  id: number;
  name: DofusText;
  superCategoryId?: number;
  categoryId?: number;
}

export interface DofusItem {
  id: number;
  name: DofusText;
  description?: DofusText;
  typeId: number;
  type?: DofusItemType;
  level: number;
  iconId: number;
  possibleEffects?: DofusEffect[];
  recipeIds?: number[];
  itemTypeId?: number;
  price?: number;
}

export interface DofusRecipeIngredient {
  id: number;
  itemId: number;
  quantity: number;
  item?: DofusItem;
}

export interface DofusRecipe {
  id: number;
  resultId: number;
  result?: DofusItem;
  ingredientIds: number[];
  quantities: number[];
  ingredients?: DofusRecipeIngredient[];
  jobId?: number;
}

export interface DofusEffectDefinition {
  id: number;
  name: DofusText;
  characteristicId?: number;
  description?: DofusText;
  weight?: number;
}

// API Explorer Query State
export interface ApiQueryState {
  endpoint: string;
  lang: 'es' | 'fr' | 'en';
  search: string;
  typeId: string;
  minLevel: number;
  maxLevel: number;
  limit: number;
  skip: number;
  equipmentOnly: boolean;
  customParams: string;
}

// Professions / Oficios in Dofus
export interface DofusJob {
  id: number;
  nameEs: string;
  nameFr: string;
  icon: string; // lucide icon name or emoji
  typeIds: number[]; // associated item type IDs
  ankamaJobIds?: number[]; // Ankama / DofusDB job IDs (e.g. 16 for Joyero, 27 for Sastre)
  description: string;
}

// Nested Sub-crafting Tree Node
export interface RecipeTreeNode {
  itemId: number;
  quantity: number;
  item: DofusItem;
  recipe?: DofusRecipe;
  subIngredients?: RecipeTreeNode[];
  isCraftable: boolean;
  marketPrice: number; // Market price of 1 unit
  decision: 'buy' | 'craft'; // User's decision for this intermediate node
}

// Import & Sync Statistics
export interface SyncStatus {
  lastSyncTimestamp: number | null;
  totalImported: number;
  recipesCount?: number;
  equipablesCount: number;
  consumablesCount: number;
  resourcesCount: number;
  cosmeticsOmittedCount: number;
  isLoading: boolean;
  progressMessage: string;
}

export interface PriceProfile {
  id: number;
  name: string;
  slug: string;
  isDefault: boolean;
}

export interface SyncSettings {
  enabled: boolean;
  intervalDays: number;
}

export type PriceUpdatedAtMap = Record<number, number>;

// Market Price Map (itemId -> price in Kamas)
export type MarketPriceMap = Record<number, number>;

// Craft Strategy Modes
export type CraftStrategyMode = 'direct_buy' | 'full_subcraft' | 'auto_optimal' | 'custom_hybrid';

export interface StatRuneBreakdown {
  effectId: number;
  characteristicName: string;
  statMin: number;
  statMax: number;
  avgValue: number;
  unitWeight: number; // e.g. PA = 100, PM = 90
  statTotalWeight: number; // avgValue * unitWeight
  baseRunesExpected: {
    normalRune: number;
    paRune: number;
    raRune: number;
  };
}

export interface CrushingCalculationResult {
  item: DofusItem;
  coefficientPercent: number; // e.g. 100%
  totalRunicWeight: number; // Total item weight sum
  statBreakdowns: StatRuneBreakdown[];
  estimatedTotalRunesValue: number;
  craftCost: number;
  netProfit: number;
  profitMarginPercent: number;
}

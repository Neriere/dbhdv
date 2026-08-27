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
  id?: number;
  effectId?: number;
  characteristic?: number;
  from?: number;
  to?: number;
  formatted?: string;
  characteristicName?: string;
  runeWeight?: number;
  [key: string]: unknown;
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
  effects?: DofusEffect[];
  recipeIds?: number[];
  itemTypeId?: number;
  price?: number;
  hasRecipe?: boolean;
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
  lang: "es" | "fr" | "en";
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
  decision: "buy" | "craft"; // User's decision for this intermediate node
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
  progressPercent?: number;
  currentStep?: string;
  totalSteps?: number;
  currentStepIndex?: number;
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

export interface PriceHistoryEntry {
  id: number;
  profileId: number;
  itemId: number;
  itemName?: string;
  itemIconId?: number;
  itemLevel?: number;
  itemTypeId?: number;
  itemTypeName?: string;
  price: number;
  oldPrice: number;
  difference: number;
  percentageChange: number;
  source: string; // 'manual' | 'batch' | 'import' | 'revert'
  timestamp: number;
}

export interface ItemPriceHistorySummary {
  itemId: number;
  history: PriceHistoryEntry[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  currentPrice: number;
  firstRecordedAt: number;
  lastUpdatedAt: number;
  totalChanges: number;
}

// Market Price Map (itemId -> price in Kamas)
export type MarketPriceMap = Record<number, number>;

// Craft Strategy Modes
export type CraftStrategyMode =
  | "direct_buy"
  | "full_subcraft"
  | "auto_optimal"
  | "custom_hybrid";

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

// Shopping list & Batch Craft Planner
export interface ShoppingListItem {
  itemId: number;
  item: DofusItem;
  recipe?: DofusRecipe;
  targetQuantity: number;
  addedAt: number;
}

export interface ConsolidatedIngredient {
  itemId: number;
  item?: DofusItem;
  totalQuantityRequired: number;
  unitPrice: number;
  totalPrice: number;
  isChecked?: boolean;
}

export type DofusTheme = 'bonta' | 'brakmar' | 'pandala';

// Dofusbook Set Calculator Types
export interface DofusbookIngredientBreakdown {
  id: number;
  name: string;
  nameFr?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  iconId: number;
}

export interface DofusbookEquipmentItem {
  id: number;
  slotName: string; // 'Sombrero', 'Capa', 'Amuleto', 'Anillo 1', 'Anillo 2', 'Cinturón', 'Botas', 'Arma', 'Escudo', 'Mascota / Montura', 'Dofus / Trofeo'
  rawName: string;
  item: DofusItem | null;
  recipe: DofusRecipe | null;
  craftCost: number;
  marketPrice: number;
  isDofus: boolean;
  isTrophy: boolean;
  isPrysmaradite: boolean;
  isCraftable: boolean;
  cheaperOption: 'craft' | 'buy' | 'equal' | 'no_recipe' | 'dofus_excluded';
  savings: number; // absolute difference
  missingIngredientsCount: number;
  ingredientsBreakdown: DofusbookIngredientBreakdown[];
  userChoice?: 'craft' | 'buy' | 'exclude';
}

export interface DofusbookBuildTotals {
  totalCraftCost: number;
  totalMarketPrice: number;
  totalOptimalCost: number;
  totalSavings: number;
  craftablePiecesCount: number;
  excludedDofusCount: number;
  excludedTrophiesCount: number;
  totalPieces: number;
}

export interface DofusbookBuildAnalysis {
  url: string;
  resolvedUrl?: string;
  buildName: string;
  characterClass?: string;
  buildLevel?: number;
  items: DofusbookEquipmentItem[];
  totals: DofusbookBuildTotals;
  consolidatedIngredients: ConsolidatedIngredient[];
}

// Market Arbitrage Analysis
export interface ArbitrageOpportunity {
  item: DofusItem;
  recipe?: DofusRecipe;
  craftCost: number;
  hdvSellPrice: number;
  runeEstimatedValue: number;
  craftFlipProfit: number;
  craftFlipRoi: number;
  craftRuneProfit: number;
  craftRuneRoi: number;
  hdvRuneProfit: number;
  hdvRuneRoi: number;
  bestStrategy: 'craft_flip' | 'craft_crush' | 'hdv_crush' | 'none';
  bestProfit: number;
  bestRoi: number;
}

// "Mi Banco" Inventory & Reverse Crafting Types
export interface BankInventoryItem {
  itemId: number;
  quantity: number;
  item?: DofusItem;
  addedAt?: number;
}

export interface ReverseCraftIngredientStatus {
  itemId: number;
  itemName: string;
  itemIconId: number;
  required: number;
  inBank: number;
  missing: number;
  unitPrice: number;
  missingCost: number;
  isFullyAvailable: boolean;
}

export interface ReverseCraftAnalysis {
  item: DofusItem;
  recipe: DofusRecipe;
  jobId?: number;
  jobNameEs?: string;
  totalCraftCost: number;
  marketSalePrice: number;
  netProfit: number;
  roi: number;
  maxCraftableWithBank: number; // e.g. Max items craftable strictly from bank without buying
  materialsCoveragePercent: number; // e.g. 75% of materials
  availableIngredientsCount: number;
  totalIngredientsCount: number;
  bankMaterialsValue: number; // Estimated savings from bank materials
  missingMaterialsCost: number; // Kamas needed in HDV to finish the craft
  ingredientsStatus: ReverseCraftIngredientStatus[];
  isFullyCraftable: boolean;
}


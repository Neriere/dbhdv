import { PresetCraftableItem } from '../../data/presetCraftableItems';

export interface DailyCraftPlannerProps {
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
  onNavigateToShopping?: () => void;
}

export type OptimizationMode = 'balanced' | 'fast_cashflow' | 'max_profit' | 'max_roi';
export type MarketChannel = 'multichannel' | 'hybrid' | 'equipment' | 'consumables' | 'resources';
export type MarketCategory = 'equipment' | 'consumables' | 'resources';

export interface BatchBreakdown {
  lots100: number;
  lots10: number;
  lots1: number;
  totalSlots: number;
}

export interface PlannedCraftItem {
  item: PresetCraftableItem;
  jobName: string;
  jobId: number;
  userJobLevel: number;
  canCraft: boolean;
  marketCategory: MarketCategory;
  isStackable: boolean;
  craftCostUnit: number;
  salePriceUnit: number;
  saleTaxUnit: number;
  netProfitUnit: number;
  roiPercent: number;
  avgDailySales: number;
  sales24h?: number;
  sales7d?: number;
  sales30d?: number;
  turnoverRating: 'alta' | 'media' | 'baja' | null;
  turnoverLabel: string | null;
  hasSalesData: boolean;
  recommendedUnits: number;
  totalCraftCost: number;
  totalNetProfit: number;
  estimatedSlots: number;
  batchBreakdown?: BatchBreakdown;
  paybackDays: number | null;
  paybackHours: number | null;
  isOutlierPrice: boolean;
  outlierRatio: number;
  referenceMedian: number | null;
  originalSalePriceUnit: number;
  canCrush: boolean;
  hasRecentSales?: boolean;
  activeInHdv?: {
    lots: number;
    totalQty: number;
    timeLabel: string;
  };
}

export interface PostedCraftItem {
  itemId: number;
  item: PresetCraftableItem;
  jobName: string;
  jobId: number;
  userJobLevel: number;
  marketCategory: MarketCategory;
  isStackable: boolean;
  units: number;
  craftCostUnit: number;
  totalCraftCost: number;
  spentKamas?: number;
  salePriceUnit: number;
  saleTaxUnit: number;
  netProfitUnit: number;
  totalNetProfit: number;
  roiPercent: number;
  estimatedSlots: number;
  postedAt: number;
  deductedBankMaterials?: Record<number, number>;
}

export const BUDGET_PRESETS = [
  { label: '1 Mk', value: 1_000_000 },
  { label: '3 Mk', value: 3_000_000 },
  { label: '5 Mk', value: 5_000_000 },
  { label: '10 Mk', value: 10_000_000 },
  { label: '20 Mk', value: 20_000_000 },
  { label: '50 Mk', value: 50_000_000 },
];

export const BUDGET_SHARE_PRESETS = [
  { label: '5%', value: 0.05, title: 'Ultra seguro: máximo 5% del presupuesto por ítem o unidad' },
  { label: '10%', value: 0.10, title: 'Muy seguro: máximo 10% del presupuesto por ítem o unidad' },
  { label: '15%', value: 0.15, title: 'Recomendado: máximo 15% del presupuesto por ítem o unidad' },
  { label: '20%', value: 0.20, title: 'Equilibrado: máximo 20% del presupuesto por ítem o unidad' },
  { label: '25%', value: 0.25, title: 'Moderado: máximo 25% del presupuesto por ítem o unidad' },
  { label: '35%', value: 0.35, title: 'Flexible: máximo 35% del presupuesto por ítem o unidad' },
  { label: '50%', value: 0.50, title: 'Concentrado: máximo 50% del presupuesto por ítem o unidad' },
  { label: '100%', value: 1.00, title: 'Sin límite: permite que 1 ítem use el 100% del presupuesto' },
];

export const CONFIG_STORAGE_KEY = 'dofus_daily_planner_config_v2';
export const POSTED_STORAGE_KEY = 'dofus_daily_planner_posted_v1';

export interface StoredPlannerConfig {
  budget: number;
  budgetInput: string;
  maxBudgetShare: number;
  optimizationMode: OptimizationMode;
  marketChannel: MarketChannel;
  targetDays: number;
  maxEquipSlots: number;
  maxConsumableSlots: number;
  maxResourceSlots: number;
  maxMarketShare: number;
  onlyMyJobs: boolean;
  requireSalesHistory: boolean;
  recentSalesOnly: boolean;
  filterOutliers: boolean;
  selectedJobFilter: number | 'all';
  minRoiFilter: number;
  minDailySales: number;
  excludedItemIds: number[];
  manualUnitsOverride: Record<number, number>;
  showPostedDrawer: boolean;
  showMaterialsDrawer: boolean;
  useBankResources?: boolean;
  avoidAlreadyListed?: boolean;
}

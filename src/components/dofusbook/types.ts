import {
  DofusbookBuildAnalysis,
  DofusbookEquipmentItem,
  DofusItem,
  ConsolidatedIngredient,
} from '../../types';

export interface DofusbookSetCalculatorProps {
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onNavigateToShopping?: () => void;
}

export const DOFUSBOOK_SESSION_STORAGE_KEY = 'dofus_dofusbook_cached_session_v1';

export type DofusbookFilterStatus = 'all' | 'needed' | 'owned' | 'removed';
export type MaterialsFilter = 'needed' | 'obtained' | 'all';
export type ActiveTabSection = 'comparison' | 'materials';

export interface DofusbookSavedSession {
  urlInput: string;
  excludeDofus: boolean;
  excludeTrophies: boolean;
  analysis: DofusbookBuildAnalysis | null;
  ownedItemKeys: Record<string, boolean>;
  removedItemKeys: Record<string, boolean>;
  activeTabSection: ActiveTabSection;
  showOnlyCraftable: boolean;
  filterStatus: DofusbookFilterStatus;
  obtainedMaterialIds?: Record<number, boolean>;
  materialsFilter?: MaterialsFilter;
}

export interface ProcessedDofusbookItem extends DofusbookEquipmentItem {
  key: string;
  isOwned: boolean;
  isRemoved: boolean;
  isPayable: boolean;
}

export interface DofusbookTotals {
  totalCraftCost: number;
  totalMarketPrice: number;
  totalOptimalCost: number;
  totalSavings: number;
  craftablePiecesCount: number;
  excludedDofusCount: number;
  excludedTrophiesCount: number;
  totalPieces: number;
}

export interface ConsolidatedMaterialItem extends ConsolidatedIngredient {
  isObtained?: boolean;
}

export interface DofusbookComputedData {
  items: ProcessedDofusbookItem[];
  totals: DofusbookTotals;
  consolidatedIngredients: ConsolidatedMaterialItem[];
  neededIngredients: ConsolidatedMaterialItem[];
  obtainedIngredients: ConsolidatedMaterialItem[];
  totalAllMaterialsCost: number;
  totalNeededMaterialsCost: number;
  totalObtainedMaterialsCost: number;
  materialsProgressPercent: number;
  ownedCount: number;
  removedCount: number;
  neededCount: number;
  activePiecesCount: number;
  progressPercent: number;
}

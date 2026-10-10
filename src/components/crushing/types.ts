import { DofusItem } from '../../types';
import { CraftableItem } from '../../services/dofusDbService';
import { CrushingResult, TopFocusOption } from '../../data/dofusRuneWeights';

export interface CrushingCalculatorProps {
  initialSelectedItem?: DofusItem | null;
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
}

export type CrushingViewMode = 'catalog' | 'detail' | 'rune_prices';

export type DateFilterOption =
  | 'all'
  | 'custom_only'
  | 'today'
  | '3days'
  | 'week'
  | 'month'
  | 'default_only';

export type SortOption =
  | 'profit_desc'
  | 'coeff_desc'
  | 'rune_profit_desc'
  | 'roi_desc'
  | 'breakeven_asc'
  | 'cost_asc'
  | 'level_desc'
  | 'date_desc';

export const FILTER_PERSISTENCE_KEY = 'dofus_crushing_filters_v2';
export const CRUSHING_STATE_KEY = 'dofus_crushing_state_v2';

export interface SavedFiltersState {
  searchQuery?: string;
  selectedSlots?: string[];
  minLevel?: number | '';
  maxLevel?: number | '';
  minCoeff?: number | '';
  maxCoeff?: number | '';
  selectedStatFilterIds?: string[];
  dateFilter?: DateFilterOption;
  sortBy?: SortOption;
  currentPage?: number;
  isStatsFilterOpen?: boolean;
}

export interface SavedCrushingViewState {
  viewMode?: CrushingViewMode;
  selectedItemId?: number | null;
}

export interface StatFilterDef {
  id: string;
  runeId?: number;
  iconId?: number;
  textKey?: string;
  name: string;
  color: string;
  glyphType: string;
}

export interface ProcessedCatalogItem {
  item: CraftableItem;
  level: number;
  typeId: number;
  jobId?: number;
  jobNameEs?: string;
  singleCraftCost: number;
  savedCoeff: number;
  coeffTimestamp: number | null;
  isManualEdit: boolean;
  hasCustomCoeff: boolean;
  sim: CrushingResult;
  normalProfit: number;
  normalValue: number;
  normalRoi: number;
  bestFocusProfit: number;
  bestFocusValue: number;
  bestFocusRoi: number;
  bestFocusRune: any;
  bestStratIsNormal: boolean;
  maxProfit: number;
  maxKamasValue: number;
  maxRoi: number;
  breakEvenCoeff: number;
  targetRuneYield: any;
  runeSpecificRunes: number;
  runeSpecificKamas: number;
}

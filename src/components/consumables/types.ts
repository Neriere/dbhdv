import {
  CharacteristicScrollItem,
  CharacteristicConsumableItem,
} from '../../data/characteristicConsumablesData';

export type MainTab = 'scrolls' | 'consumables';
export type StatFilter =
  | 'Todas'
  | 'Fuerza'
  | 'Vitalidad'
  | 'Sabiduría'
  | 'Inteligencia'
  | 'Suerte'
  | 'Agilidad';
export type JobFilter =
  | 'Todos'
  | 'Cazador'
  | 'Pescador'
  | 'Campesino'
  | 'Alquimista';
export type SortFieldScroll =
  | 'profitDaily'
  | 'ratio'
  | 'sales24h'
  | 'avgDailySales'
  | 'price'
  | 'name'
  | 'sebuscalines';

export interface ProcessedScrollItem extends CharacteristicScrollItem {
  price: number;
  sales24h: number;
  sales7d: number;
  sales30d: number;
  avgDailySales: number;
  ratio: number;
  vsTourmalinePct: number;
  profitDaily: number;
  priorityScore: number;
}

export interface ProcessedConsumableIngredient {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
}

export interface ProcessedConsumableItem extends CharacteristicConsumableItem {
  marketPrice: number;
  craftCost: number;
  missingPrices: boolean;
  effectiveCost: number;
  costPerPoint: number;
  ingredientsWithPrice: ProcessedConsumableIngredient[];
  equivalentScrollTier: 'pequeño' | 'mediano' | 'grande' | 'potente';
  equivScroll?: CharacteristicScrollItem;
  equivScrollPrice: number;
  equivScrollCostPerPoint: number;
  savingsVsScrollPct: number;
}

export interface SimulationPlanItem {
  scroll: ProcessedScrollItem;
  count: number;
  costSeb: number;
  estKamas: number;
}

export interface SimulationResult {
  plan: SimulationPlanItem[];
  spentSeb: number;
  remainingSeb: number;
  totalKamas: number;
  globalRatio: number;
}

export interface StatProgressionAnalysis {
  costScrollsOnly: number;
  pPeq?: ProcessedScrollItem;
  pMed?: ProcessedScrollItem;
  pGra?: ProcessedScrollItem;
  pPot?: ProcessedScrollItem;
  bestConsumable0to25?: ProcessedConsumableItem;
  bestConsumable25to50?: ProcessedConsumableItem;
  bestConsumable50to80?: ProcessedConsumableItem;
  bestConsumable80to100?: ProcessedConsumableItem;
}

export function getStatBadgeClass(stat: string): string {
  switch (stat) {
    case 'Fuerza':
      return 'bg-amber-950/60 text-amber-300 border-amber-500/30';
    case 'Vitalidad':
      return 'bg-rose-950/60 text-rose-300 border-rose-500/30';
    case 'Sabiduría':
      return 'bg-purple-950/60 text-purple-300 border-purple-500/30';
    case 'Inteligencia':
      return 'bg-orange-950/60 text-orange-300 border-orange-500/30';
    case 'Suerte':
      return 'bg-sky-950/60 text-sky-300 border-sky-500/30';
    case 'Agilidad':
      return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30';
    default:
      return 'bg-teal-950/60 text-teal-300 border-teal-500/30';
  }
}

import { DofusItem } from '../../types';

export interface RecipeCalculatorProps {
  initialSelectedItem?: DofusItem | null;
  onSelectForCrushing?: (item: DofusItem) => void;
}

export interface ItemMetrics {
  cost: number;
  salePrice: number;
  netProfit: number;
  roi: number;
  missingIngredientsCount: number;
  hasFullIngredientPrices: boolean;
  avgDailySales: number;
  hasSalesData: boolean;
  expectedDailyFlow: number;
  daysToSell: number | null;
  turnoverRating: 'alta' | 'media' | 'baja' | null;
  turnoverLabel: string | null;
}

export const getJobBadgeStyle = (jobName: string): string => {
  const name = (jobName || '').toLowerCase();
  if (name.includes('mapa') || name.includes('tesoro'))
    return 'bg-amber-500/20 border-amber-500/40 text-amber-200';
  if (name.includes('alquimista'))
    return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
  if (name.includes('campesino'))
    return 'bg-amber-500/20 border-amber-500/40 text-amber-300';
  if (name.includes('cazador'))
    return 'bg-orange-500/20 border-orange-500/40 text-orange-300';
  if (name.includes('leñador') || name.includes('lenador'))
    return 'bg-lime-500/20 border-lime-500/40 text-lime-300';
  if (name.includes('minero'))
    return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300';
  if (name.includes('pescador'))
    return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
  if (name.includes('runa') || name.includes('forjamagia'))
    return 'bg-violet-500/20 border-violet-500/40 text-violet-300';
  if (
    name.includes('equipamiento') ||
    name.includes('forjador') ||
    name.includes('zapatero') ||
    name.includes('sastre') ||
    name.includes('joyero') ||
    name.includes('escultor')
  ) {
    return 'bg-purple-500/20 border-purple-500/40 text-purple-300';
  }
  return 'bg-neutral-800 border-neutral-700 text-neutral-300';
};

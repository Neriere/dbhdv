import { LegendaryHuntInfo } from '../../data/legendaryHuntsData';
import { BycRecipeIngredient } from '../../data/bycDatabase';

export interface TreasureHuntCalculatorProps {
  onNavigateToShopping?: () => void;
  onNavigateToBank?: () => void;
}

export interface CalculatedBycEquipment {
  id: number;
  name: string;
  level: number;
  type: string;
  iconId: number;
  salePriceGross: number;
  salePriceNet: number;
  resourceQtyNeeded: number;
  otherIngredientsCost: number;
  totalInvestmentHunt: number;
  totalRevenueHunt: number;
  netProfitHunt: number;
  roiHunt: number;
  totalInvestmentHdv: number;
  netProfitHdv: number;
  roiHdv: number;
  optimalMethod: 'hunt' | 'hdv';
  optimalInvestment: number;
  optimalNetProfit: number;
  optimalRoi: number;
  addedValueVsRawSale: number;
  recipeIngredients: BycRecipeIngredient[];
}

export interface CalculatedHunt extends LegendaryHuntInfo {
  wholeMapPrice: number;
  fragmentsTotal: number;
  isFragmentsCheaper: boolean;
  bestEntryCost: number;
  entryMethodSavings: number;
  resourcePrice: number;
  sebuscalinesValue: number;
  totalRewardValue: number;
  netProfit: number;
  roiPercent: number;
  huntVsBuyBenefit: number;
  bankFragmentsCount: number;
  hasMapInBank: boolean;
  calculatedEquipments: CalculatedBycEquipment[];
  bestCraftEquipment: CalculatedBycEquipment | null;
}

export const ZONE_FILTERS = [
  { id: 'all', label: 'Todas las zonas' },
  { id: 'Astrub', label: 'Astrub' },
  { id: 'Castillo de Amakna', label: 'Castillo de Amakna' },
  { id: 'Base de los Justicieros', label: 'Base de los Justicieros' },
  { id: 'Frigost I', label: 'Frigost I' },
  { id: 'Frigost II', label: 'Frigost II' },
  { id: 'Frigost III', label: 'Frigost III' },
  { id: 'Anutropía', label: 'Anutropía' },
  { id: 'Sramvil', label: 'Sramvil' },
  { id: 'Zurcalia', label: 'Zurcalia' },
];

export const formatKamas = (amount: number): string => {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1000000) {
    const val = (abs / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${sign}${val}mk`;
  }
  if (abs >= 1000) {
    const val = (abs / 1000).toFixed(1).replace(/\.0$/, '');
    return `${sign}${val}kk`;
  }
  return `${sign}${abs.toLocaleString()} K`;
};

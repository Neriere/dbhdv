import { CraftableItem } from '../../../services/dofusDbService';
import { DofusRecipe } from '../../../types';

export interface JobLevelingOptimizerProps {
  initialJobId?: number;
  onNavigateToShopping?: () => void;
}

export interface CatalogRecipeItem {
  item: CraftableItem;
  recipe: DofusRecipe;
  level: number;
  craftCost: number;
  marketPrice: number;
  netSale: number;
  totalRevenue: number;
  profit: number;
  sebuscalinesEarned: number;
  sebuscalinesValue: number;
  xpAtCurrent: number;
  avgDailySales: number;
  turnoverRating?: string;
  requiresByc: boolean;
  requiresPebbles: boolean;
  isEquip: boolean;
  name: string;
}

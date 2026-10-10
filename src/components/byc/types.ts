import { LegendaryHuntInfo } from '../../data/legendaryHuntsData';
import { BankInventoryItem } from '../../services/dofusDbService';

export interface BycDetailPageProps {
  hunt: LegendaryHuntInfo;
  onBack: () => void;
  onSelectHunt: (hunt: LegendaryHuntInfo) => void;
  marketPrices: Record<number, number>;
  bankInventory: BankInventoryItem[] | Record<number, number>;
  sebuscalinPrice: number;
  onUpdateSebuscalinPrice: (price: number) => void;
  sandRosePrice?: number;
  onUpdateSandRosePrice?: (price: number) => void;
  onPriceChange: (itemId: number, newPrice: number) => void;
  onNavigateToShopping?: () => void;
  onNavigateToBank?: () => void;
  showToast: (msg: string) => void;
}

export type BycAcquisitionMethod = 'fragments' | 'map' | 'hdv';

export const MARKET_TAX_RATE = 0.02; // 2% HDV Tax

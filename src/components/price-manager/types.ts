import React from 'react';
import {
  Wheat,
  Axe,
  FlaskConical,
  Pickaxe,
  Fish,
  Drumstick,
  Heart,
} from 'lucide-react';
import { DofusItem } from '../../types';

export type PriceFilterCategory =
  | 'all'
  | 'dofus'
  | 'runes'
  | 'craft_ingredients'
  | 'campesino'
  | 'lenador'
  | 'alquimista'
  | 'minero'
  | 'pescador'
  | 'cazador'
  | 'ganadero'
  | 'monsters'
  | 'equipment'
  | 'has_price'
  | 'without_price';

export type ItemScopeFilter = 'all_scope' | 'resources_only' | 'craftable_only';
export type SortByField = 'default' | 'sales24h' | 'sales7d' | 'sales30d' | 'avgDaily';

export interface PriceManagerProps {
  onSelectItemForRecipe?: (item: DofusItem) => void;
}

export interface GatheringCategoryDef {
  id: PriceFilterCategory;
  label: string;
  icon: React.ElementType;
  color: string;
  jobId: number;
}

export const GATHERING_CATEGORIES: GatheringCategoryDef[] = [
  {
    id: 'campesino',
    label: 'Campesino',
    icon: Wheat,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    jobId: 28,
  },
  {
    id: 'lenador',
    label: 'Leñador',
    icon: Axe,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    jobId: 2,
  },
  {
    id: 'alquimista',
    label: 'Alquimista',
    icon: FlaskConical,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    jobId: 26,
  },
  {
    id: 'minero',
    label: 'Minero',
    icon: Pickaxe,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    jobId: 24,
  },
  {
    id: 'pescador',
    label: 'Pescador',
    icon: Fish,
    color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    jobId: 36,
  },
  {
    id: 'cazador',
    label: 'Cazador',
    icon: Drumstick,
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    jobId: 41,
  },
  {
    id: 'ganadero',
    label: 'Ganadero',
    icon: Heart,
    color: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
    jobId: 101,
  },
];

export const MONSTER_DROP_TYPE_IDS = new Set([
  47, 48, 53, 54, 55, 56, 57, 59, 103, 104, 105, 106, 107, 108, 109, 110, 111, 119,
  15, 74, 96, 98, 152, 219, 229, 278,
]);

export const ALL_RESOURCE_TYPES_SET = new Set([
  12, 15, 26, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 46, 47, 48, 49, 50, 51, 53,
  54, 55, 56, 57, 58, 59, 60, 62, 63, 64, 66, 68, 69, 70, 71, 79, 83, 85, 91, 95,
  96, 98, 99, 103, 104, 105, 106, 107, 108, 109, 110, 111, 119, 128, 129, 134,
  135, 150, 152, 153, 167, 170, 179, 183, 185, 187, 206, 219, 228, 229, 242, 278,
  307, 308,
]);

export const EQUIPMENT_TYPE_IDS_SET = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 82, 112, 151, 217, 271,
]);

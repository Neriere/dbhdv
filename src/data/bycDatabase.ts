// Base de datos oficial y completa de Cacerías Legendarias de Se Busca (Avis de Recherche) de Dofus
// Sincronizada con DofusDB y DofusPourLesNoobs con IDs oficiales de Dofus Unity
import bycRawData from "./bycGeneratedDb.json" with { type: "json" };

export interface BycRecipeIngredient {
  id: number;
  name: string;
  quantity: number;
  defaultPrice: number;
  iconId: number;
  img: string;
}

export interface BycEquipmentItem {
  id: number;
  name: string;
  name_fr?: string;
  level: number;
  type: string;
  iconId: number;
  img: string;
  defaultSalePrice: number;
  resourceQuantityNeeded: number;
  recipeIngredients: BycRecipeIngredient[];
}

export interface BycFragmentItem {
  id: number;
  name: string;
  name_fr?: string;
  iconId: number;
  img: string;
  defaultPrice: number;
}

export interface BycMapItem {
  id: number;
  name: string;
  name_fr?: string;
  iconId: number;
  img: string;
  defaultPrice: number;
}

export interface BycResourceItem {
  id: number;
  name: string;
  name_fr?: string;
  iconId: number;
  img: string;
  type: string;
  defaultPrice: number;
}

export interface BycHuntData {
  id: number;
  monsterName: string;
  monsterNameFr: string;
  monsterLevel: number;
  minLevel?: number;
  category: string;
  mapItem: BycMapItem;
  fragments: BycFragmentItem[];
  resource: BycResourceItem;
  equipments: BycEquipmentItem[];
  sebuscalines: number;
  missionSebuscalines?: number;
  chestSebuscalines?: number;
  iceKamas: number;
}

export const CANONICAL_MAP_ICON_ID = 77041;
export const CANONICAL_FRAGMENT_ICON_ID = 77042;

export const BYC_LEGENDARY_HUNTS: BycHuntData[] = bycRawData as unknown as BycHuntData[];

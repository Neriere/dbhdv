// Base de datos de equipables asociados a Cacerías Legendarias de Se Busca (Avis de Recherche)
import { BYC_LEGENDARY_HUNTS, BycHuntData, BycEquipmentItem, BycRecipeIngredient } from "./bycDatabase";

export type { BycRecipeIngredient };

export interface BycRelatedEquipment extends BycEquipmentItem {}

export const BYC_EQUIPMENT_BY_HUNT_ID: Record<number, BycRelatedEquipment[]> = {};

// Populate map by Hunt ID, Map ID, and Resource ID for instant O(1) lookup
BYC_LEGENDARY_HUNTS.forEach((h: BycHuntData) => {
  BYC_EQUIPMENT_BY_HUNT_ID[h.id] = h.equipments;
  BYC_EQUIPMENT_BY_HUNT_ID[h.mapItem.id] = h.equipments;
  BYC_EQUIPMENT_BY_HUNT_ID[h.resource.id] = h.equipments;
});

export function getRelatedEquipmentForHunt(
  huntId: number,
  monsterName?: string,
  monsterLevel?: number,
  resourceId?: number,
  resourceName?: string,
  resourcePrice?: number
): BycRelatedEquipment[] {
  // 1. Direct ID lookup
  if (BYC_EQUIPMENT_BY_HUNT_ID[huntId] && BYC_EQUIPMENT_BY_HUNT_ID[huntId].length > 0) {
    return BYC_EQUIPMENT_BY_HUNT_ID[huntId];
  }
  if (resourceId && BYC_EQUIPMENT_BY_HUNT_ID[resourceId] && BYC_EQUIPMENT_BY_HUNT_ID[resourceId].length > 0) {
    return BYC_EQUIPMENT_BY_HUNT_ID[resourceId];
  }

  // 2. Name matching
  if (monsterName) {
    const found = BYC_LEGENDARY_HUNTS.find(
      h => h.monsterName.toLowerCase() === monsterName.toLowerCase() ||
           h.monsterNameFr.toLowerCase() === monsterName.toLowerCase() ||
           monsterName.toLowerCase().includes(h.monsterName.toLowerCase()) ||
           h.monsterName.toLowerCase().includes(monsterName.toLowerCase())
    );
    if (found && found.equipments.length > 0) {
      return found.equipments;
    }
  }

  return [];
}

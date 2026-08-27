// Archivo generado y sincronizado con la base de datos oficial de Cacerías Legendarias de Dofus
import { BYC_LEGENDARY_HUNTS, BycHuntData, BycFragmentItem } from "./bycDatabase";

export interface LegendaryHuntInfo {
  id: number;
  monsterName: string;
  monsterLevel: number;
  levelRequirement: string;
  minLevel: number;
  zone: string;
  subArea?: string;
  sebuscalines: number;
  missionSebuscalines: number;
  chestSebuscalines: number;
  // ByC Monster Drop Resource
  resource: {
    id: number;
    name: string;
    iconId: number;
    defaultPrice: number;
    description?: string;
  };
  // Full Map
  mapItem: {
    id: number;
    name: string;
    iconId: number;
    defaultPrice: number;
  };
  // Fragments info
  fragments: {
    count: number;
    baseName: string;
    fragmentIds: number[];
    defaultUnitPrice: number;
    items?: BycFragmentItem[];
  };
}

export const CANONICAL_MAP_ICON_ID = 77041;
export const CANONICAL_FRAGMENT_ICON_ID = 77042;

export const LEGENDARY_HUNTS: LegendaryHuntInfo[] = BYC_LEGENDARY_HUNTS.map((h: BycHuntData) => {
  const missionSebus = h.missionSebuscalines || h.sebuscalines * 2;
  const chestSebus = h.chestSebuscalines || h.sebuscalines;
  const minLvl = h.minLevel || h.monsterLevel;

  return {
    id: h.id,
    monsterName: h.monsterName,
    monsterLevel: h.monsterLevel,
    levelRequirement: `Req. Nivel ${minLvl}`,
    minLevel: minLvl,
    zone: h.category,
    subArea: h.monsterNameFr ? `FR: ${h.monsterNameFr}` : undefined,
    sebuscalines: chestSebus,
    missionSebuscalines: missionSebus,
    chestSebuscalines: chestSebus,
    resource: {
      id: h.resource.id,
      name: h.resource.name,
      iconId: h.resource.iconId,
      defaultPrice: h.resource.defaultPrice,
      description: "Recurso oficial obtenido al vencer al Se Busca " + h.monsterName
    },
    mapItem: {
      id: h.mapItem.id,
      name: h.mapItem.name,
      iconId: CANONICAL_MAP_ICON_ID,
      defaultPrice: h.mapItem.defaultPrice
    },
    fragments: {
      count: h.fragments.length,
      baseName: "Fragmento de " + h.mapItem.name,
      fragmentIds: h.fragments.map(f => f.id),
      defaultUnitPrice: h.fragments[0]?.defaultPrice || 40000,
      items: h.fragments
    }
  };
});

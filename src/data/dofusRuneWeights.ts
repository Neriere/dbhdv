// Official Dofus Characteristic Runic Weights (Poids de Rune / Pesos Rúnicos)
// Used in Crushing Calculators (Brisage de Runes / Rompimiento de Objetos)

export interface CharacteristicRuneInfo {
  id: number;
  nameEs: string;
  nameFr: string;
  nameEn: string;
  unitWeight: number; // Peso unitario de la característica
  runeName: string;
  runeUnitValue: number; // Cuánto da 1 sola runa (ej: Runa Fo = 1 Fuerza, Pa Fo = 3 Fuerza, Ra Fo = 10 Fuerza)
  normalRuneValue: number; // 1
  paRuneValue: number; // 3
  raRuneValue: number; // 10
}

export const DOFUS_RUNE_WEIGHTS: Record<number, CharacteristicRuneInfo> = {
  // PA & PM
  1: {
    id: 1,
    nameEs: "Puntos de Acción (PA)",
    nameFr: "Point d'action (PA)",
    nameEn: "Action Point (AP)",
    unitWeight: 100,
    runeName: "Runa Ga PA",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 0,
    raRuneValue: 0,
  },
  111: {
    id: 111,
    nameEs: "Puntos de Acción (PA)",
    nameFr: "Point d'action (PA)",
    nameEn: "Action Point (AP)",
    unitWeight: 100,
    runeName: "Runa Ga PA",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 0,
    raRuneValue: 0,
  },
  128: {
    id: 128,
    nameEs: "Puntos de Movimiento (PM)",
    nameFr: "Point de mouvement (PM)",
    nameEn: "Movement Point (MP)",
    unitWeight: 90,
    runeName: "Runa Ga PM",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 0,
    raRuneValue: 0,
  },
  117: {
    id: 117,
    nameEs: "Alcance",
    nameFr: "Portée",
    nameEn: "Range",
    unitWeight: 51,
    runeName: "Runa Al",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 0,
    raRuneValue: 0,
  },
  182: {
    id: 182,
    nameEs: "Invocaciones",
    nameFr: "Invocations",
    nameEn: "Summons",
    unitWeight: 30,
    runeName: "Runa Invo",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 0,
    raRuneValue: 0,
  },
  115: {
    id: 115,
    nameEs: "% Golpes Críticos",
    nameFr: "% Coup Critique",
    nameEn: "% Critical Hit",
    unitWeight: 10,
    runeName: "Runa Cri",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  124: {
    id: 124,
    nameEs: "Sabiduría",
    nameFr: "Sagesse",
    nameEn: "Wisdom",
    unitWeight: 3,
    runeName: "Runa Sab",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  125: {
    id: 125,
    nameEs: "Vitalidad",
    nameFr: "Vitalité",
    nameEn: "Vitality",
    unitWeight: 0.25,
    runeName: "Runa Vi",
    runeUnitValue: 5,
    normalRuneValue: 5,
    paRuneValue: 15,
    raRuneValue: 50,
  },
  118: {
    id: 118,
    nameEs: "Fuerza",
    nameFr: "Force",
    nameEn: "Strength",
    unitWeight: 1,
    runeName: "Runa Fo",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  126: {
    id: 126,
    nameEs: "Inteligencia",
    nameFr: "Intelligence",
    nameEn: "Intelligence",
    unitWeight: 1,
    runeName: "Runa In",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  119: {
    id: 119,
    nameEs: "Agilidad",
    nameFr: "Agilité",
    nameEn: "Agility",
    unitWeight: 1,
    runeName: "Runa Ag",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  123: {
    id: 123,
    nameEs: "Suerte",
    nameFr: "Chance",
    nameEn: "Chance",
    unitWeight: 1,
    runeName: "Runa Cha",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  176: {
    id: 176,
    nameEs: "Prosrección",
    nameFr: "Prospection",
    nameEn: "Prospecting",
    unitWeight: 3,
    runeName: "Runa Prosp",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  174: {
    id: 174,
    nameEs: "Iniciativa",
    nameFr: "Initiative",
    nameEn: "Initiative",
    unitWeight: 0.1,
    runeName: "Runa Ini",
    runeUnitValue: 10,
    normalRuneValue: 10,
    paRuneValue: 30,
    raRuneValue: 100,
  },
  158: {
    id: 158,
    nameEs: "Pods",
    nameFr: "Pods",
    nameEn: "Pods",
    unitWeight: 0.25,
    runeName: "Runa Pod",
    runeUnitValue: 10,
    normalRuneValue: 10,
    paRuneValue: 30,
    raRuneValue: 100,
  },
  112: {
    id: 112,
    nameEs: "Daños Generales",
    nameFr: "Dommages",
    nameEn: "Damage",
    unitWeight: 20,
    runeName: "Runa Da",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  138: {
    id: 138,
    nameEs: "Daños Críticos",
    nameFr: "Dommages Critiques",
    nameEn: "Critical Damage",
    unitWeight: 15,
    runeName: "Runa Da Cri",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  178: {
    id: 178,
    nameEs: "Curas",
    nameFr: "Soins",
    nameEn: "Heals",
    unitWeight: 20,
    runeName: "Runa Cur",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  160: {
    id: 160,
    nameEs: "Huida",
    nameFr: "Fuite",
    nameEn: "Dodge",
    unitWeight: 4,
    runeName: "Runa Hui",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  161: {
    id: 161,
    nameEs: "Placaje",
    nameFr: "Tacle",
    nameEn: "Lock",
    unitWeight: 4,
    runeName: "Runa Pla",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
  175: {
    id: 175,
    nameEs: "Placaje / Huida",
    nameFr: "Tacle / Fuite",
    nameEn: "Lock / Dodge",
    unitWeight: 8,
    runeName: "Runa Pla Hui",
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  },
};

// Fallback for unknown characteristics
export const DEFAULT_RUNE_WEIGHT = 1;

/**
 * Returns weight for characteristic or effect ID
 */
export function getCharacteristicWeight(characteristicId?: number, effectId?: number): CharacteristicRuneInfo {
  const id = characteristicId || effectId || 0;
  if (DOFUS_RUNE_WEIGHTS[id]) {
    return DOFUS_RUNE_WEIGHTS[id];
  }
  return {
    id,
    nameEs: `Efecto #${id}`,
    nameFr: `Effet #${id}`,
    nameEn: `Effect #${id}`,
    unitWeight: 1,
    runeName: `Runa #${id}`,
    runeUnitValue: 1,
    normalRuneValue: 1,
    paRuneValue: 3,
    raRuneValue: 10,
  };
}

/**
 * Formula for calculating crushing rune output based on item level, stat values, weight, and coefficient %
 */
export function calculateItemCrushing(
  itemLevel: number,
  statMax: number,
  unitWeight: number,
  coefficientPercent: number = 100
) {
  // Classic Dofus 2.x & Dofus 3.0 crushing formula approximation:
  // Base power = (3 * (level^1.6) / 200) * (statValue * unitWeight) * (coeff / 100)
  const itemLevelMultiplier = Math.pow(itemLevel / 100, 1.5) * 3;
  const statRunePower = statMax * unitWeight;
  const totalPower = statRunePower * itemLevelMultiplier * (coefficientPercent / 100);

  // Convert total rune power to estimated rune yield
  let expectedRunes = Math.max(0, Math.floor(totalPower / Math.max(1, unitWeight)));
  
  return {
    itemLevelMultiplier: Number(itemLevelMultiplier.toFixed(2)),
    statRunePower: Number(statRunePower.toFixed(2)),
    totalPower: Number(totalPower.toFixed(2)),
    expectedRunes,
  };
}

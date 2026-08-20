// Official Dofus Characteristic Runic Weights & Base Runes Database
// Based on Dofus Brisage Mechanics & Kamaskope Standard:
// Formula: LinePower_i = (3 * (StatVal_i / StatPerRune_i) * UnitWeight_i * (Level / 200) + 1)
// Normal Runes = (LinePower_i * (Coeff / 100)) / UnitWeight_i
// Focus Runes = ((LinePower_K + SUM_other(LinePower_j / 2)) * (Coeff / 100)) / UnitWeight_K

import { DofusEffect, DofusItem } from "../types";

export interface BaseRuneDefinition {
  id: number; // Authentic Item ID for the rune in Dofus
  name: string; // Spanish name
  nameFr: string;
  nameEn: string;
  shortCode: string;
  symbol: string;
  color: string;
  characteristicId: number; // Primary characteristic ID in DofusDB
  effectIds: number[]; // DofusDB effect IDs matching this rune
  unitWeight: number; // Poids / Peso rúnico
  statPerRune: number; // How much stat 1 base rune represents (e.g. Vi=5, Ini=10, Pods=10, others=1)
  category: "primaria" | "secundaria" | "dano" | "resistencia" | "especial";
  iconId: number; // Authentic DofusDB icon ID
  defaultPrice: number; // Default price in Kamas
  description: string;
  textMatches?: string[]; // Keywords for fallback regex matching
}

export const DOFUS_BASE_RUNES: BaseRuneDefinition[] = [
  // ==========================================
  // 1. CARACTERÍSTICAS ESPECIALES / EXÓTICAS
  // ==========================================
  {
    id: 1557,
    name: "Runa Ga PA",
    nameFr: "Rune Ga PA",
    nameEn: "AP Rune",
    shortCode: "PA",
    symbol: "PA",
    color: "#f59e0b",
    characteristicId: 1,
    effectIds: [111, 1],
    unitWeight: 100,
    statPerRune: 1,
    category: "especial",
    iconId: 78055,
    defaultPrice: 50000,
    description: "+1 Punto de Acción (PA)",
    textMatches: ["pa", "punto de acción", "puntos de acción", "point d'action", "action point"],
  },
  {
    id: 1558,
    name: "Runa Ga PM",
    nameFr: "Rune Ga PM",
    nameEn: "MP Rune",
    shortCode: "PM",
    symbol: "PM",
    color: "#10b981",
    characteristicId: 23,
    effectIds: [128, 23],
    unitWeight: 90,
    statPerRune: 1,
    category: "especial",
    iconId: 78056,
    defaultPrice: 35000,
    description: "+1 Punto de Movimiento (PM)",
    textMatches: ["pm", "punto de movimiento", "puntos de movimiento", "point de mouvement", "movement point"],
  },
  {
    id: 7438,
    name: "Runa Al",
    nameFr: "Rune Po",
    nameEn: "Range Rune",
    shortCode: "AL",
    symbol: "AL",
    color: "#38bdf8",
    characteristicId: 19,
    effectIds: [117, 19, 116],
    unitWeight: 51,
    statPerRune: 1,
    category: "especial",
    iconId: 78018,
    defaultPrice: 6600,
    description: "+1 Alcance",
    textMatches: ["alcance", "portée", "portee", "range", "al", "po"],
  },
  {
    id: 7442,
    name: "Runa Invo",
    nameFr: "Rune Invo",
    nameEn: "Summon Rune",
    shortCode: "INVO",
    symbol: "INV",
    color: "#a855f7",
    characteristicId: 26,
    effectIds: [182, 26, 48],
    unitWeight: 30,
    statPerRune: 1,
    category: "especial",
    iconId: 78019,
    defaultPrice: 12000,
    description: "+1 Invocación",
    textMatches: ["invocación", "invocacion", "invocaciones", "invocation", "invocations", "summon"],
  },
  {
    id: 7433,
    name: "Runa Cri",
    nameFr: "Rune Cri",
    nameEn: "Crit Rune",
    shortCode: "CRI",
    symbol: "CRI",
    color: "#ec4899",
    characteristicId: 18,
    effectIds: [115, 18],
    unitWeight: 10,
    statPerRune: 1,
    category: "especial",
    iconId: 78014,
    defaultPrice: 2500,
    description: "+1% Golpe Crítico",
    textMatches: ["golpe crítico", "golpe critico", "golpes críticos", "golpes criticos", "coup critique", "critical hit", "% crítico", "% critico", "% cri", "crítico", "critique"],
  },
  {
    id: 10057,
    name: "Runa de Caza",
    nameFr: "Rune de Chasse",
    nameEn: "Hunting Rune",
    shortCode: "CAZA",
    symbol: "CAZA",
    color: "#84cc16",
    characteristicId: 795,
    effectIds: [795, 129, 66],
    unitWeight: 5,
    statPerRune: 1,
    category: "especial",
    iconId: 10057,
    defaultPrice: 1500,
    description: "Arma de Caza (permite recolectar carnes)",
    textMatches: ["arma de caza", "arme de chasse", "hunting weapon", "caza", "chasse"],
  },

  // ==========================================
  // 2. CARACTERÍSTICAS PRIMARIAS
  // ==========================================
  {
    id: 1519,
    name: "Runa Fo",
    nameFr: "Rune Fo",
    nameEn: "Str Rune",
    shortCode: "FO",
    symbol: "FO",
    color: "#b45309",
    characteristicId: 10,
    effectIds: [118, 10],
    unitWeight: 1,
    statPerRune: 1,
    category: "primaria",
    iconId: 78043,
    defaultPrice: 75,
    description: "+1 Fuerza",
    textMatches: ["fuerza", "force", "strength", "fo", "fu"],
  },
  {
    id: 1522,
    name: "Runa Inte",
    nameFr: "Rune Ine",
    nameEn: "Int Rune",
    shortCode: "INE",
    symbol: "INE",
    color: "#ef4444",
    characteristicId: 15,
    effectIds: [126, 15],
    unitWeight: 1,
    statPerRune: 1,
    category: "primaria",
    iconId: 78037,
    defaultPrice: 44,
    description: "+1 Inteligencia",
    textMatches: ["inteligencia", "intelligence", "inte", "ine"],
  },
  {
    id: 1525,
    name: "Runa Sue",
    nameFr: "Rune Cha",
    nameEn: "Cha Rune",
    shortCode: "CHA",
    symbol: "CHA",
    color: "#0ea5e9",
    characteristicId: 13,
    effectIds: [123, 13],
    unitWeight: 1,
    statPerRune: 1,
    category: "primaria",
    iconId: 78040,
    defaultPrice: 61,
    description: "+1 Suerte",
    textMatches: ["suerte", "chance", "cha", "sue"],
  },
  {
    id: 1524,
    name: "Runa Agi",
    nameFr: "Rune Age",
    nameEn: "Agi Rune",
    shortCode: "AGI",
    symbol: "AGI",
    color: "#14b8a6",
    characteristicId: 14,
    effectIds: [119, 14],
    unitWeight: 1,
    statPerRune: 1,
    category: "primaria",
    iconId: 78046,
    defaultPrice: 75,
    description: "+1 Agilidad",
    textMatches: ["agilidad", "agilité", "agility", "agi", "age"],
  },
  {
    id: 1523,
    name: "Runa Vi",
    nameFr: "Rune Vi",
    nameEn: "Vit Rune",
    shortCode: "VI",
    symbol: "VI",
    color: "#e11d48",
    characteristicId: 11,
    effectIds: [125, 110, 11],
    unitWeight: 1, // 1 Runa Vi (+5 Vi) has weight 1.0 (0.2 per point)
    statPerRune: 5, // 1 Runa Vi = 5 Vitalidad
    category: "primaria",
    iconId: 78052,
    defaultPrice: 168,
    description: "+5 Vitalidad",
    textMatches: ["vitalidad", "vitalité", "vitality", "vida", "vi"],
  },
  {
    id: 1521,
    name: "Runa Sa",
    nameFr: "Rune Sa",
    nameEn: "Wis Rune",
    shortCode: "SAB",
    symbol: "SA",
    color: "#8b5cf6",
    characteristicId: 12,
    effectIds: [124, 12],
    unitWeight: 3,
    statPerRune: 1,
    category: "primaria",
    iconId: 78049,
    defaultPrice: 310,
    description: "+1 Sabiduría",
    textMatches: ["sabiduría", "sabiduria", "sagesse", "wisdom", "sa", "sab"],
  },
  {
    id: 7436,
    name: "Runa Pot",
    nameFr: "Rune Pui",
    nameEn: "Power Rune",
    shortCode: "POT",
    symbol: "POT",
    color: "#f97316",
    characteristicId: 25,
    effectIds: [186, 139, 138, 25],
    unitWeight: 2,
    statPerRune: 1,
    category: "primaria",
    iconId: 78016,
    defaultPrice: 300,
    description: "+1 Potencia",
    textMatches: ["potencia", "puissance", "power", "% de daños", "% de danos", "% dommages", "pui", "pot"],
  },

  // ==========================================
  // 3. DAÑOS Y CURAS
  // ==========================================
  {
    id: 7435,
    name: "Runa Da",
    nameFr: "Rune Do",
    nameEn: "Dmg Rune",
    shortCode: "DA",
    symbol: "DA",
    color: "#fb923c",
    characteristicId: 16,
    effectIds: [112, 121, 16],
    unitWeight: 20,
    statPerRune: 1,
    category: "dano",
    iconId: 78015,
    defaultPrice: 3500,
    description: "+1 Daños Generales",
    textMatches: ["daños generales", "danos generales", "dommages généraux", "damage", "daños", "danos"],
  },
  {
    id: 7434,
    name: "Runa Cu",
    nameFr: "Rune So",
    nameEn: "Heal Rune",
    shortCode: "CUR",
    symbol: "CU",
    color: "#f43f5e",
    characteristicId: 49,
    effectIds: [178, 179, 49, 105, 114],
    unitWeight: 10,
    statPerRune: 1,
    category: "dano",
    iconId: 78013,
    defaultPrice: 398,
    description: "+1 Curación",
    textMatches: ["curación", "curacion", "curaciones", "curas", "cura", "soins", "soin", "heals", "healing", "so"],
  },
  {
    id: 11653,
    name: "Runa Da Cri",
    nameFr: "Rune Do Cri",
    nameEn: "Crit Dmg Rune",
    shortCode: "DACRI",
    symbol: "DCRI",
    color: "#db2777",
    characteristicId: 86,
    effectIds: [138, 220, 70, 86],
    unitWeight: 5,
    statPerRune: 1,
    category: "dano",
    iconId: 78073,
    defaultPrice: 1200,
    description: "+1 Daños Críticos",
    textMatches: ["daños críticos", "daños de golpes críticos", "daños criticos", "daño crítico", "danos criticos", "dommages critiques", "do cri", "critical damage"],
  },
  {
    id: 11659,
    name: "Runa Da Fuego",
    nameFr: "Rune Do Feu",
    nameEn: "Fire Dmg Rune",
    shortCode: "DAFUE",
    symbol: "DFUE",
    color: "#dc2626",
    characteristicId: 89,
    effectIds: [424, 226],
    unitWeight: 5,
    statPerRune: 1,
    category: "dano",
    iconId: 78063,
    defaultPrice: 1177,
    description: "+1 Daños de Fuego (fijos)",
    textMatches: ["daños de fuego", "daños fuego", "daño de fuego", "daño fuego", "danos fuego", "danos de fuego", "dommages feu", "do feu", "fire damage"],
  },
  {
    id: 11657,
    name: "Runa Da Tierra",
    nameFr: "Rune Do Terre",
    nameEn: "Earth Dmg Rune",
    shortCode: "DATIE",
    symbol: "DTIE",
    color: "#92400e",
    characteristicId: 88,
    effectIds: [422, 225],
    unitWeight: 5,
    statPerRune: 1,
    category: "dano",
    iconId: 78065,
    defaultPrice: 900,
    description: "+1 Daños de Tierra (fijos)",
    textMatches: ["daños de tierra", "daños tierra", "daño de tierra", "daño tierra", "danos tierra", "danos de tierra", "dommages terre", "do terre", "earth damage"],
  },
  {
    id: 11661,
    name: "Runa Da Agua",
    nameFr: "Rune Do Eau",
    nameEn: "Water Dmg Rune",
    shortCode: "DAAGU",
    symbol: "DAGU",
    color: "#0284c7",
    characteristicId: 90,
    effectIds: [426, 227],
    unitWeight: 5,
    statPerRune: 1,
    category: "dano",
    iconId: 78061,
    defaultPrice: 1270,
    description: "+1 Daños de Agua (fijos)",
    textMatches: ["daños de agua", "daños agua", "daño de agua", "daño agua", "danos agua", "danos de agua", "dommages eau", "do eau", "water damage"],
  },
  {
    id: 11663,
    name: "Runa Da Aire",
    nameFr: "Rune Do Air",
    nameEn: "Air Dmg Rune",
    shortCode: "DAAIR",
    symbol: "DAIR",
    color: "#0d9488",
    characteristicId: 91,
    effectIds: [428, 228],
    unitWeight: 5,
    statPerRune: 1,
    category: "dano",
    iconId: 78067,
    defaultPrice: 900,
    description: "+1 Daños de Aire (fijos)",
    textMatches: ["daños de aire", "daños aire", "daño de aire", "daño aire", "danos aire", "danos de aire", "dommages air", "do air", "air damage"],
  },
  {
    id: 11665,
    name: "Runa Da Neutro",
    nameFr: "Rune Do Neutre",
    nameEn: "Neutral Dmg Rune",
    shortCode: "DANEU",
    symbol: "DNEU",
    color: "#64748b",
    characteristicId: 92,
    effectIds: [430, 229],
    unitWeight: 5,
    statPerRune: 1,
    category: "dano",
    iconId: 78069,
    defaultPrice: 800,
    description: "+1 Daños de Neutro (fijos)",
    textMatches: ["daños de neutral", "daños neutral", "daños de neutro", "daños neutro", "daño neutro", "danos neutral", "danos neutro", "dommages neutre", "do neutre", "neutral damage"],
  },
  {
    id: 11649,
    name: "Runa Da Emp",
    nameFr: "Rune Do Pou",
    nameEn: "Push Dmg Rune",
    shortCode: "DAEMP",
    symbol: "DEMP",
    color: "#854d0e",
    characteristicId: 84,
    effectIds: [223, 84, 87],
    unitWeight: 5,
    statPerRune: 1,
    category: "dano",
    iconId: 78081,
    defaultPrice: 1100,
    description: "+1 Daños Empuje",
    textMatches: ["daños de empuje", "daños empuje", "daño empuje", "danos empuje", "danos de empuje", "dommages poussée", "do pou", "push damage", "pushback damage"],
  },
  {
    id: 18720,
    name: "Runa Da Dis",
    nameFr: "Rune Do Per Di",
    nameEn: "Ranged Dmg Rune",
    shortCode: "DADIS",
    symbol: "%DIS",
    color: "#06b6d4",
    characteristicId: 120,
    effectIds: [116, 121, 113, 118, 120],
    unitWeight: 15,
    statPerRune: 1,
    category: "dano",
    iconId: 78091,
    defaultPrice: 4500,
    description: "+1% Daños Distancia",
    textMatches: ["daños distancia", "danos distancia", "% dommages distance", "ranged damage"],
  },
  {
    id: 18719,
    name: "Runa Da CaC",
    nameFr: "Rune Do Per Me",
    nameEn: "Melee Dmg Rune",
    shortCode: "DACAC",
    symbol: "%CAC",
    color: "#e11d48",
    characteristicId: 124,
    effectIds: [117, 122, 114, 119, 124],
    unitWeight: 15,
    statPerRune: 1,
    category: "dano",
    iconId: 78092,
    defaultPrice: 4500,
    description: "+1% Daños Cuerpo a Cuerpo",
    textMatches: ["daños cuerpo a cuerpo", "daños cac", "danos cac", "% dommages mêlée", "melee damage"],
  },
  {
    id: 18722,
    name: "Runa Da Hech",
    nameFr: "Rune Do Per So",
    nameEn: "Spell Dmg Rune",
    shortCode: "DAHECH",
    symbol: "%HEC",
    color: "#9333ea",
    characteristicId: 123,
    effectIds: [118, 125, 115, 122, 123],
    unitWeight: 15,
    statPerRune: 1,
    category: "dano",
    iconId: 78094,
    defaultPrice: 5000,
    description: "+1% Daños con Hechizos",
    textMatches: ["daños de hechizos", "daños con hechizos", "danos hechizos", "% dommages sorts", "spell damage"],
  },
  {
    id: 18721,
    name: "Runa Da Arm",
    nameFr: "Rune Do Per Ar",
    nameEn: "Weapon Dmg Rune",
    shortCode: "DAARM",
    symbol: "%ARM",
    color: "#d97706",
    characteristicId: 122,
    effectIds: [119, 126, 116, 123, 122],
    unitWeight: 15,
    statPerRune: 1,
    category: "dano",
    iconId: 78093,
    defaultPrice: 3500,
    description: "+1% Daños con Armas",
    textMatches: ["daños de armas", "daños con armas", "danos armas", "% dommages armes", "weapon damage"],
  },

  // ==========================================
  // 4. RESISTENCIAS PORCENTUALES (%)
  // ==========================================
  {
    id: 7457,
    name: "Runa Res % Fue",
    nameFr: "Rune Re Per Feu",
    nameEn: "% Fire Res Rune",
    shortCode: "RESPFUE",
    symbol: "%FUE",
    color: "#ef4444",
    characteristicId: 34,
    effectIds: [213, 34],
    unitWeight: 6,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78029,
    defaultPrice: 2200,
    description: "+1% Resistencia Fuego",
    textMatches: ["resistencia fuego %", "% resistencia fuego", "% res. fuego", "% résistance feu", "% fire res"],
  },
  {
    id: 7459,
    name: "Runa Res % Tie",
    nameFr: "Rune Re Per Terre",
    nameEn: "% Earth Res Rune",
    shortCode: "RESPTIE",
    symbol: "%TIE",
    color: "#b45309",
    characteristicId: 33,
    effectIds: [210, 33],
    unitWeight: 6,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78035,
    defaultPrice: 2200,
    description: "+1% Resistencia Tierra",
    textMatches: ["resistencia tierra %", "% resistencia tierra", "% res. tierra", "% résistance terre", "% earth res"],
  },
  {
    id: 7560,
    name: "Runa Res % Agu",
    nameFr: "Rune Re Per Eau",
    nameEn: "% Water Res Rune",
    shortCode: "RESPAGU",
    symbol: "%AGU",
    color: "#0284c7",
    characteristicId: 35,
    effectIds: [211, 35, 36],
    unitWeight: 6,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78031,
    defaultPrice: 2200,
    description: "+1% Resistencia Agua",
    textMatches: ["resistencia agua %", "% resistencia agua", "% res. agua", "% résistance eau", "% water res"],
  },
  {
    id: 7458,
    name: "Runa Res % Air",
    nameFr: "Rune Re Per Air",
    nameEn: "% Air Res Rune",
    shortCode: "RESPAIR",
    symbol: "%AIR",
    color: "#14b8a6",
    characteristicId: 36,
    effectIds: [212, 36, 37],
    unitWeight: 6,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78033,
    defaultPrice: 2200,
    description: "+1% Resistencia Aire",
    textMatches: ["resistencia aire %", "% resistencia aire", "% res. aire", "% résistance air", "% air res"],
  },
  {
    id: 7460,
    name: "Runa Res % Neu",
    nameFr: "Rune Re Per Neutre",
    nameEn: "% Neutral Res Rune",
    shortCode: "RESPNEU",
    symbol: "%NEU",
    color: "#71717a",
    characteristicId: 37,
    effectIds: [214, 37, 33],
    unitWeight: 6,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78058,
    defaultPrice: 2200,
    description: "+1% Resistencia Neutral",
    textMatches: ["resistencia neutral %", "% resistencia neutro", "% res. neutro", "% résistance neutre", "% neutral res"],
  },

  // ==========================================
  // 5. RESISTENCIAS FIJAS Y ESPECIALES
  // ==========================================
  {
    id: 7452,
    name: "Runa Re Fue",
    nameFr: "Rune Re Feu",
    nameEn: "Fire Res Rune",
    shortCode: "REFUE",
    symbol: "RFUE",
    color: "#f87171",
    characteristicId: 55,
    effectIds: [243, 55, 40],
    unitWeight: 2,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78028,
    defaultPrice: 350,
    description: "+1 Resistencia Fija Fuego",
    textMatches: ["resistencia fija fuego", "resistencia fuego", "résistance feu", "fire res"],
  },
  {
    id: 7455,
    name: "Runa Re Tie",
    nameFr: "Rune Re Terre",
    nameEn: "Earth Res Rune",
    shortCode: "RETIE",
    symbol: "RTIE",
    color: "#d97706",
    characteristicId: 54,
    effectIds: [240, 54, 39],
    unitWeight: 2,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78034,
    defaultPrice: 350,
    description: "+1 Resistencia Fija Tierra",
    textMatches: ["resistencia fija tierra", "resistencia tierra", "résistance terre", "earth res"],
  },
  {
    id: 7454,
    name: "Runa Re Agu",
    nameFr: "Rune Re Eau",
    nameEn: "Water Res Rune",
    shortCode: "REAGU",
    symbol: "RAGU",
    color: "#38bdf8",
    characteristicId: 56,
    effectIds: [241, 56, 41],
    unitWeight: 2,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78030,
    defaultPrice: 350,
    description: "+1 Resistencia Fija Agua",
    textMatches: ["resistencia fija agua", "resistencia agua", "résistance eau", "water res"],
  },
  {
    id: 7453,
    name: "Runa Re Air",
    nameFr: "Rune Re Air",
    nameEn: "Air Res Rune",
    shortCode: "REAIR",
    symbol: "RAIR",
    color: "#2dd4bf",
    characteristicId: 57,
    effectIds: [242, 57, 42],
    unitWeight: 2,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78032,
    defaultPrice: 350,
    description: "+1 Resistencia Fija Aire",
    textMatches: ["resistencia fija aire", "resistencia aire", "résistance air", "air res"],
  },
  {
    id: 7456,
    name: "Runa Re Neu",
    nameFr: "Rune Re Neutre",
    nameEn: "Neutral Res Rune",
    shortCode: "RENEU",
    symbol: "RNEU",
    color: "#a1a1aa",
    characteristicId: 58,
    effectIds: [244, 58, 38],
    unitWeight: 2,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78057,
    defaultPrice: 350,
    description: "+1 Resistencia Fija Neutral",
    textMatches: ["resistencia fija neutral", "resistencia neutro", "résistance neutre", "neutral res"],
  },
  {
    id: 11655,
    name: "Runa Re Cri",
    nameFr: "Rune Re Cri",
    nameEn: "Crit Res Rune",
    shortCode: "RECRI",
    symbol: "RCRI",
    color: "#f472b6",
    characteristicId: 87,
    effectIds: [222, 250, 87, 71],
    unitWeight: 2,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78071,
    defaultPrice: 450,
    description: "+1 Resistencia Críticos",
    textMatches: ["resistencia a críticos", "resistencia de golpe crítico", "resistencia criticos", "résistance critiques", "re cri", "crit resistance"],
  },
  {
    id: 11651,
    name: "Runa Re Emp",
    nameFr: "Rune Re Pou",
    nameEn: "Push Res Rune",
    shortCode: "REEMP",
    symbol: "REMP",
    color: "#ca8a04",
    characteristicId: 85,
    effectIds: [221, 251, 85, 88, 86],
    unitWeight: 2,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78079,
    defaultPrice: 450,
    description: "+1 Resistencia Empuje",
    textMatches: ["resistencia a empuje", "resistencia de empuje", "resistencia empuje", "résistance poussée", "re pou", "pushback res", "push resistance"],
  },
  {
    id: 18724,
    name: "Runa Re Dis",
    nameFr: "Rune Re Per Di",
    nameEn: "Ranged Res Rune",
    shortCode: "REDIS",
    symbol: "%RDIS",
    color: "#22d3ee",
    characteristicId: 121,
    effectIds: [123, 127, 120, 121],
    unitWeight: 15,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78096,
    defaultPrice: 3500,
    description: "+1% Resistencia Distancia",
    textMatches: ["resistencia distancia", "% resistencia distancia", "% résistance distance"],
  },
  {
    id: 18723,
    name: "Runa Re CaC",
    nameFr: "Rune Re Per Me",
    nameEn: "Melee Res Rune",
    shortCode: "RECAC",
    symbol: "%RCAC",
    color: "#fb7185",
    characteristicId: 125,
    effectIds: [124, 128, 121, 125],
    unitWeight: 15,
    statPerRune: 1,
    category: "resistencia",
    iconId: 78095,
    defaultPrice: 3500,
    description: "+1% Resistencia Cuerpo a Cuerpo",
    textMatches: ["resistencia cuerpo a cuerpo", "resistencia cac", "% resistencia cac", "% résistance mêlée"],
  },

  // ==========================================
  // 6. SECUNDARIAS / UTILIDAD
  // ==========================================
  {
    id: 7448,
    name: "Runa Ini",
    nameFr: "Rune Ini",
    nameEn: "Ini Rune",
    shortCode: "INI",
    symbol: "INI",
    color: "#fbbf24",
    characteristicId: 44,
    effectIds: [174, 44],
    unitWeight: 1, // 1 Runa Ini (+10 Ini) has weight 1.0 (0.1 per point)
    statPerRune: 10, // 1 Runa Ini = 10 Iniciativa
    category: "secundaria",
    iconId: 78025,
    defaultPrice: 150,
    description: "+10 Iniciativa",
    textMatches: ["iniciativa", "initiative", "ini"],
  },
  {
    id: 7451,
    name: "Runa Prosp",
    nameFr: "Rune Prospe",
    nameEn: "PP Rune",
    shortCode: "PROSP",
    symbol: "PP",
    color: "#f59e0b",
    characteristicId: 48,
    effectIds: [176, 48],
    unitWeight: 3,
    statPerRune: 1,
    category: "secundaria",
    iconId: 78036,
    defaultPrice: 450,
    description: "+1 Prospección",
    textMatches: ["prospección", "prospeccion", "prospection", "pp"],
  },
  {
    id: 7443,
    name: "Runa Pod",
    nameFr: "Rune Pod",
    nameEn: "Pod Rune",
    shortCode: "POD",
    symbol: "POD",
    color: "#a3e635",
    characteristicId: 40,
    effectIds: [158, 40, 52],
    unitWeight: 2.5, // 1 Runa Pod (+10 Pods) = 2.5 weight (0.25 per point)
    statPerRune: 10, // 1 Runa Pod = 10 Pods
    category: "secundaria",
    iconId: 78020,
    defaultPrice: 120,
    description: "+10 Pods",
    textMatches: ["pods", "pod"],
  },
  {
    id: 11637,
    name: "Runa Hui",
    nameFr: "Rune Fui",
    nameEn: "Dodge Rune",
    shortCode: "HUI",
    symbol: "HUI",
    color: "#67e8f9",
    characteristicId: 78,
    effectIds: [160, 78, 77, 752, 106],
    unitWeight: 4,
    statPerRune: 1,
    category: "secundaria",
    iconId: 78076,
    defaultPrice: 580,
    description: "+1 Huida",
    textMatches: ["huida", "fuite", "dodge", "fui", "hui"],
  },
  {
    id: 11639,
    name: "Runa Pla",
    nameFr: "Rune Tac",
    nameEn: "Lock Rune",
    shortCode: "PLA",
    symbol: "PLA",
    color: "#fb923c",
    characteristicId: 79,
    effectIds: [161, 79, 78, 753, 107],
    unitWeight: 4,
    statPerRune: 1,
    category: "secundaria",
    iconId: 78077,
    defaultPrice: 750,
    description: "+1 Placaje",
    textMatches: ["placaje", "tacle", "lock", "tac", "pla"],
  },
  {
    id: 11645,
    name: "Runa Ret PA",
    nameFr: "Rune Ret PA",
    nameEn: "AP Red Rune",
    shortCode: "RETPA",
    symbol: "RTPA",
    color: "#fbbf24",
    characteristicId: 82,
    effectIds: [162, 82, 410],
    unitWeight: 7,
    statPerRune: 1,
    category: "secundaria",
    iconId: 78087,
    defaultPrice: 1500,
    description: "+1 Retiro PA",
    textMatches: ["retiro pa", "retiro de pa", "retrait pa", "ap reduction", "ap red"],
  },
  {
    id: 11647,
    name: "Runa Ret PM",
    nameFr: "Rune Ret PM",
    nameEn: "MP Red Rune",
    shortCode: "RETPM",
    symbol: "RTPM",
    color: "#34d399",
    characteristicId: 83,
    effectIds: [163, 83, 412],
    unitWeight: 7,
    statPerRune: 1,
    category: "secundaria",
    iconId: 78089,
    defaultPrice: 1500,
    description: "+1 Retiro PM",
    textMatches: ["retiro pm", "retiro de pm", "retrait pm", "mp reduction", "mp red"],
  },
  {
    id: 11641,
    name: "Runa Re PA",
    nameFr: "Rune Ré Pa",
    nameEn: "AP Res Rune",
    shortCode: "ESQPA",
    symbol: "EQPA",
    color: "#fde047",
    characteristicId: 27,
    effectIds: [164, 27, 84, 429],
    unitWeight: 7,
    statPerRune: 1,
    category: "secundaria",
    iconId: 78083,
    defaultPrice: 1500,
    description: "+1 Esquiva PA",
    textMatches: ["esquiva pa", "esquiva de pa", "esquive pa", "ap loss res", "re pa", "ré pa"],
  },
  {
    id: 11643,
    name: "Runa Re PM",
    nameFr: "Rune Ré Pme",
    nameEn: "MP Res Rune",
    shortCode: "ESQPM",
    symbol: "EQPM",
    color: "#6ee7b7",
    characteristicId: 28,
    effectIds: [165, 28, 85, 430],
    unitWeight: 7,
    statPerRune: 1,
    category: "secundaria",
    iconId: 78085,
    defaultPrice: 1500,
    description: "+1 Esquiva PM",
    textMatches: ["esquiva pm", "esquiva de pm", "esquive pm", "mp loss res", "re pm", "ré pm"],
  },
];

// Quick index maps
export const BASE_RUNES_BY_ID: Record<number, BaseRuneDefinition> =
  Object.fromEntries(DOFUS_BASE_RUNES.map((r) => [r.id, r]));

export const BASE_RUNES_BY_CHARACTERISTIC: Record<number, BaseRuneDefinition> =
  Object.fromEntries(DOFUS_BASE_RUNES.map((r) => [r.characteristicId, r]));

export const BASE_RUNES_DEFAULT_PRICES: Record<number, number> =
  Object.fromEntries(DOFUS_BASE_RUNES.map((r) => [r.id, r.defaultPrice]));

// Secondary lookup maps for all legacy / alternate characteristic IDs
const EXTRA_CHAR_MAP: Record<number, number> = {
  // Primary characteristics
  10: 1519, // Fo
  118: 1519,
  15: 1522, // Inte
  126: 1522,
  13: 1525, // Sue
  14: 1524, // Agi
  119: 1524,
  11: 1523, // Vi
  12: 1521, // Sa
  124: 1521,
  25: 7436, // Pot
  139: 7436,
  186: 7436,
  // Special
  1: 1557, // Ga PA
  111: 1557,
  23: 1558, // Ga PM
  128: 1558,
  19: 7438, // Al
  117: 7438,
  26: 7442, // Invo
  182: 7442,
  18: 7433, // Cri
  115: 7433,
  // Damages
  16: 7435, // Da
  112: 7435,
  49: 7434, // Cu
  178: 7434,
  179: 7434,
  86: 11653, // Da Cri
  70: 11653,
  220: 11653,
  89: 11659, // Da Fue
  96: 11659,
  226: 11659,
  88: 11657, // Da Tie
  95: 11657,
  225: 11657,
  90: 11661, // Da Agu
  97: 11661,
  227: 11661,
  91: 11663, // Da Air
  98: 11663,
  228: 11663,
  92: 11665, // Da Neu
  99: 11665,
  229: 11665,
  84: 11649, // Da Emp
  223: 11649,
  // Resistances %
  34: 7457, // % Fue
  213: 7457,
  33: 7459, // % Tie
  210: 7459,
  35: 7560, // % Agu
  211: 7560,
  36: 7458, // % Air
  212: 7458,
  37: 7460, // % Neu
  214: 7460,
  // Resistances Flat
  55: 7452, // Re Fue
  243: 7452,
  54: 7455, // Re Tie
  39: 7455,
  240: 7455,
  56: 7454, // Re Agu
  41: 7454,
  241: 7454,
  57: 7453, // Re Air
  42: 7453,
  242: 7453,
  58: 7456, // Re Neu
  38: 7456,
  244: 7456,
  87: 11655, // Re Cri
  71: 11655,
  250: 11655,
  85: 11651, // Re Emp
  251: 11651,
  // Secondary
  44: 7448, // Ini
  174: 7448,
  48: 7451, // Prosp
  176: 7451,
  40: 7443, // Pod
  52: 7443,
  158: 7443,
  78: 11637, // Hui
  77: 11637,
  160: 11637,
  752: 11637,
  79: 11639, // Pla
  161: 11639,
  753: 11639,
  82: 11645, // Ret PA
  162: 11645,
  410: 11645,
  83: 11647, // Ret PM
  163: 11647,
  412: 11647,
  27: 11641, // Re PA
  164: 11641,
  429: 11641,
  28: 11643, // Re PM
  165: 11643,
  430: 11643,
  // Exotic % Dmg / Res
  120: 18720, // % Da Dis
  113: 18720,
  114: 18719, // % Da CC
  122: 18721, // % Da Arm
  116: 18721,
  121: 18724, // % Re Dis
  125: 18723, // % Re CC
  // Hunting / Caza
  795: 10057,
  129: 10057,
  66: 10057,
};

/**
 * Match a DofusEffect or raw effect definition to its corresponding BaseRuneDefinition
 */
export function findRuneForEffect(
  effect: any,
): BaseRuneDefinition | null {
  if (!effect) return null;

  const effId = Number(
    effect.effectId ??
      effect.effect_id ??
      effect.id ??
      0,
  );
  const charId = Number(
    effect.characteristic ??
      effect.characteristicId ??
      effect.characteristic_id ??
      0,
  );

  const rawText = (
    typeof effect === "string"
      ? effect
      : effect.formatted ||
        effect.description?.es ||
        effect.description?.fr ||
        effect.description?.en ||
        effect.text ||
        ""
  ).toLowerCase().trim();

  // Fast-track hunting weapon line before weapon attack damage filters
  const isHunting =
    effId === 795 ||
    effId === 129 ||
    charId === 795 ||
    rawText.includes("arma de caza") ||
    rawText.includes("arme de chasse") ||
    rawText.includes("hunting weapon") ||
    rawText === "caza" ||
    rawText === "chasse";

  if (isHunting) {
    return BASE_RUNES_BY_ID[10057] || null;
  }

  // 1. Filter out weapon attack damage and negative malus
  if (effect.category === 2 || effect.characteristic === -1) {
    return null; // Weapon hit lines (daño de arma) never yield runes
  }
  const fromVal = Number(effect.from ?? effect.diceNum ?? 0);
  const toVal = Number(effect.to ?? effect.diceSide ?? 0);
  if (fromVal < 0 || toVal < 0) {
    return null; // Negative stats / malus never yield runes
  }

  // 2. Direct characteristic ID match (most accurate field from DofusDB)
  if (charId > 0) {
    if (BASE_RUNES_BY_CHARACTERISTIC[charId]) {
      return BASE_RUNES_BY_CHARACTERISTIC[charId];
    }
    if (EXTRA_CHAR_MAP[charId] && BASE_RUNES_BY_ID[EXTRA_CHAR_MAP[charId]]) {
      return BASE_RUNES_BY_ID[EXTRA_CHAR_MAP[charId]];
    }
  }

  // 3. Direct effect ID match
  if (effId > 0) {
    const found = DOFUS_BASE_RUNES.find((r) => r.effectIds.includes(effId));
    if (found) return found;
    if (EXTRA_CHAR_MAP[effId] && BASE_RUNES_BY_ID[EXTRA_CHAR_MAP[effId]]) {
      return BASE_RUNES_BY_ID[EXTRA_CHAR_MAP[effId]];
    }
  }

  // 4. Keyword / formatted text matching fallback
  if (rawText.length > 0) {
    if (rawText.startsWith("-") || rawText.includes("malus") || rawText.includes("retira")) {
      return null;
    }

    // Check for percentage resistance first to avoid collision with flat res
    if (rawText.includes("%") || rawText.includes("pourcent")) {
      if (rawText.includes("fuego") || rawText.includes("feu")) return BASE_RUNES_BY_ID[7457];
      if (rawText.includes("tierra") || rawText.includes("terre")) return BASE_RUNES_BY_ID[7459];
      if (rawText.includes("agua") || rawText.includes("eau")) return BASE_RUNES_BY_ID[7560];
      if (rawText.includes("aire") || rawText.includes("air")) return BASE_RUNES_BY_ID[7458];
      if (rawText.includes("neutr")) return BASE_RUNES_BY_ID[7460];
      if (rawText.includes("crit") || rawText.includes("crít")) return BASE_RUNES_BY_ID[7433];
      if (rawText.includes("dist")) return BASE_RUNES_BY_ID[18720];
      if (rawText.includes("mêlée") || rawText.includes("melee") || rawText.includes("cuerpo a cuerpo") || rawText.includes("cac")) return BASE_RUNES_BY_ID[18719];
      if (rawText.includes("sort") || rawText.includes("hechiz")) return BASE_RUNES_BY_ID[18722];
      if (rawText.includes("arme") || rawText.includes("arma")) return BASE_RUNES_BY_ID[18721];
    }

    // Check specific text patterns
    for (const rune of DOFUS_BASE_RUNES) {
      if (rune.textMatches) {
        for (const tm of rune.textMatches) {
          if (rawText.includes(tm)) {
            return rune;
          }
        }
      }
    }
  }

  return null;
}

export interface ExtractedItemStat {
  rune: BaseRuneDefinition;
  effect: DofusEffect;
  statMin: number;
  statMax: number;
  statAvg: number;
  formattedText: string;
}

/**
 * Robustly extract all crushable stats (with min and max values) from any DofusItem
 */
export function extractItemStats(item: DofusItem): ExtractedItemStat[] {
  if (!item) return [];

  // Prefer item.effects (contains authoritative characteristic and roll values).
  // If item.effects is empty, fallback to item.possibleEffects.
  const rawEffectsList: any[] = [];
  if (Array.isArray(item.effects) && item.effects.length > 0) {
    rawEffectsList.push(...item.effects);
  } else if (Array.isArray(item.possibleEffects) && item.possibleEffects.length > 0) {
    rawEffectsList.push(...item.possibleEffects);
  }

  const results: ExtractedItemStat[] = [];
  const processedRuneIds = new Set<number>();

  for (const rawEff of rawEffectsList) {
    if (!rawEff) continue;

    const formatted = String(rawEff.formatted || rawEff.description?.es || rawEff.description || "").trim();
    const effId = Number(rawEff.effectId ?? rawEff.effect_id ?? rawEff.id ?? 0);
    const charId = Number(rawEff.characteristic ?? rawEff.characteristicId ?? 0);

    const isHuntingEffect =
      effId === 795 ||
      effId === 129 ||
      charId === 795 ||
      formatted.toLowerCase().includes("caza") ||
      formatted.toLowerCase().includes("chasse") ||
      formatted.toLowerCase().includes("hunting");

    // Filter out weapon attack damage (category 2) and negative malus unless it's Hunting Weapon
    if (!isHuntingEffect && (rawEff.category === 2 || rawEff.characteristic === -1)) {
      continue;
    }

    // Check if this effect is negative roll or malus (skip malus effects)
    if (formatted.startsWith("-") || formatted.toLowerCase().includes("malus") || formatted.toLowerCase().includes("retira")) {
      continue;
    }

    const rune = findRuneForEffect(rawEff);
    if (!rune) continue;

    // Deduplicate multiple occurrences of the same stat / rune
    if (processedRuneIds.has(rune.id)) continue;

    // Extract Min and Max roll
    let from = Number(rawEff.from ?? rawEff.diceNum ?? rawEff.min ?? rawEff.value ?? 0);
    let to = Number(rawEff.to ?? rawEff.diceSide ?? rawEff.max ?? 0);

    // If it's Hunting Rune (Arma de caza), default to 1 point if rolls are 0
    if (rune.id === 10057 && from === 0 && to === 0) {
      from = 1;
      to = 1;
    }

    // If 'to' is 0 but 'from' > 0 (fixed stat roll in DofusDB like Gelanillo +1 PA)
    if (to === 0 && from > 0) {
      to = from;
    }
    // If 'from' is 0 but 'to' > 0
    if (from === 0 && to > 0) {
      from = to;
    }

    // If numbers are still 0, attempt regex extraction from formatted string
    if (from === 0 && to === 0 && formatted.length > 0) {
      const matchRange = formatted.match(/(\d+)\s*(?:a|to|-)\s*(\d+)/i);
      if (matchRange) {
        from = Number(matchRange[1]);
        to = Number(matchRange[2]);
      } else {
        const matchSingle = formatted.match(/(\d+)/);
        if (matchSingle) {
          from = Number(matchSingle[1]);
          to = Number(matchSingle[1]);
        }
      }
    }

    const statMin = Math.min(from, to);
    const statMax = Math.max(from, to);

    // Only positive stats (> 0) yield runes
    if (statMax <= 0) continue;

    processedRuneIds.add(rune.id);

    // Middle roll standard: round up to nearest integer (las estadísticas de runas son enteros)
    const statAvg = statMin === statMax ? statMin : Math.ceil((statMin + statMax) / 2);
    let label = formatted;
    if (!label || label.trim().length === 0) {
      if (rune.id === 10057) {
        label = "Arma de caza";
      } else if (statMin === statMax) {
        label = `+${statMin} ${rune.name.replace('Runa ', '')}`;
      } else {
        label = `+${statMin} a ${statMax} ${rune.name.replace('Runa ', '')}`;
      }
    }

    results.push({
      rune,
      effect: rawEff as DofusEffect,
      statMin,
      statMax,
      statAvg,
      formattedText: label,
    });
  }

  return results;
}

/**
 * Get rune icon URL safely
 */
export function getRuneIconUrl(rune: BaseRuneDefinition | number): string {
  const runeId = typeof rune === "number" ? rune : rune.id;
  const def = typeof rune === "object" ? rune : BASE_RUNES_BY_ID[runeId];
  if (def) {
    return `https://api.dofusdb.fr/img/items/${def.iconId}.png`;
  }
  return `https://api.dofusdb.fr/img/items/1519.png`;
}

export type JetMode = "avg" | "min" | "max" | "custom";

export interface StatRuneYield {
  rune: BaseRuneDefinition;
  effect: DofusEffect;
  statMin: number;
  statMax: number;
  statSelectedVal: number; // The active roll used for calculation
  unitWeight: number;
  statTotalPower: number;
  
  // Normal Crushing yield for this stat
  normalRunesPerItem: number; // Decimal (2 decimals, e.g. 77.85)
  normalBatchRunes: number;
  normalKamasValue: number;

  // Focus Crushing yield if THIS stat is focused
  focusRunesPerItem: number; // Decimal (2 decimals, e.g. 137.34)
  focusBatchRunes: number;
  focusKamasValue: number; // Total Kamas from batch if this stat is focused
  focusGainVsNormal: number; // Kamas difference (+/- compared to Total Normal Crushing)
  isBestFocus: boolean;

  // Active state
  isFocused: boolean;
  activeRunes: number;
  activeKamasValue: number;
  unitPrice: number;
}

export interface TopFocusOption {
  rank: 1 | 2 | 3;
  rune: BaseRuneDefinition;
  runesGenerated: number;
  totalKamasValue: number;
  netProfit: number;
  roiPercent: number;
  gainComparedToNormal: number;
}

export interface CrushingResult {
  item: DofusItem;
  itemLevel: number;
  coefficientPercent: number;
  jetMode: JetMode;
  totalItemPower: number;
  statYields: StatRuneYield[];
  
  // Normal Crushing Total (Sum of ALL runes generated without focus)
  normalTotalKamasValue: number;
  normalTotalRunesCount: number;
  normalNetProfit: number;
  normalRoiPercent: number;

  // Active Total (reflecting whether a focus is selected or not)
  totalKamasValue: number;
  totalRunesCount: number;
  craftCost: number;
  netProfit: number;
  roiPercent: number;
  breakEvenCoefficient: number;
  focusedRuneId: number | null;

  // Best focus recommendation (Top 1)
  bestFocusOption: TopFocusOption | null;

  // Top 3 best focus options
  top3FocusOptions: TopFocusOption[];
}

/**
 * Calculate the Dofus Brisage (Machacado / Crushing) rune yield and profit
 * EXACT KAMASKOPE FORMULA:
 *
 * For each characteristic i:
 *   BaseLinePower_i = (3 * (StatVal_i / StatPerRune_i) * UnitWeight_i * (Level / 200)) + 1
 *
 * Sin Focus (Normal):
 *   Runas_i = (BaseLinePower_i * (Coeff / 100)) / UnitWeight_i
 *   Kamas_i = Math.round(Runas_i * Price_i)
 *   TotalNormalKamas = SUM(Kamas_i)
 *
 * Con Focus en stat K:
 *   TotalFocusPower_K = BaseLinePower_K + SUM_other(BaseLinePower_j / 2)
 *   RunasFocus_K = (TotalFocusPower_K * (Coeff / 100)) / UnitWeight_K
 *   KamasFocus_K = Math.round(RunasFocus_K * Price_K)
 *   (Other stats yield 0 runes)
 */
export function calculateItemCrushing(
  item: DofusItem,
  coefficientPercent: number = 100,
  focusedRuneId: number | null = null,
  customRunePrices: Record<number, number> = {},
  singleItemCraftCost: number = 0,
  jetMode: JetMode = "avg",
  customStatValues: Record<number, number> = {},
): CrushingResult {
  const level = Math.max(1, Number(item.level || 1));
  const coeffMultiplier = Math.max(0, coefficientPercent) / 100;
  const totalCraftCost = Math.max(0, singleItemCraftCost);

  const extractedStats = extractItemStats(item);

  // Include any custom stats defined by user not in natural rolls (e.g. FM Runa de Caza on a weapon)
  for (const [runeIdStr, val] of Object.entries(customStatValues)) {
    const runeId = Number(runeIdStr);
    const numVal = Number(val);
    if (numVal > 0 && !extractedStats.some((s) => s.rune.id === runeId)) {
      const runeDef = BASE_RUNES_BY_ID[runeId];
      if (runeDef) {
        extractedStats.push({
          rune: runeDef,
          effect: { effectId: runeDef.effectIds[0], characteristic: runeDef.characteristicId },
          statMin: numVal,
          statMax: numVal,
          statAvg: numVal,
          formattedText: runeDef.id === 10057 ? "Arma de caza (FM)" : `+${numVal} ${runeDef.name.replace("Runa ", "")}`,
        });
      }
    }
  }

  // Compute selected stat value for each stat based on jetMode / custom values
  const evaluatedStats = extractedStats.map((stat) => {
    let selectedVal = stat.statAvg;
    const customVal = customStatValues[stat.rune.id];
    if (typeof customVal === "number" && !Number.isNaN(customVal)) {
      selectedVal = Math.max(0, customVal);
    } else if (jetMode === "min") {
      selectedVal = stat.statMin;
    } else if (jetMode === "max") {
      selectedVal = stat.statMax;
    } else {
      selectedVal = stat.statAvg;
    }

    // Exact Kamaskope Base Line Power with constant +1
    const baseLinePower =
      3 *
        (selectedVal / stat.rune.statPerRune) *
        stat.rune.unitWeight *
        (level / 200) +
      1;

    return {
      ...stat,
      statSelectedVal: selectedVal,
      baseLinePower,
    };
  });

  const totalItemPower = evaluatedStats.reduce((acc, e) => acc + e.baseLinePower, 0);

  // 1. Calculate normal crushing yield for all stats (Sin Focus)
  const normalStatYields = evaluatedStats.map((statItem) => {
    const unitPrice =
      customRunePrices[statItem.rune.id] ??
      BASE_RUNES_DEFAULT_PRICES[statItem.rune.id] ??
      statItem.rune.defaultPrice;

    // Exact normal runes formula: (BaseLinePower * coeff) / unitWeight
    const normalRunesRaw =
      (statItem.baseLinePower * coeffMultiplier) /
      Math.max(0.001, statItem.rune.unitWeight);
    const normalRunesPerItem = Number(normalRunesRaw.toFixed(2));
    const normalKamasValue = Math.round(normalRunesRaw * unitPrice);

    return {
      statItem,
      unitPrice,
      normalRunesPerItem,
      normalBatchRunes: normalRunesPerItem,
      normalKamasValue,
    };
  });

  const normalTotalKamasValue = normalStatYields.reduce(
    (acc, y) => acc + y.normalKamasValue,
    0,
  );
  const normalTotalRunesCount = Number(
    normalStatYields.reduce((acc, y) => acc + y.normalRunesPerItem, 0).toFixed(2),
  );
  const normalNetProfit = normalTotalKamasValue - totalCraftCost;
  const normalRoiPercent =
    totalCraftCost > 0
      ? Number(((normalNetProfit / totalCraftCost) * 100).toFixed(1))
      : 0;

  // 2. Calculate focus yields for EACH stat individually (Con Focus)
  const focusCalculations = evaluatedStats.map((statItem) => {
    const unitPrice =
      customRunePrices[statItem.rune.id] ??
      BASE_RUNES_DEFAULT_PRICES[statItem.rune.id] ??
      statItem.rune.defaultPrice;

    // Sum of half the BaseLinePower of all other lines
    const otherHalfPower = evaluatedStats
      .filter((s) => s.rune.id !== statItem.rune.id)
      .reduce((sum, s) => sum + s.baseLinePower / 2, 0);

    const totalFocusPower = statItem.baseLinePower + otherHalfPower;
    const focusRunesRaw =
      (totalFocusPower * coeffMultiplier) /
      Math.max(0.001, statItem.rune.unitWeight);
    const focusRunesPerItem = Number(focusRunesRaw.toFixed(2));
    const focusKamasValue = Math.round(focusRunesRaw * unitPrice);
    const focusGainVsNormal = focusKamasValue - normalTotalKamasValue;

    const fProfit = focusKamasValue - totalCraftCost;
    const fRoi =
      totalCraftCost > 0
        ? Number(((fProfit / totalCraftCost) * 100).toFixed(1))
        : 0;

    return {
      rune: statItem.rune,
      runeId: statItem.rune.id,
      focusRunesPerItem,
      focusBatchRunes: focusRunesPerItem,
      focusKamasValue,
      focusGainVsNormal,
      netProfit: fProfit,
      roiPercent: fRoi,
    };
  });

  // Sort focus options to establish Top 3
  const sortedFocus = [...focusCalculations].sort(
    (a, b) => b.focusKamasValue - a.focusKamasValue,
  );

  const top3FocusOptions: TopFocusOption[] = sortedFocus
    .slice(0, 3)
    .map((fc, idx) => ({
      rank: (idx + 1) as 1 | 2 | 3,
      rune: fc.rune,
      runesGenerated: fc.focusRunesPerItem,
      totalKamasValue: fc.focusKamasValue,
      netProfit: fc.netProfit,
      roiPercent: fc.roiPercent,
      gainComparedToNormal: fc.focusGainVsNormal,
    }));

  const bestFocusOption: TopFocusOption | null =
    top3FocusOptions.length > 0 && top3FocusOptions[0].totalKamasValue > normalTotalKamasValue
      ? top3FocusOptions[0]
      : (top3FocusOptions[0] ?? null);

  const focusMap = new Map(focusCalculations.map((f) => [f.runeId, f]));

  // 3. Assemble combined StatRuneYield array
  const statYields: StatRuneYield[] = normalStatYields.map((ny) => {
    const statItem = ny.statItem;
    const focusData = focusMap.get(statItem.rune.id)!;
    const isFocused = focusedRuneId !== null && focusedRuneId === statItem.rune.id;
    const isBestFocus = bestFocusOption?.rune.id === statItem.rune.id;

    const activeRunes =
      focusedRuneId === null
        ? ny.normalRunesPerItem
        : isFocused
          ? focusData.focusRunesPerItem
          : 0;
    const activeKamasValue =
      focusedRuneId === null
        ? ny.normalKamasValue
        : isFocused
          ? focusData.focusKamasValue
          : 0;

    return {
      rune: statItem.rune,
      effect: statItem.effect,
      statMin: statItem.statMin,
      statMax: statItem.statMax,
      statSelectedVal: Number(statItem.statSelectedVal.toFixed(1)),
      unitWeight: statItem.rune.unitWeight,
      statTotalPower: Number(statItem.baseLinePower.toFixed(2)),
      normalRunesPerItem: ny.normalRunesPerItem,
      normalBatchRunes: ny.normalRunesPerItem,
      normalKamasValue: ny.normalKamasValue,
      focusRunesPerItem: focusData.focusRunesPerItem,
      focusBatchRunes: focusData.focusRunesPerItem,
      focusKamasValue: focusData.focusKamasValue,
      focusGainVsNormal: focusData.focusGainVsNormal,
      isBestFocus,
      isFocused,
      activeRunes,
      activeKamasValue,
      unitPrice: ny.unitPrice,
    };
  });

  // 4. Compute active summary values
  const totalKamasValue =
    focusedRuneId === null
      ? normalTotalKamasValue
      : (focusMap.get(focusedRuneId)?.focusKamasValue ?? 0);
  const totalRunesCount =
    focusedRuneId === null
      ? normalTotalRunesCount
      : (focusMap.get(focusedRuneId)?.focusRunesPerItem ?? 0);
  const netProfit = totalKamasValue - totalCraftCost;
  const roiPercent =
    totalCraftCost > 0 ? Number(((netProfit / totalCraftCost) * 100).toFixed(1)) : 0;

  // Calculate Break-even coefficient (Rentabilidad mínima %)
  let breakEvenCoefficient = 100;
  if (totalKamasValue > 0 && coefficientPercent > 0) {
    const valueAt100 = totalKamasValue / (coefficientPercent / 100);
    if (valueAt100 > 0 && totalCraftCost > 0) {
      breakEvenCoefficient = Math.max(
        1,
        Math.ceil((totalCraftCost / valueAt100) * 100),
      );
    }
  }

  return {
    item,
    itemLevel: level,
    coefficientPercent,
    jetMode,
    totalItemPower: Number(totalItemPower.toFixed(2)),
    statYields,
    normalTotalKamasValue,
    normalTotalRunesCount,
    normalNetProfit,
    normalRoiPercent,
    totalKamasValue,
    totalRunesCount,
    craftCost: totalCraftCost,
    netProfit,
    roiPercent,
    breakEvenCoefficient,
    focusedRuneId,
    bestFocusOption,
    top3FocusOptions,
  };
}

// LocalStorage helpers to remember found coefficients for items (Kamaskope history)
const COEFFICIENTS_STORAGE_KEY = "dofus_user_item_coefficients";
const COEFFICIENTS_TIMESTAMPS_KEY = "dofus_user_item_coeff_timestamps";

export function getSavedItemCoefficient(itemId: number): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COEFFICIENTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed[itemId] === "number" ? parsed[itemId] : null;
  } catch {
    return null;
  }
}

export function getItemCoefficientTimestamp(itemId: number): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COEFFICIENTS_TIMESTAMPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed[itemId] === "number" ? parsed[itemId] : null;
  } catch {
    return null;
  }
}

export function saveItemCoefficient(itemId: number, coeff: number): void {
  if (typeof window === "undefined" || !itemId) return;
  try {
    const raw = localStorage.getItem(COEFFICIENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[itemId] = Math.max(1, Math.min(2000, Number(coeff) || 100));
    localStorage.setItem(COEFFICIENTS_STORAGE_KEY, JSON.stringify(parsed));

    const rawTs = localStorage.getItem(COEFFICIENTS_TIMESTAMPS_KEY);
    const parsedTs = rawTs ? JSON.parse(rawTs) : {};
    parsedTs[itemId] = Date.now();
    localStorage.setItem(COEFFICIENTS_TIMESTAMPS_KEY, JSON.stringify(parsedTs));
    
    // Dispatch custom event for real-time reactivity
    window.dispatchEvent(new CustomEvent('dofus_coefficients_updated', { detail: { itemId, coeff } }));
  } catch {}
}

export function getAllSavedItemCoefficients(): Record<number, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COEFFICIENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getAllSavedItemCoefficientTimestamps(): Record<number, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COEFFICIENTS_TIMESTAMPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}


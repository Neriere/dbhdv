import { DofusItem, DofusRecipe } from "../types.js";

export interface PresetCraftableItem extends DofusItem {
  jobId: number; // Profession ID
  jobNameEs: string;
  defaultMarketSalePrice: number;
  recipeData: DofusRecipe;
}

export const PRESET_CRAFTABLE_ITEMS: PresetCraftableItem[] = [
  // 1. Joyero - Gelanillo (Niv. 60)
  {
    id: 2469,
    name: { es: "Gelanillo", fr: "Gelano", en: "Gelano" },
    description: {
      es: "Este mítico anillo gelatinoso otorga un punto de acción crucial.",
      fr: "Cet anneau mythique donne 1 PA.",
    },
    level: 60,
    typeId: 9,
    type: { id: 9, name: { es: "Anillo", fr: "Anneau" }, superCategoryId: 1 },
    iconId: 9047,
    jobId: 16, // Joyero
    jobNameEs: "Joyero",
    defaultMarketSalePrice: 180000,
    possibleEffects: [
      {
        id: 1,
        effectId: 1,
        characteristic: 1,
        from: 1,
        to: 1,
        formatted: "+1 PA",
        runeWeight: 100,
      },
    ],
    recipeData: {
      id: 1001,
      resultId: 2469,
      ingredientIds: [14659, 7035], // Esencia de Gelatina Real, Piruta
      quantities: [2, 5],
    },
  },

  // 2. Joyero - Amuleto del Roble Blando (Niv. 145)
  {
    id: 8432,
    name: { es: "Amuleto del Roble Blando", fr: "Amulette du Chêne Mou" },
    description: {
      es: "Aporta enorme inteligencia, fuerza y vitalidad al portador.",
      fr: "Amulette très puissante.",
    },
    level: 145,
    typeId: 1,
    type: {
      id: 1,
      name: { es: "Amuleto", fr: "Amulette" },
      superCategoryId: 1,
    },
    iconId: 10034,
    jobId: 16, // Joyero
    jobNameEs: "Joyero",
    defaultMarketSalePrice: 650000,
    possibleEffects: [
      {
        id: 2,
        effectId: 125,
        characteristic: 125,
        from: 200,
        to: 250,
        formatted: "+250 Vitalidad",
      },
      {
        id: 3,
        effectId: 126,
        characteristic: 126,
        from: 40,
        to: 60,
        formatted: "+60 Inteligencia",
      },
      {
        id: 4,
        effectId: 118,
        characteristic: 118,
        from: 40,
        to: 60,
        formatted: "+60 Fuerza",
      },
      {
        id: 5,
        effectId: 117,
        characteristic: 117,
        from: 1,
        to: 1,
        formatted: "+1 Alcance",
      },
    ],
    recipeData: {
      id: 1002,
      resultId: 8432,
      ingredientIds: [14684, 7035, 460], // Esencia del Roble Blando, Piruta, Madera de roble
      quantities: [1, 8, 20],
    },
  },

  // 3. Alquimista - Poción de Recuerdo (Niv. 20)
  {
    id: 501,
    name: { es: "Poción de recuerdo", fr: "Potion de Rappel" },
    description: {
      es: "Teletransporta al alquimista directamente a su punto de reaparición.",
      fr: "Téléporte à votre zaap.",
    },
    level: 20,
    typeId: 12,
    type: { id: 12, name: { es: "Pócima", fr: "Potion" }, superCategoryId: 2 },
    iconId: 501,
    jobId: 26, // Alquimista
    jobNameEs: "Alquimista",
    defaultMarketSalePrice: 1200,
    recipeData: {
      id: 1003,
      resultId: 501,
      ingredientIds: [10221, 289], // Agua transmutada, Trigo
      quantities: [4, 1],
    },
  },

  // 4. Sastre - Sombrero del Roble Blando (Niv. 143)
  {
    id: 8435,
    name: { es: "Sombrero del Roble Blando", fr: "Chapeau du Chêne Mou" },
    description: {
      es: "Un tocado de madera milenaria con hojas vivas.",
      fr: "Casque légendaire.",
    },
    level: 143,
    typeId: 16,
    type: {
      id: 16,
      name: { es: "Sombrero", fr: "Chapeau" },
      superCategoryId: 1,
    },
    iconId: 12045,
    jobId: 27, // Sastre
    jobNameEs: "Sastre",
    defaultMarketSalePrice: 580000,
    possibleEffects: [
      {
        id: 6,
        effectId: 125,
        characteristic: 125,
        from: 220,
        to: 280,
        formatted: "+280 Vitalidad",
      },
      {
        id: 7,
        effectId: 126,
        characteristic: 126,
        from: 45,
        to: 65,
        formatted: "+65 Inteligencia",
      },
      {
        id: 8,
        effectId: 115,
        characteristic: 115,
        from: 3,
        to: 5,
        formatted: "+5% Golpes Críticos",
      },
    ],
    recipeData: {
      id: 1004,
      resultId: 8435,
      ingredientIds: [14684, 16489, 460], // Esencia del Roble Blando, Tabla de aglomerado, Madera de roble
      quantities: [1, 6, 25],
    },
  },

  // 5. Zapatero - Botas del Jefazo Bwork (Niv. 100)
  {
    id: 7210,
    name: { es: "Botas del Jefazo Bwork", fr: "Bottes du Chef Bwork" },
    description: {
      es: "Ofrecen 1 PM indispensable y altos daños a tierra e inteligencia.",
      fr: "Bottes bwork.",
    },
    level: 100,
    typeId: 11,
    type: { id: 11, name: { es: "Botas", fr: "Bottes" }, superCategoryId: 1 },
    iconId: 11048,
    jobId: 15, // Zapatero
    jobNameEs: "Zapatero",
    defaultMarketSalePrice: 220000,
    possibleEffects: [
      {
        id: 9,
        effectId: 128,
        characteristic: 128,
        from: 1,
        to: 1,
        formatted: "+1 PM",
      },
      {
        id: 10,
        effectId: 125,
        characteristic: 125,
        from: 100,
        to: 150,
        formatted: "+150 Vitalidad",
      },
    ],
    recipeData: {
      id: 1005,
      resultId: 7210,
      ingredientIds: [14695, 7035, 8389], // Esencia de Bworker, Piruta, Pelos de Bworka
      quantities: [1, 4, 10],
    },
  },

  // 6. Herrero - Espada Sol (Niv. 110)
  {
    id: 6410,
    name: { es: "Espada Sol", fr: "Épée Solaire" },
    description: {
      es: "Arma radiante forjada con metales raros y gemas refinadas.",
      fr: "Épée puissante.",
    },
    level: 110,
    typeId: 6,
    type: { id: 6, name: { es: "Espada", fr: "Épée" }, superCategoryId: 1 },
    iconId: 6012,
    jobId: 11, // Herrero
    jobNameEs: "Herrero",
    defaultMarketSalePrice: 340000,
    possibleEffects: [
      {
        id: 11,
        effectId: 118,
        characteristic: 118,
        from: 50,
        to: 75,
        formatted: "+75 Fuerza",
      },
    ],
    recipeData: {
      id: 1006,
      resultId: 6410,
      ingredientIds: [7035, 16489, 7026], // Piruta, Tabla de aglomerado, Aguamarina
      quantities: [8, 6, 4],
    },
  },

  // 7. Minero - Aleación de Piruta (Niv. 60)
  {
    id: 7035,
    name: { es: "Piruta", fr: "Pyrute" },
    description: {
      es: "Lingote fundido compuesto por múltiples minerales nobles.",
      fr: "Lingot de minerais.",
    },
    level: 60,
    typeId: 40,
    type: {
      id: 40,
      name: { es: "Aleación", fr: "Alliage" },
      superCategoryId: 3,
    },
    iconId: 40708,
    jobId: 24, // Minero
    jobNameEs: "Minero",
    defaultMarketSalePrice: 15000,
    recipeData: {
      id: 1007,
      resultId: 7035,
      ingredientIds: [441, 442, 312], // Cobre (441), Bronce (442), Hierro (312)
      quantities: [10, 10, 10],
    },
  },

  // 8. Leñador - Tabla de aglomerado (Niv. 50)
  {
    id: 16489,
    name: { es: "Tabla de aglomerado", fr: "Planche d'aggloméré" },
    description: {
      es: "Tabla refinada ensamblada con maderas nobles de los bosques de Amakna.",
      fr: "Planche en bois.",
    },
    level: 50,
    typeId: 95,
    type: { id: 95, name: { es: "Tabla", fr: "Planche" }, superCategoryId: 3 },
    iconId: 95001,
    jobId: 2, // Leñador
    jobNameEs: "Leñador",
    defaultMarketSalePrice: 12000,
    recipeData: {
      id: 1008,
      resultId: 16489,
      ingredientIds: [460, 476], // Madera de roble (460), Madera de nogal (476)
      quantities: [20, 20],
    },
  },

  // 9. Leñador - Concentrado de matorral (Niv. 100)
  {
    id: 2539,
    name: { es: "Concentrado de matorral", fr: "Concentré de buisson" },
    description: {
      es: "Concentrado maderero elaborado por leñadores expertos.",
      fr: "Substrat de buisson.",
    },
    level: 100,
    typeId: 183,
    type: {
      id: 183,
      name: { es: "Concentrado", fr: "Concentré" },
      superCategoryId: 3,
    },
    iconId: 26016,
    jobId: 2, // Leñador
    jobNameEs: "Leñador",
    defaultMarketSalePrice: 45000,
    recipeData: {
      id: 1010,
      resultId: 2539,
      ingredientIds: [303, 460, 16489], // Madera de fresno (303), Madera de roble (460), Tabla de aglomerado (16489)
      quantities: [10, 10, 2],
    },
  },

  // 10. Fabricante - Trofeo Placador Mayor (Niv. 150)
  {
    id: 12624,
    name: { es: "Placador mayor", fr: "Trophée Bloqueur Majeur" },
    description: {
      es: "Otorga un bono masivo de Placaje para fijar a los enemigos en combate.",
      fr: "Trophée de tacle.",
    },
    level: 150,
    typeId: 271,
    type: {
      id: 271,
      name: { es: "Trofeo", fr: "Trophée" },
      superCategoryId: 1,
    },
    iconId: 151081,
    jobId: 60, // Fabricante
    jobNameEs: "Fabricante",
    defaultMarketSalePrice: 350000,
    possibleEffects: [
      {
        id: 12,
        effectId: 1,
        characteristic: 1,
        from: 32,
        to: 32,
        formatted: "+32 Placaje",
      },
    ],
    recipeData: {
      id: 1011,
      resultId: 12624,
      ingredientIds: [16489, 7035, 14684],
      quantities: [10, 5, 2],
    },
  },

  // 10b. Fabricante - Trofeo Espabilador (Niv. 150)
  {
    id: 15410,
    name: { es: "Espabilador", fr: "Remueur" },
    description: {
      es: "Otorga 1 PA siempre que los bonos de conjunto sean inferiores a 2.",
      fr: "Donne 1 PA si bonus de panoplie < 2.",
    },
    level: 150,
    typeId: 271,
    type: {
      id: 271,
      name: { es: "Trofeo", fr: "Trophée" },
      superCategoryId: 1,
    },
    iconId: 151082,
    jobId: 60, // Fabricante
    jobNameEs: "Fabricante",
    defaultMarketSalePrice: 1200000,
    possibleEffects: [
      {
        id: 1201,
        effectId: 1,
        characteristic: 1,
        from: 1,
        to: 1,
        formatted: "+1 PA",
      },
    ],
    recipeData: {
      id: 10110,
      resultId: 15410,
      ingredientIds: [16489, 7035, 14684],
      quantities: [15, 10, 3],
    },
  },

  // 10c. Fabricante - Trofeo Nómada (Niv. 150)
  {
    id: 15411,
    name: { es: "Nómada", fr: "Nomade" },
    description: {
      es: "Otorga 1 PM y PM suplementarios si no hay bono de conjunto.",
      fr: "Donne 1 PM si bonus de panoplie < 2.",
    },
    level: 150,
    typeId: 271,
    type: {
      id: 271,
      name: { es: "Trofeo", fr: "Trophée" },
      superCategoryId: 1,
    },
    iconId: 151083,
    jobId: 60, // Fabricante
    jobNameEs: "Fabricante",
    defaultMarketSalePrice: 1100000,
    possibleEffects: [
      {
        id: 1202,
        effectId: 1,
        characteristic: 1,
        from: 1,
        to: 1,
        formatted: "+1 PM",
      },
    ],
    recipeData: {
      id: 10111,
      resultId: 15411,
      ingredientIds: [16489, 7035, 14684],
      quantities: [15, 10, 3],
    },
  },

  // 11. Fabricante - Escudo Airedala (Niv. 120)
  {
    id: 18661,
    name: { es: "Escudo Airedala", fr: "Bouclier d'Airedala" },
    description: {
      es: "Escudo tradicional pandawa con resistencias de aire.",
      fr: "Bouclier pandawa.",
    },
    level: 120,
    typeId: 82,
    type: {
      id: 82,
      name: { es: "Escudo", fr: "Bouclier" },
      superCategoryId: 1,
    },
    iconId: 82030,
    jobId: 60, // Fabricante
    jobNameEs: "Fabricante",
    defaultMarketSalePrice: 280000,
    possibleEffects: [
      {
        id: 13,
        effectId: 1,
        characteristic: 1,
        from: 10,
        to: 15,
        formatted: "+15% Res. Aire",
      },
    ],
    recipeData: {
      id: 1012,
      resultId: 18661,
      ingredientIds: [16489, 441, 14652],
      quantities: [8, 15, 2],
    },
  },

  // 12. Manitas - Llave de la Mazmorra de los Bworks (Niv. 50)
  {
    id: 8135,
    name: {
      es: "Llave de la Mazmorra de los Bworks",
      fr: "Clé du Donjon des Bworks",
    },
    description: {
      es: "Permite el acceso directo al antro del Jefazo Bwork.",
      fr: "Clé de donjon.",
    },
    level: 50,
    typeId: 84,
    type: { id: 84, name: { es: "Llave", fr: "Clé" }, superCategoryId: 2 },
    iconId: 84234,
    jobId: 65, // Manitas
    jobNameEs: "Manitas",
    defaultMarketSalePrice: 25000,
    recipeData: {
      id: 1009,
      resultId: 8135,
      ingredientIds: [8389, 312], // Pelos de Bworka, Hierro
      quantities: [5, 10],
    },
  },

  // 13. Ganadero - Bebedero de fresno (Niv. 30)
  {
    id: 7851,
    name: { es: "Bebedero de fresno", fr: "Abreuvoir en frêne" },
    description: {
      es: "Objeto de cría indispensable para aumentar la madurez de las monturas.",
      fr: "Objet d'élevage.",
    },
    level: 30,
    typeId: 99,
    type: {
      id: 99,
      name: { es: "Objeto de cría", fr: "Objet d'élevage" },
      superCategoryId: 2,
    },
    iconId: 99001,
    jobId: 101, // Ganadero
    jobNameEs: "Ganadero",
    defaultMarketSalePrice: 45000,
    recipeData: {
      id: 1013,
      resultId: 7851,
      ingredientIds: [303, 312], // Madera de fresno, Hierro
      quantities: [20, 10],
    },
  },
];

// Default Market Prices dictionary for raw base materials & intermediate items (empty by default so users start with clean slate)
export const DEFAULT_INGREDIENT_PRICES: Record<number, number> = {};

import { PresetCraftableItem } from "./presetCraftableItems.js";

/**
 * Base de datos oficial de Runas crafteables en Dofus (Runas Bu y Runas Su)
 * Cada Runa Bu se fabrica con 3 Runas Base correspondientes.
 * Cada Runa Su se fabrica con 3 Runas Bu correspondientes.
 */
export const CRAFTABLE_RUNES: PresetCraftableItem[] = [
  // ==========================================
  // 1. CARACTERÍSTICAS PRIMARIAS (Bu y Su)
  // ==========================================
  // Vitalidad
  {
    id: 1551,
    name: { es: "Runa Bu Vi", fr: "Rune Pa Vi", en: "Pa Vit Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78053,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 520,
    recipeData: {
      id: 9001,
      resultId: 1551,
      ingredientIds: [1523],
      quantities: [3],
    },
  },
  {
    id: 1552,
    name: { es: "Runa Su Vi", fr: "Rune Ra Vi", en: "Ra Vit Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78054,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1650,
    recipeData: {
      id: 9002,
      resultId: 1552,
      ingredientIds: [1551],
      quantities: [3],
    },
  },

  // Fuerza
  {
    id: 1545,
    name: { es: "Runa Bu Fu", fr: "Rune Pa Fo", en: "Pa Str Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78044,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 240,
    recipeData: {
      id: 9003,
      resultId: 1545,
      ingredientIds: [1519],
      quantities: [3],
    },
  },
  {
    id: 1546,
    name: { es: "Runa Su Fu", fr: "Rune Ra Fo", en: "Ra Str Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78045,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 780,
    recipeData: {
      id: 9004,
      resultId: 1546,
      ingredientIds: [1545],
      quantities: [3],
    },
  },

  // Inteligencia
  {
    id: 1547,
    name: { es: "Runa Bu Inte", fr: "Rune Pa Ine", en: "Pa Int Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78038,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 140,
    recipeData: {
      id: 9005,
      resultId: 1547,
      ingredientIds: [1522],
      quantities: [3],
    },
  },
  {
    id: 1548,
    name: { es: "Runa Su Inte", fr: "Rune Ra Ine", en: "Ra Int Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78039,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 460,
    recipeData: {
      id: 9006,
      resultId: 1548,
      ingredientIds: [1547],
      quantities: [3],
    },
  },

  // Suerte
  {
    id: 1553,
    name: { es: "Runa Bu Sue", fr: "Rune Pa Cha", en: "Pa Cha Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78041,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 195,
    recipeData: {
      id: 9007,
      resultId: 1553,
      ingredientIds: [1525],
      quantities: [3],
    },
  },
  {
    id: 1554,
    name: { es: "Runa Su Sue", fr: "Rune Ra Cha", en: "Ra Cha Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78042,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 620,
    recipeData: {
      id: 9008,
      resultId: 1554,
      ingredientIds: [1553],
      quantities: [3],
    },
  },

  // Agilidad
  {
    id: 1549,
    name: { es: "Runa Bu Agi", fr: "Rune Pa Age", en: "Pa Agi Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78047,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 240,
    recipeData: {
      id: 9009,
      resultId: 1549,
      ingredientIds: [1524],
      quantities: [3],
    },
  },
  {
    id: 1550,
    name: { es: "Runa Su Agi", fr: "Rune Ra Age", en: "Ra Agi Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78048,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 780,
    recipeData: {
      id: 9010,
      resultId: 1550,
      ingredientIds: [1549],
      quantities: [3],
    },
  },

  // Sabiduría
  {
    id: 1555,
    name: { es: "Runa Bu Sa", fr: "Rune Pa Sa", en: "Pa Wis Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78050,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 980,
    recipeData: {
      id: 9011,
      resultId: 1555,
      ingredientIds: [1521],
      quantities: [3],
    },
  },
  {
    id: 1556,
    name: { es: "Runa Su Sa", fr: "Rune Ra Sa", en: "Ra Wis Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78051,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 3100,
    recipeData: {
      id: 9012,
      resultId: 1556,
      ingredientIds: [1555],
      quantities: [3],
    },
  },

  // Potencia
  {
    id: 7444,
    name: { es: "Runa Bu Pot", fr: "Rune Pa Pui", en: "Pa Power Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78021,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 950,
    recipeData: {
      id: 9013,
      resultId: 7444,
      ingredientIds: [7436],
      quantities: [3],
    },
  },
  {
    id: 7447,
    name: { es: "Runa Su Pot", fr: "Rune Ra Pui", en: "Ra Power Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78024,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 3000,
    recipeData: {
      id: 9014,
      resultId: 7447,
      ingredientIds: [7444],
      quantities: [3],
    },
  },

  // ==========================================
  // 2. UTILIDAD Y SECUNDARIAS (Bu y Su)
  // ==========================================
  // Iniciativa
  {
    id: 7449,
    name: { es: "Runa Bu Ini", fr: "Rune Pa Ini", en: "Pa Ini Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78026,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 480,
    recipeData: {
      id: 9015,
      resultId: 7449,
      ingredientIds: [7448],
      quantities: [3],
    },
  },
  {
    id: 7450,
    name: { es: "Runa Su Ini", fr: "Rune Ra Ini", en: "Ra Ini Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78027,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1550,
    recipeData: {
      id: 9016,
      resultId: 7450,
      ingredientIds: [7449],
      quantities: [3],
    },
  },

  // Pods
  {
    id: 7440,
    name: { es: "Runa Bu Pod", fr: "Rune Pa Pod", en: "Pa Pod Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78011,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 390,
    recipeData: {
      id: 9017,
      resultId: 7440,
      ingredientIds: [7443],
      quantities: [3],
    },
  },
  {
    id: 7441,
    name: { es: "Runa Su Pod", fr: "Rune Ra Pod", en: "Ra Pod Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78012,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1250,
    recipeData: {
      id: 9018,
      resultId: 7441,
      ingredientIds: [7440],
      quantities: [3],
    },
  },

  // Potencia Trampas
  {
    id: 7561,
    name: { es: "Runa Bu Tram Por", fr: "Rune Pa Per Pi", en: "Pa Trap Power Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78034,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 4400,
    recipeData: {
      id: 9019,
      resultId: 7561,
      ingredientIds: [7446],
      quantities: [3],
    },
  },
  {
    id: 7562,
    name: { es: "Runa Su Tram Por", fr: "Rune Ra Per Pi", en: "Ra Trap Power Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78035,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 14000,
    recipeData: {
      id: 9020,
      resultId: 7562,
      ingredientIds: [7561],
      quantities: [3],
    },
  },

  // ==========================================
  // 3. DAÑOS ELEMENTALES Y ESPECIALES (Solo Bu)
  // ==========================================
  // Daño Neutral
  {
    id: 11666,
    name: { es: "Runa Bu Da Neutral", fr: "Rune Pa Do Neutre", en: "Pa Neutral Dmg Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78070,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 2500,
    recipeData: {
      id: 9021,
      resultId: 11666,
      ingredientIds: [11665],
      quantities: [3],
    },
  },

  // Daño Tierra
  {
    id: 11658,
    name: { es: "Runa Bu Da Tierra", fr: "Rune Pa Do Terre", en: "Pa Earth Dmg Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78066,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 2800,
    recipeData: {
      id: 9022,
      resultId: 11658,
      ingredientIds: [11657],
      quantities: [3],
    },
  },

  // Daño Fuego
  {
    id: 11660,
    name: { es: "Runa Bu Da Fuego", fr: "Rune Pa Do Feu", en: "Pa Fire Dmg Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78064,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 3600,
    recipeData: {
      id: 9023,
      resultId: 11660,
      ingredientIds: [11659],
      quantities: [3],
    },
  },

  // Daño Agua
  {
    id: 11662,
    name: { es: "Runa Bu Da Agua", fr: "Rune Pa Do Eau", en: "Pa Water Dmg Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78062,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 3900,
    recipeData: {
      id: 9024,
      resultId: 11662,
      ingredientIds: [11661],
      quantities: [3],
    },
  },

  // Daño Aire
  {
    id: 11664,
    name: { es: "Runa Bu Da Aire", fr: "Rune Pa Do Air", en: "Pa Air Dmg Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78068,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 2800,
    recipeData: {
      id: 9025,
      resultId: 11664,
      ingredientIds: [11663],
      quantities: [3],
    },
  },

  // Daño Crítico
  {
    id: 11654,
    name: { es: "Runa Bu Da Cri", fr: "Rune Pa Do Cri", en: "Pa Crit Dmg Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78074,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 3800,
    recipeData: {
      id: 9026,
      resultId: 11654,
      ingredientIds: [11653],
      quantities: [3],
    },
  },

  // Daño Empuje
  {
    id: 11650,
    name: { es: "Runa Bu Da Emp", fr: "Rune Pa Do Pou", en: "Pa Push Dmg Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78082,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 3500,
    recipeData: {
      id: 9027,
      resultId: 11650,
      ingredientIds: [11649],
      quantities: [3],
    },
  },

  // Daño Trampas
  {
    id: 7439,
    name: { es: "Runa Bu Tram", fr: "Rune Pa Do Pi", en: "Pa Trap Dmg Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78010,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 5000,
    recipeData: {
      id: 9028,
      resultId: 7439,
      ingredientIds: [7445],
      quantities: [3],
    },
  },

  // Curas
  {
    id: 7432,
    name: { es: "Runa Bu Cu", fr: "Rune Pa So", en: "Pa Heal Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78013,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1250,
    recipeData: {
      id: 9029,
      resultId: 7432,
      ingredientIds: [7434],
      quantities: [3],
    },
  },

  // Prospección
  {
    id: 7563,
    name: { es: "Runa Bu Prospe", fr: "Rune Pa Prospe", en: "Pa PP Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78036,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1400,
    recipeData: {
      id: 9030,
      resultId: 7563,
      ingredientIds: [7451],
      quantities: [3],
    },
  },

  // ==========================================
  // 4. RESISTENCIAS ELEMENTALES Y FIJAS (Solo Bu)
  // ==========================================
  // Resistencia Neutral
  {
    id: 7559,
    name: { es: "Runa Bu Re Neutral", fr: "Rune Pa Re Neutre", en: "Pa Neutral Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78057,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1100,
    recipeData: {
      id: 9031,
      resultId: 7559,
      ingredientIds: [7456],
      quantities: [3],
    },
  },

  // Resistencia Tierra
  {
    id: 7557,
    name: { es: "Runa Bu Re Tierra", fr: "Rune Pa Re Terre", en: "Pa Earth Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78034,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1100,
    recipeData: {
      id: 9032,
      resultId: 7557,
      ingredientIds: [7455],
      quantities: [3],
    },
  },

  // Resistencia Fuego
  {
    id: 7555,
    name: { es: "Runa Bu Re Fuego", fr: "Rune Pa Re Feu", en: "Pa Fire Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78028,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1100,
    recipeData: {
      id: 9033,
      resultId: 7555,
      ingredientIds: [7452],
      quantities: [3],
    },
  },

  // Resistencia Agua
  {
    id: 7556,
    name: { es: "Runa Bu Re Agua", fr: "Rune Pa Re Eau", en: "Pa Water Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78030,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1100,
    recipeData: {
      id: 9034,
      resultId: 7556,
      ingredientIds: [7454],
      quantities: [3],
    },
  },

  // Resistencia Aire
  {
    id: 7558,
    name: { es: "Runa Bu Re Aire", fr: "Rune Pa Re Air", en: "Pa Air Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78032,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1100,
    recipeData: {
      id: 9035,
      resultId: 7558,
      ingredientIds: [7453],
      quantities: [3],
    },
  },

  // Resistencia Crítico
  {
    id: 11656,
    name: { es: "Runa Bu Re Cri", fr: "Rune Pa Re Cri", en: "Pa Crit Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78072,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1400,
    recipeData: {
      id: 9036,
      resultId: 11656,
      ingredientIds: [11655],
      quantities: [3],
    },
  },

  // Resistencia Empuje
  {
    id: 11652,
    name: { es: "Runa Bu Re Emp", fr: "Rune Pa Re Pou", en: "Pa Push Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78080,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1400,
    recipeData: {
      id: 9037,
      resultId: 11652,
      ingredientIds: [11651],
      quantities: [3],
    },
  },

  // ==========================================
  // 5. TÁCTICAS / SECUNDARIAS (Solo Bu)
  // ==========================================
  // Placaje
  {
    id: 11640,
    name: { es: "Runa Bu Pla", fr: "Rune Pa Tac", en: "Pa Lock Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78078,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 2350,
    recipeData: {
      id: 9038,
      resultId: 11640,
      ingredientIds: [11639],
      quantities: [3],
    },
  },

  // Huida
  {
    id: 11638,
    name: { es: "Runa Bu Hui", fr: "Rune Pa Fui", en: "Pa Dodge Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78075,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 1800,
    recipeData: {
      id: 9039,
      resultId: 11638,
      ingredientIds: [11637],
      quantities: [3],
    },
  },

  // Retiro PA
  {
    id: 11646,
    name: { es: "Runa Bu Ret PA", fr: "Rune Pa Ret PA", en: "Pa AP Red Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78088,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 4700,
    recipeData: {
      id: 9040,
      resultId: 11646,
      ingredientIds: [11645],
      quantities: [3],
    },
  },

  // Retiro PM
  {
    id: 11648,
    name: { es: "Runa Bu Ret PM", fr: "Rune Pa Ret PM", en: "Pa MP Red Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78090,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 4700,
    recipeData: {
      id: 9041,
      resultId: 11648,
      ingredientIds: [11647],
      quantities: [3],
    },
  },

  // Esquiva PA
  {
    id: 11642,
    name: { es: "Runa Bu Re PA", fr: "Rune Pa Ré Pa", en: "Pa AP Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78084,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 4700,
    recipeData: {
      id: 9042,
      resultId: 11642,
      ingredientIds: [11641],
      quantities: [3],
    },
  },

  // Esquiva PM
  {
    id: 11644,
    name: { es: "Runa Bu Re PM", fr: "Rune Pa Ré Pme", en: "Pa MP Res Rune" },
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
    iconId: 78086,
    jobId: 78,
    jobNameEs: "Runas",
    defaultMarketSalePrice: 4700,
    recipeData: {
      id: 9043,
      resultId: 11644,
      ingredientIds: [11643],
      quantities: [3],
    },
  },
];

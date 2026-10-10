import {
  DofusItem,
  PriceProfile,
  SyncSettings,
  SyncStatus,
} from "../../types";
import {
  PRESET_CRAFTABLE_ITEMS,
  PresetCraftableItem,
} from "../../data/presetCraftableItems";
import { CRAFTABLE_RUNES } from "../../data/craftableRunesData";
import { ALL_DOFUS_RUNES } from "../../data/dofusAllRunesDict";
import bycGeneratedDb from "../../data/bycGeneratedDbData";

export const ALL_PRESET_ITEMS: PresetCraftableItem[] = [
  ...PRESET_CRAFTABLE_ITEMS,
  ...CRAFTABLE_RUNES,
];

export const presetItemMap = new Map<number, PresetCraftableItem>(
  ALL_PRESET_ITEMS.map((item) => [item.id, item]),
);

export const DEFAULT_SYNC_STATUS: SyncStatus = {
  lastSyncTimestamp: null,
  totalImported: 0,
  recipesCount: 0,
  equipablesCount: 0,
  consumablesCount: 0,
  resourcesCount: 0,
  cosmeticsOmittedCount: 0,
  isLoading: false,
  progressMessage: "",
};

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: true,
  intervalDays: 30,
};

export const TYPE_NAME_MAP: Record<number, string> = {
  1: "Amuleto",
  2: "Arco",
  3: "Varita",
  4: "Baston",
  5: "Daga",
  6: "Espada",
  7: "Martillo",
  8: "Pala",
  9: "Anillo",
  10: "Cinturon",
  11: "Bota",
  12: "Pocima",
  16: "Sombrero",
  17: "Capa",
  18: "Mascota",
  19: "Hacha",
  23: "Dofus",
  33: "Pan",
  34: "Cereal",
  35: "Flor",
  36: "Planta",
  38: "Madera",
  39: "Mineral",
  40: "Aleacion",
  41: "Pescado",
  47: "Hueso",
  48: "Polvo",
  49: "Pescado comestible",
  50: "Piedra preciosa",
  51: "Piedra bruta",
  53: "Pluma",
  54: "Pelo",
  55: "Tejido",
  56: "Cuero",
  57: "Lana",
  58: "Semilla",
  59: "Piel",
  60: "Aceite",
  63: "Carne",
  66: "Metaria",
  68: "Legumbre",
  69: "Carne comestible",
  70: "Tinte",
  71: "Material de alquimia",
  78: "Runa",
  79: "Bebida",
  82: "Escudo",
  83: "Piedra de alma",
  84: "Llave",
  95: "Tabla",
  96: "Corteza",
  98: "Raiz",
  103: "Pata",
  104: "Ala",
  105: "Huevo",
  106: "Oreja",
  107: "Caparazon",
  108: "Brote",
  109: "Ojo",
  110: "Gelatina",
  111: "Cascara",
  150: "Carne preparada",
  167: "Esencia",
  183: "Concentrado",
  185: "Sustrato",
  219: "Consumible",
  271: "Trofeo",
  307: "Piedra de alma",
  308: "Piedra de alma",
};

export const CATEGORY_TYPE_IDS_MAP: Record<string, number[]> = {
  campesino: [34, 33, 37, 58, 60, 68, 46, 28, 128, 129],
  lenador: [38, 95, 96, 98, 183, 185, 242, 12, 170],
  alquimista: [12, 26, 35, 36, 70, 71, 79, 179, 183, 206, 228, 167, 62],
  minero: [39, 40, 50, 51, 83, 85, 307, 308, 167, 153, 66, 91],
  pescador: [41, 49, 134, 135, 64],
  cazador: [63, 69, 187, 56, 59, 150],
  ganadero: [99, 323, 326, 327],
  fabricante: [82, 151, 112, 217],
  monsters: [
    47, 48, 53, 54, 55, 56, 57, 59, 103, 104, 105, 106, 107, 108, 109, 110, 111,
    119, 15, 74, 96, 98, 152, 219, 229, 278,
  ],
  equipment: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 82, 112, 151, 217, 271,
  ],
  craft_ingredients: [
    12, 15, 26, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 46, 47, 48, 49, 50, 51,
    53, 54, 55, 56, 57, 58, 59, 60, 62, 63, 64, 66, 68, 69, 70, 71, 79, 83, 85,
    91, 95, 96, 98, 103, 104, 105, 106, 107, 108, 109, 110, 111, 119, 128, 129,
    134, 135, 150, 152, 153, 167, 170, 179, 183, 185, 187, 206, 219, 228, 229,
    242, 278, 307, 308,
  ],
};

export const DEFAULT_PRICE_PROFILES: PriceProfile[] = [
  { id: 1, slug: "draconiros", name: "Draconiros", category: "monocuenta_clasico", categoryLabel: "Monocuenta Clásico", isDefault: true },
  { id: 2, slug: "kourial", name: "Kourial", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero", isDefault: false },
  { id: 3, slug: "mikhal", name: "Mikhal", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero", isDefault: false },
  { id: 4, slug: "dakal", name: "Dakal", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero", isDefault: false },
  { id: 5, slug: "brial", name: "Brial", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero", isDefault: false },
  { id: 6, slug: "rafal", name: "Rafal", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero", isDefault: false },
  { id: 7, slug: "salar", name: "Salar", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero", isDefault: false },
  { id: 8, slug: "tal-kasha", name: "Tal Kasha", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico", isDefault: false },
  { id: 9, slug: "hellmina", name: "Hell Mina", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico", isDefault: false },
  { id: 10, slug: "imagiro", name: "Imagiro", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico", isDefault: false },
  { id: 11, slug: "orukam", name: "Orukam", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico", isDefault: false },
  { id: 12, slug: "tylezia", name: "Tylezia", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico", isDefault: false },
];

export const KNOWN_SPECIAL_INGREDIENTS: Record<number, Partial<DofusItem>> = {
  17994: {
    id: 17994,
    name: { es: "Lapa", fr: "Bernique", en: "Limpet" },
    iconId: 179940,
    level: 200,
    typeId: 41,
    type: {
      id: 41,
      superCategoryId: 9,
      name: { es: "Pescado", fr: "Poisson", en: "Fish" },
    },
  },
  10057: {
    id: 10057,
    name: { es: "Runa de caza", fr: "Rune de chasse", en: "Hunting Rune" },
    iconId: 78059,
    level: 10,
    typeId: 78,
    type: {
      id: 78,
      superCategoryId: 0,
      name: { es: "Runa", fr: "Rune", en: "Rune" },
    },
  },
  // Runas oficiales de Trampa (Dofus Unity)
  7447: {
    id: 7447,
    name: { es: "Runa Por Tram", fr: "Rune Per Pi", en: "Trp Per Rune" },
    iconId: 78024,
    level: 15,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  10615: {
    id: 10615,
    name: { es: "Runa Bu Por Tram", fr: "Rune Pa Per Pi", en: "Pa Trp Per Rune" },
    iconId: 78266,
    level: 20,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  10616: {
    id: 10616,
    name: { es: "Runa Su Por Tram", fr: "Rune Ra Per Pi", en: "Ra Trp Per Rune" },
    iconId: 78267,
    level: 25,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  7446: {
    id: 7446,
    name: { es: "Runa Da Tram", fr: "Rune Do Pi", en: "Trp Dam Rune" },
    iconId: 78268,
    level: 40,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  10613: {
    id: 10613,
    name: { es: "Runa Bu Da Tram", fr: "Rune Pa Do Pi", en: "Pa Trp Dam Rune" },
    iconId: 78023,
    level: 45,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  // Runas de Pods
  7443: {
    id: 7443,
    name: { es: "Runa Pod", fr: "Rune Pod", en: "Pod Rune" },
    iconId: 78020,
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  7444: {
    id: 7444,
    name: { es: "Runa Bu Pod", fr: "Rune Pa Pod", en: "Pa Pod Rune" },
    iconId: 78021,
    level: 5,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  7445: {
    id: 7445,
    name: { es: "Runa Su Pod", fr: "Rune Ra Pod", en: "Ra Pod Rune" },
    iconId: 78022,
    level: 10,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  12737: {
    id: 12737,
    name: { es: "Guijarro carmesí", fr: "Galet cramoisi", en: "Crimson Pebble" },
    iconId: 15290,
    level: 50,
    typeId: 152,
    type: { id: 152, superCategoryId: 0, name: { es: "Guijarro", fr: "Galet", en: "Pebble" } },
  },
  12738: {
    id: 12738,
    name: { es: "Guijarro rutilante", fr: "Galet rutilant", en: "Rutilant Pebble" },
    iconId: 15291,
    level: 100,
    typeId: 152,
    type: { id: 152, superCategoryId: 0, name: { es: "Guijarro", fr: "Galet", en: "Pebble" } },
  },
  12740: {
    id: 12740,
    name: { es: "Guijarro brasa", fr: "Galet brasillant", en: "Glowing Pebble" },
    iconId: 15289,
    level: 195,
    typeId: 152,
    type: { id: 152, superCategoryId: 0, name: { es: "Guijarro", fr: "Galet", en: "Pebble" } },
  },
  13367: {
    id: 13367,
    name: { es: "Guijarro solar", fr: "Galet solaire", en: "Solar Pebble" },
    iconId: 152004,
    level: 150,
    typeId: 152,
    type: { id: 152, superCategoryId: 0, name: { es: "Guijarro", fr: "Galet", en: "Pebble" } },
  },
  12743: {
    id: 12743,
    name: { es: "Pócima mineral", fr: "Potion minérale", en: "Mineral Potion" },
    iconId: 12727,
    level: 55,
    typeId: 179,
    type: { id: 179, superCategoryId: 0, name: { es: "Preparación", fr: "Préparation", en: "Preparation" } },
  },
  12734: {
    id: 12734,
    name: { es: "Pócima de alteración", fr: "Potion d'altération", en: "Alteration Potion" },
    iconId: 12725,
    level: 145,
    typeId: 179,
    type: { id: 179, superCategoryId: 0, name: { es: "Preparación", fr: "Préparation", en: "Preparation" } },
  },
  31517: {
    id: 31517,
    name: { es: "Artefacto pandawushu", fr: "Artefact pandawushu", en: "Pandawushu Artefact" },
    iconId: 50105,
    level: 150,
    typeId: 50,
    type: { id: 50, superCategoryId: 0, name: { es: "Piedra preciosa", fr: "Pierre précieuse", en: "Precious stone" } },
  },
  31518: {
    id: 31518,
    name: { es: "Esquíritu inferior", fr: "Éklâme inférieure", en: "Lesser Soul Shard" },
    iconId: 74084,
    level: 1,
    typeId: 310,
    type: { id: 310, superCategoryId: 0, name: { es: "Esquíritu", fr: "Éklâme", en: "Soul Shard" } },
  },
  31519: {
    id: 31519,
    name: { es: "Esquíritu común", fr: "Éklâme commune", en: "Common Soul Shard" },
    iconId: 74072,
    level: 50,
    typeId: 310,
    type: { id: 310, superCategoryId: 0, name: { es: "Esquíritu", fr: "Éklâme", en: "Soul Shard" } },
  },
  31520: {
    id: 31520,
    name: { es: "Esquíritu superior", fr: "Éklâme supérieure", en: "Greater Soul Shard" },
    iconId: 74061,
    level: 100,
    typeId: 310,
    type: { id: 310, superCategoryId: 0, name: { es: "Esquíritu", fr: "Éklâme", en: "Soul Shard" } },
  },
  31521: {
    id: 31521,
    name: { es: "Esquíritu majestuoso", fr: "Éklâme majestueuse", en: "Majestic Soul Shard" },
    iconId: 74066,
    level: 150,
    typeId: 310,
    type: { id: 310, superCategoryId: 0, name: { es: "Esquíritu", fr: "Éklâme", en: "Soul Shard" } },
  },
  31522: {
    id: 31522,
    name: { es: "Esquíritu supremo", fr: "Éklâme suprême", en: "Supreme Soul Shard" },
    iconId: 74071,
    level: 190,
    typeId: 310,
    type: { id: 310, superCategoryId: 0, name: { es: "Esquíritu", fr: "Éklâme", en: "Soul Shard" } },
  },
  397: {
    id: 397,
    name: { es: "Aceite de Kodo", fr: "Huile de Koode", en: "Koode Oil" },
    iconId: 60069,
    level: 32,
    typeId: 60,
    type: { id: 60, superCategoryId: 0, name: { es: "Aceite", fr: "Huile", en: "Oil" } },
  },
  31620: {
    id: 31620,
    name: { es: "Jugo de pescado", fr: "Jus de poisson", en: "Fish Juice" },
    iconId: 176003,
    level: 95,
    typeId: 228,
    type: { id: 228, superCategoryId: 0, name: { es: "Líquido", fr: "Liquide", en: "Liquid" } },
  },
  16498: {
    id: 16498,
    name: { es: "Tabla para pintar", fr: "Planche à peindre", en: "Painting Board" },
    iconId: 95005,
    level: 180,
    typeId: 95,
    type: { id: 95, superCategoryId: 0, name: { es: "Tabla", fr: "Planche", en: "Plank" } },
  },
  14635: {
    id: 14635,
    name: { es: "Pepita", fr: "Pépite", en: "Nugget" },
    iconId: 50718,
    level: 1,
    typeId: 50,
    type: { id: 50, superCategoryId: 0, name: { es: "Piedra preciosa", fr: "Pierre précieuse", en: "Precious stone" } },
  },
  9686: {
    id: 9686,
    name: { es: "Piedra de alma pequeña", fr: "Petite pierre d'âme", en: "Small Soul Stone" },
    iconId: 83019,
    level: 20,
    typeId: 83,
    type: { id: 83, superCategoryId: 0, name: { es: "Piedra de alma", fr: "Pierre d'âme", en: "Soul stone" } },
  },
  9687: {
    id: 9687,
    name: { es: "Piedra de alma mediana", fr: "Moyenne pierre d'âme", en: "Medium Soul Stone" },
    iconId: 83020,
    level: 50,
    typeId: 83,
    type: { id: 83, superCategoryId: 0, name: { es: "Piedra de alma", fr: "Pierre d'âme", en: "Soul stone" } },
  },
  9688: {
    id: 9688,
    name: { es: "Piedra de alma grande", fr: "Grande pierre d'âme", en: "Large Soul Stone" },
    iconId: 83021,
    level: 100,
    typeId: 83,
    type: { id: 83, superCategoryId: 0, name: { es: "Piedra de alma", fr: "Pierre d'âme", en: "Soul stone" } },
  },
  9689: {
    id: 9689,
    name: { es: "Piedra de alma enorme", fr: "Énorme pierre d'âme", en: "Huge Soul Stone" },
    iconId: 83022,
    level: 150,
    typeId: 83,
    type: { id: 83, superCategoryId: 0, name: { es: "Piedra de alma", fr: "Pierre d'âme", en: "Soul stone" } },
  },
  9690: {
    id: 9690,
    name: { es: "Piedra de alma gigantesca", fr: "Gigantesque pierre d'âme", en: "Gigantic Soul Stone" },
    iconId: 83023,
    level: 190,
    typeId: 83,
    type: { id: 83, superCategoryId: 0, name: { es: "Piedra de alma", fr: "Pierre d'âme", en: "Soul stone" } },
  },
  21984: {
    id: 21984,
    name: { es: "Piedra de alma heroica", fr: "Pierre d'âme héroïque", en: "Heroic Soul Stone" },
    iconId: 83015,
    level: 40,
    typeId: 83,
    type: { id: 83, superCategoryId: 0, name: { es: "Piedra de alma", fr: "Pierre d'âme", en: "Soul stone" } },
  },
  // Map fragments and ByC items lookup
  ...(() => {
    const mapsData = [
      { baseId: 15264, name: "Vil Sombra", fr: "d'Ombre", en: "Shadow", lvl: 200 },
      { baseId: 15273, name: "Gein", fr: "de Gein", en: "Gein", lvl: 200 },
      { baseId: 15282, name: "Kanígrula", fr: "de Canigroula", en: "Canigroula", lvl: 160 },
      { baseId: 15291, name: "Brumen Tinctorias", fr: "de Brumen Tinctorias", en: "Brumen Tinctorias", lvl: 70 },
      { baseId: 15300, name: "Dremoan", fr: "de Dremoan", en: "Dremoan", lvl: 120 },
      { baseId: 15309, name: "Ali Grofa", fr: "d'Ali Grofa", en: "Ali Grofa", lvl: 140 },
      { baseId: 15318, name: "Panterrosa", fr: "de Panterrose", en: "Panterrose", lvl: 100 },
      { baseId: 15327, name: "Hiperescampo", fr: "de l'Hyperscampe", en: "Hyperscampe", lvl: 130 },
      { baseId: 15336, name: "Musha el Maldito", fr: "de Musha le Maudit", en: "Musha the Cursed", lvl: 160 },
      { baseId: 15345, name: "Marranárgico", fr: "de Porsalu", en: "Porsalu", lvl: 110 },
      { baseId: 15354, name: "Rok Gintok", fr: "de Rok Gintok", en: "Rok Gintok", lvl: 180 },
      { baseId: 15363, name: "Zatoïshwan", fr: "de Zatoïshwan", en: "Zatoïshwan", lvl: 150 },
    ];
    const res: Record<number, DofusItem> = {};
    for (const m of mapsData) {
      for (let i = 0; i < 8; i++) {
        const fragId = m.baseId + i;
        res[fragId] = {
          id: fragId,
          name: {
            es: `Fragmento de mapa de ${m.name} [${i + 1}/8]`,
            fr: `Fragment de carte ${m.fr} [${i + 1}/8]`,
            en: `${m.en} Map Fragment [${i + 1}/8]`,
          },
          iconId: 77042,
          level: m.lvl,
          typeId: 175,
          type: { id: 175, superCategoryId: 0, name: { es: "Fragmento de mapa", fr: "Fragment de carte", en: "Map fragment" } },
        };
      }
    }
    res[15391] = {
      id: 15391,
      name: { es: "Tabla de Totankama", fr: "Tablette de Totankama", en: "Totankama Tablet" },
      iconId: 126026,
      level: 130,
      typeId: 174,
      type: { id: 174, superCategoryId: 0, name: { es: "Tabla", fr: "Tablette", en: "Tablet" } },
    };
    for (let i = 1; i <= 5; i++) {
      const pieceId = 15393 + i;
      res[pieceId] = {
        id: pieceId,
        name: {
          es: `Trozo de la tabla de Totankama ${i}/5`,
          fr: `Morceau de tablette de Totankama ${i}/5`,
          en: `Piece of Totankama Tablet ${i}/5`,
        },
        iconId: 126027,
        level: 130,
        typeId: 175,
        type: { id: 175, superCategoryId: 0, name: { es: "Trozo de tabla", fr: "Morceau de tablette", en: "Tablet piece" } },
      };
    }
    if (Array.isArray(bycGeneratedDb)) {
      for (const hunt of bycGeneratedDb as any[]) {
        if (hunt.mapItem?.id && hunt.mapItem?.name) {
          res[hunt.mapItem.id] = {
            id: hunt.mapItem.id,
            name: { es: hunt.mapItem.name, fr: hunt.mapItem.name_fr || hunt.mapItem.name, en: hunt.mapItem.name },
            iconId: hunt.mapItem.iconId || 77041,
            level: hunt.monsterLevel || 100,
            typeId: 174,
            type: { id: 174, superCategoryId: 0, name: { es: "Mapa", fr: "Carte", en: "Map" } },
          };
        }
        if (Array.isArray(hunt.fragments)) {
          for (const f of hunt.fragments) {
            if (f.id && f.name) {
              res[f.id] = {
                id: f.id,
                name: { es: f.name, fr: f.name_fr || f.name, en: f.name },
                iconId: f.iconId || 77042,
                level: hunt.monsterLevel || 100,
                typeId: 175,
                type: { id: 175, superCategoryId: 0, name: { es: "Fragmento de mapa", fr: "Fragment de carte", en: "Map fragment" } },
              };
            }
          }
        }
        if (hunt.resource?.id && hunt.resource?.name) {
          res[hunt.resource.id] = {
            id: hunt.resource.id,
            name: { es: hunt.resource.name, fr: hunt.resource.name_fr || hunt.resource.name, en: hunt.resource.name },
            iconId: hunt.resource.iconId || 24971,
            level: hunt.monsterLevel || 100,
            typeId: 71,
            type: { id: 71, superCategoryId: 0, name: { es: hunt.resource.type || "Recurso", fr: "Ressource", en: "Resource" } },
          };
        }
      }
    }
    for (const rune of ALL_DOFUS_RUNES) {
      if (!res[rune.id]) {
        res[rune.id] = {
          id: rune.id,
          name: { es: rune.name.es, fr: rune.name.fr, en: rune.name.en },
          iconId: rune.iconId,
          level: rune.level,
          typeId: 78,
          type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
        };
      }
    }
    return res;
  })(),
};

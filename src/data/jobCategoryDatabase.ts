import { DofusJob } from "../types";

export interface JobCategoryDefinition {
  id: string;
  nameEs: string;
  nameFr: string;
  dofusDbTypes: number[];
  dofusDuTypes: number[];
  keywords: string[];
}

export interface JobDatabaseEntry {
  id: number;
  nameEs: string;
  nameFr: string;
  icon: string;
  ankamaJobIds: number[];
  description: string;
  categories: JobCategoryDefinition[];
}

/**
 * Base de datos oficial de Categorías u Oficios de Dofus 3.0 / DofusDB / DofusDU
 * Mapeo estricto para evitar colisiones entre distintas APIs y categorías cruzadas.
 */
export const JOB_CATEGORY_DATABASE: JobDatabaseEntry[] = [
  {
    id: 24,
    nameEs: "Minero",
    nameFr: "Mineur",
    icon: "Pickaxe",
    ankamaJobIds: [24],
    description:
      "Extracción y fundición de minerales, elaboración de aleaciones, piedras preciosas, brutas y de alma.",
    categories: [
      {
        id: "minerales",
        nameEs: "Mineral",
        nameFr: "Minerai",
        dofusDbTypes: [39],
        dofusDuTypes: [167],
        keywords: [
          "mineral",
          "minerai",
          "hierro",
          "cobre",
          "bronce",
          "plata",
          "oro",
          "bauxita",
          "manganeso",
          "estonio",
          "dolomita",
          "silicio",
          "obsidiana",
        ],
      },
      {
        id: "aleaciones",
        nameEs: "Aleación",
        nameFr: "Alliage",
        dofusDbTypes: [40],
        dofusDuTypes: [153],
        keywords: [
          "aleación",
          "aleacion",
          "alliage",
          "lingote",
          "lingot",
          "piruta",
          "ebonita",
          "kourak",
          "ardonita",
          "magnesita",
          "bakelita",
          "aluminita",
        ],
      },
      {
        id: "piedras_preciosas",
        nameEs: "Piedra preciosa",
        nameFr: "Pierre précieuse",
        dofusDbTypes: [50],
        dofusDuTypes: [66],
        keywords: [
          "piedra preciosa",
          "pierre précieuse",
          "rubí",
          "rubi",
          "diamante",
          "esmeralda",
          "zafiro",
          "cristal",
          "aguamarina",
        ],
      },
      {
        id: "piedras_brutas",
        nameEs: "Piedra bruta",
        nameFr: "Pierre brute",
        dofusDbTypes: [51],
        dofusDuTypes: [91],
        keywords: ["piedra bruta", "pierre brute"],
      },
      {
        id: "piedras_alma",
        nameEs: "Piedra de alma",
        nameFr: "Pierre d'âme",
        dofusDbTypes: [83, 85, 307, 308],
        dofusDuTypes: [82, 83],
        keywords: ["piedra de alma", "pierre d'âme", "gema espiritual"],
      },
    ],
  },
  {
    id: 2,
    nameEs: "Leñador",
    nameFr: "Bûcheron",
    icon: "Axe",
    ankamaJobIds: [2],
    description:
      "Corte de maderas, fabricación de tablas, sustratos y concentrados forestales.",
    categories: [
      {
        id: "maderas",
        nameEs: "Madera",
        nameFr: "Bois",
        dofusDbTypes: [38],
        dofusDuTypes: [12],
        keywords: [
          "madera",
          "bois",
          "fresno",
          "roble",
          "nogal",
          "castaño",
          "pino",
          "carpe",
          "cerezo",
          "ébano",
          "calipto",
          "bambú",
          "olivino",
        ],
      },
      {
        id: "tablas",
        nameEs: "Tabla",
        nameFr: "Planche",
        dofusDbTypes: [95],
        dofusDuTypes: [170],
        keywords: [
          "tabla",
          "planche",
          "aglomerado",
          "contrachapado",
          "ebanista",
        ],
      },
      {
        id: "concentrados_sustratos",
        nameEs: "Concentrado",
        nameFr: "Concentré",
        dofusDbTypes: [183, 185],
        dofusDuTypes: [62],
        keywords: [
          "concentrado",
          "concentré",
          "sustrato",
          "substrat",
          "espesura",
          "bosque",
          "savia",
        ],
      },
    ],
  },
  {
    id: 26,
    nameEs: "Alquimista",
    nameFr: "Alchimiste",
    icon: "FlaskConical",
    ankamaJobIds: [26],
    description:
      "Elaboración de pociones, elixires, esencias de guardianes y tinturas.",
    categories: [
      {
        id: "pociones",
        nameEs: "Pócima",
        nameFr: "Potion",
        dofusDbTypes: [12, 26, 79, 96],
        dofusDuTypes: [96],
        keywords: [
          "pocima",
          "pócima",
          "pocion",
          "poción",
          "potion",
          "recuerdo",
          "bonta",
          "brakmar",
          "mini de curación",
        ],
      },
      {
        id: "elixires",
        nameEs: "Elixir",
        nameFr: "Elixir",
        dofusDbTypes: [71],
        dofusDuTypes: [],
        keywords: ["elixir"],
      },
      {
        id: "esencias",
        nameEs: "Esencia de guardián de mazmorra",
        nameFr: "Essence de gardien de donjon",
        dofusDbTypes: [167],
        dofusDuTypes: [60],
        keywords: ["esencia de", "essence de"],
      },
      {
        id: "tinturas",
        nameEs: "Tintura",
        nameFr: "Teinture",
        dofusDbTypes: [70],
        dofusDuTypes: [],
        keywords: ["tintura", "teinture"],
      },
      {
        id: "preparaciones",
        nameEs: "Preparación",
        nameFr: "Préparation",
        dofusDbTypes: [179, 206, 228],
        dofusDuTypes: [72, 151],
        keywords: [
          "preparación",
          "preparacion",
          "líquido",
          "liquido",
          "bebida",
        ],
      },
    ],
  },
  {
    id: 28,
    nameEs: "Campesino",
    nameFr: "Paysan",
    icon: "Wheat",
    ankamaJobIds: [28, 22],
    description:
      "Recolecta de cereales, molienda de harinas, preparación de panes y aceites.",
    categories: [
      {
        id: "cereales",
        nameEs: "Cereal",
        nameFr: "Céréale",
        dofusDbTypes: [34, 58],
        dofusDuTypes: [128],
        keywords: [
          "cereal",
          "céréale",
          "trigo",
          "cebada",
          "avena",
          "lúpulo",
          "lino",
          "centeno",
          "arroz",
          "malta",
          "cáñamo",
        ],
      },
      {
        id: "harinas",
        nameEs: "Harina",
        nameFr: "Farine",
        dofusDbTypes: [88, 89],
        dofusDuTypes: [],
        keywords: ["harina", "farine"],
      },
      {
        id: "panes",
        nameEs: "Pan",
        nameFr: "Pain",
        dofusDbTypes: [33],
        dofusDuTypes: [],
        keywords: ["pan", "pain", "brioche", "hogaza"],
      },
      {
        id: "aceites",
        nameEs: "Aceite",
        nameFr: "Huile",
        dofusDbTypes: [60],
        dofusDuTypes: [129],
        keywords: ["aceite", "huile"],
      },
      {
        id: "cervezas",
        nameEs: "Cerveza",
        nameFr: "Bière",
        dofusDbTypes: [37],
        dofusDuTypes: [54],
        keywords: ["cerveza", "bière"],
      },
    ],
  },
  {
    id: 11,
    nameEs: "Herrero",
    nameFr: "Forgeur",
    icon: "Sword",
    ankamaJobIds: [11, 14, 17, 18, 19, 20, 44],
    description:
      "Forja de espadas, dagas, martillos, palas, hachas, picos, guadañas y lanzas.",
    categories: [
      {
        id: "espadas",
        nameEs: "Espada",
        nameFr: "Épée",
        dofusDbTypes: [6],
        dofusDuTypes: [],
        keywords: ["espada", "épée"],
      },
      {
        id: "dagas",
        nameEs: "Daga",
        nameFr: "Dague",
        dofusDbTypes: [5],
        dofusDuTypes: [],
        keywords: ["daga", "dague"],
      },
      {
        id: "martillos",
        nameEs: "Martillo",
        nameFr: "Marteau",
        dofusDbTypes: [7],
        dofusDuTypes: [],
        keywords: ["martillo", "marteau"],
      },
      {
        id: "palas",
        nameEs: "Pala",
        nameFr: "Pelle",
        dofusDbTypes: [8],
        dofusDuTypes: [],
        keywords: ["pala", "pelle"],
      },
      {
        id: "hachas",
        nameEs: "Hacha",
        nameFr: "Hache",
        dofusDbTypes: [19],
        dofusDuTypes: [],
        keywords: ["hacha", "hache"],
      },
      {
        id: "picos",
        nameEs: "Pico",
        nameFr: "Pioche",
        dofusDbTypes: [21],
        dofusDuTypes: [],
        keywords: ["pico de minero", "pioche"],
      },
      {
        id: "guadañas",
        nameEs: "Guadaña",
        nameFr: "Faux",
        dofusDbTypes: [22],
        dofusDuTypes: [],
        keywords: ["guadaña", "faux"],
      },
      {
        id: "lanzas",
        nameEs: "Lanza",
        nameFr: "Lance",
        dofusDbTypes: [271],
        dofusDuTypes: [],
        keywords: ["lanza", "lance"],
      },
      {
        id: "herramientas",
        nameEs: "Herramienta",
        nameFr: "Outil",
        dofusDbTypes: [20],
        dofusDuTypes: [],
        keywords: ["herramienta", "outil"],
      },
    ],
  },
  {
    id: 13,
    nameEs: "Escultor",
    nameFr: "Sculpteur",
    icon: "Wand2",
    ankamaJobIds: [13, 25, 48],
    description: "Creación de varitas mágicas, bastones y arcos.",
    categories: [
      {
        id: "arcos",
        nameEs: "Arco",
        nameFr: "Arc",
        dofusDbTypes: [2],
        dofusDuTypes: [],
        keywords: ["arco", "arc"],
      },
      {
        id: "varitas",
        nameEs: "Varita",
        nameFr: "Baguette",
        dofusDbTypes: [3],
        dofusDuTypes: [],
        keywords: ["varita", "baguette"],
      },
      {
        id: "bastones",
        nameEs: "Bastón",
        nameFr: "Bâton",
        dofusDbTypes: [4],
        dofusDuTypes: [],
        keywords: ["bastón", "baston", "bâton"],
      },
    ],
  },
  {
    id: 16,
    nameEs: "Joyero",
    nameFr: "Bijoutier",
    icon: "Gem",
    ankamaJobIds: [16, 63],
    description: "Fabricación de anillos, amuletos y joyería fina.",
    categories: [
      {
        id: "amuletos",
        nameEs: "Amuleto",
        nameFr: "Amulette",
        dofusDbTypes: [1],
        dofusDuTypes: [],
        keywords: ["amuleto", "amulette", "colgante"],
      },
      {
        id: "anillos",
        nameEs: "Anillo",
        nameFr: "Anneau",
        dofusDbTypes: [9],
        dofusDuTypes: [33],
        keywords: ["anillo", "anneau", "gelanillo", "gelano"],
      },
    ],
  },
  {
    id: 15,
    nameEs: "Zapatero",
    nameFr: "Cordonnier",
    icon: "Footprints",
    ankamaJobIds: [15, 62],
    description: "Elaboración de botas y cinturones.",
    categories: [
      {
        id: "botas",
        nameEs: "Botas",
        nameFr: "Bottes",
        dofusDbTypes: [11],
        dofusDuTypes: [],
        keywords: ["botas", "bottes", "zapato"],
      },
      {
        id: "cinturones",
        nameEs: "Cinturón",
        nameFr: "Ceinture",
        dofusDbTypes: [10],
        dofusDuTypes: [],
        keywords: ["cinturón", "cinturon", "ceinture"],
      },
    ],
  },
  {
    id: 27,
    nameEs: "Sastre",
    nameFr: "Tailleur",
    icon: "Scissors",
    ankamaJobIds: [27, 64],
    description: "Confección de sombreros, capas y mochilas.",
    categories: [
      {
        id: "sombreros",
        nameEs: "Sombrero",
        nameFr: "Chapeau",
        dofusDbTypes: [16],
        dofusDuTypes: [],
        keywords: ["sombrero", "chapeau", "coiffe", "tocado"],
      },
      {
        id: "capas",
        nameEs: "Capa",
        nameFr: "Cape",
        dofusDbTypes: [17],
        dofusDuTypes: [],
        keywords: ["capa", "cape"],
      },
      {
        id: "mochilas",
        nameEs: "Mochila",
        nameFr: "Sac à dos",
        dofusDbTypes: [81],
        dofusDuTypes: [],
        keywords: ["mochila", "sac à dos"],
      },
    ],
  },
  {
    id: 60,
    nameEs: "Fabricante",
    nameFr: "Façonneur",
    icon: "Shield",
    ankamaJobIds: [60, 82, 74],
    description: "Fabricación de escudos tácticos, trofeos e ídolos.",
    categories: [
      {
        id: "escudos",
        nameEs: "Escudo",
        nameFr: "Bouclier",
        dofusDbTypes: [82],
        dofusDuTypes: [],
        keywords: ["escudo", "bouclier"],
      },
      {
        id: "trofeos",
        nameEs: "Trofeo",
        nameFr: "Trophée",
        dofusDbTypes: [151],
        dofusDuTypes: [],
        keywords: ["trofeo", "trophée"],
      },
      {
        id: "idolos",
        nameEs: "Ídolo",
        nameFr: "Idole",
        dofusDbTypes: [188],
        dofusDuTypes: [],
        keywords: ["ídolo", "idolo", "idole"],
      },
      {
        id: "prismas",
        nameEs: "Prisma",
        nameFr: "Prisme",
        dofusDbTypes: [112, 217],
        dofusDuTypes: [],
        keywords: ["prisma", "prisme", "prismaradita"],
      },
    ],
  },
  {
    id: 65,
    nameEs: "Manitas",
    nameFr: "Bricoleur",
    icon: "Wrench",
    ankamaJobIds: [65],
    description: "Fabricación de llaves de mazmorra.",
    categories: [
      {
        id: "llaves",
        nameEs: "Llave",
        nameFr: "Clé",
        dofusDbTypes: [84],
        dofusDuTypes: [50],
        keywords: ["llave", "clé", "clef"],
      },
    ],
  },
  {
    id: 101,
    nameEs: "Ganadero",
    nameFr: "Éleveur",
    icon: "Heart",
    ankamaJobIds: [101],
    description:
      "Fabricación de objetos de cría para monturas (bebederos, aporreadores, acariciadores, fulminadores, pesas, pesebreras, comederos, rayadores).",
    categories: [
      {
        id: "objetos_cria",
        nameEs: "Objeto de cría",
        nameFr: "Objet d'élevage",
        dofusDbTypes: [99, 323, 326, 327],
        dofusDuTypes: [],
        keywords: [
          "bebedero",
          "aporreador",
          "rayador",
          "freno",
          "pesebrera",
          "fulminador",
          "acariciador",
          "pesa",
          "comedero",
          "objeto de cría",
          "objetos de cría",
          "cría",
          "cria",
          "ganadero",
          "dragopavo",
          "mulagua",
          "vueloceronte",
        ],
      },
    ],
  },
  {
    id: 41,
    nameEs: "Cazador",
    nameFr: "Chasseur",
    icon: "Drumstick",
    ankamaJobIds: [41],
    description: "Conservación de carnes y preparación de platos carnívoros.",
    categories: [
      {
        id: "carne_comestible",
        nameEs: "Carne comestible",
        nameFr: "Viande comestible",
        dofusDbTypes: [69],
        dofusDuTypes: [150],
        keywords: ["carne comestible", "viande comestible"],
      },
      {
        id: "carne_primitiva",
        nameEs: "Carne sin conservar",
        nameFr: "Viande conservée",
        dofusDbTypes: [187],
        dofusDuTypes: [38],
        keywords: ["carne intangible", "carne conservada", "carne primitiva"],
      },
    ],
  },
  {
    id: 36,
    nameEs: "Pescador",
    nameFr: "Pêcheur",
    icon: "Fish",
    ankamaJobIds: [36],
    description: "Pesca y elaboración de platos de pescado.",
    categories: [
      {
        id: "pescado_comestible",
        nameEs: "Pescado comestible",
        nameFr: "Poisson comestible",
        dofusDbTypes: [49],
        dofusDuTypes: [64, 134],
        keywords: [
          "pescado comestible",
          "poisson comestible",
          "plato de pescado",
        ],
      },
      {
        id: "pescado_crudo",
        nameEs: "Pescado",
        nameFr: "Poisson",
        dofusDbTypes: [41],
        dofusDuTypes: [135],
        keywords: ["pescado", "poisson", "pez"],
      },
    ],
  },
];

/**
 * Fast Lookup Map: typeId -> Job & Category info for DofusDB items
 */
export const DOFUS_DB_TYPE_TO_JOB_MAP: Record<
  number,
  { jobId: number; jobNameEs: string; categoryNameEs: string }
> = {};

/**
 * Fast Lookup Map: typeId -> Job & Category info for DofusDU items
 */
export const DOFUS_DU_TYPE_TO_JOB_MAP: Record<
  number,
  { jobId: number; jobNameEs: string; categoryNameEs: string }
> = {};

// Initialize lookup maps
JOB_CATEGORY_DATABASE.forEach((job) => {
  job.categories.forEach((cat) => {
    cat.dofusDbTypes.forEach((tId) => {
      DOFUS_DB_TYPE_TO_JOB_MAP[tId] = {
        jobId: job.id,
        jobNameEs: job.nameEs,
        categoryNameEs: cat.nameEs,
      };
    });
    cat.dofusDuTypes.forEach((tId) => {
      DOFUS_DU_TYPE_TO_JOB_MAP[tId] = {
        jobId: job.id,
        jobNameEs: job.nameEs,
        categoryNameEs: cat.nameEs,
      };
    });
  });
});

// Dataset autogenerado y verificado de Pergaminos de Sebuscalines y Consumibles de Recolección con Estadísticas Permanentes

export interface CharacteristicScrollItem {
  id: number;
  name: string;
  stat: 'Fuerza' | 'Vitalidad' | 'Sabiduría' | 'Inteligencia' | 'Suerte' | 'Agilidad' | 'Especial';
  tier: 'pequeño' | 'mediano' | 'grande' | 'potente' | 'recurso';
  points: number;
  sebuscalines: number;
  iconId: number;
  maxStatLimit: number;
  isSpecial?: boolean;
}

export interface ConsumableIngredient {
  id: number;
  name: string;
  quantity: number;
  iconId?: number;
  typeId?: number;
}

export interface CharacteristicConsumableItem {
  id: number;
  name: string;
  stat: 'Fuerza' | 'Vitalidad' | 'Sabiduría' | 'Inteligencia' | 'Suerte' | 'Agilidad';
  points: number;
  level: number;
  iconId: number;
  job: 'Cazador' | 'Pescador' | 'Campesino' | 'Alquimista';
  jobId: number;
  criterions: string;
  maxStatLimit: number;
  effectId: number;
  effectsDesc?: string;
  recipeId?: number;
  ingredients: ConsumableIngredient[];
}

export const CHARACTERISTIC_SCROLLS: CharacteristicScrollItem[] = [
  {
    "id": 798,
    "name": "Pergamino pequeño de agilidad",
    "stat": "Agilidad",
    "tier": "pequeño",
    "points": 1,
    "sebuscalines": 20,
    "iconId": 76020,
    "maxStatLimit": 25
  },
  {
    "id": 799,
    "name": "Pergamino mediano de agilidad",
    "stat": "Agilidad",
    "tier": "mediano",
    "points": 1,
    "sebuscalines": 60,
    "iconId": 76026,
    "maxStatLimit": 50
  },
  {
    "id": 800,
    "name": "Pergamino grande de agilidad",
    "stat": "Agilidad",
    "tier": "grande",
    "points": 1,
    "sebuscalines": 140,
    "iconId": 76027,
    "maxStatLimit": 80
  },
  {
    "id": 801,
    "name": "Pergamino potente de agilidad",
    "stat": "Agilidad",
    "tier": "potente",
    "points": 2,
    "sebuscalines": 340,
    "iconId": 76028,
    "maxStatLimit": 100
  },
  {
    "id": 809,
    "name": "Pergamino pequeño de suerte",
    "stat": "Suerte",
    "tier": "pequeño",
    "points": 1,
    "sebuscalines": 20,
    "iconId": 76022,
    "maxStatLimit": 25
  },
  {
    "id": 811,
    "name": "Pergamino mediano de suerte",
    "stat": "Suerte",
    "tier": "mediano",
    "points": 1,
    "sebuscalines": 60,
    "iconId": 76032,
    "maxStatLimit": 50
  },
  {
    "id": 812,
    "name": "Pergamino grande de suerte",
    "stat": "Suerte",
    "tier": "grande",
    "points": 1,
    "sebuscalines": 140,
    "iconId": 76033,
    "maxStatLimit": 80
  },
  {
    "id": 814,
    "name": "Pergamino potente de suerte",
    "stat": "Suerte",
    "tier": "potente",
    "points": 2,
    "sebuscalines": 340,
    "iconId": 76034,
    "maxStatLimit": 100
  },
  {
    "id": 686,
    "name": "Pergamino pequeño de inteligencia",
    "stat": "Inteligencia",
    "tier": "pequeño",
    "points": 1,
    "sebuscalines": 20,
    "iconId": 76023,
    "maxStatLimit": 25
  },
  {
    "id": 815,
    "name": "Pergamino mediano de inteligencia",
    "stat": "Inteligencia",
    "tier": "mediano",
    "points": 1,
    "sebuscalines": 60,
    "iconId": 76035,
    "maxStatLimit": 50
  },
  {
    "id": 816,
    "name": "Pergamino grande de inteligencia",
    "stat": "Inteligencia",
    "tier": "grande",
    "points": 1,
    "sebuscalines": 140,
    "iconId": 76036,
    "maxStatLimit": 80
  },
  {
    "id": 817,
    "name": "Pergamino potente de inteligencia",
    "stat": "Inteligencia",
    "tier": "potente",
    "points": 2,
    "sebuscalines": 340,
    "iconId": 76037,
    "maxStatLimit": 100
  },
  {
    "id": 683,
    "name": "Pergamino pequeño de fuerza",
    "stat": "Fuerza",
    "tier": "pequeño",
    "points": 1,
    "sebuscalines": 20,
    "iconId": 76021,
    "maxStatLimit": 25
  },
  {
    "id": 795,
    "name": "Pergamino mediano de fuerza",
    "stat": "Fuerza",
    "tier": "mediano",
    "points": 1,
    "sebuscalines": 60,
    "iconId": 76029,
    "maxStatLimit": 50
  },
  {
    "id": 796,
    "name": "Pergamino grande de fuerza",
    "stat": "Fuerza",
    "tier": "grande",
    "points": 1,
    "sebuscalines": 140,
    "iconId": 76030,
    "maxStatLimit": 80
  },
  {
    "id": 797,
    "name": "Pergamino potente de fuerza",
    "stat": "Fuerza",
    "tier": "potente",
    "points": 2,
    "sebuscalines": 340,
    "iconId": 76031,
    "maxStatLimit": 100
  },
  {
    "id": 806,
    "name": "Pergamino pequeño de vitalidad",
    "stat": "Vitalidad",
    "tier": "pequeño",
    "points": 1,
    "sebuscalines": 20,
    "iconId": 76025,
    "maxStatLimit": 25
  },
  {
    "id": 807,
    "name": "Pergamino mediano de vitalidad",
    "stat": "Vitalidad",
    "tier": "mediano",
    "points": 1,
    "sebuscalines": 60,
    "iconId": 76041,
    "maxStatLimit": 50
  },
  {
    "id": 808,
    "name": "Pergamino grande de vitalidad",
    "stat": "Vitalidad",
    "tier": "grande",
    "points": 1,
    "sebuscalines": 140,
    "iconId": 76042,
    "maxStatLimit": 80
  },
  {
    "id": 810,
    "name": "Pergamino potente de vitalidad",
    "stat": "Vitalidad",
    "tier": "potente",
    "points": 2,
    "sebuscalines": 340,
    "iconId": 76043,
    "maxStatLimit": 100
  },
  {
    "id": 802,
    "name": "Pergamino pequeño de sabiduría",
    "stat": "Sabiduría",
    "tier": "pequeño",
    "points": 1,
    "sebuscalines": 20,
    "iconId": 76024,
    "maxStatLimit": 25
  },
  {
    "id": 803,
    "name": "Pergamino mediano de sabiduría",
    "stat": "Sabiduría",
    "tier": "mediano",
    "points": 1,
    "sebuscalines": 60,
    "iconId": 76038,
    "maxStatLimit": 50
  },
  {
    "id": 804,
    "name": "Pergamino grande de sabiduría",
    "stat": "Sabiduría",
    "tier": "grande",
    "points": 1,
    "sebuscalines": 140,
    "iconId": 76039,
    "maxStatLimit": 80
  },
  {
    "id": 805,
    "name": "Pergamino potente de sabiduría",
    "stat": "Sabiduría",
    "tier": "potente",
    "points": 2,
    "sebuscalines": 340,
    "iconId": 76040,
    "maxStatLimit": 100
  },
  {
    "id": 15271,
    "name": "Turmalina",
    "stat": "Especial",
    "tier": "recurso",
    "points": 0,
    "sebuscalines": 200,
    "iconId": 50719,
    "isSpecial": true,
    "maxStatLimit": 0
  }
];

export const CHARACTERISTIC_CONSUMABLES: CharacteristicConsumableItem[] = [
  {
    "id": 1769,
    "name": "Pez tigre ahumado",
    "stat": "Sabiduría",
    "points": 1,
    "level": 40,
    "iconId": 49077,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1762,
        "name": "Pez tigre",
        "quantity": 1,
        "iconId": 41279,
        "typeId": 41
      },
      {
        "id": 1734,
        "name": "Cereza",
        "quantity": 1,
        "iconId": 46265,
        "typeId": 46
      },
      {
        "id": 428,
        "name": "Salvia",
        "quantity": 1,
        "iconId": 36643,
        "typeId": 36
      }
    ],
    "recipeId": 1769,
    "criterions": "cw<20",
    "maxStatLimit": 20,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 1817,
    "name": "Carpita al vapor",
    "stat": "Sabiduría",
    "points": 1,
    "level": 60,
    "iconId": 49087,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1796,
        "name": "Carpita de las arenas",
        "quantity": 1,
        "iconId": 41307,
        "typeId": 41
      },
      {
        "id": 1977,
        "name": "Especias",
        "quantity": 1,
        "iconId": 15378,
        "typeId": 15
      },
      {
        "id": 395,
        "name": "Trébol de 5 hojas",
        "quantity": 1,
        "iconId": 36067,
        "typeId": 36
      }
    ],
    "recipeId": 1817,
    "criterions": "cw<30",
    "maxStatLimit": 30,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 1824,
    "name": "Perca gatito saltarina",
    "stat": "Sabiduría",
    "points": 1,
    "level": 120,
    "iconId": 49092,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1803,
        "name": "Gatito perca",
        "quantity": 1,
        "iconId": 41315,
        "typeId": 41
      },
      {
        "id": 1978,
        "name": "Medida de pimienta",
        "quantity": 1,
        "iconId": 48734,
        "typeId": 48
      },
      {
        "id": 594,
        "name": "Edelweiss",
        "quantity": 1,
        "iconId": 35191,
        "typeId": 35
      }
    ],
    "recipeId": 1824,
    "criterions": "cw<60",
    "maxStatLimit": 60,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 1828,
    "name": "Lubina fónica asada",
    "stat": "Sabiduría",
    "points": 1,
    "level": 160,
    "iconId": 49099,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1792,
        "name": "Lubina Fónica",
        "quantity": 1,
        "iconId": 41303,
        "typeId": 41
      },
      {
        "id": 1975,
        "name": "Cebolla",
        "quantity": 1,
        "iconId": 68377,
        "typeId": 68
      },
      {
        "id": 16385,
        "name": "Ginseng",
        "quantity": 2,
        "iconId": 36644,
        "typeId": 36
      }
    ],
    "recipeId": 1828,
    "criterions": "cw<80",
    "maxStatLimit": 80,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 1830,
    "name": "Gobio kesta troceado",
    "stat": "Sabiduría",
    "points": 1,
    "level": 1,
    "iconId": 49101,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1790,
        "name": "Gobio kesta",
        "quantity": 1,
        "iconId": 41302,
        "typeId": 41
      }
    ],
    "recipeId": 1830,
    "criterions": "cw<5",
    "maxStatLimit": 5,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 1834,
    "name": "Trucha ancestral asada",
    "stat": "Sabiduría",
    "points": 1,
    "level": 20,
    "iconId": 49109,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1846,
        "name": "Trucha ancestral",
        "quantity": 1,
        "iconId": 41398,
        "typeId": 41
      },
      {
        "id": 421,
        "name": "Ortiga",
        "quantity": 1,
        "iconId": 36642,
        "typeId": 36
      }
    ],
    "recipeId": 1834,
    "criterions": "cw<10",
    "maxStatLimit": 10,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 1837,
    "name": "Lucio Tupe-Halett relleno",
    "stat": "Sabiduría",
    "points": 1,
    "level": 80,
    "iconId": 49134,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1849,
        "name": "Lucio Tupe-Halett",
        "quantity": 1,
        "iconId": 41402,
        "typeId": 41
      },
      {
        "id": 519,
        "name": "Polvos mágicos",
        "quantity": 1,
        "iconId": 48002,
        "typeId": 48
      },
      {
        "id": 380,
        "name": "Menta salvaje",
        "quantity": 1,
        "iconId": 36052,
        "typeId": 36
      }
    ],
    "recipeId": 1837,
    "criterions": "cw<40",
    "maxStatLimit": 40,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 13276,
    "name": "Ragú de inverluza glacial",
    "stat": "Sabiduría",
    "points": 1,
    "level": 200,
    "iconId": 49141,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 11500,
        "name": "Inverluza glacial",
        "quantity": 1,
        "iconId": 41404,
        "typeId": 41
      },
      {
        "id": 16389,
        "name": "Mandrágora",
        "quantity": 3,
        "iconId": 36645,
        "typeId": 36
      },
      {
        "id": 11475,
        "name": "Aguas tranquilas",
        "quantity": 1,
        "iconId": 15778,
        "typeId": 228
      }
    ],
    "recipeId": 13276,
    "criterions": "cw<100",
    "maxStatLimit": 100,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 16476,
    "name": "Anguila sigila asada",
    "stat": "Sabiduría",
    "points": 1,
    "level": 100,
    "iconId": 49144,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 16462,
        "name": "Anguila sigila",
        "quantity": 1,
        "iconId": 41408,
        "typeId": 41
      },
      {
        "id": 1985,
        "name": "Resina",
        "quantity": 1,
        "iconId": 15382,
        "typeId": 228
      },
      {
        "id": 593,
        "name": "Orquídea freyesca",
        "quantity": 1,
        "iconId": 35192,
        "typeId": 35
      }
    ],
    "recipeId": 16476,
    "criterions": "cw<50",
    "maxStatLimit": 50,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 16480,
    "name": "Enchalada de gazrape",
    "stat": "Sabiduría",
    "points": 1,
    "level": 140,
    "iconId": 49148,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 16466,
        "name": "Gazrape",
        "quantity": 1,
        "iconId": 41412,
        "typeId": 41
      },
      {
        "id": 1974,
        "name": "Hoja de enchalada",
        "quantity": 1,
        "iconId": 68376,
        "typeId": 68
      },
      {
        "id": 7059,
        "name": "Semilla de pandoja",
        "quantity": 1,
        "iconId": 58067,
        "typeId": 58
      }
    ],
    "recipeId": 16480,
    "criterions": "cw<70",
    "maxStatLimit": 70,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 16484,
    "name": "Tenca cuidado guisada",
    "stat": "Sabiduría",
    "points": 1,
    "level": 180,
    "iconId": 49152,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 16470,
        "name": "Tenca cuidado",
        "quantity": 1,
        "iconId": 41416,
        "typeId": 41
      },
      {
        "id": 1731,
        "name": "Dosis de zumo sabroso",
        "quantity": 1,
        "iconId": 15262,
        "typeId": 15
      },
      {
        "id": 16387,
        "name": "Belladona",
        "quantity": 2,
        "iconId": 35638,
        "typeId": 35
      }
    ],
    "recipeId": 16484,
    "criterions": "cw<90",
    "maxStatLimit": 90,
    "effectId": 606,
    "effectsDesc": "1 Sabiduría"
  },
  {
    "id": 17170,
    "name": "Buñuelos astrubienses reconstituyentes",
    "stat": "Fuerza",
    "points": 1,
    "level": 20,
    "iconId": 69747,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17125,
        "name": "Chicha manida",
        "quantity": 1,
        "iconId": 63414,
        "typeId": 63
      },
      {
        "id": 289,
        "name": "Trigo",
        "quantity": 1,
        "iconId": 34009,
        "typeId": 34
      }
    ],
    "recipeId": 17170,
    "criterions": "cs<10",
    "maxStatLimit": 10,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17172,
    "name": "Rollo de carne reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 30,
    "iconId": 69826,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17127,
        "name": "Chicha adulterada",
        "quantity": 1,
        "iconId": 63492,
        "typeId": 63
      },
      {
        "id": 289,
        "name": "Trigo",
        "quantity": 1,
        "iconId": 34009,
        "typeId": 34
      }
    ],
    "recipeId": 17172,
    "criterions": "cs<15",
    "maxStatLimit": 15,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17174,
    "name": "Papillote al limón reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 40,
    "iconId": 69745,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17129,
        "name": "Chicha industrial",
        "quantity": 1,
        "iconId": 63412,
        "typeId": 63
      },
      {
        "id": 400,
        "name": "Cebada",
        "quantity": 1,
        "iconId": 34082,
        "typeId": 34
      },
      {
        "id": 1736,
        "name": "Limón",
        "quantity": 1,
        "iconId": 46266,
        "typeId": 46
      }
    ],
    "recipeId": 17174,
    "criterions": "cs<20",
    "maxStatLimit": 20,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17176,
    "name": "Ensalada sufokeña reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 50,
    "iconId": 69817,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17131,
        "name": "Chicha tierna",
        "quantity": 1,
        "iconId": 63484,
        "typeId": 63
      },
      {
        "id": 400,
        "name": "Cebada",
        "quantity": 1,
        "iconId": 34082,
        "typeId": 34
      },
      {
        "id": 1974,
        "name": "Hoja de enchalada",
        "quantity": 1,
        "iconId": 68376,
        "typeId": 68
      }
    ],
    "recipeId": 17176,
    "criterions": "cs<25",
    "maxStatLimit": 25,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17178,
    "name": "Fritada amakneana reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 60,
    "iconId": 69753,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17133,
        "name": "Chicha corrompida",
        "quantity": 1,
        "iconId": 63421,
        "typeId": 63
      },
      {
        "id": 533,
        "name": "Avena",
        "quantity": 1,
        "iconId": 34154,
        "typeId": 34
      },
      {
        "id": 1973,
        "name": "Aceite para freír",
        "quantity": 1,
        "iconId": 60073,
        "typeId": 60
      }
    ],
    "recipeId": 17178,
    "criterions": "cs<30",
    "maxStatLimit": 30,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17180,
    "name": "Parmentier de cebolla reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 70,
    "iconId": 69759,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17135,
        "name": "Chicha rancia",
        "quantity": 1,
        "iconId": 63427,
        "typeId": 63
      },
      {
        "id": 533,
        "name": "Avena",
        "quantity": 1,
        "iconId": 34154,
        "typeId": 34
      },
      {
        "id": 1975,
        "name": "Cebolla",
        "quantity": 1,
        "iconId": 68377,
        "typeId": 68
      }
    ],
    "recipeId": 17180,
    "criterions": "cs<35",
    "maxStatLimit": 35,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17182,
    "name": "Paté bontariano reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 80,
    "iconId": 69841,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17137,
        "name": "Chicha sanguinolenta",
        "quantity": 1,
        "iconId": 63465,
        "typeId": 63
      },
      {
        "id": 401,
        "name": "Lúpulo",
        "quantity": 1,
        "iconId": 34080,
        "typeId": 34
      },
      {
        "id": 1983,
        "name": "Grasa gelatinosa",
        "quantity": 1,
        "iconId": 15379,
        "typeId": 15
      }
    ],
    "recipeId": 17182,
    "criterions": "cs<40",
    "maxStatLimit": 40,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17184,
    "name": "Olla podrida sabrosa reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 90,
    "iconId": 69807,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17139,
        "name": "Chicha podrida",
        "quantity": 1,
        "iconId": 63474,
        "typeId": 63
      },
      {
        "id": 401,
        "name": "Lúpulo",
        "quantity": 1,
        "iconId": 34080,
        "typeId": 34
      },
      {
        "id": 1731,
        "name": "Dosis de zumo sabroso",
        "quantity": 1,
        "iconId": 15262,
        "typeId": 15
      }
    ],
    "recipeId": 17184,
    "criterions": "cs<45",
    "maxStatLimit": 45,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17186,
    "name": "Revuelto campero reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 100,
    "iconId": 69805,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17141,
        "name": "Chicha exudante",
        "quantity": 1,
        "iconId": 63472,
        "typeId": 63
      },
      {
        "id": 423,
        "name": "Lino",
        "quantity": 1,
        "iconId": 34122,
        "typeId": 34
      },
      {
        "id": 2331,
        "name": "Berenjena",
        "quantity": 1,
        "iconId": 46472,
        "typeId": 46
      }
    ],
    "recipeId": 17186,
    "criterions": "cs<50",
    "maxStatLimit": 50,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17188,
    "name": "Pemmican con alubias reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 110,
    "iconId": 69797,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17143,
        "name": "Chicha seca",
        "quantity": 1,
        "iconId": 63507,
        "typeId": 63
      },
      {
        "id": 423,
        "name": "Lino",
        "quantity": 1,
        "iconId": 34122,
        "typeId": 34
      },
      {
        "id": 6671,
        "name": "Alubias",
        "quantity": 1,
        "iconId": 58471,
        "typeId": 58
      }
    ],
    "recipeId": 17188,
    "criterions": "cs<55",
    "maxStatLimit": 55,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17190,
    "name": "Churrasco brakmariano reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 120,
    "iconId": 69786,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17145,
        "name": "Chicha cruda",
        "quantity": 1,
        "iconId": 63454,
        "typeId": 63
      },
      {
        "id": 532,
        "name": "Centeno",
        "quantity": 1,
        "iconId": 34083,
        "typeId": 34
      },
      {
        "id": 1984,
        "name": "Cenizas eternas",
        "quantity": 1,
        "iconId": 48671,
        "typeId": 48
      }
    ],
    "recipeId": 17190,
    "criterions": "cs<60",
    "maxStatLimit": 60,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17192,
    "name": "Marinada agridulce reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 130,
    "iconId": 69790,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17147,
        "name": "Chicha marmoleada",
        "quantity": 1,
        "iconId": 63458,
        "typeId": 63
      },
      {
        "id": 532,
        "name": "Centeno",
        "quantity": 1,
        "iconId": 34083,
        "typeId": 34
      },
      {
        "id": 1734,
        "name": "Cereza",
        "quantity": 1,
        "iconId": 46265,
        "typeId": 46
      }
    ],
    "recipeId": 17192,
    "criterions": "cs<65",
    "maxStatLimit": 65,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17194,
    "name": "Morcilla reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 140,
    "iconId": 69810,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17149,
        "name": "Chicha macerada",
        "quantity": 1,
        "iconId": 63477,
        "typeId": 63
      },
      {
        "id": 405,
        "name": "Malta",
        "quantity": 1,
        "iconId": 34561,
        "typeId": 34
      },
      {
        "id": 2012,
        "name": "Sangre de scorbuto",
        "quantity": 1,
        "iconId": 15389,
        "typeId": 228
      }
    ],
    "recipeId": 17194,
    "criterions": "cs<70",
    "maxStatLimit": 70,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17196,
    "name": "Carne en adobo con especias reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 150,
    "iconId": 69802,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17151,
        "name": "Chicha de animales silvestres",
        "quantity": 1,
        "iconId": 63469,
        "typeId": 63
      },
      {
        "id": 405,
        "name": "Malta",
        "quantity": 1,
        "iconId": 34561,
        "typeId": 34
      },
      {
        "id": 1977,
        "name": "Especias",
        "quantity": 1,
        "iconId": 15378,
        "typeId": 15
      }
    ],
    "recipeId": 17196,
    "criterions": "cs<75",
    "maxStatLimit": 75,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17198,
    "name": "Cocido recreativo reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 160,
    "iconId": 69774,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17153,
        "name": "Chicha fresca",
        "quantity": 1,
        "iconId": 63442,
        "typeId": 63
      },
      {
        "id": 425,
        "name": "Cáñamo",
        "quantity": 2,
        "iconId": 34121,
        "typeId": 34
      },
      {
        "id": 311,
        "name": "Agua potable",
        "quantity": 1,
        "iconId": 15026,
        "typeId": 228
      }
    ],
    "recipeId": 17198,
    "criterions": "cs<80",
    "maxStatLimit": 80,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17200,
    "name": "Lomo reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 170,
    "iconId": 69734,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17155,
        "name": "Chicha magra",
        "quantity": 1,
        "iconId": 63400,
        "typeId": 63
      },
      {
        "id": 425,
        "name": "Cáñamo",
        "quantity": 2,
        "iconId": 34121,
        "typeId": 34
      },
      {
        "id": 519,
        "name": "Polvos mágicos",
        "quantity": 1,
        "iconId": 48002,
        "typeId": 48
      }
    ],
    "recipeId": 17200,
    "criterions": "cs<85",
    "maxStatLimit": 85,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17202,
    "name": "Rollito Paul Delpaso reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 180,
    "iconId": 69868,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17157,
        "name": "Chicha viciada",
        "quantity": 1,
        "iconId": 63534,
        "typeId": 63
      },
      {
        "id": 16454,
        "name": "Maíz",
        "quantity": 2,
        "iconId": 34554,
        "typeId": 34
      },
      {
        "id": 1986,
        "name": "Polvo temporal",
        "quantity": 1,
        "iconId": 48002,
        "typeId": 48
      }
    ],
    "recipeId": 17202,
    "criterions": "cs<90",
    "maxStatLimit": 90,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17204,
    "name": "Butifarra de presa reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 190,
    "iconId": 69772,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17159,
        "name": "Chicha negra",
        "quantity": 1,
        "iconId": 63440,
        "typeId": 63
      },
      {
        "id": 16454,
        "name": "Maíz",
        "quantity": 2,
        "iconId": 34554,
        "typeId": 34
      },
      {
        "id": 1985,
        "name": "Resina",
        "quantity": 1,
        "iconId": 15382,
        "typeId": 228
      }
    ],
    "recipeId": 17204,
    "criterions": "cs<95",
    "maxStatLimit": 95,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17206,
    "name": "Salchichón ahumado reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 200,
    "iconId": 126065,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17161,
        "name": "Chicha sabrosa",
        "quantity": 1,
        "iconId": 63448,
        "typeId": 63
      },
      {
        "id": 16456,
        "name": "Mijo",
        "quantity": 2,
        "iconId": 34555,
        "typeId": 34
      },
      {
        "id": 11475,
        "name": "Aguas tranquilas",
        "quantity": 1,
        "iconId": 15778,
        "typeId": 228
      }
    ],
    "recipeId": 17206,
    "criterions": "cs<100",
    "maxStatLimit": 100,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 17422,
    "name": "Caldo de carne reconstituyente",
    "stat": "Fuerza",
    "points": 1,
    "level": 1,
    "iconId": 69803,
    "job": "Cazador",
    "jobId": 41,
    "ingredients": [
      {
        "id": 17421,
        "name": "Chicha intangible",
        "quantity": 1,
        "iconId": 63470,
        "typeId": 63
      }
    ],
    "recipeId": 17422,
    "criterions": "cs<5",
    "maxStatLimit": 5,
    "effectId": 607,
    "effectsDesc": "1 Fuerza"
  },
  {
    "id": 11507,
    "name": "Pócima estrellada",
    "stat": "Suerte",
    "points": 1,
    "level": 200,
    "iconId": 12722,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 11501,
        "name": "Estrella de las nieves",
        "quantity": 1,
        "iconId": 35290,
        "typeId": 35
      },
      {
        "id": 16456,
        "name": "Mijo",
        "quantity": 2,
        "iconId": 34555,
        "typeId": 34
      },
      {
        "id": 11475,
        "name": "Aguas tranquilas",
        "quantity": 1,
        "iconId": 15778,
        "typeId": 228
      }
    ],
    "recipeId": 11507,
    "criterions": "cc<100",
    "maxStatLimit": 100,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16401,
    "name": "Pócima androide",
    "stat": "Suerte",
    "points": 1,
    "level": 1,
    "iconId": 12756,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16378,
        "name": "Ortiga arganta",
        "quantity": 1,
        "iconId": 36646,
        "typeId": 36
      }
    ],
    "recipeId": 16401,
    "criterions": "cc<5",
    "maxStatLimit": 5,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16403,
    "name": "Pócima de adivinación",
    "stat": "Suerte",
    "points": 1,
    "level": 20,
    "iconId": 12757,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16379,
        "name": "Salvia adivinorum",
        "quantity": 1,
        "iconId": 36647,
        "typeId": 36
      },
      {
        "id": 289,
        "name": "Trigo",
        "quantity": 1,
        "iconId": 34009,
        "typeId": 34
      }
    ],
    "recipeId": 16403,
    "criterions": "cc<10",
    "maxStatLimit": 10,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16405,
    "name": "Pócima ladecristum",
    "stat": "Suerte",
    "points": 1,
    "level": 40,
    "iconId": 12758,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16380,
        "name": "Trifolium ladecristum",
        "quantity": 1,
        "iconId": 36648,
        "typeId": 36
      },
      {
        "id": 1975,
        "name": "Cebolla",
        "quantity": 1,
        "iconId": 68377,
        "typeId": 68
      },
      {
        "id": 400,
        "name": "Cebada",
        "quantity": 1,
        "iconId": 34082,
        "typeId": 34
      }
    ],
    "recipeId": 16405,
    "criterions": "cc<20",
    "maxStatLimit": 20,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16406,
    "name": "Pócima religiosa",
    "stat": "Suerte",
    "points": 1,
    "level": 60,
    "iconId": 12759,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16381,
        "name": "Menta religiosa",
        "quantity": 1,
        "iconId": 36649,
        "typeId": 36
      },
      {
        "id": 1731,
        "name": "Dosis de zumo sabroso",
        "quantity": 1,
        "iconId": 15262,
        "typeId": 15
      },
      {
        "id": 533,
        "name": "Avena",
        "quantity": 1,
        "iconId": 34154,
        "typeId": 34
      }
    ],
    "recipeId": 16406,
    "criterions": "cc<30",
    "maxStatLimit": 30,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16407,
    "name": "Pócima idónea",
    "stat": "Suerte",
    "points": 1,
    "level": 80,
    "iconId": 12760,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16382,
        "name": "Orquídea idónea",
        "quantity": 1,
        "iconId": 35639,
        "typeId": 35
      },
      {
        "id": 6671,
        "name": "Alubias",
        "quantity": 1,
        "iconId": 58471,
        "typeId": 58
      },
      {
        "id": 401,
        "name": "Lúpulo",
        "quantity": 1,
        "iconId": 34080,
        "typeId": 34
      }
    ],
    "recipeId": 16407,
    "criterions": "cc<40",
    "maxStatLimit": 40,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16408,
    "name": "Pócima weis",
    "stat": "Suerte",
    "points": 1,
    "level": 100,
    "iconId": 12761,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16383,
        "name": "Margarita weis",
        "quantity": 1,
        "iconId": 35640,
        "typeId": 35
      },
      {
        "id": 1734,
        "name": "Cereza",
        "quantity": 1,
        "iconId": 46265,
        "typeId": 46
      },
      {
        "id": 423,
        "name": "Lino",
        "quantity": 1,
        "iconId": 34122,
        "typeId": 34
      }
    ],
    "recipeId": 16408,
    "criterions": "cc<50",
    "maxStatLimit": 50,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16411,
    "name": "Pócima cantora",
    "stat": "Suerte",
    "points": 1,
    "level": 120,
    "iconId": 12762,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16384,
        "name": "Pandoja cantora",
        "quantity": 1,
        "iconId": 58473,
        "typeId": 58
      },
      {
        "id": 1977,
        "name": "Especias",
        "quantity": 1,
        "iconId": 15378,
        "typeId": 15
      },
      {
        "id": 532,
        "name": "Centeno",
        "quantity": 1,
        "iconId": 34083,
        "typeId": 34
      }
    ],
    "recipeId": 16411,
    "criterions": "cc<60",
    "maxStatLimit": 60,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16413,
    "name": "Pócima goku",
    "stat": "Suerte",
    "points": 1,
    "level": 140,
    "iconId": 12763,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16386,
        "name": "Ginsengoku",
        "quantity": 1,
        "iconId": 36650,
        "typeId": 36
      },
      {
        "id": 519,
        "name": "Polvos mágicos",
        "quantity": 1,
        "iconId": 48002,
        "typeId": 48
      },
      {
        "id": 405,
        "name": "Malta",
        "quantity": 1,
        "iconId": 34561,
        "typeId": 34
      }
    ],
    "recipeId": 16413,
    "criterions": "cc<70",
    "maxStatLimit": 70,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16416,
    "name": "Pócima de doncella",
    "stat": "Suerte",
    "points": 1,
    "level": 160,
    "iconId": 12764,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16388,
        "name": "Belladoncella",
        "quantity": 1,
        "iconId": 35641,
        "typeId": 35
      },
      {
        "id": 1985,
        "name": "Resina",
        "quantity": 1,
        "iconId": 15382,
        "typeId": 228
      },
      {
        "id": 425,
        "name": "Cáñamo",
        "quantity": 2,
        "iconId": 34121,
        "typeId": 34
      }
    ],
    "recipeId": 16416,
    "criterions": "cc<80",
    "maxStatLimit": 80,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16418,
    "name": "Pócima quesera",
    "stat": "Suerte",
    "points": 1,
    "level": 180,
    "iconId": 12765,
    "job": "Alquimista",
    "jobId": 26,
    "ingredients": [
      {
        "id": 16390,
        "name": "Manchégora",
        "quantity": 1,
        "iconId": 36651,
        "typeId": 36
      },
      {
        "id": 1978,
        "name": "Medida de pimienta",
        "quantity": 1,
        "iconId": 48734,
        "typeId": 48
      },
      {
        "id": 16454,
        "name": "Maíz",
        "quantity": 2,
        "iconId": 34554,
        "typeId": 34
      }
    ],
    "recipeId": 16418,
    "criterions": "cc<90",
    "maxStatLimit": 90,
    "effectId": 608,
    "effectsDesc": "1 Suerte"
  },
  {
    "id": 16927,
    "name": "Tronquito de fresno",
    "stat": "Agilidad",
    "points": 1,
    "level": 10,
    "iconId": 42179,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16909,
        "name": "Savia de fresno",
        "quantity": 1,
        "iconId": 179001,
        "typeId": 185
      }
    ],
    "recipeId": 16927,
    "criterions": "ca<5",
    "maxStatLimit": 5,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16928,
    "name": "Tronquito de castaño",
    "stat": "Agilidad",
    "points": 1,
    "level": 20,
    "iconId": 42180,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16910,
        "name": "Savia de castaño",
        "quantity": 1,
        "iconId": 179002,
        "typeId": 185
      },
      {
        "id": 400,
        "name": "Cebada",
        "quantity": 1,
        "iconId": 34082,
        "typeId": 34
      }
    ],
    "recipeId": 16928,
    "criterions": "ca<10",
    "maxStatLimit": 10,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16929,
    "name": "Tronquito de nogal",
    "stat": "Agilidad",
    "points": 1,
    "level": 40,
    "iconId": 42181,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16911,
        "name": "Savia de nogal",
        "quantity": 1,
        "iconId": 179003,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 400,
        "name": "Cebada",
        "quantity": 1,
        "iconId": 34082,
        "typeId": 34
      }
    ],
    "recipeId": 16929,
    "criterions": "ca<20",
    "maxStatLimit": 20,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16930,
    "name": "Tronquito de roble",
    "stat": "Agilidad",
    "points": 1,
    "level": 60,
    "iconId": 42182,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16912,
        "name": "Savia de roble",
        "quantity": 1,
        "iconId": 179004,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 533,
        "name": "Avena",
        "quantity": 1,
        "iconId": 34154,
        "typeId": 34
      }
    ],
    "recipeId": 16930,
    "criterions": "ca<30",
    "maxStatLimit": 30,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16931,
    "name": "Tronquito de bombú",
    "stat": "Agilidad",
    "points": 1,
    "level": 70,
    "iconId": 42183,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16913,
        "name": "Savia de bombú",
        "quantity": 1,
        "iconId": 179005,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 533,
        "name": "Avena",
        "quantity": 1,
        "iconId": 34154,
        "typeId": 34
      }
    ],
    "recipeId": 16931,
    "criterions": "ca<35",
    "maxStatLimit": 35,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16932,
    "name": "Tronquito de arce",
    "stat": "Agilidad",
    "points": 1,
    "level": 80,
    "iconId": 42184,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16914,
        "name": "Savia de arce",
        "quantity": 1,
        "iconId": 179006,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 401,
        "name": "Lúpulo",
        "quantity": 1,
        "iconId": 34080,
        "typeId": 34
      }
    ],
    "recipeId": 16932,
    "criterions": "ca<40",
    "maxStatLimit": 40,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16933,
    "name": "Tronquito de olivioleta",
    "stat": "Agilidad",
    "points": 1,
    "level": 90,
    "iconId": 42185,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16915,
        "name": "Savia de olivioleta",
        "quantity": 1,
        "iconId": 179007,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 401,
        "name": "Lúpulo",
        "quantity": 1,
        "iconId": 34080,
        "typeId": 34
      }
    ],
    "recipeId": 16933,
    "criterions": "ca<45",
    "maxStatLimit": 45,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16934,
    "name": "Tronquito de tejo",
    "stat": "Agilidad",
    "points": 1,
    "level": 100,
    "iconId": 42186,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16916,
        "name": "Savia de tejo",
        "quantity": 1,
        "iconId": 179008,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 423,
        "name": "Lino",
        "quantity": 1,
        "iconId": 34122,
        "typeId": 34
      }
    ],
    "recipeId": 16934,
    "criterions": "ca<50",
    "maxStatLimit": 50,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16935,
    "name": "Tronquito de bambú",
    "stat": "Agilidad",
    "points": 1,
    "level": 110,
    "iconId": 42187,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16917,
        "name": "Savia de bambú",
        "quantity": 1,
        "iconId": 179009,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 423,
        "name": "Lino",
        "quantity": 1,
        "iconId": 34122,
        "typeId": 34
      }
    ],
    "recipeId": 16935,
    "criterions": "ca<55",
    "maxStatLimit": 55,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16936,
    "name": "Tronquito de cerezo silvestre",
    "stat": "Agilidad",
    "points": 1,
    "level": 120,
    "iconId": 42188,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16918,
        "name": "Savia de cerezo silvestre",
        "quantity": 1,
        "iconId": 179010,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 532,
        "name": "Centeno",
        "quantity": 1,
        "iconId": 34083,
        "typeId": 34
      }
    ],
    "recipeId": 16936,
    "criterions": "ca<60",
    "maxStatLimit": 60,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16937,
    "name": "Tronquito de avellano",
    "stat": "Agilidad",
    "points": 1,
    "level": 130,
    "iconId": 42189,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16919,
        "name": "Savia de avellano",
        "quantity": 1,
        "iconId": 179011,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 532,
        "name": "Centeno",
        "quantity": 1,
        "iconId": 34083,
        "typeId": 34
      }
    ],
    "recipeId": 16937,
    "criterions": "ca<65",
    "maxStatLimit": 65,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16938,
    "name": "Tronquito de ébano",
    "stat": "Agilidad",
    "points": 1,
    "level": 140,
    "iconId": 42190,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16920,
        "name": "Savia de ébano",
        "quantity": 1,
        "iconId": 179012,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 405,
        "name": "Malta",
        "quantity": 1,
        "iconId": 34561,
        "typeId": 34
      }
    ],
    "recipeId": 16938,
    "criterions": "ca<70",
    "maxStatLimit": 70,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16939,
    "name": "Tronquito de kalipto",
    "stat": "Agilidad",
    "points": 1,
    "level": 150,
    "iconId": 42191,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16921,
        "name": "Savia de kalipto",
        "quantity": 1,
        "iconId": 179013,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 405,
        "name": "Malta",
        "quantity": 1,
        "iconId": 34561,
        "typeId": 34
      }
    ],
    "recipeId": 16939,
    "criterions": "ca<75",
    "maxStatLimit": 75,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16940,
    "name": "Tronquito de carpe",
    "stat": "Agilidad",
    "points": 1,
    "level": 160,
    "iconId": 42192,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16922,
        "name": "Savia de carpe",
        "quantity": 1,
        "iconId": 179014,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 425,
        "name": "Cáñamo",
        "quantity": 2,
        "iconId": 34121,
        "typeId": 34
      }
    ],
    "recipeId": 16940,
    "criterions": "ca<80",
    "maxStatLimit": 80,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16941,
    "name": "Tronquito de bambú oscuro",
    "stat": "Agilidad",
    "points": 1,
    "level": 170,
    "iconId": 42193,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16923,
        "name": "Savia de bambú oscuro",
        "quantity": 1,
        "iconId": 179015,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 425,
        "name": "Cáñamo",
        "quantity": 2,
        "iconId": 34121,
        "typeId": 34
      }
    ],
    "recipeId": 16941,
    "criterions": "ca<85",
    "maxStatLimit": 85,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16942,
    "name": "Tronquito de olmo",
    "stat": "Agilidad",
    "points": 1,
    "level": 180,
    "iconId": 42194,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16924,
        "name": "Savia de olmo",
        "quantity": 1,
        "iconId": 179016,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 16454,
        "name": "Maíz",
        "quantity": 2,
        "iconId": 34554,
        "typeId": 34
      }
    ],
    "recipeId": 16942,
    "criterions": "ca<90",
    "maxStatLimit": 90,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16943,
    "name": "Tronquito de bambú sagrado",
    "stat": "Agilidad",
    "points": 1,
    "level": 190,
    "iconId": 42195,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16925,
        "name": "Savia de bambú sagrado",
        "quantity": 1,
        "iconId": 179017,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 16454,
        "name": "Maíz",
        "quantity": 2,
        "iconId": 34554,
        "typeId": 34
      }
    ],
    "recipeId": 16943,
    "criterions": "ca<95",
    "maxStatLimit": 95,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 16944,
    "name": "Tronquito de álamo temblón",
    "stat": "Agilidad",
    "points": 1,
    "level": 200,
    "iconId": 42196,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16926,
        "name": "Savia de álamo temblón",
        "quantity": 1,
        "iconId": 179018,
        "typeId": 185
      },
      {
        "id": 286,
        "name": "Levadura de panadero",
        "quantity": 1,
        "iconId": 48137,
        "typeId": 48
      },
      {
        "id": 16456,
        "name": "Mijo",
        "quantity": 2,
        "iconId": 34555,
        "typeId": 34
      }
    ],
    "recipeId": 16944,
    "criterions": "ca<100",
    "maxStatLimit": 100,
    "effectId": 609,
    "effectsDesc": "1 Agilidad"
  },
  {
    "id": 2020,
    "name": "Pan dorado",
    "stat": "Vitalidad",
    "points": 1,
    "level": 1,
    "iconId": 33019,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 2018,
        "name": "Trigo de oro",
        "quantity": 1,
        "iconId": 34474,
        "typeId": 34
      }
    ],
    "recipeId": 2020,
    "criterions": "cv<5",
    "maxStatLimit": 5,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 2025,
    "name": "Bizcochito mágico",
    "stat": "Vitalidad",
    "points": 1,
    "level": 60,
    "iconId": 33008,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 2021,
        "name": "Lúpulo brillante",
        "quantity": 1,
        "iconId": 34475,
        "typeId": 34
      },
      {
        "id": 1984,
        "name": "Cenizas eternas",
        "quantity": 1,
        "iconId": 48671,
        "typeId": 48
      },
      {
        "id": 395,
        "name": "Trébol de 5 hojas",
        "quantity": 1,
        "iconId": 36067,
        "typeId": 36
      }
    ],
    "recipeId": 2025,
    "criterions": "cv<30",
    "maxStatLimit": 30,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 2028,
    "name": "Bollo",
    "stat": "Vitalidad",
    "points": 1,
    "level": 80,
    "iconId": 33012,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 2026,
        "name": "Lino Tempestad",
        "quantity": 1,
        "iconId": 34476,
        "typeId": 34
      },
      {
        "id": 2012,
        "name": "Sangre de scorbuto",
        "quantity": 1,
        "iconId": 15389,
        "typeId": 228
      },
      {
        "id": 380,
        "name": "Menta salvaje",
        "quantity": 1,
        "iconId": 36052,
        "typeId": 36
      }
    ],
    "recipeId": 2028,
    "criterions": "cv<40",
    "maxStatLimit": 40,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 2031,
    "name": "Pan de centeno resistente",
    "stat": "Vitalidad",
    "points": 1,
    "level": 100,
    "iconId": 33009,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 2029,
        "name": "Centeno resistente",
        "quantity": 1,
        "iconId": 34477,
        "typeId": 34
      },
      {
        "id": 311,
        "name": "Agua potable",
        "quantity": 1,
        "iconId": 15026,
        "typeId": 228
      },
      {
        "id": 593,
        "name": "Orquídea freyesca",
        "quantity": 1,
        "iconId": 35192,
        "typeId": 35
      }
    ],
    "recipeId": 2031,
    "criterions": "cv<50",
    "maxStatLimit": 50,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 2034,
    "name": "Bastón de caramelo",
    "stat": "Vitalidad",
    "points": 1,
    "level": 20,
    "iconId": 42128,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 2032,
        "name": "Cebada azucarada",
        "quantity": 1,
        "iconId": 34477,
        "typeId": 34
      },
      {
        "id": 421,
        "name": "Ortiga",
        "quantity": 1,
        "iconId": 36642,
        "typeId": 36
      }
    ],
    "recipeId": 2034,
    "criterions": "cv<10",
    "maxStatLimit": 10,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 2038,
    "name": "Pan de copos de avena aurífera",
    "stat": "Vitalidad",
    "points": 1,
    "level": 40,
    "iconId": 33005,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 2036,
        "name": "Avena aurífera",
        "quantity": 1,
        "iconId": 34551,
        "typeId": 34
      },
      {
        "id": 2331,
        "name": "Berenjena",
        "quantity": 1,
        "iconId": 46472,
        "typeId": 46
      },
      {
        "id": 428,
        "name": "Salvia",
        "quantity": 1,
        "iconId": 36643,
        "typeId": 36
      }
    ],
    "recipeId": 2038,
    "criterions": "cv<20",
    "maxStatLimit": 20,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 11504,
    "name": "Pan de frostizz inflado",
    "stat": "Vitalidad",
    "points": 1,
    "level": 200,
    "iconId": 33073,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 11499,
        "name": "Frostizz inflado",
        "quantity": 1,
        "iconId": 34553,
        "typeId": 34
      },
      {
        "id": 11475,
        "name": "Aguas tranquilas",
        "quantity": 1,
        "iconId": 15778,
        "typeId": 228
      },
      {
        "id": 16389,
        "name": "Mandrágora",
        "quantity": 2,
        "iconId": 36645,
        "typeId": 36
      }
    ],
    "recipeId": 11504,
    "criterions": "cv<100",
    "maxStatLimit": 100,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 16434,
    "name": "Gofre de oro",
    "stat": "Vitalidad",
    "points": 1,
    "level": 100,
    "iconId": 33077,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16452,
        "name": "Arroz cola",
        "quantity": 1,
        "iconId": 34556,
        "typeId": 34
      },
      {
        "id": 311,
        "name": "Agua potable",
        "quantity": 1,
        "iconId": 15026,
        "typeId": 228
      },
      {
        "id": 593,
        "name": "Orquídea freyesca",
        "quantity": 1,
        "iconId": 35192,
        "typeId": 35
      }
    ],
    "recipeId": 16434,
    "criterions": "cv<50",
    "maxStatLimit": 50,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 16435,
    "name": "Pan bazo",
    "stat": "Vitalidad",
    "points": 1,
    "level": 120,
    "iconId": 33079,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16453,
        "name": "Malta siano",
        "quantity": 1,
        "iconId": 34557,
        "typeId": 34
      },
      {
        "id": 1986,
        "name": "Polvo temporal",
        "quantity": 1,
        "iconId": 48002,
        "typeId": 48
      },
      {
        "id": 594,
        "name": "Edelweiss",
        "quantity": 1,
        "iconId": 35191,
        "typeId": 35
      }
    ],
    "recipeId": 16435,
    "criterions": "cv<60",
    "maxStatLimit": 60,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 16436,
    "name": "Pan pinela",
    "stat": "Vitalidad",
    "points": 1,
    "level": 140,
    "iconId": 33076,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 2035,
        "name": "Cáñamo eufórico",
        "quantity": 1,
        "iconId": 34478,
        "typeId": 34
      },
      {
        "id": 1730,
        "name": "Medida de sal",
        "quantity": 1,
        "iconId": 48261,
        "typeId": 48
      },
      {
        "id": 7059,
        "name": "Semilla de pandoja",
        "quantity": 1,
        "iconId": 58067,
        "typeId": 58
      }
    ],
    "recipeId": 16436,
    "criterions": "cv<70",
    "maxStatLimit": 70,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 16438,
    "name": "Burrito",
    "stat": "Vitalidad",
    "points": 1,
    "level": 160,
    "iconId": 33081,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16455,
        "name": "Maíz adlasvelas",
        "quantity": 1,
        "iconId": 34558,
        "typeId": 34
      },
      {
        "id": 1736,
        "name": "Limón",
        "quantity": 1,
        "iconId": 46266,
        "typeId": 46
      },
      {
        "id": 16385,
        "name": "Ginseng",
        "quantity": 2,
        "iconId": 36644,
        "typeId": 36
      }
    ],
    "recipeId": 16438,
    "criterions": "cv<80",
    "maxStatLimit": 80,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 16439,
    "name": "Mollete",
    "stat": "Vitalidad",
    "points": 1,
    "level": 180,
    "iconId": 33082,
    "job": "Campesino",
    "jobId": 28,
    "ingredients": [
      {
        "id": 16457,
        "name": "Mijo añejo",
        "quantity": 1,
        "iconId": 34559,
        "typeId": 34
      },
      {
        "id": 1973,
        "name": "Aceite para freír",
        "quantity": 1,
        "iconId": 60073,
        "typeId": 60
      },
      {
        "id": 16387,
        "name": "Belladona",
        "quantity": 2,
        "iconId": 35638,
        "typeId": 35
      }
    ],
    "recipeId": 16439,
    "criterions": "cv<90",
    "maxStatLimit": 90,
    "effectId": 610,
    "effectsDesc": "1 Vitalidad"
  },
  {
    "id": 1756,
    "name": "Pescado iglú frito",
    "stat": "Inteligencia",
    "points": 1,
    "level": 50,
    "iconId": 49073,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1754,
        "name": "Pez iglú",
        "quantity": 1,
        "iconId": 41271,
        "typeId": 41
      },
      {
        "id": 2012,
        "name": "Sangre de scorbuto",
        "quantity": 1,
        "iconId": 15389,
        "typeId": 228
      },
      {
        "id": 428,
        "name": "Salvia",
        "quantity": 1,
        "iconId": 36643,
        "typeId": 36
      }
    ],
    "recipeId": 1756,
    "criterions": "ci<20",
    "maxStatLimit": 20,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 1766,
    "name": "Palito de cangrejo exótico",
    "stat": "Inteligencia",
    "points": 1,
    "level": 30,
    "iconId": 49076,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1759,
        "name": "Cangrejo surimi exótico",
        "quantity": 1,
        "iconId": 41275,
        "typeId": 41
      },
      {
        "id": 421,
        "name": "Ortiga",
        "quantity": 1,
        "iconId": 36642,
        "typeId": 36
      }
    ],
    "recipeId": 1766,
    "criterions": "ci<10",
    "maxStatLimit": 10,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 1827,
    "name": "Sardina oscura estofada",
    "stat": "Inteligencia",
    "points": 1,
    "level": 70,
    "iconId": 49095,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1807,
        "name": "Sardina oscura",
        "quantity": 1,
        "iconId": 41319,
        "typeId": 41
      },
      {
        "id": 311,
        "name": "Agua potable",
        "quantity": 1,
        "iconId": 15026,
        "typeId": 228
      },
      {
        "id": 395,
        "name": "Trébol de 5 hojas",
        "quantity": 1,
        "iconId": 36067,
        "typeId": 36
      }
    ],
    "recipeId": 1827,
    "criterions": "ci<30",
    "maxStatLimit": 30,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 1829,
    "name": "Buñuelo de bamga horror",
    "stat": "Inteligencia",
    "points": 1,
    "level": 10,
    "iconId": 49100,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1786,
        "name": "Bamga horror",
        "quantity": 1,
        "iconId": 41298,
        "typeId": 41
      }
    ],
    "recipeId": 1829,
    "criterions": "ci<5",
    "maxStatLimit": 5,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 1831,
    "name": "Aleta de raya de Farle",
    "stat": "Inteligencia",
    "points": 1,
    "level": 130,
    "iconId": 49102,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1788,
        "name": "Raya de Farle",
        "quantity": 1,
        "iconId": 41300,
        "typeId": 41
      },
      {
        "id": 1736,
        "name": "Limón",
        "quantity": 1,
        "iconId": 46266,
        "typeId": 46
      },
      {
        "id": 594,
        "name": "Edelweiss",
        "quantity": 1,
        "iconId": 35191,
        "typeId": 35
      }
    ],
    "recipeId": 1831,
    "criterions": "ci<60",
    "maxStatLimit": 60,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 1840,
    "name": "Aleta de tiburón mercado libre",
    "stat": "Inteligencia",
    "points": 1,
    "level": 150,
    "iconId": 49105,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1853,
        "name": "Tiburón mercado libre",
        "quantity": 1,
        "iconId": 41324,
        "typeId": 41
      },
      {
        "id": 1973,
        "name": "Aceite para freír",
        "quantity": 1,
        "iconId": 60073,
        "typeId": 60
      },
      {
        "id": 7059,
        "name": "Semilla de pandoja",
        "quantity": 1,
        "iconId": 58067,
        "typeId": 58
      }
    ],
    "recipeId": 1840,
    "criterions": "ci<70",
    "maxStatLimit": 70,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 1859,
    "name": "Kralamar único a la brasa",
    "stat": "Inteligencia",
    "points": 1,
    "level": 90,
    "iconId": 49137,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 1799,
        "name": "Kralamar único",
        "quantity": 1,
        "iconId": 41311,
        "typeId": 41
      },
      {
        "id": 1986,
        "name": "Polvo temporal",
        "quantity": 1,
        "iconId": 48002,
        "typeId": 48
      },
      {
        "id": 380,
        "name": "Menta salvaje",
        "quantity": 1,
        "iconId": 36052,
        "typeId": 36
      }
    ],
    "recipeId": 1859,
    "criterions": "ci<40",
    "maxStatLimit": 40,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 11511,
    "name": "Inverluza glacial guisada",
    "stat": "Inteligencia",
    "points": 1,
    "level": 200,
    "iconId": 49135,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 11500,
        "name": "Inverluza glacial",
        "quantity": 1,
        "iconId": 41404,
        "typeId": 41
      },
      {
        "id": 16389,
        "name": "Mandrágora",
        "quantity": 2,
        "iconId": 36645,
        "typeId": 36
      },
      {
        "id": 11475,
        "name": "Aguas tranquilas",
        "quantity": 1,
        "iconId": 15778,
        "typeId": 228
      }
    ],
    "recipeId": 11511,
    "criterions": "ci<100",
    "maxStatLimit": 100,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 16478,
    "name": "Dorada emperadora al horno",
    "stat": "Inteligencia",
    "points": 1,
    "level": 110,
    "iconId": 49146,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 16464,
        "name": "Dorada emperadora",
        "quantity": 1,
        "iconId": 41410,
        "typeId": 41
      },
      {
        "id": 1730,
        "name": "Medida de sal",
        "quantity": 1,
        "iconId": 48261,
        "typeId": 48
      },
      {
        "id": 593,
        "name": "Orquídea freyesca",
        "quantity": 1,
        "iconId": 35192,
        "typeId": 35
      }
    ],
    "recipeId": 16478,
    "criterions": "ci<50",
    "maxStatLimit": 50,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 16482,
    "name": "Estofado de bacaladilla apetitosa",
    "stat": "Inteligencia",
    "points": 1,
    "level": 170,
    "iconId": 49150,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 16468,
        "name": "Bacaladilla apetitosa",
        "quantity": 1,
        "iconId": 41414,
        "typeId": 41
      },
      {
        "id": 1983,
        "name": "Grasa gelatinosa",
        "quantity": 1,
        "iconId": 15379,
        "typeId": 15
      },
      {
        "id": 16385,
        "name": "Ginseng",
        "quantity": 2,
        "iconId": 36644,
        "typeId": 36
      }
    ],
    "recipeId": 16482,
    "criterions": "ci<80",
    "maxStatLimit": 80,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  },
  {
    "id": 16486,
    "name": "Pez espadón quijote salteado",
    "stat": "Inteligencia",
    "points": 1,
    "level": 190,
    "iconId": 49154,
    "job": "Pescador",
    "jobId": 36,
    "ingredients": [
      {
        "id": 16472,
        "name": "Pez espadón quijote",
        "quantity": 1,
        "iconId": 41418,
        "typeId": 41
      },
      {
        "id": 2331,
        "name": "Berenjena",
        "quantity": 1,
        "iconId": 46472,
        "typeId": 46
      },
      {
        "id": 16387,
        "name": "Belladona",
        "quantity": 2,
        "iconId": 35638,
        "typeId": 35
      }
    ],
    "recipeId": 16486,
    "criterions": "ci<90",
    "maxStatLimit": 90,
    "effectId": 611,
    "effectsDesc": "1 Inteligencia"
  }
];

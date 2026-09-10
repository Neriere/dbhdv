/**
 * Servicio para la gestión local y personal de los niveles de oficios del usuario.
 * Abarca oficios de Recolección, Crafteo y Forjamagia (Magos).
 * Almacenamiento 100% local en localStorage sin sincronización forzada al backend.
 */

export type JobCategory = "gathering" | "crafting" | "maging";

export interface JobConfigDefinition {
  id: number;
  slug: string;
  nameEs: string;
  nameFr: string;
  category: JobCategory;
  icon: string; // Lucide icon name
  typeIds?: number[];
  baseJobId?: number; // Para oficios de forjamagia: id del oficio de crafteo base
  description: string;
}

export const USER_JOBS_DEFINITIONS: JobConfigDefinition[] = [
  // ── Recolección ──────────────────────────────────────────
  {
    id: 26,
    slug: "alquimista",
    nameEs: "Alquimista",
    nameFr: "Alchimiste",
    category: "gathering",
    icon: "FlaskConical",
    description: "Recolección de plantas y elaboración de pociones, elixires y tinturas.",
  },
  {
    id: 28,
    slug: "campesino",
    nameEs: "Campesino",
    nameFr: "Paysan",
    category: "gathering",
    icon: "Wheat",
    description: "Recolección de cereales y molienda de harinas, panes y aceites.",
  },
  {
    id: 41,
    slug: "cazador",
    nameEs: "Cazador",
    nameFr: "Chasseur",
    category: "gathering",
    icon: "Drumstick",
    description: "Caza de carnes y preparación de platos carnívoros.",
  },
  {
    id: 2,
    slug: "lenador",
    nameEs: "Leñador",
    nameFr: "Bûcheron",
    category: "gathering",
    icon: "Axe",
    description: "Tala de maderas y fabricación de tablas y sustratos.",
  },
  {
    id: 24,
    slug: "minero",
    nameEs: "Minero",
    nameFr: "Mineur",
    category: "gathering",
    icon: "Pickaxe",
    description: "Extracción de minerales, aleaciones y piedras preciosas.",
  },
  {
    id: 36,
    slug: "pescador",
    nameEs: "Pescador",
    nameFr: "Pêcheur",
    category: "gathering",
    icon: "Fish",
    description: "Pesca y elaboración de platos de pescado.",
  },

  // ── Crafteo / Fabricación ────────────────────────────────
  {
    id: 16,
    slug: "joyero",
    nameEs: "Joyero",
    nameFr: "Bijoutier",
    category: "crafting",
    icon: "Gem",
    typeIds: [1, 9],
    description: "Fabricación de amuletos y anillos.",
  },
  {
    id: 27,
    slug: "sastre",
    nameEs: "Sastre",
    nameFr: "Tailleur",
    category: "crafting",
    icon: "Scissors",
    typeIds: [16, 17, 81],
    description: "Confección de sombreros, capas y mochilas.",
  },
  {
    id: 15,
    slug: "zapatero",
    nameEs: "Zapatero",
    nameFr: "Cordonnier",
    category: "crafting",
    icon: "Footprints",
    typeIds: [10, 11],
    description: "Elaboración de botas y cinturones.",
  },
  {
    id: 11,
    slug: "herrero",
    nameEs: "Herrero",
    nameFr: "Forgeur",
    category: "crafting",
    icon: "Sword",
    typeIds: [5, 6, 7, 8, 19, 20, 21, 22, 212],
    description: "Forja de espadas, dagas, martillos, palas, hachas, guadañas, picos y lanzas.",
  },
  {
    id: 13,
    slug: "escultor",
    nameEs: "Escultor",
    nameFr: "Sculpteur",
    category: "crafting",
    icon: "Wand2",
    typeIds: [2, 3, 4],
    description: "Creación de varitas mágicas, bastones y arcos.",
  },
  {
    id: 60,
    slug: "fabricante",
    nameEs: "Fabricante",
    nameFr: "Façonneur",
    category: "crafting",
    icon: "Shield",
    typeIds: [82, 112, 151, 188, 217, 271],
    description: "Fabricación de escudos, trofeos, ídolos y prismas.",
  },
  {
    id: 65,
    slug: "manitas",
    nameEs: "Manitas",
    nameFr: "Bricoleur",
    category: "crafting",
    icon: "Wrench",
    typeIds: [84],
    description: "Fabricación de llaves de mazmorra.",
  },
  {
    id: 101,
    slug: "ganadero",
    nameEs: "Ganadero",
    nameFr: "Éleveur",
    category: "crafting",
    icon: "Heart",
    typeIds: [99, 323, 326, 327],
    description: "Fabricación de objetos de cría para monturas.",
  },

  // ── Forjamagia (Magos) ──────────────────────────────────
  {
    id: 63,
    slug: "joyeromago",
    nameEs: "Joyeromago",
    nameFr: "Joaillomage",
    category: "maging",
    icon: "Sparkles",
    baseJobId: 16,
    typeIds: [1, 9], // Amuletos (1), Anillos (9)
    description: "Forjamagia de amuletos y anillos.",
  },
  {
    id: 64,
    slug: "costureromago",
    nameEs: "Costurero Mago / Sastremago",
    nameFr: "Costumage",
    category: "maging",
    icon: "Sparkles",
    baseJobId: 27,
    typeIds: [16, 17, 81], // Sombreros (16), Capas (17), Mochilas (81)
    description: "Forjamagia de sombreros, capas y mochilas.",
  },
  {
    id: 62,
    slug: "zapateromago",
    nameEs: "Zapateromago",
    nameFr: "Cordomage",
    category: "maging",
    icon: "Sparkles",
    baseJobId: 15,
    typeIds: [10, 11], // Cinturón (10), Botas (11)
    description: "Forjamagia de botas y cinturones.",
  },
  {
    id: 44,
    slug: "forjamago",
    nameEs: "Forjamago",
    nameFr: "Forgemage",
    category: "maging",
    icon: "Sparkles",
    baseJobId: 11,
    typeIds: [5, 6, 7, 8, 19, 21, 22, 212], // Dagas, Espadas, Martillos, Palas, Hachas, Picos, Guadañas, Lanzas
    description: "Forjamagia de espadas, dagas, martillos, palas, hachas y lanzas.",
  },
  {
    id: 48,
    slug: "escultormago",
    nameEs: "Escultormago",
    nameFr: "Sculptemage",
    category: "maging",
    icon: "Sparkles",
    baseJobId: 13,
    typeIds: [2, 3, 4], // Arcos (2), Varitas (3), Bastones (4)
    description: "Forjamagia de arcos, varitas y bastones.",
  },
  {
    id: 74,
    slug: "fabricamago",
    nameEs: "Fabricamago / Escudomago",
    nameFr: "Façomage",
    category: "maging",
    icon: "Sparkles",
    baseJobId: 60,
    typeIds: [82], // Escudo (82)
    description: "Forjamagia de escudos.",
  },
];

// Mapa rápido typeId -> jobId de mago correspondiente
export const TYPE_ID_TO_MAGE_JOB_ID_MAP: Record<number, number> = {};
// Mapa rápido typeId -> jobId de crafteo correspondiente
export const TYPE_ID_TO_CRAFT_JOB_ID_MAP: Record<number, number> = {};

// Mapa rápido de nombres de tipo (en español/francés) -> jobId de crafteo
export const TYPE_NAME_TO_CRAFT_JOB_ID_MAP: Record<string, number> = {
  amuleto: 16,
  amulette: 16,
  anillo: 16,
  anneau: 16,
  sombrero: 27,
  chapeau: 27,
  capa: 27,
  cape: 27,
  mochila: 27,
  sacados: 27,
  botas: 15,
  bottes: 15,
  cinturon: 15,
  cinturón: 15,
  ceinture: 15,
  espada: 11,
  epee: 11,
  épée: 11,
  daga: 11,
  dagas: 11,
  dague: 11,
  dagues: 11,
  martillo: 11,
  marteau: 11,
  pala: 11,
  pelle: 11,
  hacha: 11,
  hache: 11,
  guadaña: 11,
  faux: 11,
  pico: 11,
  pioche: 11,
  lanza: 11,
  lance: 11,
  arco: 13,
  arc: 13,
  varita: 13,
  baguette: 13,
  baston: 13,
  bastón: 13,
  baton: 13,
  bâton: 13,
  escudo: 60,
  bouclier: 60,
  trofeo: 60,
  trophee: 60,
  trophée: 60,
  idolo: 60,
  ídolo: 60,
  idole: 60,
  pan: 28,
  pain: 28,
  pocion: 26,
  poción: 26,
  potion: 26,
  pescado: 36,
  poisson: 36,
  carne: 41,
  viande: 41,
};

export const TYPE_NAME_TO_MAGE_JOB_ID_MAP: Record<string, number> = {
  amuleto: 63,
  amulette: 63,
  anillo: 63,
  anneau: 63,
  sombrero: 64,
  chapeau: 64,
  capa: 64,
  cape: 64,
  mochila: 64,
  sacados: 64,
  botas: 62,
  bottes: 62,
  cinturon: 62,
  cinturón: 62,
  ceinture: 62,
  espada: 43,
  epee: 43,
  épée: 43,
  daga: 43,
  dagas: 43,
  dague: 43,
  dagues: 43,
  martillo: 43,
  marteau: 43,
  pala: 43,
  pelle: 43,
  hacha: 43,
  hache: 43,
  guadaña: 43,
  faux: 43,
  pico: 43,
  pioche: 43,
  lanza: 43,
  lance: 43,
  arco: 44,
  arc: 44,
  varita: 44,
  baguette: 44,
  baston: 44,
  bastón: 44,
  baton: 44,
  bâton: 44,
  escudo: 106,
  bouclier: 106,
};

USER_JOBS_DEFINITIONS.forEach((job) => {
  if (job.category === "maging" && job.typeIds) {
    job.typeIds.forEach((tId) => {
      TYPE_ID_TO_MAGE_JOB_ID_MAP[tId] = job.id;
    });
  }
  if (job.category === "crafting" && job.typeIds) {
    job.typeIds.forEach((tId) => {
      TYPE_ID_TO_CRAFT_JOB_ID_MAP[tId] = job.id;
    });
  }
});

export interface UserJobSettings {
  enabled: boolean; // "Usar mis oficios" interruptor principal
  jobs: Record<number, number>; // jobId -> level (1 a 200)
}

const STORAGE_KEY = "dofus_user_job_levels_v1";

export function getDefaultUserJobSettings(): UserJobSettings {
  const defaultJobs: Record<number, number> = {};
  USER_JOBS_DEFINITIONS.forEach((job) => {
    defaultJobs[job.id] = 200; // Por defecto arrancan en 200 para facilitar
  });
  return {
    enabled: false,
    jobs: defaultJobs,
  };
}

let cachedSettings: UserJobSettings | null = null;

export function getUserJobSettings(): UserJobSettings {
  if (cachedSettings) return cachedSettings;
  if (typeof window === "undefined") return getDefaultUserJobSettings();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedSettings = getDefaultUserJobSettings();
      return cachedSettings;
    }
    const parsed = JSON.parse(raw);
    const defaults = getDefaultUserJobSettings();
    cachedSettings = {
      enabled: Boolean(parsed.enabled),
      jobs: {
        ...defaults.jobs,
        ...(parsed.jobs || {}),
      },
    };
    return cachedSettings;
  } catch {
    cachedSettings = getDefaultUserJobSettings();
    return cachedSettings;
  }
}

export function saveUserJobSettings(settings: UserJobSettings): void {
  cachedSettings = { ...settings };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      window.dispatchEvent(
        new CustomEvent("dofus_user_jobs_updated", {
          detail: settings,
        })
      );
    } catch (e) {
      console.warn("Error guardando ajustes de oficios:", e);
    }
  }
}

export function setUserJobLevel(jobId: number, level: number): void {
  const current = getUserJobSettings();
  const validLevel = Math.max(1, Math.min(200, Math.round(level) || 1));
  const updated: UserJobSettings = {
    ...current,
    jobs: {
      ...current.jobs,
      [jobId]: validLevel,
    },
  };
  saveUserJobSettings(updated);
}

export function setAllUserJobLevels(level: number, category?: JobCategory): void {
  const current = getUserJobSettings();
  const validLevel = Math.max(1, Math.min(200, Math.round(level) || 1));
  const newJobs = { ...current.jobs };
  USER_JOBS_DEFINITIONS.forEach((job) => {
    if (!category || job.category === category) {
      newJobs[job.id] = validLevel;
    }
  });
  saveUserJobSettings({
    ...current,
    jobs: newJobs,
  });
}

export function toggleUserJobsEnabled(enabled?: boolean): boolean {
  const current = getUserJobSettings();
  const nextEnabled = enabled !== undefined ? enabled : !current.enabled;
  saveUserJobSettings({
    ...current,
    enabled: nextEnabled,
  });
  return nextEnabled;
}

// ── Helpers de validación de filtrado ──────────────────────

/**
 * Determina si el usuario tiene el nivel de oficio suficiente para craftear el ítem
 */
export function canUserCraftItem(
  item: { jobId?: number; typeId?: number; level?: number; type?: any } | null | undefined,
  settings: UserJobSettings = getUserJobSettings()
): boolean {
  if (!settings.enabled || !item) return true;

  const itemLevel = item.level || 1;
  const directJobId = item.jobId;
  const resolvedType = Number(item.typeId || (typeof item.type === "object" ? item.type?.id : 0) || 0);
  let typeJobId = TYPE_ID_TO_CRAFT_JOB_ID_MAP[resolvedType];

  if (!typeJobId) {
    const rawType = typeof item.type === "string" ? item.type : (item.type?.name?.es || item.type?.name || "");
    if (rawType) {
      const normalized = rawType.toLowerCase().trim();
      typeJobId = TYPE_NAME_TO_CRAFT_JOB_ID_MAP[normalized];
    }
  }

  const effectiveJobId = directJobId || typeJobId;
  if (!effectiveJobId) {
    // Si no tiene oficio de crafteo asociado (ej. recursos puros, drops directos), no se bloquea
    return true;
  }

  const userLevel = settings.jobs[effectiveJobId] ?? 1;
  return userLevel >= itemLevel;
}

/**
 * Determina si el usuario tiene el nivel de oficio de forjamagia suficiente para magear el ítem
 */
export function canUserMageItem(
  item: { typeId?: number; level?: number; type?: any } | null | undefined,
  settings: UserJobSettings = getUserJobSettings()
): boolean {
  if (!settings.enabled || !item) return true;

  const resolvedType = Number(item.typeId || (typeof item.type === "object" ? item.type?.id : 0) || 0);
  let mageJobId = TYPE_ID_TO_MAGE_JOB_ID_MAP[resolvedType];

  if (!mageJobId) {
    const rawType = typeof item.type === "string" ? item.type : (item.type?.name?.es || item.type?.name || "");
    if (rawType) {
      const normalized = rawType.toLowerCase().trim();
      mageJobId = TYPE_NAME_TO_MAGE_JOB_ID_MAP[normalized];
    }
  }

  if (!mageJobId) return false;

  const itemLevel = item.level || 1;
  const userLevel = settings.jobs[mageJobId] ?? 1;
  return userLevel >= itemLevel;
}

/**
 * Determina si el usuario puede craftear O magear el ítem (muy útil para la Rompedora / Machacado)
 */
export function canUserCraftOrMageItem(
  item: { jobId?: number; typeId?: number; level?: number; type?: any } | null | undefined,
  settings: UserJobSettings = getUserJobSettings()
): boolean {
  if (!settings.enabled || !item) return true;
  return canUserCraftItem(item, settings) || canUserMageItem(item, settings);
}


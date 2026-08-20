import { DofusJob } from "../types.js";
import {
  JOB_CATEGORY_DATABASE,
  DOFUS_DB_TYPE_TO_JOB_MAP,
  DOFUS_DU_TYPE_TO_JOB_MAP,
} from "./jobCategoryDatabase.js";

export const DOFUS_JOBS: DofusJob[] = JOB_CATEGORY_DATABASE.map((job) => {
  // Aggregate all dofusDbTypes and dofusDuTypes for backwards compatibility
  const allTypeIds = job.categories.flatMap((cat) => [
    ...cat.dofusDbTypes,
    ...cat.dofusDuTypes,
  ]);
  const uniqueTypeIds = Array.from(new Set(allTypeIds));

  return {
    id: job.id,
    nameEs: job.nameEs,
    nameFr: job.nameFr,
    icon: job.icon,
    ankamaJobIds: job.ankamaJobIds,
    typeIds: uniqueTypeIds,
    description: job.description,
  };
});

/**
 * Los únicos 6 oficios de equipamiento válidos para machacado y generación de runas:
 * Sastre (27), Joyero (16), Zapatero (15), Fabricante (60), Herrero (11), Escultor (13).
 */
export const CRUSHING_ALLOWED_JOB_IDS: number[] = [27, 16, 15, 60, 11, 13];

export const CRUSHING_ALLOWED_JOBS: DofusJob[] = DOFUS_JOBS.filter((job) =>
  CRUSHING_ALLOWED_JOB_IDS.includes(job.id),
);

export function isCrushableJob(jobId: number): boolean {
  return CRUSHING_ALLOWED_JOB_IDS.includes(jobId);
}

/**
 * Helper to test if an item is omitted (runes, maps, elemental stones, cosmetics, etc.)
 */
export function isOmittedItem(item: {
  id?: number;
  name?: { es?: string; fr?: string; en?: string } | string;
  typeId?: number;
  type?: {
    id?: number;
    superCategoryId?: number;
    name?: { es?: string; fr?: string; en?: string } | string;
  };
}): boolean {
  if (!item) return true;

  // 1. Ejecutar inmediatamente el filtro de cosméticos
  if (isCosmeticItem(item as any)) {
    return true;
  }

  // 1.1 Omitir Objetos de Clase (No generan runas y se omiten para evitar confusión)
  if (isClassItem(item as any)) {
    return true;
  }

  const typeId = Number(item.typeId || item.type?.id || 0);

  // 2. Smithmagic / Runes / non-trade utility stones
  if ([18, 31, 74, 78, 85, 97, 189, 211, 233, 258, 307, 308].includes(typeId)) {
    return true;
  }

  // 3. Maps & Map Fragments type IDs (174: Mapa, 175: Fragmento de mapa)
  if ([174, 175].includes(typeId)) {
    return true;
  }

  // 4. Cosmetics, Appearance, Roleplay, Roleplay Buffs, Titles, Emotes, Quests type IDs
  if (
    [
      113, 166, 173, 199, 200, 203, 204, 214, 222, 246, 247, 248, 249, 250,
      251, 252, 304, 324,
    ].includes(typeId)
  ) {
    return true;
  }

  // 5. Quests and unused non-craftable item types
  if (
    [
      80, 126, 127, 129, 131, 132, 133, 136, 137, 139, 140, 141, 142, 143, 146,
      147, 148, 149, 155, 156, 168, 171, 178, 312,
    ].includes(typeId)
  ) {
    return true;
  }

  const nameStr = typeof item.name === "string" ? item.name : "";
  const nameEs = (
    typeof item.name === "object" ? item.name?.es || "" : nameStr
  ).toLowerCase();
  const nameFr = (
    typeof item.name === "object" ? item.name?.fr || "" : ""
  ).toLowerCase();
  const nameEn = (
    typeof item.name === "object" ? item.name?.en || "" : ""
  ).toLowerCase();

  const typeNameStr = typeof item.type?.name === "string" ? item.type.name : "";
  const typeNameEs = (
    typeof item.type?.name === "object" ? item.type.name?.es || "" : typeNameStr
  ).toLowerCase();
  const typeNameFr = (
    typeof item.type?.name === "object" ? item.type.name?.fr || "" : ""
  ).toLowerCase();

  const text = `${nameEs} ${nameFr} ${nameEn} ${typeNameEs} ${typeNameFr}`;

  // Roleplay items & Roleplay Buffs check
  if (
    text.includes("roleplay") ||
    text.includes("buff roleplay") ||
    text.includes("roleplay buff") ||
    text.includes("pancarta") ||
    text.includes("bocadillo de") ||
    text.includes("insignia de roleplay") ||
    text.includes("efecto de roleplay") ||
    text.includes("interactivo de roleplay") ||
    text.includes("incantación de roleplay")
  ) {
    return true;
  }

  // Mascotas y Seguidores check
  if (
    text.includes("mascota") ||
    text.includes("pet") ||
    text.includes("familier") ||
    text.includes("mascotura") ||
    text.includes("montilier") ||
    text.includes("personaje seguidor") ||
    typeNameEs === "personaje seguidor"
  ) {
    return true;
  }

  // Alas (Wings) check - Restringido estrictamente a categoría o nombres exactos para no afectar capas equipables
  if (
    typeNameEs === "alas" ||
    typeNameEs === "alas cosméticas" ||
    typeNameEs === "alas cosmeticas"
  ) {
    return true;
  }

  // Alteraciones y Buffs check
  if (
    typeNameEs === "alteración" ||
    typeNameEs === "alteracion" ||
    text.includes("alteración") ||
    text.includes("alteracion") ||
    text.includes("bendición") ||
    text.includes("maldición")
  ) {
    return true;
  }

  // Elemental stones check
  if (
    text.includes("piedra de fuego") ||
    text.includes("pierre de feu") ||
    text.includes("fire stone") ||
    text.includes("piedra de tierra") ||
    text.includes("pierre de terre") ||
    text.includes("earth stone") ||
    text.includes("piedra de agua") ||
    text.includes("pierre d'eau") ||
    text.includes("water stone") ||
    text.includes("piedra de aire") ||
    text.includes("pierre d'air") ||
    text.includes("air stone")
  ) {
    return true;
  }

  // Maps / Map Fragments check
  if (
    text.includes("fragmento de mapa") ||
    text.includes("fragment de carte") ||
    text.includes("map fragment") ||
    text.includes("mapa de") ||
    text.includes("carte de trésor") ||
    text.includes("carte au trésor")
  ) {
    return true;
  }

  // Smithmagic / Runes check
  if (
    text.includes("runa de") ||
    text.includes("runa ") ||
    text.includes("rune de") ||
    text.includes("rune ") ||
    text.includes("forjamagia") ||
    text.includes("forgemagie") ||
    text.includes("transcendencia") ||
    text.includes("trascendencia") ||
    text.includes("orbe de") ||
    text.includes("grabado de") ||
    text.includes("runa astragala")
  ) {
    return true;
  }

  // Gremio y Alianza (Guild & Alliance) check
  if (
    text.includes("gema espiritual") ||
    text.includes("piedra de alma llena") ||
    text.includes("pierre d'âme pleine") ||
    text.includes("soul stone full") ||
    text.includes("special soul stone") ||
    text.includes("alma capturada") ||
    text.includes("captured soul")
  ) {
    return true;
  }

  return false;
}

export function isRuneOrForjamagiaItem(item: any): boolean {
  return isOmittedItem(item);
}

/**
 * Determine the exact profession for any item/recipe with absolute consistency
 */
export function getJobForItem(
  item?: {
    id?: number;
    typeId?: number;
    type?: { id?: number; name?: any; superCategoryId?: number };
    name?: any;
    isDofusDu?: boolean;
    ankama_id?: number;
  } | null,
  recipe?: {
    jobId?: number;
    job?: { id?: number; name?: any };
    resultId?: number;
  } | null,
): { jobId: number; jobNameEs: string } {
  if (!item && !recipe) return { jobId: 0, jobNameEs: "Sin Oficio" };

  if (item && isOmittedItem(item as any)) {
    return { jobId: 0, jobNameEs: "Sin Oficio" };
  }

  // 1. Extract recipe.job or recipe.jobId if directly supplied by DofusDB or Ankama
  const rawJobId = recipe?.job?.id || recipe?.jobId;
  if (rawJobId) {
    const foundByJobId = DOFUS_JOBS.find(
      (j) => j.id === rawJobId || j.ankamaJobIds?.includes(rawJobId),
    );
    if (foundByJobId) {
      return { jobId: foundByJobId.id, jobNameEs: foundByJobId.nameEs };
    }
  }

  // 2. Check typeId in lookup maps
  const typeId = item?.typeId || item?.type?.id || 0;
  if (typeId > 0) {
    if (item?.isDofusDu || item?.ankama_id) {
      if (DOFUS_DU_TYPE_TO_JOB_MAP[typeId]) {
        const found = DOFUS_DU_TYPE_TO_JOB_MAP[typeId];
        return { jobId: found.jobId, jobNameEs: found.jobNameEs };
      }
    }
    if (DOFUS_DB_TYPE_TO_JOB_MAP[typeId]) {
      const found = DOFUS_DB_TYPE_TO_JOB_MAP[typeId];
      return { jobId: found.jobId, jobNameEs: found.jobNameEs };
    }
  }

  // 3. Match using category keywords from JOB_CATEGORY_DATABASE
  const itemTypeName = (
    typeof item?.type === "string"
      ? item.type
      : typeof item?.type?.name === "string"
        ? item.type.name
        : item?.type?.name?.es ||
          item?.type?.name?.fr ||
          item?.type?.name?.en ||
          ""
  )
    .toLowerCase()
    .trim();

  const itemName = (
    typeof item?.name === "string"
      ? item.name
      : item?.name?.es || item?.name?.fr || item?.name?.en || ""
  )
    .toLowerCase()
    .trim();

  const text = `${itemName} ${itemTypeName}`.toLowerCase();

  for (const job of JOB_CATEGORY_DATABASE) {
    for (const cat of job.categories) {
      for (const kw of cat.keywords) {
        if (text.includes(kw.toLowerCase())) {
          return { jobId: job.id, jobNameEs: job.nameEs };
        }
      }
    }
  }

  return { jobId: 0, jobNameEs: "Sin Oficio" };
}

// Cosmetic, Appearance and Fireworks/Fairies Exclusions
export const COSMETIC_SUPER_CATEGORY_IDS = [23]; // Appearance superCategory in DofusDB

export const COSMETIC_TYPE_IDS = [
  113, // Objeto de Apariencia
  114, // Traje
  120, // Mascotina de Apariencia
  121, // Arnes
  139, // Escudo Ceremonial
  140, // Sombrero Ceremonial
  190, // Mascota Ceremonial
  202, // Traje Ceremonial
  224, // Dofus Ceremonial
  225, // Armadura Ceremonial
  226, // Apariencia
  227, // Skin
];

export const COSMETIC_KEYWORDS = [
  "ceremonial",
  "apariencia",
  "skin",
  "disfraz",
  "traje",
  "arnés",
  "arnes",
  "cosmético",
  "cosmetico",
];

/**
 * Helper to test if an item is cosmetic/appearance or an omitted item (such as Hadas de artificio / Fireworks)
 */
export function isCosmeticItem(item: {
  name?: { es?: string; fr?: string; en?: string } | string;
  typeId?: number;
  type?: {
    id?: number;
    superCategoryId?: number;
    name?: { es?: string; fr?: string; en?: string } | string;
  };
}): boolean {
  if (!item) return false;

  const typeId = item.typeId || item.type?.id;
  // Never treat Trophies (151, 271), Idols (188), Shields (82), or Prisms (112, 217) as cosmetic!
  if (typeId && [151, 271, 188, 82, 112, 217].includes(typeId)) {
    return false;
  }

  // Check superCategoryId
  if (
    item.type?.superCategoryId &&
    COSMETIC_SUPER_CATEGORY_IDS.includes(item.type.superCategoryId)
  ) {
    return true;
  }

  // Check typeId
  if (typeId && COSMETIC_TYPE_IDS.includes(typeId)) {
    return true;
  }

  // Check names
  const nameStr = typeof item.name === "string" ? item.name : "";
  const nameEs = (
    typeof item.name === "object" ? item.name?.es || "" : nameStr
  ).toLowerCase();
  const nameFr = (
    typeof item.name === "object" ? item.name?.fr || "" : ""
  ).toLowerCase();
  const nameEn = (
    typeof item.name === "object" ? item.name?.en || "" : ""
  ).toLowerCase();

  const typeNameStr = typeof item.type?.name === "string" ? item.type.name : "";
  const typeNameEs = (
    typeof item.type?.name === "object" ? item.type.name?.es || "" : typeNameStr
  ).toLowerCase();
  const typeNameFr = (
    typeof item.type?.name === "object" ? item.type.name?.fr || "" : ""
  ).toLowerCase();

  // Omit Hadas de artificio / Fireworks as explicitly requested
  if (
    nameEs.includes("hada") ||
    nameFr.includes("fée") ||
    nameEn.includes("fairy") ||
    nameEn.includes("firework") ||
    typeNameEs.includes("hada") ||
    typeNameFr.includes("fée")
  ) {
    return true;
  }

  for (const kw of COSMETIC_KEYWORDS) {
    if (
      nameEs.includes(kw) ||
      nameFr.includes(kw) ||
      typeNameEs.includes(kw) ||
      typeNameFr.includes(kw)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to test if an item is a Class Item (Objetos de clase / Panoplias de clase)
 * These items modify spells and generate 0 runes, and must be completely omitted.
 */
export function isClassItem(item: {
  id?: number;
  name?: { es?: string; fr?: string; en?: string } | string;
  description?: { es?: string; fr?: string; en?: string } | string;
  typeId?: number;
  type?: {
    id?: number;
    superCategoryId?: number;
    name?: { es?: string; fr?: string; en?: string } | string;
  };
  possibleEffects?: Array<{
    id?: number;
    effectId?: number;
    characteristic?: number;
    from?: number;
    to?: number;
    formatted?: string;
  }>;
}): boolean {
  if (!item) return false;

  const nameStr = typeof item.name === "string" ? item.name : "";
  const nameEs = (
    typeof item.name === "object" ? item.name?.es || "" : nameStr
  ).toLowerCase().trim();
  const nameFr = (
    typeof item.name === "object" ? item.name?.fr || "" : ""
  ).toLowerCase().trim();
  const nameEn = (
    typeof item.name === "object" ? item.name?.en || "" : ""
  ).toLowerCase().trim();

  const descStr = typeof item.description === "string" ? item.description : "";
  const descEs = (
    typeof item.description === "object" ? item.description?.es || "" : descStr
  ).toLowerCase();

  const fullText = `${nameEs} ${nameFr} ${nameEn} ${descEs}`;

  // Patterns for class items and class sets in Dofus
  const CLASS_ITEM_PATTERNS = [
    "de clase",
    "de los feca",
    "de los yopuka",
    "de los ocra",
    "de los sram",
    "de los eniripsa",
    "de los osamodas",
    "de los enutrof",
    "de los xelor",
    "de los xélor",
    "de los zurcarak",
    "de los zurcarák",
    "de los sadida",
    "de los sacrogrito",
    "de los sacrógrito",
    "de los pandawa",
    "de los tymador",
    "de los zobal",
    "de los steamer",
    "de los selotrop",
    "de los hipermago",
    "de los uginak",
    "de los forjalanzas",
    "panoplie de classe",
    "panoplia de clase",
    "objet de classe",
    "objeto de clase",
    // Spanish class set item names
    "birrete tador",
    "capa teur",
    "cinturón steur",
    "cinturon steur",
    "botas tifas",
    "sortija lero",
    "boina turón",
    "boina turon",
    "capa razón",
    "capa razon",
    "cinturón fante",
    "cinturon fante",
    "botas tijas",
    "sortija gole",
    "sombrero lito",
    "capa lita",
    "cinturón toro",
    "cinturon toro",
    "botas tero",
    "sortija lejo",
    "sombrero tura",
    "capa tura",
    "cinturón tura",
    "cinturon tura",
    "botas tura",
    "sortija tura",
    "casco hondo",
    "capa yente",
    "sombrero lero",
    "capa lero",
    "cinturón lero",
    "cinturon lero",
    "botas leras",
    "sortija lera",
    "sombrero miau",
    "capa miau",
    "cinturón miau",
    "cinturon miau",
    "botas miau",
    "sortija miau",
    "corona tula",
    "capa tula",
    "cinturón tulo",
    "cinturon tulo",
    "botas tula",
    "sortija tula",
    "casco leado",
    "capa lada",
    "sombrero rero",
    "capa rera",
    "cinturón rero",
    "cinturon rero",
    "botas reras",
    "sortija rera",
    "sombrero nudo",
    "capa nuda",
    "cinturón nudo",
    "cinturon nudo",
    "botas nudas",
    "sortija nuda",
    "capa pucha",
    "gorro pucho",
    "cinturón pucho",
    "cinturon pucho",
    "botas puchas",
    "sortija pucha",
    "corona txi",
    "capa txi",
    "cinturón txi",
    "cinturon txi",
    "botas txi",
    "sortija txi",
    "boina parda",
    "capa parda",
    "cinturón pardo",
    "cinturon pardo",
    "botas pardas",
    "sortija parda",
    "máscara parda",
    "mascara parda",
    "sombrero mero",
    "capa mera",
    "cinturón mero",
    "cinturon mero",
    "botas meras",
    "sortija mera",
    "tocado toro",
    "capa toro",
    "cinturón toro",
    "cinturon toro",
    "botas toras",
    "sortija tora",
    "birrete mágico",
    "birrete magico",
    "capa mágica",
    "capa magica",
    "sombrero ladro",
    "capa ladra",
    "cinturón ladro",
    "cinturon ladro",
    "botas ladras",
    "sortija ladra",
    "casco lanza",
    "capa lanza",
    "cinturón lanza",
    "cinturon lanza",
    "botas lanzas",
    "sortija lanza",
  ];

  for (const pat of CLASS_ITEM_PATTERNS) {
    if (fullText.includes(pat)) {
      return true;
    }
  }

  // Spell-modification effects check (Dofus effectIds 281-294)
  if (Array.isArray(item.possibleEffects) && item.possibleEffects.length > 0) {
    const spellModifierCount = item.possibleEffects.filter((eff) => {
      const effId = Number(eff.effectId || eff.id || 0);
      const isSpellMod = effId >= 281 && effId <= 294;
      const formatted = (eff.formatted || "").toLowerCase();
      const mentionsSpell =
        formatted.includes("hechizo") ||
        formatted.includes("sort ") ||
        formatted.includes("spell ") ||
        formatted.includes("línea de visión") ||
        formatted.includes("linea de vision") ||
        formatted.includes("alcance del hechizo") ||
        formatted.includes("coste en pa del hechizo") ||
        formatted.includes("cooldown");
      return isSpellMod || mentionsSpell;
    }).length;

    if (
      spellModifierCount > 0 &&
      (spellModifierCount === item.possibleEffects.length || spellModifierCount >= 3)
    ) {
      return true;
    }
  }

  return false;
}


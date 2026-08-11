import { DofusJob } from "../types";
import {
  JOB_CATEGORY_DATABASE,
  DOFUS_DB_TYPE_TO_JOB_MAP,
  DOFUS_DU_TYPE_TO_JOB_MAP,
} from "./jobCategoryDatabase";

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
      113, 166, 173, 188, 199, 200, 203, 204, 214, 222, 246, 247, 248, 249, 250,
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
  151, // Capa Ceremonial
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

  // Check superCategoryId
  if (
    item.type?.superCategoryId &&
    COSMETIC_SUPER_CATEGORY_IDS.includes(item.type.superCategoryId)
  ) {
    return true;
  }

  // Check typeId
  const typeId = item.typeId || item.type?.id;
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

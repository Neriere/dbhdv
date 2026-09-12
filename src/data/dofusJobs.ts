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
 * Identifica si un objeto es una Mascota, Mascotura, Montura o Fantasma de mascota
 * (los cuales nunca deben aparecer en la Rompedora / Machacado de runas).
 */
export function isPetItem(item?: {
  id?: number;
  typeId?: number;
  type?: { id?: number; superCategoryId?: number; name?: any };
  name?: any;
} | null): boolean {
  if (!item) return false;
  const typeId = Number(item.typeId || item.type?.id || 0);
  const superCatId = Number(item.type?.superCategoryId || 0);
  // Type IDs: 18 (Mascota/Familier), 77 (Certificado), 90 (Fantasma de mascota), 121 (Mascotura/Montilier), 195 (Pócima de mascota), 207 (Mascota legendaria)
  // SuperCategory 12: Mascotas y Monturas en Dofus
  if (superCatId === 12 || [18, 77, 90, 121, 195, 207].includes(typeId)) {
    return true;
  }
  const nameEs = (typeof item.name === "object" ? item.name?.es || "" : String(item.name || "")).toLowerCase();
  const nameFr = (typeof item.name === "object" ? item.name?.fr || "" : "").toLowerCase();
  const nameEn = (typeof item.name === "object" ? item.name?.en || "" : "").toLowerCase();
  const typeNameEs = (typeof item.type?.name === "object" ? item.type.name?.es || "" : String(item.type?.name || "")).toLowerCase();
  const typeNameFr = (typeof item.type?.name === "object" ? item.type.name?.fr || "" : "").toLowerCase();

  if (
    typeNameEs === "mascota" ||
    typeNameEs === "mascotura" ||
    typeNameEs === "montilier" ||
    typeNameEs === "familier" ||
    typeNameEs === "personaje seguidor" ||
    /\b(mascota|mascotas|mascotura|mascoturas|montilier|montiliers|familier|familiers)\b/i.test(
      `${nameEs} ${nameFr} ${nameEn} ${typeNameEs} ${typeNameFr}`,
    )
  ) {
    return true;
  }
  return false;
}

export function isDofusItem(item?: {
  id?: number;
  typeId?: number;
  type?: { id?: number; superCategoryId?: number; name?: any };
  name?: any;
} | null): boolean {
  if (!item) return false;
  const typeId = Number(item.typeId || item.type?.id || 0);
  if (typeId === 23) return true;
  const typeNameEs = (typeof item.type?.name === "object" ? item.type.name?.es || "" : String(item.type?.name || "")).toLowerCase();
  const typeNameFr = (typeof item.type?.name === "object" ? item.type.name?.fr || "" : "").toLowerCase();
  if (typeNameEs === "dofus" || typeNameFr === "dofus") return true;
  const nameEs = (typeof item.name === "object" ? item.name?.es || "" : String(item.name || "")).toLowerCase();
  const nameFr = (typeof item.name === "object" ? item.name?.fr || "" : "").toLowerCase();
  if (/^dofus\b/i.test(nameEs) || /^dofus\b/i.test(nameFr) || /\bdofus\b/i.test(nameEs)) return true;
  return false;
}

/**
 * Identifica si un objeto es una Mascota, Mascotura, Montura (Dragopavo, Mulagua, Vueloceronte)
 */
export function isMountOrPet(item?: {
  id?: number;
  typeId?: number;
  type?: { id?: number; superCategoryId?: number; name?: any };
  name?: any;
} | null): boolean {
  if (!item) return false;
  const typeId = Number(item.typeId || item.type?.id || 0);
  // Type IDs: 18 (Mascota), 97 (Dragopavo), 121 (Mascotura), 196 (Mulagua), 207 (Vueloceronte cert), 333 (Vueloceronte)
  if ([18, 97, 121, 196, 207, 333].includes(typeId)) return true;
  const nameEs = (typeof item.name === "object" ? item.name?.es || "" : String(item.name || "")).toLowerCase();
  const typeNameEs = (typeof item.type?.name === "object" ? item.type.name?.es || "" : String(item.type?.name || "")).toLowerCase();
  if (
    typeNameEs.includes("mascota") ||
    typeNameEs.includes("mascotura") ||
    typeNameEs.includes("dragopavo") ||
    typeNameEs.includes("mulagua") ||
    typeNameEs.includes("vueloceronte") ||
    nameEs.includes("dragopavo") ||
    nameEs.includes("mulagua") ||
    nameEs.includes("vueloceronte")
  ) {
    return true;
  }
  return false;
}

/**
 * Identifica si un objeto es una piedra de alma vacía crafteable / comerciable
 */
export function isSoulStone(item?: {
  id?: number;
  typeId?: number;
  type?: { id?: number; superCategoryId?: number; name?: any };
  name?: any;
} | null): boolean {
  if (!item) return false;
  const id = Number(item.id || 0);
  if ([9686, 9687, 9688, 9689, 9690, 21984].includes(id)) return true;
  const typeId = Number(item.typeId || item.type?.id || 0);
  const nameEs = (typeof item.name === "object" ? item.name?.es || "" : String(item.name || "")).toLowerCase();
  if ((typeId === 83 || typeId === 220) && nameEs.includes("piedra de alma")) {
    if (!nameEs.includes(" de ") && !nameEs.includes("llena") && !nameEs.includes("pleine")) {
      return true;
    }
  }
  return false;
}

/**
 * Helper to test if an item is purely cosmetic, appearance, quest item or obsolete dummy item
 */
export function isOmittedItem(item: {
  id?: number;
  name?: { es?: string; fr?: string; en?: string } | string;
  typeId?: number;
  type?: {
    id?: number;
    superCategoryId?: number;
    name?: { es?: string; fr?: string; en?: string } | string;
  } | string;
}): boolean {
  if (!item) return true;

  const rawType = (item as any)?.type;
  const typeId = Number(
    item.typeId ||
    (typeof rawType === "object" ? rawType?.id : typeof rawType === "number" ? rawType : 0) ||
    0
  );
  const superCatId = Number(
    (typeof rawType === "object" ? rawType?.superCategoryId : 0) || 0
  );

  // Los Dofus auténticos (tipo 23) nunca deben omitirse para la gestión de precios
  if (typeId === 23) {
    return false;
  }

  // Mascotas, monturas y mascoturas deben preservarse para seguimiento de precios y sets
  if (isMountOrPet(item as any)) {
    return false;
  }

  // Piedras de alma vacías deben preservarse
  if (isSoulStone(item as any)) {
    return false;
  }

  // Los objetos de clase (sets de clase) nunca deben aparecer en recetas ni machacado
  if (isClassItem(item as any)) {
    return true;
  }

  // Si tiene receta conocida o ingrediente, no omitir
  if ((item as any).has_recipe || (item as any).hasRecipe || (item as any).recipeData || (item as any).isIngredient) {
    return false;
  }

  // 1. Ejecutar filtro de cosméticos / apariencias
  if (isCosmeticItem(item as any)) {
    return true;
  }

  // 2. Supercategorías no comerciales / misiones (SuperCategory 4: Objetos de misión, 5: Mutaciones/Búsquedas, 15: No intercambiables, 23: Apariencias)
  // Nota: SuperCategory 14 contiene certificados de monturas que ya fueron eximidos arriba con isMountOrPet
  if ([4, 5, 14, 15, 23].includes(superCatId)) {
    return true;
  }

  // 3. Mapas y fragmentos de mapa no crafteables
  if ([174, 175].includes(typeId)) {
    return true;
  }

  // 4. Tipos obsoletos exclusivamente de roleplay, títulos, auras, emotes, fichas
  if (
    [
      166, 173, 199, 200, 203, 204, 214, 222, 246, 247, 248, 249, 250,
      251, 252, 304, 324,
    ].includes(typeId)
  ) {
    return true;
  }

  // 5. Objetos de misión no crafteables ni comerciables, fichas temporales
  if (
    [
      24, 80, 126, 127, 131, 132, 133, 136, 137, 141, 142, 143, 146,
      147, 148, 155, 156, 168, 171, 178, 186, 198, 312,
    ].includes(typeId)
  ) {
    return true;
  }

  // Criterios de crafteo exclusivo de misión (Qa= Quête active, Qo= Quête objectif, Qf= Quête finie)
  const craftCond = String(
    (item as any)?.craftConditionalCriterion ??
    (item as any)?.craft_conditional_criterion ??
    ""
  );
  if (craftCond && (/\bQ[aoef]\s*=/i.test(craftCond) || craftCond.includes("Qa=") || craftCond.includes("Qo="))) {
    return true;
  }

  // Ítem de misión conocido sin XP o no comerciable
  const rawItemId = Number(item.id || 0);
  if (rawItemId === 10272 || (rawItemId > 0 && KNOWN_ZERO_XP_OR_QUEST_ITEM_IDS.has(rawItemId) && !BASIC_HARVEST_INGREDIENT_IDS.has(rawItemId))) {
    return true;
  }

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

  // 6. Objetos de prueba / debug de Ankama (como [!] Rapa, [!] Test, etc.)
  if (
    nameEs.startsWith("[!]") ||
    nameFr.startsWith("[!]") ||
    nameEn.startsWith("[!]") ||
    nameEs.includes("[!]") ||
    nameFr.includes("[!]") ||
    nameEn.includes("[!]") ||
    nameEs.startsWith("[test]") ||
    nameEs.startsWith("[debug]")
  ) {
    return true;
  }

  const typeNameStr = typeof (item.type as any)?.name === "string"
    ? (item.type as any).name
    : typeof item.type === "string"
      ? item.type
      : "";
  const typeNameEs = (
    typeof (item.type as any)?.name === "object" ? (item.type as any).name?.es || "" : typeNameStr
  ).toLowerCase().trim();
  const typeNameFr = (
    typeof (item.type as any)?.name === "object" ? (item.type as any).name?.fr || "" : ""
  ).toLowerCase().trim();

  const text = `${nameEs} ${nameFr} ${nameEn} ${typeNameEs} ${typeNameFr}`;

  // 7. Piedras de alma capturadas / llenas (no vacías)
  if (
    text.includes("piedra de alma de") ||
    text.includes("piedra de alma llena") ||
    text.includes("pierre d'âme pleine") ||
    text.includes("pierre d'âme de")
  ) {
    return true;
  }

  // 8. Objetos y fichas de eventos / misiones específicas
  if (
    /^\d+\s+(insignia|insignias|ficha|fichas|alma|almas)\b/i.test(nameEs) ||
    nameEs.includes("insignias de") ||
    nameEs.includes("insignia de") ||
    nameEs.includes("abono desértico") ||
    nameEs.includes("abono desertico") ||
    text.includes("selocalipsis") ||
    text.includes("objeto de misión") ||
    text.includes("objeto de mision") ||
    text.includes("objet de quête") ||
    text.includes("quest item")
  ) {
    return true;
  }

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

  // Alas cosméticas check
  if (
    typeNameEs === "alas cosméticas" ||
    typeNameEs === "alas cosmeticas"
  ) {
    return true;
  }

  // Alteraciones y Buffs temporales no comerciables
  if (
    typeNameEs === "alteración" ||
    typeNameEs === "alteracion" ||
    text.includes("buff roleplay")
  ) {
    return true;
  }

  // Mapas de búsqueda del tesoro y fragmentos no crafteables
  if (
    text.includes("fragmento de mapa") ||
    text.includes("fragment de carte") ||
    text.includes("map fragment") ||
    text.includes("carte au trésor")
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
  139, // Escudo Ceremonial
  140, // Sombrero Ceremonial
  161, // Arnés de montura cosmético
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
  "traje ceremonial",
  "arnés ceremonial",
  "arnes ceremonial",
  "cosmético",
  "cosmetico",
];

/**
 * Helper to test if an item is cosmetic/appearance or an omitted item (such as Hadas de artificio / Fireworks)
 */
export function isCosmeticItem(item: {
  id?: number;
  name?: { es?: string; fr?: string; en?: string } | string;
  typeId?: number;
  type?: {
    id?: number;
    superCategoryId?: number;
    name?: { es?: string; fr?: string; en?: string } | string;
  };
}): boolean {
  if (!item) return false;

  // Never treat mounts, pets, or soul stones as cosmetic
  if (isMountOrPet(item as any) || isSoulStone(item as any)) {
    return false;
  }

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
    /\b(hada|hadas)\b/i.test(nameEs) ||
    /\b(fée|fées)\b/i.test(nameFr) ||
    /\b(fairy|fairies|firework|fireworks)\b/i.test(nameEn) ||
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

// Sets oficiales de clase en Dofus (19 razas + variantes)
export const CLASS_ITEM_SET_IDS = new Set<number>([
  81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
  217, 218, 250, 370, 392, 430, 515, 902
]);

// Todos los IDs oficiales de ítems de clase en Dofus
export const CLASS_ITEM_IDS = new Set<number>([
  8619, 8628, 8629, 8630, 8631, 8632, 8633, 8634, 8635, 8636,
  8637, 8638, 8639, 8640, 8641, 8642, 8643, 8644, 8645, 8646,
  8647, 8648, 8649, 8650, 8651, 8652, 8653, 8654, 8655, 8656,
  8657, 8658, 8659, 8660, 8661, 8662, 8663, 8664, 8665, 8666,
  8667, 8668, 8669, 8670, 8713, 8714, 8715, 8716, 8717, 8718,
  8719, 8720, 8721, 8722, 8723, 8724, 8725, 8726, 8727, 8728,
  9925, 9927, 12385, 12386, 12387, 12388, 12389, 12390, 12391,
  12392, 12393, 12394, 13261, 13262, 13263, 13264, 13265, 16140,
  16141, 16142, 16143, 16144, 17448, 17449, 17450, 17451, 17452,
  18615, 18616, 18617, 18621, 18622, 27551, 27552, 27553, 27554, 27555
]);

// Nombres exactos y patrones de los objetos de clase
export const CLASS_ITEM_NAMES_LOWER: string[] = [
  // Aniripsa - Set Altruista
  "cinturronchón", "cinturronchon", "botas epsia", "capa labrita", "gorro del maestro piezo", "alianza guero",
  // Anutrof - Set Venerable
  "cinto rhente", "zapatos ginkel-hy", "s'capa toria", "scapa toria", "alfue gorro", "anillo stálgico", "anillo stalgico",
  // Feca - Set Indestructible
  "la merendera", "botas de úveta", "botas de uveta", "capa docia", "sombrerillo del lazarillo", "anillo vedor",
  // Forjalanza - Set del Legado
  "talabarte popeya", "polainas herederas", "capa anteón", "capa anteon", "yelmo mero", "guantes peciales",
  // Hipermago - Set cuadramental
  "elementurón", "elementuron", "botas iniciales", "capa sencial", "tocado minante", "anillo rúnico", "anillo runico",
  // Ocra - Set del Príncipe de los ladrones
  "chincha diana", "cincha diana", "botas delappioh", "capulko", "gorro del príncipe robin", "gorro del principe robin", "divin anillo",
  // Osamodas - Set del Innumerable
  "cinto'rbodyezel", "cinto rbodyezel", "botaz mania", "capa lina", "capucha apino", "col anillo",
  // Pandawa - Set Etílico
  "pandinturón", "pandinturon", "chancletas bernáculo", "chancletas bernaculo", "geta bernáculo", "geta bernaculo", "capa weira", "casco locado", "anillo chistoso",
  // Sacrógrito - Set Exangüe
  "cinto oturador", "cinto orturator", "chancla vada", "cap'ytal", "cap ytal", "sombrervido", "hospit anillo",
  // Sadida - Set Salvaje
  "cintelación", "cintelacion", "botas nicas", "capitón", "capiton", "gorra bano", "anillo peludo",
  // Selotrop - Set transcendente
  "cinturón ciclón", "cinturon ciclon", "botas de tránsito", "botas de transito", "capa ortal", "máscara krósmica", "mascara krosmica", "anillo nova",
  // Sram - Set Criminal
  "cinto hreru", "botas idermista", "capa migodel oajeno", "multricornio", "avernillo",
  // Steamer - Set Sumergible
  "cinturojo debuhey", "robotas", "saca-botellón", "saca-botellon", "escafandra gina", "manometranillo",
  // Tymador - Set explosivo
  "cinturón daxpansiva", "cinturon daxpansiva", "botas opsya", "capa horcado", "bandana burlona", "mitones curidad",
  // Uginak - Set rabioso
  "cinturón azotón", "cinturon azoton", "botas masnada", "capa pelo", "gorro morro", "anillóseo", "anilloseo",
  // Xelor - Set Intemporal
  "cinto o'rario", "cinto orario", "zapato m'prano", "zapato mprano", "capa tic-tac", "diapa sombrero", "puntu alianza",
  // Yopuka - Set Temerario
  "correa litichow", "botas altantes", "botas altante", "capa yaso", "casco moasdicho", "pulserriña", "pulserrina",
  // Zobal - Set lunático
  "cuerda sura", "zuecos toso", "capa aircusíon", "capa aircusion", "máscara rpone", "mascara rpone", "brazalete yenda",
  // Zurcarák - Set del Caza Ratones
  "cintourón baraja", "cintouron baraja", "cinturón baraja", "cinturon baraja", "zapatillas con pelos", "capa gar", "sombrero de tahúr", "sombrero de tahur", "sombrero del tahúr", "anillo del craps",
  // Nombres de Panoplias de clase
  "set altruista", "set venerable", "set indestructible", "set del legado", "set cuadramental",
  "set del príncipe de los ladrones", "set del principe de los ladrones", "set del innumerable",
  "set etílico", "set etilico", "set exangüe", "set exangue", "set salvaje", "set transcendente",
  "set criminal", "set sumergible", "set explosivo", "set rabioso", "set intemporal", "set temerario",
  "set lunático", "set lunatico", "set del caza ratones", "panoplia de clase", "panoplie de classe"
];

/**
 * Helper to test if an item is a Class Item (Objetos de clase / Panoplias de clase)
 * These items modify spells and generate 0 runes, and must be completely omitted from recipes, ranking, and crafting.
 */
export function isClassItem(item: {
  id?: number;
  name?: { es?: string; fr?: string; en?: string } | string;
  description?: { es?: string; fr?: string; en?: string } | string;
  typeId?: number;
  itemSetId?: number;
  item_set_id?: number;
  itemSet?: { id?: number };
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
  effects?: Array<{
    id?: number;
    effectId?: number;
    characteristic?: number;
    from?: number;
    to?: number;
    formatted?: string;
  }>;
}): boolean {
  if (!item) return false;

  // 1. Comprobación directa por ID del ítem
  const itemId = Number(item.id || 0);
  if (itemId > 0 && CLASS_ITEM_IDS.has(itemId)) {
    return true;
  }

  // 2. Comprobación por ID de set de clase
  const setId = Number(item.itemSetId || item.item_set_id || item.itemSet?.id || (item as any).item_set || 0);
  if (setId > 0 && CLASS_ITEM_SET_IDS.has(setId)) {
    return true;
  }

  // 3. Comprobación por nombre
  const nameStr = typeof item.name === "string" ? item.name : "";
  const nameEs = (typeof item.name === "object" ? item.name?.es || "" : nameStr).toLowerCase().trim();
  const nameFr = (typeof item.name === "object" ? item.name?.fr || "" : "").toLowerCase().trim();
  const nameEn = (typeof item.name === "object" ? item.name?.en || "" : "").toLowerCase().trim();

  const descStr = typeof item.description === "string" ? item.description : "";
  const descEs = (typeof item.description === "object" ? item.description?.es || "" : descStr).toLowerCase();

  const fullText = `${nameEs} ${nameFr} ${nameEn} ${descEs}`;

  for (const className of CLASS_ITEM_NAMES_LOWER) {
    if (nameEs === className || nameEs.includes(className) || fullText.includes(className)) {
      return true;
    }
  }

  // 4. Comprobación por efectos de modificación de hechizos (efectos 281-294 o mención de hechizo)
  const allEffects = [
    ...(Array.isArray(item.possibleEffects) ? item.possibleEffects : []),
    ...(Array.isArray(item.effects) ? item.effects : []),
  ];

  if (allEffects.length > 0) {
    let spellModifierCount = 0;
    for (const eff of allEffects) {
      const effId = Number(eff.effectId || (eff as any).id || 0);
      const isSpellMod = effId >= 281 && effId <= 294;
      const formatted = ((eff.formatted as any) || "").toLowerCase();
      const mentionsSpell =
        formatted.includes("hechizo") ||
        formatted.includes("sort ") ||
        formatted.includes("spell ") ||
        formatted.includes("línea de visión") ||
        formatted.includes("linea de vision") ||
        formatted.includes("alcance del hechizo") ||
        formatted.includes("coste en pa del hechizo") ||
        formatted.includes("cooldown");
      if (isSpellMod || mentionsSpell) {
        spellModifierCount++;
      }
    }

    if (spellModifierCount > 0 && (spellModifierCount === allEffects.length || spellModifierCount >= 2)) {
      return true;
    }
  }

  return false;
}

// Recursos básicos recolectables que pueden tener craftXpRatio = 0 pero se usan legítimamente como ingredientes
export const BASIC_HARVEST_INGREDIENT_IDS = new Set<number>([
  420,  // Hilo de lino
  1001, // Tabla de madera de kokoko
  1461, // Veneno azotador
]);

/**
 * Listado exhaustivo de ítems de misión o crafteo especial con craftXpRatio = 0 en DofusDB
 * Estos ítems NO dan experiencia de oficio, requieren pasos de misiones activas (Qa=/Qo=)
 * o no tienen valor comercial en HDV, por lo que nunca deben incluirse en subidas de nivel.
 */
export const KNOWN_ZERO_XP_OR_QUEST_ITEM_IDS = new Set<number>([
  10272, // Máscara de Sag (Masque à Zag - Lvl 180, Sastre, craftXpRatio: 0, Quest Brakmar)
  10223, // Pala Heliktrochok (Lvl 179)
  2151,  // Blopicero envenenado (Lvl 30)
  9312,  // Sopa de berenjenas amakneana (Lvl 188)
  9968,  // Botella de Zampaburg (Lvl 151)
  9979,  // Filtro de longevidad (Lvl 158)
  9980,  // Plato de fribamga (Lvl 158)
  9981,  // Harina terrada (Lvl 158)
  9982,  // Ensalada misela (Lvl 158)
  9983,  // Hogazas querosas (Lvl 158)
  10030, // Tejido remendón (Lvl 1)
  10031, // Tinte naranja sanguina (Lvl 155)
  10041, // Receptáculo de corruptita (Lvl 1)
  10046, // Knut artesanal (Lvl 172)
  10064, // Tinte mágico tenebroso (Lvl 174)
  10065, // Loción Laérol (Lvl 175)
  10070, // Tonel de bombú (Lvl 172)
  10083, // Enchalada de pescado (Lvl 153)
  10204, // Pócima de sesamobolizante (Lvl 180)
  10285, // Lucio rebosante (Lvl 180)
  11701, // Jugo de ardilla de las nieves exprimida (Lvl 60)
  17442, // Puntas de knut (Lvl 172)
  17443, // Mango de knut (Lvl 172)
  17444, // Correas de knut (Lvl 172)
  17460, // Varita ósea (Lvl 173)
  17772, // Llave del panteón del rey Leorictus (Lvl 184)
  17774, // Elixir de arakna (Lvl 184)
  17777, // Llave del panteón del príncipe Djamal (Lvl 184)
  17781, // Disolvente fosforescente (Lvl 185)
  17785, // Llave del templo maldito (Lvl 186)
  17792, // Sopa social de Astrub (Lvl 188)
  18113, // Mixtura indecible (Lvl 1)
  18203, // Tronco encantado (Lvl 110)
  18208, // Gatrool krósmico (Lvl 120)
  18348, // Flauta de mastodonte (Lvl 80)
  18741, // Cofre de trampas de cazador (Lvl 190)
  18742, // Brebaje muscular (Lvl 190)
  18743, // Implantes rústicos (Lvl 190)
  18836, // Brebaje de Nas Orazal (Lvl 1)
  19415, // Guante de Zrid (Lvl 1)
  19693, // Calzoncillo de lana (Lvl 1)
  21713, // Pozo decorativo (Lvl 1)
  21727, // Cofre decorativo (Lvl 1)
  21752, // Ramo de flores de blop reineta (Lvl 1)
  21753, // Ramo de flores de blop guinda (Lvl 1)
  21754, // Ramo de flores de blop coco (Lvl 1)
  21755, // Ramo de flores de blop índigo (Lvl 1)
  420,   // Hilo de lino
  1001,  // Tabla de madera de kokoko
  1461,  // Veneno azotador
]);

/**
 * Validador estricto para descartar cualquier crafteo de misión, sin XP o no apto para oficios.
 */
export function isQuestOrZeroXpCraft(
  item?: any,
  recipe?: any
): boolean {
  if (!item && !recipe) return false;

  const itemId = Number(item?.id || recipe?.resultId || 0);

  // 1. Ítems conocidos sin XP o de misión
  if (itemId > 0 && KNOWN_ZERO_XP_OR_QUEST_ITEM_IDS.has(itemId)) {
    return true;
  }

  // 2. Ratio oficial de XP de crafteo es exactamente 0
  const xpRatio =
    item?.craftXpRatio ??
    recipe?.craftXpRatio ??
    recipe?.result?.craftXpRatio ??
    item?.craft_xp_ratio;
  if (xpRatio === 0) {
    return true;
  }

  // 3. Criterio condicional de crafteo requiere misión activa (Qa= / Qo= / Qf=)
  const craftCond = String(
    item?.craftConditionalCriterion ??
    recipe?.craftConditionalCriterion ??
    recipe?.result?.craftConditionalCriterion ??
    item?.craft_conditional_criterion ??
    ""
  );
  if (craftCond && (/\bQ[aoef]\s*=/i.test(craftCond) || craftCond.includes("Qa=") || craftCond.includes("Qo="))) {
    return true;
  }

  // 4. Supertipo de objetos de misión (superTypeId 14 en DofusDB = Objet de quête)
  const superTypeId =
    item?.superTypeId ??
    item?.type?.superTypeId ??
    item?.type?.superType?.id ??
    recipe?.result?.type?.superTypeId;
  if (superTypeId === 14) {
    return true;
  }

  // 5. Supercategoría de misión (superCategoryId 4 en DofusDB = Objets de quête)
  const superCategoryId =
    item?.type?.superCategoryId ??
    item?.superCategoryId ??
    recipe?.result?.type?.superCategoryId;
  if (superCategoryId === 4) {
    return true;
  }

  // 6. Tipos específicos de misión conocidos en Dofus
  const typeId = Number(item?.typeId || item?.type?.id || recipe?.resultTypeId || 0);
  if (typeId > 0 && [24, 80, 126, 127, 131, 132, 133, 136, 137, 141, 142, 143, 146, 147, 148, 155, 156, 168, 171, 178, 186, 198, 312].includes(typeId)) {
    return true;
  }

  // 7. Si no tiene precio base ni en mercadillo y el nombre o descripción menciona explícitamente misión
  const nameStr = typeof item?.name === "string" ? item.name : item?.name?.es || recipe?.resultName || "";
  const nameLower = String(nameStr).toLowerCase();
  if (nameLower.includes("objeto de misión") || nameLower.includes("objeto de mision") || nameLower.includes("(misión)")) {
    return true;
  }

  return false;
}


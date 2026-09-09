import { PriceProfile, ServerCategory } from "../types";

export interface ServerCategoryGroup {
  category: ServerCategory;
  label: string;
  badgeClass: string;
  profiles: PriceProfile[];
}

export const SERVER_CATEGORIES_CONFIG: Record<
  ServerCategory,
  { label: string; badgeClass: string; order: number }
> = {
  monocuenta_pionero: {
    label: "Monocuenta Pionero",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    order: 1,
  },
  monocuenta_clasico: {
    label: "Monocuenta Clásico",
    badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    order: 2,
  },
  multicuenta_pionero: {
    label: "Multicuenta Pionero",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    order: 3,
  },
  multicuenta_clasico: {
    label: "Multicuenta Clásico",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    order: 4,
  },
};

/**
 * Group price profiles into clearly categorized groups for dropdowns and selectors
 */
export function groupPriceProfilesByCategory(
  profiles: PriceProfile[]
): ServerCategoryGroup[] {
  const groupsMap: Record<ServerCategory, PriceProfile[]> = {
    monocuenta_pionero: [],
    monocuenta_clasico: [],
    multicuenta_pionero: [],
    multicuenta_clasico: [],
  };

  for (const profile of profiles) {
    const cat = (profile.category as ServerCategory) || "monocuenta_clasico";
    if (groupsMap[cat]) {
      groupsMap[cat].push(profile);
    } else {
      groupsMap.monocuenta_clasico.push(profile);
    }
  }

  const categoryKeys = Object.keys(SERVER_CATEGORIES_CONFIG) as ServerCategory[];
  categoryKeys.sort((a, b) => SERVER_CATEGORIES_CONFIG[a].order - SERVER_CATEGORIES_CONFIG[b].order);

  return categoryKeys
    .filter((cat) => groupsMap[cat].length > 0)
    .map((cat) => ({
      category: cat,
      label: SERVER_CATEGORIES_CONFIG[cat].label,
      badgeClass: SERVER_CATEGORIES_CONFIG[cat].badgeClass,
      profiles: groupsMap[cat],
    }));
}

/**
 * Get display category info for a given profile
 */
export function getProfileCategoryInfo(profile?: PriceProfile) {
  const cat = (profile?.category as ServerCategory) || "monocuenta_clasico";
  return SERVER_CATEGORIES_CONFIG[cat] || SERVER_CATEGORIES_CONFIG.monocuenta_clasico;
}

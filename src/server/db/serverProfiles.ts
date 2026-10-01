import { PriceProfile, ServerCategory } from "../../types";
import { database, getMetaValue, setMetaValue } from "../localDataStore";

export const UNITY_SERVER_PROFILES: Array<{
  slug: string;
  name: string;
  category: ServerCategory;
  categoryLabel: string;
  isDefault?: boolean;
}> = [
  // Monocuenta Clásico
  { slug: "draconiros", name: "Draconiros", category: "monocuenta_clasico", categoryLabel: "Monocuenta Clásico", isDefault: true },

  // Monocuenta Pionero (Kourial, Mikhal, Dakal)
  { slug: "kourial", name: "Kourial", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero" },
  { slug: "mikhal", name: "Mikhal", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero" },
  { slug: "dakal", name: "Dakal", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero" },

  // Multicuenta Pionero (Brial, Rafal, Salar)
  { slug: "brial", name: "Brial", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero" },
  { slug: "rafal", name: "Rafal", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero" },
  { slug: "salar", name: "Salar", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero" },

  // Multicuenta Clásico (Tal Kasha, Hell Mina, Imagiro, Orukam, Tylezia)
  { slug: "tal-kasha", name: "Tal Kasha", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
  { slug: "hellmina", name: "Hell Mina", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
  { slug: "imagiro", name: "Imagiro", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
  { slug: "orukam", name: "Orukam", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
  { slug: "tylezia", name: "Tylezia", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
];

let cachedPriceProfiles: PriceProfile[] | null = null;
let cachedActivePriceProfileId: number | null = null;

export function invalidatePriceProfileCache(): void {
  cachedPriceProfiles = null;
  cachedActivePriceProfileId = null;
}

export async function getPriceProfiles(): Promise<PriceProfile[]> {
  if (cachedPriceProfiles && cachedPriceProfiles.length > 0) {
    return cachedPriceProfiles;
  }

  try {
    const result = await database.execute(
      `SELECT id, name, slug, category, category_label, is_default FROM price_profiles ORDER BY id ASC`,
    );
    const bySlug = new Map(
      result.rows.map((row) => [
        row.slug as string,
        {
          id: row.id as number,
          name: row.name as string,
          slug: row.slug as string,
          category:
            (row.category as ServerCategory) ||
            UNITY_SERVER_PROFILES.find((p) => p.slug === row.slug)?.category ||
            "monocuenta_clasico",
          categoryLabel:
            (row.category_label as string) ||
            UNITY_SERVER_PROFILES.find((p) => p.slug === row.slug)?.categoryLabel ||
            "Monocuenta Clásico",
          isDefault: (row.is_default as number) === 1,
        } as PriceProfile,
      ]),
    );
    const profilesList: PriceProfile[] = [];
    for (const profile of UNITY_SERVER_PROFILES) {
      const existing = bySlug.get(profile.slug);
      if (existing) {
        profilesList.push({
          ...existing,
          name: profile.name,
          category: profile.category,
          categoryLabel: profile.categoryLabel,
        });
      }
    }
    if (profilesList.length > 0) {
      cachedPriceProfiles = profilesList;
      return profilesList;
    }
  } catch (err) {
    console.warn("[getPriceProfiles] Database query warning (using default list):", err);
  }

  const fallbackList = UNITY_SERVER_PROFILES.map((p, idx) => ({
    id: idx + 1,
    name: p.name,
    slug: p.slug,
    category: p.category,
    categoryLabel: p.categoryLabel,
    isDefault: !!p.isDefault,
  }));
  cachedPriceProfiles = fallbackList;
  return fallbackList;
}

export async function ensureDefaultPriceProfile(): Promise<PriceProfile> {
  if (cachedPriceProfiles && cachedPriceProfiles.length > 0) {
    const def = cachedPriceProfiles.find((p) => p.isDefault) || cachedPriceProfiles[0];
    if (def) return def;
  }

  // Migrar slug oruka a orukam si está presente
  try {
    await database.execute(
      "UPDATE price_profiles SET slug = 'orukam', name = 'Orukam', category = 'multicuenta_clasico', category_label = 'Multicuenta Clásico' WHERE slug = 'oruka'"
    );
  } catch {}

  const validSlugs = UNITY_SERVER_PROFILES.map((p) => p.slug);
  const placeholders = validSlugs.map(() => "?").join(",");

  // Limpiar perfiles antiguos no deseados
  try {
    await database.execute({
      sql: `DELETE FROM profile_prices WHERE profile_id IN (SELECT id FROM price_profiles WHERE slug NOT IN (${placeholders}))`,
      args: validSlugs,
    });
    await database.execute({
      sql: `DELETE FROM price_profiles WHERE slug NOT IN (${placeholders})`,
      args: validSlugs,
    });
  } catch {}

  const existingResult = await database.execute(
    `SELECT id, name, slug, category, category_label, is_default FROM price_profiles ORDER BY id ASC`,
  );
  const existingSlugs = new Set(existingResult.rows.map((r) => r.slug as string));

  const now = Date.now();
  const statements = [];
  for (const profile of UNITY_SERVER_PROFILES) {
    if (!existingSlugs.has(profile.slug)) {
      statements.push({
        sql: `INSERT OR IGNORE INTO price_profiles (name, slug, category, category_label, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          profile.name,
          profile.slug,
          profile.category,
          profile.categoryLabel,
          profile.isDefault ? 1 : 0,
          now,
          now,
        ],
      });
    } else {
      statements.push({
        sql: `UPDATE price_profiles SET name = ?, category = ?, category_label = ?, updated_at = ? WHERE slug = ?`,
        args: [profile.name, profile.category, profile.categoryLabel, now, profile.slug],
      });
    }
  }

  if (statements.length > 0) await database.batch(statements, "write");

  const defaultSlug = UNITY_SERVER_PROFILES.find((p) => p.isDefault)?.slug || "draconiros";
  const hasDefault = existingResult.rows.some((r) => (r.is_default as number) === 1);
  if (!hasDefault) {
    await database.execute({
      sql: "UPDATE price_profiles SET is_default = CASE WHEN slug = ? THEN 1 ELSE 0 END",
      args: [defaultSlug],
    });
  }

  const insertedResult = await database.execute({
    sql: "SELECT id, name, slug, category, category_label, is_default FROM price_profiles WHERE slug = ? LIMIT 1",
    args: [defaultSlug],
  });
  const inserted = insertedResult?.rows?.[0];
  if (!inserted) {
    return {
      id: 1,
      name: "Draconiros",
      slug: "draconiros",
      category: "monocuenta_clasico",
      categoryLabel: "Monocuenta Clásico",
      isDefault: true,
    };
  }
  const defaultProfileObj: PriceProfile = {
    id: inserted.id as number,
    name: inserted.name as string,
    slug: inserted.slug as string,
    category: (inserted.category as ServerCategory) || "monocuenta_clasico",
    categoryLabel: (inserted.category_label as string) || "Monocuenta Clásico",
    isDefault: (inserted.is_default as number) === 1,
  };
  cachedPriceProfiles = null;
  return defaultProfileObj;
}

export async function getActivePriceProfileId(): Promise<number> {
  if (cachedActivePriceProfileId !== null) {
    return cachedActivePriceProfileId;
  }

  const defaultProfile = await ensureDefaultPriceProfile();
  const profiles = await getPriceProfiles();
  const visibleProfileIds = new Set(profiles.map((p) => p.id));
  const storedProfileId = await getMetaValue<number>("active_price_profile_id");
  if (storedProfileId && visibleProfileIds.has(storedProfileId)) {
    cachedActivePriceProfileId = storedProfileId;
    return storedProfileId;
  }
  await setMetaValue("active_price_profile_id", defaultProfile.id);
  cachedActivePriceProfileId = defaultProfile.id;
  return defaultProfile.id;
}

export async function setActivePriceProfileId(profileId: number): Promise<number> {
  const profiles = await getPriceProfiles();
  if (!profiles.some((p) => p.id === profileId))
    throw new Error("Perfil de precios no encontrado.");
  await setMetaValue("active_price_profile_id", profileId);
  cachedActivePriceProfileId = profileId;
  return profileId;
}

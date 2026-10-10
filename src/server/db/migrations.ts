import { database } from "./connection";
import { ensureDefaultPriceProfile } from "./serverProfiles";
import { ensureRunesInDatabase } from "./queries/items";

let initDbPromise: Promise<void> | null = null;

export async function initDB(): Promise<void> {
  if (initDbPromise) return initDbPromise;

  initDbPromise = (async () => {
    try {
      // Pragmas for fast reads (only for local SQLite)
      try {
        await database.execute("PRAGMA journal_mode = WAL;");
        await database.execute("PRAGMA synchronous = NORMAL;");
        await database.execute("PRAGMA temp_store = MEMORY;");
      } catch {
        // Ignored for remote HTTP LibSQL/Turso
      }

      await database.executeMultiple(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY,
          level INTEGER NOT NULL DEFAULT 1,
          type_id INTEGER NOT NULL DEFAULT 0,
          super_category_id INTEGER NOT NULL DEFAULT 0,
          icon_id INTEGER NOT NULL DEFAULT 0,
          name_es TEXT NOT NULL DEFAULT '',
          has_recipe INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS item_stats (
          item_id INTEGER NOT NULL,
          rune_id INTEGER NOT NULL,
          stat_order INTEGER NOT NULL DEFAULT 0,
          characteristic_id INTEGER NOT NULL DEFAULT 0,
          effect_id INTEGER NOT NULL DEFAULT 0,
          rune_name TEXT NOT NULL,
          rune_weight REAL NOT NULL,
          stat_min REAL NOT NULL,
          stat_max REAL NOT NULL,
          stat_avg REAL NOT NULL,
          formatted_text TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (item_id, rune_id)
        );

        CREATE TABLE IF NOT EXISTS recipes (
          result_id INTEGER PRIMARY KEY,
          job_id INTEGER,
          payload_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          recipe_id INTEGER NOT NULL,
          ingredient_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          PRIMARY KEY (recipe_id, ingredient_id)
        );

        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS price_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL DEFAULT 'monocuenta_clasico',
          category_label TEXT NOT NULL DEFAULT 'Monocuenta Clásico',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS profile_prices (
          profile_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          price INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (profile_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS price_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          price INTEGER NOT NULL,
          old_price INTEGER NOT NULL DEFAULT 0,
          difference INTEGER NOT NULL DEFAULT 0,
          percentage_change REAL NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'manual',
          timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS profile_coefficients (
          profile_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          coefficient INTEGER NOT NULL DEFAULT 100,
          updated_at INTEGER NOT NULL,
          is_manual INTEGER NOT NULL DEFAULT 0,
          manual_updated_at INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (profile_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS profile_sales_volume (
          profile_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          sales_24h INTEGER,
          sales_7d INTEGER,
          sales_30d INTEGER,
          avg_daily_sales REAL,
          suggested_price INTEGER,
          price_strategy TEXT,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (profile_id, item_id)
        );

        CREATE INDEX IF NOT EXISTS idx_items_type_id ON items(type_id);
        CREATE INDEX IF NOT EXISTS idx_items_name_es ON items(name_es);
        CREATE INDEX IF NOT EXISTS idx_items_has_recipe ON items(has_recipe);
        CREATE INDEX IF NOT EXISTS idx_items_level ON items(level DESC);

        CREATE INDEX IF NOT EXISTS idx_item_stats_item ON item_stats(item_id);
        CREATE INDEX IF NOT EXISTS idx_item_stats_rune ON item_stats(rune_id);

        CREATE INDEX IF NOT EXISTS idx_recipes_job ON recipes(job_id);
        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

        CREATE INDEX IF NOT EXISTS idx_profile_prices_profile_id ON profile_prices(profile_id);
        CREATE INDEX IF NOT EXISTS idx_profile_prices_item_id ON profile_prices(item_id);
        CREATE INDEX IF NOT EXISTS idx_profile_prices_profile_updated ON profile_prices(profile_id, updated_at DESC);

        CREATE INDEX IF NOT EXISTS idx_profile_coefficients_profile_id ON profile_coefficients(profile_id);
        CREATE INDEX IF NOT EXISTS idx_profile_coefficients_profile_item ON profile_coefficients(profile_id, item_id);

        CREATE INDEX IF NOT EXISTS idx_profile_sales_volume_profile ON profile_sales_volume(profile_id);
        CREATE INDEX IF NOT EXISTS idx_profile_sales_volume_item ON profile_sales_volume(item_id);
        CREATE INDEX IF NOT EXISTS idx_profile_sales_volume_updated ON profile_sales_volume(profile_id, updated_at DESC);

        CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(profile_id, item_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_price_history_time ON price_history(profile_id, timestamp DESC);

        CREATE TABLE IF NOT EXISTS dofus_tokens (
          token_type TEXT PRIMARY KEY,
          token_value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Ensure price profiles exist
      try {
        await ensureDefaultPriceProfile();
      } catch (err) {
        console.warn("[Database] ensureDefaultPriceProfile warning:", err);
      }

      // Purgar ídolos de misiones (tipo 289 / taller base) de la base de datos
      try {
        await database.execute(`
          DELETE FROM items WHERE type_id = 289 OR id IN (28431, 28432, 28444, 28445, 28446, 28447, 28448, 28449, 28450, 28451, 28452, 28453, 28455, 30049);
        `);
        await database.execute(`
          DELETE FROM recipes WHERE result_id IN (28431, 28432, 28444, 28445, 28446, 28447, 28448, 28449, 28450, 28451, 28452, 28453, 28455, 30049);
        `);
      } catch (err) {
        console.warn("[Database] Purge quest idols warning:", err);
      }

      // Ensure runes
      try {
        await ensureRunesInDatabase();
      } catch (err) {
        console.warn("[Database] ensureRunesInDatabase warning:", err);
      }

      // Ensure profile_coefficients columns for manual edits protection
      try {
        await database.execute("ALTER TABLE profile_coefficients ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0");
      } catch {}
      try {
        await database.execute("ALTER TABLE profile_coefficients ADD COLUMN manual_updated_at INTEGER NOT NULL DEFAULT 0");
      } catch {}

      // Limpiar precios corruptos / TypeID de categorías
      try {
        await database.execute(`
          DELETE FROM profile_prices
          WHERE item_id IN (985, 125, 211, 666)
        `);
        await database.execute(`
          UPDATE profile_prices
          SET price = 1362, updated_at = ${Date.now()}
          WHERE item_id = 31521 AND price <= 50
        `);
        await database.execute(`
          DELETE FROM profile_prices
          WHERE price <= 10 AND item_id IN (
            SELECT id FROM items WHERE level >= 10
          )
        `);
      } catch (cleanupErr) {
        console.warn("[Database] Cleanup corrupted prices warning:", cleanupErr);
      }

      console.log("[Database] Database initialized successfully.");
    } catch (e) {
      console.warn("[Database] Initialization warning (running in resilience mode):", e);
    }
  })();

  return initDbPromise;
}

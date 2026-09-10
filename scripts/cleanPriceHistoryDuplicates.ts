import "dotenv/config";
import { database, initDB } from "../src/server/localDataStore";

async function cleanPriceHistory() {
  console.log("[CleanPriceHistory] Conectando a la base de datos...");
  await initDB();

  const totalBeforeRes = await database.execute("SELECT COUNT(*) as count FROM price_history");
  const totalBefore = Number(totalBeforeRes.rows[0].count);
  console.log(`[CleanPriceHistory] Total de registros actuales en price_history: ${totalBefore}`);

  // 1. Obtener todos los registros en una sola consulta ordenada
  const allRowsRes = await database.execute(`
    SELECT id, profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp 
    FROM price_history
    ORDER BY profile_id ASC, item_id ASC, timestamp ASC, id ASC
  `);
  console.log(`[CleanPriceHistory] Descargados ${allRowsRes.rows.length} registros para procesar en memoria.`);

  const idsToDelete: number[] = [];
  const updatesToApply: Array<{
    id: number;
    oldPrice: number;
    diff: number;
    pct: number;
  }> = [];

  let currentKey = "";
  let lastPrice = 0;

  for (const r of allRowsRes.rows) {
    const id = Number(r.id);
    const profileId = Number(r.profile_id);
    const itemId = Number(r.item_id);
    const price = Number(r.price);
    const oldPrice = Number(r.old_price);
    const diff = Number(r.difference);
    const key = `${profileId}:${itemId}`;

    if (key !== currentKey) {
      currentKey = key;
      lastPrice = price;
      continue;
    }

    // Mismo ítem y perfil:
    // Si el precio es idéntico al anterior y la diferencia es 0, es un log redundante del sniffer
    if (price === lastPrice && diff === 0) {
      idsToDelete.push(id);
      continue;
    }

    // Si el precio cambió pero old_price o diff eran 0 por el bug previo
    if (lastPrice > 0 && (oldPrice === 0 || diff === 0) && price !== lastPrice) {
      const correctOld = lastPrice;
      const correctDiff = price - lastPrice;
      const correctPct = Number((((price - lastPrice) / lastPrice) * 100).toFixed(2));
      updatesToApply.push({
        id,
        oldPrice: correctOld,
        diff: correctDiff,
        pct: correctPct,
      });
    }

    lastPrice = price;
  }

  console.log(`[CleanPriceHistory] Registros redundantes a eliminar: ${idsToDelete.length}`);
  console.log(`[CleanPriceHistory] Registros con old_price a corregir: ${updatesToApply.length}`);

  // 2. Ejecutar eliminaciones en lotes de 250
  if (idsToDelete.length > 0) {
    const CHUNK = 250;
    for (let i = 0; i < idsToDelete.length; i += CHUNK) {
      const chunk = idsToDelete.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => "?").join(",");
      await database.execute({
        sql: `DELETE FROM price_history WHERE id IN (${placeholders})`,
        args: chunk,
      });
      process.stdout.write(`\rEliminando duplicados: ${Math.min(i + CHUNK, idsToDelete.length)} / ${idsToDelete.length}...`);
    }
    console.log("\n[CleanPriceHistory] Eliminaciones completadas con éxito.");
  }

  // 3. Ejecutar correcciones en lotes de 200
  if (updatesToApply.length > 0) {
    const statements = updatesToApply.map((u) => ({
      sql: `UPDATE price_history SET old_price = ?, difference = ?, percentage_change = ? WHERE id = ?`,
      args: [u.oldPrice, u.diff, u.pct, u.id],
    }));

    for (let i = 0; i < statements.length; i += 200) {
      const chunk = statements.slice(i, i + 200);
      await database.batch(chunk, "write");
      process.stdout.write(`\rActualizando diferencias: ${Math.min(i + 200, statements.length)} / ${statements.length}...`);
    }
    console.log("\n[CleanPriceHistory] Correcciones de diferencias completadas.");
  }

  const totalAfterRes = await database.execute("SELECT COUNT(*) as count FROM price_history");
  const totalAfter = Number(totalAfterRes.rows[0].count);
  console.log(`[CleanPriceHistory] Total final de registros en price_history: ${totalAfter} (Se redujeron ${totalBefore - totalAfter} duplicados)`);
}

cleanPriceHistory().catch((err) => {
  console.error("[CleanPriceHistory Error]:", err);
  process.exit(1);
});

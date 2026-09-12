import test from "node:test";
import assert from "node:assert/strict";
import {
  levelToXp,
  xpToLevel,
  getCraftXpByJobLevel,
  getNextMilestoneLevel,
  calculateLevelTiers,
  simulateCraftBatch,
  simulateCraftsUntilLevel,
  calculateOptimizedCraftCost,
  recalculateSelectedCraftsSequence,
  calculateSummary,
  SUPPORTED_JOB_IDS,
  isQuestOrZeroXpCraft,
  generateOptimizedPhases,
} from "../src/services/jobLevelingService.js";

// Setup mock window and localStorage for headless Node environment
const mockStorage: Record<string, string> = {};
(global as any).window = {
  dispatchEvent: () => true,
};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
};

test("Curva de XP acumulada oficial de Dofus (levelToXp)", () => {
  // Nivel 1: 0 XP
  assert.equal(levelToXp(1), 0);
  // Nivel 2: 2 * 1 * 10 = 20 XP
  assert.equal(levelToXp(2), 20);
  // Nivel 10: 10 * 9 * 10 = 900 XP
  assert.equal(levelToXp(10), 900);
  // Nivel 50: 50 * 49 * 10 = 24,500 XP
  assert.equal(levelToXp(50), 24500);
  // Nivel 100: 100 * 99 * 10 = 99,000 XP
  assert.equal(levelToXp(100), 99000);
  // Nivel 188: 188 * 187 * 10 = 351,560 XP
  assert.equal(levelToXp(188), 351560);
  // Nivel 189: 189 * 188 * 10 = 355,320 XP
  assert.equal(levelToXp(189), 355320);
  // Nivel 190: 190 * 189 * 10 = 359,100 XP
  assert.equal(levelToXp(190), 359100);
  // Nivel 200: 200 * 199 * 10 = 398,000 XP
  assert.equal(levelToXp(200), 398000);
});

test("Inversa exacta de la curva de XP (xpToLevel)", () => {
  assert.equal(xpToLevel(0), 1);
  assert.equal(xpToLevel(19), 1);
  assert.equal(xpToLevel(20), 2);
  assert.equal(xpToLevel(900), 10);
  assert.equal(xpToLevel(99000), 100);
  assert.equal(xpToLevel(351560), 188);
  assert.equal(xpToLevel(355320), 189);
  assert.equal(xpToLevel(359100), 190);
  assert.equal(xpToLevel(398000), 200);
  assert.equal(xpToLevel(500000), 200); // Clamped at 200
});

test("Cálculo de XP por receta y decaimiento dinámico (getCraftXpByJobLevel)", () => {
  const recipeLevel = 20;

  // A nivel igual o menor de la receta (20): base pura = 20 * 20 = 400 XP
  const xpAtLevel20 = getCraftXpByJobLevel(recipeLevel, 20);
  assert.equal(xpAtLevel20, 400);

  // Al subir de nivel, la experiencia recibida decae paulatinamente
  const xpAtLevel40 = getCraftXpByJobLevel(recipeLevel, 40);
  assert.ok(xpAtLevel40 < xpAtLevel20);
  assert.ok(xpAtLevel40 > 0);

  const xpAtLevel100 = getCraftXpByJobLevel(recipeLevel, 100);
  assert.ok(xpAtLevel100 < xpAtLevel40);
  assert.ok(xpAtLevel100 > 0);

  // A más de 100 niveles por encima (121 - 100 > 20): otorga exactamente 0 XP
  const xpAtLevel121 = getCraftXpByJobLevel(recipeLevel, 121);
  assert.equal(xpAtLevel121, 0);

  // Multiplicador de XP (Almanax 2x / Bonus pack)
  const xpBoosted = getCraftXpByJobLevel(recipeLevel, 20, 2.0);
  assert.equal(xpBoosted, 800);
});

test("CASO DOFUSDB VERIFICADO: 3x Congelorra (Lvl 188) de Nivel 188 a 190 da exactamente 10,596 XP", () => {
  const startXp = levelToXp(188); // 351,560 XP
  const recipeLevel = 188;

  // Simular 3 crafteos
  const sim = simulateCraftBatch(startXp, recipeLevel, 3);

  // Verificación exacta contra DofusDB:
  // Craft 1 (a nivel 188): da 3,760 XP -> sube a nivel 189
  // Craft 2 (a nivel 189): con decaimiento da 3,418 XP
  // Craft 3 (a nivel 189): con decaimiento da 3,418 XP
  // Total: 3760 + 3418 + 3418 = 10,596 XP!
  assert.equal(sim.totalXpEarned, 10596);
  assert.equal(sim.finalLevel, 190);
  assert.equal(sim.finalXp, startXp + 10596);

  // Simular botón "-> 190" (simulateCraftsUntilLevel)
  const until190 = simulateCraftsUntilLevel(startXp, recipeLevel, 190);
  assert.equal(until190.amountNeeded, 3);
  assert.equal(until190.totalXpEarned, 10596);
  assert.equal(until190.finalLevel, 190);
});

test("Cálculo del siguiente hito decadal (getNextMilestoneLevel)", () => {
  assert.equal(getNextMilestoneLevel(1), 10);
  assert.equal(getNextMilestoneLevel(10), 20);
  assert.equal(getNextMilestoneLevel(43), 50);
  assert.equal(getNextMilestoneLevel(188), 190);
  assert.equal(getNextMilestoneLevel(195), 200);
  assert.equal(getNextMilestoneLevel(200), 200);
});

test("Segmentación en tramos de niveles decadales (calculateLevelTiers)", () => {
  // De nivel intermedio a siguiente hito (43 -> 50): 1 tramo
  const tiers43to50 = calculateLevelTiers(43, 50);
  assert.equal(tiers43to50.length, 1);
  assert.equal(tiers43to50[0].fromLevel, 43);
  assert.equal(tiers43to50[0].toLevel, 50);
  assert.equal(tiers43to50[0].requiredXp, levelToXp(50) - levelToXp(43));

  // De 43 a 75: 4 tramos (43->50, 50->60, 60->70, 70->75)
  const tiers43to75 = calculateLevelTiers(43, 75);
  assert.equal(tiers43to75.length, 4);
  assert.equal(tiers43to75[0].fromLevel, 43);
  assert.equal(tiers43to75[0].toLevel, 50);
  assert.equal(tiers43to75[1].fromLevel, 50);
  assert.equal(tiers43to75[1].toLevel, 60);
  assert.equal(tiers43to75[2].fromLevel, 60);
  assert.equal(tiers43to75[2].toLevel, 70);
  assert.equal(tiers43to75[3].fromLevel, 70);
  assert.equal(tiers43to75[3].toLevel, 75);

  // De 188 a 190: 1 tramo
  const tiers188to190 = calculateLevelTiers(188, 190);
  assert.equal(tiers188to190.length, 1);
  assert.equal(tiers188to190[0].fromLevel, 188);
  assert.equal(tiers188to190[0].toLevel, 190);

  // De 188 a 200: 2 tramos (188->190, 190->200)
  const tiers188to200 = calculateLevelTiers(188, 200);
  assert.equal(tiers188to200.length, 2);
  assert.equal(tiers188to200[0].fromLevel, 188);
  assert.equal(tiers188to200[0].toLevel, 190);
  assert.equal(tiers188to200[1].fromLevel, 190);
  assert.equal(tiers188to200[1].toLevel, 200);
});

test("Verifica que los 14 oficios (incluido Ganadero 101) estén en SUPPORTED_JOB_IDS", () => {
  assert.ok(SUPPORTED_JOB_IDS.includes(101)); // Ganadero
  assert.ok(SUPPORTED_JOB_IDS.includes(26));  // Alquimista
  assert.ok(SUPPORTED_JOB_IDS.includes(28));  // Campesino
  assert.ok(SUPPORTED_JOB_IDS.includes(41));  // Cazador
  assert.ok(SUPPORTED_JOB_IDS.includes(2));   // Leñador
  assert.ok(SUPPORTED_JOB_IDS.includes(24));  // Minero
  assert.ok(SUPPORTED_JOB_IDS.includes(36));  // Pescador
  assert.ok(SUPPORTED_JOB_IDS.includes(16));  // Joyero
  assert.ok(SUPPORTED_JOB_IDS.includes(27));  // Sastre
  assert.ok(SUPPORTED_JOB_IDS.includes(15));  // Zapatero
  assert.ok(SUPPORTED_JOB_IDS.includes(11));  // Herrero
  assert.ok(SUPPORTED_JOB_IDS.includes(13));  // Escultor
  assert.ok(SUPPORTED_JOB_IDS.includes(60));  // Fabricante
  assert.ok(SUPPORTED_JOB_IDS.includes(65));  // Manitas
  assert.equal(SUPPORTED_JOB_IDS.length, 14);
});

test("Retorno económico de Sebuscalines en crafteos de Busca y Captura (ByC)", () => {
  // Recurso 15551 (Botella de Lonyon) -> Da 1020 Sebuscalines en cofre
  // Fragmentos: 15383 a 15390 (8 fragmentos)
  const fakeRecipe = {
    id: 99999,
    resultId: 99999,
    resultName: "Equipo Legendario de Prueba",
    level: 200,
    ingredientIds: [15551],
    quantities: [1],
  };

  // CASO A: Fragmentos son más baratos que compra directa (Ruta Óptima = Fragmentos)
  // Directo = 1,000,000 k. 8 Fragmentos = 50,000 k cada uno = 400,000 k total.
  const pricesRouteFragments: Record<number, number> = {
    15551: 1000000,
    15383: 50000,
    15384: 50000,
    15385: 50000,
    15386: 50000,
    15387: 50000,
    15388: 50000,
    15389: 50000,
    15390: 50000,
  };

  const costInfoFragments = calculateOptimizedCraftCost(fakeRecipe as any, pricesRouteFragments);
  assert.equal(costInfoFragments.cost, 400000);
  assert.equal(costInfoFragments.requiresByc, true);
  // Al ser ruta de fragmentos, el jugador hace la cacería y gana 1020 Sebuscalines
  assert.equal(costInfoFragments.sebuscalinesEarned, 1020);
  assert.equal(costInfoFragments.sebuscalinesValue, 1020 * costInfoFragments.sebuscalinUnitPrice);

  // CASO B: Compra directa en mercadillo es más barata que fragmentos (Ruta Óptima = Directo)
  // Directo = 250,000 k. Fragmentos = 400,000 k total.
  const pricesRouteDirect: Record<number, number> = {
    ...pricesRouteFragments,
    15551: 250000,
  };

  const costInfoDirect = calculateOptimizedCraftCost(fakeRecipe as any, pricesRouteDirect);
  assert.equal(costInfoDirect.cost, 250000);
  assert.equal(costInfoDirect.requiresByc, true);
  // Al comprar directo en HDV, no se hace la cacería ni se obtienen Sebuscalines
  assert.equal(costInfoDirect.sebuscalinesEarned, 0);
  assert.equal(costInfoDirect.sebuscalinesValue, 0);

  // CASO C: Recalcular secuencia y verificar que profitUnit suma el valor de Sebuscalines
  const crafts = [
    {
      recipe: fakeRecipe as any,
      item: { id: 99999, level: 200, name: "Equipo Legendario" } as any,
      amount: 2,
    },
  ];

  // Supongamos que el equipo se vende a 500,000 k en HDV
  (global as any).localStorage.setItem("dofus_sebuscalin_unit_price_v1", "320");
  pricesRouteFragments[99999] = 500000;

  const seq = recalculateSelectedCraftsSequence(0, crafts, 1.0, false, pricesRouteFragments);
  const entry = seq.updatedEntries[0];

  assert.equal(entry.amount, 2);
  assert.equal(entry.craftCostUnit, 400000);
  assert.equal(entry.netSaleUnit, Math.floor(500000 * 0.98)); // 490,000
  assert.equal(entry.sebuscalinesPerCraft, 1020);
  assert.equal(entry.totalSebuscalines, 2040); // 2 crafts * 1020
  assert.equal(entry.sebuscalinesValueUnit, 1020 * 320); // 326,400 k
  assert.equal(entry.totalSebuscalinesValue, 2040 * 320); // 652,800 k

  // Retorno total unitario = 490,000 + 326,400 = 816,400 k
  assert.equal(entry.totalRevenueUnit, 490000 + 326400);
  // Beneficio unitario = 816,400 - 400,000 = 416,400 k (en vez de solo 90,000 si no se contaran los Sebuscalines)
  assert.equal(entry.profitUnit, (490000 + 326400) - 400000);

  // CASO D: calculateSummary refleja los Sebuscalines y retorno total acumulado
  const summary = calculateSummary(seq.updatedEntries, seq.finalXp);
  assert.equal(summary.totalCrafts, 2);
  assert.equal(summary.totalInvestment, 800000);
  assert.equal(summary.totalSebuscalines, 2040);
  assert.equal(summary.totalSebuscalinesValue, 652800);
  assert.equal(summary.totalNetRevenue, 2 * (490000 + 326400));
  assert.equal(summary.netProfitOrLoss, summary.totalNetRevenue - summary.totalInvestment);
});

test("Detección estricta de ítems de misión y crafteos sin XP (isQuestOrZeroXpCraft)", () => {
  // 1. Ítem 10272 (Máscara de Sag) reportado por el usuario
  assert.equal(isQuestOrZeroXpCraft({ id: 10272 }), true);
  assert.equal(
    isQuestOrZeroXpCraft({
      id: 10272,
      name: { es: "Máscara de Sag" } as any,
      craftXpRatio: 0,
      craftConditionalCriterion: "((Qa=457&Qo>3110)|(Qa=332&Qo>10373))",
    }),
    true
  );

  // 2. Cualquier ítem o receta con craftXpRatio = 0
  assert.equal(isQuestOrZeroXpCraft({ id: 9312, craftXpRatio: 0 }), true);
  assert.equal(isQuestOrZeroXpCraft(null, { resultId: 9999, craftXpRatio: 0 } as any), true);

  // 3. Crafteos que requieren misiones activas (Qa= / Qo= / Qf=)
  assert.equal(
    isQuestOrZeroXpCraft({
      id: 88888,
      craftConditionalCriterion: "(Qa=1728&Qo>10933)",
    }),
    true
  );

  // 4. Objetos en categorías o supertipos de misión
  assert.equal(isQuestOrZeroXpCraft({ id: 77777, typeId: 126 }), true);
  assert.equal(isQuestOrZeroXpCraft({ id: 77777, type: { superTypeId: 14 } as any }), true);
  assert.equal(isQuestOrZeroXpCraft({ id: 77777, type: { superCategoryId: 4 } as any }), true);

  // 5. Ítems normales NO deben ser clasificados como misión
  assert.equal(isQuestOrZeroXpCraft({ id: 2416, level: 200, name: "Congelorra" as any }), false);
  assert.equal(isQuestOrZeroXpCraft({ id: 2469, level: 1, name: "Sombrero Pío Azul" as any }), false);
});

test("getCraftXpByJobLevel y simulaciones otorgan estrictamente 0 XP para crafteos con craftXpRatio = 0", () => {
  // Sin ratio (default 1.0) da 3600 XP en nivel 180
  const normalXp = getCraftXpByJobLevel(180, 180, 1.0, 1.0);
  assert.equal(normalXp, 3600);

  // Máscara de Sag (craftXpRatio = 0) da exactamente 0 XP
  const zeroXp = getCraftXpByJobLevel(180, 180, 1.0, 0);
  assert.equal(zeroXp, 0);

  // simulateCraftBatch con ratio 0 retorna 0 XP ganado
  const batchSim = simulateCraftBatch(10000, 180, 5, 1.0, false, 0);
  assert.equal(batchSim.totalXpEarned, 0);
  assert.equal(batchSim.finalXp, 10000);

  // simulateCraftsUntilLevel con ratio 0 retorna 0 crafts y 0 XP
  const untilSim = simulateCraftsUntilLevel(10000, 180, 190, 1.0, false, 0);
  assert.equal(untilSim.amountNeeded, 0);
  assert.equal(untilSim.totalXpEarned, 0);
});

test("recalculateSelectedCraftsSequence asigna 0 XP a Máscara de Sag y crafteos de misión", () => {
  const sagCraft = {
    recipe: {
      id: 10272,
      resultId: 10272,
      ingredientIds: [7035, 426],
      quantities: [2, 20],
      craftXpRatio: 0,
    } as any,
    item: {
      id: 10272,
      level: 180,
      name: { es: "Máscara de Sag" },
      craftXpRatio: 0,
      craftConditionalCriterion: "((Qa=457&Qo>3110)|(Qa=332&Qo>10373))",
    } as any,
    amount: 2,
  };

  const seq = recalculateSelectedCraftsSequence(100000, [sagCraft], 1.0, false, { 7035: 100, 426: 50 });
  assert.equal(seq.updatedEntries.length, 1);
  assert.equal(seq.updatedEntries[0].xpGained, 0);
  assert.equal(seq.finalXp, 100000); // No avanza nada de XP
});



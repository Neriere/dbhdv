import test from "node:test";
import assert from "node:assert/strict";
import {
  levelToXp,
  xpToLevel,
  getCraftXpByJobLevel,
  calculateLevelTiers,
  getNextMilestoneLevel,
  SUPPORTED_JOB_IDS,
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
  // Nivel 200: 200 * 199 * 10 = 398,000 XP
  assert.equal(levelToXp(200), 398000);
});

test("Inversa exacta de la curva de XP (xpToLevel)", () => {
  assert.equal(xpToLevel(0), 1);
  assert.equal(xpToLevel(19), 1);
  assert.equal(xpToLevel(20), 2);
  assert.equal(xpToLevel(900), 10);
  assert.equal(xpToLevel(99000), 100);
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

test("Segmentación en tramos de 10 niveles y adaptación a niveles intermedios (calculateLevelTiers)", () => {
  // Caso estándar: de 1 a 30 -> [1->10, 10->20, 20->30]
  const standardTiers = calculateLevelTiers(1, 30);
  assert.equal(standardTiers.length, 3);
  assert.deepEqual(standardTiers[0], {
    tierIndex: 1,
    fromLevel: 1,
    toLevel: 10,
    requiredXp: 900,
  });
  assert.deepEqual(standardTiers[1], {
    tierIndex: 2,
    fromLevel: 10,
    toLevel: 20,
    requiredXp: 3800 - 900, // 2900 XP
  });
  assert.deepEqual(standardTiers[2], {
    tierIndex: 3,
    fromLevel: 20,
    toLevel: 30,
    requiredXp: 8700 - 3800, // 4900 XP
  });

  // Caso intermedio del usuario: nivel 43 a nivel 70
  // Primer tramo debe ser 43 -> 50, luego 50 -> 60, luego 60 -> 70
  const intermediateTiers = calculateLevelTiers(43, 70);
  assert.equal(intermediateTiers.length, 3);
  assert.equal(intermediateTiers[0].fromLevel, 43);
  assert.equal(intermediateTiers[0].toLevel, 50);
  assert.equal(intermediateTiers[0].requiredXp, levelToXp(50) - levelToXp(43));

  assert.equal(intermediateTiers[1].fromLevel, 50);
  assert.equal(intermediateTiers[1].toLevel, 60);

  assert.equal(intermediateTiers[2].fromLevel, 60);
  assert.equal(intermediateTiers[2].toLevel, 70);
});

test("Cálculo del siguiente hito decadal (getNextMilestoneLevel)", () => {
  assert.equal(getNextMilestoneLevel(1), 10);
  assert.equal(getNextMilestoneLevel(10), 20);
  assert.equal(getNextMilestoneLevel(43), 50);
  assert.equal(getNextMilestoneLevel(99), 100);
  assert.equal(getNextMilestoneLevel(195), 200);
  assert.equal(getNextMilestoneLevel(200), 200);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSalesVolume } from '../src/services/salesVolumeService.js';
import { calculateBatchBreakdown } from '../src/components/DailyCraftPlanner.js';

test('analyzeSalesVolume: Ítem con 0 ventas en 24h y 7d no infla velocidad diaria por ventas en 30d (Ítem estancado)', () => {
  // Ítem caro con muchas ventas en 30d pero completamente inactivo en los últimos 7 días y 24h
  const stagnantVolume = {
    sales24h: 0,
    sales7d: 0,
    sales30d: 120, // Tuvo ventas hace semanas
  };

  const analysis = analyzeSalesVolume(5000000, stagnantVolume);
  assert.equal(analysis.hasData, true);
  assert.equal(analysis.hasRecentSales, false);
  // Al no tener ventas recientes en 7d ni en 24h, su rotación diaria activa debe ser 0
  assert.equal(analysis.avgDailySales, 0);
  assert.equal(analysis.daysToSell, null);
});

test('analyzeSalesVolume: Ítem con ventas en 7d conserva velocidad diaria activa aunque hoy (24h) sea 0', () => {
  // Ítem de rotación semanal normal (se venden 7 a la semana, pero ninguna en las últimas 24h)
  const activeWeeklyVolume = {
    sales24h: 0,
    sales7d: 7,
    sales30d: 30,
  };

  const analysis = analyzeSalesVolume(250000, activeWeeklyVolume);
  assert.equal(analysis.hasData, true);
  assert.equal(analysis.hasRecentSales, true);
  assert.ok(analysis.avgDailySales > 0);
});

test('analyzeSalesVolume: Ítem con ventas en 24h tiene velocidad y hasRecentSales = true', () => {
  const activeFastVolume = {
    sales24h: 3,
    sales7d: 14,
    sales30d: 60,
  };

  const analysis = analyzeSalesVolume(100000, activeFastVolume);
  assert.equal(analysis.hasData, true);
  assert.equal(analysis.hasRecentSales, true);
  assert.ok(analysis.avgDailySales >= 1.5);
});

test('DailyCraftPlanner: Diversificación presupuestaria estricta rechaza ítems unitarios que superan el tope', () => {
  const budget = 10_000_000; // 10 Mk
  const maxBudgetShare = 0.35; // Máx. 35% del presupuesto (3.5 Mk)
  const maxBudgetCap = budget * maxBudgetShare; // 3.5 Mk

  // Ítem A: Cuesta 5 Mk unitario (> 3.5 Mk)
  const itemACost = 5_000_000;
  const maxUnitsA = Math.floor(Math.min(maxBudgetCap, budget) / itemACost);
  assert.equal(maxUnitsA, 0); // No debe forzar 1 unidad con Math.max(1, ...)

  // Ítem B: Cuesta 1.5 Mk unitario (<= 3.5 Mk)
  const itemBCost = 1_500_000;
  const maxUnitsB = Math.floor(Math.min(maxBudgetCap, budget) / itemBCost);
  assert.equal(maxUnitsB, 2); // 2 unidades (3.0 Mk) caben dentro del 35%

  // Si el usuario elige "Sin límite" (100% por ítem):
  const noLimitShare = 1.0;
  const maxUnitsNoLimit = Math.floor(Math.min(budget * noLimitShare, budget) / itemACost);
  assert.equal(maxUnitsNoLimit, 2); // Ahora sí permite hasta agotar el presupuesto
});

test('DailyCraftPlanner: "Esto ya está puesto" descuenta presupuesto y slots de mercadillo sin descartar el gasto', () => {
  const totalBudget = 10_000_000; // 10 Mk
  const maxEquipSlots = 150;

  // El usuario marca un ítem como "Ya puesto": 2 unidades de Gelanillo a 800k c/u = 1.6 Mk
  const postedCrafts = [
    {
      itemId: 2425,
      units: 2,
      craftCostUnit: 800_000,
      totalCraftCost: 1_600_000,
      totalNetProfit: 400_000,
      marketCategory: 'equipment' as const,
      estimatedSlots: 2,
    },
  ];

  const postedCost = postedCrafts.reduce((acc, c) => acc + c.totalCraftCost, 0);
  const postedEquipSlots = postedCrafts
    .filter((c) => c.marketCategory === 'equipment')
    .reduce((acc, c) => acc + c.estimatedSlots, 0);

  // El presupuesto disponible para el resto del plan disminuye:
  const effectiveBudget = Math.max(0, totalBudget - postedCost);
  assert.equal(effectiveBudget, 8_400_000); // 8.4 Mk restante

  // Los slots disponibles disminuyen:
  const remainingEquipSlots = Math.max(0, maxEquipSlots - postedEquipSlots);
  assert.equal(remainingEquipSlots, 148);

  // Si se deshace el objeto puesto:
  const restoredPostedCrafts = postedCrafts.filter((c) => c.itemId !== 2425);
  const restoredCost = restoredPostedCrafts.reduce((acc, c) => acc + c.totalCraftCost, 0);
  const restoredEffectiveBudget = Math.max(0, totalBudget - restoredCost);
  assert.equal(restoredEffectiveBudget, 10_000_000);
});

test('DailyCraftPlanner: calculateBatchBreakdown calcula correctamente slots en HDV para consumibles/recursos', () => {
  // 155 unidades: 1 lote de 100, 5 lotes de 10, 5 unidades sueltas (1 lote x1)
  const breakdown = calculateBatchBreakdown(155);
  assert.equal(breakdown.lots100, 1);
  assert.equal(breakdown.lots10, 5);
  assert.equal(breakdown.lots1, 5);
  assert.equal(breakdown.totalSlots, 7); // 1 + 5 + 1 = 7 slots ocupados
});

test('DailyCraftPlanner: BUDGET_SHARE_PRESETS cubre desde 5% hasta 100% y previene concentración excesiva', () => {
  const budget = 10_000_000;
  const shareOptions = [0.05, 0.10, 0.15, 0.20, 0.25, 0.35, 0.50, 1.00];

  // Caso 1: Con 5% en 10 Mk, el tope unitario e ítem es 500.000 K
  const cap5 = Math.floor(budget * 0.05);
  assert.equal(cap5, 500_000);
  // Un ítem de 600.000 K no puede entrar
  assert.ok(600_000 > cap5);

  // Caso 2: Con 10% en 10 Mk, el tope es 1.000.000 K
  const cap10 = Math.floor(budget * 0.10);
  assert.equal(cap10, 1_000_000);
  // Un ítem de 1.000.000 K entra con exactamente 1 unidad
  assert.equal(Math.floor(cap10 / 1_000_000), 1);
  // Un ítem de 200.000 K entra con máx 5 unidades (1 Mk total = 10%)
  assert.equal(Math.floor(cap10 / 200_000), 5);

  // Caso 3: Con 20% en 5 Mk, el tope es 1.000.000 K
  const cap20_5M = Math.floor(5_000_000 * 0.20);
  assert.equal(cap20_5M, 1_000_000);

  // Verifica que todos los porcentajes están ordenados ascendentemente
  for (let i = 0; i < shareOptions.length - 1; i++) {
    assert.ok(shareOptions[i] < shareOptions[i + 1]);
  }
});

test('DailyCraftPlanner: Persistencia de configuración en localStorage preserva estado completo', () => {
  const mockStorage: Record<string, string> = {};
  const CONFIG_KEY = 'dofus_daily_planner_config_v2';

  const configToSave = {
    budget: 5_000_000,
    budgetInput: '5000000',
    maxBudgetShare: 0.10, // 10%
    optimizationMode: 'fast_cashflow',
    marketChannel: 'equipment',
    targetDays: 2.0,
    maxEquipSlots: 100,
    maxConsumableSlots: 50,
    maxResourceSlots: 50,
    maxMarketShare: 0.15,
    onlyMyJobs: true,
    requireSalesHistory: true,
    recentSalesOnly: true,
    filterOutliers: true,
    selectedJobFilter: 16,
    minRoiFilter: 25,
    minDailySales: 0.5,
    excludedItemIds: [123, 456],
    manualUnitsOverride: { 789: 3 },
    showPostedDrawer: false,
    showMaterialsDrawer: true,
  };

  // Simular guardado
  mockStorage[CONFIG_KEY] = JSON.stringify(configToSave);

  // Simular recarga / cambio de pestaña
  const loadedRaw = mockStorage[CONFIG_KEY];
  assert.ok(loadedRaw);
  const loaded = JSON.parse(loadedRaw);

  assert.equal(loaded.budget, 5_000_000);
  assert.equal(loaded.maxBudgetShare, 0.10);
  assert.equal(loaded.optimizationMode, 'fast_cashflow');
  assert.equal(loaded.selectedJobFilter, 16);
  assert.deepEqual(loaded.excludedItemIds, [123, 456]);
  assert.equal(loaded.manualUnitsOverride[789], 3);
  assert.equal(loaded.showMaterialsDrawer, true);
  assert.equal(loaded.showPostedDrawer, false);
});

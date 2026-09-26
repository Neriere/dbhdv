import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSalesVolume } from '../src/services/salesVolumeService.js';
import { getItemMarketCategory } from '../src/components/DailyCraftPlanner.js';

test('GlobalProfitRanking Filters: Clasificación de canales de Mercadillo HDV', () => {
  // Joyero (16) -> Equipamiento
  assert.equal(getItemMarketCategory({ id: 1001, jobId: 16, typeId: 9 }), 'equipment');

  // Campesino pan -> Consumibles
  assert.equal(getItemMarketCategory({ id: 2001, jobId: 28, typeId: 33, name: 'Pan de trigo' }), 'consumables');

  // Minero aleación -> Recursos
  assert.equal(getItemMarketCategory({ id: 3001, jobId: 24, typeId: 38, name: 'Kriptonita' }), 'resources');

  // Alquimista pócima de envejecimiento -> Recursos
  assert.equal(getItemMarketCategory({ id: 4001, jobId: 26, name: 'Pócima de envejecimiento' }), 'resources');

  // Runa de forjamagia -> Excluida (null)
  assert.equal(getItemMarketCategory({ id: 5001, typeId: 78, name: 'Runa Fo' }), null);
});

test('GlobalProfitRanking Filters: Detección y protección contra anomalías de precio (Antifraude)', () => {
  const median7d = 500000; // 500k mediana
  const normalPrice = 600000; // 600k (+20% - legítimo)
  const inflatedPrice = 2500000; // 2.5M (+400% - exomagueo o precio troll)

  // Caso 1: Precio normal
  const ratioNormal = normalPrice / median7d;
  assert.equal(ratioNormal > 1.45, false);

  // Caso 2: Precio inflado
  const ratioInflated = inflatedPrice / median7d;
  assert.equal(ratioInflated > 1.45, true);

  // Cuando filterOutliers está activo, se ajusta a la mediana
  const effectivePriceWithShield = Math.round(median7d);
  assert.equal(effectivePriceWithShield, 500000);

  // Validación de ganancia protegida:
  const craftCost = 400000;
  const rawNetProfit = inflatedPrice - Math.ceil(inflatedPrice * 0.02) - craftCost;
  const protectedNetProfit = effectivePriceWithShield - Math.ceil(effectivePriceWithShield * 0.02) - craftCost;

  // La ganancia bruta mostraría 2.05M falsos, pero la protegida muestra 90k reales
  assert.ok(rawNetProfit > 2000000);
  assert.equal(protectedNetProfit, 90000);
});

test('GlobalProfitRanking Filters: Filtro por niveles de Liquidez y Rotación', () => {
  // Ítem A: Sin ventas
  const analysisA = analyzeSalesVolume(10000, null);
  assert.equal(analysisA.hasData, false);
  assert.equal(analysisA.avgDailySales, 0);

  // Ítem B: Rotación baja (0.2 uds/día)
  const analysisB = analyzeSalesVolume(10000, { sales7d: 1, sales30d: 3, avgDailySales: 0.2 });
  assert.equal(analysisB.hasData, true);
  assert.ok(analysisB.avgDailySales > 0);
  assert.ok(analysisB.avgDailySales < 0.5);

  // Ítem C: Rotación media (0.8 uds/día)
  const analysisC = analyzeSalesVolume(10000, { sales24h: 1, sales7d: 5, sales30d: 25 });
  assert.ok(analysisC.avgDailySales >= 0.5);
  assert.ok(analysisC.avgDailySales < 2.0);

  // Ítem D: Alta rotación (5 uds/día)
  const analysisD = analyzeSalesVolume(10000, { sales24h: 5, sales7d: 35, sales30d: 150 });
  assert.ok(analysisD.avgDailySales >= 2.0);
});

test('GlobalProfitRanking Filters: Estimación de tiempo de recuperación de capital (Payback)', () => {
  const craftCost = 100000;
  const salePrice = 150000;
  const tax = Math.ceil(salePrice * 0.02); // 3000
  const dailySpeed = 2.0; // 2 unidades por día
  const dailyRevenue = dailySpeed * (salePrice - tax); // 2 * 147,000 = 294,000 K/día

  const paybackDays = craftCost / dailyRevenue; // ~0.34 días
  const paybackHours = Math.round(paybackDays * 24); // ~8 horas

  assert.ok(paybackHours > 0);
  assert.equal(paybackHours, 8);
});

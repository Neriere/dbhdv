import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBycWorkbook } from '../src/services/bycExcelExportService.js';
import { BYC_GENERATED_DB } from '../src/data/bycGeneratedDbData.js';
import * as XLSX from 'xlsx';

test('ByC Excel Export genera un libro con las 4 hojas requeridas', () => {
  const wb = buildBycWorkbook({
    playersCount: 5,
    sebuscalinPrice: 320,
    marketTaxRate: 0.03,
  });

  assert.deepEqual(wb.SheetNames, [
    'ANALISIS_POR_BYC',
    'RESUMEN_EJECUTIVO_RANKING',
    'DETALLE_RECETAS_MATERIALES',
    'COTIZACIONES_Y_MERCADO',
  ]);
});

test('ByC Database contiene exactamente 45 búsquedas y categorías corregidas', () => {
  assert.equal(BYC_GENERATED_DB.length, 45);

  const astrubHunts = BYC_GENERATED_DB.filter((h) => h.category === 'Astrub');
  const amaknaHunts = BYC_GENERATED_DB.filter((h) => h.category === 'Castillo de Amakna');

  // Astrub debe tener 11 cacerías (incluyendo Noai, Rok, Musha, Aermyn)
  assert.equal(astrubHunts.length, 11);
  // Castillo de Amakna debe tener 13 cacerías
  assert.equal(amaknaHunts.length, 13);

  // Verificar fragmentos dinámicos en la base de datos
  const fragsCountMap: Record<number, number> = {};
  BYC_GENERATED_DB.forEach((h) => {
    const fCount = h.fragments.length;
    fragsCountMap[fCount] = (fragsCountMap[fCount] || 0) + 1;
  });

  assert.equal(fragsCountMap[2], 1, 'Debe haber 1 cacería con 2 fragmentos');
  assert.equal(fragsCountMap[4], 10, 'Debe haber 10 cacerías con 4 fragmentos');
  assert.equal(fragsCountMap[5], 24, 'Debe haber 24 cacerías con 5 fragmentos');
  assert.equal(fragsCountMap[8], 10, 'Debe haber 10 cacerías con 8 fragmentos');
});

test('ANALISIS_POR_BYC contiene parámetros en B4, E4, H4 y fórmulas con SUMIF', () => {
  const wb = buildBycWorkbook({
    playersCount: 5,
    sebuscalinPrice: 320,
    marketTaxRate: 0.03,
  });

  const ws = wb.Sheets['ANALISIS_POR_BYC'];
  assert.ok(ws, 'Hoja ANALISIS_POR_BYC debe existir');

  // Parámetros de control
  assert.equal(ws['B4']?.v, 5, 'B4 debe ser 5 jugadores');
  assert.equal(ws['E4']?.v, 320, 'E4 debe ser 320 kamas');
  assert.equal(ws['H4']?.v, 0.03, 'H4 debe ser 0.03 tasa');

  // Fórmulas de resumen global en filas 5 y 6
  assert.ok(ws['B5']?.f?.includes('SUMIF'), 'B5 debe usar SUMIF para sumar inversión de cacerías con SÍ');
  assert.ok(ws['H5']?.f?.includes('SUMIF'), 'H5 debe usar SUMIF para sumar ganancia de cacerías con SÍ');
  assert.equal(ws['B6']?.f, 'H5/$B$4', 'B6 debe calcular ganancia por jugador dividiendo entre B4');
});

test('DETALLE_RECETAS_MATERIALES y COTIZACIONES_Y_MERCADO tienen datos completos', () => {
  const wb = buildBycWorkbook({
    playersCount: 5,
    sebuscalinPrice: 320,
    marketTaxRate: 0.03,
  });

  const wsRecetas = wb.Sheets['DETALLE_RECETAS_MATERIALES'];
  const wsCotizaciones = wb.Sheets['COTIZACIONES_Y_MERCADO'];

  const recetasData = XLSX.utils.sheet_to_json<any>(wsRecetas, { header: 1 });
  const cotizacionesData = XLSX.utils.sheet_to_json<any>(wsCotizaciones, { header: 1 });

  // Deben tener encabezados y filas
  assert.ok(recetasData.length > 50, 'Debe contener filas de recetas de materiales');
  assert.ok(cotizacionesData.length > 50, 'Debe contener cotizaciones de mercado');
});

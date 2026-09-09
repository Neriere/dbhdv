import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateItemMarketPrice } from '../src/server/localDataStore.js';
import type { DofusItem } from '../src/types.js';

test('Esquíritu majestuoso (#31521) con objeto de precios desfasado por prefijo 6', () => {
  const item = {
    id: 31521,
    name: { es: 'Esquíritu majestuoso' },
    level: 200,
    typeId: 6, // Consumible
  } as unknown as DofusItem;

  // Payload desfasado: '1' tiene 6 (categoría/conteo), '10' tiene el precio de 1x (1370), '100' tiene 10x (13486)
  const precios = {
    '1': 6,
    '10': 1370,
    '100': 13486,
    '1000': 135900,
  };

  const result = calculateItemMarketPrice(item, precios, 'recurso');
  assert.equal(result.resolvedType, 'recurso');
  // Debe haber detectado el desfasaje: el precio unitario x1 debe ser 1370, NO 6
  assert.ok(result.finalPrice >= 1300, `Precio final ${result.finalPrice} debe ser >= 1300`);
  assert.notEqual(result.finalPrice, 6, 'El precio final NUNCA debe ser 6 kamas');
  assert.ok(result.minPrice >= 1300, `Precio mínimo ${result.minPrice} debe ser >= 1300`);
});

test('Pergamino de ganadero (#34203) con arreglo de precios desfasado por prefijo 4', () => {
  const item = {
    id: 34203,
    name: { es: 'Pergamino de ganadero' },
    level: 1,
    typeId: 4, // Pergamino
  } as unknown as DofusItem;

  // Arreglo con prefijo 4: [4, 4290, 40000, 458996, 4999999]
  const precios = [4, 4290, 40000, 458996, 4999999];

  const result = calculateItemMarketPrice(item, precios, 'recurso');
  assert.equal(result.resolvedType, 'recurso');
  assert.ok(result.finalPrice >= 4000, `Precio final ${result.finalPrice} debe ser >= 4000`);
  assert.notEqual(result.finalPrice, 4, 'El precio final NUNCA debe ser 4 kamas');
});

test('Descarte de precio corrupto/anómalo de 6 kamas para consumible esquíritu', () => {
  const item = {
    id: 31521,
    name: { es: 'Esquíritu majestuoso' },
    level: 200,
    typeId: 6,
  } as unknown as DofusItem;

  // Si por error de red solo llega '1': 6
  const precios = {
    '1': 6,
  };

  const result = calculateItemMarketPrice(item, precios, 'recurso');
  // Debe haber sido descartado completamente (finalPrice: 0)
  assert.equal(result.finalPrice, 0, 'No debe guardarse 6 kamas para un Esquíritu majestuoso');
  assert.equal(result.offersCount, 0);
});

test('Descarte de precio corrupto/anómalo de 4 kamas para pergamino de ganadero', () => {
  const item = {
    id: 34203,
    name: { es: 'Pergamino de ganadero' },
    level: 1,
    typeId: 4,
  } as unknown as DofusItem;

  // Si por error de red solo llega '1': 4
  const precios = {
    '1': 4,
  };

  const result = calculateItemMarketPrice(item, precios, 'recurso');
  assert.equal(result.finalPrice, 0, 'No debe guardarse 4 kamas para un Pergamino de ganadero');
});

test('Escalera estándar de 4 lotes para recurso normal', () => {
  const item = {
    id: 300,
    name: { es: 'Madera de fresno' },
    level: 1,
    typeId: 15,
  } as unknown as DofusItem;

  const precios = {
    '1': 45,
    '10': 420,
    '100': 4000,
    '1000': 38000,
  };

  const result = calculateItemMarketPrice(item, precios, 'recurso');
  assert.equal(result.resolvedType, 'recurso');
  assert.ok(result.finalPrice >= 38 && result.finalPrice <= 45);
  assert.equal(result.offersCount, 4);
});

test('Cinturón de Brus Bulguru (#13114) con ofertas normales de equipable', () => {
  const item = {
    id: 13114,
    name: { es: 'Cinturón de Brus Bulguru' },
    level: 198,
    typeId: 10, // Cinturón
  } as unknown as DofusItem;

  const precios = [1350000, 1400000, 1500000];
  const result = calculateItemMarketPrice(item, precios, 'equipable');
  assert.equal(result.resolvedType, 'equipable');
  assert.ok(result.finalPrice >= 1350000, `Precio final ${result.finalPrice} debe ser >= 1350000`);
  assert.equal(result.minPrice, 1350000);
});

test('Cinturón de Brus Bulguru (#13114) rechaza precio corrupto de 6 kamas', () => {
  const item = {
    id: 13114,
    name: { es: 'Cinturón de Brus Bulguru' },
    level: 198,
    typeId: 10,
  } as unknown as DofusItem;

  const precios = [6];
  const result = calculateItemMarketPrice(item, precios, 'equipable');
  assert.equal(result.finalPrice, 0, 'No debe guardarse 6 kamas para un Cinturón de Brus');
  assert.equal(result.offersCount, 0);
});

test('Corteza de Brus (#18693) con lote astronómico de 29,999,990k en p1 asignado como x1000', () => {
  const item = {
    id: 18693,
    name: { es: 'Corteza de Brus' },
    level: 198,
    typeId: 15,
  } as unknown as DofusItem;

  // Lote de 1000 unidades a 29,999,990 kamas recibido en '1'
  const precios = {
    '1': 29999990,
  };

  const result = calculateItemMarketPrice(item, precios, 'recurso');
  assert.equal(result.resolvedType, 'recurso');
  // Debe haber detectado que 29.9M es lote x1000 -> unitario ~29,999k o 30,000k, NUNCA 29,999,990k
  assert.ok(result.finalPrice < 100000, `Precio final ${result.finalPrice} debe ser unitario normal (< 100,000k)`);
  assert.ok(result.finalPrice >= 25000, `Precio final ${result.finalPrice} debe ser coherente (>= 25,000k)`);
});

test('Recurso con lotes en orden descendente (x1000 a x1) se invierte automáticamente', () => {
  const item = {
    id: 18693,
    name: { es: 'Corteza de Brus' },
    level: 198,
    typeId: 15,
  } as unknown as DofusItem;

  const precios = {
    '1': 29999990,
    '10': 2900000,
    '100': 290000,
    '1000': 30000,
  };

  const result = calculateItemMarketPrice(item, precios, 'recurso');
  assert.equal(result.resolvedType, 'recurso');
  assert.ok(result.finalPrice < 35000, `Precio final ${result.finalPrice} debe estar en el rango de 30k`);
  assert.ok(result.minPrice <= 30000, `Precio mínimo ${result.minPrice} debe ser ~30k`);
});


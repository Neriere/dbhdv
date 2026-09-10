import test from 'node:test';
import assert from 'node:assert/strict';
import {
  syncRemoteSalesVolume,
  handleRemoteVolumeUpdate,
  ItemSalesVolume,
  SalesVolumeMap,
} from '../src/services/salesVolumeService.js';

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

test('LWW: Cotización remota más antigua NO sobreescribe cambios locales más recientes', () => {
  localStorage.clear();

  // Local tiene un cambio hecho a las T = 2000
  const localVolume: ItemSalesVolume = {
    sales24h: 15,
    sales7d: 50,
    sales30d: 180,
    avgDailySales: 6.5,
    updatedAt: 2000,
  };
  localStorage.setItem('dofus_sales_volume_v1', JSON.stringify({ 12345: localVolume }));

  // Llega un update remoto viejo con T = 1000
  const staleRemoteVolume: ItemSalesVolume = {
    sales24h: 5,
    sales7d: 20,
    sales30d: 60,
    avgDailySales: 2.0,
    updatedAt: 1000,
  };

  const wasUpdated = handleRemoteVolumeUpdate(12345, staleRemoteVolume);
  assert.equal(wasUpdated, false, 'No debe aplicar la actualización obsoleta');

  const stored = JSON.parse(localStorage.getItem('dofus_sales_volume_v1') || '{}');
  assert.equal(stored[12345].sales24h, 15, 'Debe retener las 15 ventas locales más recientes');
  assert.equal(stored[12345].updatedAt, 2000);
});

test('LWW: Cotización remota más reciente SÍ actualiza la base local', () => {
  localStorage.clear();

  // Local tiene T = 2000
  const localVolume: ItemSalesVolume = {
    sales24h: 10,
    sales7d: 30,
    sales30d: 90,
    updatedAt: 2000,
  };
  localStorage.setItem('dofus_sales_volume_v1', JSON.stringify({ 99999: localVolume }));

  // Llega un update remoto más reciente de otro jugador con T = 3000
  const newerRemoteVolume: ItemSalesVolume = {
    sales24h: 25,
    sales7d: 70,
    sales30d: 250,
    avgDailySales: 10.0,
    updatedAt: 3000,
  };

  const wasUpdated = handleRemoteVolumeUpdate(99999, newerRemoteVolume);
  assert.equal(wasUpdated, true, 'Debe aceptar la actualización remota más reciente');

  const stored = JSON.parse(localStorage.getItem('dofus_sales_volume_v1') || '{}');
  assert.equal(stored[99999].sales24h, 25, 'Debe haberse actualizado a 25 ventas');
  assert.equal(stored[99999].updatedAt, 3000);
});

test('LWW: syncRemoteSalesVolume combina ítems conservando siempre los más recientes', () => {
  localStorage.clear();

  // Estado local con 2 ítems:
  // Item 1: Editado localmente en T = 5000 (más nuevo que remoto)
  // Item 2: Editado localmente en T = 1000 (más viejo que remoto)
  const localMap: SalesVolumeMap = {
    101: { sales24h: 8, updatedAt: 5000 },
    102: { sales24h: 2, updatedAt: 1000 },
  };
  localStorage.setItem('dofus_sales_volume_v1', JSON.stringify(localMap));

  // Mapa remoto proveniente del servidor Turso:
  // Item 1: T = 3000 (obsoleto comparado con local)
  // Item 2: T = 4000 (más nuevo que local)
  // Item 103: T = 2500 (nuevo en remoto, no existe en local)
  const remoteMap: SalesVolumeMap = {
    101: { sales24h: 1, updatedAt: 3000 },
    102: { sales24h: 12, updatedAt: 4000 },
    103: { sales24h: 30, updatedAt: 2500 },
  };

  const merged = syncRemoteSalesVolume(remoteMap);

  // Item 101 debe conservar la versión local (T = 5000, sales24h = 8)
  assert.equal(merged[101].sales24h, 8, 'Item 101 debe mantener 8 ventas locales');
  assert.equal(merged[101].updatedAt, 5000);

  // Item 102 debe tomar la versión remota más reciente (T = 4000, sales24h = 12)
  assert.equal(merged[102].sales24h, 12, 'Item 102 debe actualizarse a 12 ventas remotas');
  assert.equal(merged[102].updatedAt, 4000);

  // Item 103 debe incorporarse desde el remoto
  assert.equal(merged[103].sales24h, 30, 'Item 103 debe agregarse con 30 ventas');
  assert.equal(merged[103].updatedAt, 2500);
});

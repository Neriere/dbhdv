import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMMUNITY_TOKENS,
  getCommunityTokensFromDb,
  saveCommunityTokenInDb,
} from '../src/server/localDataStore';
import { importActiveListingsJSON } from '../src/services/salesHistoryService';

test('DEFAULT_COMMUNITY_TOKENS incluye active_listings con valor ket', () => {
  assert.equal(DEFAULT_COMMUNITY_TOKENS.active_listings, 'ket');
  assert.equal(DEFAULT_COMMUNITY_TOKENS.price_list, 'jzn');
  assert.equal(DEFAULT_COMMUNITY_TOKENS.inventory, 'isb');
  assert.equal(DEFAULT_COMMUNITY_TOKENS.storage, 'hlp');
  assert.equal(DEFAULT_COMMUNITY_TOKENS.sales_history, 'kyo');
});

test('saveCommunityTokenInDb y getCommunityTokensFromDb persisten active_listings', async () => {
  const saveOk = await saveCommunityTokenInDb('active_listings', 'ket');
  assert.ok(saveOk, 'Debe guardar el token con éxito en la base de datos');

  const { tokens } = await getCommunityTokensFromDb();
  assert.equal(tokens.active_listings, 'ket');
});

test('importActiveListingsJSON preserva el valor exacto del lote sin multiplicar de forma redundante', () => {
  const mockItem = {
    itemId: 31673,
    name: 'Cuerno de giráfaro',
    quantity: 10,
    price: 533104, // Valor del lote completo según el paquete de red Dofus Unity 3.6
    secondsRemaining: 205200,
    timeLabel: '2d 9h',
    market: 'recursos',
  };

  const payload = {
    version: '3.6.0',
    metadata: {
      capturedAt: '2026-10-01 15:39:00',
      totalLots: 1,
      totalValue: 533104,
    },
    listings: [mockItem],
  };

  const { snapshot } = importActiveListingsJSON(payload);
  assert.equal(snapshot.listings.length, 1);
  assert.equal(snapshot.listings[0].quantity, 10);
  assert.equal(snapshot.listings[0].price, 533104, 'El precio del lote debe conservarse exactamente como viene del paquete');
  assert.equal(snapshot.totalValue, 533104, 'El valor total consolidado debe ser la suma exacta de los lotes');
});

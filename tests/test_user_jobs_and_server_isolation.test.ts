import test from 'node:test';
import assert from 'node:assert/strict';

// Setup mock window and localStorage
const mockStorage: Record<string, string> = {};
(global as any).window = {
  dispatchEvent: () => true,
  CustomEvent: class {
    constructor(public type: string, public init?: any) {}
  },
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

import {
  getUserJobSettings,
  saveUserJobSettings,
  setUserJobLevel,
  setAllUserJobLevels,
  toggleUserJobsEnabled,
  canUserCraftItem,
  canUserMageItem,
  canUserCraftOrMageItem,
} from '../src/services/userJobsService.js';

import {
  getSavedItemCoefficient,
  saveItemCoefficient,
  getAllSavedItemCoefficients,
} from '../src/data/dofusRuneWeights.js';

test('userJobsService: guarda y recupera niveles de oficio con persistencia local', () => {
  localStorage.clear();

  const initial = getUserJobSettings();
  assert.equal(initial.enabled, false);

  // Activar filtro
  const enabledState = toggleUserJobsEnabled(true);
  assert.equal(enabledState, true);
  assert.equal(getUserJobSettings().enabled, true);

  // Modificar nivel de Sastre (id: 27) a 150
  setUserJobLevel(27, 150);
  assert.equal(getUserJobSettings().jobs[27], 150);

  // Set all maging to 100
  setAllUserJobLevels(100, 'maging');
  const settings = getUserJobSettings();
  assert.equal(settings.jobs[64], 100); // Sastremago
  assert.equal(settings.jobs[63], 100); // Joyeromago
  assert.equal(settings.jobs[27], 150); // Sastre crafteo no fue alterado
});

test('userJobsService: validación de crafteo canUserCraftItem según oficio y nivel', () => {
  localStorage.clear();
  toggleUserJobsEnabled(true);

  // Sastre (27) al nivel 100
  setUserJobLevel(27, 100);
  // Joyero (16) al nivel 50
  setUserJobLevel(16, 50);

  // Ítem nivel 80 de sastre (Sombrero)
  const hatItem = { id: 1001, level: 80, type: 'Sombrero' };
  assert.equal(canUserCraftItem(hatItem), true, 'Debe poder craftear sombrero nivel 80 con sastre 100');

  // Ítem nivel 150 de sastre (Capa)
  const capeItem = { id: 1002, level: 150, type: 'Capa' };
  assert.equal(canUserCraftItem(capeItem), false, 'NO debe poder craftear capa nivel 150 con sastre 100');

  // Ítem con typeId de joyero (anillo = typeId 9) nivel 60
  const ringItem = { id: 1003, level: 60, typeId: 9 };
  assert.equal(canUserCraftItem(ringItem), false, 'NO debe poder craftear anillo nivel 60 con joyero 50');

  // Si deshabilitamos el filtro global, todo debe estar permitido
  toggleUserJobsEnabled(false);
  assert.equal(canUserCraftItem(capeItem), true, 'Con filtro deshabilitado debe permitir cualquier ítem');
});

test('userJobsService: validación de forjamagia canUserMageItem y canUserCraftOrMageItem', () => {
  localStorage.clear();
  toggleUserJobsEnabled(true);

  // Sastre (27) al nivel 50, Sastremago (64) al nivel 200
  setUserJobLevel(27, 50);
  setUserJobLevel(64, 200);

  const highHat = { id: 2001, level: 180, type: 'Sombrero' };

  assert.equal(canUserCraftItem(highHat), false, 'No puede craftear sombrero 180 con sastre 50');
  assert.equal(canUserMageItem(highHat), true, 'Sí puede magear sombrero 180 con sastremago 200');
  assert.equal(canUserCraftOrMageItem(highHat), true, 'Rompedora: puede mostrarse porque puede magearlo');
});

test('dofusRuneWeights: aislamiento estricto de coeficientes por servidor', () => {
  localStorage.clear();

  // Guardar un coeficiente en Draconiros
  saveItemCoefficient(9999, 120, 'draconiros');
  assert.equal(getSavedItemCoefficient(9999, 'draconiros'), 120);

  // En servidor Talok, NO debe leer el coeficiente de Draconiros
  const talokCoeff = getSavedItemCoefficient(9999, 'talok');
  assert.equal(talokCoeff, null, 'Talok debe arrancar limpio sin heredar coeficientes de Draconiros');

  // Guardar coeficiente específico en Talok
  saveItemCoefficient(9999, 85, 'talok');
  assert.equal(getSavedItemCoefficient(9999, 'talok'), 85);
  assert.equal(getSavedItemCoefficient(9999, 'draconiros'), 120, 'Draconiros no debe ser sobreescrito por Talok');
});

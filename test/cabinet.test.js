import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCabinetLayout } from '../src/data/cabinetLayout.js';
import { MAIN_RACK, EQUIPMENT_PHYSICAL, validateRackConstraints, computeBOM } from '../src/data/cabinetSpecs.js';

let instance = 0;
function memoryStorage(initial = null) {
  let saved = initial;
  return {
    getItem: () => saved,
    setItem: (_key, value) => { saved = value; },
  };
}

async function loadStore(storage) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const { useCabinetStore } = await import(`../src/stores/useCabinetStore.js?test=${++instance}`);
  return useCabinetStore;
}

test('selecting and clearing equipment preserve settings and store actions', async () => {
  const store = await loadStore(memoryStorage());
  store.getState().setMaterial('oak');
  store.getState().setSelected('a90');
  assert.equal(store.getState().selected, 'a90');
  store.getState().setSelected(null);
  assert.equal(store.getState().selected, null);
  assert.equal(store.getState().materialId, 'oak');
  store.getState().setXray();
  assert.equal(store.getState().xray, true);
});

test('X-ray and exploded toggles persist without changing material', async () => {
  const storage = memoryStorage();
  const store = await loadStore(storage);
  store.getState().setXray();
  let restored = await loadStore(storage);
  assert.equal(restored.getState().xray, true);
  restored.getState().setExploded();
  restored = await loadStore(storage);
  assert.equal(restored.getState().exploded, true);
  restored.getState().setXray(false);
  restored = await loadStore(storage);
  assert.equal(restored.getState().xray, false);
  assert.equal(restored.getState().exploded, true);
});

test('reset persists defaults and removes selection across reload', async () => {
  const storage = memoryStorage();
  const store = await loadStore(storage);
  store.getState().setMaterial('alder');
  store.getState().setXray(true);
  store.getState().setExploded(true);
  store.getState().setSelected('phono');
  store.getState().reset();
  const restored = (await loadStore(storage)).getState();
  assert.equal(restored.materialId, 'walnut');
  assert.equal(restored.xray, false);
  assert.equal(restored.exploded, false);
  assert.equal(restored.selected, null);
  assert.equal(typeof restored.setSelected, 'function');
});

test('stale selection, invalid material and string booleans are not restored', async () => {
  const storage = memoryStorage(JSON.stringify({ materialId: 'toString', xray: 'false', exploded: true, selected: 'a90' }));
  const state = (await loadStore(storage)).getState();
  assert.equal(state.materialId, 'walnut');
  assert.equal(state.xray, false);
  assert.equal(state.exploded, true);
  assert.equal(state.selected, null);
});

test('unavailable or corrupt browser storage does not break controls', async (t) => {
  t.mock.method(console, 'warn', () => {});
  for (const storage of [memoryStorage('{invalid'), undefined, {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
  }]) {
    const store = await loadStore(storage);
    store.getState().setXray(true);
    store.getState().setSelected('arcam');
    assert.equal(store.getState().xray, true);
    assert.equal(store.getState().selected, 'arcam');
  }
});

test('assembled equipment starts above its own shelf and below the next', () => {
  const { shelves, drops, expectedYByUnit, totalHeight } = computeCabinetLayout();
  assert.equal(drops.length, 6);
  assert.equal(shelves.length, 4);
  assert.ok(Math.abs(totalHeight - 0.9198) < 1e-10);
  MAIN_RACK.tiers.forEach((tier, index) => {
    for (const { equipmentId } of tier.items) {
      const drop = drops.find((unit) => unit.equipmentId === equipmentId);
      const halfHeight = EQUIPMENT_PHYSICAL[equipmentId].dims.h / 2000;
      const shelfTop = shelves[index].y + MAIN_RACK.shelfThickness / 1000;
      assert.ok(Math.abs(expectedYByUnit[equipmentId] - halfHeight - shelfTop) < 1e-10);
      assert.ok(drop.position[1] - halfHeight > shelfTop);
      if (shelves[index + 1]) assert.ok(drop.position[1] + halfHeight < shelves[index + 1].y);
    }
  });
});

test('rack supports an open top turntable and keeps the heavy amplifier at the bottom', () => {
  assert.deepEqual(MAIN_RACK.tiers[0].items.map(item => item.equipmentId), ['arcam']);
  assert.deepEqual(MAIN_RACK.tiers.at(-1).items.map(item => item.equipmentId), ['turntable']);
  assert.equal(MAIN_RACK.tiers.at(-1).openTop, true);
  assert.deepEqual(validateRackConstraints(), []);
  const { shelves } = computeCabinetLayout();
  assert.equal(computeBOM().shelves.count, shelves.length);
  assert.equal(computeBOM().frame.shelfMounts, shelves.length * 4);
  assert.equal(computeBOM().shelves.totalAreaM2, 1.224);
});

test('exploded view separates tiers and gear without changing assembled geometry', () => {
  const assembled = computeCabinetLayout();
  const exploded = computeCabinetLayout(true);
  assert.ok(exploded.totalHeight > assembled.totalHeight);
  for (let i = 1; i < exploded.shelves.length; i += 1) {
    assert.ok(exploded.shelves[i].y - exploded.shelves[i - 1].y > assembled.shelves[i].y - assembled.shelves[i - 1].y);
  }
  for (const unit of exploded.drops) {
    const original = assembled.drops.find(({ equipmentId }) => equipmentId === unit.equipmentId);
    assert.ok(unit.position[1] > original.position[1]);
    assert.equal(unit.position[0], original.position[0]);
  }
  assert.deepEqual(computeCabinetLayout(false), assembled);
});

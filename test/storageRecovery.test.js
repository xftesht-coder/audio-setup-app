import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopStore, WORKSHOP_STORAGE_KEY } from '../src/stores/useWorkshopStore.js';
import { createSystemPlanStore, SYSTEM_STORAGE_KEY } from '../src/stores/useSystemPlanStore.js';
import { createLightingStore, LIGHTING_STORAGE_KEY } from '../src/stores/useLightingStore.js';
import { createRoomPreview } from '../src/data/roomPreview.js';

const product = { id: 'floor-lamp', name: 'Govee Floor Lamp' };
function memory(entries = []) {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const stores = [
  { name: 'workshop', key: WORKSHOP_STORAGE_KEY, create: createWorkshopStore, edit: s => s.switchVariant('tv'), check: s => assert.equal(s.activeVariant, 'tv') },
  { name: 'system', key: SYSTEM_STORAGE_KEY, create: createSystemPlanStore, edit: s => s.saveVariant('Test'), check: s => assert.equal(s.variants[0].name, 'Test') },
  { name: 'lighting', key: LIGHTING_STORAGE_KEY, create: createLightingStore, edit: s => s.add(product), check: s => assert.equal(s.planned[0].id, product.id) },
];
for (const { name, key, create, edit, check } of stores) {
  test(`${name}: unreadable data is backed up verbatim before the next edit and reload`, () => {
    for (const bad of ['', '{broken', '{"version":999}']) {
      const disk = memory([[key, bad]]), s = create(() => disk, () => 'backup');
      assert.ok(s.getState().storageError);
      assert.equal(disk.getItem(key), bad);
      edit(s.getState());
      assert.equal(s.getState().storageError, '');
      assert.equal(disk.getItem(`${key}-recovery-backup`), bad);
      check(create(() => disk).getState());
    }
  });
  test(`${name}: failed backups and collisions never overwrite original data`, () => {
    for (const collision of [false, true]) {
      const disk = memory([[key, '{broken']]);
      if (collision) disk.setItem(`${key}-recovery-backup`, 'older backup');
      else disk.setItem = () => { throw new Error('quota'); };
      const s = create(() => disk, () => 'backup');
      assert.doesNotThrow(() => edit(s.getState()));
      check(s.getState());
      assert.ok(s.getState().storageError);
      assert.equal(disk.getItem(key), '{broken');
      if (collision) assert.equal(disk.getItem(`${key}-recovery-backup`), 'older backup');
    }
  });
  test(`${name}: read access failure prevents destructive writes even after storage becomes available`, () => {
    const disk = memory([[key, 'unread original']]);
    let blocked = true;
    const s = create(() => {
      if (blocked) throw new Error('denied');
      return disk;
    });
    blocked = false;
    edit(s.getState());
    assert.ok(s.getState().storageError);
    assert.equal(disk.getItem(key), 'unread original');
  });
}
test('lighting: malformed saved lists and quantities are rejected without crashing the catalog', () => {
  for (const planned of [{}, null, [null], [{ ...product, quantity: 0 }], [{ ...product, quantity: 21 }], [{ ...product, quantity: 1 }, { ...product, quantity: 2 }]]) {
    const disk = memory([[LIGHTING_STORAGE_KEY, JSON.stringify({ state: { planned }, version: 0 })]]);
    const s = createLightingStore(() => disk);
    assert.deepEqual(s.getState().planned, []);
    assert.ok(s.getState().storageError);
  }
});
test('lighting: saved unknown fields cannot replace actions; quantity and removal survive reload', () => {
  const disk = memory([[LIGHTING_STORAGE_KEY, JSON.stringify({ state: { planned: [], add: 'broken' }, version: 0 })]]);
  const s = createLightingStore(() => disk);
  s.getState().add(product);
  s.getState().add(product);
  s.getState().setQuantity(product.id, 2);
  let reloaded = createLightingStore(() => disk);
  assert.deepEqual(reloaded.getState().planned, [{ ...product, quantity: 2 }]);
  reloaded.getState().remove(product.id);
  reloaded = createLightingStore(() => disk);
  assert.deepEqual(reloaded.getState().planned, []);
});
test('share preview is deterministic and independent of saved room data or another preview', () => {
  const a = createRoomPreview(), pristine = structuredClone(a), tv = createRoomPreview('tv');
  tv.project.shelves[0].width += 100;
  tv.cables[0].from = null;
  assert.deepEqual(a, pristine);
  assert.deepEqual(createRoomPreview(), pristine);
  assert.equal(createRoomPreview('tv').project.shelves.length, 2);
});
